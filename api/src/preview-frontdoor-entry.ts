import app from './preview-free-entry'

type PreviewEnv = {
  WEB_PAGES_ORIGIN?: string
  APP_PAGES_ORIGIN?: string
  DB: D1Database
}

const PREVIEW_SESSION_COOKIE = 'kawvo_preview_session'

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

function slugFromPath(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length === 1) return decodeURIComponent(parts[0] || '')
  const profileApiMatch = pathname.match(/^\/api\/v1\/public\/profiles\/([^/]+)/)
  return profileApiMatch ? decodeURIComponent(profileApiMatch[1]) : ''
}

async function validatePreviewSession(request: Request, env: PreviewEnv, slug: string): Promise<boolean> {
  if (!slug) return false
  const rawToken = parseCookie(request.headers.get('Cookie') || '', PREVIEW_SESSION_COOKIE)
  if (!rawToken) return false
  const tokenHash = await sha256Hex(rawToken)
  const row = await env.DB.prepare(
    `SELECT s.id
       FROM profile_preview_sessions s
       JOIN profiles p ON p.id = s.profile_id
      WHERE s.token_hash = ?
        AND s.expires_at > datetime('now')
        AND lower(p.slug) = lower(?)
      LIMIT 1`,
  ).bind(tokenHash, slug).first()
  return Boolean(row)
}

async function proxyPagesPreview(request: Request, origin: string | undefined, marker: string, allowEmbeddedFrame = false) {
  const requestUrl = new URL(request.url)
  const pagesOrigin = String(origin || '').replace(/\/$/, '')

  if (!pagesOrigin) {
    return new Response(`Preview ${marker} origin is not configured.`, { status: 503 })
  }

  const target = new URL(`${requestUrl.pathname}${requestUrl.search}`, `${pagesOrigin}/`)
  const method = request.method.toUpperCase()
  const headers = new Headers(request.headers)
  headers.delete('host')
  headers.set('x-intap-preview-proxy', marker)

  const upstream = await fetch(target.toString(), {
    method,
    headers,
    body: method === 'GET' || method === 'HEAD' ? undefined : request.body,
    redirect: 'manual',
  })

  const responseHeaders = new Headers(upstream.headers)
  if (allowEmbeddedFrame) {
    responseHeaders.delete('x-frame-options')
    responseHeaders.set('content-security-policy', "frame-ancestors https://app.preview.intaprd.com")
    responseHeaders.set('cache-control', 'no-store')
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  })
}

export default {
  async fetch(request: Request, env: PreviewEnv, ctx: ExecutionContext) {
    const url = new URL(request.url)

    const isDraftPreviewRequest = url.searchParams.get('preview') === '1'
    const isEmbeddedPreviewPage =
      url.hostname === 'preview.intaprd.com' &&
      !url.pathname.startsWith('/api/') &&
      isDraftPreviewRequest &&
      url.searchParams.get('embedded') === '1'

    if (isEmbeddedPreviewPage) {
      const slug = slugFromPath(url.pathname)
      const valid = await validatePreviewSession(request, env, slug)
      if (!valid) return new Response('Preview session expired or invalid.', { status: 403 })
      return proxyPagesPreview(request, env.WEB_PAGES_ORIGIN, 'web-custom-domain', true)
    }

    if (url.pathname.startsWith('/api/v1/public/profiles/') && isDraftPreviewRequest) {
      const slug = slugFromPath(url.pathname)
      const valid = await validatePreviewSession(request, env, slug)
      if (!valid) {
        return new Response(JSON.stringify({ ok: false, error: 'preview_session_required' }), {
          status: 403,
          headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
        })
      }
    }

    // API stays on the Worker. Every other browser route is served from the
    // matching Pages application. This prevents app.preview.intaprd.com from
    // falling through to Hono for React routes such as /activate-product/:code.
    if (!url.pathname.startsWith('/api/')) {
      if (url.hostname === 'preview.intaprd.com') {
        return proxyPagesPreview(request, env.WEB_PAGES_ORIGIN, 'web-custom-domain')
      }
      if (url.hostname === 'app.preview.intaprd.com') {
        return proxyPagesPreview(request, env.APP_PAGES_ORIGIN, 'app-custom-domain')
      }
    }

    return app.fetch(request, env as any, ctx)
  },
}
