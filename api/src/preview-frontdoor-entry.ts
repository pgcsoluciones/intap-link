import app from './preview-free-entry'

type PreviewEnv = {
  WEB_PAGES_ORIGIN?: string
}

async function proxyWebPreview(request: Request, env: PreviewEnv) {
  const requestUrl = new URL(request.url)
  const webOrigin = String(env.WEB_PAGES_ORIGIN || '').replace(/\/$/, '')

  if (!webOrigin) {
    return new Response('Preview web origin is not configured.', { status: 503 })
  }

  const target = new URL(`${requestUrl.pathname}${requestUrl.search}`, `${webOrigin}/`)
  const method = request.method.toUpperCase()
  const headers = new Headers(request.headers)
  headers.delete('host')
  headers.set('x-intap-preview-proxy', 'web-custom-domain')

  const upstream = await fetch(target.toString(), {
    method,
    headers,
    body: method === 'GET' || method === 'HEAD' ? undefined : request.body,
    redirect: 'manual',
  })

  // The Free editor intentionally embeds only draft preview URLs (?preview=1).
  // Keep public pages protected from framing, but allow this authenticated
  // Preview-only editor use case by removing frame-blocking response headers.
  if (requestUrl.searchParams.get('preview') !== '1') return upstream

  const responseHeaders = new Headers(upstream.headers)
  responseHeaders.delete('x-frame-options')
  const csp = responseHeaders.get('content-security-policy')
  if (csp && /frame-ancestors/i.test(csp)) {
    responseHeaders.delete('content-security-policy')
  }
  responseHeaders.set('cache-control', 'no-store')

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  })
}

export default {
  async fetch(request: Request, env: PreviewEnv, ctx: ExecutionContext) {
    const url = new URL(request.url)

    // preview.intaprd.com must serve the approved Web Preview branch, not the
    // Pages production deployment attached to the custom domain.
    if (url.hostname === 'preview.intaprd.com' && !url.pathname.startsWith('/api/')) {
      return proxyWebPreview(request, env)
    }

    return app.fetch(request, env as any, ctx)
  },
}
