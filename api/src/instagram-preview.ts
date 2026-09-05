import app from './preview-entry'

type InstagramTokenPayload = { access_token?: string; user_id?: string | number; expires_in?: number }
type InstagramProfilePayload = { id?: string; user_id?: string | number; username?: string; account_type?: string }

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach((b) => { binary += String.fromCharCode(b) })
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function randomToken(bytes = 32): string {
  const raw = new Uint8Array(bytes)
  crypto.getRandomValues(raw)
  return bytesToBase64(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

async function importEncryptionKey(secret: string): Promise<CryptoKey> {
  const bytes = base64ToBytes(secret)
  if (bytes.byteLength !== 32) throw new Error('INSTAGRAM_TOKEN_ENCRYPTION_KEY must be base64 for exactly 32 bytes')
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

async function encryptToken(token: string, secret: string): Promise<{ ciphertext: string; iv: string }> {
  const key = await importEncryptionKey(secret)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(token))
  return { ciphertext: bytesToBase64(new Uint8Array(encrypted)), iv: bytesToBase64(iv) }
}

async function decryptToken(ciphertext: string, iv: string, secret: string): Promise<string> {
  const key = await importEncryptionKey(secret)
  const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(iv) }, key, base64ToBytes(ciphertext))
  return new TextDecoder().decode(clear)
}

function oauthConfig(c: any) {
  const appId = String(c.env.INSTAGRAM_APP_ID || '').trim()
  const appSecret = String(c.env.INSTAGRAM_APP_SECRET || '').trim()
  const encryptionKey = String(c.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY || '').trim()
  const apiOrigin = String(c.env.API_URL || new URL(c.req.url).origin).replace(/\/$/, '')
  const callback = `${apiOrigin}/api/v1/integrations/instagram/callback`
  return { appId, appSecret, encryptionKey, callback }
}

