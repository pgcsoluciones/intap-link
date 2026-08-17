import app from './preview-entry'
import { cookieNames } from './lib/cookies'

type QuickActionType = 'call' | 'instagram' | 'location' | 'email' | 'tiktok'

type NormalizedQuickAction = {
  type: QuickActionType
  url: string
  sort_order: number
}

const ALLOWED_TYPES = new Set<QuickActionType>([
  'call',
  'instagram',
  'location',
  'email',
  'tiktok',
])

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

async function requirePreviewAuth(c: any, next: any) {
  const rawSession = parseCookie(
    c.req.header('Cookie') || '',
    cookieNames(c.env).session,
  )

  if (!rawSession) {
    return c.json({ ok: false, error: 'Unauthorized' }, 401)
  }

  const sessionHash = await sha256Hex(rawSession)
  const session = await c.env.DB.prepare(
    `SELECT user_id
       FROM auth_sessions
      WHERE session_hash = ?
        AND expires_at > datetime('now')
        AND revoked_at IS NULL
      LIMIT 1`,
  ).bind(sessionHash).first()

  if (!session) {
    return c.json({ ok: false, error: 'Unauthorized' }, 401)
  }

  c.set('userId', (session as any).user_id)
  await next()
}

function normalizeType(value: unknown): QuickActionType | null {
  const type = String(value || '').trim().toLowerCase() as QuickActionType
  return ALLOWED_TYPES.has(type) ? type : null
}

function normalizeUrl(type: QuickActionType, value: unknown): string {
  const raw = String(value || '').trim()
  if (!raw) return ''

  if (type === 'call') {
    const digits = raw.replace(/\D/g, '')
    return digits ? `tel:+${digits}` : ''
  }

  if (type === 'email') {
    const email = raw.replace(/^mailto:/i, '').trim()
    return email ? `mailto:${email}` : ''
  }

  if (/^https?:\/\//i.test(raw)) return raw
  return `https://${raw}`
}

app.get('/api/v1/me/free/quick-actions', requirePreviewAuth, async (c: any) => {
  const userId = c.get('userId') as string

  const profile = await c.env.DB.prepare(
    `SELECT id FROM profiles WHERE user_id = ? LIMIT 1`,
  ).bind(userId).first()

  if (!profile) {
    return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)
  }

  const profileId = String((profile as any).id)

  const [socials, contact] = await Promise.all([
    c.env.DB.prepare(
      `SELECT type, url, sort_order
         FROM profile_social_links
        WHERE profile_id = ?
          AND enabled = 1
        ORDER BY sort_order ASC`,
    ).bind(profileId).all(),
    c.env.DB.prepare(
      `SELECT phone, email, map_url
         FROM profile_contact
        WHERE profile_id = ?
        LIMIT 1`,
    ).bind(profileId).first(),
  ])

  const selected = (socials.results as any[])
    .map((row) => ({
      type: normalizeType(row.type),
      url: String(row.url || ''),
      sort_order: Number(row.sort_order || 0),
    }))
    .filter((row) => row.type)
    .slice(0, 3)

  const socialMap = new Map(
    selected.map((item) => [item.type as QuickActionType, item.url]),
  )

  const values = {
    call: socialMap.get('call') || String((contact as any)?.phone || ''),
    instagram: socialMap.get('instagram') || '',
    location: socialMap.get('location') || String((contact as any)?.map_url || ''),
    email: socialMap.get('email') || String((contact as any)?.email || ''),
    tiktok: socialMap.get('tiktok') || '',
  }

  return c.json({
    ok: true,
    data: {
      selected,
      values,
      max_selected: 3,
      allowed_types: [...ALLOWED_TYPES],
      recommended: ['call', 'instagram', 'location'],
    },
  })
})

