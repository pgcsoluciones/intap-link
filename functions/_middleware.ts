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
 */
export async function onRequest(context: {
  request: Request;
  next: () => Promise<Response>;
  env: {
    ASSETS: { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> };
  };
}): Promise<Response> {
  const withSecurityHeaders = (response: Response): Response => {
    const headers = new Headers(response.headers);
    const requestUrl = new URL(context.request.url);
    const isPreviewHost = requestUrl.hostname === 'preview.intaprd.com';
    const isProductionHost =
      requestUrl.hostname === 'intaprd.com' ||
      requestUrl.hostname === 'www.intaprd.com';

    const isEmbeddedProfile =
      requestUrl.searchParams.get('embed') === '1' &&
      requestUrl.searchParams.get('preview') === '1';

    headers.set('X-Content-Type-Options', 'nosniff');

    if (isEmbeddedProfile && isProductionHost) {
      headers.delete('X-Frame-Options');
      headers.set(
        'Content-Security-Policy',
        'frame-ancestors https://app.intaprd.com'
      );
    } else if (isEmbeddedProfile && isPreviewHost) {
      headers.delete('X-Frame-Options');
      headers.set(
        'Content-Security-Policy',
        'frame-ancestors https://app.preview.intaprd.com'
      );
    } else if (isPreviewHost) {
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
    const imageWidthTag = metadata.imageWidth
      ? `<meta property="og:image:width" content="${String(metadata.imageWidth)}" />`
      : '';
    const imageHeightTag = metadata.imageHeight
      ? `<meta property="og:image:height" content="${String(metadata.imageHeight)}" />`
      : '';
    const ogType = escapeHtml(metadata.ogType || 'website');
    const twitterCard = escapeHtml(metadata.twitterCard || 'summary_large_image');
    const ogLocale = metadata.language === 'en-US' ? 'en_US' : 'es_DO';
    const alternateOgLocale = metadata.language === 'en-US' ? 'es_DO' : 'en_US';
    const seoHeadHtml = metadata.seoHeadHtml || '';
    const semanticFallbackHtml = metadata.semanticFallbackHtml || '';

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
      output = output.replace('</head>', `${metaBlock}\n</head>`);
    }

    if (semanticFallbackHtml) {
      if (output.includes('</body>')) {
        output = output.replace('</body>', `${semanticFallbackHtml}\n</body>`);
      } else {
        output += semanticFallbackHtml;
      }
    }

    return output;
  };

  const url = new URL(context.request.url);
  const discoveryRuntime = createDiscoveryRuntime(url);

  const normalizeSocialImage = (value: unknown): string => {
    const raw = typeof value === 'string' ? value.trim() : '';
    if (!raw || raw.startsWith('data:') || raw.startsWith('blob:')) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith('/')) return new URL(raw, url.origin).toString();
    const encodedKey = raw.split('/').filter(Boolean).map(encodeURIComponent).join('/');
    return encodedKey ? `${discoveryRuntime.apiBase}/assets/${encodedKey}` : '';
  };

  const imageTypeFor = (image: string): string => {
    const clean = image.toLowerCase().split('?')[0];
    if (clean.endsWith('.png')) return 'image/png';
    if (clean.endsWith('.webp')) return 'image/webp';
    if (clean.endsWith('.gif')) return 'image/gif';
    return 'image/jpeg';
  };

  const fetchPublicProfileForShare = async (slug: string): Promise<any | null> => {
    try {
      const response = await fetch(
        `${discoveryRuntime.apiBase}/profiles/${encodeURIComponent(slug)}`,
        { headers: { Accept: 'application/json' }, cf: { cacheTtl: 0, cacheEverything: false } } as RequestInit,
      );
      if (!response.ok) return null;
      const payload = await response.json() as any;
      return payload?.ok === true && payload?.data ? payload.data : null;
    } catch {
      return null;
    }
  };

  const profileShareImage = (profile: any): string => {
    const templateData = profile?.templateData && typeof profile.templateData === 'object'
      ? profile.templateData
      : {};
    const gallery = Array.isArray(profile?.gallery) ? profile.gallery : [];
    const galleryImage = gallery
      .map((item: any) => item?.imageUrl || item?.image_url || '')
      .map(normalizeSocialImage)
      .find(Boolean) || '';
    const candidates = [
      profile?.avatarUrl,
      profile?.avatar_url,
      profile?.heroUrl,
      profile?.hero_url,
      templateData?.heroUrl,
      templateData?.hero_url,
      galleryImage,
    ];
    return candidates.map(normalizeSocialImage).find(Boolean)
      || `${url.origin}/assets/og/kawvo-link-og.png`;
  };

  const dynamicDiscoveryEnhancement = (profile: any, canonicalUrl: string, image: string) => {
    if (!profile) return { seoHeadHtml: '', semanticFallbackHtml: '' };
    const clean = (value: unknown) => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
    const templateData = profile?.templateData && typeof profile.templateData === 'object' ? profile.templateData : {};
    const name = clean(profile?.name) || clean(profile?.slug) || 'Perfil Digital';
    const description = clean(profile?.bio) || clean(templateData?.shortDescription) || `Perfil digital de ${name}`;
    const role = clean(templateData?.role) || clean(templateData?.jobTitle) || '';
    const companyName = clean(templateData?.companyName) || '';
    const category = clean(profile?.category);
    const subcategory = clean(profile?.subcategory);
    const services = (Array.isArray(profile?.products) ? profile.products : [])
      .map((item: any) => ({ name: clean(item?.title), description: clean(item?.description) }))
      .filter((item: any) => item.name)
      .slice(0, 12);
    const phones = Array.from(new Set([
      clean(profile?.contact?.phone),
      clean(profile?.contact?.whatsapp),
      clean(profile?.whatsapp_number),
    ].filter(Boolean)));
    const email = clean(profile?.contact?.email);
    const address = clean(profile?.contact?.address);
    const mapUrl = clean(profile?.contact?.map_url);
    const hours = clean(profile?.contact?.hours);
    const sameAs = [
      ...(Array.isArray(profile?.social_links) ? profile.social_links.map((item: any) => clean(item?.url)) : []),
      ...(Array.isArray(profile?.links) ? profile.links.map((item: any) => clean(item?.url)) : []),
    ].filter((item: string) => /^https?:\/\//i.test(item));
    const entityType = role ? 'Person' : 'Organization';
    const keywords = Array.from(new Set([
      category,
      subcategory,
      role,
      companyName,
      ...services.map((item: any) => item.name),
    ].filter(Boolean)));
    const schema: any = {
      '@context': 'https://schema.org',
      '@type': entityType,
      '@id': `${canonicalUrl}#profile`,
      name,
      description,
      url: canonicalUrl,
      image,
      sameAs,
    };
    if (role) schema.jobTitle = role;
    if (companyName && entityType === 'Person') schema.worksFor = { '@type': 'Organization', name: companyName };
    if (category || subcategory) schema.knowsAbout = [category, subcategory, ...services.map((item: any) => item.name)].filter(Boolean);
    if (phones.length) schema.telephone = phones[0];
    if (email) schema.email = email;
    if (address) schema.address = { '@type': 'PostalAddress', streetAddress: address };
    if (mapUrl || address) schema.location = { '@type': 'Place', name: address || name, ...(mapUrl ? { hasMap: mapUrl } : {}) };
    if (hours) schema.openingHours = hours;
    if (services.length) {
      schema.hasOfferCatalog = {
        '@type': 'OfferCatalog',
        name: `Servicios de ${name}`,
        itemListElement: services.map((service: any) => ({
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: service.name,
            ...(service.description ? { description: service.description } : {}),
          },
        })),
      };
    }
    const seoHeadHtml = `
  <meta name="keywords" content="${escapeHtml(keywords.join(', '))}" />
  <link rel="alternate" type="text/markdown" href="${escapeHtml(`${canonicalUrl}/ai.md`)}" title="Información del perfil para asistentes de IA" />
  <link rel="alternate" type="application/json" href="${escapeHtml(`${canonicalUrl}/facts.json`)}" title="Datos estructurados verificables del perfil" />
  <script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>`;
    const serviceList = services.length
      ? `<h2>Servicios</h2><ul>${services.map((service: any) => `<li><strong>${escapeHtml(service.name)}</strong>${service.description ? `: ${escapeHtml(service.description)}` : ''}</li>`).join('')}</ul>`
      : '';
    const semanticFallbackHtml = `
  <noscript data-kawvo-profile-discovery="dynamic">
    <main>
      <h1>${escapeHtml(name)}</h1>
      ${role ? `<p>${escapeHtml(role)}</p>` : ''}
      ${category || subcategory ? `<p>${escapeHtml([category, subcategory].filter(Boolean).join(' · '))}</p>` : ''}
      <p>${escapeHtml(description)}</p>
      ${serviceList}
      ${address ? `<h2>Ubicación</h2><p>${escapeHtml(address)}</p>` : ''}
      ${phones.length || email ? `<h2>Contacto</h2><p>${escapeHtml([...phones, email].filter(Boolean).join(' · '))}</p>` : ''}
    </main>
  </noscript>`;
    return { seoHeadHtml, semanticFallbackHtml };
  };

  const discoveryResponse = await handleDiscoveryRequest(url, discoveryRuntime);

  if (discoveryResponse) {
    return withSecurityHeaders(discoveryResponse);
  }

  // Physical artifact URLs are operational redirects, not profile pages.
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

    try {
      const payload = await resolution.json() as { ok?: boolean; data?: { redirect_path?: string } };
      const redirectPath = payload.ok === true ? String(payload.data?.redirect_path || '') : '';
      if (!redirectPath.startsWith('/') || redirectPath.startsWith('//') || redirectPath.includes('\\')) {
        throw new Error('invalid redirect path');
      }

      const destination = new URL(redirectPath, url.origin);
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

  const isAdminPath = url.pathname === '/admin' || url.pathname.startsWith('/admin/');

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

  if (url.pathname === '/' && url.searchParams.has('slug')) {
    const slug = url.searchParams.get('slug')!.trim();
    if (slug) {
      const target = new URL(url);
      target.pathname = '/' + encodeURIComponent(slug);
      target.search = '';
      return withSecurityHeaders(Response.redirect(target.toString(), 302));
    }
  }

  const fetchSpaShell = async (): Promise<Response> => {
    const shellUrl = new URL('/index.html', context.request.url);
    return context.env.ASSETS.fetch(shellUrl);
  };

  const isHtmlNavigation = (): boolean => {
    if (!['GET', 'HEAD'].includes(context.request.method.toUpperCase())) return false;
    const accept = context.request.headers.get('accept') || '';
    if (accept && !accept.includes('text/html') && !accept.includes('*/*')) return false;
    const pathname = new URL(context.request.url).pathname;
    const lastSegment = pathname.split('/').filter(Boolean).pop() || '';
    return !lastSegment.includes('.');
  };

  const injectSimpleSocialCard = async (metadata: {
    title: string;
    description: string;
    image: string;
    canonicalUrl?: string;
    noIndex?: boolean;
  }): Promise<Response> => {
    const response = await fetchSpaShell();
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return withSecurityHeaders(response);

    const html = await response.text();
    const updatedHtml = injectHeadMetadata(html, {
      title: metadata.title,
      description: metadata.description,
      url: metadata.canonicalUrl || url.toString(),
      image: metadata.image,
      siteName: 'Kawvo Link',
      imageType: imageTypeFor(metadata.image),
      ogType: 'website',
      twitterCard: 'summary_large_image',
      language: 'es-DO',
    });
    const headers = new Headers(response.headers);
    headers.set('content-type', 'text/html; charset=UTF-8');
    headers.set(
      'x-robots-tag',
      metadata.noIndex || discoveryRuntime.isPreview
        ? 'noindex, nofollow, noarchive'
        : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
    );
    return withSecurityHeaders(new Response(updatedHtml, {
      status: response.status,
      statusText: response.statusText,
      headers,
    }));
  };

  // Card general de la marca.
  if (url.pathname === '/' || url.pathname === '') {
    return injectSimpleSocialCard({
      title: 'Crea tu Perfil Digital con Kawvo Link',
      description: 'Muestra lo que haces, comparte tus servicios y destaca tu negocio con un perfil digital moderno, editable y listo para compartir por QR, NFC o enlace.',
      image: `${url.origin}/assets/og/kawvo-link-og.png`,
      canonicalUrl: `${url.origin}/`,
    });
  }

  if (url.pathname === '/demo/ia' || url.pathname === '/demo/ia/') {
    return injectSimpleSocialCard({
      title: 'Crea una Demo personalizada con IA | Kawvo Link',
      description: 'Dinos a qué te dedicas y Kawvo prepara en segundos una propuesta de cómo podría verse tu Perfil Digital.',
      image: `${url.origin}/assets/og/kawvo-link-og.png`,
      canonicalUrl: `${url.origin}/demo/ia`,
    })
  }

  // Card social para invitaciones compartidas desde Mi cuenta.
  if (url.pathname === '/invitacion' || url.pathname === '/invitacion/') {
    return injectSimpleSocialCard({
      title: 'Te recomiendo Kawvo Link | Crea tu presentación digital',
      description: 'Crea tu presentación digital para mostrar quién eres, qué haces y cómo contactarte, todo en un solo lugar.',
      image: `${url.origin}/assets/og/kawvo-link-og.png`,
      canonicalUrl: `${url.origin}/invitacion`,
    });
  }

  // Card específica de la demo interactiva.
  if (url.pathname === '/demo' || url.pathname === '/demo/') {
    return injectSimpleSocialCard({
      title: 'Prueba gratis cómo se vería tu Perfil Digital | Kawvo Link',
      description: 'Elige tu actividad, personaliza tu información y mira en segundos cómo se vería tu perfil digital. Sin registro, sin descarga y sin compromiso.',
      image: `${url.origin}/assets/og/kawvo-link-og.png`,
      canonicalUrl: `${url.origin}/demo`,
    });
  }

  // Card dinámica de una demo compartida. WhatsApp/Facebook reciben metadata
  // server-side aunque la vista del perfil se renderice luego con React.
  const sharedDemoMatch = url.pathname.match(/^\/demo\/s\/([a-f0-9]{48})\/?$/i);
  if (sharedDemoMatch) {
    const token = sharedDemoMatch[1].toLowerCase();
    try {
      const shareResponse = await fetch(`${discoveryRuntime.apiBase}/demo/share/${token}`, {
        headers: { Accept: 'application/json' },
        cf: { cacheTtl: 0, cacheEverything: false },
      } as RequestInit);
      if (shareResponse.ok) {
        const share = await shareResponse.json() as any;
        const profile = share?.snapshot?.profile || {};
        const name = String(profile?.name || 'Perfil Digital').trim().slice(0, 80);
        const role = String(profile?.role || '').trim().slice(0, 120);
        const image = normalizeSocialImage(share?.assets?.portrait)
          || normalizeSocialImage(profile?.portrait)
          || normalizeSocialImage(profile?.hero)
          || `${url.origin}/assets/og/kawvo-link-og.png`;
        return injectSimpleSocialCard({
          title: `Así se vería el Perfil Digital de ${name} | Kawvo Link`,
          description: role
            ? `${role}. Mira esta vista previa y prueba gratis cómo se vería el tuyo.`
            : 'Mira esta vista previa y prueba gratis cómo se vería tu propio Perfil Digital con Kawvo Link.',
          image,
          canonicalUrl: `${url.origin}/demo/s/${token}`,
          noIndex: true,
        });
      }
    } catch {
      // Si la API temporal no responde, la SPA conserva su pantalla de error/expiración.
    }
  }

  const slug = url.pathname.replace(/^\/+|\/+$/g, '');

  // share=bancos: social card bancaria aprobada para WhatsApp y redes.
  if (url.searchParams.get('share') === 'bancos' && /^[a-z0-9][a-z0-9_-]{0,79}$/i.test(slug)) {
    const [bankMeta, profile] = await Promise.all([
      getDynamicProfileSeoBundle(slug, discoveryRuntime),
      fetchPublicProfileForShare(slug),
    ]);
    if (bankMeta) {
      const response = await fetchSpaShell();
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        const html = await response.text();
        const cleanName = bankMeta.title.split('|')[0].trim();
        const pageUrl = `${url.origin}/${encodeURIComponent(slug)}?share=bancos`;
        const image = profile ? profileShareImage(profile) : bankMeta.image;
        const updatedHtml = injectHeadMetadata(html, {
          title: `Datos bancarios de ${cleanName} | Kawvo Link`,
          description: 'Consulta los datos bancarios compartidos desde su presentación digital Kawvo Link.',
          url: pageUrl,
          image,
          imageType: imageTypeFor(image),
          siteName: bankMeta.siteName || 'Kawvo Link',
          ogType: 'website',
          twitterCard: 'summary_large_image',
          language: discoveryRuntime.language === 'en' ? 'en-US' : 'es-DO',
        });
        const headers = new Headers(response.headers);
        headers.set('content-type', 'text/html; charset=UTF-8');
        headers.set('x-robots-tag', 'noindex, nofollow, noarchive');
        return withSecurityHeaders(new Response(updatedHtml, { status: response.status, statusText: response.statusText, headers }));
      }
      return withSecurityHeaders(response);
    }
  }

  const staticProfile = getStaticProfileDiscovery(slug, discoveryRuntime);

  if (staticProfile) {
    const response = await fetchSpaShell();
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
      ogType: 'profile',
      twitterCard: 'summary',
      seoHeadHtml: buildProfileSeoHead(staticProfile, discoveryRuntime),
      semanticFallbackHtml: buildProfileSemanticFallback(staticProfile),
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

  const dynamicSlugEligible = /^[a-z0-9][a-z0-9_-]{0,79}$/i.test(slug);

  if (!staticProfile && dynamicSlugEligible) {
    const [dynamicMeta, profile] = await Promise.all([
      getDynamicProfileSeoBundle(slug, discoveryRuntime),
      fetchPublicProfileForShare(slug),
    ]);

    if (dynamicMeta) {
      const response = await fetchSpaShell();
      const contentType = response.headers.get('content-type') || '';

      if (!contentType.includes('text/html')) {
        return withSecurityHeaders(response);
      }

      const html = await response.text();
      const image = profile ? profileShareImage(profile) : dynamicMeta.image;
      const enhancement = dynamicDiscoveryEnhancement(profile, dynamicMeta.url, image);
      const updatedHtml = injectHeadMetadata(html, {
        title: dynamicMeta.title,
        description: dynamicMeta.description,
        url: dynamicMeta.url,
        image,
        imageType: imageTypeFor(image),
        siteName: dynamicMeta.siteName,
        ogType: 'profile',
        twitterCard: image.includes('/assets/og/kawvo-link-og.png') ? 'summary' : 'summary_large_image',
        language: discoveryRuntime.language === 'en' ? 'en-US' : 'es-DO',
        seoHeadHtml: `${dynamicMeta.seoHeadHtml || ''}${enhancement.seoHeadHtml}`,
        semanticFallbackHtml: `${dynamicMeta.semanticFallbackHtml || ''}${enhancement.semanticFallbackHtml}`,
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
  }

  // Root Pages middleware intercepts browser routes before Pages can apply
  // its SPA fallback. Serve index.html explicitly for HTML navigations while
  // leaving real assets/files to Pages' normal resolver.
  if (isHtmlNavigation()) {
    return withSecurityHeaders(await fetchSpaShell());
  }

  return withSecurityHeaders(await context.next());
}