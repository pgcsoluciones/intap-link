import app from './preview-free-entry'

type ProductionEnv = {
  WEB_PAGES_ORIGIN?: string
  APP_PAGES_ORIGIN?: string
  DB: D1Database
}

function slugFromPath(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean)
  return parts.length === 1 ? decodeURIComponent(parts[0] || '') : ''
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
}

async function proxyPages(request: Request, origin: string | undefined, marker: string) {
  const requestUrl = new URL(request.url)
  const pagesOrigin = String(origin || '').replace(/\/$/, '')
  if (!pagesOrigin) return new Response(`Production ${marker} origin is not configured.`, { status: 503 })

  const target = new URL(`${requestUrl.pathname}${requestUrl.search}`, `${pagesOrigin}/`)
  const method = request.method.toUpperCase()
  const headers = new Headers(request.headers)
  headers.delete('host')
  headers.set('x-kawvo-production-proxy', marker)

  const upstream = await fetch(target.toString(), {
    method,
    headers,
    body: method === 'GET' || method === 'HEAD' ? undefined : request.body,
    redirect: 'manual',
  })

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: new Headers(upstream.headers),
  })
}

async function proxyPublicProfileWithMeta(request: Request, env: ProductionEnv) {
  const response = await proxyPages(request, env.WEB_PAGES_ORIGIN, 'web-custom-domain')
  const url = new URL(request.url)
  const slug = slugFromPath(url.pathname)
  if (!slug || slug.includes('.') || request.method.toUpperCase() !== 'GET' || response.status !== 200) return response

  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('text/html')) return response

  const row = await env.DB.prepare(
    `SELECT name, bio, avatar_url FROM profiles WHERE lower(slug) = lower(?) AND is_published = 1 LIMIT 1`,
  ).bind(slug).first()
  if (!row) return response

  const name = String((row as any).name || slug).trim() || slug
  const bio = String((row as any).bio || '').trim()
  const imageRaw = String((row as any).avatar_url || '').trim()
  let image = ''
  if (imageRaw) {
    try { image = new URL(imageRaw, url.origin).toString() } catch { image = imageRaw }
  }

  const bankShare = url.searchParams.get('share') === 'bancos'
  const canonical = bankShare
    ? `${url.origin}/${encodeURIComponent(slug)}?share=bancos`
    : `${url.origin}/${encodeURIComponent(slug)}`
  const title = bankShare ? name : `${name} | Kawvo Link`
  const description = bankShare
    ? 'Te comparto mis datos bancarios para transferencias.'
    : (bio || `Perfil digital de ${name}. Contacto, servicios y formas de conectar en un solo lugar.`)

  const meta = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}">`,
    '<meta property="og:type" content="profile">',
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${escapeHtml(canonical)}">`,
    image ? `<meta property="og:image" content="${escapeHtml(image)}">` : '',
    image ? `<meta property="og:image:alt" content="Foto de ${escapeHtml(name)}">` : '',
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
    image ? `<meta name="twitter:image" content="${escapeHtml(image)}">` : '',
  ].filter(Boolean).join('\n')

  const html = await response.text()
  const updated = html.replace(/<title>[\s\S]*?<\/title>/i, '').replace('</head>', `${meta}\n</head>`)
  const responseHeaders = new Headers(response.headers)
  responseHeaders.delete('content-length')
  responseHeaders.delete('content-encoding')
  responseHeaders.set('cache-control', 'no-store')

  return new Response(updated, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  })
}

export default {
  async fetch(request: Request, env: ProductionEnv, ctx: ExecutionContext) {
    const url = new URL(request.url)

    if (!url.pathname.startsWith('/api/')) {
      if (url.hostname === 'intaprd.com' || url.hostname === 'www.intaprd.com') {
        return proxyPublicProfileWithMeta(request, env)
      }
      if (url.hostname === 'app.intaprd.com') {
        return proxyPages(request, env.APP_PAGES_ORIGIN, 'app-custom-domain')
      }
    }

    return app.fetch(request, env as any, ctx)
  },
}
