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
  // Simulación: Generamos un código de 6 dígitos
  const code = Math.floor(100000 + Math.random() * 900000).toString()

  // Guardamos en D1 para verificación temporal (Opcional, aquí simulamos que el código es '123456' para el test)
  console.log(`[AUTH] Código enviado a ${email}: ${code}`)

  return c.json({ ok: true, message: 'Código enviado (revisa la consola)' })
})

app.post('/api/v1/auth/verify', async (c) => {
  const { email, code } = await c.req.json()

  // Simulación de verificación
  if (code !== '123456') return c.json({ ok: false, error: 'Código inválido' }, 401)

  // En producción buscaríamos al usuario en D1
  const payload = { email, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 } // 24h
  // const token = await jwt.sign(payload, c.env.JWT_SECRET) // Comentado hasta tener el secret en wrangler.toml

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

// --- Galería & Avatar (R2) ---

app.post('/api/v1/profile/avatar/upload', async (c) => {
  try {
    const { profileId } = await c.req.parseBody()
    const file = (await c.req.formData()).get('file') as unknown as File
    if (!file) return c.json({ ok: false, error: 'No file' }, 400)

    const key = `profiles/${profileId}/avatar-${crypto.randomUUID()}-${file.name}`
    await c.env.BUCKET.put(key, file.stream())

    const avatarUrl = `https://pub-2e9e6b5e0c6e4e8e8e8e8e8e8e8e8e8e.r2.dev/${key}`
    await c.env.DB.prepare(`UPDATE profiles SET avatar_url = ? WHERE id = ?`).bind(avatarUrl, profileId).run()

    return c.json({ ok: true, url: avatarUrl })
  } catch (e) {
    return c.json({ ok: false, error: 'Upload failed' }, 500)
  }
})

app.post('/api/v1/profile/gallery/upload', async (c) => {
  const { profileId } = await c.req.parseBody()
  const file = (await c.req.formData()).get('file') as unknown as File

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

// Perfil Público
app.get('/api/v1/public/profiles/:slug', async (c) => {
  const slug = c.req.param('slug')
  const profile = await c.env.DB.prepare('SELECT id, slug, theme_id, is_published, name, bio, avatar_url FROM profiles WHERE slug = ?').bind(slug).first()
  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)
  if (!profile.is_published) return c.json({ ok: false, error: 'Perfil privado' }, 403)

  const links = await c.env.DB.prepare('SELECT id, label, url FROM profile_links WHERE profile_id = ? ORDER BY sort_order ASC').bind(profile.id).all()
  const gallery = await c.env.DB.prepare('SELECT image_key FROM profile_gallery WHERE profile_id = ? ORDER BY sort_order ASC').bind(profile.id).all()
  const entitlements = await getEntitlements(c, profile.id as string)

  return c.json({
    ok: true,
    data: {
      profileId: profile.id,
      slug: profile.slug,
      themeId: profile.theme_id,
      name: profile.name,
      bio: profile.bio,
      avatarUrl: profile.avatar_url,
      links: links.results,
      gallery: gallery.results,
      entitlements
    }
  })
})

// --- Gestión de Perfil (Resolución por Contexto) ---

app.get('/api/v1/me', async (c) => {
  const userEmail = c.req.header('X-User-Email') || 'juanluis@intaprd.com' // Mock hasta Auth completo

  const user = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(userEmail).first()
  if (!user) return c.json({ ok: false, error: 'Usuario no encontrado' }, 404)

  const profile = await c.env.DB.prepare('SELECT id, slug, theme_id, is_published, name, bio, avatar_url, plan_id FROM profiles WHERE user_id = ?').bind(user.id).first()
  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  const entitlements = await getEntitlements(c, profile.id as string)

  // Calcular estado dinámico
  const status = profile.plan_id === 'free' ? 'trial' : 'active' // Lógica simplificada para el test
  const daysLeft = 14 // Mock para el test de UI

  return c.json({
    ok: true,
    data: {
      name: profile.name,
      slug: profile.slug,
      avatarUrl: profile.avatar_url,
      themeId: profile.theme_id,
      plan: profile.plan_id,
      status: status,
      daysLeft: daysLeft,
      entitlements
    }
  })
})

// Admin
// --- Gestión de Perfil (Edición) ---

app.get('/api/v1/profile/me/:profileId', async (c) => {
  const profileId = c.req.param('profileId')
  const profile = await c.env.DB.prepare('SELECT id, slug, theme_id, is_published, name, bio, avatar_url FROM profiles WHERE id = ?').bind(profileId).first()
  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  const links = await c.env.DB.prepare('SELECT * FROM profile_links WHERE profile_id = ? ORDER BY sort_order ASC').bind(profileId).all()
  const faqs = await c.env.DB.prepare('SELECT * FROM profile_faqs WHERE profile_id = ?').bind(profileId).all()
  const gallery = await c.env.DB.prepare('SELECT * FROM profile_gallery WHERE profile_id = ? ORDER BY sort_order ASC').bind(profileId).all()
  const entitlements = await getEntitlements(c, profileId)

  return c.json({
    ok: true,
    data: {
      ...profile,
      links: links.results,
      faqs: faqs.results,
      gallery: gallery.results,
      entitlements
    }
  })
})

app.patch('/api/v1/profile/settings', async (c) => {
  const { profileId, name, bio, themeId, isPublished, avatarUrl } = await c.req.json()
  await c.env.DB.prepare('UPDATE profiles SET name = ?, bio = ?, theme_id = ?, is_published = ?, avatar_url = ? WHERE id = ?')
    .bind(name, bio, themeId, isPublished ? 1 : 0, avatarUrl || null, profileId)
    .run()
  return c.json({ ok: true })
})

app.post('/api/v1/profile/links', async (c) => {
  const { profileId, label, url } = await c.req.json()
  const id = crypto.randomUUID()
  await c.env.DB.prepare('INSERT INTO profile_links (id, profile_id, label, url, sort_order) VALUES (?, ?, ?, ?, 0)')
    .bind(id, profileId, label, url)
    .run()
  return c.json({ ok: true, id })
})

app.delete('/api/v1/profile/links/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM profile_links WHERE id = ?').bind(id).run()
  return c.json({ ok: true })
})

app.post('/api/v1/profile/faqs', async (c) => {
  const { profileId, question, answer } = await c.req.json()
  const id = crypto.randomUUID()
  await c.env.DB.prepare('INSERT INTO profile_faqs (id, profile_id, question, answer) VALUES (?, ?, ?, ?)')
    .bind(id, profileId, question, answer)
    .run()
  return c.json({ ok: true, id })
})

// --- Gestión de Leads (Admin) ---

app.get('/api/v1/profile/me/:profileId/leads', async (c) => {
  const profileId = c.req.param('profileId')

  // Gating: Verificar si tiene acceso a Leads Avanzados (opcional, por ahora lo leeremos)
  // const entitlements = await getEntitlements(c, profileId)

  const query = `
    SELECT id, name, email, phone, message, source_url, created_at, status, origin, tags 
    FROM leads 
    WHERE profile_id = ? 
    ORDER BY created_at DESC
  `
  const leads = await c.env.DB.prepare(query).bind(profileId).all()

  // Transformar el string de tags a array JS
  const formattedLeads = leads.results.map((l: any) => ({
    ...l,
    tags: JSON.parse(l.tags || '[]')
  }))

  return c.json({ ok: true, data: formattedLeads })
})

app.patch('/api/v1/profile/me/:profileId/leads/:leadId', async (c) => {
  const profileId = c.req.param('profileId')
  const leadId = c.req.param('leadId')
  const { status, tags } = await c.req.json()

  // tags debe asegurarse de ser stringificado si viene como array
  const tagsString = Array.isArray(tags) ? JSON.stringify(tags) : tags

  await c.env.DB.prepare('UPDATE leads SET status = coalesce(?, status), tags = coalesce(?, tags) WHERE id = ? AND profile_id = ?')
    .bind(status ?? null, tagsString ?? null, leadId, profileId)
    .run()

  return c.json({ ok: true })
})

app.get('/api/v1/profile/me/:profileId/leads/export', async (c) => {
  const profileId = c.req.param('profileId')

  const leads = await c.env.DB.prepare('SELECT name, email, phone, message, created_at, status, origin, tags FROM leads WHERE profile_id = ? ORDER BY created_at DESC').bind(profileId).all()

  if (!leads.results || leads.results.length === 0) {
    return c.text('No hay leads para exportar', 404)
  }

  // Generación básica de CSV
  const header = ['Nombre', 'Email', 'Teléfono', 'Mensaje', 'Fecha', 'Estado', 'Origen', 'Etiquetas'].join(',')
  const rows = leads.results.map((l: any) => {
    // Escapar comillas dobles y comas en los campos de texto
    const escapeCsv = (str: string) => `"${(str || '').toString().replace(/"/g, '""')}"`

    return [
      escapeCsv(l.name),
      escapeCsv(l.email),
      escapeCsv(l.phone),
      escapeCsv(l.message),
      escapeCsv(l.created_at),
      escapeCsv(l.status),
      escapeCsv(l.origin),
      escapeCsv(l.tags)
    ].join(',')
  })

  const csvContent = [header, ...rows].join('\n')

  return c.text(csvContent, 200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="leads_${profileId}_${new Date().toISOString().split('T')[0]}.csv"`
  })
})

// Debug compatibilidad Dashboard
app.get('/api/debug/entitlements/:profileId', async (c) => {
  const profileId = c.req.param('profileId')
  const profile = await c.env.DB.prepare('SELECT p.id, p.plan_id FROM profiles p WHERE p.id = ?').bind(profileId).first()
  if (!profile) return c.json({ ok: false, error: 'Not found' }, 404)
  const entitlements = await getEntitlements(c, profileId)
  return c.json({
    ok: true,
    profileId,
    basePlan: profile.plan_id,
    finalEntitlements: entitlements
  })
})

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