function htmlPage(title: string, body: string, status = 200) {
  return new Response(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font-family:Inter,system-ui,sans-serif;background:#0d0d0d;color:#fff;margin:0;min-height:100vh;display:grid;place-items:center;padding:24px}.card{max-width:560px;background:#171717;border:1px solid #333;border-radius:24px;padding:32px;text-align:center}.ok{font-size:48px;margin-bottom:12px}a{color:#fff}</style></head><body><main class="card">${body}</main></body></html>`, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' } })
}

app.get('/api/v1/integrations/instagram/connect', async (c: any) => {
  const slug = String(c.req.query('slug') || '').trim().toLowerCase()
  const invite = String(c.req.query('invite') || '').trim()
  if (!slug || !invite) return htmlPage('Enlace inválido', '<h1>Enlace de vinculación inválido</h1><p>Solicita un enlace nuevo.</p>', 400)

  const { appId, appSecret, encryptionKey, callback } = oauthConfig(c)
  if (!appId || !appSecret || !encryptionKey) {
    return htmlPage('Instagram pendiente', '<h1>Instagram OAuth aún no está configurado</h1><p>El entorno Preview necesita sus secretos de Meta antes de iniciar la vinculación.</p>', 503)
  }

  const inviteHash = await sha256Hex(invite)
  const row = await c.env.DB.prepare(
    `SELECT i.id AS invite_id, i.profile_id, i.status, i.expires_at
       FROM profile_instagram_invites i
       JOIN profiles p ON p.id = i.profile_id
      WHERE i.token_hash = ?
        AND lower(p.slug) = ?
        AND i.status IN ('active','started')
        AND i.expires_at > datetime('now')
      LIMIT 1`,
  ).bind(inviteHash, slug).first()

  if (!row) return htmlPage('Enlace vencido', '<h1>Este enlace ya no es válido</h1><p>Solicita un enlace nuevo de conexión.</p>', 410)

  const state = randomToken(32)
  const stateHash = await sha256Hex(state)
  const stateId = crypto.randomUUID()
  await c.env.DB.batch([
    c.env.DB.prepare(`DELETE FROM profile_instagram_oauth_states WHERE expires_at <= datetime('now') OR consumed_at IS NOT NULL`),
    c.env.DB.prepare(`INSERT INTO profile_instagram_oauth_states (id, profile_id, invite_id, state_hash, expires_at) VALUES (?, ?, ?, ?, datetime('now','+15 minutes'))`).bind(stateId, (row as any).profile_id, (row as any).invite_id, stateHash),
    c.env.DB.prepare(`UPDATE profile_instagram_invites SET status='started', started_at=COALESCE(started_at, datetime('now')) WHERE id=?`).bind((row as any).invite_id),
  ])

  const auth = new URL('https://www.instagram.com/oauth/authorize')
  auth.searchParams.set('client_id', appId)
  auth.searchParams.set('redirect_uri', callback)
  auth.searchParams.set('response_type', 'code')
  auth.searchParams.set('scope', 'instagram_business_basic')
  auth.searchParams.set('state', state)
  return c.redirect(auth.toString())
})

app.get('/api/v1/integrations/instagram/callback', async (c: any) => {
  const code = String(c.req.query('code') || '').trim()
  const state = String(c.req.query('state') || '').trim()
  const error = String(c.req.query('error') || '').trim()
  if (error) return htmlPage('Vinculación cancelada', '<h1>Vinculación cancelada</h1><p>No se realizó ningún cambio.</p>', 400)
  if (!code || !state) return htmlPage('Respuesta inválida', '<h1>No pudimos validar la autorización</h1>', 400)

  const { appId, appSecret, encryptionKey, callback } = oauthConfig(c)
  if (!appId || !appSecret || !encryptionKey) return htmlPage('Configuración incompleta', '<h1>Configuración incompleta</h1>', 503)

  const stateHash = await sha256Hex(state)
  const stateRow = await c.env.DB.prepare(
    `SELECT s.id, s.profile_id, s.invite_id, p.slug
       FROM profile_instagram_oauth_states s
       JOIN profiles p ON p.id = s.profile_id
      WHERE s.state_hash = ? AND s.consumed_at IS NULL AND s.expires_at > datetime('now')
      LIMIT 1`,
  ).bind(stateHash).first()
  if (!stateRow) return htmlPage('Sesión vencida', '<h1>La autorización venció o ya fue utilizada</h1><p>Solicita un enlace nuevo.</p>', 410)

  const form = new FormData()
  form.set('client_id', appId)
  form.set('client_secret', appSecret)
  form.set('grant_type', 'authorization_code')
  form.set('redirect_uri', callback)
  form.set('code', code)

  const tokenResp = await fetch('https://api.instagram.com/oauth/access_token', { method: 'POST', body: form })
  const shortPayload = await tokenResp.json().catch(() => null) as InstagramTokenPayload | null
  if (!tokenResp.ok || !shortPayload?.access_token) {
    console.error('Instagram OAuth token exchange failed', tokenResp.status, shortPayload)
    return htmlPage('Error de Instagram', '<h1>No pudimos completar la conexión</h1><p>Inténtalo nuevamente con un enlace nuevo.</p>', 502)
  }

  let accessToken = shortPayload.access_token
  let expiresIn = Number(shortPayload.expires_in || 0)
  try {
    const longUrl = new URL('https://graph.instagram.com/access_token')
    longUrl.searchParams.set('grant_type', 'ig_exchange_token')
    longUrl.searchParams.set('client_secret', appSecret)
    longUrl.searchParams.set('access_token', accessToken)
    const longResp = await fetch(longUrl.toString(), { headers: { Accept: 'application/json' } })
    const longPayload = await longResp.json().catch(() => null) as InstagramTokenPayload | null
    if (longResp.ok && longPayload?.access_token) {
      accessToken = longPayload.access_token
      expiresIn = Number(longPayload.expires_in || expiresIn)
    }
  } catch (err) {
    console.warn('Instagram long-lived exchange skipped', err)
  }

  let igUserId = String(shortPayload.user_id || '')
  let username = ''
  let accountType = ''
  try {
    const me = new URL('https://graph.instagram.com/me')
    me.searchParams.set('fields', 'id,user_id,username,account_type')
    me.searchParams.set('access_token', accessToken)
    const meResp = await fetch(me.toString(), { headers: { Accept: 'application/json' } })
    const mePayload = await meResp.json().catch(() => null) as InstagramProfilePayload | null
    if (meResp.ok && mePayload) {
      igUserId = String(mePayload.user_id || mePayload.id || igUserId)
      username = String(mePayload.username || '')
      accountType = String(mePayload.account_type || '')
    }
  } catch (err) {
    console.warn('Instagram profile lookup skipped', err)
  }

  if (!igUserId) return htmlPage('Cuenta no identificada', '<h1>No pudimos identificar la cuenta autorizada</h1>', 502)

  const encrypted = await encryptToken(accessToken, encryptionKey)
  const expiresAt = expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : null
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO profile_instagram_connections (profile_id, instagram_user_id, username, account_type, token_ciphertext, token_iv, token_expires_at, connected_at, updated_at, disconnected_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), NULL)
       ON CONFLICT(profile_id) DO UPDATE SET
         instagram_user_id=excluded.instagram_user_id,
         username=excluded.username,
         account_type=excluded.account_type,
         token_ciphertext=excluded.token_ciphertext,
         token_iv=excluded.token_iv,
         token_expires_at=excluded.token_expires_at,
         updated_at=datetime('now'),
         disconnected_at=NULL`,
    ).bind((stateRow as any).profile_id, igUserId, username || null, accountType || null, encrypted.ciphertext, encrypted.iv, expiresAt),
    c.env.DB.prepare(`UPDATE profile_instagram_oauth_states SET consumed_at=datetime('now') WHERE id=?`).bind((stateRow as any).id),
    c.env.DB.prepare(`UPDATE profile_instagram_invites SET status='used', used_at=datetime('now') WHERE id=?`).bind((stateRow as any).invite_id),
  ])

  const profileUrl = `https://preview.intaprd.com/${encodeURIComponent(String((stateRow as any).slug || 'argenisg'))}`
  return htmlPage('Instagram conectado', `<div class="ok">✓</div><h1>Instagram vinculado correctamente</h1><p>${username ? `@${username} quedó conectado al perfil Preview.` : 'La cuenta autorizada quedó conectada al perfil Preview.'}</p><p><a href="${profileUrl}">Volver al perfil</a></p>`)
})

