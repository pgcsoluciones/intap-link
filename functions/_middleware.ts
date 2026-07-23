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
    imageType?: string;
    imageWidth?: number;
    imageHeight?: number;
    twitterCard?: 'summary' | 'summary_large_image';
  }): string => {
    const title = escapeHtml(metadata.title);
    const description = escapeHtml(metadata.description);
    const pageUrl = escapeHtml(metadata.url);
    const imageUrl = escapeHtml(metadata.image);
    const siteName = escapeHtml(metadata.siteName);
    const imageType = escapeHtml(
      metadata.imageType || 'image/jpeg'
    );
    const imageWidth = String(metadata.imageWidth || 1200);
    const imageHeight = String(metadata.imageHeight || 630);
    const twitterCard = escapeHtml(
      metadata.twitterCard || 'summary'
    );

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
  <meta property="og:image:type" content="${imageType}" />
  <meta property="og:image:width" content="${imageWidth}" />
  <meta property="og:image:height" content="${imageHeight}" />
  <meta property="og:image:alt" content="${title}" />
  <meta name="twitter:card" content="${twitterCard}" />
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
        twitterCard: 'summary_large_image';
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
          twitterCard: 'summary_large_image',
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
          twitterCard: 'summary_large_image',
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
          twitterCard: 'summary_large_image',
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
          twitterCard: 'summary_large_image',
        },

        biopestrd: {
          title: 'BioPests | Manejo Inteligente de Plagas',
          description:
            'Soluciones profesionales para prevenir, controlar y monitorear plagas en entornos más seguros y sostenibles.',
          url: 'https://intaprd.com/biopestrd',
          image:
            'https://intaprd.com/assets/biopestrd/values/innovacion.png?v=biopestrd-og-innovacion-v1',
          siteName: 'BioPests',
          imageType: 'image/png',
          imageWidth: 628,
          imageHeight: 628,
          twitterCard: 'summary_large_image',
        },
      };

      const staticMetadata = staticProfileMeta[slug];

      if (staticMetadata) {
        const pageResponse = await context.next();
        const contentType =
          pageResponse.headers.get('content-type') || '';

        if (!contentType.includes('text/html')) {
          return withSecurityHeaders(pageResponse);
        }

        const html = await pageResponse.text();
        const updatedHtml = injectHeadMetadata(
          html,
          staticMetadata
        );

        const headers = new Headers(pageResponse.headers);
        headers.set(
          'content-type',
          'text/html; charset=UTF-8'
        );

        return withSecurityHeaders(
          new Response(updatedHtml, {
            status: pageResponse.status,
            statusText: pageResponse.statusText,
            headers,
          })
        );
      }

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
