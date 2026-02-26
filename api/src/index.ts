import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { jwt } from 'hono/jwt'
import { getEntitlements } from './engine/entitlements'

type Bindings = {
  DB: D1Database
  BUCKET: R2Bucket
  JWT_SECRET: string
}

type Variables = { userId: string }

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

const PUBLIC_BASE_URL = 'https://intap-web2.pages.dev'

app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}))
app.options('*', (c) => c.body(null, 204))

// Global error handler — ensures every uncaught error returns JSON (with CORS headers already set)
app.onError((err, c) => {
  console.error('[onError]', err)
  return c.json({ ok: false, error: 'Internal server error' }, 500)
})

// --- Auth & Middlewares ---

const requireAdmin = async (c: any, next: any) => {
  const adminEmail = 'juanluis@intaprd.com'
  const userEmail = c.req.header('X-User-Email')
  if (userEmail !== adminEmail) return c.json({ ok: false, error: 'Forbidden' }, 403)
  await next()
}

const requireAuth = async (c: any, next: any) => {
  const auth = c.req.header('Authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token) return c.json({ ok: false, error: 'Unauthorized' }, 401)
  const hash = await sha256Base64Url(token)
  const session = await c.env.DB.prepare(
    `SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > datetime('now') LIMIT 1`
  ).bind(hash).first()
  if (!session) return c.json({ ok: false, error: 'Unauthorized' }, 401)
  c.set('userId', (session as any).user_id)
  await next()
}

// --- Rutas de API ---

app.get('/api/health', (c) => c.json({ ok: true, status: 'healthy' }))

// --- Autenticación OTP ---

app.post('/api/v1/auth/otp/request', async (c) => {
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Invalid JSON' }, 400) }
  const email = String(body.email || '').trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return c.json({ ok: false, error: 'valid email required' }, 400)

  const code = String(Math.floor(100000 + Math.random() * 900000))
  const codeHash = await sha256Base64Url(code)
  try {
    await c.env.DB.prepare(
      `INSERT INTO auth_otp (id, email, code_hash, expires_at) VALUES (?, ?, ?, datetime('now', '+10 minutes'))`
    ).bind(crypto.randomUUID(), email, codeHash).run()
  } catch (err) {
    console.error('[otp/request] DB insert failed:', err)
    return c.json({ ok: false, error: 'Error al guardar OTP (¿migración 0010 aplicada en D1?)' }, 500)
  }

  console.log(`[OTP] ${email} → ${code}`)
  // Always return dev_code until a real email provider is configured.
  // To disable: set ALLOW_DEV_OTP=false in the Worker env vars.
  const devMode = (c.env as any).ALLOW_DEV_OTP !== 'false'
  return c.json({ ok: true, message: 'Código enviado', ...(devMode ? { dev_code: code } : {}) })
})

app.post('/api/v1/auth/otp/verify', async (c) => {
  console.log('[verify] STEP 0 start')
  try {
    let body: any = {}
    try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Invalid JSON' }, 400) }

    const email = String(body.email || '').trim().toLowerCase()
    const code  = String(body.code  || '').trim()
    if (!email || !code) return c.json({ ok: false, error: 'email and code required' }, 400)

    console.log('[verify] STEP 1 hashing code')
    const codeHash = await sha256Base64Url(code)
    console.log('[verify] STEP 1 done')

    console.log('[verify] STEP 2 query auth_otp')
    const otpRow = await c.env.DB.prepare(
      `SELECT id, expires_at, used_at FROM auth_otp
       WHERE email = ? AND code_hash = ?
       ORDER BY created_at DESC LIMIT 1`
    ).bind(email, codeHash).first()
    console.log('[verify] STEP 2 done, found:', !!otpRow)

    if (!otpRow) {
      console.log('[verify] 401 — no row found for email+code_hash')
      return c.json({ ok: false, error: 'Código inválido' }, 401)
    }

    const r = otpRow as any
    if (r.used_at) {
      console.log('[verify] 401 — code already used_at:', r.used_at)
      return c.json({ ok: false, error: 'Código ya usado' }, 401)
    }
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19)
    if (r.expires_at < nowStr) {
      console.log('[verify] 401 — code expired. expires_at:', r.expires_at, 'now:', nowStr)
      return c.json({ ok: false, error: 'Código expirado' }, 401)
    }

    console.log('[verify] STEP 3 mark otp used')
    await c.env.DB.prepare(
      `UPDATE auth_otp SET used_at = datetime('now') WHERE id = ?`
    ).bind(r.id).run()
    console.log('[verify] STEP 3 done')

    console.log('[verify] STEP 4 upsert user')
    await c.env.DB.prepare(
      `INSERT INTO users (id, email) VALUES (?, ?) ON CONFLICT(email) DO NOTHING`
    ).bind(crypto.randomUUID(), email).run()
    console.log('[verify] STEP 4 done')

    console.log('[verify] STEP 5 select user')
    const user = await c.env.DB.prepare(
      `SELECT id, email FROM users WHERE email = ? LIMIT 1`
    ).bind(email).first() as { id: string; email: string } | null
    console.log('[verify] STEP 5 done, user:', !!user)
    if (!user) return c.json({ ok: false, error: 'Error al obtener usuario' }, 500)

    console.log('[verify] STEP 6 create session')
    const rawToken = crypto.randomUUID()
    const tokenHash = await sha256Base64Url(rawToken)
    await c.env.DB.prepare(
      `INSERT INTO sessions (id, user_id, token_hash, expires_at)
       VALUES (?, ?, ?, datetime('now', '+30 days'))`
    ).bind(crypto.randomUUID(), user.id, tokenHash).run()
    console.log('[verify] STEP 6 done')

    console.log('[verify] STEP final returning token')
    return c.json({ ok: true, token: rawToken, user: { id: user.id, email: user.email } })

  } catch (err) {
    console.error('[verify] UNCAUGHT ERROR', err)
    return c.json({ ok: false, error: 'Error interno en verify' }, 500)
  }
})

