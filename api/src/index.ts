import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { getCookie } from 'hono/cookie'
import { getEntitlements, getRetentionStatus, logPlanEvent } from './engine/entitlements'
import { checkPlanLimit } from './lib/plan-enforcement'
import { sendMagicLinkEmail } from './lib/email'
import { requireSuperAdmin, logAdminAction } from './lib/admin-auth'

type Bindings = {
  DB: D1Database
  AGENTS_DB: D1Database
  BUCKET: R2Bucket
  RESEND_API_KEY: string
  RESEND_FROM: string
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  TURNSTILE_SECRET: string
  API_URL: string
  APP_URL: string
  ENVIRONMENT: string
  ADMIN_EMAILS: string
  ADMIN_API_KEY: string
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
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400,
}))
app.options('*', (c) => c.body(null, 204))


app.use('/api/*', async (c, next) => {
  await next()
  c.header('Cache-Control', 'no-store, no-cache, must-revalidate, private, max-age=0')
  c.header('Pragma', 'no-cache')
  c.header('Vary', 'Cookie, Origin')
})

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
  // 1) Validar que hay sesión activa
  const cookieHeader = c.req.header('Cookie') || ''
  const rawSession = parseCookie(cookieHeader, 'session_id')
  if (!rawSession) return c.json({ ok: false, error: 'Unauthorized' }, 401)

  const sessionHash = await sha256Hex(rawSession)
  const session = await c.env.DB.prepare(
    `SELECT user_id FROM auth_sessions
     WHERE session_hash = ? AND expires_at > datetime('now') AND revoked_at IS NULL
     LIMIT 1`
  ).bind(sessionHash).first()
  if (!session) return c.json({ ok: false, error: 'Unauthorized' }, 401)

  // 2) Obtener email del usuario
  const userRow = await c.env.DB.prepare(
    `SELECT email FROM users WHERE id = ? LIMIT 1`
  ).bind((session as any).user_id).first()
  if (!userRow) return c.json({ ok: false, error: 'Unauthorized' }, 401)

  // 3) Validar contra ADMIN_EMAILS (coma-separado, case-insensitive)
  const adminEmailsRaw: string = c.env.ADMIN_EMAILS || ''
  const adminList = adminEmailsRaw
    .split(',')
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean)
  if (adminList.length === 0) return c.json({ ok: false, error: 'Forbidden' }, 403)

  const userEmail = String((userRow as any).email || '').trim().toLowerCase()
  if (!adminList.includes(userEmail)) return c.json({ ok: false, error: 'Forbidden' }, 403)

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
    .catch(() => { })
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

  const rawToken = generateToken(32)
  const tokenHash = await sha256Hex(rawToken)
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || ''
  const ua = c.req.header('User-Agent') || ''

  await c.env.DB.prepare(
    `INSERT INTO auth_magic_links (id, email, token_hash, expires_at, requested_ip, user_agent, created_at)
     VALUES (?, ?, ?, datetime('now', '+10 minutes'), ?, ?, datetime('now'))`
  ).bind(generateToken(16), email, tokenHash, ip, ua).run()

  // El callback de autenticación SIEMPRE debe apuntar a app.intaprd.com.
  // Usamos APP_URL solo si apunta al subdominio correcto; en caso contrario
  // caemos al valor seguro para evitar que el token llegue al dominio principal.
  const rawAppUrl = String((c.env as any).APP_URL || '')
  const appUrl = rawAppUrl.startsWith('https://app.') ? rawAppUrl : 'https://app.intaprd.com'
  const magicLink = `${appUrl}/auth/callback?token=${rawToken}`
  const resendKey = (c.env as any).RESEND_API_KEY
  const resendFrom = (c.env as any).RESEND_FROM

  if (resendKey) {
    await sendMagicLinkEmail({ RESEND_API_KEY: resendKey, RESEND_FROM: resendFrom }, email, magicLink)
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
  const sessionRaw = generateToken(32)
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
  const clientId = (c.env as any).GOOGLE_CLIENT_ID
  if (!clientId) return c.json({ ok: false, error: 'Google OAuth no configurado' }, 503)

  const state = generateToken(16)
  const apiUrl = new URL(c.req.url).origin
  const redirectUri = `${apiUrl}/api/v1/auth/google/callback`

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
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
  const code = c.req.query('code') || ''
  const state = c.req.query('state') || ''
  const oauthError = c.req.query('error') || ''

  const appUrl = (c.env as any).APP_URL || 'https://app.intaprd.com'

  if (oauthError || !code)
    return c.redirect(`${appUrl}/admin/login?error=oauth_denied`)

  // Validar state anti-CSRF
  const cookieHeader = c.req.header('Cookie') || ''
  const savedState = parseCookie(cookieHeader, 'oauth_state')
  if (!savedState || savedState !== state)
    return c.redirect(`${appUrl}/admin/login?error=oauth_state`)

  const clientId = (c.env as any).GOOGLE_CLIENT_ID
  const clientSecret = (c.env as any).GOOGLE_CLIENT_SECRET
  const apiUrl = new URL(c.req.url).origin
  const redirectUri = `${apiUrl}/api/v1/auth/google/callback`

  // Intercambiar code por access_token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
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
  const sessionRaw = generateToken(32)
  const sessionHash = await sha256Hex(sessionRaw)
  const reqIp = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || ''
  const reqUa = c.req.header('User-Agent') || ''

  await c.env.DB.prepare(
    `INSERT INTO auth_sessions (id, user_id, session_hash, expires_at, ip, user_agent, created_at)
     VALUES (?, ?, ?, datetime('now', '+30 days'), ?, ?, datetime('now'))`
  ).bind(generateToken(16), userId, sessionHash, reqIp, reqUa).run()

  const sessionCookie = buildSessionCookie(sessionRaw, appUrl, 30 * 24 * 60 * 60)
  const clearState = `oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth/google; Max-Age=0`

  const headers = new Headers()
  headers.set('Location', `${appUrl}/admin`)
  headers.append('Set-Cookie', sessionCookie)
  headers.append('Set-Cookie', clearState)
  return new Response(null, { status: 302, headers })
})

// ─── Logout ───────────────────────────────────────────────────────────────

