import app from './preview-entry'
import { cookieNames } from './lib/cookies'
import { requireSuperAdmin } from './lib/admin-auth'

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
}

function parseCookie(header: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = header.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

async function requireAccountAuth(c: any, next: any) {
  const rawSession = parseCookie(c.req.header('Cookie') || '', cookieNames(c.env).session)
  if (!rawSession) return c.json({ ok: false, error: 'Unauthorized' }, 401)

  const sessionHash = await sha256Hex(rawSession)
  const session = await c.env.DB.prepare(
    `SELECT id, user_id
       FROM auth_sessions
      WHERE session_hash = ?
        AND expires_at > datetime('now')
        AND revoked_at IS NULL
      LIMIT 1`,
  ).bind(sessionHash).first()

  if (!session) return c.json({ ok: false, error: 'Unauthorized' }, 401)
  c.set('userId', String((session as any).user_id || ''))
  c.set('accountSessionHash', sessionHash)
  c.set('accountSessionId', String((session as any).id || ''))
  await next()
}

function deviceLabel(userAgent: string) {
  const ua = userAgent.toLowerCase()
  const os = ua.includes('iphone') ? 'iPhone'
    : ua.includes('ipad') ? 'iPad'
    : ua.includes('android') ? 'Android'
    : ua.includes('mac os') || ua.includes('macintosh') ? 'Mac'
    : ua.includes('windows') ? 'Windows'
    : ua.includes('linux') ? 'Linux'
    : 'Dispositivo'

  const browser = ua.includes('edg/') ? 'Edge'
    : ua.includes('chrome/') && !ua.includes('chromium') ? 'Chrome'
    : ua.includes('firefox/') ? 'Firefox'
    : ua.includes('safari/') && !ua.includes('chrome/') ? 'Safari'
    : 'Navegador'

  return `${os} · ${browser}`
}

app.get('/api/v1/me/account/sessions', requireAccountAuth, async (c: any) => {
  const userId = c.get('userId') as string
  const currentSessionId = c.get('accountSessionId') as string
  const rows = await c.env.DB.prepare(
    `SELECT id, created_at, expires_at, user_agent
       FROM auth_sessions
      WHERE user_id = ?
        AND revoked_at IS NULL
        AND expires_at > datetime('now')
      ORDER BY created_at DESC
      LIMIT 20`,
  ).bind(userId).all()

  const items = (rows.results || []).map((row: any) => ({
    id: String(row.id || ''),
    label: deviceLabel(String(row.user_agent || '')),
    user_agent: String(row.user_agent || ''),
    created_at: row.created_at || null,
    expires_at: row.expires_at || null,
    is_current: String(row.id || '') === currentSessionId,
  }))

  return c.json({ ok: true, data: { items } })
})

app.delete('/api/v1/me/account/sessions/:id', requireAccountAuth, async (c: any) => {
  const userId = c.get('userId') as string
  const currentSessionId = c.get('accountSessionId') as string
  const sessionId = String(c.req.param('id') || '').trim()
  if (!sessionId) return c.json({ ok: false, error: 'Sesión no válida.' }, 400)
  if (sessionId === currentSessionId) {
    return c.json({ ok: false, error: 'Usa “Salir” para cerrar la sesión de este dispositivo.' }, 400)
  }

  const result = await c.env.DB.prepare(
    `UPDATE auth_sessions
        SET revoked_at = datetime('now')
      WHERE id = ? AND user_id = ? AND revoked_at IS NULL`,
  ).bind(sessionId, userId).run()

  return c.json({ ok: true, revoked: Number((result as any)?.meta?.changes || 0) > 0 })
})

app.delete('/api/v1/me/notifications/:id', requireAccountAuth, async (c: any) => {
  const userId = c.get('userId') as string
  const id = String(c.req.param('id') || '').trim()
  if (!id) return c.json({ ok: false, error: 'Notificación no válida.' }, 400)

  const result = await c.env.DB.prepare(
    `DELETE FROM user_notifications WHERE id = ? AND user_id = ?`,
  ).bind(id, userId).run()

  return c.json({ ok: true, deleted: Number((result as any)?.meta?.changes || 0) > 0 })
})

app.get('/api/v1/me/account/resources', requireAccountAuth, async (c: any) => {
  const rows = await c.env.DB.prepare(
    `SELECT id, title, description, url, category, sort_order
       FROM account_resources
      WHERE is_active = 1
      ORDER BY sort_order ASC, created_at DESC`,
  ).all()

  return c.json({ ok: true, data: { items: rows.results || [] } })
})

app.get('/api/v1/superadmin/account-resources', requireSuperAdmin('viewer'), async (c: any) => {
  const rows = await c.env.DB.prepare(
    `SELECT id, title, description, url, category, is_active, sort_order, created_at, updated_at
       FROM account_resources
      ORDER BY sort_order ASC, created_at DESC`,
  ).all()
  return c.json({ ok: true, data: { items: rows.results || [] } })
})

app.post('/api/v1/superadmin/account-resources', requireSuperAdmin('super_admin'), async (c: any) => {
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Datos inválidos.' }, 400) }

  const title = String(body?.title || '').trim().slice(0, 120)
  const description = String(body?.description || '').trim().slice(0, 600)
  const url = String(body?.url || '').trim().slice(0, 1200)
  const category = String(body?.category || 'general').trim().slice(0, 60) || 'general'
  const sortOrder = Number.isFinite(Number(body?.sort_order)) ? Math.trunc(Number(body.sort_order)) : 0
  const isActive = body?.is_active === false || body?.is_active === 0 ? 0 : 1

  if (!title || !/^https?:\/\//i.test(url)) {
    return c.json({ ok: false, error: 'Completa un título y una URL válida.' }, 400)
  }

  const id = crypto.randomUUID()
  await c.env.DB.prepare(
    `INSERT INTO account_resources
       (id, title, description, url, category, is_active, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
  ).bind(id, title, description || null, url, category, isActive, sortOrder).run()

  return c.json({ ok: true, data: { id } })
})

app.put('/api/v1/superadmin/account-resources/:id', requireSuperAdmin('super_admin'), async (c: any) => {
  const id = String(c.req.param('id') || '').trim()
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Datos inválidos.' }, 400) }

  const title = String(body?.title || '').trim().slice(0, 120)
  const description = String(body?.description || '').trim().slice(0, 600)
  const url = String(body?.url || '').trim().slice(0, 1200)
  const category = String(body?.category || 'general').trim().slice(0, 60) || 'general'
  const sortOrder = Number.isFinite(Number(body?.sort_order)) ? Math.trunc(Number(body.sort_order)) : 0
  const isActive = body?.is_active === false || body?.is_active === 0 ? 0 : 1

  if (!id || !title || !/^https?:\/\//i.test(url)) {
    return c.json({ ok: false, error: 'Completa un título y una URL válida.' }, 400)
  }

  await c.env.DB.prepare(
    `UPDATE account_resources
        SET title = ?, description = ?, url = ?, category = ?, is_active = ?, sort_order = ?, updated_at = datetime('now')
      WHERE id = ?`,
  ).bind(title, description || null, url, category, isActive, sortOrder, id).run()

  return c.json({ ok: true })
})

app.delete('/api/v1/superadmin/account-resources/:id', requireSuperAdmin('super_admin'), async (c: any) => {
  const id = String(c.req.param('id') || '').trim()
  if (!id) return c.json({ ok: false, error: 'Recurso no válido.' }, 400)
  await c.env.DB.prepare(`DELETE FROM account_resources WHERE id = ?`).bind(id).run()
  return c.json({ ok: true })
})

export default app
