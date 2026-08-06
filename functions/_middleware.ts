import {
  buildProfileSemanticFallback,
  buildProfileSeoHead,
  getStaticProfileDiscovery,
  handleDiscoveryRequest,
} from './profile-discovery';

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
    imageType: string;
    imageWidth: number;
    imageHeight: number;
    ogType?: string;
    twitterCard?: string;
    seoHeadHtml?: string;
    semanticFallbackHtml?: string;
  }): string => {
    const title = escapeHtml(metadata.title);
    const description = escapeHtml(metadata.description);
    const pageUrl = escapeHtml(metadata.url);
    const imageUrl = escapeHtml(metadata.image);
    const siteName = escapeHtml(metadata.siteName);
    const imageType = escapeHtml(metadata.imageType);
    const imageWidth = String(metadata.imageWidth);
    const imageHeight = String(metadata.imageHeight);
    const ogType = escapeHtml(
      metadata.ogType || 'website'
    );
    const twitterCard = escapeHtml(
      metadata.twitterCard || 'summary_large_image'
    );
    const seoHeadHtml = metadata.seoHeadHtml || '';
    const semanticFallbackHtml =
      metadata.semanticFallbackHtml || '';

    const metaBlock = `
  <!-- INTAP LINK: Open Graph + SEO + GEO metadata -->
  <title>${title}</title>
  <link rel="canonical" href="${pageUrl}" />
  <meta name="description" content="${description}" />
  <meta property="og:type" content="${ogType}" />
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
  <meta name="twitter:card" content="${twitterCard}" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${imageUrl}" />
  <meta name="twitter:image:alt" content="${title}" />
${seoHeadHtml}
`;

    let output = html.replace(/<title>[\s\S]*?<\/title>/i, '');

    if (output.includes('</head>')) {
      output = output.replace(
        '</head>',
        `${metaBlock}\n</head>`
      );
    }

    if (semanticFallbackHtml) {
      if (output.includes('</body>')) {
        output = output.replace(
          '</body>',
          `${semanticFallbackHtml}\n</body>`
        );
      } else {
        output += semanticFallbackHtml;
      }
    }

    return output;
  };

  const url = new URL(context.request.url);

  const discoveryResponse =
    await handleDiscoveryRequest(url.pathname);

  if (discoveryResponse) {
    return withSecurityHeaders(discoveryResponse);
  }

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

  // STATIC PROFILE GRAPH CARDS V2
  const staticProfileMeta: Record<string, {
    title: string;
    description: string;
    url: string;
    image: string;
    siteName: string;
    imageType: string;
    imageWidth: number;
    imageHeight: number;
    ogType?: string;
    twitterCard?: string;
  }> = {
    novi: {
      title: 'NoviHome -Noldys Vicente-',
      description:
        'Asesora inmobiliaria. Propiedades listas, orientación clara y acompañamiento confiable para comprar o invertir con seguridad.',
      url: 'https://intaprd.com/novi',
      image:
        'https://intaprd.com/assets/landing/nuevo-perfil-novi.jpg?v=novi-og-v3',
      siteName: 'NoviHome',
      imageType: 'image/jpeg',
      imageWidth: 631,
      imageHeight: 752,
    },
    rentaord: {
      title: 'Rentao RD Car Rental',
      description:
        'Renta vehículos modernos, seguros y listos para moverte sin complicaciones. Opciones para uso personal, familiar, ejecutivo y de trabajo.',
      url: 'https://intaprd.com/rentaord',
      image:
        'https://intaprd.com/assets/rentaord/logo-rentao.png?v=rentaord-og-logo-v1',
      siteName: 'Rentao RD',
      imageType: 'image/png',
      imageWidth: 1667,
      imageHeight: 814,
    },
    jason: {
      title:
        'Comercial Jason S.R.L. | Gomas y aros en Santo Domingo',
      description:
        'Venta de gomas nuevas y usadas, aros, reparación y mantenimiento de aros en Santo Domingo. Más de 25 años de experiencia.',
      url: 'https://intaprd.com/jason',
      image:
        'https://intaprd.com/assets/landing/hero-jason-05.png?v=jason-og-v1',
      siteName: 'Comercial Jason S.R.L.',
      imageType: 'image/png',
      imageWidth: 629,
      imageHeight: 354,
    },
    aycdom2: {
      title:
        'Freddy Fulgencio | Gerente de operaciones de A&C Dominicana',
      description:
        'Integramos diseño técnico, mecanizado, soldadura, fabricación de equipos, automatización e instalación dentro de una misma solución.',
      url: 'https://intaprd.com/aycdom2',
      image:
        'https://intaprd.com/assets/aycdom/social/perfil-link-ayc-10.png?v=aycdom-og-v1',
      siteName: 'A&C Dominicana, S.R.L.',
      imageType: 'image/png',
      imageWidth: 676,
      imageHeight: 675,
      ogType: 'profile',
      twitterCard: 'summary',
    },

    aycdom: {
      title:
        'Mario Medina | Sales Engineer de A&C Dominicana',
      description:
        'Integramos diseño técnico, mecanizado, soldadura, fabricación de equipos, automatización e instalación dentro de una misma solución.',
      url: 'https://intaprd.com/aycdom',
      image:
        'https://intaprd.com/assets/aycdom/social/perfil-link-ayc-10.png?v=aycdom-og-v1',
      siteName: 'A&C Dominicana, S.R.L.',
      imageType: 'image/png',
      imageWidth: 676,
      imageHeight: 675,
      ogType: 'profile',
      twitterCard: 'summary',
    },

    '1aeventos': {
      title: '1A Eventos | Gabriel Reyes Bello',
      description:
        'Perfil digital de Gabriel Reyes Bello, asesor comercial de 1A Eventos. Mobiliario premium, cristalería, mantelería, lounge y accesorios para eventos.',
      url: 'https://intaprd.com/1aeventos',
      image:
        'https://intaprd.com/assets/1A%20eventos/perfil/perfil-gabriel-01.jpg?v=1aeventos-og-gabriel-v1',
      siteName: '1A Eventos',
      imageType: 'image/jpeg',
      imageWidth: 886,
      imageHeight: 1164,
    },
  };

  const slug = url.pathname.replace(/^\/+|\/+$/g, '');
  const staticMeta = staticProfileMeta[slug];

  if (staticMeta) {
    const discoveryProfile =
      getStaticProfileDiscovery(slug);

    if (!discoveryProfile) {
      throw new Error(
        `Missing discovery profile for ${slug}`
      );
    }

    const response = await context.next();
    const contentType = response.headers.get('content-type') || '';

    if (!contentType.includes('text/html')) {
      return withSecurityHeaders(response);
    }

    const html = await response.text();
    const updatedHtml = injectHeadMetadata(html, {
      ...staticMeta,
      seoHeadHtml:
        buildProfileSeoHead(discoveryProfile),
      semanticFallbackHtml:
        buildProfileSemanticFallback(
          discoveryProfile
        ),
    });
    const headers = new Headers(response.headers);

    headers.set('content-type', 'text/html; charset=UTF-8');
    headers.set(
      'x-robots-tag',
      'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
    );

    return withSecurityHeaders(new Response(updatedHtml, {
      status: response.status,
      statusText: response.statusText,
      headers,
    }));
  }

  return withSecurityHeaders(await context.next());
}