app.post('/api/v1/auth/logout', async (c) => {
  const cookieHeader = c.req.header('Cookie') || ''
  const rawSession = parseCookie(cookieHeader, 'session_id')

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
            p.avatar_url, p.category, p.subcategory, p.is_published, p.theme_id,
            p.accent_color, p.button_style,
            p.template_id, p.template_data, p.plan_id
     FROM users u
     LEFT JOIN profiles p ON p.user_id = u.id
     WHERE u.id = ? LIMIT 1`
  ).bind(userId).first()
  if (!row) return c.json({ ok: false, error: 'User not found' }, 404)

  const r = row as any
  let hasContact = false
  let hasLinks = false
  // Plan / trial / retention summary (nullable if no profile yet)
  let planSummary: {
    plan_code: string
    trial_status: 'active' | 'expired' | 'none'
    trial_expires_at: string | null
    paused_features_count: number
    recoverable_items_count: number
  } | null = null

  if (r.profile_id) {
    const [contactRow, linksRow, overrideRow] = await Promise.all([
      c.env.DB.prepare(`SELECT profile_id FROM profile_contact WHERE profile_id = ? LIMIT 1`).bind(r.profile_id).first(),
      c.env.DB.prepare(`SELECT COUNT(*) as n FROM profile_links WHERE profile_id = ?`).bind(r.profile_id).first(),
      // Trial info — silenced if table doesn't exist (pre-migration 0023)
      c.env.DB.prepare(`SELECT trial_ends_at FROM profile_plan_overrides WHERE profile_id = ? LIMIT 1`)
        .bind(r.profile_id).first().catch(() => null),
    ])
    hasContact = !!contactRow
    hasLinks   = ((linksRow as any)?.n || 0) > 0

    const trialEndsAt  = (overrideRow as any)?.trial_ends_at ?? null
    const trialActive  = trialEndsAt ? new Date(trialEndsAt + 'Z') > new Date() : false
    const trialExpired = trialEndsAt ? !trialActive : false
    const trialStatus: 'active' | 'expired' | 'none' =
      trialActive ? 'active' : (trialExpired ? 'expired' : 'none')

    // Light retention counts (no full ID arrays) to keep /me fast
    const [exceededLinks, exceededPhotos, exceededFaqs, exceededProducts, exceededVideos, expiredModCount] =
      await Promise.all([
        c.env.DB.prepare(`SELECT COUNT(*) as n FROM profile_links WHERE profile_id = ?`).bind(r.profile_id).first().then(row => (row as any)?.n ?? 0).catch(() => 0),
        c.env.DB.prepare(`SELECT COUNT(*) as n FROM profile_gallery WHERE profile_id = ?`).bind(r.profile_id).first().then(row => (row as any)?.n ?? 0).catch(() => 0),
        c.env.DB.prepare(`SELECT COUNT(*) as n FROM profile_faqs WHERE profile_id = ?`).bind(r.profile_id).first().then(row => (row as any)?.n ?? 0).catch(() => 0),
        c.env.DB.prepare(`SELECT COUNT(*) as n FROM profile_products WHERE profile_id = ?`).bind(r.profile_id).first().then(row => (row as any)?.n ?? 0).catch(() => 0),
        c.env.DB.prepare(`SELECT COUNT(*) as n FROM profile_videos WHERE profile_id = ?`).bind(r.profile_id).first().then(row => (row as any)?.n ?? 0).catch(() => 0),
        c.env.DB.prepare(`SELECT COUNT(*) as n FROM profile_modules pm WHERE pm.profile_id = ? AND pm.expires_at IS NOT NULL AND pm.expires_at <= datetime('now')`).bind(r.profile_id).first().then(row => (row as any)?.n ?? 0).catch(() => 0),
      ])

    // Use current entitlements to compute exceeded counts for the summary
    const ents = await getEntitlements(c, r.profile_id).catch(() => null)
    let recoverable = 0
    let pausedFeatures = expiredModCount > 0 ? 1 : 0
    if (ents) {
      const exceeded = {
        links:    Math.max(0, exceededLinks    - ents.maxLinks),
        photos:   Math.max(0, exceededPhotos   - ents.maxPhotos),
        faqs:     Math.max(0, exceededFaqs     - ents.maxFaqs),
        products: Math.max(0, exceededProducts - ents.maxProducts),
        videos:   Math.max(0, exceededVideos   - ents.maxVideos),
      }
      recoverable      = exceeded.links + exceeded.photos + exceeded.faqs + exceeded.products + exceeded.videos
      pausedFeatures  += (exceeded.links    > 0 ? 1 : 0) +
                         (exceeded.photos   > 0 ? 1 : 0) +
                         (exceeded.faqs     > 0 ? 1 : 0) +
                         (exceeded.products > 0 ? 1 : 0) +
                         (exceeded.videos   > 0 ? 1 : 0)
    }

    planSummary = {
      plan_code:               r.plan_id ?? 'free',
      trial_status:            trialStatus,
      trial_expires_at:        trialEndsAt,
      paused_features_count:   pausedFeatures,
      recoverable_items_count: recoverable,
    }
  }

  const onboardingStatus = {
    hasProfile: !!r.profile_id,
    hasSlug: !!r.slug,
    hasCategory: !!r.category,
    hasContact,
    hasLinks,
  }

  const templateData = (() => { try { return JSON.parse(r.template_data || '{}') } catch { return {} } })()
  return c.json({
    ok: true,
    data: {
      ...r,
      profileId: r.profile_id,
      onboardingStatus,
      templateData,
      // Plan / retention summary — null if user has no profile yet
      ...(planSummary ?? {}),
    },
  })
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
  try {
    await c.env.DB.prepare(
      `INSERT INTO profiles (id, user_id, slug, plan_id, theme_id, is_published)
       VALUES (?, ?, ?, 'free', 'default', 0)`
    ).bind(profileId, userId, slug).run()
  } catch (e: any) {
    console.error('[POST /me/profile/claim] D1 error:', e)
    return c.json({ ok: false, error: e?.message || 'Error al crear perfil' }, 500)
  }
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

  const name = body.name !== undefined ? String(body.name || '').trim() : undefined
  const bio = body.bio !== undefined ? String(body.bio || '').trim() : undefined
  const avatar_url = body.avatar_url !== undefined ? String(body.avatar_url || '').trim() : undefined
  const category = body.category !== undefined ? String(body.category || '').trim() : undefined
  const subcategory = body.subcategory !== undefined ? String(body.subcategory || '').trim() : undefined
  const VALID_THEMES = ['default', 'light', 'modern', 'bento', 'classic', 'ocean', 'sunset', 'midnight']
  const theme_id = body.theme_id !== undefined && VALID_THEMES.includes(String(body.theme_id))
    ? String(body.theme_id) : undefined
  const is_published = body.is_published !== undefined ? (body.is_published ? 1 : 0) : undefined
  const VALID_TEMPLATES = ['restaurante', 'servicios', 'eventos']
  const template_id = body.template_id !== undefined
    ? (VALID_TEMPLATES.includes(String(body.template_id)) ? String(body.template_id) : null)
    : undefined
  const template_data = body.template_data !== undefined
    ? JSON.stringify(typeof body.template_data === 'object' ? body.template_data : {})
    : undefined

  try {
    await c.env.DB.prepare(
      `UPDATE profiles
       SET name          = COALESCE(?1, name),
           bio           = COALESCE(?2, bio),
           avatar_url    = COALESCE(?3, avatar_url),
           category      = COALESCE(?4, category),
           subcategory   = COALESCE(?5, subcategory),
           theme_id      = COALESCE(?6, theme_id),
           is_published  = COALESCE(?7, is_published),
           template_id   = COALESCE(?9, template_id),
           template_data = COALESCE(?10, template_data),
           updated_at    = datetime('now')
       WHERE id = ?8`
    ).bind(
      name ?? null, bio ?? null, avatar_url ?? null, category ?? null, subcategory ?? null,
      theme_id ?? null, is_published ?? null, (profile as any).id,
      template_id ?? null, template_data ?? null,
    ).run()
  } catch (e: any) {
    console.error('[PUT /me/profile] D1 error:', e)
    return c.json({ ok: false, error: e?.message || 'Error al guardar perfil' }, 500)
  }
  return c.json({ ok: true })
})

me.post('/profile/avatar', async (c) => {
  const userId = c.get('userId') as string

  const profile = await c.env.DB.prepare(
    `SELECT id FROM profiles WHERE user_id = ? LIMIT 1`
  ).bind(userId).first()
  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  const fd = await c.req.formData()
  const fileVal = fd.get('file')

  if (!(fileVal && typeof fileVal === 'object' && 'name' in (fileVal as any) && 'stream' in (fileVal as any))) {
    return c.json({ ok: false, error: 'Archivo requerido' }, 400)
  }

  const file = fileVal as any as File
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif']
  if (!ALLOWED_EXTS.includes(ext)) return c.json({ ok: false, error: 'Formato no permitido' }, 400)

  const profileId = (profile as any).id
  const key = `avatars/${profileId}/${crypto.randomUUID()}.${ext}`

  await c.env.BUCKET.put(key, file.stream(), {
    httpMetadata: { contentType: file.type || 'image/jpeg' },
  })

  const origin = new URL(c.req.url).origin
  const encodedKey = key.split('/').map(encodeURIComponent).join('/')
  const avatarUrl = `${origin}/api/v1/public/assets/${encodedKey}`

  await c.env.DB.prepare(
    `UPDATE profiles SET avatar_url = ?, updated_at = datetime('now') WHERE id = ?`
  ).bind(avatarUrl, profileId).run()

  return c.json({ ok: true, avatar_url: avatarUrl })
})

me.put('/profile/slug', async (c) => {
  const userId = c.get('userId') as string
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Invalid JSON' }, 400) }

  const newSlug = String(body.slug || '').trim().toLowerCase()
  const RESERVED_SLUGS = new Set([
    'api', 'auth', 'me', 'assets', 'health', 'public',
    'admin', 'login', 'logout', 'check-email', 'onboarding',
    'dashboard', 'settings', 'account', 'profile', 'superadmin',
    'about', 'pricing', 'blog', 'help', 'terms', 'privacy', 'contact',
    'www', 'favicon', 'static', 'images', 'app', 'link',
  ])

  if (!newSlug || !/^[a-z0-9_-]{2,32}$/.test(newSlug))
    return c.json({ ok: false, error: 'Slug inválido (2–32 chars, a-z 0-9 _ -)' }, 400)
  if (RESERVED_SLUGS.has(newSlug))
    return c.json({ ok: false, error: 'Slug reservado' }, 400)

  const profile = await c.env.DB.prepare(
    `SELECT id, slug FROM profiles WHERE user_id = ? LIMIT 1`
  ).bind(userId).first()
  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  if ((profile as any).slug === newSlug) return c.json({ ok: true, slug: newSlug })

  const taken = await c.env.DB.prepare(
    `SELECT id FROM profiles WHERE slug = ? AND id != ? LIMIT 1`
  ).bind(newSlug, (profile as any).id).first()
  if (taken) return c.json({ ok: false, error: 'Slug no disponible' }, 409)

  await c.env.DB.prepare(
    `UPDATE profiles SET slug = ?, updated_at = datetime('now') WHERE id = ?`
  ).bind(newSlug, (profile as any).id).run()

  return c.json({ ok: true, slug: newSlug })
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

  const waRaw = body.whatsapp_number !== undefined ? body.whatsapp_number : body.whatsapp
  const whatsapp = waRaw !== undefined ? normalizeWhatsApp(String(waRaw || '')) : undefined
  const email = body.email !== undefined ? String(body.email || '').trim() : undefined
  const phone = body.phone !== undefined ? String(body.phone || '').trim() : undefined
  const hours = body.hours !== undefined ? String(body.hours || '').trim() : undefined
  const address = body.address !== undefined ? String(body.address || '').trim() : undefined
  const map_url = body.map_url !== undefined ? String(body.map_url || '').trim() : undefined

  try {
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
  } catch (e: any) {
    console.error('[PUT /me/contact] D1 error:', e)
    return c.json({ ok: false, error: e?.message || 'Error al guardar contacto' }, 500)
  }
  return c.json({ ok: true })
})

me.get('/links', async (c) => {
  const userId = c.get('userId') as string
  const profile = await c.env.DB.prepare(
    `SELECT id FROM profiles WHERE user_id = ? LIMIT 1`
  ).bind(userId).first()
  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  const links = await c.env.DB.prepare(
    `SELECT id, label, url, sort_order, is_active, is_cta FROM profile_links
     WHERE profile_id = ? ORDER BY sort_order ASC`
  ).bind((profile as any).id).all()
  return c.json({ ok: true, data: links.results })
})

me.post('/links', async (c) => {
  const userId = c.get('userId') as string
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Invalid JSON' }, 400) }
  const label = String(body.label || '').trim()
  const url = String(body.url || '').trim()
  if (!label) return c.json({ ok: false, error: 'label required' }, 400)
  if (!url || !url.startsWith('http')) return c.json({ ok: false, error: 'valid url required' }, 400)

  const profile = await c.env.DB.prepare(
    `SELECT id FROM profiles WHERE user_id = ? LIMIT 1`
  ).bind(userId).first()
  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  const profileId = (profile as any).id

  const limitError = await checkPlanLimit(c as any, profileId, 'links')
  if (limitError) return limitError

  const maxRow = await c.env.DB.prepare(
    `SELECT COALESCE(MAX(sort_order), -1) as mx FROM profile_links WHERE profile_id = ?`
  ).bind(profileId).first()
  const sortOrder = ((maxRow as any)?.mx ?? -1) + 1

  const id = crypto.randomUUID()
  await c.env.DB.prepare(
    `INSERT INTO profile_links (id, profile_id, label, url, sort_order) VALUES (?, ?, ?, ?, ?)`
  ).bind(id, profileId, label, url, sortOrder).run()

  console.log(JSON.stringify({
    level: 'info', event: 'link_created',
    route: '/api/v1/me/links', userId, profileId, linkId: id,
    requestId: c.req.header('cf-ray') || '',
  }))

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

  const label = body.label !== undefined ? String(body.label || '').trim() : undefined
  const url = body.url !== undefined ? String(body.url || '').trim() : undefined
  const is_active = body.is_active !== undefined ? (body.is_active ? 1 : 0) : undefined

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

// ─── CTA de link ──────────────────────────────────────────────────────────

me.patch('/links/:id/cta', async (c) => {
  const userId = c.get('userId') as string
  const linkId = c.req.param('id')
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Invalid JSON' }, 400) }

  const profile = await c.env.DB.prepare(
    `SELECT id FROM profiles WHERE user_id = ? LIMIT 1`
  ).bind(userId).first()
  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  const profileId = (profile as any).id
  const is_cta = body.is_cta ? 1 : 0

  // Only one CTA allowed — clear all others if setting to true
  if (is_cta) {
    await c.env.DB.prepare(
      `UPDATE profile_links SET is_cta = 0, updated_at = datetime('now') WHERE profile_id = ?`
    ).bind(profileId).run()
  }
  await c.env.DB.prepare(
    `UPDATE profile_links SET is_cta = ?, updated_at = datetime('now') WHERE id = ? AND profile_id = ?`
  ).bind(is_cta, linkId, profileId).run()
  return c.json({ ok: true })
})

// ─── FAQs ─────────────────────────────────────────────────────────────────

me.get('/faqs', async (c) => {
  const userId = c.get('userId') as string
  const profile = await c.env.DB.prepare(
    `SELECT id FROM profiles WHERE user_id = ? LIMIT 1`
  ).bind(userId).first()
  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  const faqs = await c.env.DB.prepare(
    `SELECT id, question, answer, sort_order FROM profile_faqs
     WHERE profile_id = ? ORDER BY sort_order ASC`
  ).bind((profile as any).id).all()
  return c.json({ ok: true, data: faqs.results })
})

me.post('/faqs', async (c) => {
  const userId = c.get('userId') as string
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Invalid JSON' }, 400) }

  const question = String(body.question || '').trim()
  const answer = String(body.answer || '').trim()
  if (!question) return c.json({ ok: false, error: 'question required' }, 400)
  if (!answer) return c.json({ ok: false, error: 'answer required' }, 400)

  const profile = await c.env.DB.prepare(
    `SELECT id FROM profiles WHERE user_id = ? LIMIT 1`
  ).bind(userId).first()
  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  const profileId = (profile as any).id

  const limitError = await checkPlanLimit(c as any, profileId, 'faqs')
  if (limitError) return limitError

  const maxRow = await c.env.DB.prepare(
    `SELECT COALESCE(MAX(sort_order), -1) as mx FROM profile_faqs WHERE profile_id = ?`
  ).bind(profileId).first()
  const sortOrder = ((maxRow as any)?.mx ?? -1) + 1

  const id = crypto.randomUUID()
  await c.env.DB.prepare(
    `INSERT INTO profile_faqs (id, profile_id, question, answer, sort_order) VALUES (?, ?, ?, ?, ?)`
  ).bind(id, profileId, question, answer, sortOrder).run()

  console.log(JSON.stringify({
    level: 'info', event: 'faq_created',
    route: '/api/v1/me/faqs', userId, profileId, faqId: id,
    requestId: c.req.header('cf-ray') || '',
  }))

  return c.json({ ok: true, id, sort_order: sortOrder }, 201)
})

me.put('/faqs/reorder', async (c) => {
  const userId = c.get('userId') as string
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Invalid JSON' }, 400) }
  const orderedIds: string[] = Array.isArray(body.orderedIds) ? body.orderedIds : []
  if (!orderedIds.length) return c.json({ ok: false, error: 'orderedIds array required' }, 400)

  const profile = await c.env.DB.prepare(
    `SELECT id FROM profiles WHERE user_id = ? LIMIT 1`
  ).bind(userId).first()
  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  await Promise.all(orderedIds.map((id, index) =>
    c.env.DB.prepare(
      `UPDATE profile_faqs SET sort_order = ? WHERE id = ? AND profile_id = ?`
    ).bind(index, id, (profile as any).id).run()
  ))
  return c.json({ ok: true })
})

me.put('/faqs/:id', async (c) => {
  const userId = c.get('userId') as string
  const faqId = c.req.param('id')
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Invalid JSON' }, 400) }

  const profile = await c.env.DB.prepare(
    `SELECT id FROM profiles WHERE user_id = ? LIMIT 1`
  ).bind(userId).first()
  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  const question = body.question !== undefined ? String(body.question || '').trim() : undefined
  const answer = body.answer !== undefined ? String(body.answer || '').trim() : undefined

  await c.env.DB.prepare(
    `UPDATE profile_faqs SET
       question = COALESCE(?1, question),
       answer   = COALESCE(?2, answer)
     WHERE id = ?3 AND profile_id = ?4`
  ).bind(question ?? null, answer ?? null, faqId, (profile as any).id).run()
  return c.json({ ok: true })
})

me.delete('/faqs/:id', async (c) => {
  const userId = c.get('userId') as string
  const faqId = c.req.param('id')

  const profile = await c.env.DB.prepare(
    `SELECT id FROM profiles WHERE user_id = ? LIMIT 1`
  ).bind(userId).first()
  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  await c.env.DB.prepare(
    `DELETE FROM profile_faqs WHERE id = ? AND profile_id = ?`
  ).bind(faqId, (profile as any).id).run()
  return c.json({ ok: true })
})

// ─── Productos / Servicios ─────────────────────────────────────────────────

me.get('/products', async (c) => {
  const userId = c.get('userId') as string
  const profile = await c.env.DB.prepare(
    `SELECT id FROM profiles WHERE user_id = ? LIMIT 1`
  ).bind(userId).first()
  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  const products = await c.env.DB.prepare(
    `SELECT id, title, description, price, image_url, whatsapp_text, is_featured, sort_order
     FROM profile_products WHERE profile_id = ? ORDER BY sort_order ASC`
  ).bind((profile as any).id).all()
  return c.json({ ok: true, data: products.results })
})

me.post('/products', async (c) => {
  const userId = c.get('userId') as string
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Invalid JSON' }, 400) }

  const title = String(body.title || '').trim()
  const description = String(body.description || '').trim()
  const price = String(body.price || '').trim()
  const whatsapp_text = String(body.whatsapp_text || '').trim()
  const image_url = String(body.image_url || '').trim()
  const is_featured = body.is_featured ? 1 : 0

  if (!title) return c.json({ ok: false, error: 'title required' }, 400)

  const profile = await c.env.DB.prepare(
    `SELECT id FROM profiles WHERE user_id = ? LIMIT 1`
  ).bind(userId).first()
  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  const profileId = (profile as any).id

  const limitError = await checkPlanLimit(c as any, profileId, 'products')
  if (limitError) return limitError

  const maxRow = await c.env.DB.prepare(
    `SELECT COALESCE(MAX(sort_order), -1) as mx FROM profile_products WHERE profile_id = ?`
  ).bind(profileId).first()
  const sortOrder = ((maxRow as any)?.mx ?? -1) + 1

  const id = crypto.randomUUID()
  await c.env.DB.prepare(
    `INSERT INTO profile_products (id, profile_id, title, description, price, image_url, whatsapp_text, is_featured, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, profileId, title, description || null, price || null, image_url || null, whatsapp_text || null, is_featured, sortOrder).run()

  console.log(JSON.stringify({
    level: 'info', event: 'product_created',
    route: '/api/v1/me/products', userId, profileId, productId: id,
    requestId: c.req.header('cf-ray') || '',
  }))

  return c.json({ ok: true, id, sort_order: sortOrder }, 201)
})

