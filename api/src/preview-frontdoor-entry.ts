import app from './preview-free-entry'

type PreviewEnv = {
  WEB_PAGES_ORIGIN?: string
  APP_PAGES_ORIGIN?: string
}

async function proxyPagesPreview(request: Request, origin: string | undefined, marker: string) {
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

  // The Free editor intentionally embeds only draft preview URLs (?preview=1).
  // Keep public pages protected from framing, but allow this authenticated
  // Preview-only editor use case by removing frame-blocking response headers.
  if (requestUrl.searchParams.get('preview') === '1') {
    responseHeaders.delete('x-frame-options')
    const csp = responseHeaders.get('content-security-policy')
    if (csp && /frame-ancestors/i.test(csp)) {
      responseHeaders.delete('content-security-policy')
    }
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
