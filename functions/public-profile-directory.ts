import {
  STATIC_PROFILE_DISCOVERY,
  createDiscoveryRuntime,
  getStaticProfileDiscovery,
  type DiscoveryRuntime,
} from './profile-discovery';

type PublicDirectoryProfile = {
  slug: string;
  name: string;
  description: string;
  url: string;
  updatedAt?: string | null;
};

type DynamicDirectoryRow = {
  slug?: unknown;
  name?: unknown;
  bio?: unknown;
  updatedAt?: unknown;
};

function compactText(value: unknown): string {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim()
    : '';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeJsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

async function fetchDynamicProfiles(
  runtime: DiscoveryRuntime,
): Promise<PublicDirectoryProfile[] | null> {
  try {
    const response = await fetch(
      `${runtime.apiBase}/discovery/profiles`,
      {
        headers: { Accept: 'application/json' },
        cf: { cacheTtl: 0, cacheEverything: false },
      } as RequestInit,
    );

    if (!response.ok) return null;

    const payload = await response.json() as {
      ok?: boolean;
      data?: DynamicDirectoryRow[];
    };

    if (payload.ok !== true || !Array.isArray(payload.data)) {
      return null;
    }

    return payload.data.flatMap((row): PublicDirectoryProfile[] => {
      const slug = compactText(row?.slug).toLowerCase();
      if (!slug || !/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(slug)) return [];

      const name = compactText(row?.name) || slug;
      const description = compactText(row?.bio) || `Perfil digital de ${name}`;
      const updatedAt = compactText(row?.updatedAt) || null;

      return [{
        slug,
        name,
        description,
        url: `${runtime.baseUrl}/${encodeURIComponent(slug)}`,
        updatedAt,
      }];
    });
  } catch {
    return null;
  }
}

function staticProfiles(runtime: DiscoveryRuntime): PublicDirectoryProfile[] {
  return Object.keys(STATIC_PROFILE_DISCOVERY).flatMap((slug) => {
    const profile = getStaticProfileDiscovery(slug, runtime);
    if (!profile) return [];
    return [{
      slug: profile.slug,
      name: profile.name,
      description: profile.description,
      url: profile.url,
      updatedAt: profile.lastUpdated,
    }];
  });
}

function mergeProfiles(
  dynamicProfiles: PublicDirectoryProfile[],
  runtime: DiscoveryRuntime,
): PublicDirectoryProfile[] {
  const merged = new Map<string, PublicDirectoryProfile>();

  for (const profile of staticProfiles(runtime)) {
    merged.set(profile.slug, profile);
  }

  for (const profile of dynamicProfiles) {
    merged.set(profile.slug, profile);
  }

  return Array.from(merged.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
  );
}

function renderDirectoryHtml(
  profiles: PublicDirectoryProfile[],
  runtime: DiscoveryRuntime,
): string {
  const canonical = `${runtime.baseUrl}/perfiles`;
  const robots = runtime.isPreview
    ? 'noindex,nofollow,noarchive'
    : 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1';

  const itemList = profiles.map((profile, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    url: profile.url,
    name: profile.name,
  }));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${canonical}#page`,
        url: canonical,
        name: 'Directorio de perfiles públicos | Kawvo Link',
        description: 'Directorio rastreable de perfiles públicos creados en Kawvo Link.',
        inLanguage: 'es-DO',
        mainEntity: { '@id': `${canonical}#profiles` },
      },
      {
        '@type': 'ItemList',
        '@id': `${canonical}#profiles`,
        numberOfItems: profiles.length,
        itemListElement: itemList,
      },
    ],
  };

  const entries = profiles.map((profile) => {
    const aiUrl = `${profile.url}/ai.md`;
    const factsUrl = `${profile.url}/facts.json`;
    return `
        <article>
          <h2><a href="${escapeHtml(profile.url)}">${escapeHtml(profile.name)}</a></h2>
          <p>${escapeHtml(profile.description)}</p>
          <p>
            <a href="${escapeHtml(aiUrl)}">Resumen para asistentes de IA</a>
            · <a href="${escapeHtml(factsUrl)}">Datos verificables</a>
          </p>
        </article>`;
  }).join('\n');

  return `<!doctype html>
<html lang="es-DO">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Directorio de perfiles públicos | Kawvo Link</title>
  <meta name="description" content="Directorio rastreable de perfiles públicos creados en Kawvo Link." />
  <meta name="robots" content="${robots}" />
  <meta name="googlebot" content="${robots}" />
  <meta name="bingbot" content="${robots}" />
  <link rel="canonical" href="${escapeHtml(canonical)}" />
  <link rel="sitemap" type="application/xml" href="${escapeHtml(`${runtime.baseUrl}/sitemap.xml`)}" />
  <link rel="alternate" type="text/plain" href="${escapeHtml(`${runtime.baseUrl}/llms.txt`)}" title="Directorio para asistentes de IA" />
  <script type="application/ld+json">${escapeJsonForScript(jsonLd)}</script>
  <style>
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #f8fafc; color: #0f172a; }
    main { box-sizing: border-box; max-width: 860px; margin: 0 auto; padding: 40px 24px 72px; }
    header { margin-bottom: 28px; }
    h1 { margin: 0 0 10px; font-size: clamp(30px, 5vw, 46px); line-height: 1.08; }
    h2 { margin: 0 0 8px; font-size: 20px; }
    p { line-height: 1.6; }
    article { background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; margin: 14px 0; }
    a { color: #0f4fd6; }
    nav { margin-top: 28px; }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Directorio de perfiles públicos</h1>
      <p>Kawvo Link reúne perfiles digitales públicos de profesionales, emprendedores y empresas. Esta página existe para facilitar el rastreo, la indexación y la comprensión del contenido por buscadores y asistentes de IA.</p>
      <p>Perfiles públicos disponibles: <strong>${profiles.length}</strong>.</p>
    </header>
${entries || '    <p>No hay perfiles públicos disponibles en este momento.</p>'}
    <nav aria-label="Recursos de descubrimiento">
      <a href="${escapeHtml(`${runtime.baseUrl}/sitemap.xml`)}">Sitemap XML</a>
      · <a href="${escapeHtml(`${runtime.baseUrl}/llms.txt`)}">llms.txt</a>
      · <a href="${escapeHtml(runtime.baseUrl)}">Kawvo Link</a>
    </nav>
  </main>
</body>
</html>`;
}

