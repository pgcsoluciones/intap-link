/**
 * Cloudflare Pages Functions middleware.
 * Runs at the edge for every request, before static assets are served.
 *
 * Purpose: redirect /?slug=VALUE → /VALUE so that both URL formats work:
 *   https://main.intap-web.pages.dev/?slug=juan  →  /juan
 *   https://main.intap-web.pages.dev/juan         →  /juan (already works)
 *
 * Why here and not in _redirects or index.html:
 *   - Cloudflare Pages _redirects does NOT support query-string matching.
 *   - An inline script in index.html is a client-side redirect and still
 *     depends on which index.html the edge happens to have cached.
 *   - This middleware runs unconditionally at the edge on every request,
 *     regardless of which deployment version is cached for the alias.
 */
export async function onRequest(context: {
  request: Request;
  next: () => Promise<Response>;
}): Promise<Response> {
  const url = new URL(context.request.url);

  if (url.pathname === '/' && url.searchParams.has('slug')) {
    const slug = url.searchParams.get('slug')!.trim();

    if (slug) {
      const target = new URL(url);
      target.pathname = '/' + encodeURIComponent(slug);
      target.search = '';
      // 302 so browsers don't permanently cache the redirect
      return Response.redirect(target.toString(), 302);
    }
  }

  return context.next();
}
