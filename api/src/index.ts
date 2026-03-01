import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { getEntitlements } from './engine/entitlements'
import { sendMagicLinkEmail } from './lib/email'

type Bindings = {
  DB: D1Database
  BUCKET: R2Bucket
  RESEND_API_KEY: string
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  TURNSTILE_SECRET: string
  API_URL: string
  APP_URL: string
  ENVIRONMENT: string
}

type Variables = { userId: string }

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ─── CORS — credentials-aware ─────────────────────────────────────────────

function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false
  const exact = [
    'https://intaprd.com',
    'https://www.intaprd.com',
    'http://localhost:5173',
    'http://localhost:4173',
  ]
  if (exact.includes(origin)) return true
  try {
    const u = new URL(origin)
    return (
      u.protocol === 'https:' &&
      (u.hostname === 'intaprd.com' || u.hostname.endsWith('.intaprd.com'))
    )
  } catch { return false }
}

app.use('*', cors({
  origin: (origin) => isAllowedOrigin(origin) ? origin : '',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400,
}))
app.options('*', (c) => c.body(null, 204))

// Global error handler
app.onError((err, c) => {
  console.error('[onError]', err)
  return c.json({ ok: false, error: 'Internal server error' }, 500)
})

// ─── Auth Helpers ─────────────────────────────────────────────────────────

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function generateToken(bytes = 32): string {
  const array = new Uint8Array(bytes)
  crypto.getRandomValues(array)
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('')
}

function parseCookie(header: string, name: string): string | null {
  const match = header.match(new RegExp(`(?:^|;\\s*)${encodeURIComponent(name)}=([^;]*)`))
  if (match) return decodeURIComponent(match[1])
  // Also try unencoded name
  const match2 = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return match2 ? decodeURIComponent(match2[1]) : null
}

function buildSessionCookie(value: string, appUrl: string, maxAge: number): string {
  let cookie = `session_id=${encodeURIComponent(value)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`
  try {
    const u = new URL(appUrl)
    if (u.hostname === 'intaprd.com' || u.hostname.endsWith('.intaprd.com')) {
      cookie += '; Domain=.intaprd.com'
    }
  } catch { /* appUrl inválida — no agregar Domain */ }
  return cookie
}

// ─── Middlewares ──────────────────────────────────────────────────────────

const requireAdmin = async (c: any, next: any) => {
  const adminEmail = 'juanluis@intaprd.com'
  const userEmail = c.req.header('X-User-Email')
  if (userEmail !== adminEmail) return c.json({ ok: false, error: 'Forbidden' }, 403)
  await next()
}

const requireAuth = async (c: any, next: any) => {
  const cookieHeader = c.req.header('Cookie') || ''
  const rawSession = parseCookie(cookieHeader, 'session_id')
  if (!rawSession) return c.json({ ok: false, error: 'Unauthorized' }, 401)

  const sessionHash = await sha256Hex(rawSession)
  const session = await c.env.DB.prepare(
    `SELECT id, user_id FROM auth_sessions
     WHERE session_hash = ? AND expires_at > datetime('now') AND revoked_at IS NULL
     LIMIT 1`
  ).bind(sessionHash).first()

  if (!session) return c.json({ ok: false, error: 'Unauthorized' }, 401)

  c.set('userId', (session as any).user_id)
  await next()

  // Update last_seen_at non-blocking after response
  c.env.DB.prepare(`UPDATE auth_sessions SET last_seen_at = datetime('now') WHERE id = ?`)
    .bind((session as any).id)
    .run()
    .catch(() => {})
}

// ─── Routes ───────────────────────────────────────────────────────────────

app.get('/api/health', (c) => c.json({ ok: true, status: 'healthy' }))

// ─── Magic Link ───────────────────────────────────────────────────────────