// --- /me endpoints — sub-app aislado, requireAuth se aplica una sola vez aquí ---
// De este modo /auth/* y /public/* NUNCA pueden ser afectados por el guard.

const me = new Hono<{ Bindings: Bindings; Variables: Variables }>()
me.use('*', requireAuth)

me.get('/', async (c) => {
  const userId = c.get('userId') as string
  const row = await c.env.DB.prepare(
    `SELECT u.id, u.email, p.id as profile_id, p.slug, p.name, p.bio,
            p.avatar_url, p.category, p.subcategory, p.is_published
     FROM users u
     LEFT JOIN profiles p ON p.user_id = u.id
     WHERE u.id = ? LIMIT 1`
  ).bind(userId).first()
  if (!row) return c.json({ ok: false, error: 'User not found' }, 404)

  const r = row as any
  let hasContact = false
  let hasLinks = false
  if (r.profile_id) {
    const [contactRow, linksRow] = await Promise.all([
      c.env.DB.prepare(`SELECT profile_id FROM profile_contact WHERE profile_id = ? LIMIT 1`).bind(r.profile_id).first(),
      c.env.DB.prepare(`SELECT COUNT(*) as n FROM profile_links WHERE profile_id = ?`).bind(r.profile_id).first(),
    ])
    hasContact = !!contactRow
    hasLinks = ((linksRow as any)?.n || 0) > 0
  }

  const onboardingStatus = {
    hasProfile:  !!r.profile_id,
    hasSlug:     !!r.slug,
    hasCategory: !!r.category,
    hasContact,
    hasLinks,
  }

  return c.json({ ok: true, data: { ...r, onboardingStatus } })
})

me.post('/profile/claim', async (c) => {
  const userId = c.get('userId') as string
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Invalid JSON' }, 400) }
  const slug = String(body.slug || '').trim().toLowerCase()
  const RESERVED_SLUGS = new Set(['admin', 'api', 'auth', 'me', 'assets', 'favicon', 'www'])
  if (!slug || !/^[a-z0-9_-]{2,32}$/.test(slug))
    return c.json({ ok: false, error: 'Slug inválido (2–32 chars, a-z 0-9 _ -)' }, 400)
  if (RESERVED_SLUGS.has(slug))
    return c.json({ ok: false, error: 'Slug reservado' }, 400)

  const existing = await c.env.DB.prepare(
    `SELECT id FROM profiles WHERE user_id = ? LIMIT 1`
  ).bind(userId).first()
  if (existing) return c.json({ ok: false, error: 'Ya tienes un perfil' }, 409)

  const taken = await c.env.DB.prepare(
    `SELECT id FROM profiles WHERE slug = ? LIMIT 1`
  ).bind(slug).first()
  if (taken) return c.json({ ok: false, error: 'Slug no disponible' }, 409)

  const profileId = crypto.randomUUID()
  await c.env.DB.prepare(
    `INSERT INTO profiles (id, user_id, slug, plan_id, theme_id, is_published)
     VALUES (?, ?, ?, 'free', 'default', 0)`
  ).bind(profileId, userId, slug).run()
  return c.json({ ok: true, profile_id: profileId, slug }, 201)
})

