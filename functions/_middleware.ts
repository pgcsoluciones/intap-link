/**
 * Cloudflare Pages Functions middleware.
 * Runs at the edge for every request, before static assets are served.
 *
 * Handles:
 *   1. /admin and /admin/* → redirect to app.intaprd.com (panel admin)
 *   2. /?slug=VALUE        → redirect to /VALUE (perfil público)
 *   3. /novi               → inject Open Graph / Twitter Card metadata
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
  <!-- INTAP LINK: Open Graph metadata for /novi -->
  <title>${title}</title>
  <link rel="canonical" href="${pageUrl}" />
  <meta name="description" content="${description}" />
  <meta property="og:type" content="website" />
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
  <meta name="twitter:card" content="summary_large_image" />
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

  // Metadata social para perfil NOVI HOME.
  // Se calcula con el origin actual para soportar:
  // - https://intaprd.com/novi
  // - https://link.avanxy.com/novi
  if (url.pathname === '/novi' || url.pathname === '/novi/') {
    const response = await context.next();
    const contentType = response.headers.get('content-type') || '';

    if (!contentType.includes('text/html')) {
      return withSecurityHeaders(response);
    }

    const html = await response.text();
    const canonicalUrl = `${url.origin}/novi`;
    const imageUrl = `${url.origin}/assets/landing/nuevo-perfil-novi.jpg`;

    const updatedHtml = injectHeadMetadata(html, {
      title: 'NoviHome -Noldys Vicente-',
      description: 'Asesora inmobiliaria. Propiedades listas, orientación clara y acompañamiento confiable para comprar o invertir con seguridad.',
      url: canonicalUrl,
      image: imageUrl,
      siteName: 'INTAP LINK',
    });

    const headers = new Headers(response.headers);
    headers.set('content-type', 'text/html; charset=UTF-8');

    return withSecurityHeaders(new Response(updatedHtml, {
      status: response.status,
      statusText: response.statusText,
      headers,
    }));
  }

  return withSecurityHeaders(await context.next());
}
