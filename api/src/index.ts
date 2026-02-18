import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { sign, verify } from 'hono/jwt'
import { getEntitlements } from './engine/entitlements'

type Bindings = {
  DB: D1Database
  BUCKET: R2Bucket
  JWT_SECRET: string
  ALLOWED_ORIGINS: string
  R2_PUBLIC_URL: string
}

type JwtPayload = {
  sub: string
  email: string
  isAdmin: boolean
  exp: number
}

type Variables = {
  jwtPayload: JwtPayload
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// --- CORS restringido a orígenes permitidos ---
app.use('*', async (c, next) => {
  const allowedOrigins = (c.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',').map(o => o.trim())
  const corsMiddleware = cors({
    origin: (origin) => (allowedOrigins.includes(origin) ? origin : allowedOrigins[0]),
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  })
  return corsMiddleware(c, next)
})

// --- Middlewares de Autenticación ---

const requireAuth = async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ ok: false, error: 'No autorizado' }, 401)
  }
  const token = authHeader.slice(7)
  try {
    const payload = await verify(token, c.env.JWT_SECRET) as JwtPayload
    c.set('jwtPayload', payload)
    await next()
  } catch {
    return c.json({ ok: false, error: 'Token inválido o expirado' }, 401)
  }
}

const requireAdmin = async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ ok: false, error: 'No autorizado' }, 401)
  }
  const token = authHeader.slice(7)
  try {
    const payload = await verify(token, c.env.JWT_SECRET) as JwtPayload
    if (!payload.isAdmin) return c.json({ ok: false, error: 'Acceso denegado: se requiere rol de administrador' }, 403)
    c.set('jwtPayload', payload)
    await next()
  } catch {
    return c.json({ ok: false, error: 'Token inválido o expirado' }, 401)
  }
}

// --- Rutas de API ---

app.get('/api/health', (c) => c.json({ ok: true, status: 'healthy' }))

// --- Autenticación MAGIC LINK ---

app.post('/api/v1/auth/magic-link', async (c) => {
  let body: { email?: unknown }
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Body JSON inválido' }, 400) }

  const email = typeof body.email === 'string' ? body.email.toLowerCase().trim() : null
  if (!email || !email.includes('@') || email.length > 254) {
    return c.json({ ok: false, error: 'Email inválido' }, 400)
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

  await c.env.DB.prepare(
    `INSERT INTO auth_codes (email, code, expires_at) VALUES (?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET code = excluded.code, expires_at = excluded.expires_at`
  ).bind(email, code, expiresAt).run()

  // TODO producción: reemplazar console.log con envío real de email (SendGrid, Resend, etc.)
  console.log(`[AUTH] Código para ${email}: ${code}`)

  return c.json({ ok: true, message: 'Código enviado al correo' })
})

app.post('/api/v1/auth/verify', async (c) => {
  let body: { email?: unknown; code?: unknown }
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Body JSON inválido' }, 400) }

  const email = typeof body.email === 'string' ? body.email.toLowerCase().trim() : null
  const code = typeof body.code === 'string' ? body.code.trim() : null

  if (!email || !code) return c.json({ ok: false, error: 'Email y código son requeridos' }, 400)

  const stored = await c.env.DB.prepare(
    `SELECT code, expires_at FROM auth_codes WHERE email = ?`
  ).bind(email).first<{ code: string; expires_at: string }>()

  if (!stored) return c.json({ ok: false, error: 'Código no encontrado o ya utilizado' }, 401)
  if (new Date(stored.expires_at) < new Date()) {
    await c.env.DB.prepare(`DELETE FROM auth_codes WHERE email = ?`).bind(email).run()
    return c.json({ ok: false, error: 'Código expirado, solicita uno nuevo' }, 401)
  }
  if (stored.code !== code) return c.json({ ok: false, error: 'Código inválido' }, 401)

  // Eliminar código ya usado (one-time use)
  await c.env.DB.prepare(`DELETE FROM auth_codes WHERE email = ?`).bind(email).run()

  // Crear o recuperar usuario
  let user = await c.env.DB.prepare(
    `SELECT id, email, is_admin FROM users WHERE email = ?`
  ).bind(email).first<{ id: string; email: string; is_admin: number }>()

  if (!user) {
    const userId = crypto.randomUUID()
    await c.env.DB.prepare(
      `INSERT INTO users (id, email, is_admin) VALUES (?, ?, 0)`
    ).bind(userId, email).run()
    user = { id: userId, email, is_admin: 0 }
  }

  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    isAdmin: user.is_admin === 1,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 días
  }
  const token = await sign(payload, c.env.JWT_SECRET)

  return c.json({ ok: true, token, user: { id: user.id, email: user.email } })
})