me.put('/products/reorder', async (c) => {
  const userId = c.get('userId') as string
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Invalid JSON' }, 400) }
  const orderedIds: string[] = Array.isArray(body.orderedIds) ? body.orderedIds : []
  if (!orderedIds.length) return c.json({ ok: false, error: 'orderedIds array required' }, 400)

  const profile = await c.env.DB.prepare(
    `SELECT id FROM profiles WHERE user_id = ? LIMIT 1`
  ).bind(userId).first()
  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  await Promise.all(orderedIds.map((id, index) =>
    c.env.DB.prepare(
      `UPDATE profile_products SET sort_order = ? WHERE id = ? AND profile_id = ?`
    ).bind(index, id, (profile as any).id).run()
  ))
  return c.json({ ok: true })
})

me.put('/products/:id', async (c) => {
  const userId = c.get('userId') as string
  const productId = c.req.param('id')
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Invalid JSON' }, 400) }

  const profile = await c.env.DB.prepare(
    `SELECT id FROM profiles WHERE user_id = ? LIMIT 1`
  ).bind(userId).first()
  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  const title = body.title !== undefined ? String(body.title || '').trim() : undefined
  const description = body.description !== undefined ? String(body.description || '').trim() : undefined
  const price = body.price !== undefined ? String(body.price || '').trim() : undefined
  const image_url = body.image_url !== undefined ? String(body.image_url || '').trim() : undefined
  const whatsapp_text = body.whatsapp_text !== undefined ? String(body.whatsapp_text || '').trim() : undefined
  const is_featured = body.is_featured !== undefined ? (body.is_featured ? 1 : 0) : undefined

  await c.env.DB.prepare(
    `UPDATE profile_products SET
       title         = COALESCE(?1, title),
       description   = COALESCE(?2, description),
       price         = COALESCE(?3, price),
       image_url     = COALESCE(?4, image_url),
       whatsapp_text = COALESCE(?5, whatsapp_text),
       is_featured   = COALESCE(?6, is_featured)
     WHERE id = ?7 AND profile_id = ?8`
  ).bind(
    title ?? null, description ?? null, price ?? null,
    image_url ?? null, whatsapp_text ?? null, is_featured ?? null,
    productId, (profile as any).id,
  ).run()
  return c.json({ ok: true })
})

me.delete('/products/:id', async (c) => {
  const userId = c.get('userId') as string
  const productId = c.req.param('id')

  const profile = await c.env.DB.prepare(
    `SELECT id FROM profiles WHERE user_id = ? LIMIT 1`
  ).bind(userId).first()
  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  await c.env.DB.prepare(
    `DELETE FROM profile_products WHERE id = ? AND profile_id = ?`
  ).bind(productId, (profile as any).id).run()
  return c.json({ ok: true })
})

// ─── Videos ────────────────────────────────────────────────────────────────

me.get('/videos', async (c) => {
  const userId = c.get('userId') as string
  const profile = await c.env.DB.prepare(
    `SELECT id FROM profiles WHERE user_id = ? LIMIT 1`
  ).bind(userId).first()
  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  const videos = await c.env.DB.prepare(
    `SELECT id, title, url, sort_order, is_active FROM profile_videos
     WHERE profile_id = ? ORDER BY sort_order ASC`
  ).bind((profile as any).id).all()
  return c.json({ ok: true, data: videos.results })
})

me.post('/videos', async (c) => {
  const userId = c.get('userId') as string
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Invalid JSON' }, 400) }

  const title = String(body.title || '').trim()
  const url = String(body.url || '').trim()
  if (!url || !url.startsWith('http')) return c.json({ ok: false, error: 'valid url required' }, 400)

  const profile = await c.env.DB.prepare(
    `SELECT id FROM profiles WHERE user_id = ? LIMIT 1`
  ).bind(userId).first()
  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  const profileId = (profile as any).id

  const limitError = await checkPlanLimit(c as any, profileId, 'videos')
  if (limitError) return limitError

  const maxRow = await c.env.DB.prepare(
    `SELECT COALESCE(MAX(sort_order), -1) as mx FROM profile_videos WHERE profile_id = ?`
  ).bind(profileId).first()
  const sortOrder = ((maxRow as any)?.mx ?? -1) + 1

  const id = crypto.randomUUID()
  await c.env.DB.prepare(
    `INSERT INTO profile_videos (id, profile_id, title, url, sort_order) VALUES (?, ?, ?, ?, ?)`
  ).bind(id, profileId, title || url, url, sortOrder).run()

  console.log(JSON.stringify({
    level: 'info', event: 'video_created',
    route: '/api/v1/me/videos', userId, profileId, videoId: id,
    requestId: c.req.header('cf-ray') || '',
  }))

  return c.json({ ok: true, id, sort_order: sortOrder }, 201)
})

me.put('/videos/:id', async (c) => {
  const userId = c.get('userId') as string
  const videoId = c.req.param('id')
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Invalid JSON' }, 400) }

  const profile = await c.env.DB.prepare(
    `SELECT id FROM profiles WHERE user_id = ? LIMIT 1`
  ).bind(userId).first()
  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  const title = body.title !== undefined ? String(body.title || '').trim() : undefined
  const url = body.url !== undefined ? String(body.url || '').trim() : undefined
  const is_active = body.is_active !== undefined ? (body.is_active ? 1 : 0) : undefined

  await c.env.DB.prepare(
    `UPDATE profile_videos SET
       title     = COALESCE(?1, title),
       url       = COALESCE(?2, url),
       is_active = COALESCE(?3, is_active)
     WHERE id = ?4 AND profile_id = ?5`
  ).bind(title ?? null, url ?? null, is_active ?? null, videoId, (profile as any).id).run()
  return c.json({ ok: true })
})

me.delete('/videos/:id', async (c) => {
  const userId = c.get('userId') as string
  const videoId = c.req.param('id')

  const profile = await c.env.DB.prepare(
    `SELECT id FROM profiles WHERE user_id = ? LIMIT 1`
  ).bind(userId).first()
  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  await c.env.DB.prepare(
    `DELETE FROM profile_videos WHERE id = ? AND profile_id = ?`
  ).bind(videoId, (profile as any).id).run()
  return c.json({ ok: true })
})

// ─── Orden de bloques y configuración visual ───────────────────────────────

me.patch('/profile/blocks-order', async (c) => {
  const userId = c.get('userId') as string
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Invalid JSON' }, 400) }

  const VALID_BLOCKS = ['links', 'faqs', 'products', 'video', 'gallery']
  const blocks: string[] = Array.isArray(body.blocks_order)
    ? body.blocks_order.filter((b: any) => VALID_BLOCKS.includes(String(b)))
    : []
  if (!blocks.length) return c.json({ ok: false, error: 'blocks_order array required' }, 400)

  const profile = await c.env.DB.prepare(
    `SELECT id FROM profiles WHERE user_id = ? LIMIT 1`
  ).bind(userId).first()
  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  await c.env.DB.prepare(
    `UPDATE profiles SET blocks_order = ?, updated_at = datetime('now') WHERE id = ?`
  ).bind(JSON.stringify(blocks), (profile as any).id).run()
  return c.json({ ok: true, blocks_order: blocks })
})

me.patch('/profile/visual', async (c) => {
  const userId = c.get('userId') as string
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Invalid JSON' }, 400) }

  const VALID_BUTTON_STYLES = ['rounded', 'pill', 'square', 'outline']
  const VALID_VISUAL_THEMES = ['default', 'light', 'modern', 'bento', 'classic', 'ocean', 'sunset', 'midnight']
  const accent_color = body.accent_color !== undefined ? String(body.accent_color || '').trim() : undefined
  const button_style = body.button_style !== undefined &&
    VALID_BUTTON_STYLES.includes(String(body.button_style))
    ? String(body.button_style) : undefined
  const theme_id = body.theme_id !== undefined && VALID_VISUAL_THEMES.includes(String(body.theme_id))
    ? String(body.theme_id) : undefined

  if (accent_color !== undefined && !/^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$/.test(accent_color))
    return c.json({ ok: false, error: 'accent_color debe ser un hex válido (#RGB o #RRGGBB)' }, 400)

  const profile = await c.env.DB.prepare(
    `SELECT id FROM profiles WHERE user_id = ? LIMIT 1`
  ).bind(userId).first()
  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  await c.env.DB.prepare(
    `UPDATE profiles SET
       accent_color = COALESCE(?1, accent_color),
       button_style = COALESCE(?2, button_style),
       theme_id     = COALESCE(?3, theme_id),
       updated_at   = datetime('now')
     WHERE id = ?4`
  ).bind(accent_color ?? null, button_style ?? null, theme_id ?? null, (profile as any).id).run()
  return c.json({ ok: true })
})

// ─── GET /api/v1/me/plan-impact-preview?target=<plan_id> ─────────────────────
// Simula el impacto de un downgrade al plan `target` sin aplicar ningún cambio.
// Responde: qué recursos quedan activos, cuáles se pausan, si hace falta selección.

me.get('/plan-impact-preview', async (c) => {
  const userId = c.get('userId') as string
  const targetPlanId = (c.req.query('target') || 'free').trim().toLowerCase()

  const VALID_PLANS = ['free', 'starter', 'pro', 'agency']
  if (!VALID_PLANS.includes(targetPlanId)) {
    return c.json({ ok: false, error: `target must be one of: ${VALID_PLANS.join(', ')}` }, 400)
  }

  const profile = await c.env.DB.prepare(
    `SELECT id, plan_id FROM profiles WHERE user_id = ? LIMIT 1`
  ).bind(userId).first()
  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  const profileId    = (profile as any).id
  const currentPlanId = (profile as any).plan_id

  // Límites del plan objetivo (sin módulos — simulación base)
  const targetLimits = await c.env.DB.prepare(
    `SELECT max_links, max_photos, max_faqs, max_products, max_videos, can_use_vcard
     FROM plan_limits WHERE plan_id = ?`
  ).bind(targetPlanId).first()

  if (!targetLimits) return c.json({ ok: false, error: 'Plan no encontrado' }, 404)

  const tl = targetLimits as any
  const simEnts = {
    maxLinks:    Number(tl.max_links),
    maxPhotos:   Number(tl.max_photos),
    maxFaqs:     Number(tl.max_faqs),
    maxProducts: Number(tl.max_products ?? 3),
    maxVideos:   Number(tl.max_videos   ?? 1),
    canUseVCard: Boolean(tl.can_use_vcard),
  }

  // Recursos actuales ordenados por sort_order (determina cuáles quedan activos)
  const [linksRes, photosRes, faqsRes, productsRes, videosRes, currentEnts] = await Promise.all([
    c.env.DB.prepare(`SELECT id, label FROM profile_links   WHERE profile_id = ? ORDER BY sort_order ASC`).bind(profileId).all(),
    c.env.DB.prepare(`SELECT id FROM profile_gallery         WHERE profile_id = ? ORDER BY sort_order ASC`).bind(profileId).all(),
    c.env.DB.prepare(`SELECT id, question FROM profile_faqs  WHERE profile_id = ? ORDER BY sort_order ASC`).bind(profileId).all(),
    c.env.DB.prepare(`SELECT id, title FROM profile_products WHERE profile_id = ? ORDER BY sort_order ASC`).bind(profileId).all(),
    c.env.DB.prepare(`SELECT id, title FROM profile_videos   WHERE profile_id = ? ORDER BY sort_order ASC`).bind(profileId).all(),
    getEntitlements(c, profileId).catch(() => null),
  ])

  const buildImpact = (items: any[], allowed: number, labelField = 'id') => ({
    total:              items.length,
    active:             items.slice(0, allowed).map(i => ({ id: i.id, label: (i[labelField] ?? i.id) || i.id })),
    paused:             items.slice(allowed).map(i => ({ id: i.id, label: (i[labelField] ?? i.id) || i.id })),
    exceeds_plan:       items.length > allowed,
    requires_selection: items.length > allowed,
  })

  const links    = buildImpact(linksRes.results    as any[], simEnts.maxLinks,    'label')
  const photos   = buildImpact(photosRes.results   as any[], simEnts.maxPhotos)
  const faqs     = buildImpact(faqsRes.results     as any[], simEnts.maxFaqs,    'question')
  const products = buildImpact(productsRes.results as any[], simEnts.maxProducts, 'title')
  const videos   = buildImpact(videosRes.results   as any[], simEnts.maxVideos,   'title')

  const totalToPause =
    links.paused.length + photos.paused.length + faqs.paused.length +
    products.paused.length + videos.paused.length

  return c.json({
    ok: true,
    data: {
      current_plan: currentPlanId,
      target_plan:  targetPlanId,
      is_downgrade: currentPlanId !== targetPlanId,
      target_limits: simEnts,
      resources: { links, photos, faqs, products, videos },
      modules: {
        // Módulos pagos se conservan independientemente del plan base
        loses_vcard: !!(currentEnts?.canUseVCard && !simEnts.canUseVCard),
      },
      summary: {
        items_to_pause:     totalToPause,
        requires_selection: totalToPause > 0,
      },
    },
  })
})

// ─── POST /api/v1/me/retention/selection ─────────────────────────────────────
// El usuario selecciona qué recursos mantener activos dentro del límite del plan.
// Regla: los `keep_ids` se reordenan a sort_order 0,1,2,... (quedan "activos").
// Los demás se empujan más allá del límite (quedan "bloqueados pero conservados").
// Nunca borra datos. Solo reordena.
//
// Body: { resource: 'links'|'faqs'|'products'|'videos'|'photos', keep_ids: string[] }

