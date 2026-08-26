import app from './preview-entry'
import { cookieNames } from './lib/cookies'

const PREVIEW_SESSION_COOKIE = 'kawvo_preview_session'
const PREVIEW_SESSION_TTL_SECONDS = 15 * 60

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map((value) => value.toString(16).padStart(2, '0')).join('')
}

function generateToken(bytes = 32): string {
  const array = new Uint8Array(bytes)
  crypto.getRandomValues(array)
  return Array.from(array).map((value) => value.toString(16).padStart(2, '0')).join('')
}

function parseCookie(header: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = header.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

async function requireProfileOwner(c: any, next: any) {
  const rawSession = parseCookie(c.req.header('Cookie') || '', cookieNames(c.env).session)
  if (!rawSession) return c.text('Unauthorized', 401)

  const sessionHash = await sha256Hex(rawSession)
  const session = await c.env.DB.prepare(
    `SELECT user_id FROM auth_sessions
      WHERE session_hash = ? AND expires_at > datetime('now') AND revoked_at IS NULL
      LIMIT 1`,
  ).bind(sessionHash).first()
  if (!session) return c.text('Unauthorized', 401)

  c.set('userId', String((session as any).user_id || ''))
  await next()
}

function previewSessionCookie(value: string, maxAge: number) {
  return `${PREVIEW_SESSION_COOKIE}=${encodeURIComponent(value)}; Domain=.preview.intaprd.com; Path=/; Max-Age=${maxAge}; Secure; HttpOnly; SameSite=Lax`
}

app.get('/api/v1/me/free/profile-preview/:slug', requireProfileOwner, async (c: any) => {
  const userId = c.get('userId') as string
  const slug = String(c.req.param('slug') || '').trim()
  if (!slug || !/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(slug)) return c.text('Perfil no válido.', 400)

  const owned = await c.env.DB.prepare(
    `SELECT id FROM profiles WHERE user_id = ? AND slug = ? LIMIT 1`,
  ).bind(userId, slug).first()
  if (!owned) return c.text('Perfil no encontrado.', 404)

  const profileId = String((owned as any).id || '')
  const rawToken = generateToken(32)
  const tokenHash = await sha256Hex(rawToken)
  const sessionId = crypto.randomUUID()

  await c.env.DB.prepare(
    `DELETE FROM profile_preview_sessions WHERE expires_at <= datetime('now')`,
  ).run().catch(() => undefined)

  await c.env.DB.prepare(
    `INSERT INTO profile_preview_sessions (id, profile_id, token_hash, expires_at, created_at)
     VALUES (?, ?, ?, datetime('now', '+15 minutes'), datetime('now'))`,
  ).bind(sessionId, profileId, tokenHash).run()

  const publicWebOrigin = String(c.env.WEB_URL || 'https://preview.intaprd.com').replace(/\/$/, '')
  const target = `${publicWebOrigin}/${encodeURIComponent(slug)}?preview=1&embedded=1`
  const headers = new Headers()
  headers.set('Location', target)
  headers.set('Cache-Control', 'no-store')
  headers.set('Set-Cookie', previewSessionCookie(rawToken, PREVIEW_SESSION_TTL_SECONDS))

  return new Response(null, { status: 302, headers })
})

export default app
