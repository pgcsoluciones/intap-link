import app from './preview-entry'
import { cookieNames } from './lib/cookies'

function parseCookie(header: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = header.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash)).map((value) => value.toString(16).padStart(2, '0')).join('')
}

app.use('/api/v1/me/ai-profile-assistant/*', async (c: any, next: any) => {
  const rawSession = parseCookie(c.req.header('Cookie') || '', cookieNames(c.env).session)
  if (!rawSession) return next()

  const sessionHash = await sha256Hex(rawSession)
  const session = await c.env.DB.prepare(
    `SELECT user_id
       FROM auth_sessions
      WHERE session_hash = ?
        AND expires_at > datetime('now')
        AND revoked_at IS NULL
      LIMIT 1`,
  ).bind(sessionHash).first()
  if (!session) return next()

  try {
    const suspended = await c.env.DB.prepare(
      `SELECT reason_code, expires_at
         FROM ai_assistant_access_controls
        WHERE user_id = ?
          AND status = 'suspended'
          AND (expires_at IS NULL OR expires_at > datetime('now'))
        LIMIT 1`,
    ).bind(String((session as any).user_id || '')).first()

    if (suspended) {
      return c.json({
        ok: false,
        error: 'El acceso al Asistente IA no está disponible temporalmente para esta cuenta.',
        code: 'assistant_access_suspended',
      }, 403)
    }
  } catch {
    // Migration/setup failures are handled by the assistant endpoints themselves.
    // Do not turn a missing access-control table into an authentication failure.
  }

  return next()
})