app.get('/api/v1/public/profiles/:slug/instagram/latest', async (c: any) => {
  const slug = String(c.req.param('slug') || '').trim().toLowerCase()
  const encryptionKey = String(c.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY || '').trim()
  if (!encryptionKey) return c.json({ configured: false, items: [] }, 503)

  const row = await c.env.DB.prepare(
    `SELECT ic.instagram_user_id, ic.username, ic.token_ciphertext, ic.token_iv
       FROM profile_instagram_connections ic
       JOIN profiles p ON p.id = ic.profile_id
      WHERE lower(p.slug) = ? AND p.is_active = 1 AND ic.disconnected_at IS NULL
      LIMIT 1`,
  ).bind(slug).first()
  if (!row) return c.json({ configured: false, items: [] }, 404)

  try {
    const token = await decryptToken(String((row as any).token_ciphertext), String((row as any).token_iv), encryptionKey)
    const media = new URL(`https://graph.instagram.com/${encodeURIComponent(String((row as any).instagram_user_id))}/media`)
    media.searchParams.set('fields', 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{id,media_type,media_url,thumbnail_url,permalink}')
    media.searchParams.set('limit', '1')
    media.searchParams.set('access_token', token)
    const upstream = await fetch(media.toString(), { headers: { Accept: 'application/json' }, cf: { cacheTtl: 300, cacheEverything: true } } as RequestInit)
    const payload = await upstream.json().catch(() => null) as any
    if (!upstream.ok || !Array.isArray(payload?.data)) {
      console.error('Instagram latest upstream error', upstream.status, payload?.error || payload)
      return c.json({ configured: true, username: (row as any).username || null, items: [] }, 502)
    }
    return c.json({ configured: true, username: (row as any).username || null, items: payload.data.slice(0, 1) })
  } catch (err) {
    console.error('Instagram latest failed', err)
    return c.json({ configured: true, username: (row as any).username || null, items: [] }, 502)
  }
})
