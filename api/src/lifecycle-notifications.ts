import app from './preview-entry'
import { cookieNames } from './lib/cookies'

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map((value) => value.toString(16).padStart(2, '0')).join('')
}

function parseCookie(header: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = header.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

async function requireLifecycleAuth(c: any, next: any) {
  const rawSession = parseCookie(c.req.header('Cookie') || '', cookieNames(c.env).session)
  if (!rawSession) return c.json({ ok: false, error: 'Unauthorized' }, 401)

  const sessionHash = await sha256Hex(rawSession)
  const session = await c.env.DB.prepare(
    `SELECT user_id FROM auth_sessions
      WHERE session_hash = ? AND expires_at > datetime('now') AND revoked_at IS NULL
      LIMIT 1`,
  ).bind(sessionHash).first()

  if (!session) return c.json({ ok: false, error: 'Unauthorized' }, 401)
  c.set('userId', String((session as any).user_id || ''))
  await next()
}

async function createLifecycleNotification(c: any, input: {
  type: 'profile_welcome' | 'profile_first_published'
  title: string
  message: string
  actionLabel: string
  actionUrl: string
}) {
  const userId = c.get('userId') as string
  const profile = await c.env.DB.prepare(`SELECT id FROM profiles WHERE user_id = ? LIMIT 1`).bind(userId).first()
  const profileId = profile ? String((profile as any).id || '') || null : null

  await c.env.DB.prepare(
    `INSERT INTO user_notifications
       (id, user_id, profile_id, type, title, message, source_type, action_label, action_url, created_at)
     SELECT ?, ?, ?, ?, ?, ?, 'lifecycle', ?, ?, datetime('now')
      WHERE NOT EXISTS (
        SELECT 1 FROM user_notifications WHERE user_id = ? AND type = ?
      )`,
  ).bind(
    crypto.randomUUID(), userId, profileId, input.type, input.title, input.message,
    input.actionLabel, input.actionUrl, userId, input.type,
  ).run()

  return c.json({ ok: true })
}

app.post('/api/v1/me/notifications/welcome', requireLifecycleAuth, async (c: any) => {
  return createLifecycleNotification(c, {
    type: 'profile_welcome',
    title: '¡Bienvenido a Kawvo Link!',
    message: 'Tu perfil está listo para completar. Agrega tu presentación, tus datos de contacto, tus trabajos y tus servicios.',
    actionLabel: 'Completar mi perfil',
    actionUrl: '/admin/free',
  })
})

app.post('/api/v1/me/notifications/profile-published', requireLifecycleAuth, async (c: any) => {
  const userId = c.get('userId') as string
  const profile = await c.env.DB.prepare(`SELECT id, is_published FROM profiles WHERE user_id = ? LIMIT 1`).bind(userId).first()
  if (!profile || Number((profile as any).is_published || 0) !== 1) {
    return c.json({ ok: false, error: 'El perfil todavía no está publicado.' }, 409)
  }

  return createLifecycleNotification(c, {
    type: 'profile_first_published',
    title: '¡Tu perfil ya está publicado!',
    message: 'Tu perfil ya está disponible para compartir por enlace, WhatsApp, QR o NFC.',
    actionLabel: 'Ir a mi perfil',
    actionUrl: '/admin/free',
  })
})

export default app