app.post('/api/v1/auth/magic-link/start', async (c) => {
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Invalid JSON' }, 400) }

  const email = String(body.email || '').trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return c.json({ ok: false, error: 'Email inválido' }, 400)

  // Rate limit: max 5 solicitudes por email por 10 minutos
  const rlRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM auth_magic_links
     WHERE email = ? AND created_at > datetime('now', '-10 minutes')`
  ).bind(email).first()
  if (((rlRow as any)?.cnt || 0) >= 5)
    return c.json({ ok: false, error: 'Demasiados intentos. Espera 10 minutos.' }, 429)

  const rawToken  = generateToken(32)
  const tokenHash = await sha256Hex(rawToken)
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || ''
  const ua = c.req.header('User-Agent') || ''

  await c.env.DB.prepare(
    `INSERT INTO auth_magic_links (id, email, token_hash, expires_at, requested_ip, user_agent, created_at)
     VALUES (?, ?, ?, datetime('now', '+10 minutes'), ?, ?, datetime('now'))`
  ).bind(generateToken(16), email, tokenHash, ip, ua).run()

  const appUrl    = (c.env as any).APP_URL || 'https://app.intaprd.com'
  const magicLink = `${appUrl}/auth/callback?token=${rawToken}`
  const resendKey = (c.env as any).RESEND_API_KEY

  if (resendKey) {
    await sendMagicLinkEmail({ RESEND_API_KEY: resendKey }, email, magicLink)
  } else {
    console.log(`[MAGIC LINK] ${email} → ${magicLink}`)
  }

  return c.json({ ok: true, message: 'Enlace enviado a tu correo' })
})

app.get('/api/v1/auth/magic-link/verify', async (c) => {
  const rawToken = c.req.query('token') || ''
  if (!rawToken) return c.json({ ok: false, error: 'Token requerido' }, 400)

  const tokenHash = await sha256Hex(rawToken)
  const record = await c.env.DB.prepare(
    `SELECT id, email FROM auth_magic_links
     WHERE token_hash = ? AND used_at IS NULL AND expires_at > datetime('now')
     LIMIT 1`
  ).bind(tokenHash).first()

  if (!record) return c.json({ ok: false, error: 'Enlace inválido o expirado' }, 401)

  // Marcar como usado (one-time use)
  await c.env.DB.prepare(
    `UPDATE auth_magic_links SET used_at = datetime('now') WHERE id = ?`
  ).bind((record as any).id).run()

  const email = (record as any).email

  // Upsert usuario
  await c.env.DB.prepare(
    `INSERT INTO users (id, email) VALUES (?, ?) ON CONFLICT(email) DO NOTHING`
  ).bind(crypto.randomUUID(), email).run()

  const user = await c.env.DB.prepare(
    `SELECT id FROM users WHERE email = ? LIMIT 1`
  ).bind(email).first()
  if (!user) return c.json({ ok: false, error: 'Error al crear usuario' }, 500)

  // Crear sesión (30 días)
  const sessionRaw  = generateToken(32)
  const sessionHash = await sha256Hex(sessionRaw)
  const reqIp = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || ''
  const reqUa = c.req.header('User-Agent') || ''

  await c.env.DB.prepare(
    `INSERT INTO auth_sessions (id, user_id, session_hash, expires_at, ip, user_agent, created_at)
     VALUES (?, ?, ?, datetime('now', '+30 days'), ?, ?, datetime('now'))`
  ).bind(generateToken(16), (user as any).id, sessionHash, reqIp, reqUa).run()

  const appUrl = (c.env as any).APP_URL || 'https://app.intaprd.com'
  const cookie = buildSessionCookie(sessionRaw, appUrl, 30 * 24 * 60 * 60)

  return c.json({ ok: true }, 200, { 'Set-Cookie': cookie })
})

// ─── Google OAuth ─────────────────────────────────────────────────────────

app.get('/api/v1/auth/google/start', async (c) => {
  const reqHostname = new URL(c.req.url).hostname
  if (reqHostname.endsWith('.workers.dev')) {
    const apiUrl   = (c.env as any).API_URL || 'https://intaprd.com'
    const reqUrl   = new URL(c.req.url)
    const canonical = new URL(reqUrl.pathname + reqUrl.search, apiUrl)
    return Response.redirect(canonical.toString(), 301)
  }

  const clientId = (c.env as any).GOOGLE_CLIENT_ID
  if (!clientId) return c.json({ ok: false, error: 'Google OAuth no configurado' }, 503)

  const state      = generateToken(16)
  const apiUrl     = (c.env as any).API_URL || 'https://intaprd.com'
  const redirectUri = `${apiUrl}/api/v1/auth/google/callback`

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         'openid email profile',
    state,
    access_type:   'online',
    prompt:        'select_account',
  })

  const headers = new Headers()
  headers.set('Location', `https://accounts.google.com/o/oauth2/v2/auth?${params}`)
  headers.set(
    'Set-Cookie',
    `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth/google; Max-Age=600`,
  )
  return new Response(null, { status: 302, headers })
})

