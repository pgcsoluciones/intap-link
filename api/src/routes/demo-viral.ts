import { requireSuperAdmin } from '../lib/admin-auth'

const SHARE_TTL_HOURS = 24
const MAX_SNAPSHOT_JSON_BYTES = 64 * 1024
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const PUBLIC_EVENT_TYPES = new Set([
  'demo_started',
  'sector_selected',
  'demo_completed',
  'purchase_clicked',
  'share_clicked',
  'share_created',
  'preview_opened',
  'recipient_demo_started',
  'recipient_demo_completed',
  'demo_ai_started',
  'demo_ai_generated',
  'demo_ai_needs_more_info',
  'demo_ai_failed',
  'demo_ai_completed',
  'demo_ai_fallback',
])

function randomToken(bytes = 24): string {
  const data = new Uint8Array(bytes)
  crypto.getRandomValues(data)
  return Array.from(data).map((value) => value.toString(16).padStart(2, '0')).join('')
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map((value) => value.toString(16).padStart(2, '0')).join('')
}

function safeJson(value: unknown): string | null {
  if (value === undefined || value === null) return null
  try { return JSON.stringify(value) } catch { return null }
}

function webOrigin(c: any): string {
  const fallback = String(c.env.ENVIRONMENT || '').toLowerCase() === 'preview'
    ? 'https://preview.intaprd.com'
    : 'https://intaprd.com'
  return String(c.env.WEB_URL || fallback).replace(/\/$/, '')
}

