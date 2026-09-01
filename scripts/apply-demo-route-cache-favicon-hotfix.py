from pathlib import Path

headers = Path('web/public/_headers')
text = headers.read_text(encoding='utf-8')
block = '''\n# Kawvo Demo: las rutas SPA deben resolver siempre contra el HTML del release actual.\n/demo\n  Cache-Control: no-cache, no-store, must-revalidate\n  Pragma: no-cache\n  Expires: 0\n\n/demo/*\n  Cache-Control: no-cache, no-store, must-revalidate\n  Pragma: no-cache\n  Expires: 0\n'''
if '/demo/*' not in text:
    headers.write_text(text.rstrip() + '\n' + block, encoding='utf-8')

index = Path('web/index.html')
html = index.read_text(encoding='utf-8')
favicon = '  <link rel="icon" type="image/png" href="/assets/og/kawvo-link-og.png" />\n'
if 'rel="icon"' not in html:
    html = html.replace('  <title>INTAP LINK - SaaS</title>\n', '  <title>Kawvo Link</title>\n' + favicon)
else:
    import re
    html = re.sub(r'\s*<link[^>]+rel=["\']icon["\'][^>]*>\s*', '\n' + favicon, html, count=1, flags=re.I)
index.write_text(html, encoding='utf-8')

print('✓ Hotfix Demo: no-cache en /demo y /demo/* + favicon Kawvo Link')
