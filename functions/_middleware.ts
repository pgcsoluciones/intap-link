import {
  buildProfileSemanticFallback,
  buildProfileSeoHead,
  createDiscoveryRuntime,
  getStaticProfileDiscovery,
  getDynamicProfileSeoBundle,
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
    const requestUrl = new URL(context.request.url);
    const isPreviewHost =
      requestUrl.hostname === 'preview.intaprd.com';

    headers.set('X-Content-Type-Options', 'nosniff');

    if (isPreviewHost) {
      headers.delete('X-Frame-Options');
      headers.set(
        'Content-Security-Policy',
        'frame-ancestors https://app.preview.intaprd.com'
      );
    } else {
      headers.set('X-Frame-Options', 'DENY');
    }

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
    imageWidth?: number;
    imageHeight?: number;
    ogType?: string;
    twitterCard?: string;
    language?: string;
    seoHeadHtml?: string;
    semanticFallbackHtml?: string;
  }): string => {
    const title = escapeHtml(metadata.title);
    const description = escapeHtml(metadata.description);
    const pageUrl = escapeHtml(metadata.url);
    const imageUrl = escapeHtml(metadata.image);
    const siteName = escapeHtml(metadata.siteName);
    const imageType = escapeHtml(metadata.imageType);
    const imageWidthTag =
      metadata.imageWidth
        ? `<meta property="og:image:width" content="${String(metadata.imageWidth)}" />`
        : '';
    const imageHeightTag =
      metadata.imageHeight
        ? `<meta property="og:image:height" content="${String(metadata.imageHeight)}" />`
        : '';
    const ogType = escapeHtml(
      metadata.ogType || 'website'
    );
    const twitterCard = escapeHtml(
      metadata.twitterCard || 'summary_large_image'
    );
    const ogLocale = metadata.language === 'en-US'
      ? 'en_US'
      : 'es_DO';
    const alternateOgLocale = metadata.language === 'en-US'
      ? 'es_DO'
      : 'en_US';
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
  <meta property="og:locale" content="${ogLocale}" />
  <meta property="og:locale:alternate" content="${alternateOgLocale}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${pageUrl}" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:image:secure_url" content="${imageUrl}" />
  <meta property="og:image:type" content="${imageType}" />
${imageWidthTag}
${imageHeightTag}
  <meta property="og:image:alt" content="${title}" />
  <meta name="twitter:card" content="${twitterCard}" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${imageUrl}" />
  <meta name="twitter:image:alt" content="${title}" />
${seoHeadHtml}
`;

    let output = html.replace(/<title>[\s\S]*?<\/title>/i, '');
    const language = metadata.language || 'es-DO';
    output = output.replace(
      /<html\b([^>]*)>/i,
      (_match, attributes: string) =>
        `<html${attributes.replace(/\s+lang=(?:"[^"]*"|'[^']*'|[^\s>]+)/i, '')} lang="${language}">`,
    );

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

  const discoveryRuntime = createDiscoveryRuntime(url);
  const discoveryResponse =
    await handleDiscoveryRequest(url, discoveryRuntime);

  if (discoveryResponse) {
    return withSecurityHeaders(discoveryResponse);
  }

  // Physical artifact URLs are operational redirects, not profile pages.
  // Resolve them at the edge through the runtime-matched API so the NFC/QR
  // destination can change without reprogramming the physical artifact.
  const artifactMatch = url.pathname.match(/^\/l\/([^/]+)\/?$/i);
  if (artifactMatch) {
    const publicCode = decodeURIComponent(artifactMatch[1]).trim().toUpperCase();
    if (!/^[A-Z2-9]{8,24}$/.test(publicCode)) {
      return withSecurityHeaders(new Response('Artefacto no encontrado.', {
        status: 404,
        headers: { 'Content-Type': 'text/plain; charset=UTF-8', 'Cache-Control': 'no-store' },
      }));
    }

    let resolution: Response;
    try {
      resolution = await fetch(
        `${discoveryRuntime.apiBase}/artifacts/${encodeURIComponent(publicCode)}/resolve`,
        { headers: { Accept: 'application/json' }, cf: { cacheTtl: 0, cacheEverything: false } } as RequestInit,
      );
    } catch {
      return withSecurityHeaders(new Response('Resolución temporalmente no disponible.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=UTF-8', 'Cache-Control': 'no-store' },
      }));
    }

    if (!resolution.ok) {
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

    try {
      const payload = await resolution.json() as { ok?: boolean; data?: { redirect_path?: string } };
      const redirectPath = payload.ok === true ? String(payload.data?.redirect_path || '') : '';
      if (!redirectPath.startsWith('/') || redirectPath.startsWith('//') || redirectPath.includes('\\')) {
        throw new Error('invalid redirect path');
      }

      const destination = new URL(redirectPath, url.origin);
      // Preserve query parameters supplied to the physical URL for future
      // campaign/analytics use, while never caching the redirect destination.
      for (const [key, value] of url.searchParams) destination.searchParams.append(key, value);
      const headers = new Headers({
        Location: destination.toString(),
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        Pragma: 'no-cache',
      });
      return withSecurityHeaders(new Response(null, { status: 302, headers }));
    } catch {
      return withSecurityHeaders(new Response('Respuesta de artefacto inválida.', {
        status: 502,
        headers: { 'Content-Type': 'text/plain; charset=UTF-8', 'Cache-Control': 'no-store' },
      }));
    }
  }

  // Redirigir /admin solo cuando la solicitud viene del frontend público.
  // Los hosts del panel y los deployments pages.dev deben servir la app directamente.
  const isAdminPath =
    url.pathname === '/admin' || url.pathname.startsWith('/admin/');

  if (isAdminPath) {
    const productionPublicHosts = new Set([
      'intaprd.com',
      'www.intaprd.com',
      'link.intaprd.com',
    ]);

    if (productionPublicHosts.has(url.hostname)) {
      const target = 'https://app.intaprd.com' + url.pathname + url.search;
      return withSecurityHeaders(Response.redirect(target, 302));
    }

    if (url.hostname === 'preview.intaprd.com') {
      const target = 'https://app.preview.intaprd.com' + url.pathname + url.search;
      return withSecurityHeaders(Response.redirect(target, 302));
    }
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

  const slug = url.pathname.replace(/^\/+|\/+$/g, '');
  const staticProfile = getStaticProfileDiscovery(
    slug,
    discoveryRuntime,
  );

  if (staticProfile) {

    const response = await context.next();
    const contentType = response.headers.get('content-type') || '';

    if (!contentType.includes('text/html')) {
      return withSecurityHeaders(response);
    }

    const html = await response.text();
    const updatedHtml = injectHeadMetadata(html, {
      title: staticProfile.title,
      description: staticProfile.description,
      url: staticProfile.url,
      image: staticProfile.image,
      siteName: staticProfile.siteName,
      imageType: staticProfile.imageType,
      imageWidth: staticProfile.imageWidth,
      imageHeight: staticProfile.imageHeight,
      ogType: staticProfile.schemaType === 'Person'
        ? 'profile'
        : 'profile',
      twitterCard: 'summary',
      seoHeadHtml:
        buildProfileSeoHead(staticProfile, discoveryRuntime),
      semanticFallbackHtml:
        buildProfileSemanticFallback(
          staticProfile,
        ),
      language: staticProfile.language,
    });
    const headers = new Headers(response.headers);

    headers.set('content-type', 'text/html; charset=UTF-8');
    headers.set(
      'x-robots-tag',
      discoveryRuntime.isPreview
        ? 'noindex, nofollow, noarchive'
        : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
    );

    return withSecurityHeaders(new Response(updatedHtml, {
      status: response.status,
      statusText: response.statusText,
      headers,
    }));
  }


  // Perfil dinámico: cualquier slug público válido que
  // no tenga metadata estática obtiene SEO/GEO/IA
  // desde el API central.
  const dynamicSlugEligible =
    /^[a-z0-9][a-z0-9_-]{0,79}$/i.test(
      slug
    )

  if (
    !staticProfile &&
    dynamicSlugEligible
  ) {
    const dynamicMeta =
      await getDynamicProfileSeoBundle(
        slug,
        discoveryRuntime,
      )

    if (dynamicMeta) {
      const response =
        await context.next()

      const contentType =
        response.headers.get(
          'content-type'
        ) || ''

      if (
        !contentType.includes(
          'text/html'
        )
      ) {
        return withSecurityHeaders(
          response
        )
      }

      const html =
        await response.text()

      const updatedHtml =
        injectHeadMetadata(
          html,
          {
            title:
              dynamicMeta.title,
            description:
              dynamicMeta.description,
            url:
              dynamicMeta.url,
            image:
              dynamicMeta.image,
            imageType:
              dynamicMeta.imageType,
            siteName:
              dynamicMeta.siteName,
            ogType:
              'profile',
            twitterCard:
              dynamicMeta.twitterCard,
            language: discoveryRuntime.language === 'en'
              ? 'en-US'
              : 'es-DO',
            seoHeadHtml:
              dynamicMeta.seoHeadHtml,
            semanticFallbackHtml:
              dynamicMeta
                .semanticFallbackHtml,
          }
        )

      const headers =
        new Headers(
          response.headers
        )

      headers.set(
        'content-type',
        'text/html; charset=UTF-8'
      )

      headers.set(
        'x-robots-tag',
        discoveryRuntime.isPreview
          ? 'noindex, nofollow, noarchive'
          : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
      )

      return withSecurityHeaders(
        new Response(
          updatedHtml,
          {
            status:
              response.status,
            statusText:
              response.statusText,
            headers,
          }
        )
      )
    }
  }

  return withSecurityHeaders(await context.next());
}