me.post('/retention/selection', async (c) => {
  const userId = c.get('userId') as string
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Invalid JSON' }, 400) }

  const VALID_RESOURCES = ['links', 'faqs', 'products', 'videos', 'photos'] as const
  type ResourceType = typeof VALID_RESOURCES[number]

  const resource = String(body.resource || '').trim() as ResourceType
  const keepIds  = Array.isArray(body.keep_ids) ? (body.keep_ids as string[]).filter(Boolean) : null

  if (!VALID_RESOURCES.includes(resource)) {
    return c.json({ ok: false, error: `resource must be one of: ${VALID_RESOURCES.join(', ')}` }, 400)
  }
  if (!keepIds || keepIds.length === 0) {
    return c.json({ ok: false, error: 'keep_ids array required (must have at least one item)' }, 400)
  }

  const profile = await c.env.DB.prepare(
    `SELECT id FROM profiles WHERE user_id = ? LIMIT 1`
  ).bind(userId).first()
  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)
  const profileId = (profile as any).id

  // Validar contra el plan vigente
  let ents: Awaited<ReturnType<typeof getEntitlements>>
  try {
    ents = await getEntitlements(c, profileId)
  } catch (e) {
    return c.json({ ok: false, error: 'Error loading plan entitlements' }, 500)
  }

  const LIMIT_MAP: Record<ResourceType, number> = {
    links:    ents.maxLinks,
    faqs:     ents.maxFaqs,
    products: ents.maxProducts,
    videos:   ents.maxVideos,
    photos:   ents.maxPhotos,
  }
  const TABLE_MAP: Record<ResourceType, string> = {
    links:    'profile_links',
    faqs:     'profile_faqs',
    products: 'profile_products',
    videos:   'profile_videos',
    photos:   'profile_gallery',
  }

  const allowed = LIMIT_MAP[resource]
  if (keepIds.length > allowed) {
    return c.json({
      ok: false,
      error: `keep_ids count (${keepIds.length}) exceeds plan limit (${allowed}) for ${resource}`,
      limit: allowed,
    }, 422)
  }

  const table = TABLE_MAP[resource]

  // Obtener todos los IDs actuales del recurso (order by sort_order)
  const allItems = await c.env.DB.prepare(
    `SELECT id FROM ${table} WHERE profile_id = ? ORDER BY sort_order ASC`
  ).bind(profileId).all()
  const allIds = (allItems.results as any[]).map(r => r.id)

  // Verificar ownership de todos los keep_ids
  const allIdsSet = new Set(allIds)
  const invalidId = keepIds.find(id => !allIdsSet.has(id))
  if (invalidId) {
    return c.json({ ok: false, error: `ID ${invalidId} not found or not owned by this profile` }, 400)
  }

  // Nueva ordenación: keep_ids primero (0,1,2,...), el resto en su orden original
  const keepIdsSet  = new Set(keepIds)
  const remainingIds = allIds.filter(id => !keepIdsSet.has(id))
  const newOrdering  = [...keepIds, ...remainingIds]

  // Actualizar sort_order de todos los ítems
  await Promise.all(newOrdering.map((id, index) =>
    c.env.DB.prepare(
      `UPDATE ${table} SET sort_order = ? WHERE id = ? AND profile_id = ?`
    ).bind(index, id, profileId).run()
  ))

  // Auditoría (fire-and-forget)
  logPlanEvent(c.env.DB, {
    profileId,
    eventType: 'retention_selection',
    triggeredBy: userId,
    eventData: {
      resource,
      keep_ids:        keepIds,
      beyond_plan_ids: newOrdering.slice(allowed),
      allowed,
      total:           allIds.length,
    },
  }).catch(() => { })

  return c.json({
    ok: true,
    data: {
      resource,
      active_ids:    keepIds,
      paused_ids:    newOrdering.slice(allowed),
      allowed,
      total:         allIds.length,
    },
  })
})

// Mount the authenticated sub-app

// Galería autenticada del perfil propio.
// No acepta profileId desde frontend: resuelve el perfil por sesión.
me.get('/gallery', async (c) => {
  const userId = c.get('userId') as string

  const profile = await c.env.DB.prepare(
    `SELECT id FROM profiles WHERE user_id = ? LIMIT 1`
  ).bind(userId).first()

  if (!profile) {
    return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)
  }

  const profileId = (profile as any).id

  const photos = await c.env.DB.prepare(
    `SELECT * FROM profile_gallery WHERE profile_id = ? ORDER BY sort_order ASC`
  )
    .bind(profileId)
    .all()

  return c.json({ ok: true, photos: photos.results })
})


app.route('/api/v1/me', me)

// ─── GET /api/v1/entitlements ─────────────────────────────────────────────────
// Endpoint dedicado de entitlements con estado completo de retención.
// Requiere sesión autenticada. Devuelve límites vigentes + estado funcional
// de todos los recursos (activos, excedidos, módulos pausados, etc.).

app.get('/api/v1/entitlements', requireAuth, async (c) => {
  const userId = c.get('userId') as string

  const profile = await c.env.DB.prepare(
    `SELECT id, plan_id FROM profiles WHERE user_id = ? LIMIT 1`
  ).bind(userId).first()
  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  const profileId = (profile as any).id

  let ents: Awaited<ReturnType<typeof getEntitlements>>
  try {
    ents = await getEntitlements(c, profileId)
  } catch (e) {
    console.error('[GET /api/v1/entitlements] error:', String(e))
    return c.json({ ok: false, error: 'Error loading entitlements' }, 500)
  }

  const retention = await getRetentionStatus(c, profileId, ents).catch(e => {
    console.warn('[GET /api/v1/entitlements] retention status failed:', String(e))
    return null
  })

  return c.json({
    ok: true,
    data: {
      // Límites vigentes (plan + módulos + overrides)
      limits: {
        max_links:     ents.maxLinks,
        max_photos:    ents.maxPhotos,
        max_faqs:      ents.maxFaqs,
        max_products:  ents.maxProducts,
        max_videos:    ents.maxVideos,
        can_use_vcard: ents.canUseVCard,
      },
      // Uso actual + estado de retención por recurso
      resources: retention?.resources ?? null,
      // Módulos pagos vencidos (conservados pero no activos)
      paused_modules: retention?.paused_modules ?? [],
      // Flags de alerta
      requires_selection:      retention?.requires_selection      ?? false,
      paused_features_count:   retention?.paused_features_count   ?? 0,
      recoverable_items_count: retention?.recoverable_items_count ?? 0,
      // Trial / plan info
      plan_code:               retention?.plan_code               ?? (profile as any).plan_id,
      trial_status:            retention?.trial_status            ?? 'none',
      trial_expires_at:        retention?.trial_expires_at        ?? null,
      downgrade_effective_at:  retention?.downgrade_effective_at  ?? null,
    },
  })
})

// ─── Profile/me — authenticated profile data ──────────────────────────────

app.get('/api/v1/profile/me/:profileId', requireAuth, async (c) => {
  const userId = c.get('userId') as string
  const profileId = c.req.param('profileId')

  const profile = await c.env.DB.prepare(
    `SELECT id, slug, name, bio, theme_id, accent_color, button_style,
            avatar_url, is_published, category, subcategory, blocks_order
     FROM profiles WHERE id = ?1 AND user_id = ?2 LIMIT 1`
  ).bind(profileId, userId).first()
  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  const p = profile as any
  const [linksRes, galleryRes, faqsRes, ents] = await Promise.all([
    c.env.DB.prepare(
      `SELECT id, label, url, sort_order, is_active, is_cta FROM profile_links
       WHERE profile_id = ?1 ORDER BY sort_order ASC`
    ).bind(p.id).all(),
    c.env.DB.prepare(
      `SELECT id, image_key, sort_order FROM profile_gallery
       WHERE profile_id = ?1 ORDER BY sort_order ASC`
    ).bind(p.id).all(),
    c.env.DB.prepare(
      `SELECT id, question, answer, sort_order FROM profile_faqs
       WHERE profile_id = ?1 ORDER BY sort_order ASC`
    ).bind(p.id).all(),
    getEntitlements(c, p.id).catch(() => ({
      maxLinks: 5, maxPhotos: 3, maxFaqs: 3, maxProducts: 3, maxVideos: 1, canUseVCard: false
    })),
  ])

  return c.json({
    ok: true,
    data: {
      ...p,
      links: linksRes.results,
      gallery: galleryRes.results,
      faqs: faqsRes.results,
      entitlements: ents,
    },
  })
})

// ─── Leads (authenticated owner) ─────────────────────────────────────────

app.get('/api/v1/profile/me/:profileId/leads', requireAuth, async (c) => {
  const userId = c.get('userId') as string
  const profileId = c.req.param('profileId')

  const profile = await c.env.DB.prepare(
    `SELECT slug FROM profiles WHERE id = ?1 AND user_id = ?2 LIMIT 1`
  ).bind(profileId, userId).first()
  if (!profile) return c.json({ ok: false, error: 'Forbidden' }, 403)

  const { status, origin, from, to } = c.req.query()

  const { tag } = c.req.query()

  const allLeads = await c.env.DB.prepare(
    `SELECT id, name, email, phone, message,
            COALESCE(origin, source_url) as origin,
            COALESCE(status, 'new') as status,
            COALESCE(tags, '[]') as tags,
            created_at
     FROM leads WHERE profile_slug = ?1
     ORDER BY created_at DESC LIMIT 500`
  ).bind((profile as any).slug).all()

  let data = (allLeads.results as any[]).map(l => ({
    ...l,
    tags: (() => { try { return JSON.parse(l.tags) } catch { return [] } })(),
  }))

  if (status) data = data.filter(l => l.status === status)
  if (origin) data = data.filter(l => (l.origin || '').toLowerCase().includes(origin.toLowerCase()))
  if (from) data = data.filter(l => l.created_at >= from)
  if (to) data = data.filter(l => l.created_at <= to + 'T23:59:59')
  if (tag) data = data.filter(l => l.tags.includes(tag))

  return c.json({ ok: true, data })
})

