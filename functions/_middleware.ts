/**
 * Cloudflare Pages Functions middleware.
 * Runs at the edge for every request, before static assets are served.
 *
 * Handles:
 *   1. /admin and /admin/* → redirect to app.intaprd.com (panel admin)
 *   2. /?slug=VALUE        → redirect to /VALUE (perfil público)
 *   3. /:slug              → inject Open Graph / Twitter Card metadata dynamically
 */
export async function onRequest(context: {
  request: Request;
  next: () => Promise<Response>;
}): Promise<Response> {
  const withSecurityHeaders = (response: Response): Response => {
    const headers = new Headers(response.headers);
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('X-Frame-Options', 'DENY');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };

  const escapeHtml = (value: string): string =>
    value
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const injectHeadMetadata = (html: string, metadata: {
    title: string;
    description: string;
    url: string;
    image: string;
    siteName: string;
  }): string => {
    const title = escapeHtml(metadata.title);
    const description = escapeHtml(metadata.description);
    const pageUrl = escapeHtml(metadata.url);
    const imageUrl = escapeHtml(metadata.image);
    const siteName = escapeHtml(metadata.siteName);

    const metaBlock = `
  <!-- INTAP LINK: Open Graph metadata -->
  <title>${title}</title>
  <link rel="canonical" href="${pageUrl}" />
  <meta name="description" content="${description}" />
  <meta property="og:type" content="profile" />
  <meta property="og:site_name" content="${siteName}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${pageUrl}" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:image:secure_url" content="${imageUrl}" />
  <meta property="og:image:type" content="image/jpeg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${title}" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${imageUrl}" />
`;

    let output = html.replace(/<title>[\s\S]*?<\/title>/i, '');

    if (output.includes('</head>')) {
      return output.replace('</head>', `${metaBlock}\n</head>`);
    }

    return html;
  };

  const DEFAULT_OG_IMAGE = 'https://intaprd.com/assets/landing/intap-og-default.png';

  /** Resolve avatarUrl to a full URL */
  const resolveAvatarUrl = (avatarUrl: string | null | undefined): string => {
    if (!avatarUrl) return DEFAULT_OG_IMAGE;
    if (avatarUrl.startsWith('http')) return avatarUrl;
    // R2 key — build public assets URL
    return `https://intaprd.com/api/v1/public/assets/${avatarUrl}`;
  };

  /** Returns true if the pathname looks like a system route or static asset */
  const isSystemPath = (pathname: string): boolean => {
    if (pathname === '/') return true;
    if (
      pathname.startsWith('/api/') ||
      pathname.startsWith('/admin') ||
      pathname.startsWith('/auth') ||
      pathname.startsWith('/assets/') ||
      pathname.startsWith('/favicon') ||
      pathname === '/robots.txt' ||
      pathname.startsWith('/sitemap')
    ) return true;
    // Has a file extension
    if (/\.[a-zA-Z0-9]+$/.test(pathname)) return true;
    return false;
  };

  const url = new URL(context.request.url);

  // Redirigir rutas /admin al panel admin en app.intaprd.com
  // Sólo desde el dominio público — evita loop si app.intaprd.com usa el mismo proyecto
  if (url.hostname !== 'app.intaprd.com' &&
      (url.pathname === '/admin' || url.pathname.startsWith('/admin/'))) {
    const target = 'https://app.intaprd.com' + url.pathname + url.search;
    return withSecurityHeaders(Response.redirect(target, 302));
  }

  // Redirigir /?slug=VALUE → /VALUE
  if (url.pathname === '/' && url.searchParams.has('slug')) {
    const slug = url.searchParams.get('slug')!.trim();
    if (slug) {
      const target = new URL(url);
      target.pathname = '/' + encodeURIComponent(slug);
      target.search = '';
      return withSecurityHeaders(Response.redirect(target.toString(), 302));
    }
  }

  // Dynamic Open Graph metadata for public profile slugs
  if (!isSystemPath(url.pathname)) {
    // Extract slug: strip leading slash and any trailing slash
    const slug = url.pathname.replace(/^\//, '').replace(/\/$/, '');

    if (slug) {
      try {
        const apiRes = await fetch(
          `https://intaprd.com/api/v1/public/profiles/${encodeURIComponent(slug)}`,
          { headers: { 'Accept': 'application/json' } }
        );

        if (apiRes.ok) {
          const body = await apiRes.json() as {
            ok: boolean;
            data?: {
              name?: string;
              bio?: string;
              avatarUrl?: string | null;
              slug?: string;
            };
          };

          if (body.ok && body.data) {
            const profile = body.data;
            const name = profile.name || slug;
            const bio = profile.bio || `Perfil de ${name} en INTAP LINK`;
            const avatarUrl = resolveAvatarUrl(profile.avatarUrl);
            const canonicalSlug = profile.slug || slug;
            const canonicalUrl = `https://intaprd.com/${canonicalSlug}`;

            const pageResponse = await context.next();
            const contentType = pageResponse.headers.get('content-type') || '';

            if (!contentType.includes('text/html')) {
              return withSecurityHeaders(pageResponse);
            }

            const html = await pageResponse.text();
            const updatedHtml = injectHeadMetadata(html, {
              title: name,
              description: bio,
              url: canonicalUrl,
              image: avatarUrl,
              siteName: 'INTAP LINK',
            });

            const headers = new Headers(pageResponse.headers);
            headers.set('content-type', 'text/html; charset=UTF-8');

            return withSecurityHeaders(new Response(updatedHtml, {
              status: pageResponse.status,
              statusText: pageResponse.statusText,
              headers,
            }));
          }
        }
      } catch {
        // Fetch failed or profile not found — fall through to normal response
      }
    }
  }

  return withSecurityHeaders(await context.next());
}
