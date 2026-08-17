import app from './preview-entry'
import { cookieNames } from './lib/cookies'
import { resolveFreeStarterContent } from '../../shared/free-profile-starter-content'
import { FREE_PROFILE_STARTER_ASSETS } from '../../shared/free-profile-starter-assets'

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
}

function parseCookie(header: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = header.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

async function requirePreviewAuth(c: any, next: any) {
  const rawSession = parseCookie(
    c.req.header('Cookie') || '',
    cookieNames(c.env).session,
  )

  if (!rawSession) return c.json({ ok: false, error: 'Unauthorized' }, 401)

  const sessionHash = await sha256Hex(rawSession)
  const session = await c.env.DB.prepare(
    `SELECT user_id
       FROM auth_sessions
      WHERE session_hash = ?
        AND expires_at > datetime('now')
        AND revoked_at IS NULL
      LIMIT 1`,
  ).bind(sessionHash).first()

  if (!session) return c.json({ ok: false, error: 'Unauthorized' }, 401)

  c.set('userId', (session as any).user_id)
  await next()
}

function starterAssetUrl(c: any, path: string): string {
  const base = String(c.env.WEB_PAGES_ORIGIN || c.env.WEB_URL || '').replace(/\/$/, '')
  if (!base) throw new Error('Preview web origin is not configured')
  return `${base}${path}`
}

function variantAssets(category: string, variant: 1 | 2): string[] {
  const starter = resolveFreeStarterContent(category)
  const source = [
    ...((FREE_PROFILE_STARTER_ASSETS as Record<string, readonly string[]>)[starter.category] || []),
  ]
  if (variant === 2 && source.length > 3) {
    return [...source.slice(3), ...source.slice(0, 3)]
  }
  return source
}

app.post('/api/v1/me/free/starter/apply', requirePreviewAuth, async (c: any) => {
  const userId = c.get('userId') as string
  let body: any = {}
  try { body = await c.req.json() } catch {
    return c.json({ ok: false, error: 'Invalid JSON' }, 400)
  }

  const category = String(body.category || '').trim()
  const subcategory = String(body.subcategory || '').trim()
  const variant: 1 | 2 = Number(body.variant) === 2 ? 2 : 1

  if (!category || !subcategory) {
    return c.json({ ok: false, error: 'Actividad comercial y subcategoría son requeridas.' }, 400)
  }

  const row = await c.env.DB.prepare(
    `SELECT id, slug, template_data
       FROM profiles
      WHERE user_id = ?
      LIMIT 1`,
  ).bind(userId).first()

  if (!row) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  const profileId = String((row as any).id)
  const starter = resolveFreeStarterContent(category)
  const assets = variantAssets(category, variant)

  if (assets.length < 6) {
    return c.json({ ok: false, error: 'El banco gráfico de esta actividad está incompleto.' }, 409)
  }

  const urls = assets.map((path) => starterAssetUrl(c, path))
  const heroUrl = urls[0]
  const portraitUrl = urls[1] || heroUrl
  const portfolioUrls = urls.slice(2, 5)
  const serviceUrls = [urls[3] || urls[0], urls[4] || urls[1], urls[5] || urls[2]]
  const layoutId = variant === 2 ? 'personal' : 'impacto'

  let previousTemplate: Record<string, any> = {}
  try {
    const parsed = JSON.parse(String((row as any).template_data || '{}'))
    if (parsed && typeof parsed === 'object') previousTemplate = parsed
  } catch { previousTemplate = {} }

  const quickIds = {
    call: `starter:${profileId}:quick:call`,
    instagram: `starter:${profileId}:quick:instagram`,
    location: `starter:${profileId}:quick:location`,
  }
  const galleryIds = [0, 1, 2].map((index) => `starter:${profileId}:gallery:${index + 1}`)
  const serviceIds = [0, 1, 2].map((index) => `starter:${profileId}:service:${index + 1}`)

  const nextTemplate = {
    ...previousTemplate,
    role: subcategory || starter.role,
    services_section_title: starter.servicesTitle,
    services_section_description: starter.servicesDescription,
    free_starter_generated: true,
    free_starter_materialized: true,
    free_starter_unconfirmed: true,
    free_identity_confirmed: false,
    free_starter_category: starter.category,
    free_starter_subcategory: subcategory,
    free_starter_variant: variant,
    free_starter_selected_variant: variant,
    free_starter_materialized_at: new Date().toISOString(),
    free_starter_resource_ids: {
      quick_actions: Object.values(quickIds),
      portfolio: galleryIds,
      services: serviceIds,
    },
  }

  const locationUrl = 'https://www.google.com/maps/search/?api=1&query=Santo+Domingo%2C+Rep%C3%BAblica+Dominicana'

  const statements = [
    c.env.DB.prepare(
      `UPDATE profiles
          SET name = ?,
              bio = ?,
              category = ?,
              subcategory = ?,
              layout_id = ?,
              free_palette_id = ?,
              avatar_url = ?,
              hero_url = ?,
              hero_position_x = 50,
              hero_position_y = 50,
              hero_zoom = 1,
              template_data = ?,
              is_published = 0,
              updated_at = datetime('now')
        WHERE id = ? AND user_id = ?`,
    ).bind(
      'Tu nombre o negocio',
      starter.bio,
      starter.category,
      subcategory,
      layoutId,
      starter.recommendedPalette,
      portraitUrl,
      heroUrl,
      JSON.stringify(nextTemplate),
      profileId,
      userId,
    ),

    c.env.DB.prepare(
      `INSERT INTO profile_contact (profile_id, whatsapp, email, phone, hours, address, map_url)
       VALUES (?, NULL, NULL, ?, NULL, ?, ?)
       ON CONFLICT(profile_id) DO UPDATE SET
         whatsapp = NULL,
         email = NULL,
         phone = excluded.phone,
         hours = NULL,
         address = excluded.address,
         map_url = excluded.map_url`,
    ).bind(profileId, '8090000000', 'Santo Domingo, República Dominicana', locationUrl),

    c.env.DB.prepare(
      `DELETE FROM profile_social_links
        WHERE profile_id = ? AND id LIKE 'starter:%'`,
    ).bind(profileId),
    c.env.DB.prepare(
      `INSERT INTO profile_social_links (id, profile_id, type, url, sort_order, enabled)
       VALUES (?, ?, 'call', 'tel:+18090000000', 0, 1)`,
    ).bind(quickIds.call, profileId),
    c.env.DB.prepare(
      `INSERT INTO profile_social_links (id, profile_id, type, url, sort_order, enabled)
       VALUES (?, ?, 'instagram', 'https://www.instagram.com/intaprd', 1, 1)`,
    ).bind(quickIds.instagram, profileId),
    c.env.DB.prepare(
      `INSERT INTO profile_social_links (id, profile_id, type, url, sort_order, enabled)
       VALUES (?, ?, 'location', ?, 2, 1)`,
    ).bind(quickIds.location, profileId, locationUrl),

    c.env.DB.prepare(
      `DELETE FROM profile_gallery
        WHERE profile_id = ? AND id LIKE 'starter:%'`,
    ).bind(profileId),
    ...galleryIds.map((id, index) => c.env.DB.prepare(
      `INSERT INTO profile_gallery
        (id, profile_id, image_key, alt_text, title, description, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      id,
      profileId,
      portfolioUrls[index],
      `Imagen base ${index + 1} para ${subcategory}`,
      `Trabajo ${index + 1}`,
      'Imagen de ejemplo. Sustitúyela por una foto real de tu trabajo antes de publicar.',
      index,
    )),

    c.env.DB.prepare(
      `DELETE FROM profile_products
        WHERE profile_id = ? AND id LIKE 'starter:%'`,
    ).bind(profileId),
    ...serviceIds.map((id, index) => {
      const service = starter.services[index]
      return c.env.DB.prepare(
        `INSERT INTO profile_products
          (id, profile_id, title, description, price, image_url, whatsapp_text, is_featured, sort_order)
         VALUES (?, ?, ?, ?, NULL, ?, NULL, 0, ?)`,
      ).bind(
        id,
        profileId,
        service.title,
        service.description,
        serviceUrls[index],
        index,
      )
    }),
  ]

  await c.env.DB.batch(statements)

  const [galleryCount, serviceCount, quickCount] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM profile_gallery WHERE profile_id = ? AND id LIKE 'starter:%'`).bind(profileId).first(),
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM profile_products WHERE profile_id = ? AND id LIKE 'starter:%'`).bind(profileId).first(),
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM profile_social_links WHERE profile_id = ? AND id LIKE 'starter:%'`).bind(profileId).first(),
  ])

  return c.json({
    ok: true,
    data: {
      profile_id: profileId,
      slug: String((row as any).slug || ''),
      category: starter.category,
      subcategory,
      variant,
      layout_id: layoutId,
      starter_unconfirmed: true,
      resources: {
        quick_actions: Number((quickCount as any)?.n || 0),
        portfolio: Number((galleryCount as any)?.n || 0),
        services: Number((serviceCount as any)?.n || 0),
      },
    },
  })
})

export default app
