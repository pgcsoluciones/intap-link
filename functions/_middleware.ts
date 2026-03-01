/**
 * Cloudflare Pages Functions middleware.
 * Runs at the edge for every request, before static assets are served.
 *
 * Handles two cases:
 *   1. /admin and /admin/* → redirect to app.intaprd.com (panel admin)
 *   2. /?slug=VALUE        → redirect to /VALUE (perfil público)
 */
export async function onRequest(context: {
  request: Request;
  next: () => Promise<Response>;
}): Promise<Response> {
  const url = new URL(context.request.url);

  // Redirigir rutas /admin al panel admin en app.intaprd.com
  if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) {
    const target = 'https://app.intaprd.com' + url.pathname + url.search;
    return Response.redirect(target, 302);
  }

  // Redirigir /?slug=VALUE → /VALUE
  if (url.pathname === '/' && url.searchParams.has('slug')) {
    const slug = url.searchParams.get('slug')!.trim();
    if (slug) {
      const target = new URL(url);
      target.pathname = '/' + encodeURIComponent(slug);
      target.search = '';
      return Response.redirect(target.toString(), 302);
    }
  }

  return context.next();
}