export async function handlePublicProfileDirectory(
  input: URL | string,
  suppliedRuntime?: DiscoveryRuntime,
): Promise<Response | null> {
  const url = input instanceof URL
    ? input
    : new URL(input, 'https://intaprd.com');

  const normalized = url.pathname.replace(/\/+$/, '') || '/';
  if (normalized !== '/perfiles') return null;

  const runtime = suppliedRuntime || createDiscoveryRuntime(url);
  const dynamicProfiles = await fetchDynamicProfiles(runtime);

  if (dynamicProfiles === null) {
    return new Response('Directorio temporalmente no disponible.\n', {
      status: 503,
      headers: {
        'content-type': 'text/plain; charset=UTF-8',
        'cache-control': 'no-store',
        'retry-after': '60',
      },
    });
  }

  const profiles = mergeProfiles(dynamicProfiles, runtime);
  const html = renderDirectoryHtml(profiles, runtime);

  const headers = new Headers({
    'content-type': 'text/html; charset=UTF-8',
    'content-language': 'es-DO',
    'cache-control': runtime.isPreview
      ? 'no-store'
      : 'public, max-age=60, s-maxage=300, stale-while-revalidate=300',
    'link': `<${runtime.baseUrl}/sitemap.xml>; rel="sitemap"; type="application/xml", <${runtime.baseUrl}/llms.txt>; rel="alternate"; type="text/plain"`,
  });

  if (runtime.isPreview) {
    headers.set('x-robots-tag', 'noindex, nofollow, noarchive');
  } else {
    headers.set('x-robots-tag', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
  }

  return new Response(html, { status: 200, headers });
}