// --- Perfil del usuario autenticado ---

app.get('/api/v1/me/profile', requireAuth, async (c) => {
  const { sub: userId } = c.get('jwtPayload')
  const profile = await c.env.DB.prepare(
    `SELECT id, slug, plan_id, theme_id, is_published, name, bio FROM profiles WHERE user_id = ?`
  ).bind(userId).first()
  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)
  return c.json({ ok: true, profile })
})

// --- Analíticas ---

app.post('/api/v1/public/track', async (c) => {
  let body: { profileId?: unknown; eventType?: unknown; targetId?: unknown }
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Body JSON inválido' }, 400) }

  const { profileId, eventType, targetId } = body
  if (!profileId || typeof profileId !== 'string') return c.json({ ok: false, error: 'profileId requerido' }, 400)
  if (!eventType || typeof eventType !== 'string') return c.json({ ok: false, error: 'eventType requerido' }, 400)

  try {
    const id = crypto.randomUUID()
    await c.env.DB.prepare(
      `INSERT INTO analytics (id, profile_id, event_type, target_id) VALUES (?, ?, ?, ?)`
    ).bind(id, profileId, eventType, typeof targetId === 'string' ? targetId : null).run()
    return c.json({ ok: true })
  } catch (e) {
    console.error('Track error:', e)
    return c.json({ ok: false, error: 'Error interno al registrar evento' }, 500)
  }
})