app.patch('/api/v1/profile/me/:profileId/leads/:leadId', requireAuth, async (c) => {
  const userId = c.get('userId') as string
  const profileId = c.req.param('profileId')
  const leadId = c.req.param('leadId')

  const profile = await c.env.DB.prepare(
    `SELECT slug FROM profiles WHERE id = ?1 AND user_id = ?2 LIMIT 1`
  ).bind(profileId, userId).first()
  if (!profile) return c.json({ ok: false, error: 'Forbidden' }, 403)

  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Invalid JSON' }, 400) }

  const VALID_STATUSES = ['new', 'contacted', 'closed', 'discarded']
  const updates: string[] = []
  const params: any[] = []

  if (body.status !== undefined) {
    const newStatus = String(body.status || '').trim()
    if (!VALID_STATUSES.includes(newStatus))
      return c.json({ ok: false, error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, 400)
    updates.push(`status = ?${params.push(newStatus)}`)
  }

  if (body.tags !== undefined) {
    const tags = Array.isArray(body.tags)
      ? body.tags.map((t: any) => String(t).trim().slice(0, 32)).filter(Boolean)
      : []
    updates.push(`tags = ?${params.push(JSON.stringify(tags))}`)
  }

  if (updates.length === 0) return c.json({ ok: false, error: 'Nothing to update' }, 400)

  params.push(leadId, (profile as any).slug)
  await c.env.DB.prepare(
    `UPDATE leads SET ${updates.join(', ')} WHERE id = ?${params.length - 1} AND profile_slug = ?${params.length}`
  ).bind(...params).run()

  return c.json({ ok: true })
})

app.get('/api/v1/profile/me/:profileId/leads/export', requireAuth, async (c) => {
  const userId = c.get('userId') as string
  const profileId = c.req.param('profileId')

  const profile = await c.env.DB.prepare(
    `SELECT slug, name FROM profiles WHERE id = ?1 AND user_id = ?2 LIMIT 1`
  ).bind(profileId, userId).first()
  if (!profile) return c.json({ ok: false, error: 'Forbidden' }, 403)

  const { status: fStatus, origin: fOrigin, from: fFrom, to: fTo, tag: fTag } = c.req.query()

  const allLeads = await c.env.DB.prepare(
    `SELECT name, email, phone, message,
            COALESCE(origin, source_url, '') as origin,
            COALESCE(status, 'new') as status,
            COALESCE(tags, '[]') as tags,
            created_at
     FROM leads WHERE profile_slug = ?1
     ORDER BY created_at DESC`
  ).bind((profile as any).slug).all()

  let filtered = (allLeads.results as any[]).map(l => ({
    ...l, tags: (() => { try { return JSON.parse(l.tags) } catch { return [] } })(),
  }))
  if (fStatus) filtered = filtered.filter(l => l.status === fStatus)
  if (fOrigin) filtered = filtered.filter(l => l.origin.toLowerCase().includes(fOrigin.toLowerCase()))
  if (fFrom) filtered = filtered.filter(l => l.created_at >= fFrom)
  if (fTo) filtered = filtered.filter(l => l.created_at <= fTo + 'T23:59:59')
  if (fTag) filtered = filtered.filter(l => l.tags.includes(fTag))

  const header = 'Nombre,Email,Teléfono,Mensaje,Origen,Estado,Etiquetas,Fecha\r\n'
  const rows = filtered.map(l => {
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
    return [esc(l.name), esc(l.email), esc(l.phone), esc(l.message),
    esc(l.origin), esc(l.status), esc(l.tags.join('; ')), esc(l.created_at)].join(',')
  }).join('\r\n')

  const slug = (profile as any).slug
  return new Response(header + rows, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="leads-${slug}.csv"`,
    },
  })
})

// ─── Analíticas ───────────────────────────────────────────────────────────

app.post('/api/v1/public/track', async (c) => {
  try {
    const { profileId, eventType, targetId } = await c.req.json()

    const allowedEvents = new Set(['view', 'click'])
    if (!profileId || typeof profileId !== 'string') {
      return c.json({ ok: false, error: 'profileId requerido' }, 400)
    }
    if (!allowedEvents.has(eventType)) {
      return c.json({ ok: false, error: 'eventType no permitido' }, 400)
    }
    if (targetId != null && typeof targetId !== 'string') {
      return c.json({ ok: false, error: 'targetId inválido' }, 400)
    }

    const profile = await c.env.DB.prepare(
      `SELECT id FROM profiles WHERE id = ? AND is_active = 1 AND is_published = 1 LIMIT 1`
    ).bind(profileId).first()

    if (!profile) {
      return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)
    }

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

app.get('/api/v1/profile/stats/:profileId', requireAuth, async (c) => {
  const userId = c.get('userId') as string
  const profileId = c.req.param('profileId')

  const profile = await c.env.DB.prepare(
    `SELECT id FROM profiles WHERE id = ? AND user_id = ? LIMIT 1`
  ).bind(profileId, userId).first()

  if (!profile) {
    return c.json({ ok: false, error: 'Forbidden' }, 403)
  }

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

app.post('/api/v1/profile/gallery/upload', requireAuth, async (c) => {
  const userId = c.get('userId') as string

  // Resolve profile from session — NEVER trust profileId from frontend
  const profile = await c.env.DB.prepare(
    `SELECT id FROM profiles WHERE user_id = ? LIMIT 1`
  ).bind(userId).first()
  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  const profileId = (profile as any).id

  // Check plan limit BEFORE uploading to R2 to avoid wasting storage
  const limitError = await checkPlanLimit(c as any, profileId, 'photos')
  if (limitError) return limitError

  const fd = await c.req.formData()
  const fileVal = fd.get('file')

  if (!(fileVal && typeof fileVal === 'object' && 'name' in (fileVal as any) && 'stream' in (fileVal as any))) {
    return c.json({ ok: false, error: 'No file' }, 400)
  }

  const file = fileVal as any as File
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif']
  if (!ALLOWED_EXTS.includes(ext)) return c.json({ ok: false, error: 'Formato no permitido' }, 400)

  const key = `profiles/${profileId}/${crypto.randomUUID()}-${file.name}`
  await c.env.BUCKET.put(key, file.stream(), {
    httpMetadata: { contentType: file.type || 'image/jpeg' },
  })

  const id = crypto.randomUUID()
  await c.env.DB.prepare(
    `INSERT INTO profile_gallery (id, profile_id, image_key, sort_order) VALUES (?, ?, ?, 0)`
  ).bind(id, profileId, key).run()

  console.log(JSON.stringify({
    level: 'info', event: 'gallery_upload_success',
    route: '/api/v1/profile/gallery/upload', userId, profileId, key,
    requestId: c.req.header('cf-ray') || '',
  }))

  return c.json({ ok: true, id, key })
})

app.get('/api/v1/profile/gallery/:profileId', requireAuth, async (c) => {
  const userId = c.get('userId') as string
  const profileId = c.req.param('profileId')

  const profile = await c.env.DB.prepare(
    `SELECT id FROM profiles WHERE id = ? AND user_id = ? LIMIT 1`
  ).bind(profileId, userId).first()

  if (!profile) {
    return c.json({ ok: false, error: 'Forbidden' }, 403)
  }

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
  const slug = c.req.param('slug')
  const isPreview = c.req.query('preview') === '1'

  const profile = await c.env.DB.prepare(
    'SELECT id, slug, plan_id, theme_id, is_published, name, bio, avatar_url, whatsapp_number, blocks_order, accent_color, button_style, template_id, template_data FROM profiles WHERE slug = ?'
  )
    .bind(slug)
    .first()

  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)

  // Allow owner to preview unpublished profiles
  if (!(profile as any).is_published) {
    let isOwner = false
    if (isPreview) {
      try {
        const rawSession = parseCookie(c.req.header('Cookie') || '', 'session_id')
        if (rawSession) {
          const sessionHash = await sha256Hex(rawSession)
          const session = await c.env.DB.prepare(
            `SELECT user_id FROM auth_sessions WHERE session_hash = ? AND expires_at > datetime('now') AND revoked_at IS NULL LIMIT 1`
          ).bind(sessionHash).first()
          if (session) {
            const ownerCheck = await c.env.DB.prepare(
              `SELECT id FROM profiles WHERE id = ? AND user_id = ? LIMIT 1`
            ).bind((profile as any).id, (session as any).user_id).first()
            isOwner = !!ownerCheck
          }
        }
      } catch { /* ignore auth errors */ }
    }
    if (!isOwner) return c.json({ ok: false, error: 'Perfil no disponible' }, 404)
  }

  const [links, rawGallery, rawFaqs, rawProducts, rawVideos, entitlements, rawSocialLinks, rawContact] = await Promise.all([
    c.env.DB.prepare(
      'SELECT id, label, url, is_cta FROM profile_links WHERE profile_id = ? AND is_active = 1 ORDER BY sort_order ASC'
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
    c.env.DB.prepare(
      'SELECT id, title, url, sort_order FROM profile_videos WHERE profile_id = ? AND is_active = 1 ORDER BY sort_order ASC'
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

  const origin = new URL(c.req.url).origin
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

  let blocksOrder: string[]
  try {
    blocksOrder = JSON.parse((profile as any).blocks_order || '["links","faqs","products","video","gallery"]')
  } catch {
    blocksOrder = ['links', 'faqs', 'products', 'video', 'gallery']
  }

  return c.json({
    ok: true,
    data: {
      profileId: (profile as any).id,
      slug: (profile as any).slug,
      planId: (profile as any).plan_id,
      themeId: (profile as any).theme_id,
      accentColor: (profile as any).accent_color ?? '#3B82F6',
      buttonStyle: (profile as any).button_style ?? 'rounded',
      blocksOrder,
      name: (profile as any).name,
      bio: (profile as any).bio,
      avatarUrl: toAssetUrl((profile as any).avatar_url || ''),
      whatsapp_number: (profile as any).whatsapp_number ?? null,
      templateId: (profile as any).template_id ?? null,
      templateData: (() => { try { return JSON.parse((profile as any).template_data || '{}') } catch { return {} } })(),
      social_links: rawSocialLinks.results,
      links: links.results,
      gallery,
      faqs: rawFaqs.results,
      products,
      videos: rawVideos.results,
      featured_product,
      entitlements,
      contact: rawContact ? {
        whatsapp: (rawContact as any).whatsapp ?? null,
        email: (rawContact as any).email ?? null,
        phone: (rawContact as any).phone ?? null,
        hours: (rawContact as any).hours ?? null,
        address: (rawContact as any).address ?? null,
        map_url: (rawContact as any).map_url ?? null,
      } : null,
    },
  })
})

// ─── vCard ────────────────────────────────────────────────────────────────

app.get('/api/v1/public/vcard/:profileId', async (c) => {
  const profileId = c.req.param('profileId')

  const [profile, contactRow, entitlements] = await Promise.all([
    c.env.DB.prepare(
      'SELECT slug, name, bio, whatsapp_number FROM profiles WHERE id = ? AND is_active = 1 AND is_published = 1'
    ).bind(profileId).first() as Promise<{ slug: string; name: string | null; bio: string | null; whatsapp_number: string | null } | null>,
    c.env.DB.prepare(
      'SELECT whatsapp, phone, email, address FROM profile_contact WHERE profile_id = ? LIMIT 1'
    ).bind(profileId).first() as Promise<{ whatsapp: string | null; phone: string | null; email: string | null; address: string | null } | null>,
    getEntitlements(c, profileId),
  ])

  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)
  if (!(entitlements as any)?.canUseVCard) {
    return c.json({ ok: false, error: 'vCard no disponible para este plan' }, 403)
  }

  const telNumber = profile.whatsapp_number || contactRow?.whatsapp || contactRow?.phone || null
  const fn = profile.name || profile.slug
  const profileUrl = `${(c.env as any).API_URL || 'https://intaprd.com'}/${profile.slug}`

  const lines: string[] = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${fn}`,
    `N:${fn};;;`,
  ]
  if (telNumber) lines.push(`TEL;TYPE=CELL:${telNumber}`)
  if (contactRow?.email) lines.push(`EMAIL:${contactRow.email}`)
  if (contactRow?.address) lines.push(`ADR;TYPE=WORK:;;${contactRow.address};;;;`)
  if (profile.bio) lines.push(`NOTE:${profile.bio.replace(/\n/g, '\\n')}`)
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

// ─── Waitlist ─────────────────────────────────────────────────────────────

const WAITLIST_MODES = ['Virtual', 'Fisica', 'Mixta'] as const

app.post('/api/v1/public/waitlist', async (c) => {
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Invalid JSON' }, 400) }

  const email = String(body.email || '').trim().toLowerCase()
  const name = String(body.name || '').trim()
  const sector = String(body.sector || '').trim()
  const mode = String(body.mode || '').trim()

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return c.json({ ok: false, error: 'valid email required' }, 400)
  if (!name || name.length < 2) return c.json({ ok: false, error: 'name required (min 2 chars)' }, 400)
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

  const posRow = await c.env.DB.prepare(`SELECT COUNT(*) as n FROM waitlist`).first()
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

  const origin = String(body.origin || source_url || '').trim()

  await c.env.DB.prepare(
    `INSERT INTO leads (profile_slug, name, email, phone, message, source_url, origin, user_agent, ip_hash, status)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'new')`
  ).bind(profile_slug, name, email, phone, message, source_url, origin || null, ua, ip_hash).run()

  await c.env.DB.prepare(
    `INSERT INTO lead_rate_limits (profile_slug, ip_hash) VALUES (?1, ?2)`
  ).bind(profile_slug, ip_hash).run()

  // Notify profile owner (non-blocking)
  if ((c.env as any).RESEND_API_KEY) {
    c.env.DB.prepare(
      `SELECT u.email FROM users u JOIN profiles p ON p.user_id = u.id WHERE p.slug = ?1 LIMIT 1`
    ).bind(profile_slug).first().then(async (ownerRow: any) => {
      if (!ownerRow?.email) return
      const { sendLeadNotificationEmail } = await import('./lib/email')
      await sendLeadNotificationEmail(c.env as any, ownerRow.email, { name, email, phone, message, origin })
        .catch(() => { })
    }).catch(() => { })
  }

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
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  const bytes = new Uint8Array(hash)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

// ─── Admin ────────────────────────────────────────────────────────────────

app.get('/api/v1/admin/db-check', async (c) => {
  const key = c.req.header('X-Admin-Key') || c.req.query('key') || ''
  const adminApiKey = String((c.env as any).ADMIN_API_KEY || '')
  if (!adminApiKey) return c.json({ ok: false, error: 'Admin API key not configured' }, 503)
  if (key !== adminApiKey) return c.json({ ok: false, error: 'Forbidden' }, 403)

  const issues: string[] = []
  const checks: Record<string, any> = {}

  // ── 1. Columnas requeridas en profiles ────────────────────────────────────
  const REQUIRED_PROFILE_COLS = [
    'id', 'user_id', 'slug', 'plan_id', 'theme_id',
    'name', 'bio', 'is_published', 'created_at',
    'avatar_url', 'category', 'subcategory', 'updated_at',
    'whatsapp_number', 'is_active',
  ]
  try {
    const info = await c.env.DB.prepare(`PRAGMA table_info(profiles)`).all()
    const existing = new Set((info.results as any[]).map((r) => r.name))
    const missing = REQUIRED_PROFILE_COLS.filter((col) => !existing.has(col))
    checks.profiles_columns = {
      ok: missing.length === 0,
      present: [...existing],
      missing,
    }
    if (missing.length > 0) issues.push(`profiles falta columnas: ${missing.join(', ')}`)
  } catch (err) {
    checks.profiles_columns = { ok: false, error: String(err) }
    issues.push(`No se pudo leer schema de profiles: ${err}`)
  }

  // ── 2. Tablas huérfanas (indicador de migración rota) ─────────────────────
  try {
    const orphans = await c.env.DB.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'profiles_%'`
    ).all()
    const found = (orphans.results as any[]).map((r) => r.name).filter((n) => n !== 'profile_links' &&
      n !== 'profile_contact' && n !== 'profile_gallery' &&
      n !== 'profile_faqs' && n !== 'profile_products' &&
      n !== 'profile_social_links' && n !== 'profile_modules')
    checks.orphan_tables = { ok: found.length === 0, found }
    if (found.length > 0) issues.push(`Tablas huérfanas: ${found.join(', ')}`)
  } catch (err) {
    checks.orphan_tables = { ok: false, error: String(err) }
  }

  // ── 3. Plan 'free' en plans + plan_limits ─────────────────────────────────
  try {
    const plan = await c.env.DB.prepare(`SELECT id FROM plans WHERE id='free'`).first()
    const limits = await c.env.DB.prepare(`SELECT plan_id FROM plan_limits WHERE plan_id='free'`).first()
    checks.free_plan = {
      ok: !!plan && !!limits,
      plan_row: !!plan,
      limits_row: !!limits,
    }
    if (!plan) issues.push(`Plan 'free' no existe en plans`)
    if (!limits) issues.push(`Plan 'free' no tiene row en plan_limits`)
  } catch (err) {
    checks.free_plan = { ok: false, error: String(err) }
    issues.push(`Error chequeando plan free: ${err}`)
  }

  // ── 4. Tablas de auth presentes ───────────────────────────────────────────
  const AUTH_TABLES = ['users', 'auth_magic_links', 'auth_sessions', 'auth_identities']
  const authStatus: Record<string, boolean> = {}
  for (const t of AUTH_TABLES) {
    try {
      await c.env.DB.prepare(`SELECT 1 FROM ${t} LIMIT 1`).first()
      authStatus[t] = true
    } catch {
      authStatus[t] = false
      issues.push(`Tabla auth faltante: ${t}`)
    }
  }
  checks.auth_tables = { ok: Object.values(authStatus).every(Boolean), tables: authStatus }

  // ── 5. Conteos rápidos ────────────────────────────────────────────────────
  try {
    const [users, profiles] = await Promise.all([
      c.env.DB.prepare(`SELECT COUNT(*) as n FROM users`).first(),
      c.env.DB.prepare(`SELECT COUNT(*) as n FROM profiles`).first(),
    ])
    checks.counts = {
      users: (users as any)?.n ?? 0,
      profiles: (profiles as any)?.n ?? 0,
    }
  } catch (err) {
    checks.counts = { error: String(err) }
  }

  const allOk = issues.length === 0
  return c.json({
    ok: allOk,
    status: allOk ? 'healthy' : 'degraded',
    issues,
    checks,
  }, allOk ? 200 : 200) // siempre 200 para que CC pueda leer el body
})

app.get('/api/v1/admin/profiles', requireAdmin, async (c) => {
  const profiles = await c.env.DB.prepare(
    `SELECT p.id, p.slug, p.plan_id, p.is_published, u.email FROM profiles p JOIN users u ON p.user_id = u.id`
  ).all()
  return c.json({ ok: true, data: profiles.results })
})

app.post('/api/v1/admin/activate-module', async (c) => {
  return c.json({
    ok: false,
    error: 'Deprecated endpoint',
    message: 'Use Super Admin RBAC endpoints instead.',
  }, 410)
})

// ─── Super Admin — Fase 7.2A (solo lectura) ──────────────────────────────────
// Todos los endpoints requieren rol mínimo 'viewer' salvo que se indique otro.
// URL base: /api/v1/superadmin/

// ── GET /api/v1/superadmin/subscribers ────────────────────────────────────────
// Lista paginada de suscriptores (usuario + perfil + plan).
// Query params: page (default 1), limit (default 25, max 100),
//               plan (plan_id filter), status ('active'|'inactive'),
//               q (search by email or slug, case-insensitive).
app.get('/api/v1/superadmin/subscribers', requireSuperAdmin('viewer'), async (c) => {
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '25', 10)))
  const plan = (c.req.query('plan') || '').trim()
  const status = (c.req.query('status') || '').trim()  // 'active' | 'inactive'
  const q = (c.req.query('q') || '').trim()
  const offset = (page - 1) * limit

  const conditions: string[] = []
  const bindings: unknown[] = []

  if (plan) { conditions.push(`p.plan_id = ?`); bindings.push(plan) }
  if (status === 'active') conditions.push(`p.is_active = 1`)
  if (status === 'inactive') conditions.push(`p.is_active = 0`)
  if (q) {
    conditions.push(`(u.email LIKE ? OR p.slug LIKE ?)`)
    bindings.push(`%${q}%`, `%${q}%`)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const fromWhere = `FROM users u LEFT JOIN profiles p ON p.user_id = u.id ${where}`

  // Try full query (includes migration-0023 columns trial_ends_at, admin_notes).
  // Falls back to compat query returning NULL for those columns if 0023 not applied yet.
  let totalRow: { cnt: number } | null | undefined
  let rows: any

  try {
    ;[totalRow, rows] = await Promise.all([
      c.env.DB.prepare(`SELECT COUNT(*) AS cnt ${fromWhere}`)
        .bind(...bindings).first<{ cnt: number }>(),
      c.env.DB.prepare(
        `SELECT u.id AS user_id, u.email, p.created_at AS user_created_at,
                p.id AS profile_id, p.slug, p.name AS profile_name,
                p.plan_id, p.is_active, p.is_published,
                p.trial_ends_at, p.admin_notes,
                (SELECT COUNT(*) FROM profile_links WHERE profile_id = p.id) AS links_count,
                (SELECT COUNT(*) FROM profile_modules pm
                 WHERE pm.profile_id = p.id
                   AND (pm.expires_at IS NULL OR pm.expires_at > datetime('now'))) AS active_modules
         ${fromWhere}
         ORDER BY p.created_at DESC, u.id DESC LIMIT ? OFFSET ?`
      ).bind(...bindings, limit, offset).all(),
    ])
  } catch {
    // Fallback: migration 0023 columns not yet present in DB — return NULL for them
    ;[totalRow, rows] = await Promise.all([
      c.env.DB.prepare(`SELECT COUNT(*) AS cnt ${fromWhere}`)
        .bind(...bindings).first<{ cnt: number }>(),
      c.env.DB.prepare(
        `SELECT u.id AS user_id, u.email, p.created_at AS user_created_at,
                p.id AS profile_id, p.slug, p.name AS profile_name,
                p.plan_id, p.is_active, p.is_published,
                NULL AS trial_ends_at, NULL AS admin_notes,
                (SELECT COUNT(*) FROM profile_links WHERE profile_id = p.id) AS links_count,
                (SELECT COUNT(*) FROM profile_modules pm
                 WHERE pm.profile_id = p.id
                   AND (pm.expires_at IS NULL OR pm.expires_at > datetime('now'))) AS active_modules
         ${fromWhere}
         ORDER BY p.created_at DESC, u.id DESC LIMIT ? OFFSET ?`
      ).bind(...bindings, limit, offset).all(),
    ])
  }

  return c.json({
    ok: true,
    meta: { page, limit, total: totalRow?.cnt ?? 0, pages: Math.ceil((totalRow?.cnt ?? 0) / limit) },
    data: rows.results,
  })
})

// ── GET /api/v1/superadmin/subscribers/:userId ────────────────────────────────
// Detalle completo de un suscriptor: usuario + perfil + módulos + overrides + audit.
app.get('/api/v1/superadmin/subscribers/:userId', requireSuperAdmin('viewer'), async (c) => {
  const targetUserId = c.req.param('userId')

  const [userRow, profileRow] = await Promise.all([
    c.env.DB.prepare(`SELECT id, email, NULL AS created_at FROM users WHERE id = ? LIMIT 1`)
      .bind(targetUserId).first(),
    c.env.DB.prepare(
      `SELECT p.*, pl.max_links, pl.max_photos, pl.max_faqs, pl.max_products, pl.max_videos, pl.can_use_vcard
       FROM profiles p
       LEFT JOIN plan_limits pl ON p.plan_id = pl.plan_id
       WHERE p.user_id = ? LIMIT 1`
    ).bind(targetUserId).first(),
  ])

  if (!userRow) return c.json({ ok: false, error: 'User not found' }, 404)

  const profileId = (profileRow as any)?.id ?? null

  const [modules, overrides, recentAudit, linkCount, leadCount] = await Promise.all([
    profileId
      ? c.env.DB.prepare(
        `SELECT pm.module_code, pm.expires_at, pm.activated_at, pm.assigned_by, pm.assignment_reason,
                  m.name AS module_name
           FROM profile_modules pm
           JOIN modules m ON pm.module_code = m.code
           WHERE pm.profile_id = ?
           ORDER BY pm.activated_at DESC`
      ).bind(profileId).all().catch(() =>
        // Fallback: migration 0023 columns not yet present — return NULLs
        c.env.DB.prepare(
          `SELECT pm.module_code, pm.expires_at, pm.activated_at,
                    NULL AS assigned_by, NULL AS assignment_reason,
                    m.name AS module_name
             FROM profile_modules pm
             JOIN modules m ON pm.module_code = m.code
             WHERE pm.profile_id = ?
             ORDER BY pm.activated_at DESC`
        ).bind(profileId).all()
      )
      : Promise.resolve({ results: [] }),

    profileId
      ? c.env.DB.prepare(
        `SELECT * FROM profile_plan_overrides WHERE profile_id = ? LIMIT 1`
      ).bind(profileId).first().catch(() => null)
      : Promise.resolve(null),

    c.env.DB.prepare(
      `SELECT action, target_type, target_id, before_json, after_json, created_at
       FROM admin_audit_log
       WHERE target_id = ? OR target_id = ?
       ORDER BY created_at DESC LIMIT 20`
    ).bind(targetUserId, profileId ?? '').all().catch(() => ({ results: [] })),

    profileId
      ? c.env.DB.prepare(`SELECT COUNT(*) AS cnt FROM profile_links WHERE profile_id = ?`)
        .bind(profileId).first<{ cnt: number }>()
      : Promise.resolve({ cnt: 0 }),

    profileId
      ? c.env.DB.prepare(`SELECT COUNT(*) AS cnt FROM leads WHERE profile_slug = (SELECT slug FROM profiles WHERE id = ?)`)
        .bind(profileId).first<{ cnt: number }>().catch(() => ({ cnt: 0 }))
      : Promise.resolve({ cnt: 0 }),
  ])

  return c.json({
    ok: true,
    data: {
      user: userRow,
      profile: profileRow,
      plan_overrides: overrides,
      active_modules: (modules as any).results,
      stats: {
        links_count: linkCount?.cnt ?? 0,
        leads_count: leadCount?.cnt ?? 0,
      },
      recent_audit: (recentAudit as any).results,
    },
  })
})

// ── PATCH /api/v1/superadmin/subscribers/:userId/plan ────────────────────────
// Cambia el plan base de un suscriptor desde Super Admin.
// Requiere rol mínimo 'support'.
// Body: { plan_id: string, reason?: string }
// Responde: { ok: true, data: { user_id, profile_id, old_plan_id, new_plan_id } }
app.patch('/api/v1/superadmin/subscribers/:userId/plan', requireSuperAdmin('support'), async (c) => {
  const adminUserId = c.get('adminUserId') as string
  const targetUserId = c.req.param('userId')

  // Parse + validate body
  let body: { plan_id?: unknown; reason?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ ok: false, error: 'Invalid JSON body' }, 400)
  }

  const newPlanId = typeof body.plan_id === 'string' ? body.plan_id.trim() : ''
  const reason = typeof body.reason === 'string' ? body.reason.trim() : null

  const VALID_PLANS = ['free', 'starter', 'pro', 'agency']
  if (!VALID_PLANS.includes(newPlanId)) {
    return c.json({
      ok: false,
      error: 'Invalid plan_id',
      valid_plans: VALID_PLANS,
    }, 400)
  }

  // Verify user exists
  const userRow = await c.env.DB.prepare(
    `SELECT id FROM users WHERE id = ? LIMIT 1`
  ).bind(targetUserId).first<{ id: string }>()
  if (!userRow) return c.json({ ok: false, error: 'User not found' }, 404)

  // Fetch current profile (need profile_id and old plan)
  const profileRow = await c.env.DB.prepare(
    `SELECT id, plan_id FROM profiles WHERE user_id = ? LIMIT 1`
  ).bind(targetUserId).first<{ id: string; plan_id: string }>()
  if (!profileRow) return c.json({ ok: false, error: 'Profile not found' }, 404)

  const profileId = profileRow.id
  const oldPlanId = profileRow.plan_id

  // No-op guard
  if (oldPlanId === newPlanId) {
    return c.json({
      ok: true,
      data: { user_id: targetUserId, profile_id: profileId, old_plan_id: oldPlanId, new_plan_id: newPlanId },
      message: 'Plan unchanged (same value)',
    })
  }

  // UPDATE + INSERT audit como un batch D1 (transacción implícita).
  // Si cualquiera de los dos falla, el batch entero hace rollback.
  // D1 no expone BEGIN/COMMIT explícito, pero db.batch([...]) garantiza
  // que ambas sentencias se ejecutan atómicamente en el backend SQLite.
  const auditId = crypto.randomUUID()
  const ip = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? null

  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE profiles SET plan_id = ?, updated_at = datetime('now') WHERE id = ?`
    ).bind(newPlanId, profileId),
    c.env.DB.prepare(
      `INSERT INTO admin_audit_log
         (id, admin_user_id, action, target_type, target_id, before_json, after_json, ip, created_at)
       VALUES (?, ?, 'plan_changed', 'profile', ?, ?, ?, ?, datetime('now'))`
    ).bind(
      auditId,
      adminUserId,
      profileId,
      JSON.stringify({ plan_id: oldPlanId }),
      JSON.stringify({ plan_id: newPlanId, ...(reason ? { reason } : {}) }),
      ip,
    ),
  ])

  return c.json({
    ok: true,
    data: { user_id: targetUserId, profile_id: profileId, old_plan_id: oldPlanId, new_plan_id: newPlanId },
  })
})

// ── GET /api/v1/superadmin/metrics/overview ───────────────────────────────────
// Métricas agregadas del negocio: totales por plan, altas semanales, activos.
app.get('/api/v1/superadmin/metrics/overview', requireSuperAdmin('viewer'), async (c) => {
  const [
    totalUsers,
    totalProfiles,
    byPlan,
    newUsersWeek,
    newUsersMonth,
    activeProfiles,
    inactiveProfiles,
    totalLeads,
    leadsWeek,
  ] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) AS cnt FROM users`).first<{ cnt: number }>(),
    c.env.DB.prepare(`SELECT COUNT(*) AS cnt FROM profiles`).first<{ cnt: number }>(),
    c.env.DB.prepare(
      `SELECT plan_id, COUNT(*) AS cnt FROM profiles GROUP BY plan_id ORDER BY cnt DESC`
    ).all(),
    c.env.DB.prepare(
      `SELECT COUNT(*) AS cnt FROM users WHERE created_at >= datetime('now', '-7 days')`
    ).first<{ cnt: number }>().catch(() => ({ cnt: 0 })),
    c.env.DB.prepare(
      `SELECT COUNT(*) AS cnt FROM users WHERE created_at >= datetime('now', '-30 days')`
    ).first<{ cnt: number }>().catch(() => ({ cnt: 0 })),
    c.env.DB.prepare(`SELECT COUNT(*) AS cnt FROM profiles WHERE is_active = 1`).first<{ cnt: number }>(),
    c.env.DB.prepare(`SELECT COUNT(*) AS cnt FROM profiles WHERE is_active = 0`).first<{ cnt: number }>(),
    c.env.DB.prepare(`SELECT COUNT(*) AS cnt FROM leads`).first<{ cnt: number }>().catch(() => ({ cnt: 0 })),
    c.env.DB.prepare(
      `SELECT COUNT(*) AS cnt FROM leads WHERE created_at >= datetime('now', '-7 days')`
    ).first<{ cnt: number }>().catch(() => ({ cnt: 0 })),
  ])

  return c.json({
    ok: true,
    data: {
      users: {
        total: totalUsers?.cnt ?? 0,
        new_7d: newUsersWeek?.cnt ?? 0,
        new_30d: newUsersMonth?.cnt ?? 0,
      },
      profiles: {
        total: totalProfiles?.cnt ?? 0,
        active: activeProfiles?.cnt ?? 0,
        inactive: inactiveProfiles?.cnt ?? 0,
        by_plan: byPlan.results,
      },
      leads: {
        total: totalLeads?.cnt ?? 0,
        new_7d: leadsWeek?.cnt ?? 0,
      },
    },
  })
})

// ── GET /api/v1/superadmin/audit ──────────────────────────────────────────────
// Audit log paginado con filtros.
// Query params: page, limit, admin_user_id, action, target_type, from (ISO date), to.
app.get('/api/v1/superadmin/audit', requireSuperAdmin('viewer'), async (c) => {
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '50', 10)))
  const adminFilter = (c.req.query('admin_user_id') || '').trim()
  const actionFilter = (c.req.query('action') || '').trim()
  const typeFilter = (c.req.query('target_type') || '').trim()
  const fromDate = (c.req.query('from') || '').trim()
  const toDate = (c.req.query('to') || '').trim()
  const offset = (page - 1) * limit

  const conditions: string[] = []
  const bindings: unknown[] = []

  if (adminFilter) { conditions.push(`a.admin_user_id = ?`); bindings.push(adminFilter) }
  if (actionFilter) { conditions.push(`a.action = ?`); bindings.push(actionFilter) }
  if (typeFilter) { conditions.push(`a.target_type = ?`); bindings.push(typeFilter) }
  if (fromDate) { conditions.push(`a.created_at >= ?`); bindings.push(fromDate) }
  if (toDate) { conditions.push(`a.created_at <= ?`); bindings.push(toDate) }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  let totalRow: { cnt: number } | null | undefined
  let rows: any

  try {
    ;[totalRow, rows] = await Promise.all([
      c.env.DB.prepare(`SELECT COUNT(*) AS cnt FROM admin_audit_log a ${where}`)
        .bind(...bindings).first<{ cnt: number }>(),
      c.env.DB.prepare(
        `SELECT a.id, a.admin_user_id, u.email AS admin_email,
                a.action, a.target_type, a.target_id,
                a.before_json, a.after_json, a.ip, a.created_at
         FROM admin_audit_log a
         LEFT JOIN users u ON a.admin_user_id = u.id
         ${where}
         ORDER BY a.created_at DESC
         LIMIT ? OFFSET ?`
      ).bind(...bindings, limit, offset).all(),
    ])
  } catch {
    // admin_audit_log table doesn't exist yet (migration 0023 pending) — return empty
    totalRow = { cnt: 0 }
    rows = { results: [] }
  }

  return c.json({
    ok: true,
    meta: { page, limit, total: totalRow?.cnt ?? 0, pages: Math.ceil((totalRow?.cnt ?? 0) / limit) },
    data: rows.results,
  })
})

// ── GET /api/v1/superadmin/admins ────────────────────────────────────────────
// Lista todos los usuarios con acceso admin (desde tabla admin_users).
app.get('/api/v1/superadmin/admins', requireSuperAdmin('super_admin'), async (c) => {
  let rows: any
  try {
    rows = await c.env.DB.prepare(
      `SELECT au.user_id, au.role, au.granted_at, au.notes,
              u.email,
              gb.email AS granted_by_email
       FROM admin_users au
       JOIN users u ON au.user_id = u.id
       LEFT JOIN users gb ON au.granted_by = gb.id
       ORDER BY au.granted_at DESC`
    ).all()
  } catch {
    // admin_users table doesn't exist yet (migration 0023 pending) — return empty
    rows = { results: [] }
  }
  return c.json({ ok: true, data: rows.results })
})

// ── POST /api/v1/superadmin/profiles/:id/change-plan ─────────────────────────
// Cambia el plan base de un perfil (por profileId) desde Super Admin.
// Requiere rol mínimo 'support'.
// Body: { planId: string, reason?: string }
// Responde: { ok: true, message: "Plan updated", data: { profile_id, user_id, old_plan_id, new_plan_id, plan_name, audit_id } }
app.post('/api/v1/superadmin/profiles/:id/change-plan', requireSuperAdmin('support'), async (c) => {
  const adminUserId = c.get('adminUserId') as string
  const profileId   = c.req.param('id')

  // Parse + validate body
  let body: { planId?: unknown; reason?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ ok: false, error: 'Invalid JSON body' }, 400)
  }

  const newPlanId = typeof body.planId === 'string' ? body.planId.trim() : ''
  const reason    = typeof body.reason === 'string' ? body.reason.trim() : null

  if (!newPlanId) {
    return c.json({ ok: false, error: 'planId is required' }, 400)
  }

  // Verify plan exists and has operational limits (plans.is_active doesn't exist
  // in production — schema 0001 only has id+name. The canonical validation is
  // the presence of a plan_limits row, which is required for entitlements to work.)
  const planRow = await c.env.DB.prepare(
    `SELECT p.id, p.name
     FROM plans p
     INNER JOIN plan_limits pl ON pl.plan_id = p.id
     WHERE p.id = ? LIMIT 1`
  ).bind(newPlanId).first<{ id: string; name: string }>()
  if (!planRow) {
    return c.json({ ok: false, error: 'Plan not found or has no limits configured', plan_id: newPlanId }, 400)
  }

  // Fetch current profile (need old plan + userId for audit context)
  const profileRow = await c.env.DB.prepare(
    `SELECT id, user_id, plan_id, slug FROM profiles WHERE id = ? LIMIT 1`
  ).bind(profileId).first<{ id: string; user_id: string; plan_id: string; slug: string }>()
  if (!profileRow) return c.json({ ok: false, error: 'Profile not found' }, 404)

  const oldPlanId = profileRow.plan_id

  // No-op guard
  if (oldPlanId === newPlanId) {
    return c.json({
      ok: true,
      message: 'Plan unchanged',
      data: {
        profile_id: profileId,
        user_id:    profileRow.user_id,
        old_plan_id: oldPlanId,
        new_plan_id: newPlanId,
      },
    })
  }

  // UPDATE + INSERT audit en batch atómico (mismo patrón que PATCH /subscribers/:userId/plan)
  const auditId = crypto.randomUUID()
  const ip = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? null

  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE profiles SET plan_id = ?, updated_at = datetime('now') WHERE id = ?`
    ).bind(newPlanId, profileId),
    c.env.DB.prepare(
      `INSERT INTO admin_audit_log
         (id, admin_user_id, action, target_type, target_id, before_json, after_json, ip, created_at)
       VALUES (?, ?, 'plan_changed', 'profile', ?, ?, ?, ?, datetime('now'))`
    ).bind(
      auditId,
      adminUserId,
      profileId,
      JSON.stringify({ plan_id: oldPlanId, slug: profileRow.slug, user_id: profileRow.user_id }),
      JSON.stringify({ plan_id: newPlanId, plan_name: planRow.name, ...(reason ? { reason } : {}) }),
      ip,
    ),
  ])

  return c.json({
    ok: true,
    message: 'Plan updated',
    data: {
      profile_id:  profileId,
      user_id:     profileRow.user_id,
      slug:        profileRow.slug,
      old_plan_id: oldPlanId,
      new_plan_id: newPlanId,
      plan_name:   planRow.name,
      audit_id:    auditId,
    },
  })
})

