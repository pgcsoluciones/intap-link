from pathlib import Path

path = Path('functions/_middleware.ts')
text = path.read_text(encoding='utf-8')

old = """export async function onRequest(context: {\n  request: Request;\n  next: () => Promise<Response>;\n}): Promise<Response> {\n"""
new = """export async function onRequest(context: {\n  request: Request;\n  next: () => Promise<Response>;\n  env: {\n    ASSETS: { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> };\n  };\n}): Promise<Response> {\n"""
if old not in text:
    raise SystemExit('context signature marker not found')
text = text.replace(old, new, 1)

marker = """  const injectSimpleSocialCard = async (metadata: {\n"""
helper = """  const fetchSpaShell = async (): Promise<Response> => {\n    const shellUrl = new URL('/index.html', context.request.url);\n    return context.env.ASSETS.fetch(shellUrl);\n  };\n\n  const isHtmlNavigation = (): boolean => {\n    if (!['GET', 'HEAD'].includes(context.request.method.toUpperCase())) return false;\n    const accept = context.request.headers.get('accept') || '';\n    if (accept && !accept.includes('text/html') && !accept.includes('*/*')) return false;\n    const pathname = new URL(context.request.url).pathname;\n    const lastSegment = pathname.split('/').filter(Boolean).pop() || '';\n    return !lastSegment.includes('.');\n  };\n\n"""
if marker not in text:
    raise SystemExit('injectSimpleSocialCard marker not found')
text = text.replace(marker, helper + marker, 1)

# Current middleware has two exact HTML shell reads with this formatting.
# Replace both; the final generic context.next() remains untouched for files/assets.
needle = """    const response = await context.next();\n    const contentType = response.headers.get('content-type') || '';\n"""
replacement = """    const response = await fetchSpaShell();\n    const contentType = response.headers.get('content-type') || '';\n"""
count = text.count(needle)
if count != 2:
    raise SystemExit(f'expected exactly 2 metadata shell reads, found {count}')
text = text.replace(needle, replacement)

old_tail = """  return withSecurityHeaders(await context.next());\n}\n"""
new_tail = """  // Root Pages middleware intercepts browser routes before Pages can apply\n  // its SPA fallback. Serve index.html explicitly for HTML navigations while\n  // leaving real assets/files to Pages' normal resolver.\n  if (isHtmlNavigation()) {\n    return withSecurityHeaders(await fetchSpaShell());\n  }\n\n  return withSecurityHeaders(await context.next());\n}\n"""
if old_tail not in text:
    raise SystemExit('tail marker not found')
text = text.replace(old_tail, new_tail, 1)

path.write_text(text, encoding='utf-8')
print(f'✓ Pages Functions: SPA shell explícito mediante ASSETS ({count} rutas metadata)')