me.put('/profile', async (c) => {
  const userId = c.get('userId') as string
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Invalid JSON' }, 400) }

  const profile = await c.env.DB.prepare(
    `SELECT id FROM profiles WHERE user_id = ? LIMIT 1`
  ).bind(userId).first()
  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  const name        = body.name        !== undefined ? String(body.name        || '').trim() : undefined
  const bio         = body.bio         !== undefined ? String(body.bio         || '').trim() : undefined
  const avatar_url  = body.avatar_url  !== undefined ? String(body.avatar_url  || '').trim() : undefined
  const category    = body.category    !== undefined ? String(body.category    || '').trim() : undefined
  const subcategory = body.subcategory !== undefined ? String(body.subcategory || '').trim() : undefined

  await c.env.DB.prepare(
    `UPDATE profiles
     SET name        = COALESCE(?1, name),
         bio         = COALESCE(?2, bio),
         avatar_url  = COALESCE(?3, avatar_url),
         category    = COALESCE(?4, category),
         subcategory = COALESCE(?5, subcategory),
         updated_at  = datetime('now')
     WHERE id = ?6`
  ).bind(name ?? null, bio ?? null, avatar_url ?? null, category ?? null, subcategory ?? null, (profile as any).id).run()
  return c.json({ ok: true })
})

me.get('/contact', async (c) => {
  const userId = c.get('userId') as string
  const profile = await c.env.DB.prepare(
    `SELECT id FROM profiles WHERE user_id = ? LIMIT 1`
  ).bind(userId).first()
  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  const contact = await c.env.DB.prepare(
    `SELECT whatsapp, email, phone, hours, address, map_url FROM profile_contact WHERE profile_id = ? LIMIT 1`
  ).bind((profile as any).id).first()
  return c.json({ ok: true, data: contact || null })
})

me.put('/contact', async (c) => {
  const userId = c.get('userId') as string
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Invalid JSON' }, 400) }

  const profile = await c.env.DB.prepare(
    `SELECT id FROM profiles WHERE user_id = ? LIMIT 1`
  ).bind(userId).first()
  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  // Accept whatsapp_number (preferred) or whatsapp (legacy)
  const waRaw = body.whatsapp_number !== undefined ? body.whatsapp_number : body.whatsapp
  const whatsapp = waRaw !== undefined ? normalizeWhatsApp(String(waRaw || '')) : undefined
  const email    = body.email    !== undefined ? String(body.email   || '').trim() : undefined
  const phone    = body.phone    !== undefined ? String(body.phone   || '').trim() : undefined
  const hours    = body.hours    !== undefined ? String(body.hours   || '').trim() : undefined
  const address  = body.address  !== undefined ? String(body.address || '').trim() : undefined
  const map_url  = body.map_url  !== undefined ? String(body.map_url || '').trim() : undefined

  await c.env.DB.prepare(
    `INSERT INTO profile_contact (profile_id, whatsapp, email, phone, hours, address, map_url, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'))
     ON CONFLICT(profile_id) DO UPDATE SET
       whatsapp   = COALESCE(?2, whatsapp),
       email      = COALESCE(?3, email),
       phone      = COALESCE(?4, phone),
       hours      = COALESCE(?5, hours),
       address    = COALESCE(?6, address),
       map_url    = COALESCE(?7, map_url),
       updated_at = datetime('now')`
  ).bind(
    (profile as any).id,
    whatsapp ?? null, email ?? null, phone ?? null,
    hours ?? null, address ?? null, map_url ?? null,
  ).run()
  return c.json({ ok: true })
})

