type InstagramRefreshPayload = {
  access_token?: string
  token_type?: string
  expires_in?: number
}

type InstagramRefreshEnv = {
  DB: D1Database
  INSTAGRAM_TOKEN_ENCRYPTION_KEY?: string
}

const REFRESH_BEFORE_DAYS = 14
const MIN_TOKEN_AGE_HOURS = 24

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach((b) => { binary += String.fromCharCode(b) })
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
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

async function refreshLongLivedToken(token: string): Promise<InstagramRefreshPayload> {
  const url = new URL('https://graph.instagram.com/refresh_access_token')
  url.searchParams.set('grant_type', 'ig_refresh_token')
  url.searchParams.set('access_token', token)

  const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } })
  const payload = await response.json().catch(() => null) as InstagramRefreshPayload | null
  if (!response.ok || !payload?.access_token || !Number(payload.expires_in || 0)) {
    throw new Error(`Instagram token refresh failed (${response.status})`)
  }
  return payload
}

function tokenIsDue(expiresAt: string | null | undefined, updatedAt: string | null | undefined): boolean {
  if (!expiresAt || !updatedAt) return false
  const expiresMs = Date.parse(expiresAt)
  const updatedMs = Date.parse(updatedAt.endsWith('Z') ? updatedAt : `${updatedAt.replace(' ', 'T')}Z`)
  if (!Number.isFinite(expiresMs) || !Number.isFinite(updatedMs)) return false
  const now = Date.now()
  const minAgeMs = MIN_TOKEN_AGE_HOURS * 60 * 60 * 1000
  const refreshWindowMs = REFRESH_BEFORE_DAYS * 24 * 60 * 60 * 1000
  return now - updatedMs >= minAgeMs && expiresMs > now && expiresMs - now <= refreshWindowMs
}

export async function refreshInstagramConnectionIfDue(
  env: InstagramRefreshEnv,
  row: {
    profile_id: string
    token_ciphertext: string
    token_iv: string
    token_expires_at?: string | null
    updated_at?: string | null
  },
): Promise<{ token: string; refreshed: boolean; expiresAt?: string | null }> {
  const encryptionKey = String(env.INSTAGRAM_TOKEN_ENCRYPTION_KEY || '').trim()
  if (!encryptionKey) throw new Error('INSTAGRAM_TOKEN_ENCRYPTION_KEY is not configured')

  const currentToken = await decryptToken(String(row.token_ciphertext), String(row.token_iv), encryptionKey)
  if (!tokenIsDue(row.token_expires_at, row.updated_at)) {
    return { token: currentToken, refreshed: false, expiresAt: row.token_expires_at || null }
  }

  const payload = await refreshLongLivedToken(currentToken)
  const newToken = String(payload.access_token)
  const expiresIn = Number(payload.expires_in || 0)
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()
  const encrypted = await encryptToken(newToken, encryptionKey)

  await env.DB.prepare(
    `UPDATE profile_instagram_connections
        SET token_ciphertext=?, token_iv=?, token_expires_at=?, updated_at=datetime('now')
      WHERE profile_id=? AND disconnected_at IS NULL`,
  ).bind(encrypted.ciphertext, encrypted.iv, expiresAt, row.profile_id).run()

  return { token: newToken, refreshed: true, expiresAt }
}

export async function refreshDueInstagramConnections(env: InstagramRefreshEnv): Promise<{ checked: number; refreshed: number; failed: number }> {
  const encryptionKey = String(env.INSTAGRAM_TOKEN_ENCRYPTION_KEY || '').trim()
  if (!encryptionKey) {
    console.warn('Instagram scheduled refresh skipped: encryption key missing')
    return { checked: 0, refreshed: 0, failed: 0 }
  }

  const rows = await env.DB.prepare(
    `SELECT profile_id, token_ciphertext, token_iv, token_expires_at, updated_at
       FROM profile_instagram_connections
      WHERE disconnected_at IS NULL
        AND token_expires_at IS NOT NULL
        AND token_expires_at > datetime('now')
        AND token_expires_at <= datetime('now', '+14 days')
        AND updated_at <= datetime('now', '-1 day')`,
  ).all()

  let refreshed = 0
  let failed = 0
  const items = Array.isArray((rows as any)?.results) ? (rows as any).results : []

  for (const row of items) {
    try {
      const result = await refreshInstagramConnectionIfDue(env, row as any)
      if (result.refreshed) refreshed += 1
    } catch (error) {
      failed += 1
      console.error('Instagram scheduled token refresh failed', (row as any).profile_id, error)
    }
  }

  console.log('Instagram token refresh cycle', { checked: items.length, refreshed, failed })
  return { checked: items.length, refreshed, failed }
}
