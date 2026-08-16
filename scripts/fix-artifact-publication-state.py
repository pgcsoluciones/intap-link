from pathlib import Path

# 1) Admin: do not offer a public link when the user's linked profile is unpublished.
admin_path = Path('app/src/components/admin/ArtifactActivation.tsx')
admin = admin_path.read_text()
old = "{item.profile_slug && <a href={item.public_url} className=\"mt-4 block text-sm font-black text-cyan-700\">Abrir enlace público →</a>}"
new = """{item.profile_slug && (Number(me?.is_published) === 1
                  ? <a href={item.public_url} className=\"mt-4 block text-sm font-black text-cyan-700\">Abrir enlace público →</a>
                  : <div className=\"mt-4 rounded-xl bg-amber-50 px-3 py-3\"><p className=\"text-xs font-bold text-amber-800\">Perfil vinculado · pendiente de publicar</p><Link to=\"/admin/free\" className=\"mt-2 inline-flex text-sm font-black text-cyan-700\">Publicar mi perfil →</Link></div>)}"""
if old not in admin:
    raise SystemExit('ArtifactManager target not found')
admin_path.write_text(admin.replace(old, new, 1))

# 2) API resolver: distinguish no destination, inactive profile, and unpublished profile.
api_path = Path('api/src/index.ts')
api = api_path.read_text()
old = """  if (!artifact.profile_id || !artifact.slug || Number(artifact.is_active) !== 1 || Number(artifact.is_published) !== 1) {
    return c.json({ ok: false, error: 'Artefacto aún no vinculado a un perfil público.' }, 409)
  }
"""
new = """  if (!artifact.profile_id || !artifact.slug) {
    return c.json({ ok: false, error: 'Este producto todavía no tiene un perfil vinculado.', reason: 'PROFILE_NOT_LINKED' }, 409)
  }
  if (Number(artifact.is_active) !== 1) {
    return c.json({ ok: false, error: 'El perfil vinculado no está activo.', reason: 'PROFILE_INACTIVE' }, 409)
  }
  if (Number(artifact.is_published) !== 1) {
    return c.json({ ok: false, error: 'El perfil vinculado todavía no está publicado.', reason: 'PROFILE_UNPUBLISHED' }, 409)
  }
"""
if old not in api:
    raise SystemExit('API resolver target not found')
api_path.write_text(api.replace(old, new, 1))

# 3) Public edge: show the precise resolver state instead of collapsing every 409.
middleware_path = Path('functions/_middleware.ts')
middleware = middleware_path.read_text()
old = """    if (!resolution.ok) {
      const status = resolution.status === 410 || resolution.status === 409
        ? resolution.status
        : resolution.status >= 500 ? 503 : 404;
      return withSecurityHeaders(new Response(
        status === 409
          ? 'Este producto todavía no está vinculado a un perfil público.'
          : status === 410
            ? 'Este producto no está disponible.'
            : 'Artefacto no encontrado.',
        {
          status,
          headers: { 'Content-Type': 'text/plain; charset=UTF-8', 'Cache-Control': 'no-store' },
        },
      ));
    }
"""
new = """    if (!resolution.ok) {
      const status = resolution.status === 410 || resolution.status === 409
        ? resolution.status
        : resolution.status >= 500 ? 503 : 404;
      let resolverMessage = '';
      if (status === 409) {
        try {
          const payload = await resolution.clone().json() as { error?: string; reason?: string };
          resolverMessage = String(payload.error || '');
        } catch {
          resolverMessage = '';
        }
      }
      return withSecurityHeaders(new Response(
        status === 409
          ? (resolverMessage || 'Este producto todavía no está vinculado a un perfil público.')
          : status === 410
            ? 'Este producto no está disponible.'
            : 'Artefacto no encontrado.',
        {
          status,
          headers: { 'Content-Type': 'text/plain; charset=UTF-8', 'Cache-Control': 'no-store' },
        },
      ));
    }
"""
if old not in middleware:
    raise SystemExit('Middleware 409 target not found')
middleware_path.write_text(middleware.replace(old, new, 1))

print('Applied publication-state UX + resolver diagnostics.')
