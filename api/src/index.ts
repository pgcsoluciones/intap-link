import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { jwt } from 'hono/jwt'
import { getEntitlements } from './engine/entitlements'

type Bindings = {
  DB: D1Database
  BUCKET: R2Bucket
  JWT_SECRET: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', cors())

// --- Auth & Middlewares ---

const requireAdmin = async (c: any, next: any) => {
  const adminEmail = 'juanluis@intaprd.com'
  const userEmail = c.req.header('X-User-Email')
  if (userEmail !== adminEmail) return c.json({ ok: false, error: 'Forbidden' }, 403)
  await next()
}

// --- Rutas de API ---

app.get('/api/health', (c) => c.json({ ok: true, status: 'healthy' }))

// --- Autenticación MAGIC LINK ---

app.post('/api/v1/auth/magic-link', async (c) => {
  const { email } = await c.req.json()
  const code = Math.floor(100000 + Math.random() * 900000).toString()
  console.log(`[AUTH] Código enviado a ${email}: ${code}`)
  return c.json({ ok: true, message: 'Código enviado (revisa la consola)' })
})

app.post('/api/v1/auth/verify', async (c) => {
  const { email, code } = await c.req.json()
  if (code !== '123456') return c.json({ ok: false, error: 'Código inválido' }, 401)
  const payload = { email, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 }
  return c.json({ ok: true, token: 'mock-jwt-token', user: { email } })
})

// --- Analíticas ---

app.post('/api/v1/public/track', async (c) => {
  try {
    const { profileId, eventType, targetId } = await c.req.json()
    const id = crypto.randomUUID()
    await c.env.DB.prepare(`INSERT INTO analytics (id, profile_id, event_type, target_id) VALUES (?, ?, ?, ?)`).bind(id, profileId, eventType, targetId || null).run()
    return c.json({ ok: true })
  } catch (e) { return c.json({ ok: false }, 202) }
})

app.get('/api/v1/profile/stats/:profileId', async (c) => {
  const profileId = c.req.param('profileId')
  const totalViews = await c.env.DB.prepare(`SELECT COUNT(*) as count FROM analytics WHERE profile_id = ? AND event_type = 'view'`).bind(profileId).first()
  const dailyViews = await c.env.DB.prepare(`SELECT date(created_at) as day, COUNT(*) as count FROM analytics WHERE profile_id = ? AND event_type = 'view' AND created_at > date('now', '-7 days') GROUP BY day ORDER BY day ASC`).bind(profileId).all()
  const topLinks = await c.env.DB.prepare(`SELECT l.label, COUNT(a.id) as clics FROM analytics a JOIN profile_links l ON a.target_id = l.id WHERE a.profile_id = ? AND a.event_type = 'click' GROUP BY l.id ORDER BY clics DESC LIMIT 5`).bind(profileId).all()
  return c.json({ ok: true, stats: { totalViews: totalViews?.count || 0, dailyViews: dailyViews.results, topLinks: topLinks.results } })
})

// --- Galería (R2) ---

app.post('/api/v1/profile/gallery/upload', async (c) => {
  const { profileId } = await c.req.parseBody()
  const file = (await c.req.formData()).get('file') as File
  if (!file) return c.json({ ok: false, error: 'No file' }, 400)
  const key = `profiles/${profileId}/${crypto.randomUUID()}-${file.name}`
  await c.env.BUCKET.put(key, file.stream())
  const id = crypto.randomUUID()
  await c.env.DB.prepare(`INSERT INTO profile_gallery (id, profile_id, image_key, sort_order) VALUES (?, ?, ?, 0)`).bind(id, profileId, key).run()
  return c.json({ ok: true, id, key })
})

app.get('/api/v1/profile/gallery/:profileId', async (c) => {
  const profileId = c.req.param('profileId')
  const photos = await c.env.DB.prepare(`SELECT * FROM profile_gallery WHERE profile_id = ? ORDER BY sort_order ASC`).bind(profileId).all()
  return c.json({ ok: true, photos: photos.results })
})

// --- Perfil Público (v1.2) ---

app.get('/api/v1/public/profiles/:slug', async (c) => {
  const slug = c.req.param('slug')

  const profile = await c.env.DB.prepare(
    'SELECT id, slug, theme_id, is_published, name, bio FROM profiles WHERE slug = ?'
  ).bind(slug).first()

  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)
  if (!profile.is_published) return c.json({ ok: false, error: 'Perfil privado' }, 403)

  // Links con type (v1.2)
  const links = await c.env.DB.prepare(
    'SELECT id, label, url, type FROM profile_links WHERE profile_id = ? ORDER BY sort_order ASC'
  ).bind(profile.id).all()

  // Avatar desde profile_assets (v1.2)
  let avatar: string | null = null
  try {
    const avatarRow = await c.env.DB.prepare(
      'SELECT asset_key FROM profile_assets WHERE profile_id = ? AND asset_type = ? LIMIT 1'
    ).bind(profile.id, 'avatar').first()
    avatar = avatarRow ? (avatarRow.asset_key as string) : null
  } catch {
    avatar = null
  }

  // Galería Pro
  const gallery = await c.env.DB.prepare(
    'SELECT image_key FROM profile_gallery WHERE profile_id = ? ORDER BY sort_order ASC'
  ).bind(profile.id).all()

  // FAQs
  let faqs: any[] = []
  try {
    const faqRows = await c.env.DB.prepare(
      'SELECT question, answer FROM profile_faqs WHERE profile_id = ? ORDER BY rowid ASC'
    ).bind(profile.id).all()
    faqs = faqRows.results
  } catch {
    faqs = []
  }

  // Entitlements con allowedTemplates (v1.2)
  const entitlements = await getEntitlements(c, profile.id as string)

  return c.json({
    ok: true,
    data: {
      profileId: profile.id,
      slug: profile.slug,
      themeId: profile.theme_id,
      name: profile.name ?? null,
      bio: profile.bio ?? null,
      avatar,
      links: links.results,
      gallery: gallery.results,
      faqs,
      entitlements
    }
  })
})

// --- Admin ---

app.get('/api/v1/admin/profiles', requireAdmin, async (c) => {
  const profiles = await c.env.DB.prepare(`SELECT p.id, p.slug, p.plan_id, p.is_published, u.email FROM profiles p JOIN users u ON p.user_id = u.id`).all()
  return c.json({ ok: true, data: profiles.results })
})

app.post('/api/v1/admin/activate-module', async (c) => {
  const { profileId, moduleCode, secret } = await c.req.json()
  if (secret !== 'intap_master_key') return c.json({ ok: false, error: 'Unauthorized' }, 401)
  await c.env.DB.prepare(`INSERT INTO profile_modules (profile_id, module_code, expires_at) VALUES (?, ?, datetime('now', '+1 year')) ON CONFLICT(profile_id, module_code) DO UPDATE SET expires_at = excluded.expires_at`).bind(profileId, moduleCode).run()
  return c.json({ ok: true, message: `Módulo ${moduleCode} activado` })
})

export default app
