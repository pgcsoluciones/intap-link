type PagesContext = {
  next: () => Promise<Response>
}

const TITLE = 'Yudeimy Timaure | Gerente de Operaciones de BioPests'
const DESCRIPTION =
  'Yudeimy Timaure, Gerente de Operaciones de BioPests. Soluciones empresariales para prevenir, controlar y monitorear plagas mediante evaluación técnica, prevención y tecnología.'
const CANONICAL = 'https://intaprd.com/biopestsvrd'
const IMAGE =
  'https://intaprd.com/assets/biopestrd/values/innovacion.png?v=biopests-shared-og-v1'

export async function onRequest(context: PagesContext): Promise<Response> {
  const response = await context.next()
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('text/html')) return response

  const html = await response.text()
  const cleanHtml = html.replace(/<title>[\s\S]*?<\/title>/i, '')
  const metadata = `
  <title>${TITLE}</title>
  <link rel="canonical" href="${CANONICAL}" />
  <meta name="description" content="${DESCRIPTION}" />
  <meta property="og:type" content="profile" />
  <meta property="og:site_name" content="BioPests" />
  <meta property="og:title" content="${TITLE}" />
  <meta property="og:description" content="${DESCRIPTION}" />
  <meta property="og:url" content="${CANONICAL}" />
  <meta property="og:image" content="${IMAGE}" />
  <meta property="og:image:secure_url" content="${IMAGE}" />
  <meta property="og:image:type" content="image/png" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${TITLE}" />
  <meta name="twitter:description" content="${DESCRIPTION}" />
  <meta name="twitter:image" content="${IMAGE}" />
  <script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: 'Yudeimy Timaure',
    jobTitle: 'Gerente de Operaciones',
    url: CANONICAL,
    telephone: '+18297500908',
    worksFor: {
      '@type': 'Organization',
      name: 'BioPests',
      url: CANONICAL,
      sameAs: ['https://www.instagram.com/biopestsrd/'],
    },
  })}</script>
`

  const updatedHtml = cleanHtml.includes('</head>')
    ? cleanHtml.replace('</head>', `${metadata}\n</head>`)
    : `${metadata}\n${cleanHtml}`
  const headers = new Headers(response.headers)
  headers.set('content-type', 'text/html; charset=UTF-8')
  headers.set('x-robots-tag', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1')

  return new Response(updatedHtml, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