// ── POST /api/v1/superadmin/profiles/:id/modules ──────────────────────────────
// Asigna manualmente un módulo a un perfil desde Super Admin.
// Requiere rol mínimo 'support'.
// Body: { moduleCode: string, reason?: string }
// Responde: { ok: true, message: "...", data: { profile_id, user_id, slug, module_code, module_name, audit_id } }
app.post('/api/v1/superadmin/profiles/:id/modules', requireSuperAdmin('support'), async (c) => {
  const adminUserId = c.get('adminUserId') as string
  const profileId   = c.req.param('id')

  // Parse + validate body
  let body: { moduleCode?: unknown; reason?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ ok: false, error: 'Invalid JSON body' }, 400)
  }

  const moduleCode = typeof body.moduleCode === 'string' ? body.moduleCode.trim() : ''
  const reason     = typeof body.reason === 'string' ? body.reason.trim() : null

  if (!moduleCode) {
    return c.json({ ok: false, error: 'moduleCode is required' }, 400)
  }

  // Verify module exists and is active (is_active added in migration 0013, DEFAULT 1)
  const moduleRow = await c.env.DB.prepare(
    `SELECT code, name FROM modules WHERE code = ? AND is_active = 1 LIMIT 1`
  ).bind(moduleCode).first<{ code: string; name: string }>()
  if (!moduleRow) {
    return c.json({ ok: false, error: 'Module not found', module_code: moduleCode }, 400)
  }

  // Verify profile exists
  const profileRow = await c.env.DB.prepare(
    `SELECT id, user_id, slug FROM profiles WHERE id = ? LIMIT 1`
  ).bind(profileId).first<{ id: string; user_id: string; slug: string }>()
  if (!profileRow) return c.json({ ok: false, error: 'Profile not found' }, 404)

  // No-op guard — check if module already assigned to this profile
  const existing = await c.env.DB.prepare(
    `SELECT 1 FROM profile_modules WHERE profile_id = ? AND module_code = ? LIMIT 1`
  ).bind(profileId, moduleCode).first()
  if (existing) {
    return c.json({
      ok: true,
      message: 'Module already assigned',
      data: {
        profile_id:  profileId,
        user_id:     profileRow.user_id,
        module_code: moduleCode,
        module_name: moduleRow.name,
      },
    })
  }

  // INSERT + audit en batch atómico
  const auditId = crypto.randomUUID()
  const ip = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? null

  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO profile_modules (profile_id, module_code, assigned_by, assignment_reason)
       VALUES (?, ?, ?, ?)`
    ).bind(profileId, moduleCode, adminUserId, reason),
    c.env.DB.prepare(
      `INSERT INTO admin_audit_log
         (id, admin_user_id, action, target_type, target_id, before_json, after_json, ip, created_at)
       VALUES (?, ?, 'module_assigned', 'profile', ?, ?, ?, ?, datetime('now'))`
    ).bind(
      auditId,
      adminUserId,
      profileId,
      JSON.stringify({ module_code: null, slug: profileRow.slug, user_id: profileRow.user_id }),
      JSON.stringify({ module_code: moduleCode, module_name: moduleRow.name, ...(reason ? { reason } : {}) }),
      ip,
    ),
  ])

  return c.json({
    ok: true,
    message: 'Module assigned',
    data: {
      profile_id:  profileId,
      user_id:     profileRow.user_id,
      slug:        profileRow.slug,
      module_code: moduleCode,
      module_name: moduleRow.name,
      audit_id:    auditId,
    },
  })
})

// ── DELETE /api/v1/superadmin/profiles/:id/modules/:module_code ───────────────
// Revoca manualmente un módulo asignado a un perfil desde Super Admin.
// Requiere rol mínimo 'support'.
// Query opcional: ?reason=... (también acepta reason en body si se envía JSON)
// Responde: { ok: true, message: "...", data: { profile_id, user_id, slug, module_code, revoked, audit_id? } }
app.delete('/api/v1/superadmin/profiles/:id/modules/:module_code', requireSuperAdmin('support'), async (c) => {
  const adminUserId = c.get('adminUserId') as string
  const profileId   = c.req.param('id')
  const moduleCode  = c.req.param('module_code').trim()

  // reason: querystring tiene prioridad; si no, intentar body JSON (best-effort)
  let reason: string | null = c.req.query('reason') ?? null
  if (!reason) {
    try {
      const body = await c.req.json() as { reason?: unknown }
      if (typeof body.reason === 'string' && body.reason.trim()) reason = body.reason.trim()
    } catch { /* no body / not JSON — ignorar */ }
  }

  // Verify profile exists
  const profileRow = await c.env.DB.prepare(
    `SELECT id, user_id, slug FROM profiles WHERE id = ? LIMIT 1`
  ).bind(profileId).first<{ id: string; user_id: string; slug: string }>()
  if (!profileRow) return c.json({ ok: false, error: 'Profile not found' }, 404)

  // Check if assignment exists (columnas reales: no created_at, sí activated_at)
  const existing = await c.env.DB.prepare(
    `SELECT module_code, assigned_by, assignment_reason, expires_at, activated_at
     FROM profile_modules WHERE profile_id = ? AND module_code = ? LIMIT 1`
  ).bind(profileId, moduleCode).first<{
    module_code: string; assigned_by: string | null;
    assignment_reason: string | null; expires_at: string | null; activated_at: string
  }>()

  // No-op: módulo no estaba asignado — respuesta limpia sin error
  if (!existing) {
    return c.json({
      ok: true,
      message: 'Module was not assigned — nothing to revoke',
      data: {
        profile_id:  profileId,
        user_id:     profileRow.user_id,
        slug:        profileRow.slug,
        module_code: moduleCode,
        revoked:     false,
      },
    })
  }

  // DELETE + audit en batch atómico
  const auditId = crypto.randomUUID()
  const ip = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? null

  await c.env.DB.batch([
    c.env.DB.prepare(
      `DELETE FROM profile_modules WHERE profile_id = ? AND module_code = ?`
    ).bind(profileId, moduleCode),
    c.env.DB.prepare(
      `INSERT INTO admin_audit_log
         (id, admin_user_id, action, target_type, target_id, before_json, after_json, ip, created_at)
       VALUES (?, ?, 'module_revoked', 'profile', ?, ?, ?, ?, datetime('now'))`
    ).bind(
      auditId,
      adminUserId,
      profileId,
      JSON.stringify({
        module_code:       existing.module_code,
        assigned_by:       existing.assigned_by,
        assignment_reason: existing.assignment_reason,
        expires_at:        existing.expires_at,
        activated_at:      existing.activated_at,
        slug:              profileRow.slug,
        user_id:           profileRow.user_id,
      }),
      JSON.stringify({ module_code: null, ...(reason ? { revoke_reason: reason } : {}) }),
      ip,
    ),
  ])

  return c.json({
    ok: true,
    message: 'Module revoked',
    data: {
      profile_id:  profileId,
      user_id:     profileRow.user_id,
      slug:        profileRow.slug,
      module_code: moduleCode,
      revoked:     true,
      audit_id:    auditId,
    },
  })
})

// ── POST /api/v1/superadmin/profiles/:id/override ─────────────────────────────
// Crea o actualiza (PATCH-like) el override de límites/capacidades para un perfil.
// Requiere rol mínimo 'support'.
// Body: { max_links?, max_photos?, max_faqs?, max_products?, max_videos?,
//         can_use_vcard?, trial_plan_id?, trial_ends_at?, reason? }
// Semántica: campo OMITIDO → conserva valor previo. null EXPLÍCITO → limpia ese campo.
// Al menos un campo de override debe estar presente en el body (guard contra no-op).
// Responde: { ok: true, message: "...", data: { profile_id, user_id, slug, override, audit_id } }
app.post('/api/v1/superadmin/profiles/:id/override', requireSuperAdmin('support'), async (c) => {
  const adminUserId = c.get('adminUserId') as string
  const profileId   = c.req.param('id')

  // Parse body
  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ ok: false, error: 'Invalid JSON body' }, 400)
  }

  // Guard: al menos un campo de override debe estar presente en el body
  const OVERRIDE_KEYS = ['max_links', 'max_photos', 'max_faqs', 'max_products', 'max_videos', 'can_use_vcard', 'trial_plan_id', 'trial_ends_at']
  if (!OVERRIDE_KEYS.some(k => k in body)) {
    return c.json({ ok: false, error: 'Body must include at least one override field' }, 400)
  }

  // Validators estrictos — devuelven INVALID en lugar de silenciar errores
  const INVALID = Symbol('INVALID')
  const strictInt = (v: unknown): number | null | typeof INVALID => {
    if (v === null || v === undefined) return null
    if (Number.isInteger(v)) return v as number
    return INVALID  // string, float, boolean, objeto → rechazo explícito
  }
  const strictBool = (v: unknown): 1 | 0 | null | typeof INVALID => {
    if (v === null || v === undefined) return null
    if (v === true  || v === 1) return 1
    if (v === false || v === 0) return 0
    return INVALID  // string, número distinto de 0/1, objeto → rechazo explícito
  }
  const toTextOrNull = (v: unknown): string | null =>
    (typeof v === 'string' && v.trim()) ? v.trim() : null

  // Parsear + validar cada campo presente en body — ausentes quedan undefined
  let sent_max_links:    number | null | undefined
  let sent_max_photos:   number | null | undefined
  let sent_max_faqs:     number | null | undefined
  let sent_max_products: number | null | undefined
  let sent_max_videos:   number | null | undefined
  let sent_can_use_vcard: 1 | 0 | null | undefined

  if ('max_links' in body) {
    const r = strictInt(body.max_links)
    if (r === INVALID) return c.json({ ok: false, error: 'max_links must be an integer or null' }, 400)
    sent_max_links = r
  }
  if ('max_photos' in body) {
    const r = strictInt(body.max_photos)
    if (r === INVALID) return c.json({ ok: false, error: 'max_photos must be an integer or null' }, 400)
    sent_max_photos = r
  }
  if ('max_faqs' in body) {
    const r = strictInt(body.max_faqs)
    if (r === INVALID) return c.json({ ok: false, error: 'max_faqs must be an integer or null' }, 400)
    sent_max_faqs = r
  }
  if ('max_products' in body) {
    const r = strictInt(body.max_products)
    if (r === INVALID) return c.json({ ok: false, error: 'max_products must be an integer or null' }, 400)
    sent_max_products = r
  }
  if ('max_videos' in body) {
    const r = strictInt(body.max_videos)
    if (r === INVALID) return c.json({ ok: false, error: 'max_videos must be an integer or null' }, 400)
    sent_max_videos = r
  }
  if ('can_use_vcard' in body) {
    const r = strictBool(body.can_use_vcard)
    if (r === INVALID) return c.json({ ok: false, error: 'can_use_vcard must be true, false, 1, 0 or null' }, 400)
    sent_can_use_vcard = r
  }

  const sent_trial_plan_id = 'trial_plan_id' in body ? toTextOrNull(body.trial_plan_id) : undefined
  const sent_trial_ends_at = 'trial_ends_at' in body ? toTextOrNull(body.trial_ends_at) : undefined
  const sent_reason        = 'reason'        in body ? toTextOrNull(body.reason)        : undefined

  // Validar trial_plan_id si fue enviado y no es null
  if (sent_trial_plan_id !== undefined && sent_trial_plan_id !== null) {
    const planCheck = await c.env.DB.prepare(
      `SELECT id FROM plans WHERE id = ? LIMIT 1`
    ).bind(sent_trial_plan_id).first()
    if (!planCheck) return c.json({ ok: false, error: 'trial_plan_id not found', trial_plan_id: sent_trial_plan_id }, 400)
  }

  // Validar trial_ends_at si fue enviado y no es null (formato datetime básico)
  if (sent_trial_ends_at !== undefined && sent_trial_ends_at !== null) {
    if (isNaN(new Date(sent_trial_ends_at).getTime())) {
      return c.json({ ok: false, error: 'trial_ends_at is not a valid datetime' }, 400)
    }
  }

  // Verify profile exists
  const profileRow = await c.env.DB.prepare(
    `SELECT id, user_id, slug FROM profiles WHERE id = ? LIMIT 1`
  ).bind(profileId).first<{ id: string; user_id: string; slug: string }>()
  if (!profileRow) return c.json({ ok: false, error: 'Profile not found' }, 404)

  // Snapshot before — necesario para el merge PATCH-like Y para auditoría
  const before = await c.env.DB.prepare(
    `SELECT max_links, max_photos, max_faqs, max_products, max_videos,
            can_use_vcard, trial_plan_id, trial_ends_at, override_reason,
            overridden_by, overridden_at
     FROM profile_plan_overrides WHERE profile_id = ? LIMIT 1`
  ).bind(profileId).first<{
    max_links: number|null; max_photos: number|null; max_faqs: number|null;
    max_products: number|null; max_videos: number|null; can_use_vcard: number|null;
    trial_plan_id: string|null; trial_ends_at: string|null; override_reason: string|null;
    overridden_by: string; overridden_at: string;
  }>()

  // Merge PATCH-like: sent_X !== undefined → usar nuevo valor (incluso si es null)
  //                   sent_X === undefined → conservar valor previo
  const merged = {
    max_links:       sent_max_links     !== undefined ? sent_max_links     : (before?.max_links     ?? null),
    max_photos:      sent_max_photos    !== undefined ? sent_max_photos    : (before?.max_photos    ?? null),
    max_faqs:        sent_max_faqs      !== undefined ? sent_max_faqs      : (before?.max_faqs      ?? null),
    max_products:    sent_max_products  !== undefined ? sent_max_products  : (before?.max_products  ?? null),
    max_videos:      sent_max_videos    !== undefined ? sent_max_videos    : (before?.max_videos    ?? null),
    can_use_vcard:   sent_can_use_vcard !== undefined ? sent_can_use_vcard : (before?.can_use_vcard ?? null),
    trial_plan_id:   sent_trial_plan_id !== undefined ? sent_trial_plan_id : (before?.trial_plan_id ?? null),
    trial_ends_at:   sent_trial_ends_at !== undefined ? sent_trial_ends_at : (before?.trial_ends_at ?? null),
    override_reason: sent_reason        !== undefined ? sent_reason        : (before?.override_reason ?? null),
  }

  const auditId = crypto.randomUUID()
  const ip = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? null

  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO profile_plan_overrides
         (profile_id, max_links, max_photos, max_faqs, max_products, max_videos,
          can_use_vcard, trial_plan_id, trial_ends_at, override_reason,
          overridden_by, overridden_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(profile_id) DO UPDATE SET
         max_links       = excluded.max_links,
         max_photos      = excluded.max_photos,
         max_faqs        = excluded.max_faqs,
         max_products    = excluded.max_products,
         max_videos      = excluded.max_videos,
         can_use_vcard   = excluded.can_use_vcard,
         trial_plan_id   = excluded.trial_plan_id,
         trial_ends_at   = excluded.trial_ends_at,
         override_reason = excluded.override_reason,
         overridden_by   = excluded.overridden_by,
         overridden_at   = datetime('now')`
    ).bind(
      profileId,
      merged.max_links, merged.max_photos, merged.max_faqs, merged.max_products, merged.max_videos,
      merged.can_use_vcard, merged.trial_plan_id, merged.trial_ends_at, merged.override_reason,
      adminUserId,
    ),
    c.env.DB.prepare(
      `INSERT INTO admin_audit_log
         (id, admin_user_id, action, target_type, target_id, before_json, after_json, ip, created_at)
       VALUES (?, ?, 'override_set', 'profile', ?, ?, ?, ?, datetime('now'))`
    ).bind(
      auditId,
      adminUserId,
      profileId,
      JSON.stringify(before ?? null),
      JSON.stringify({ ...merged, overridden_by: adminUserId, slug: profileRow.slug, user_id: profileRow.user_id }),
      ip,
    ),
  ])

  return c.json({
    ok: true,
    message: before ? 'Override updated' : 'Override created',
    data: {
      profile_id: profileId,
      user_id:    profileRow.user_id,
      slug:       profileRow.slug,
      override:   { ...merged, overridden_by: adminUserId },
      audit_id:   auditId,
    },
  })
})

