/**
 * Cloudflare Pages Functions middleware.
 * Runs at the edge for every request, before static assets are served.
 *
 * Handles:
 *   1. /admin and /admin/* → redirect to app.intaprd.com (panel admin)
 *   2. /?slug=VALUE        → redirect to /VALUE (perfil público)
 *   3. /novi y /rentaord   → inject Open Graph / Twitter Card metadata
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
    imageType?: string;
    imageWidth?: string;
    imageHeight?: string;
    profileLabel?: string;
  }): string => {
    const title = escapeHtml(metadata.title);
    const description = escapeHtml(metadata.description);
    const pageUrl = escapeHtml(metadata.url);
    const imageUrl = escapeHtml(metadata.image);
    const siteName = escapeHtml(metadata.siteName);
    const imageType = escapeHtml(metadata.imageType || 'image/jpeg');
    const imageWidth = escapeHtml(metadata.imageWidth || '1200');
    const imageHeight = escapeHtml(metadata.imageHeight || '630');
    const profileLabel = escapeHtml(metadata.profileLabel || 'profile');

    const metaBlock = `
  <!-- INTAP LINK: Open Graph metadata for ${profileLabel} -->
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
  <meta property="og:image:type" content="${imageType}" />
  <meta property="og:image:width" content="${imageWidth}" />
  <meta property="og:image:height" content="${imageHeight}" />
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
    const imageUrl = `${url.origin}/assets/landing/nuevo-perfil-novi.jpg?v=novi-og-v3`;

    const updatedHtml = injectHeadMetadata(html, {
      title: 'NoviHome -Noldys Vicente-',
      description: 'Asesora inmobiliaria. Propiedades listas, orientación clara y acompañamiento confiable para comprar o invertir con seguridad.',
      url: canonicalUrl,
      image: imageUrl,
      siteName: 'INTAP LINK',
      imageType: 'image/jpeg',
      imageWidth: '1200',
      imageHeight: '630',
      profileLabel: '/novi',
    });

    const headers = new Headers(response.headers);
    headers.set('content-type', 'text/html; charset=UTF-8');

    return withSecurityHeaders(new Response(updatedHtml, {
      status: response.status,
      statusText: response.statusText,
      headers,
    }));
  }

  // Metadata social para perfil Comercial Jason.
  // Se calcula con el origin actual para soportar:
  // - https://intaprd.com/jason
  // - https://link.avanxy.com/jason
  if (url.pathname === '/jason' || url.pathname === '/jason/') {
    const response = await context.next();
    const contentType = response.headers.get('content-type') || '';

    if (!contentType.includes('text/html')) {
      return withSecurityHeaders(response);
    }

    const html = await response.text();
    const canonicalUrl = `${url.origin}/jason`;
    const imageUrl = `${url.origin}/assets/landing/hero-jason-05.png?v=jason-og-v1`;

    const updatedHtml = injectHeadMetadata(html, {
      title: 'Comercial Jason S.R.L. | Gomas y aros en Santo Domingo',
      description: 'Venta de gomas nuevas y usadas, aros, reparación y mantenimiento de aros en Santo Domingo. Más de 25 años de experiencia.',
      url: canonicalUrl,
      image: imageUrl,
      siteName: 'INTAP LINK',
      imageType: 'image/png',
      imageWidth: '1200',
      imageHeight: '630',
      profileLabel: '/jason',
    });

    const headers = new Headers(response.headers);
    headers.set('content-type', 'text/html; charset=UTF-8');

    return withSecurityHeaders(new Response(updatedHtml, {
      status: response.status,
      statusText: response.statusText,
      headers,
    }));
  }


  // Metadata social para perfil 1A Eventos.
  // Se calcula con el origin actual para soportar:
  // - https://intaprd.com/1aeventos
  // - https://link.intaprd.com/1aeventos
  if (url.pathname === '/1aeventos' || url.pathname === '/1aeventos/') {
    const response = await context.next();
    const contentType = response.headers.get('content-type') || '';

    if (!contentType.includes('text/html')) {
      return withSecurityHeaders(response);
    }

    const html = await response.text();
    const canonicalUrl = `${url.origin}/1aeventos`;
    const imageUrl = `${url.origin}/assets/1A%20eventos/perfil/perfil-gabriel-01.jpg?v=1aeventos-og-gabriel-v1`;

    const updatedHtml = injectHeadMetadata(html, {
      title: '1A Eventos | Gabriel Reyes Bello, Director Comercial',
      description: 'Perfil digital de Gabriel Reyes Bello, Director Comercial de 1A Eventos. Mobiliario premium, cristalería, mantelería, lounge y accesorios para eventos.',
      url: canonicalUrl,
      image: imageUrl,
      siteName: 'INTAP LINK',
      imageType: 'image/jpeg',
      imageWidth: '1200',
      imageHeight: '630',
      profileLabel: '/1aeventos',
    });

    const headers = new Headers(response.headers);
    headers.set('content-type', 'text/html; charset=UTF-8');

    return withSecurityHeaders(new Response(updatedHtml, {
      status: response.status,
      statusText: response.statusText,
      headers,
    }));
  }

  // Metadata social para perfil Rentao RD.
  // Se calcula con el origin actual para soportar:
  // - https://intaprd.com/rentaord
  // - https://link.avanxy.com/rentaord
  if (url.pathname === '/rentaord' || url.pathname === '/rentaord/') {
    const response = await context.next();
    const contentType = response.headers.get('content-type') || '';

    if (!contentType.includes('text/html')) {
      return withSecurityHeaders(response);
    }

    const html = await response.text();
    const canonicalUrl = `${url.origin}/rentaord`;
    const imageUrl = `${url.origin}/assets/rentaord/logo-rentao.png?v=rentaord-og-logo-v1`;

    const updatedHtml = injectHeadMetadata(html, {
      title: 'Rentao RD Car Rental',
      description: 'Renta vehículos modernos, seguros y listos para moverte sin complicaciones. Opciones para uso personal, familiar, ejecutivo y de trabajo.',
      url: canonicalUrl,
      image: imageUrl,
      siteName: 'INTAP LINK',
      imageType: 'image/png',
      imageWidth: '1667',
      imageHeight: '814',
      profileLabel: '/rentaord',
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
