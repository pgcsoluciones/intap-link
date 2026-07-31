type PagesContext = {
  next: () => Promise<Response>
}

const TITLE = 'Rene Prieto | CEO de BioPests'
const DESCRIPTION =
  'Rene Prieto, CEO de BioPests. Soluciones empresariales para prevenir, controlar y monitorear plagas mediante evaluación técnica, prevención y tecnología.'
const CANONICAL = 'https://intaprd.com/biopestsgrd'
const IMAGE =
  'https://intaprd.com/assets/biopestrd/values/innovacion.png?v=biopests-shared-og-v1'

export async function onRequest(context: PagesContext): Promise<Response> {
  const response = await context.next()
  const contentType = response.headers.get('content-type') || ''

  if (!contentType.includes('text/html')) return response

  const html = await response.text()
  const cleanHtml = html.replace(/<title>[\s\S]*?<\/title>/i, '')

  const metadata = `
  <!-- BioPests manager: individual Open Graph / Twitter card -->
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
  <meta property="og:image:width" content="628" />
  <meta property="og:image:height" content="628" />
  <meta property="profile:first_name" content="Rene" />
  <meta property="profile:last_name" content="Prieto" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${TITLE}" />
  <meta name="twitter:description" content="${DESCRIPTION}" />
  <meta name="twitter:image" content="${IMAGE}" />
  <script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: 'Rene Prieto',
    jobTitle: 'CEO',
    url: CANONICAL,
    telephone: '+18297500908',
    worksFor: {
      '@type': 'Organization',
      name: 'BioPests',
      url: 'https://intaprd.com/biopestsgrd',
      sameAs: ['https://www.instagram.com/biopestsrd/'],
    },
  })}</script>
`

  const updatedHtml = cleanHtml.includes('</head>')
    ? cleanHtml.replace('</head>', `${metadata}\n</head>`)
    : `${metadata}\n${cleanHtml}`

  const headers = new Headers(response.headers)
  headers.set('content-type', 'text/html; charset=UTF-8')
  headers.set(
    'x-robots-tag',
    'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
  )

  return new Response(updatedHtml, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
