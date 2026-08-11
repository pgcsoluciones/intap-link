type PagesContext = {
  request: Request
  next: () => Promise<Response>
}

const TITLE = 'Yudeimy Timaure | Gerente de Operaciones de BioPests'
const DESCRIPTION =
  'Yudeimy Timaure, Gerente de Operaciones de BioPests. Soluciones empresariales para prevenir, controlar y monitorear plagas mediante evaluación técnica, prevención y tecnología.'
export async function onRequest(context: PagesContext): Promise<Response> {
  const requestUrl = new URL(context.request.url)
  const isProduction =
    requestUrl.hostname === 'intaprd.com' ||
    requestUrl.hostname === 'www.intaprd.com'
  const origin = isProduction ? 'https://intaprd.com' : requestUrl.origin
  const canonical = `${origin}/biopestsvrd`
  const image =
    `${origin}/assets/biopestrd/values/innovacion.png?v=biopests-shared-og-v1`
  const indexDirective = isProduction
    ? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
    : 'noindex, nofollow, noarchive'

  const response = await context.next()
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('text/html')) return response

  const html = await response.text()
  const cleanHtml = html.replace(/<title>[\s\S]*?<\/title>/i, '')
  const metadata = `
  <title>${TITLE}</title>
  <link rel="canonical" href="${canonical}" />
  <meta name="description" content="${DESCRIPTION}" />
  <meta property="og:type" content="profile" />
  <meta property="og:site_name" content="BioPests" />
  <meta property="og:title" content="${TITLE}" />
  <meta property="og:description" content="${DESCRIPTION}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:image:secure_url" content="${image}" />
  <meta property="og:image:type" content="image/png" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${TITLE}" />
  <meta name="twitter:description" content="${DESCRIPTION}" />
  <meta name="twitter:image" content="${image}" />
  <script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: 'Yudeimy Timaure',
    jobTitle: 'Gerente de Operaciones',
    url: canonical,
    telephone: '+18297500908',
    worksFor: {
      '@type': 'Organization',
      name: 'BioPests',
      url: canonical,
      sameAs: ['https://www.instagram.com/biopestsrd/'],
    },
  })}</script>
`

  const localizedHtml = cleanHtml.replace(
    /<html\b([^>]*)>/i,
    (_match, attributes: string) =>
      `<html${attributes.replace(/\s+lang=(?:"[^"]*"|'[^']*'|[^\s>]+)/i, '')} lang="es-DO">`,
  )
  const updatedHtml = localizedHtml.includes('</head>')
    ? localizedHtml.replace('</head>', `${metadata}\n</head>`)
    : `${metadata}\n${localizedHtml}`
  const headers = new Headers(response.headers)
  headers.set('content-type', 'text/html; charset=UTF-8')
  headers.set('x-robots-tag', indexDirective)

  return new Response(updatedHtml, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