async function insertEvent(c: any, input: {
  eventType: string
  snapshotId?: string | null
  sectorKey?: string | null
  source?: string | null
  sessionKey?: string | null
  metadata?: unknown
}) {
  await c.env.DB.prepare(
    `INSERT INTO demo_events
      (id, event_type, snapshot_id, sector_key, source, session_key, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).bind(
    crypto.randomUUID(),
    input.eventType,
    input.snapshotId || null,
    input.sectorKey || null,
    input.source || 'demo',
    input.sessionKey || null,
    safeJson(input.metadata),
  ).run()
}

function portfolioKeysFromPayload(row: any): Array<string | null> {
  try {
    const parsed = JSON.parse(String(row?.payload_json || '{}'))
    return Array.isArray(parsed?.__portfolio_image_keys) ? parsed.__portfolio_image_keys : []
  } catch {
    return []
  }
}

async function deleteSnapshotAssets(c: any, row: any) {
  const keys: string[] = []
  if (row?.portrait_key) keys.push(String(row.portrait_key))
  if (row?.service_image_keys_json) {
    try {
      const parsed = JSON.parse(String(row.service_image_keys_json))
      if (Array.isArray(parsed)) parsed.forEach((key) => { if (key) keys.push(String(key)) })
    } catch { /* ignore malformed legacy value */ }
  }
  portfolioKeysFromPayload(row).forEach((key) => { if (key) keys.push(String(key)) })
  await Promise.all(keys.map((key) => c.env.BUCKET.delete(key).catch(() => undefined)))
}

export function registerDemoViralRoutes(app: any) {
  app.post('/api/v1/public/demo/events', async (c: any) => {
    let body: any
    try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Invalid JSON' }, 400) }

    const eventType = String(body?.event_type || '').trim()
    if (!PUBLIC_EVENT_TYPES.has(eventType)) return c.json({ ok: false, error: 'Unsupported event_type' }, 400)

    const sectorKey = body?.sector_key ? String(body.sector_key).slice(0, 80) : null
    const sessionKey = body?.session_key ? String(body.session_key).slice(0, 120) : null
    const source = body?.source ? String(body.source).slice(0, 40) : 'demo'

    let snapshotId: string | null = null
    if (body?.snapshot_token) {
      const tokenHash = await sha256Hex(String(body.snapshot_token))
      const snapshot = await c.env.DB.prepare(
        `SELECT id FROM demo_share_snapshots WHERE token_hash = ? AND expires_at > datetime('now') LIMIT 1`
      ).bind(tokenHash).first()
      snapshotId = snapshot ? String((snapshot as any).id) : null
    }

    await insertEvent(c, {
      eventType,
      snapshotId,
      sectorKey,
      sessionKey,
      source,
      metadata: body?.metadata ?? null,
    })

    return c.json({ ok: true })
  })

  app.post('/api/v1/public/demo/share', async (c: any) => {
    let form: FormData
    try { form = await c.req.formData() } catch { return c.json({ ok: false, error: 'Invalid multipart body' }, 400) }

    const snapshotRaw = String(form.get('snapshot') || '')
    const snapshotBytes = new TextEncoder().encode(snapshotRaw).byteLength
    if (!snapshotRaw || snapshotBytes > MAX_SNAPSHOT_JSON_BYTES) {
      return c.json({ ok: false, error: 'Snapshot inválido o demasiado grande' }, 400)
    }

    let payload: any
    try { payload = JSON.parse(snapshotRaw) } catch { return c.json({ ok: false, error: 'Snapshot JSON inválido' }, 400) }

    const sectorKey = String(form.get('sector_key') || payload?.sectorKey || '').slice(0, 80) || null
    const sessionKey = String(form.get('session_key') || '').slice(0, 120) || null
    const token = randomToken(24)
    const tokenHash = await sha256Hex(token)
    const snapshotId = crypto.randomUUID()
    const baseKey = `demo-shares/${snapshotId}`

    let portraitKey: string | null = null
    const serviceKeys: Array<string | null> = [null, null, null]
    const portfolioKeys: Array<string | null> = [null, null, null, null, null]

    const putImage = async (field: string, suffix: string): Promise<string | null> => {
      const value = form.get(field)
      if (!(value instanceof File) || !value.size) return null
      if (!value.type.startsWith('image/') || value.size > MAX_IMAGE_BYTES) throw new Error('INVALID_IMAGE')
      const key = `${baseKey}/${suffix}`
      await c.env.BUCKET.put(key, value.stream(), { httpMetadata: { contentType: value.type } })
      return key
    }

    try {
      portraitKey = await putImage('portrait', 'portrait')
      for (let index = 0; index < serviceKeys.length; index += 1) {
        serviceKeys[index] = await putImage(`service_${index}`, `service-${index}`)
      }
      for (let index = 0; index < portfolioKeys.length; index += 1) {
        portfolioKeys[index] = await putImage(`portfolio_${index}`, `portfolio-${index}`)
      }
    } catch (error) {
      await Promise.all([
        portraitKey ? c.env.BUCKET.delete(portraitKey) : Promise.resolve(),
        ...serviceKeys.filter(Boolean).map((key) => c.env.BUCKET.delete(String(key))),
        ...portfolioKeys.filter(Boolean).map((key) => c.env.BUCKET.delete(String(key))),
      ])
      return c.json({ ok: false, error: error instanceof Error && error.message === 'INVALID_IMAGE' ? 'Imagen inválida o demasiado grande' : 'No se pudo guardar la vista previa' }, 400)
    }

    payload.__portfolio_image_keys = portfolioKeys
    const expiresAt = new Date(Date.now() + SHARE_TTL_HOURS * 60 * 60 * 1000).toISOString()

    await c.env.DB.prepare(
      `INSERT INTO demo_share_snapshots
        (id, token_hash, sector_key, payload_json, portrait_key, service_image_keys_json, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)`
    ).bind(
      snapshotId,
      tokenHash,
      sectorKey,
      JSON.stringify(payload),
      portraitKey,
      JSON.stringify(serviceKeys),
      expiresAt,
    ).run()

    await insertEvent(c, {
      eventType: 'share_created',
      snapshotId,
      sectorKey,
      sessionKey,
      source: 'demo',
      metadata: { ttl_hours: SHARE_TTL_HOURS },
    })

    return c.json({
      ok: true,
      token,
      expires_at: expiresAt,
      url: `${webOrigin(c)}/demo/s/${token}`,
    }, 201)
  })

  app.get('/api/v1/public/demo/share/:token', async (c: any) => {
    const token = String(c.req.param('token') || '')
    if (!/^[a-f0-9]{48}$/.test(token)) return c.json({ ok: false, error: 'Vista previa no encontrada' }, 404)

    const tokenHash = await sha256Hex(token)
    const row = await c.env.DB.prepare(
      `SELECT id, sector_key, payload_json, portrait_key, service_image_keys_json,
              created_at, expires_at, opened_count
         FROM demo_share_snapshots
        WHERE token_hash = ? LIMIT 1`
    ).bind(tokenHash).first()

    if (!row) return c.json({ ok: false, error: 'Vista previa no encontrada' }, 404)
    if (new Date(String((row as any).expires_at)).getTime() <= Date.now()) {
      await deleteSnapshotAssets(c, row)
      await c.env.DB.prepare(`DELETE FROM demo_share_snapshots WHERE id = ?`).bind((row as any).id).run()
      return c.json({ ok: false, error: 'Esta vista previa ya expiró', expired: true }, 410)
    }

    await c.env.DB.prepare(
      `UPDATE demo_share_snapshots
          SET opened_count = opened_count + 1, last_opened_at = datetime('now')
        WHERE id = ?`
    ).bind((row as any).id).run()

    await insertEvent(c, {
      eventType: 'preview_opened',
      snapshotId: String((row as any).id),
      sectorKey: (row as any).sector_key || null,
      source: 'shared_preview',
    })

    let payload: any = {}
    try { payload = JSON.parse(String((row as any).payload_json || '{}')) } catch { payload = {} }

    let serviceKeys: Array<string | null> = []
    try {
      const parsed = JSON.parse(String((row as any).service_image_keys_json || '[]'))
      serviceKeys = Array.isArray(parsed) ? parsed : []
    } catch { serviceKeys = [] }

    const portfolioKeys = Array.isArray(payload?.__portfolio_image_keys) ? payload.__portfolio_image_keys : []
    delete payload.__portfolio_image_keys

    const assetBase = `${webOrigin(c)}/api/v1/public/demo/share/${token}/asset`
    return c.json({
      ok: true,
      snapshot: payload,
      sector_key: (row as any).sector_key || null,
      created_at: (row as any).created_at,
      expires_at: (row as any).expires_at,
      assets: {
        portrait: (row as any).portrait_key ? `${assetBase}/portrait` : null,
        services: serviceKeys.map((key, index) => key ? `${assetBase}/service-${index}` : null),
        portfolio: portfolioKeys.map((key: string | null, index: number) => key ? `${assetBase}/portfolio-${index}` : null),
      },
    })
  })

  app.get('/api/v1/public/demo/share/:token/asset/:kind', async (c: any) => {
    const token = String(c.req.param('token') || '')
    const kind = String(c.req.param('kind') || '')
    if (!/^[a-f0-9]{48}$/.test(token)) return c.body(null, 404)

    const tokenHash = await sha256Hex(token)
    const row = await c.env.DB.prepare(
      `SELECT id, payload_json, portrait_key, service_image_keys_json, expires_at
         FROM demo_share_snapshots
        WHERE token_hash = ? LIMIT 1`
    ).bind(tokenHash).first()
    if (!row || new Date(String((row as any).expires_at)).getTime() <= Date.now()) return c.body(null, 404)

    let key: string | null = null
    if (kind === 'portrait') key = (row as any).portrait_key || null
    if (/^service-[0-2]$/.test(kind)) {
      const index = Number(kind.split('-')[1])
      try {
        const parsed = JSON.parse(String((row as any).service_image_keys_json || '[]'))
        if (Array.isArray(parsed)) key = parsed[index] || null
      } catch { key = null }
    }
    if (/^portfolio-[0-4]$/.test(kind)) {
      const index = Number(kind.split('-')[1])
      const parsed = portfolioKeysFromPayload(row)
      key = parsed[index] || null
    }
    if (!key) return c.body(null, 404)

    const object = await c.env.BUCKET.get(key)
    if (!object) return c.body(null, 404)
    const headers = new Headers()
    object.writeHttpMetadata(headers)
    headers.set('Cache-Control', 'private, max-age=300')
    headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
    return new Response(object.body, { headers })
  })

  app.get('/api/v1/superadmin/demo/metrics', requireSuperAdmin('viewer'), async (c: any) => {
    const daysRaw = Number.parseInt(String(c.req.query('days') || '30'), 10)
    const days = Number.isFinite(daysRaw) ? Math.min(Math.max(daysRaw, 1), 90) : 30
    const sinceModifier = `-${days} days`

    const counts = await c.env.DB.prepare(
      `SELECT event_type, COUNT(*) AS total
         FROM demo_events
        WHERE created_at >= datetime('now', ?)
        GROUP BY event_type`
    ).bind(sinceModifier).all()

    const bySector = await c.env.DB.prepare(
      `SELECT COALESCE(sector_key, 'sin_sector') AS sector_key,
              SUM(CASE WHEN event_type = 'demo_completed' THEN 1 ELSE 0 END) AS completed,
              SUM(CASE WHEN event_type = 'share_created' THEN 1 ELSE 0 END) AS shares,
              SUM(CASE WHEN event_type = 'preview_opened' THEN 1 ELSE 0 END) AS preview_opens,
              SUM(CASE WHEN event_type = 'recipient_demo_started' THEN 1 ELSE 0 END) AS recipient_starts,
              SUM(CASE WHEN event_type = 'purchase_clicked' THEN 1 ELSE 0 END) AS purchase_clicks
         FROM demo_events
        WHERE created_at >= datetime('now', ?)
        GROUP BY COALESCE(sector_key, 'sin_sector')
        ORDER BY completed DESC, shares DESC`
    ).bind(sinceModifier).all()

    const snapshots = await c.env.DB.prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN expires_at > datetime('now') THEN 1 ELSE 0 END) AS active,
              COALESCE(SUM(opened_count), 0) AS total_opens
         FROM demo_share_snapshots
        WHERE created_at >= datetime('now', ?)`
    ).bind(sinceModifier).first()

    const eventCounts = Object.fromEntries(
      ((counts as any)?.results || []).map((row: any) => [row.event_type, Number(row.total || 0)])
    )
    const completed = Number(eventCounts.demo_completed || 0)
    const shares = Number(eventCounts.share_created || 0)
    const previewOpens = Number(eventCounts.preview_opened || 0)
    const recipientStarts = Number(eventCounts.recipient_demo_started || 0)
    const purchaseClicks = Number(eventCounts.purchase_clicked || 0)

    return c.json({
      ok: true,
      period_days: days,
      totals: eventCounts,
      funnel: {
        completed,
        purchase_clicks: purchaseClicks,
        shares,
        preview_opens: previewOpens,
        recipient_demo_starts: recipientStarts,
        share_rate: completed ? shares / completed : 0,
        preview_open_rate: shares ? previewOpens / shares : 0,
        viral_activation_rate: previewOpens ? recipientStarts / previewOpens : 0,
        purchase_click_rate: completed ? purchaseClicks / completed : 0,
      },
      snapshots: {
        total: Number((snapshots as any)?.total || 0),
        active: Number((snapshots as any)?.active || 0),
        opens: Number((snapshots as any)?.total_opens || 0),
      },
      by_sector: (bySector as any)?.results || [],
    })
  })

  app.post('/api/v1/superadmin/demo/cleanup', requireSuperAdmin('support'), async (c: any) => {
    const expired = await c.env.DB.prepare(
      `SELECT id, payload_json, portrait_key, service_image_keys_json
         FROM demo_share_snapshots
        WHERE expires_at <= datetime('now')
        LIMIT 200`
    ).all()

    const rows = (expired as any)?.results || []
    for (const row of rows) {
      await deleteSnapshotAssets(c, row)
      await c.env.DB.prepare(`DELETE FROM demo_share_snapshots WHERE id = ?`).bind(row.id).run()
    }

    return c.json({ ok: true, deleted: rows.length })
  })
}
