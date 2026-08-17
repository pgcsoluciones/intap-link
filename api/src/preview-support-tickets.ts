import app from './preview-entry'
import { cookieNames } from './lib/cookies'
import { requireSuperAdmin } from './lib/admin-auth'

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

async function requirePreviewAuth(c: any, next: any) {
  const rawSession = parseCookie(c.req.header('Cookie') || '', cookieNames(c.env).session)
  if (!rawSession) return c.json({ ok: false, error: 'Unauthorized' }, 401)

  const sessionHash = await sha256Hex(rawSession)
  const session = await c.env.DB.prepare(
    `SELECT user_id FROM auth_sessions
      WHERE session_hash = ? AND expires_at > datetime('now') AND revoked_at IS NULL
      LIMIT 1`,
  ).bind(sessionHash).first()

  if (!session) return c.json({ ok: false, error: 'Unauthorized' }, 401)
  c.set('userId', (session as any).user_id)
  await next()
}

const VALID_CATEGORIES = new Set(['editor', 'publicacion', 'producto', 'cuenta', 'otro'])
const VALID_STATUSES = new Set(['open', 'in_progress', 'resolved', 'closed'])

app.post('/api/v1/me/support-tickets', requirePreviewAuth, async (c: any) => {
  const userId = c.get('userId') as string
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Invalid JSON' }, 400) }

  const category = VALID_CATEGORIES.has(String(body.category || '')) ? String(body.category) : 'otro'
  const message = String(body.message || '').trim()
  const sourcePath = String(body.source_path || '').trim().slice(0, 240)

  if (message.length < 8) return c.json({ ok: false, error: 'Cuéntanos un poco más para poder ayudarte.' }, 400)
  if (message.length > 1200) return c.json({ ok: false, error: 'El mensaje es demasiado largo.' }, 400)

  const profile = await c.env.DB.prepare(
    `SELECT id, slug FROM profiles WHERE user_id = ? LIMIT 1`,
  ).bind(userId).first()

  const subjectLabels: Record<string, string> = {
    editor: 'Duda sobre edición',
    publicacion: 'Duda sobre publicación',
    producto: 'Duda sobre producto Kawvo',
    cuenta: 'Duda sobre mi cuenta',
    otro: 'Solicitud de ayuda',
  }

  const id = crypto.randomUUID()
  await c.env.DB.prepare(
    `INSERT INTO support_tickets
      (id, user_id, profile_id, category, subject, message, status, priority, source_path, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'open', 'normal', ?, datetime('now'), datetime('now'))`,
  ).bind(id, userId, (profile as any)?.id || null, category, subjectLabels[category], message, sourcePath || null).run()

  return c.json({ ok: true, data: { id, reference: `K-${id.slice(0, 8).toUpperCase()}`, status: 'open' } }, 201)
})

app.get('/api/v1/me/support-tickets', requirePreviewAuth, async (c: any) => {
  const userId = c.get('userId') as string
  const rows = await c.env.DB.prepare(
    `SELECT id, category, subject, message, status, priority, source_path, admin_note, created_at, updated_at, resolved_at
       FROM support_tickets
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 20`,
  ).bind(userId).all()
  return c.json({ ok: true, data: { items: rows.results || [] } })
})

app.get('/api/v1/superadmin/support-tickets', requireSuperAdmin('support'), async (c: any) => {
  const status = String(c.req.query('status') || '').trim()
  const where = status && VALID_STATUSES.has(status) ? 'WHERE t.status = ?' : ''
  const query = `SELECT t.id, t.category, t.subject, t.message, t.status, t.priority,
                        t.source_path, t.admin_note, t.created_at, t.updated_at, t.resolved_at,
                        u.email AS user_email,
                        p.slug AS profile_slug,
                        p.name AS profile_name,
                        COALESCE(NULLIF(pc.whatsapp, ''), NULLIF(pc.phone, '')) AS user_phone,
                        pc.email AS profile_email
                   FROM support_tickets t
                   JOIN users u ON u.id = t.user_id
              LEFT JOIN profiles p ON p.id = t.profile_id
              LEFT JOIN profile_contact pc ON pc.profile_id = p.id
                  ${where}
               ORDER BY CASE t.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
                        t.created_at DESC
                  LIMIT 100`
  const rows = status && VALID_STATUSES.has(status)
    ? await c.env.DB.prepare(query).bind(status).all()
    : await c.env.DB.prepare(query).all()

  const openCount = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM support_tickets WHERE status IN ('open','in_progress')`,
  ).first()

  return c.json({ ok: true, data: { items: rows.results || [], open_count: Number((openCount as any)?.n || 0) } })
})

app.patch('/api/v1/superadmin/support-tickets/:id', requireSuperAdmin('support'), async (c: any) => {
  const id = String(c.req.param('id') || '').trim()
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Invalid JSON' }, 400) }

  const status = String(body.status || '').trim()
  if (status && !VALID_STATUSES.has(status)) return c.json({ ok: false, error: 'Estado inválido.' }, 400)
  const adminNote = body.admin_note === undefined ? undefined : String(body.admin_note || '').trim().slice(0, 1600)

  const existing = await c.env.DB.prepare(`SELECT id FROM support_tickets WHERE id = ? LIMIT 1`).bind(id).first()
  if (!existing) return c.json({ ok: false, error: 'Ticket no encontrado.' }, 404)

  await c.env.DB.prepare(
    `UPDATE support_tickets SET
       status = COALESCE(?, status),
       admin_note = COALESCE(?, admin_note),
       resolved_at = CASE WHEN ? = 'resolved' THEN datetime('now') WHEN ? IN ('open','in_progress') THEN NULL ELSE resolved_at END,
       updated_at = datetime('now')
     WHERE id = ?`,
  ).bind(status || null, adminNote === undefined ? null : adminNote, status || null, status || null, id).run()

  return c.json({ ok: true })
})