// ── PATCH /api/v1/superadmin/profiles/:id/status ──────────────────────────────
// Activa o desactiva un perfil a nivel admin (campo is_active).
// Requiere rol mínimo 'support'.
// Body: { is_active: boolean | 1 | 0, reason?: string }
// Desactivar: sets is_active=0, guarda deactivation_reason si viene reason.
// Reactivar:  sets is_active=1, limpia deactivation_reason (ya no aplica).
// No-op limpio si el estado ya es el solicitado.
// Responde: { ok: true, message: "...", data: { profile_id, user_id, slug, is_active, audit_id? } }
app.patch('/api/v1/superadmin/profiles/:id/status', requireSuperAdmin('support'), async (c) => {
  const adminUserId = c.get('adminUserId') as string
  const profileId   = c.req.param('id')

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ ok: false, error: 'Invalid JSON body' }, 400)
  }

  // is_active es requerido y validado de forma estricta
  if (!('is_active' in body)) {
    return c.json({ ok: false, error: 'is_active is required' }, 400)
  }
  const v = body.is_active
  let newIsActive: 0 | 1
  if      (v === true  || v === 1) newIsActive = 1
  else if (v === false || v === 0) newIsActive = 0
  else return c.json({ ok: false, error: 'is_active must be true, false, 1 or 0' }, 400)

  const reason = (typeof body.reason === 'string' && body.reason.trim()) ? body.reason.trim() : null

  // Verify profile exists + snapshot current state
  const profileRow = await c.env.DB.prepare(
    `SELECT id, user_id, slug, is_active, deactivation_reason FROM profiles WHERE id = ? LIMIT 1`
  ).bind(profileId).first<{ id: string; user_id: string; slug: string; is_active: number; deactivation_reason: string | null }>()
  if (!profileRow) return c.json({ ok: false, error: 'Profile not found' }, 404)

  // No-op guard — estado ya es el solicitado
  if (profileRow.is_active === newIsActive) {
    return c.json({
      ok: true,
      message: 'Status unchanged',
      data: {
        profile_id: profileId,
        user_id:    profileRow.user_id,
        slug:       profileRow.slug,
        is_active:  newIsActive === 1,
      },
    })
  }

  const auditId = crypto.randomUUID()
  const ip      = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? null
  const action  = newIsActive === 1 ? 'profile_activated' : 'profile_deactivated'

  // deactivation_reason: se guarda al desactivar (reason o null); se borra al reactivar
  const newDeactivationReason = newIsActive === 0 ? reason : null

  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE profiles
       SET is_active = ?, deactivation_reason = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).bind(newIsActive, newDeactivationReason, profileId),
    c.env.DB.prepare(
      `INSERT INTO admin_audit_log
         (id, admin_user_id, action, target_type, target_id, before_json, after_json, ip, created_at)
       VALUES (?, ?, ?, 'profile', ?, ?, ?, ?, datetime('now'))`
    ).bind(
      auditId,
      adminUserId,
      action,
      profileId,
      JSON.stringify({
        is_active:          profileRow.is_active === 1,
        deactivation_reason: profileRow.deactivation_reason,
        slug:               profileRow.slug,
        user_id:            profileRow.user_id,
      }),
      JSON.stringify({
        is_active:          newIsActive === 1,
        deactivation_reason: newDeactivationReason,
      }),
      ip,
    ),
  ])

  return c.json({
    ok: true,
    message: newIsActive === 1 ? 'Profile activated' : 'Profile deactivated',
    data: {
      profile_id:          profileId,
      user_id:             profileRow.user_id,
      slug:                profileRow.slug,
      is_active:           newIsActive === 1,
      deactivation_reason: newDeactivationReason,
      audit_id:            auditId,
    },
  })
})

// --- INTAP Agents MVP (Aislado) ---
// Deshabilitado temporalmente hasta definir auth, ownership y límites por plan.
const agentsDisabledResponse = (c: any) => c.json({
  ok: false,
  error: 'Agents module disabled',
  message: 'This module is not available in the current release.',
}, 410)

app.post('/api/v1/agents/workspaces', agentsDisabledResponse)
app.post('/api/v1/agents/chat/sessions', agentsDisabledResponse)
app.post('/api/v1/agents/chat/messages', agentsDisabledResponse)

export default app