me.get('/links', async (c) => {
  const userId = c.get('userId') as string
  const profile = await c.env.DB.prepare(
    `SELECT id FROM profiles WHERE user_id = ? LIMIT 1`
  ).bind(userId).first()
  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  const links = await c.env.DB.prepare(
    `SELECT id, label, url, sort_order, is_active FROM profile_links
     WHERE profile_id = ? ORDER BY sort_order ASC`
  ).bind((profile as any).id).all()
  return c.json({ ok: true, data: links.results })
})

me.post('/links', async (c) => {
  const userId = c.get('userId') as string
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Invalid JSON' }, 400) }
  const label = String(body.label || '').trim()
  const url   = String(body.url   || '').trim()
  if (!label) return c.json({ ok: false, error: 'label required' }, 400)
  if (!url || !url.startsWith('http')) return c.json({ ok: false, error: 'valid url required' }, 400)

  const profile = await c.env.DB.prepare(
    `SELECT id FROM profiles WHERE user_id = ? LIMIT 1`
  ).bind(userId).first()
  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  const maxRow = await c.env.DB.prepare(
    `SELECT COALESCE(MAX(sort_order), -1) as mx FROM profile_links WHERE profile_id = ?`
  ).bind((profile as any).id).first()
  const sortOrder = ((maxRow as any)?.mx ?? -1) + 1

  const id = crypto.randomUUID()
  await c.env.DB.prepare(
    `INSERT INTO profile_links (id, profile_id, label, url, sort_order) VALUES (?, ?, ?, ?, ?)`
  ).bind(id, (profile as any).id, label, url, sortOrder).run()
  return c.json({ ok: true, id, sort_order: sortOrder }, 201)
})

// Register /reorder BEFORE /:id to avoid route collision
me.put('/links/reorder', async (c) => {
  const userId = c.get('userId') as string
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Invalid JSON' }, 400) }
  // Accept orderedIds: string[] (preferred) or legacy items: {id, sort_order}[]
  const orderedIds: string[] | undefined = Array.isArray(body.orderedIds) ? body.orderedIds : undefined
  const items: { id: string; sort_order: number }[] | undefined = Array.isArray(body.items) ? body.items : undefined
  if (!orderedIds && !items)
    return c.json({ ok: false, error: 'orderedIds array required' }, 400)

  const profile = await c.env.DB.prepare(
    `SELECT id FROM profiles WHERE user_id = ? LIMIT 1`
  ).bind(userId).first()
  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  if (orderedIds) {
    await Promise.all(orderedIds.map((id: string, index: number) =>
      c.env.DB.prepare(
        `UPDATE profile_links SET sort_order = ?, updated_at = datetime('now')
         WHERE id = ? AND profile_id = ?`
      ).bind(index, id, (profile as any).id).run()
    ))
  } else {
    await Promise.all(items!.map((item) =>
      c.env.DB.prepare(
        `UPDATE profile_links SET sort_order = ?, updated_at = datetime('now')
         WHERE id = ? AND profile_id = ?`
      ).bind(item.sort_order, item.id, (profile as any).id).run()
    ))
  }
  return c.json({ ok: true })
})

me.put('/links/:id', async (c) => {
  const userId = c.get('userId') as string
  const linkId = c.req.param('id')
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Invalid JSON' }, 400) }

  const profile = await c.env.DB.prepare(
    `SELECT id FROM profiles WHERE user_id = ? LIMIT 1`
  ).bind(userId).first()
  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  const label     = body.label     !== undefined ? String(body.label || '').trim() : undefined
  const url       = body.url       !== undefined ? String(body.url   || '').trim() : undefined
  const is_active = body.is_active !== undefined ? (body.is_active ? 1 : 0)       : undefined

  await c.env.DB.prepare(
    `UPDATE profile_links
     SET label      = COALESCE(?1, label),
         url        = COALESCE(?2, url),
         is_active  = COALESCE(?3, is_active),
         updated_at = datetime('now')
     WHERE id = ?4 AND profile_id = ?5`
  ).bind(label ?? null, url ?? null, is_active ?? null, linkId, (profile as any).id).run()
  return c.json({ ok: true })
})

me.delete('/links/:id', async (c) => {
  const userId = c.get('userId') as string
  const linkId = c.req.param('id')

  const profile = await c.env.DB.prepare(
    `SELECT id FROM profiles WHERE user_id = ? LIMIT 1`
  ).bind(userId).first()
  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  await c.env.DB.prepare(
    `DELETE FROM profile_links WHERE id = ? AND profile_id = ?`
  ).bind(linkId, (profile as any).id).run()
  return c.json({ ok: true })
})

