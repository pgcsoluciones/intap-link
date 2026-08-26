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

class EmbeddedPreviewHeadRewriter {
  constructor(
    private readonly assetOrigin: string,
    private readonly profilePath: string,
  ) {}

  element(element: Element) {
    // Assets deben resolver contra el deployment inmutable, mientras que
    // BrowserRouter debe ver /{slug} y no la ruta /api/... del iframe proxy.
    element.prepend(
      `<base href="${this.assetOrigin}/"><script>history.replaceState(null,'',${JSON.stringify(this.profilePath)});</script>`,
      { html: true },
    )
  }
}

app.get('/api/v1/me/free/profile-preview/:slug', requireProfileOwner, async (c: any) => {
  const userId = c.get('userId') as string
  const slug = String(c.req.param('slug') || '').trim()
  if (!slug || !/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(slug)) return c.text('Perfil no válido.', 400)

  const owned = await c.env.DB.prepare(
    `SELECT id FROM profiles WHERE user_id = ? AND slug = ? LIMIT 1`,
  ).bind(userId, slug).first()
  if (!owned) return c.text('Perfil no encontrado.', 404)

  const publicWebOrigin = String(c.env.WEB_URL || 'https://intaprd.com').replace(/\/$/, '')
  const immutableWebOrigin = String(c.env.WEB_PAGES_ORIGIN || publicWebOrigin).replace(/\/$/, '')
  const encodedSlug = encodeURIComponent(slug)
  const profilePath = `/${encodedSlug}?preview=1&embedded=1`
  const target = `${immutableWebOrigin}${profilePath}`
  const upstream = await fetch(target, {
    method: 'GET',
    headers: { 'x-kawvo-embedded-preview': '1' },
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
    .on('head', new EmbeddedPreviewHeadRewriter(immutableWebOrigin, profilePath))
    .transform(response)
})

export default app
