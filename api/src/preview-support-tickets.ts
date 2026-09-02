import app from './preview-entry'
import { cookieNames } from './lib/cookies'
import { requireSuperAdmin } from './lib/admin-auth'
import { sendSupportResponseEmail } from './lib/email'

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
const VALID_CHANNELS = new Set(['system', 'email', 'whatsapp'])

async function addEvent(db: D1Database, ticketId: string, eventType: string, statusKey: string, actorType: string, message?: string | null, channel?: string | null) {
  await db.prepare(
    `INSERT INTO support_ticket_events (id, ticket_id, event_type, status_key, message, channel, actor_type, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
  ).bind(crypto.randomUUID(), ticketId, eventType, statusKey, message || null, channel || null, actorType).run()
}

async function addNotification(
  db: D1Database,
  input: {
    userId: string
    profileId?: string | null
    type: string
    title: string
    message: string
    sourceType?: string | null
    sourceId?: string | null
    actionLabel?: string | null
    actionUrl?: string | null
  },
) {
  await db.prepare(
    `INSERT INTO user_notifications
      (id, user_id, profile_id, type, title, message, source_type, source_id, action_label, action_url, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
  ).bind(
    crypto.randomUUID(), input.userId, input.profileId || null, input.type,
    input.title, input.message, input.sourceType || null, input.sourceId || null,
    input.actionLabel || null, input.actionUrl || null,
  ).run()
}

async function loadUserTicket(db: D1Database, ticketId: string, userId: string) {
  const ticket = await db.prepare(
    `SELECT id, category, subject, message, status, priority, source_path, admin_note,
            response_channel, responded_at, created_at, updated_at, resolved_at
       FROM support_tickets
      WHERE id = ? AND user_id = ? LIMIT 1`,
  ).bind(ticketId, userId).first()
  if (!ticket) return null
  const events = await db.prepare(
    `SELECT id, event_type, status_key, message, channel, actor_type, created_at
       FROM support_ticket_events WHERE ticket_id = ? ORDER BY created_at ASC`,
  ).bind(ticketId).all()
  return { ...(ticket as any), events: events.results || [] }
}

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
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO support_tickets
        (id, user_id, profile_id, category, subject, message, status, priority, source_path, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'open', 'normal', ?, datetime('now'), datetime('now'))`,
    ).bind(id, userId, (profile as any)?.id || null, category, subjectLabels[category], message, sourcePath || null),
    c.env.DB.prepare(
      `INSERT INTO support_ticket_events (id, ticket_id, event_type, status_key, message, actor_type, created_at)
       VALUES (?, ?, 'submitted', 'submitted', 'Solicitud enviada por el usuario.', 'user', datetime('now'))`,
    ).bind(crypto.randomUUID(), id),
    c.env.DB.prepare(
      `INSERT INTO support_ticket_events (id, ticket_id, event_type, status_key, message, actor_type, created_at)
       VALUES (?, ?, 'received', 'received', 'Solicitud recibida por Soporte Kawvo.', 'system', datetime('now'))`,
    ).bind(crypto.randomUUID(), id),
  ])

  return c.json({ ok: true, data: { id, reference: `K-${id.slice(0, 8).toUpperCase()}`, status: 'open' } }, 201)
})

app.get('/api/v1/me/support-tickets', requirePreviewAuth, async (c: any) => {
  const userId = c.get('userId') as string
  const rows = await c.env.DB.prepare(
    `SELECT id, category, subject, message, status, priority, source_path, admin_note,
            response_channel, responded_at, created_at, updated_at, resolved_at
       FROM support_tickets
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 20`,
  ).bind(userId).all()

  const items = [] as any[]
  for (const row of rows.results || []) {
    const detail = await loadUserTicket(c.env.DB, String((row as any).id), userId)
    if (detail) items.push(detail)
  }
  return c.json({ ok: true, data: { items } })
})

app.get('/api/v1/me/support-tickets/:id', requirePreviewAuth, async (c: any) => {
  const userId = c.get('userId') as string
  const id = String(c.req.param('id') || '').trim()
  const detail = await loadUserTicket(c.env.DB, id, userId)
  if (!detail) return c.json({ ok: false, error: 'Ticket no encontrado.' }, 404)
  return c.json({ ok: true, data: detail })
})

app.post('/api/v1/me/support-tickets/:id/reply', requirePreviewAuth, async (c: any) => {
  const userId = c.get('userId') as string
  const id = String(c.req.param('id') || '').trim()
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Invalid JSON' }, 400) }
  const message = String(body.message || '').trim().slice(0, 1200)
  if (message.length < 2) return c.json({ ok: false, error: 'Escribe tu respuesta antes de enviarla.' }, 400)

  const ticket = await c.env.DB.prepare(
    `SELECT id, status FROM support_tickets WHERE id = ? AND user_id = ? LIMIT 1`,
  ).bind(id, userId).first()
  if (!ticket) return c.json({ ok: false, error: 'Ticket no encontrado.' }, 404)

  await c.env.DB.prepare(
    `UPDATE support_tickets
        SET status = 'in_progress', resolved_at = NULL, updated_at = datetime('now')
      WHERE id = ?`,
  ).bind(id).run()
  await addEvent(c.env.DB, id, 'user_reply', 'user_reply', 'user', message, 'system')

  return c.json({ ok: true, data: await loadUserTicket(c.env.DB, id, userId) })
})

app.get('/api/v1/me/notifications', requirePreviewAuth, async (c: any) => {
  const userId = c.get('userId') as string
  const limit = Math.min(50, Math.max(1, Number(c.req.query('limit') || 30)))
  const [rows, unread] = await Promise.all([
    c.env.DB.prepare(
      `SELECT id, type, title, message, image_url, source_type, source_id, action_label, action_url, read_at, created_at
         FROM user_notifications
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?`,
    ).bind(userId, limit).all(),
    c.env.DB.prepare(
      `SELECT COUNT(*) AS n FROM user_notifications WHERE user_id = ? AND read_at IS NULL`,
    ).bind(userId).first(),
  ])
  return c.json({ ok: true, data: { items: rows.results || [], unread_count: Number((unread as any)?.n || 0) } })
})

app.patch('/api/v1/me/notifications/:id/read', requirePreviewAuth, async (c: any) => {
  const userId = c.get('userId') as string
  const id = String(c.req.param('id') || '').trim()
  await c.env.DB.prepare(
    `UPDATE user_notifications SET read_at = COALESCE(read_at, datetime('now')) WHERE id = ? AND user_id = ?`,
  ).bind(id, userId).run()
  return c.json({ ok: true })
})

app.patch('/api/v1/me/notifications/read-all', requirePreviewAuth, async (c: any) => {
  const userId = c.get('userId') as string
  await c.env.DB.prepare(
    `UPDATE user_notifications SET read_at = COALESCE(read_at, datetime('now')) WHERE user_id = ?`,
  ).bind(userId).run()
  return c.json({ ok: true })
})

app.post('/api/v1/superadmin/notifications', requireSuperAdmin('support'), async (c: any) => {
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Invalid JSON' }, 400) }
  const userId = String(body.user_id || '').trim()
  const profileId = body.profile_id ? String(body.profile_id).trim() : null
  const title = String(body.title || '').trim().slice(0, 140)
  const message = String(body.message || '').trim().slice(0, 1000)
  const actionLabel = body.action_label ? String(body.action_label).trim().slice(0, 80) : null
  const actionUrl = body.action_url ? String(body.action_url).trim().slice(0, 500) : null
  if (!userId) return c.json({ ok: false, error: 'Selecciona un usuario.' }, 400)
  if (title.length < 2 || message.length < 2) return c.json({ ok: false, error: 'Título y mensaje son obligatorios.' }, 400)
  const user = await c.env.DB.prepare(`SELECT id FROM users WHERE id = ? LIMIT 1`).bind(userId).first()
  if (!user) return c.json({ ok: false, error: 'Usuario no encontrado.' }, 404)
  await addNotification(c.env.DB, {
    userId, profileId, type: 'system_promo', title, message,
    sourceType: 'system', sourceId: null, actionLabel, actionUrl,
  })
  return c.json({ ok: true })
})

app.get('/api/v1/superadmin/support-tickets', requireSuperAdmin('support'), async (c: any) => {
  const status = String(c.req.query('status') || '').trim()
  const where = status && VALID_STATUSES.has(status) ? 'WHERE t.status = ?' : ''
  const query = `SELECT t.id, t.category, t.subject, t.message, t.status, t.priority,
                        t.source_path, t.admin_note, t.response_channel, t.responded_at,
                        t.created_at, t.updated_at, t.resolved_at,
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

app.get('/api/v1/superadmin/support-tickets/:id', requireSuperAdmin('support'), async (c: any) => {
  const id = String(c.req.param('id') || '').trim()
  const ticket = await c.env.DB.prepare(
    `SELECT t.*, u.email AS user_email, p.slug AS profile_slug, p.name AS profile_name,
            COALESCE(NULLIF(pc.whatsapp, ''), NULLIF(pc.phone, '')) AS user_phone,
            pc.email AS profile_email
       FROM support_tickets t
       JOIN users u ON u.id = t.user_id
  LEFT JOIN profiles p ON p.id = t.profile_id
  LEFT JOIN profile_contact pc ON pc.profile_id = p.id
      WHERE t.id = ? LIMIT 1`,
  ).bind(id).first()
  if (!ticket) return c.json({ ok: false, error: 'Ticket no encontrado.' }, 404)
  const events = await c.env.DB.prepare(
    `SELECT id, event_type, status_key, message, channel, actor_type, created_at
       FROM support_ticket_events WHERE ticket_id = ? ORDER BY created_at ASC`,
  ).bind(id).all()
  return c.json({ ok: true, data: { ...(ticket as any), events: events.results || [] } })
})

app.patch('/api/v1/superadmin/support-tickets/:id', requireSuperAdmin('support'), async (c: any) => {
  const id = String(c.req.param('id') || '').trim()
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Invalid JSON' }, 400) }

  const status = String(body.status || '').trim()
  if (status && !VALID_STATUSES.has(status)) return c.json({ ok: false, error: 'Estado inválido.' }, 400)
  const adminNote = body.admin_note === undefined ? undefined : String(body.admin_note || '').trim().slice(0, 1600)

  const existing = await c.env.DB.prepare(`SELECT id, status FROM support_tickets WHERE id = ? LIMIT 1`).bind(id).first()
  if (!existing) return c.json({ ok: false, error: 'Ticket no encontrado.' }, 404)

  await c.env.DB.prepare(
    `UPDATE support_tickets SET
       status = COALESCE(?, status),
       admin_note = COALESCE(?, admin_note),
       resolved_at = CASE WHEN ? = 'resolved' THEN datetime('now') WHEN ? IN ('open','in_progress') THEN NULL ELSE resolved_at END,
       updated_at = datetime('now')
     WHERE id = ?`,
  ).bind(status || null, adminNote === undefined ? null : adminNote, status || null, status || null, id).run()

  if (status && status !== (existing as any).status) {
    if (status === 'in_progress') await addEvent(c.env.DB, id, 'status', 'in_progress', 'support', 'El equipo de soporte comenzó a trabajar tu solicitud.')
    if (status === 'resolved') await addEvent(c.env.DB, id, 'status', 'responded', 'support', adminNote || 'Soporte respondió tu solicitud.', 'system')
    if (status === 'closed') await addEvent(c.env.DB, id, 'status', 'closed', 'support', 'Ticket cerrado por Soporte Kawvo.')
    if (status === 'open') await addEvent(c.env.DB, id, 'status', 'received', 'support', 'Ticket devuelto a la cola de soporte.')
  }

  return c.json({ ok: true })
})

app.post('/api/v1/superadmin/support-tickets/:id/respond', requireSuperAdmin('support'), async (c: any) => {
  const id = String(c.req.param('id') || '').trim()
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Invalid JSON' }, 400) }
  const channel = String(body.channel || '').trim().toLowerCase()
  const response = String(body.message || '').trim().slice(0, 1600)
  if (!VALID_CHANNELS.has(channel)) return c.json({ ok: false, error: 'Selecciona un canal de respuesta.' }, 400)
  if (response.length < 2) return c.json({ ok: false, error: 'Escribe la respuesta antes de enviarla.' }, 400)

  const ticket = await c.env.DB.prepare(
    `SELECT t.id, t.user_id, t.profile_id, t.subject, u.email AS user_email,
            COALESCE(NULLIF(pc.whatsapp, ''), NULLIF(pc.phone, '')) AS user_phone
       FROM support_tickets t
       JOIN users u ON u.id = t.user_id
  LEFT JOIN profiles p ON p.id = t.profile_id
  LEFT JOIN profile_contact pc ON pc.profile_id = p.id
      WHERE t.id = ? LIMIT 1`,
  ).bind(id).first()
  if (!ticket) return c.json({ ok: false, error: 'Ticket no encontrado.' }, 404)

  let whatsappUrl: string | null = null
  if (channel === 'email') {
    const email = String((ticket as any).user_email || '').trim()
    if (!email) return c.json({ ok: false, error: 'El usuario no tiene correo disponible.' }, 400)
    if (!c.env.RESEND_API_KEY) return c.json({ ok: false, error: 'El envío de correo no está configurado.' }, 503)
    await sendSupportResponseEmail(
      { RESEND_API_KEY: c.env.RESEND_API_KEY, RESEND_FROM: c.env.RESEND_FROM },
      email,
      {
        reference: `K-${id.slice(0, 8).toUpperCase()}`,
        subject: String((ticket as any).subject || 'Solicitud de soporte'),
        response,
        appUrl: `${String(c.env.APP_URL || 'https://app.intaprd.com').replace(/\/$/, '')}/admin/free`,
      },
    )
  }

  if (channel === 'whatsapp') {
    const phone = String((ticket as any).user_phone || '').replace(/\D/g, '')
    if (!phone) return c.json({ ok: false, error: 'El usuario no tiene WhatsApp o teléfono disponible.' }, 400)
    whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(`Soporte Kawvo · K-${id.slice(0, 8).toUpperCase()}\n\n${response}`)}`
  }

  await c.env.DB.prepare(
    `UPDATE support_tickets
        SET admin_note = ?, response_channel = ?, responded_at = datetime('now'),
            status = 'resolved', resolved_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?`,
  ).bind(response, channel, id).run()
  await addEvent(c.env.DB, id, 'response', 'responded', 'support', response, channel)
  await addNotification(c.env.DB, {
    userId: String((ticket as any).user_id),
    profileId: (ticket as any).profile_id || null,
    type: 'support_response',
    title: 'Soporte Kawvo respondió tu solicitud',
    message: response,
    sourceType: 'support_ticket',
    sourceId: id,
    actionLabel: 'Ver respuesta',
    actionUrl: null,
  })

  return c.json({ ok: true, data: { status: 'resolved', channel, whatsapp_url: whatsappUrl } })
})