// Mount the authenticated sub-app
app.route('/api/v1/me', me)

// --- Analíticas ---

app.post('/api/v1/public/track', async (c) => {
  try {
    const { profileId, eventType, targetId } = await c.req.json()
    const id = crypto.randomUUID()
    await c.env.DB.prepare(
      `INSERT INTO analytics (id, profile_id, event_type, target_id) VALUES (?, ?, ?, ?)`
    )
      .bind(id, profileId, eventType, targetId || null)
      .run()
    return c.json({ ok: true })
  } catch (e) {
    return c.json({ ok: false }, 202)
  }
})

app.get('/api/v1/profile/stats/:profileId', async (c) => {
  const profileId = c.req.param('profileId')
  const totalViews = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM analytics WHERE profile_id = ? AND event_type = 'view'`
  )
    .bind(profileId)
    .first()

  const dailyViews = await c.env.DB.prepare(
    `SELECT date(created_at) as day, COUNT(*) as count 
     FROM analytics 
     WHERE profile_id = ? AND event_type = 'view' AND created_at > date('now', '-7 days') 
     GROUP BY day ORDER BY day ASC`
  )
    .bind(profileId)
    .all()

  const topLinks = await c.env.DB.prepare(
    `SELECT l.label, COUNT(a.id) as clics 
     FROM analytics a 
     JOIN profile_links l ON a.target_id = l.id 
     WHERE a.profile_id = ? AND a.event_type = 'click' 
     GROUP BY l.id ORDER BY clics DESC LIMIT 5`
  )
    .bind(profileId)
    .all()

  return c.json({
    ok: true,
    stats: {
      totalViews: (totalViews as any)?.count || 0,
      dailyViews: dailyViews.results,
      topLinks: topLinks.results,
    },
  })
})

// --- Galería (R2) ---

app.post('/api/v1/profile/gallery/upload', async (c) => {
  const { profileId } = await c.req.parseBody()

  // ✅ Fix TS: valida tipo File correctamente (sin cast)
  const fd = await c.req.formData()
  const fileVal = fd.get('file')

  if (!(fileVal && typeof fileVal === 'object' && 'name' in (fileVal as any) && 'stream' in (fileVal as any))) {
    return c.json({ ok: false, error: 'No file' }, 400)
  }

  const file = fileVal as any as File

  const key = `profiles/${profileId}/${crypto.randomUUID()}-${file.name}`
  await c.env.BUCKET.put(key, file.stream())

  const id = crypto.randomUUID()
  await c.env.DB.prepare(
    `INSERT INTO profile_gallery (id, profile_id, image_key, sort_order) VALUES (?, ?, ?, 0)`
  )
    .bind(id, profileId, key)
    .run()

  return c.json({ ok: true, id, key })
})

app.get('/api/v1/profile/gallery/:profileId', async (c) => {
  const profileId = c.req.param('profileId')
  const photos = await c.env.DB.prepare(
    `SELECT * FROM profile_gallery WHERE profile_id = ? ORDER BY sort_order ASC`
  )
    .bind(profileId)
    .all()
  return c.json({ ok: true, photos: photos.results })
})

// Sirve objetos desde R2 como endpoint público (Plan B: sin CDN público aún)
app.get('/api/v1/public/assets/*', async (c) => {
  const key = decodeURIComponent(c.req.path.slice('/api/v1/public/assets/'.length))
  if (!key) return c.json({ error: 'Key requerida' }, 400)

  const object = await c.env.BUCKET.get(key)
  if (!object) return c.json({ error: 'Archivo no encontrado' }, 404)

  const contentType = object.httpMetadata?.contentType || 'application/octet-stream'
  return new Response(object.body as ReadableStream, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
    },
  })
})

// Perfil Público
app.get('/api/v1/public/profiles/:slug', async (c) => {
  const slug = c.req.param('slug')
  const profile = await c.env.DB.prepare(
    'SELECT id, slug, plan_id, theme_id, is_published, name, bio, whatsapp_number FROM profiles WHERE slug = ?'
  )
    .bind(slug)
    .first()

  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  const [links, rawGallery, rawFaqs, rawProducts, entitlements, rawSocialLinks, rawContact] = await Promise.all([
    c.env.DB.prepare(
      'SELECT id, label, url FROM profile_links WHERE profile_id = ? AND is_active = 1 ORDER BY sort_order ASC'
    )
      .bind((profile as any).id)
      .all(),
    c.env.DB.prepare(
      'SELECT image_key FROM profile_gallery WHERE profile_id = ? ORDER BY sort_order ASC'
    )
      .bind((profile as any).id)
      .all(),
    c.env.DB.prepare(
      'SELECT id, question, answer, sort_order FROM profile_faqs WHERE profile_id = ? ORDER BY sort_order ASC'
    )
      .bind((profile as any).id)
      .all(),
    c.env.DB.prepare(
      'SELECT id, title, description, price, image_url, whatsapp_text, is_featured, sort_order FROM profile_products WHERE profile_id = ? ORDER BY sort_order ASC'
    )
      .bind((profile as any).id)
      .all(),
    getEntitlements(c, (profile as any).id as string),
    c.env.DB.prepare(
      'SELECT id, type, url, sort_order FROM profile_social_links WHERE profile_id = ? AND enabled = 1 ORDER BY sort_order ASC'
    )
      .bind((profile as any).id)
      .all(),
    c.env.DB.prepare(
      'SELECT whatsapp, email, phone, hours, address, map_url FROM profile_contact WHERE profile_id = ? LIMIT 1'
    )
      .bind((profile as any).id)
      .first(),
  ])

  // Construye URL pública vía el endpoint /assets (Plan B: sin CDN externo)
  const origin = new URL(c.req.url).origin
  const toAssetUrl = (key: string): string | null => {
    if (!key) return null
    if (key.startsWith('http')) return key
    const encodedKey = key.split('/').map(encodeURIComponent).join('/')
    return `${origin}/api/v1/public/assets/${encodedKey}`
  }

  // Filtra items demo/prueba y agrega image_url resuelta
  const isDemoKey = (key: string) =>
    key.startsWith('demo/') || key === 'profile_debug' || key.startsWith('profile_debug')

  const gallery = (rawGallery.results as { image_key: string }[])
    .filter((g) => g.image_key && !isDemoKey(g.image_key))
    .map((g) => ({ image_key: g.image_key, image_url: toAssetUrl(g.image_key) }))

  const products = rawProducts.results as {
    id: string
    title: string
    description: string | null
    price: string | null
    image_url: string | null
    whatsapp_text: string | null
    is_featured: number
    sort_order: number
  }[]

  const featured_product = products.find((p) => p.is_featured === 1) ?? null

  return c.json({
    ok: true,
    data: {
      profileId: (profile as any).id,
      slug: (profile as any).slug,
      planId: (profile as any).plan_id,
      themeId: (profile as any).theme_id,
      name: (profile as any).name,
      bio: (profile as any).bio,
      whatsapp_number: (profile as any).whatsapp_number ?? null,
      social_links: rawSocialLinks.results,
      links: links.results,
      gallery,
      faqs: rawFaqs.results,
      products,
      featured_product,
      entitlements,
      contact: rawContact ? {
        whatsapp: (rawContact as any).whatsapp ?? null,
        email:    (rawContact as any).email    ?? null,
        phone:    (rawContact as any).phone    ?? null,
        hours:    (rawContact as any).hours    ?? null,
        address:  (rawContact as any).address  ?? null,
        map_url:  (rawContact as any).map_url  ?? null,
      } : null,
    },
  })
})

/* ============================
   vCard público
   ============================ */

app.get('/api/v1/public/vcard/:profileId', async (c) => {
  const profileId = c.req.param('profileId')

  const [profile, contactRow] = await Promise.all([
    c.env.DB.prepare(
      'SELECT slug, name, bio, whatsapp_number FROM profiles WHERE id = ?'
    ).bind(profileId).first() as Promise<{ slug: string; name: string | null; bio: string | null; whatsapp_number: string | null } | null>,
    c.env.DB.prepare(
      'SELECT whatsapp, phone, email, address FROM profile_contact WHERE profile_id = ? LIMIT 1'
    ).bind(profileId).first() as Promise<{ whatsapp: string | null; phone: string | null; email: string | null; address: string | null } | null>,
  ])

  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  // Fallback: whatsapp_number → contact.whatsapp → contact.phone
  const telNumber = profile.whatsapp_number || contactRow?.whatsapp || contactRow?.phone || null

  const fn = profile.name || profile.slug
  const profileUrl = `${PUBLIC_BASE_URL}/${profile.slug}`

  const lines: string[] = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${fn}`,
    `N:${fn};;;`,
  ]
  if (telNumber)       lines.push(`TEL;TYPE=CELL:${telNumber}`)
  if (contactRow?.email) lines.push(`EMAIL:${contactRow.email}`)
  if (contactRow?.address) lines.push(`ADR;TYPE=WORK:;;${contactRow.address};;;;`)
  if (profile.bio)     lines.push(`NOTE:${profile.bio.replace(/\n/g, '\\n')}`)
  lines.push(`URL:${profileUrl}`)
  lines.push('END:VCARD')

  const vcf = lines.join('\r\n') + '\r\n'
  const filename = `${profile.slug}.vcf`

  return new Response(vcf, {
    headers: {
      'Content-Type': 'text/vcard; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
})

/* ============================
   Waitlist
   ============================ */

const WAITLIST_MODES = ['Virtual', 'Fisica', 'Mixta'] as const

app.post('/api/v1/public/waitlist', async (c) => {
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Invalid JSON' }, 400) }

  const email    = String(body.email    || '').trim().toLowerCase()
  const name     = String(body.name     || '').trim()
  const sector   = String(body.sector   || '').trim()
  const mode     = String(body.mode     || '').trim()

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return c.json({ ok: false, error: 'valid email required' }, 400)
  if (!name || name.length < 2)
    return c.json({ ok: false, error: 'name required (min 2 chars)' }, 400)
  if (!sector || sector.length < 2)
    return c.json({ ok: false, error: 'sector required' }, 400)
  if (!(WAITLIST_MODES as readonly string[]).includes(mode))
    return c.json({ ok: false, error: 'mode must be Virtual, Fisica or Mixta' }, 400)

  const wa = normalizeWhatsApp(String(body.whatsapp || ''))
  if (!wa) return c.json({ ok: false, error: 'WHATSAPP_INVALID' }, 400)

  // Idempotente: si ya existe, actualiza name/sector/mode y devuelve posición
  const existing = await c.env.DB.prepare(
    `SELECT id, position FROM waitlist WHERE email = ?1 OR (whatsapp IS NOT NULL AND whatsapp != '' AND whatsapp = ?2)`
  ).bind(email, wa).first()

  if (existing) {
    await c.env.DB.prepare(
      `UPDATE waitlist SET name = ?1, sector = ?2, mode = ?3 WHERE id = ?4`
    ).bind(name, sector, mode, (existing as any).id).run()
    return c.json({ ok: true, position: (existing as any).position, whatsapp: wa, updated: true })
  }

  const posRow = await c.env.DB.prepare(`SELECT COUNT(*) as n FROM waitlist`).first()
  const position = ((posRow as any)?.n || 0) + 1

  const id = crypto.randomUUID()
  await c.env.DB.prepare(
    `INSERT INTO waitlist (id, email, whatsapp, name, sector, mode, position) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
  ).bind(id, email, wa, name, sector, mode, position).run()

  return c.json({ ok: true, position, whatsapp: wa }, 201)
})

/* ============================
   FASE 3 — Leads (Captura)
   ============================ */

// --- Leads (Captura de contacto) + Turnstile condicional ---

const TURNSTILE_SITEKEY = '0x4AAAAAACgDVjTSshSRPS5q'

app.post('/api/v1/public/leads', async (c) => {
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Invalid JSON' }, 400) }

  const profile_slug = String(body.profile_slug || '').trim()
  const name = String(body.name || '').trim()
  const email = String(body.email || '').trim()
  const phone = String(body.phone || '').trim()
  const message = String(body.message || '').trim()
  const honeypot = String(body.hp || '').trim()
  const source_url = String(body.source_url || '').trim()
  const turnstile_token = String(body.turnstile_token || '').trim()

  if (!profile_slug || profile_slug.length < 2) return c.json({ ok: false, error: 'profile_slug required' }, 400)
  if (!name || name.length < 2) return c.json({ ok: false, error: 'name required' }, 400)
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ ok: false, error: 'valid email required' }, 400)
  if (!message || message.length < 10) return c.json({ ok: false, error: 'message must be at least 10 chars' }, 400)

  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || ''
  const ua = c.req.header('user-agent') || ''
  const ip_hash = await sha256Base64Url(ip || 'unknown')

  // Si honeypot viene lleno → exigir Turnstile (condicional)
  if (honeypot) {
    if (!turnstile_token) {
      return c.json({ ok: false, error: 'turnstile_required', sitekey: TURNSTILE_SITEKEY }, 403)
    }
    const ok = await verifyTurnstile(c, turnstile_token, ip)
    if (!ok) return c.json({ ok: false, error: 'turnstile_failed' }, 403)
  }

  // Rate limit (5 envíos / 10 min por ip_hash + slug)
  const rl = await c.env.DB.prepare(
    `SELECT COUNT(*) as n
     FROM lead_rate_limits
     WHERE profile_slug = ?1 AND ip_hash = ?2
       AND created_at >= datetime('now','-10 minutes')`
  ).bind(profile_slug, ip_hash).first()

  const count = ((rl as any)?.n || 0) as number

  // Si excedió límite → exigir Turnstile (condicional)
  if (count >= 5) {
    if (!turnstile_token) {
      return c.json({ ok: false, error: 'turnstile_required', sitekey: TURNSTILE_SITEKEY }, 403)
    }
    const ok = await verifyTurnstile(c, turnstile_token, ip)
    if (!ok) return c.json({ ok: false, error: 'turnstile_failed' }, 403)
  }

  // Insertar lead
  await c.env.DB.prepare(
    `INSERT INTO leads (profile_slug, name, email, phone, message, source_url, user_agent, ip_hash)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
  ).bind(profile_slug, name, email, phone, message, source_url, ua, ip_hash).run()

  // Registrar rate token
  await c.env.DB.prepare(
    `INSERT INTO lead_rate_limits (profile_slug, ip_hash) VALUES (?1, ?2)`
  ).bind(profile_slug, ip_hash).run()

  return c.json({ ok: true }, 201)
})

async function verifyTurnstile(c: any, token: string, ip: string): Promise<boolean> {
  const secret = (c.env as any).TURNSTILE_SECRET
  if (!secret) return false

  const form = new FormData()
  form.append('secret', secret)
  form.append('response', token)
  if (ip) form.append('remoteip', ip)

  const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: form,
  })

  // ✅ Fix TS: tipa como any para permitir data.success
  const data: any = await resp.json().catch(() => null)
  return !!(data && data.success)
}

