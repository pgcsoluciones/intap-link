type PagesContext = {
  request: Request
  params: { path?: string | string[] }
}

export async function onRequest(context: PagesContext): Promise<Response> {
  const requestUrl = new URL(context.request.url)
  const isProduction =
    requestUrl.hostname === 'intaprd.com' ||
    requestUrl.hostname === 'www.intaprd.com'
  const apiBase = isProduction
    ? 'https://api.intaprd.com'
    : 'https://intap-api-preview.fliaprince.workers.dev'

  const rawPath = Array.isArray(context.params.path)
    ? context.params.path.join('/')
    : String(context.params.path || '')
  const logicalPath = rawPath
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(decodeURIComponent(part)))
    .join('/')

  if (!logicalPath) return new Response('Asset no encontrado', { status: 404 })

  const upstream = `${apiBase}/api/v1/public/profiles/argenisg/assets/${logicalPath}`
  const response = await fetch(upstream, {
    headers: { Accept: context.request.headers.get('accept') || '*/*' },
    cf: { cacheEverything: true, cacheTtl: 86400 },
  } as RequestInit)

  const headers = new Headers(response.headers)
  headers.set('cache-control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400')
  headers.set('x-kawvo-asset-source', 'r2+d1')

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