app.get('/api/v1/auth/google/callback', async (c) => {
  const reqHostname = new URL(c.req.url).hostname
  if (reqHostname.endsWith('.workers.dev')) {
    const apiUrl   = (c.env as any).API_URL || 'https://intaprd.com'
    const reqUrl   = new URL(c.req.url)
    const canonical = new URL(reqUrl.pathname + reqUrl.search, apiUrl)
    return Response.redirect(canonical.toString(), 301)
  }

  const code       = c.req.query('code')  || ''
  const state      = c.req.query('state') || ''
  const oauthError = c.req.query('error') || ''

  const appUrl = (c.env as any).APP_URL || 'https://app.intaprd.com'

  if (oauthError || !code)
    return c.redirect(`${appUrl}/admin/login?error=oauth_denied`)

  // Validar state anti-CSRF
  const cookieHeader = c.req.header('Cookie') || ''
  const savedState   = parseCookie(cookieHeader, 'oauth_state')
  if (!savedState || savedState !== state)
    return c.redirect(`${appUrl}/admin/login?error=oauth_state`)

  const clientId     = (c.env as any).GOOGLE_CLIENT_ID
  const clientSecret = (c.env as any).GOOGLE_CLIENT_SECRET
  const apiUrl       = (c.env as any).API_URL || 'https://intaprd.com'
  const redirectUri  = `${apiUrl}/api/v1/auth/google/callback`

  // Intercambiar code por access_token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     clientId,
      client_secret: clientSecret,
      redirect_uri:  redirectUri,
      grant_type:    'authorization_code',
    }),
  })
  if (!tokenRes.ok) return c.redirect(`${appUrl}/admin/login?error=oauth_token`)

  const tokenData: any = await tokenRes.json()

  // Obtener info del usuario
  const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
  })
  if (!userInfoRes.ok) return c.redirect(`${appUrl}/admin/login?error=oauth_userinfo`)

  const googleUser: any = await userInfoRes.json()
  const email = (googleUser.email || '').toLowerCase().trim()
  if (!email) return c.redirect(`${appUrl}/admin/login?error=oauth_no_email`)

  // Upsert usuario
  await c.env.DB.prepare(
    `INSERT INTO users (id, email) VALUES (?, ?) ON CONFLICT(email) DO NOTHING`
  ).bind(crypto.randomUUID(), email).run()

  const user = await c.env.DB.prepare(
    `SELECT id FROM users WHERE email = ? LIMIT 1`
  ).bind(email).first()
  if (!user) return c.redirect(`${appUrl}/admin/login?error=user_error`)

  const userId = (user as any).id

  // Upsert identidad OAuth
  await c.env.DB.prepare(
    `INSERT INTO auth_identities (id, user_id, provider, provider_user_id, created_at)
     VALUES (?, ?, 'google', ?, datetime('now'))
     ON CONFLICT(provider, provider_user_id) DO NOTHING`
  ).bind(generateToken(16), userId, String(googleUser.id || '')).run()

  // Crear sesión (30 días)
  const sessionRaw  = generateToken(32)
  const sessionHash = await sha256Hex(sessionRaw)
  const reqIp = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || ''
  const reqUa = c.req.header('User-Agent') || ''

  await c.env.DB.prepare(
    `INSERT INTO auth_sessions (id, user_id, session_hash, expires_at, ip, user_agent, created_at)
     VALUES (?, ?, ?, datetime('now', '+30 days'), ?, ?, datetime('now'))`
  ).bind(generateToken(16), userId, sessionHash, reqIp, reqUa).run()

  const sessionCookie = buildSessionCookie(sessionRaw, appUrl, 30 * 24 * 60 * 60)
  const clearState    = `oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth/google; Max-Age=0`

  const headers = new Headers()
  headers.set('Location', `${appUrl}/admin`)
  headers.append('Set-Cookie', sessionCookie)
  headers.append('Set-Cookie', clearState)
  return new Response(null, { status: 302, headers })
})