function normalizeWhatsApp(input: string): string | null {
  if (!input) return null
  const digits = input.replace(/\D/g, '')
  // RD: 10 dígitos 809/829/849 → +1XXXXXXXXXX
  if (digits.length === 10 && /^(809|829|849)/.test(digits))
    return `+1${digits}`
  // RD: 11 dígitos 1+809/829/849 → +1XXXXXXXXXX
  if (digits.length === 11 && digits.startsWith('1') && /^(809|829|849)/.test(digits.slice(1)))
    return `+${digits}`
  // Internacional: 7-15 dígitos → agrega + si no viene
  if (digits.length >= 7 && digits.length <= 15)
    return `+${digits}`
  return null
}

async function sha256Base64Url(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  const bytes = new Uint8Array(hash)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

// Admin
app.get('/api/v1/admin/profiles', requireAdmin, async (c) => {
  const profiles = await c.env.DB.prepare(
    `SELECT p.id, p.slug, p.plan_id, p.is_published, u.email FROM profiles p JOIN users u ON p.user_id = u.id`
  ).all()
  return c.json({ ok: true, data: profiles.results })
})

app.post('/api/v1/admin/activate-module', async (c) => {
  const { profileId, moduleCode, secret } = await c.req.json()
  if (secret !== 'intap_master_key') return c.json({ ok: false, error: 'Unauthorized' }, 401)
  await c.env.DB.prepare(
    `INSERT INTO profile_modules (profile_id, module_code, expires_at) 
     VALUES (?, ?, datetime('now', '+1 year')) 
     ON CONFLICT(profile_id, module_code) DO UPDATE SET expires_at = excluded.expires_at`
  )
    .bind(profileId, moduleCode)
    .run()
  return c.json({ ok: true, message: `Módulo ${moduleCode} activado` })
})

export default app