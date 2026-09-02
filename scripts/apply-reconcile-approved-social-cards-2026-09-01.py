#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / 'functions/_middleware.ts'
text = path.read_text()

invite_marker = "url.pathname === '/invitacion'"
if invite_marker not in text:
    anchor = "  // Card específica de la demo interactiva.\n"
    block = """  // Card social para invitaciones compartidas desde Mi cuenta.\n  if (url.pathname === '/invitacion' || url.pathname === '/invitacion/') {\n    return injectSimpleSocialCard({\n      title: 'Te recomiendo Kawvo Link | Crea tu presentación digital',\n      description: 'Crea tu presentación digital para mostrar quién eres, qué haces y cómo contactarte, todo en un solo lugar.',\n      image: `${url.origin}/assets/og/kawvo-link-og.png`,\n      canonicalUrl: `${url.origin}/invitacion`,\n    });\n  }\n\n"""
    if anchor not in text:
        raise SystemExit('No encontré el ancla para Graph Card de invitación')
    text = text.replace(anchor, block + anchor, 1)

bank_marker = 'share=bancos: social card bancaria'
if bank_marker not in text:
    anchor = "  const staticProfile = getStaticProfileDiscovery(slug, discoveryRuntime);\n"
    block = """  // share=bancos: social card bancaria aprobada para WhatsApp y redes.\n  if (url.searchParams.get('share') === 'bancos' && /^[a-z0-9][a-z0-9_-]{0,79}$/i.test(slug)) {\n    const bankMeta = await getDynamicProfileSeoBundle(slug, discoveryRuntime);\n    if (bankMeta) {\n      const response = await context.next();\n      const contentType = response.headers.get('content-type') || '';\n      if (contentType.includes('text/html')) {\n        const html = await response.text();\n        const cleanName = bankMeta.title.split('|')[0].trim();\n        const pageUrl = `${url.origin}/${encodeURIComponent(slug)}?share=bancos`;\n        const updatedHtml = injectHeadMetadata(html, {\n          title: `Datos bancarios de ${cleanName} | Kawvo Link`,\n          description: 'Consulta los datos bancarios compartidos desde su presentación digital Kawvo Link.',\n          url: pageUrl,\n          image: bankMeta.image,\n          imageType: bankMeta.imageType,\n          siteName: 'Kawvo Link',\n          ogType: 'website',\n          twitterCard: 'summary_large_image',\n          language: discoveryRuntime.language === 'en' ? 'en-US' : 'es-DO',\n        });\n        const headers = new Headers(response.headers);\n        headers.set('content-type', 'text/html; charset=UTF-8');\n        headers.set('x-robots-tag', 'noindex, nofollow, noarchive');\n        return withSecurityHeaders(new Response(updatedHtml, { status: response.status, statusText: response.statusText, headers }));\n      }\n      return withSecurityHeaders(response);\n    }\n  }\n\n"""
    if anchor not in text:
        raise SystemExit('No encontré el ancla para Graph Card bancaria')
    text = text.replace(anchor, block + anchor, 1)

path.write_text(text)
print('✓ Graph Cards aprobadas reconciliadas sin tocar Demo IA')
