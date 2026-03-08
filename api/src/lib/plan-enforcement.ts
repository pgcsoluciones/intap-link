import { getEntitlements } from '../engine/entitlements'

export type LimitedEntity = 'links' | 'faqs' | 'products' | 'photos' | 'videos'

const ENTITY_TABLE: Record<LimitedEntity, string> = {
  links:    'profile_links',
  faqs:     'profile_faqs',
  products: 'profile_products',
  photos:   'profile_gallery',
  videos:   'profile_videos',
}

/**
 * Resolves the owned profile ID from the authenticated session.
 * Returns the profile row { id, plan_id } or null if not found.
 * Ownership chain: session -> user_id -> profiles.user_id
 */
export async function getOwnedProfile(
  db: D1Database,
  userId: string,
): Promise<{ id: string; plan_id: string } | null> {
  const row = await db.prepare(
    `SELECT id, plan_id FROM profiles WHERE user_id = ? LIMIT 1`
  ).bind(userId).first()
  return row ? { id: (row as any).id, plan_id: (row as any).plan_id } : null
}

/**
 * Checks the plan limit for the given entity before an INSERT.
 * Queries current count + entitlements from DB — never trusts frontend values.
 *
 * Returns a Response (422 PLAN_LIMIT_EXCEEDED) if limit is reached,
 * or null if the operation is allowed.
 *
 * Structured warning log is emitted on block.
 */
export async function checkPlanLimit(
  c: any,
  profileId: string,
  entity: LimitedEntity,
): Promise<Response | null> {
  const db = c.env.DB

  // Fetch plan_id and current count in a single query
  const table = ENTITY_TABLE[entity]
  const infoRow = await db.prepare(
    `SELECT p.plan_id,
            (SELECT COUNT(*) FROM ${table} WHERE profile_id = p.id) AS current_count
     FROM profiles p WHERE p.id = ? LIMIT 1`
  ).bind(profileId).first()

  const planId  = (infoRow as any)?.plan_id     ?? 'unknown'
  const current = ((infoRow as any)?.current_count ?? 0) as number

  let ent: Awaited<ReturnType<typeof getEntitlements>>
  try {
    ent = await getEntitlements(c, profileId)
  } catch (e) {
    const requestId = c.req.header('cf-ray') || c.req.header('x-request-id') || ''
    console.error(JSON.stringify({
      level: 'error', event: 'entitlements_load_failed',
      route: c.req.path, profileId, entity, error: String(e), requestId,
    }))
    return c.json({ ok: false, error: 'Error loading plan entitlements' }, 500)
  }

  const limitMap: Record<LimitedEntity, number> = {
    links:    ent.maxLinks,
    faqs:     ent.maxFaqs,
    products: ent.maxProducts,
    photos:   ent.maxPhotos,
    videos:   ent.maxVideos,
  }

  const limit = limitMap[entity]

  if (current >= limit) {
    const requestId = c.req.header('cf-ray') || c.req.header('x-request-id') || ''
    console.warn(JSON.stringify({
      level:     'warn',
      event:     'plan_limit_exceeded',
      route:     c.req.path,
      profileId,
      entity,
      limit,
      current,
      plan:      planId,
      requestId,
    }))
    return c.json({
      ok:      false,
      code:    'PLAN_LIMIT_EXCEEDED',
      entity,
      limit,
      current,
      plan:    planId,
      error:   `Plan limit reached for ${entity}: ${current}/${limit}`,
    }, 422)
  }

  return null
}