app.get('/api/v1/profile/stats/:profileId', async (c) => {
  const profileId = c.req.param('profileId')
  const totalViews = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM analytics WHERE profile_id = ? AND event_type = 'view'`
  ).bind(profileId).first()
  const dailyViews = await c.env.DB.prepare(
    `SELECT date(created_at) as day, COUNT(*) as count FROM analytics WHERE profile_id = ? AND event_type = 'view' AND created_at > date('now', '-7 days') GROUP BY day ORDER BY day ASC`
  ).bind(profileId).all()
  const topLinks = await c.env.DB.prepare(
    `SELECT l.label, COUNT(a.id) as clics FROM analytics a JOIN profile_links l ON a.target_id = l.id WHERE a.profile_id = ? AND a.event_type = 'click' GROUP BY l.id ORDER BY clics DESC LIMIT 5`
  ).bind(profileId).all()
  return c.json({ ok: true, stats: { totalViews: totalViews?.count || 0, dailyViews: dailyViews.results, topLinks: topLinks.results } })
})

// --- Galería (R2) ---

app.post('/api/v1/profile/gallery/upload', requireAuth, async (c) => {
  let formData: FormData
  try { formData = await c.req.formData() } catch { return c.json({ ok: false, error: 'FormData inválido' }, 400) }

  const profileId = formData.get('profileId')
  const file = formData.get('file') as File | null

  if (!file || !(file instanceof File)) return c.json({ ok: false, error: 'Archivo no encontrado' }, 400)
  if (!profileId || typeof profileId !== 'string') return c.json({ ok: false, error: 'profileId requerido' }, 400)

  try {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const key = `profiles/${profileId}/${crypto.randomUUID()}-${safeName}`
    await c.env.BUCKET.put(key, file.stream())

    const id = crypto.randomUUID()
    await c.env.DB.prepare(
      `INSERT INTO profile_gallery (id, profile_id, image_key, sort_order) VALUES (?, ?, ?, 0)`
    ).bind(id, profileId, key).run()

    return c.json({ ok: true, id, key, url: `${c.env.R2_PUBLIC_URL}/${key}` })
  } catch (e) {
    console.error('Gallery upload error:', e)
    return c.json({ ok: false, error: 'Error al subir el archivo' }, 500)
  }
})

app.get('/api/v1/profile/gallery/:profileId', async (c) => {
  const profileId = c.req.param('profileId')
  const photos = await c.env.DB.prepare(
    `SELECT id, image_key, sort_order FROM profile_gallery WHERE profile_id = ? ORDER BY sort_order ASC`
  ).bind(profileId).all<{ id: string; image_key: string; sort_order: number }>()
  const r2Base = c.env.R2_PUBLIC_URL
  const results = photos.results.map(p => ({ ...p, image_url: `${r2Base}/${p.image_key}` }))
  return c.json({ ok: true, photos: results })
})

// --- Perfil Público ---

app.get('/api/v1/public/profiles/:slug', async (c) => {
  const slug = c.req.param('slug')
  if (!slug || slug.length > 64 || !/^[a-zA-Z0-9_-]+$/.test(slug)) {
    return c.json({ ok: false, error: 'Slug inválido' }, 400)
  }

  const profile = await c.env.DB.prepare(
    'SELECT id, slug, theme_id, is_published, name, bio FROM profiles WHERE slug = ?'
  ).bind(slug).first()
  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)
  if (!profile.is_published) return c.json({ ok: false, error: 'Perfil privado' }, 403)

  const links = await c.env.DB.prepare(
    'SELECT id, label, url FROM profile_links WHERE profile_id = ? ORDER BY sort_order ASC'
  ).bind(profile.id).all()
  const gallery = await c.env.DB.prepare(
    'SELECT image_key FROM profile_gallery WHERE profile_id = ? ORDER BY sort_order ASC'
  ).bind(profile.id).all<{ image_key: string }>()
  const entitlements = await getEntitlements(c, profile.id as string)

  const r2Base = c.env.R2_PUBLIC_URL

  return c.json({
    ok: true,
    data: {
      profileId: profile.id,
      slug: profile.slug,
      themeId: profile.theme_id,
      name: profile.name,
      bio: profile.bio,
      links: links.results,
      gallery: gallery.results.map(g => ({ image_key: g.image_key, image_url: `${r2Base}/${g.image_key}` })),
      entitlements,
    },
  })
})

// --- Admin ---

app.get('/api/v1/admin/profiles', requireAdmin, async (c) => {
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10))
  const limit = Math.min(Math.max(1, parseInt(c.req.query('limit') || '20', 10)), 100)
  const offset = (page - 1) * limit

  const total = await c.env.DB.prepare(`SELECT COUNT(*) as count FROM profiles`).first<{ count: number }>()
  const profiles = await c.env.DB.prepare(
    `SELECT p.id, p.slug, p.plan_id, p.is_published, u.email
     FROM profiles p JOIN users u ON p.user_id = u.id
     LIMIT ? OFFSET ?`
  ).bind(limit, offset).all()

  return c.json({
    ok: true,
    data: profiles.results,
    pagination: { page, limit, total: total?.count || 0, pages: Math.ceil((total?.count || 0) / limit) },
  })
})

app.post('/api/v1/admin/activate-module', requireAdmin, async (c) => {
  let body: { profileId?: unknown; moduleCode?: unknown }
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Body JSON inválido' }, 400) }

  const { profileId, moduleCode } = body
  if (!profileId || typeof profileId !== 'string') return c.json({ ok: false, error: 'profileId requerido' }, 400)
  if (!moduleCode || typeof moduleCode !== 'string') return c.json({ ok: false, error: 'moduleCode requerido' }, 400)

  await c.env.DB.prepare(
    `INSERT INTO profile_modules (profile_id, module_code, expires_at)
     VALUES (?, ?, datetime('now', '+1 year'))
     ON CONFLICT(profile_id, module_code) DO UPDATE SET expires_at = excluded.expires_at`
  ).bind(profileId, moduleCode).run()

  return c.json({ ok: true, message: `Módulo ${moduleCode} activado correctamente` })
})

export default app
