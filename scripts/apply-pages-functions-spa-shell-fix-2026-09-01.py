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

# Social-card and profile metadata routes need the SPA HTML shell explicitly.
text = text.replace('    const response = await context.next();\n    const contentType = response.headers.get(\'content-type\') || \'\';\n',
                    '    const response = await fetchSpaShell();\n    const contentType = response.headers.get(\'content-type\') || \'\';\n', 1)

# Replace the next two profile-shell reads (static + dynamic).
needle = """    const response = await context.next();\n    const contentType = response.headers.get('content-type') || '';\n"""
for _ in range(2):
    if needle not in text:
        raise SystemExit('profile context.next marker not found')
    text = text.replace(needle, """    const response = await fetchSpaShell();\n    const contentType = response.headers.get('content-type') || '';\n""", 1)

old_tail = """  return withSecurityHeaders(await context.next());\n}\n"""
new_tail = """  // A root Pages middleware intercepts browser routes before Pages can apply\n  // its implicit SPA fallback. Reproduce that behavior explicitly for HTML\n  // navigations while leaving real assets/files to Pages' normal resolver.\n  if (isHtmlNavigation()) {\n    return withSecurityHeaders(await fetchSpaShell());\n  }\n\n  return withSecurityHeaders(await context.next());\n}\n"""
if old_tail not in text:
    raise SystemExit('tail marker not found')
text = text.replace(old_tail, new_tail, 1)

path.write_text(text, encoding='utf-8')
print('✓ Pages Functions: SPA shell explícito mediante ASSETS para rutas HTML')