app.put('/api/v1/me/free/quick-actions', requirePreviewAuth, async (c: any) => {
  const userId = c.get('userId') as string

  let body: any = {}
  try {
    body = await c.req.json()
  } catch {
    return c.json({ ok: false, error: 'Invalid JSON' }, 400)
  }

  const rawItems = Array.isArray(body.items) ? body.items : []
  if (rawItems.length < 1 || rawItems.length > 3) {
    return c.json({ ok: false, error: 'Debes elegir entre 1 y 3 accesos rápidos.' }, 400)
  }

  const normalized: Array<NormalizedQuickAction | null> = rawItems.map((item: any, index: number) => {
    const type = normalizeType(item?.type)
    if (!type) return null

    const url = normalizeUrl(type, item?.url)
    if (!url) return null

    return { type, url, sort_order: index }
  })

  if (normalized.some((item: NormalizedQuickAction | null) => !item)) {
    return c.json({ ok: false, error: 'Uno de los accesos rápidos no es válido.' }, 400)
  }

  const items = normalized as NormalizedQuickAction[]
  const uniqueTypes = new Set(items.map((item) => item.type))
  if (uniqueTypes.size !== items.length) {
    return c.json({ ok: false, error: 'No puedes repetir un acceso rápido.' }, 400)
  }

  const profile = await c.env.DB.prepare(
    `SELECT id FROM profiles WHERE user_id = ? LIMIT 1`,
  ).bind(userId).first()

  if (!profile) {
    return c.json({ ok: false, error: 'Perfil no encontrado' }, 404)
  }

  const profileId = String((profile as any).id)
  const ids = items.map(() => crypto.randomUUID())

  const statements = [
    c.env.DB.prepare(
      `DELETE FROM profile_social_links
        WHERE profile_id = ?
          AND type IN ('call', 'instagram', 'location', 'email', 'tiktok')`,
    ).bind(profileId),
    ...items.map((item, index) =>
      c.env.DB.prepare(
        `INSERT INTO profile_social_links
          (id, profile_id, type, url, sort_order, enabled)
         VALUES (?, ?, ?, ?, ?, 1)`,
      ).bind(
        ids[index],
        profileId,
        item.type,
        item.url,
        item.sort_order,
      ),
    ),
  ]

  await c.env.DB.batch(statements)

  return c.json({
    ok: true,
    data: {
      selected: items,
    },
  })
})

app.get('/starter-preview-assets/*', requirePreviewAuth, async (c: any) => {
  const webOrigin = String(c.env.WEB_PAGES_ORIGIN || '').replace(/\/$/, '')
  if (!webOrigin) return c.text('Preview web origin is not configured.', 503)

  const requestUrl = new URL(c.req.url)
  const assetPath = requestUrl.pathname.replace(/^\/starter-preview-assets\//, '/assets/')
  const target = new URL(`${assetPath}${requestUrl.search}`, `${webOrigin}/`)
  const upstream = await fetch(target.toString(), {
    method: 'GET',
    headers: { 'x-intap-preview-proxy': 'starter-asset' },
    redirect: 'manual',
  })

  const headers = new Headers(upstream.headers)
  headers.set('cache-control', 'no-store')
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  })
})

class StarterAssetAttributeRewriter {
  constructor(private attributeName: 'src' | 'href') {}

  element(element: Element) {
    const value = element.getAttribute(this.attributeName)
    if (value?.startsWith('/assets/')) {
      element.setAttribute(
        this.attributeName,
        value.replace(/^\/assets\//, '/starter-preview-assets/'),
      )
    }
  }
}

app.get('/starter-preview/:slug', requirePreviewAuth, async (c: any) => {
  const webOrigin = String(c.env.WEB_PAGES_ORIGIN || '').replace(/\/$/, '')
  if (!webOrigin) return c.text('Preview web origin is not configured.', 503)

  const slug = encodeURIComponent(c.req.param('slug'))
  const requestUrl = new URL(c.req.url)
  const target = new URL(`/${slug}${requestUrl.search}`, `${webOrigin}/`)
  const upstream = await fetch(target.toString(), {
    method: 'GET',
    headers: { 'x-intap-preview-proxy': 'starter-review' },
    redirect: 'manual',
  })

  const headers = new Headers(upstream.headers)
  headers.delete('x-frame-options')
  const csp = headers.get('content-security-policy')
  if (csp && /frame-ancestors/i.test(csp)) headers.delete('content-security-policy')
  headers.set('cache-control', 'no-store')

  const response = new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  })

  const contentType = headers.get('content-type') || ''
  if (!contentType.includes('text/html')) return response

  return new HTMLRewriter()
    .on('[src]', new StarterAssetAttributeRewriter('src'))
    .on('link[href]', new StarterAssetAttributeRewriter('href'))
    .transform(response)
})

app.all('*', async (c: any) => {
  const requestUrl = new URL(c.req.url)
  if (requestUrl.pathname.startsWith('/api/')) {
    return c.json({ ok: false, error: 'API route not found' }, 404)
  }

  const pagesOrigin = String(c.env.APP_PAGES_ORIGIN || '').replace(/\/$/, '')
  if (!pagesOrigin) {
    return c.text('Preview app origin is not configured.', 503)
  }

  const target = new URL(`${requestUrl.pathname}${requestUrl.search}`, `${pagesOrigin}/`)
  const method = c.req.raw.method.toUpperCase()
  const headers = new Headers(c.req.raw.headers)
  headers.delete('host')
  headers.set('x-intap-preview-proxy', '1')

  return fetch(target.toString(), {
    method,
    headers,
    body: method === 'GET' || method === 'HEAD' ? undefined : c.req.raw.body,
    redirect: 'manual',
  })
})

export default app
