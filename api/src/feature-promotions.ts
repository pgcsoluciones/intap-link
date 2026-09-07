import app from './index'
import { cookieNames } from './lib/cookies'
import { requireSuperAdmin } from './lib/admin-auth'

export type PromotionAccess = {
  allowed: boolean
  source: 'promotion' | null
  promotion?: {
    id: string
    name: string
    access_mode: 'all' | 'code' | 'profile'
    starts_at: string
    ends_at: string | null
  }
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function parseCookie(header: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = header.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

async function sessionUserId(c: any): Promise<string | null> {
  const rawSession = parseCookie(c.req.header('Cookie') || '', cookieNames(c.env).session)
  if (!rawSession) return null
  const sessionHash = await sha256Hex(rawSession)
  const session = await c.env.DB.prepare(
    `SELECT user_id FROM auth_sessions
      WHERE session_hash = ? AND expires_at > datetime('now') AND revoked_at IS NULL
      LIMIT 1`,
  ).bind(sessionHash).first()
  return session ? String((session as any).user_id) : null
}

async function requirePromotionUser(c: any, next: any) {
  const userId = await sessionUserId(c)
  if (!userId) return c.json({ ok: false, error: 'Unauthorized' }, 401)
  c.set('userId', userId)
  await next()
}

function cleanCode(value: unknown): string {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 40)
}

function sqlNow(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

async function syncPromotionModule(c: any, promotionId: string) {
  const promo = await c.env.DB.prepare(
    `SELECT id, feature_code, target_plan, access_mode, profile_id, starts_at, ends_at, is_enabled
       FROM feature_promotions WHERE id = ? LIMIT 1`,
  ).bind(promotionId).first()
  if (!promo) return

  const featureCode = String((promo as any).feature_code || '')
  const targetPlan = String((promo as any).target_plan || 'free')
  const mode = String((promo as any).access_mode || 'all')
  const enabled = Number((promo as any).is_enabled || 0) === 1
  const startsAt = String((promo as any).starts_at || '')
  const endsAt = (promo as any).ends_at ? String((promo as any).ends_at) : null
  const now = sqlNow()
  const activeNow = enabled && startsAt <= now && (!endsAt || endsAt > now)
  const reason = `promotion:${promotionId}`

  // Always remove grants previously materialized by this promotion first.
  // This prevents an old indefinite grant from surviving when an admin moves
  // the start date to the future, adds an end date, expires or disables it.
  await c.env.DB.prepare(
    `DELETE FROM profile_modules WHERE assignment_reason = ?`,
  ).bind(reason).run()

  if (!activeNow) return

  if (mode === 'all') {
    await c.env.DB.prepare(
      `INSERT INTO profile_modules (profile_id, module_code, expires_at, activated_at, assignment_reason)
       SELECT p.id, ?, ?, datetime('now'), ?
         FROM profiles p
        WHERE p.plan_id = ? AND p.is_active = 1
       ON CONFLICT(profile_id, module_code) DO UPDATE SET
         expires_at = excluded.expires_at,
         assignment_reason = excluded.assignment_reason`,
    ).bind(featureCode, endsAt, reason, targetPlan).run()
    return
  }

  if (mode === 'profile' && (promo as any).profile_id) {
    await c.env.DB.prepare(
      `INSERT INTO profile_modules (profile_id, module_code, expires_at, activated_at, assignment_reason)
       VALUES (?, ?, ?, datetime('now'), ?)
       ON CONFLICT(profile_id, module_code) DO UPDATE SET
         expires_at = excluded.expires_at,
         assignment_reason = excluded.assignment_reason`,
    ).bind(String((promo as any).profile_id), featureCode, endsAt, reason).run()
    return
  }

  if (mode === 'code') {
    await c.env.DB.prepare(
      `INSERT INTO profile_modules (profile_id, module_code, expires_at, activated_at, assignment_reason)
       SELECT fpr.profile_id, ?, ?, datetime('now'), ?
         FROM feature_promotion_redemptions fpr
         JOIN profiles p ON p.id = fpr.profile_id
        WHERE fpr.promotion_id = ?
          AND p.plan_id = ?
          AND p.is_active = 1
       ON CONFLICT(profile_id, module_code) DO UPDATE SET
         expires_at = excluded.expires_at,
         assignment_reason = excluded.assignment_reason`,
    ).bind(featureCode, endsAt, reason, promotionId, targetPlan).run()
  }
}

export async function resolveFeaturePromotionAccess(
  c: any,
  profileId: string,
  planId: string,
  featureCode: string,
): Promise<PromotionAccess> {
  try {
    const rows = await c.env.DB.prepare(
      `SELECT fp.id, fp.name, fp.access_mode, fp.profile_id, fp.starts_at, fp.ends_at,
              CASE WHEN fpr.profile_id IS NOT NULL THEN 1 ELSE 0 END AS redeemed
         FROM feature_promotions fp
         LEFT JOIN feature_promotion_redemptions fpr
           ON fpr.promotion_id = fp.id AND fpr.profile_id = ?
        WHERE fp.feature_code = ?
          AND fp.target_plan = ?
          AND fp.is_enabled = 1
          AND fp.starts_at <= datetime('now')
          AND (fp.ends_at IS NULL OR fp.ends_at > datetime('now'))
        ORDER BY fp.created_at DESC`,
    ).bind(profileId, featureCode, planId).all()

    for (const row of rows.results as any[]) {
      const mode = String(row.access_mode || '')
      const allowed = mode === 'all'
        || (mode === 'profile' && String(row.profile_id || '') === profileId)
        || (mode === 'code' && Number(row.redeemed || 0) === 1)
      if (!allowed) continue
      return {
        allowed: true,
        source: 'promotion',
        promotion: {
          id: String(row.id),
          name: String(row.name || ''),
          access_mode: mode as 'all' | 'code' | 'profile',
          starts_at: String(row.starts_at || ''),
          ends_at: row.ends_at ? String(row.ends_at) : null,
        },
      }
    }
  } catch (error) {
    console.warn('[feature-promotions] lookup unavailable:', String(error))
  }
  return { allowed: false, source: null }
}

app.post('/api/v1/me/feature-promotions/redeem', requirePromotionUser, async (c: any) => {
  const userId = c.get('userId') as string
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Solicitud inválida.' }, 400) }
  const code = cleanCode(body.code)
  if (!code) return c.json({ ok: false, error: 'Indica un código promocional.' }, 400)

  const profile = await c.env.DB.prepare(
    `SELECT id, plan_id FROM profiles WHERE user_id = ? AND is_active = 1 LIMIT 1`,
  ).bind(userId).first()
  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado.' }, 404)

  const promotion = await c.env.DB.prepare(
    `SELECT id, feature_code, name, ends_at
       FROM feature_promotions
      WHERE promo_code = ?
        AND access_mode = 'code'
        AND target_plan = ?
        AND is_enabled = 1
        AND starts_at <= datetime('now')
        AND (ends_at IS NULL OR ends_at > datetime('now'))
      LIMIT 1`,
  ).bind(code, String((profile as any).plan_id || 'free')).first()

  if (!promotion) return c.json({ ok: false, error: 'Este código no es válido o ya no está vigente.' }, 404)

  const promotionId = String((promotion as any).id)
  const profileId = String((profile as any).id)
  const featureCode = String((promotion as any).feature_code)
  const expiresAt = (promotion as any).ends_at ? String((promotion as any).ends_at) : null

  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT OR IGNORE INTO feature_promotion_redemptions (promotion_id, profile_id, redeemed_at)
       VALUES (?, ?, datetime('now'))`,
    ).bind(promotionId, profileId),
    c.env.DB.prepare(
      `INSERT INTO profile_modules (profile_id, module_code, expires_at, activated_at, assignment_reason)
       VALUES (?, ?, ?, datetime('now'), ?)
       ON CONFLICT(profile_id, module_code) DO UPDATE SET
         expires_at = excluded.expires_at,
         assignment_reason = excluded.assignment_reason`,
    ).bind(profileId, featureCode, expiresAt, `promotion:${promotionId}`),
  ])

  return c.json({ ok: true, data: { feature_code: featureCode, promotion_name: String((promotion as any).name || '') } })
})

app.get('/api/v1/superadmin/feature-promotions', requireSuperAdmin('viewer'), async (c: any) => {
  const rows = await c.env.DB.prepare(
    `SELECT fp.*, p.slug AS profile_slug,
            CASE WHEN fp.is_enabled = 1
                   AND fp.starts_at <= datetime('now')
                   AND (fp.ends_at IS NULL OR fp.ends_at > datetime('now'))
                 THEN 1 ELSE 0 END AS is_active_now
       FROM feature_promotions fp
       LEFT JOIN profiles p ON p.id = fp.profile_id
      ORDER BY fp.created_at DESC`,
  ).all()
  return c.json({ ok: true, data: rows.results })
})

app.post('/api/v1/superadmin/feature-promotions', requireSuperAdmin('super_admin'), async (c: any) => {
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Solicitud inválida.' }, 400) }

  const featureCode = String(body.feature_code || '').trim().toLowerCase().replace(/[^a-z0-9_:-]/g, '').slice(0, 80)
  const name = String(body.name || '').trim().slice(0, 120)
  const targetPlan = String(body.target_plan || 'free').trim().toLowerCase().slice(0, 40)
  const accessMode = String(body.access_mode || 'all').trim().toLowerCase()
  const promoCode = accessMode === 'code' ? cleanCode(body.promo_code) : null
  const profileId = accessMode === 'profile' ? String(body.profile_id || '').trim() : null
  const startsAt = String(body.starts_at || '').trim() || sqlNow()
  const endsAt = body.ends_at ? String(body.ends_at).trim() : null

  if (!featureCode || !name) return c.json({ ok: false, error: 'Función y nombre son obligatorios.' }, 400)
  if (!['all', 'code', 'profile'].includes(accessMode)) return c.json({ ok: false, error: 'Modo de acceso no válido.' }, 400)
  if (accessMode === 'code' && !promoCode) return c.json({ ok: false, error: 'Indica el código promocional.' }, 400)
  if (accessMode === 'profile' && !profileId) return c.json({ ok: false, error: 'Selecciona el perfil.' }, 400)
  if (endsAt && endsAt <= startsAt) return c.json({ ok: false, error: 'La fecha final debe ser posterior a la fecha de inicio.' }, 400)

  if (profileId) {
    const profile = await c.env.DB.prepare(`SELECT id FROM profiles WHERE id = ? LIMIT 1`).bind(profileId).first()
    if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado.' }, 404)
  }

  const id = crypto.randomUUID()
  const adminUserId = String(c.get('adminUserId') || '') || null
  try {
    await c.env.DB.prepare(
      `INSERT INTO feature_promotions
        (id, feature_code, name, target_plan, access_mode, promo_code, profile_id,
         starts_at, ends_at, is_enabled, created_by_user_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'))`,
    ).bind(id, featureCode, name, targetPlan, accessMode, promoCode, profileId, startsAt, endsAt, adminUserId).run()
    await syncPromotionModule(c, id)
  } catch (error) {
    return c.json({ ok: false, error: promoCode ? 'Ese código promocional ya existe.' : 'No pudimos crear la promoción.' }, 409)
  }

  return c.json({ ok: true, data: { id } }, 201)
})

app.put('/api/v1/superadmin/feature-promotions/:id', requireSuperAdmin('super_admin'), async (c: any) => {
  const id = String(c.req.param('id') || '')
  const existing = await c.env.DB.prepare(`SELECT * FROM feature_promotions WHERE id = ? LIMIT 1`).bind(id).first()
  if (!existing) return c.json({ ok: false, error: 'Promoción no encontrada.' }, 404)

  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Solicitud inválida.' }, 400) }

  const name = body.name !== undefined ? String(body.name || '').trim().slice(0, 120) : String((existing as any).name)
  const startsAt = body.starts_at !== undefined ? String(body.starts_at || '').trim() : String((existing as any).starts_at)
  const endsAt = body.ends_at !== undefined ? (body.ends_at ? String(body.ends_at).trim() : null) : ((existing as any).ends_at || null)
  const enabled = body.is_enabled !== undefined ? (body.is_enabled ? 1 : 0) : Number((existing as any).is_enabled || 0)

  if (!name || !startsAt) return c.json({ ok: false, error: 'Nombre e inicio son obligatorios.' }, 400)
  if (endsAt && endsAt <= startsAt) return c.json({ ok: false, error: 'La fecha final debe ser posterior a la fecha de inicio.' }, 400)

  await c.env.DB.prepare(
    `UPDATE feature_promotions
        SET name = ?, starts_at = ?, ends_at = ?, is_enabled = ?, updated_at = datetime('now')
      WHERE id = ?`,
  ).bind(name, startsAt, endsAt, enabled, id).run()

  await syncPromotionModule(c, id)
  return c.json({ ok: true })
})

export default app