// ─── Logout ───────────────────────────────────────────────────────────────

app.post('/api/v1/auth/logout', async (c) => {
  const cookieHeader = c.req.header('Cookie') || ''
  const rawSession   = parseCookie(cookieHeader, 'session_id')

  if (rawSession) {
    const sessionHash = await sha256Hex(rawSession)
    await c.env.DB.prepare(
      `UPDATE auth_sessions SET revoked_at = datetime('now') WHERE session_hash = ?`
    ).bind(sessionHash).run()
  }

  const appUrlLogout = (c.env as any).APP_URL || 'https://app.intaprd.com'
  let clearCookie = `session_id=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
  try {
    const u = new URL(appUrlLogout)
    if (u.hostname === 'intaprd.com' || u.hostname.endsWith('.intaprd.com'))
      clearCookie += '; Domain=.intaprd.com'
  } catch { /* no agregar Domain */ }

  return c.json({ ok: true }, 200, { 'Set-Cookie': clearCookie })
})

// ─── /me endpoints — sub-app aislado, requireAuth se aplica una sola vez ──

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
  let hasLinks   = false
  if (r.profile_id) {
    const [contactRow, linksRow] = await Promise.all([
      c.env.DB.prepare(`SELECT profile_id FROM profile_contact WHERE profile_id = ? LIMIT 1`).bind(r.profile_id).first(),
      c.env.DB.prepare(`SELECT COUNT(*) as n FROM profile_links WHERE profile_id = ?`).bind(r.profile_id).first(),
    ])
    hasContact = !!contactRow
    hasLinks   = ((linksRow as any)?.n || 0) > 0
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
  const RESERVED_SLUGS = new Set([
    // rutas del Worker / API
    'api', 'auth', 'me', 'assets', 'health', 'public',
    // rutas del panel admin (app.intaprd.com)
    'admin', 'login', 'logout', 'check-email', 'onboarding',
    'dashboard', 'settings', 'account', 'profile', 'superadmin',
    // rutas de la landing (intaprd.com)
    'about', 'pricing', 'blog', 'help', 'terms', 'privacy', 'contact',
    // técnicos
    'www', 'favicon', 'static', 'images', 'app', 'link',
  ])
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

  const waRaw    = body.whatsapp_number !== undefined ? body.whatsapp_number : body.whatsapp
  const whatsapp = waRaw   !== undefined ? normalizeWhatsApp(String(waRaw   || '')) : undefined
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

// ─── Analíticas ───────────────────────────────────────────────────────────

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

// ─── Galería (R2) ─────────────────────────────────────────────────────────

app.post('/api/v1/profile/gallery/upload', async (c) => {
  const { profileId } = await c.req.parseBody()

  const fd      = await c.req.formData()
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

// ─── Perfil Público ───────────────────────────────────────────────────────

app.get('/api/v1/public/profiles/:slug', async (c) => {
  const slug    = c.req.param('slug')
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

  const origin    = new URL(c.req.url).origin
  const toAssetUrl = (key: string): string | null => {
    if (!key) return null
    if (key.startsWith('http')) return key
    const encodedKey = key.split('/').map(encodeURIComponent).join('/')
    return `${origin}/api/v1/public/assets/${encodedKey}`
  }

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
      profileId:      (profile as any).id,
      slug:           (profile as any).slug,
      planId:         (profile as any).plan_id,
      themeId:        (profile as any).theme_id,
      name:           (profile as any).name,
      bio:            (profile as any).bio,
      whatsapp_number: (profile as any).whatsapp_number ?? null,
      social_links:   rawSocialLinks.results,
      links:          links.results,
      gallery,
      faqs:           rawFaqs.results,
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

// ─── vCard ────────────────────────────────────────────────────────────────

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

  const telNumber  = profile.whatsapp_number || contactRow?.whatsapp || contactRow?.phone || null
  const fn         = profile.name || profile.slug
  const appUrl     = (c.env as any).APP_URL || 'https://app.intaprd.com'
  const profileUrl = `${appUrl}/${profile.slug}`

  const lines: string[] = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${fn}`,
    `N:${fn};;;`,
  ]
  if (telNumber)          lines.push(`TEL;TYPE=CELL:${telNumber}`)
  if (contactRow?.email)  lines.push(`EMAIL:${contactRow.email}`)
  if (contactRow?.address) lines.push(`ADR;TYPE=WORK:;;${contactRow.address};;;;`)
  if (profile.bio)        lines.push(`NOTE:${profile.bio.replace(/\n/g, '\\n')}`)
  lines.push(`URL:${profileUrl}`)
  lines.push('END:VCARD')

  const vcf      = lines.join('\r\n') + '\r\n'
  const filename = `${profile.slug}.vcf`

  return new Response(vcf, {
    headers: {
      'Content-Type': 'text/vcard; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
})

// ─── Waitlist ─────────────────────────────────────────────────────────────

const WAITLIST_MODES = ['Virtual', 'Fisica', 'Mixta'] as const

app.post('/api/v1/public/waitlist', async (c) => {
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Invalid JSON' }, 400) }

  const email  = String(body.email  || '').trim().toLowerCase()
  const name   = String(body.name   || '').trim()
  const sector = String(body.sector || '').trim()
  const mode   = String(body.mode   || '').trim()

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return c.json({ ok: false, error: 'valid email required' }, 400)
  if (!name   || name.length < 2)   return c.json({ ok: false, error: 'name required (min 2 chars)' }, 400)
  if (!sector || sector.length < 2) return c.json({ ok: false, error: 'sector required' }, 400)
  if (!(WAITLIST_MODES as readonly string[]).includes(mode))
    return c.json({ ok: false, error: 'mode must be Virtual, Fisica or Mixta' }, 400)

  const wa = normalizeWhatsApp(String(body.whatsapp || ''))
  if (!wa) return c.json({ ok: false, error: 'WHATSAPP_INVALID' }, 400)

  const existing = await c.env.DB.prepare(
    `SELECT id, position FROM waitlist WHERE email = ?1 OR (whatsapp IS NOT NULL AND whatsapp != '' AND whatsapp = ?2)`
  ).bind(email, wa).first()

  if (existing) {
    await c.env.DB.prepare(
      `UPDATE waitlist SET name = ?1, sector = ?2, mode = ?3 WHERE id = ?4`
    ).bind(name, sector, mode, (existing as any).id).run()
    return c.json({ ok: true, position: (existing as any).position, whatsapp: wa, updated: true })
  }

  const posRow   = await c.env.DB.prepare(`SELECT COUNT(*) as n FROM waitlist`).first()
  const position = ((posRow as any)?.n || 0) + 1

  const id = crypto.randomUUID()
  await c.env.DB.prepare(
    `INSERT INTO waitlist (id, email, whatsapp, name, sector, mode, position) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
  ).bind(id, email, wa, name, sector, mode, position).run()

  return c.json({ ok: true, position, whatsapp: wa }, 201)
})

// ─── Leads ────────────────────────────────────────────────────────────────

const TURNSTILE_SITEKEY = '0x4AAAAAACgDVjTSshSRPS5q'

app.post('/api/v1/public/leads', async (c) => {
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Invalid JSON' }, 400) }

  const profile_slug    = String(body.profile_slug    || '').trim()
  const name            = String(body.name            || '').trim()
  const email           = String(body.email           || '').trim()
  const phone           = String(body.phone           || '').trim()
  const message         = String(body.message         || '').trim()
  const honeypot        = String(body.hp              || '').trim()
  const source_url      = String(body.source_url      || '').trim()
  const turnstile_token = String(body.turnstile_token || '').trim()

  if (!profile_slug || profile_slug.length < 2) return c.json({ ok: false, error: 'profile_slug required' }, 400)
  if (!name   || name.length < 2)               return c.json({ ok: false, error: 'name required' }, 400)
  if (!email  || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ ok: false, error: 'valid email required' }, 400)
  if (!message || message.length < 10)          return c.json({ ok: false, error: 'message must be at least 10 chars' }, 400)

  const ip      = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || ''
  const ua      = c.req.header('user-agent') || ''
  const ip_hash = await sha256Base64Url(ip || 'unknown')

  if (honeypot) {
    if (!turnstile_token)
      return c.json({ ok: false, error: 'turnstile_required', sitekey: TURNSTILE_SITEKEY }, 403)
    const ok = await verifyTurnstile(c, turnstile_token, ip)
    if (!ok) return c.json({ ok: false, error: 'turnstile_failed' }, 403)
  }

  const rl = await c.env.DB.prepare(
    `SELECT COUNT(*) as n
     FROM lead_rate_limits
     WHERE profile_slug = ?1 AND ip_hash = ?2
       AND created_at >= datetime('now','-10 minutes')`
  ).bind(profile_slug, ip_hash).first()

  const count = ((rl as any)?.n || 0) as number

  if (count >= 5) {
    if (!turnstile_token)
      return c.json({ ok: false, error: 'turnstile_required', sitekey: TURNSTILE_SITEKEY }, 403)
    const ok = await verifyTurnstile(c, turnstile_token, ip)
    if (!ok) return c.json({ ok: false, error: 'turnstile_failed' }, 403)
  }

  await c.env.DB.prepare(
    `INSERT INTO leads (profile_slug, name, email, phone, message, source_url, user_agent, ip_hash)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
  ).bind(profile_slug, name, email, phone, message, source_url, ua, ip_hash).run()

  await c.env.DB.prepare(
    `INSERT INTO lead_rate_limits (profile_slug, ip_hash) VALUES (?1, ?2)`
  ).bind(profile_slug, ip_hash).run()

  return c.json({ ok: true }, 201)
})

// ─── Utility functions ────────────────────────────────────────────────────

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

  const data: any = await resp.json().catch(() => null)
  return !!(data && data.success)
}

function normalizeWhatsApp(input: string): string | null {
  if (!input) return null
  const digits = input.replace(/\D/g, '')
  if (digits.length === 10 && /^(809|829|849)/.test(digits))
    return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1') && /^(809|829|849)/.test(digits.slice(1)))
    return `+${digits}`
  if (digits.length >= 7 && digits.length <= 15)
    return `+${digits}`
  return null
}

// Kept for leads ip_hash (existing usage)
async function sha256Base64Url(input: string): Promise<string> {
  const data  = new TextEncoder().encode(input)
  const hash  = await crypto.subtle.digest('SHA-256', data)
  const bytes = new Uint8Array(hash)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

// ─── Admin ────────────────────────────────────────────────────────────────

app.get('/api/v1/admin/db-check', async (c) => {
  const key = c.req.header('X-Admin-Key') || c.req.query('key') || ''
  if (key !== 'intap_master_key') return c.json({ ok: false, error: 'Forbidden' }, 403)

  const tables = [
    'users', 'profiles',
    'sessions', 'auth_otp',
    'auth_magic_links', 'auth_sessions', 'auth_identities',
    'profile_links', 'profile_contact',
  ]
  const schema: Record<string, any> = {}

  for (const table of tables) {
    try {
      const info = await c.env.DB.prepare(`PRAGMA table_info(${table})`).all()
      schema[table] = (info.results as any[]).map((r) => ({
        name: r.name, type: r.type, notnull: r.notnull, dflt_value: r.dflt_value,
      }))
    } catch (err) {
      schema[table] = { error: String(err) }
    }
  }

  return c.json({ ok: true, schema })
})

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
