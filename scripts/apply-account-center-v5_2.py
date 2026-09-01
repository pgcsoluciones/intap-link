#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / 'api/src/preview-frontdoor-entry.ts'
text = p.read_text()

if 'async function proxyInvitationWithMeta' not in text:
    anchor = "function renewPreviewRedirect(slug: string, embedded: boolean) {\n"
    helper = r'''async function proxyInvitationWithMeta(request: Request, env: PreviewEnv) {
  const response = await proxyPagesPreview(request, env.WEB_PAGES_ORIGIN, 'web-custom-domain')
  if (request.method.toUpperCase() !== 'GET' || response.status !== 200) return response
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('text/html')) return response

  const url = new URL(request.url)
  const canonical = `${url.origin}/invitacion`
  const title = 'Te recomiendo Kawvo Link'
  const description = 'Crea tu presentación digital con Kawvo Link y comparte quién eres, qué haces y cómo contactarte en un solo lugar.'
  const image = `${url.origin}/assets/og/kawvo-link-og.png`
  const meta = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="Kawvo Link">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${escapeHtml(canonical)}">`,
    `<meta property="og:image" content="${escapeHtml(image)}">`,
    `<meta property="og:image:alt" content="Kawvo Link">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
    `<meta name="twitter:image" content="${escapeHtml(image)}">`,
  ].join('\n')

  const html = await response.text()
  const updated = html.replace(/<title>[\s\S]*?<\/title>/i, '').replace('</head>', `${meta}\n</head>`)
  const headers = new Headers(response.headers)
  headers.delete('content-length')
  headers.delete('content-encoding')
  headers.set('cache-control', 'no-store')
  headers.set('x-robots-tag', 'noindex, nofollow, noarchive')
  return new Response(updated, { status: response.status, statusText: response.statusText, headers })
}

'''
    if anchor not in text:
        raise SystemExit('No encontré anchor para helper social')
    text = text.replace(anchor, helper + anchor, 1)

route_anchor = "      if (url.hostname === 'preview.intaprd.com') {\n        return proxyPublicProfileWithMeta(request, env)\n      }"
route_new = "      if (url.hostname === 'preview.intaprd.com') {\n        if (url.pathname === '/invitacion' || url.pathname === '/invitacion/') {\n          return proxyInvitationWithMeta(request, env)\n        }\n        return proxyPublicProfileWithMeta(request, env)\n      }"
if route_anchor in text:
    text = text.replace(route_anchor, route_new, 1)
elif "return proxyInvitationWithMeta(request, env)" not in text:
    raise SystemExit('No encontré ruta preview para insertar invitación')

p.write_text(text)
print('✓ Preview frontdoor: Graph Card /invitacion inyectada en Worker')
