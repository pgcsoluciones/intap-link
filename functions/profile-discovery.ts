export type ProfileService = {
  name: string;
  description: string;
};

export type ProfileFaq = {
  question: string;
  answer: string;
};

export type ProfileAddress = {
  streetAddress: string;
  addressLocality: string;
  addressRegion?: string;
  postalCode?: string;
  addressCountry: string;
};

export type ProfileDiscovery = {
  slug: string;
  title: string;
  name: string;
  alternateName?: string[];
  description: string;
  longDescription: string;
  url: string;
  image: string;
  imageType: string;
  imageWidth: number;
  imageHeight: number;
  siteName: string;
  schemaType: string;
  telephones: string[];
  email?: string;
  address?: ProfileAddress;
  sameAs: string[];
  services: ProfileService[];
  faqs?: ProfileFaq[];
  openingHours?: string[];
  areaServed?: string[];
  keywords: string[];
  person?: {
    name: string;
    jobTitle: string;
  };
  lastUpdated: string;
  language?: 'es-DO' | 'en-US';
};

const BASE_URL = 'https://intaprd.com';
const PREVIEW_API_BASE =
  'https://api-preview.intaprd.com/api/v1/public';
const PRODUCTION_API_BASE =
  'https://api.intaprd.com/api/v1/public';

// Endpoint Worker accesible desde Pages Functions.
// El dominio canónico de los perfiles continúa siendo
// https://intaprd.com/{slug}.
export type DiscoveryRuntime = {
  baseUrl: string;
  apiBase: string;
  isPreview: boolean;
  language: 'es' | 'en';
};

function normalizeOrigin(value: string): string {
  try {
    return new URL(value).origin.replace(/\/+$/, '');
  } catch {
    return BASE_URL;
  }
}

function isProductionHost(hostname: string): boolean {
  return hostname === 'intaprd.com' || hostname === 'www.intaprd.com';
}

export function createDiscoveryRuntime(
  input?: URL | string,
): DiscoveryRuntime {
  const url = input instanceof URL
    ? input
    : input
      ? new URL(input)
      : new URL(BASE_URL);
  const production = isProductionHost(url.hostname);
  const isPreview = !production;
  // Fase actual:
  // SEO, GEO y AI Discovery permanecen en español.
  // DiscoveryRuntime conserva el tipo ES/EN para que
  // podamos habilitar SEO localizado en una fase futura.
  const language: 'es' = 'es';

  return {
    baseUrl: production ? BASE_URL : normalizeOrigin(url.origin),
    apiBase: production ? PRODUCTION_API_BASE : PREVIEW_API_BASE,
    isPreview,
    language,
  };
}

const DEFAULT_RUNTIME = createDiscoveryRuntime();

// INTAP DYNAMIC DISCOVERY V2
type DynamicDiscoveryProfile = {
  slug: string;
  name: string;
  bio: string;
  avatarUrl?: string | null;
  category?: string | null;
  subcategory?: string | null;
  updatedAt?: string | null;
};

type DynamicPublicProfile = {
  slug?: string;
  name?: string;
  bio?: string;
  avatarUrl?: string | null;
  category?: string | null;
  subcategory?: string | null;
  updatedAt?: string | null;
  templateData?: Record<string, unknown> | null;
  whatsapp_number?: string | null;
  contact?: {
    whatsapp?: string | null;
    email?: string | null;
    phone?: string | null;
    hours?: string | null;
    address?: string | null;
    map_url?: string | null;
  } | null;
  social_links?: Array<{
    type?: string;
    url?: string;
  }>;
  links?: Array<{
    label?: string;
    url?: string;
  }>;
  faqs?: Array<{
    question?: string;
    answer?: string;
  }>;
  products?: Array<{
    title?: string;
    description?: string | null;
  }>;
};

function compactText(
  value: unknown,
  fallback = ''
): string {
  if (typeof value !== 'string') return fallback;

  const compact = value
    .replace(/\s+/g, ' ')
    .trim();

  return compact || fallback;
}

function markdownEscape(value: string): string {
  return value.replace(
    /([\\`*_[\]<>])/g,
    '\\$1'
  );
}

function publicProfileUrl(
  slug: string,
  runtime: DiscoveryRuntime = DEFAULT_RUNTIME,
  language = runtime.language,
): string {
  const suffix = language === 'en' && slug === 'aycdom'
    ? '?lang=en'
    : '';
  return `${runtime.baseUrl}/${encodeURIComponent(slug)}${suffix}`;
}

function profileResourceUrl(
  profileUrl: string,
  resource: 'ai.md' | 'facts.json',
): string {
  const url = new URL(profileUrl);
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/${resource}`;
  return url.toString();
}

function discoveryDate(value: unknown): string {
  const raw = compactText(value);

  if (!raw) {
    return new Date().toISOString().slice(0, 10);
  }

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}

function collectHttpUrls(
  values: unknown[]
): string[] {
  const urls = values
    .map((value) => compactText(value))
    .filter(Boolean)
    .filter((value) => {
      try {
        const url = new URL(value);
        return (
          url.protocol === 'https:' ||
          url.protocol === 'http:'
        );
      } catch {
        return false;
      }
    });

  return Array.from(new Set(urls));
}

async function fetchDynamicDiscoveryProfiles(
  runtime: DiscoveryRuntime = DEFAULT_RUNTIME,
): Promise<DynamicDiscoveryProfile[]> {
  try {
    const response = await fetch(
      `${runtime.apiBase}/discovery/profiles`,
      {
        headers: {
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) return [];

    const payload = await response.json() as {
      ok?: boolean;
      data?: unknown;
    };

    if (
      payload.ok !== true ||
      !Array.isArray(payload.data)
    ) {
      return [];
    }

    return payload.data.flatMap(
      (row): DynamicDiscoveryProfile[] => {
        if (
          !row ||
          typeof row !== 'object'
        ) {
          return [];
        }

        const item =
          row as Record<string, unknown>;

        const slug = compactText(
          item.slug
        ).toLowerCase();

        if (
          !slug ||
          slug.includes('/')
        ) {
          return [];
        }

        const name = compactText(
          item.name,
          slug
        );

        return [{
          slug,
          name,
          bio: compactText(
            item.bio,
            `Perfil de ${name} en INTAP LINK`
          ),
          avatarUrl:
            compactText(item.avatarUrl) || null,
          category:
            compactText(item.category) || null,
          subcategory:
            compactText(item.subcategory) || null,
          updatedAt:
            compactText(item.updatedAt) || null,
        }];
      }
    );
  } catch {
    // Fallback seguro: los perfiles estáticos
    // continúan disponibles.
    return [];
  }
}

async function fetchDynamicPublicProfile(
  slug: string,
  runtime: DiscoveryRuntime = DEFAULT_RUNTIME,
): Promise<DynamicPublicProfile | null> {
  try {
    const response = await fetch(
      `${runtime.apiBase}/profiles/${encodeURIComponent(slug)}`,
      {
        headers: {
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) return null;

    const payload = await response.json() as {
      ok?: boolean;
      data?: DynamicPublicProfile;
    };

    if (
      payload.ok !== true ||
      !payload.data
    ) {
      return null;
    }

    return payload.data;
  } catch {
    return null;
  }
}


function dynamicTemplateText(
  profile: DynamicPublicProfile,
  ...keys: string[]
): string {
  const data = profile.templateData

  if (
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data)
  ) {
    return ''
  }

  for (const key of keys) {
    const value = (
      data as Record<string, unknown>
    )[key]

    const normalized =
      compactText(value)

    if (normalized) {
      return normalized
    }
  }

  return ''
}

function dynamicCompanyName(
  profile: DynamicPublicProfile
): string {
  return dynamicTemplateText(
    profile,
    'companyName'
  )
}

function dynamicRole(
  profile: DynamicPublicProfile
): string {
  const explicitRole =
    dynamicTemplateText(
      profile,
      'role',
      'jobTitle'
    )

  if (explicitRole) {
    return explicitRole
  }

  const title =
    dynamicTemplateText(
      profile,
      'title'
    )

  const company =
    dynamicCompanyName(profile)

  if (
    title &&
    company &&
    title.toLowerCase() !==
      company.toLowerCase()
  ) {
    return title
  }

  return ''
}

function dynamicEntityType(
  profile: DynamicPublicProfile
): 'Person' | 'Organization' {
  return dynamicRole(profile)
    ? 'Person'
    : 'Organization'
}

function truncateSeoText(
  value: string,
  maxLength: number
): string {
  const normalized =
    compactText(value)

  if (
    normalized.length <= maxLength
  ) {
    return normalized
  }

  const clipped = normalized
    .slice(0, maxLength - 1)
    .replace(/\s+\S*$/, '')
    .trim()

  return `${clipped || normalized.slice(
    0,
    maxLength - 1
  )}…`
}

function inferDynamicImageType(
  image: string
): string {
  const clean = image
    .toLowerCase()
    .split('?')[0]

  if (clean.endsWith('.png')) {
    return 'image/png'
  }

  if (clean.endsWith('.webp')) {
    return 'image/webp'
  }

  if (clean.endsWith('.gif')) {
    return 'image/gif'
  }

  return 'image/jpeg'
}

export async function getDynamicProfileSeoBundle(
  requestedSlug: string,
  runtime: DiscoveryRuntime = DEFAULT_RUNTIME,
): Promise<{
  title: string;
  description: string;
  url: string;
  image: string;
  imageType: string;
  siteName: string;
  seoHeadHtml: string;
  semanticFallbackHtml: string;
} | null> {
  const profile =
    await fetchDynamicPublicProfile(
      requestedSlug,
      runtime,
    )

  if (!profile) {
    return null
  }

  const slug = compactText(
    profile.slug,
    requestedSlug
  ).toLowerCase()

  if (
    !slug ||
    slug.includes('/')
  ) {
    return null
  }

  const name = compactText(
    profile.name,
    slug
  )

  const company =
    dynamicCompanyName(profile)

  const role =
    dynamicRole(profile)

  const entityType =
    dynamicEntityType(profile)

  const titleSource = role
    ? `${name} | ${role}`
    : (
        company &&
        company.toLowerCase() !==
          name.toLowerCase()
      )
      ? `${name} | ${company}`
      : name

  const descriptionSource =
    compactText(profile.bio) ||
    dynamicTemplateText(
      profile,
      'shortDescription',
      'companyHeadline',
      'companyAbout'
    ) ||
    `Perfil digital de ${name} en INTAP LINK`

  const title =
    truncateSeoText(
      titleSource,
      80
    )

  const description =
    truncateSeoText(
      descriptionSource,
      180
    )

  const url =
    publicProfileUrl(slug, runtime)

  const image =
    compactText(
      profile.avatarUrl
    ) ||
    `${runtime.baseUrl}/favicon.ico`

  const telephones =
    Array.from(
      new Set([
        compactText(
          profile.contact?.phone
        ),
        compactText(
          profile.contact?.whatsapp
        ),
        compactText(
          profile.whatsapp_number
        ),
      ].filter(Boolean))
    )

  const email =
    compactText(
      profile.contact?.email
    )

  const address =
    compactText(
      profile.contact?.address
    )

  const sameAs =
    collectHttpUrls([
      ...(
        Array.isArray(
          profile.social_links
        )
          ? profile.social_links.map(
              (item) => item?.url
            )
          : []
      ),
      ...(
        Array.isArray(
          profile.links
        )
          ? profile.links.map(
              (item) => item?.url
            )
          : []
      ),
    ])

  const seoInput = {
    name,
    description,
    url,
    image,
    entityType,
    jobTitle: role || undefined,
    telephones,
    email: email || undefined,
    address: address || undefined,
    sameAs,
  }

  return {
    title,
    description,
    url,
    image,
    imageType:
      inferDynamicImageType(image),
    siteName:
      company || name,
    seoHeadHtml:
      buildDynamicProfileSeoHead(
        seoInput,
        runtime,
      ),
    semanticFallbackHtml:
      buildDynamicProfileSemanticFallback({
        name,
        description,
        url,
        telephones,
        email: email || undefined,
        address: address || undefined,
        sameAs,
      }, runtime),
  }
}

function buildDynamicAiMarkdown(
  profile: DynamicPublicProfile,
  requestedSlug: string,
  runtime: DiscoveryRuntime = DEFAULT_RUNTIME,
): string {
  const slug = compactText(
    profile.slug,
    requestedSlug
  ).toLowerCase();

  const name = compactText(
    profile.name,
    slug
  );

  const description = compactText(
    profile.bio,
    `Perfil de ${name} en INTAP LINK`
  );

  const canonical = publicProfileUrl(slug, runtime);

  const category = [
    compactText(profile.category),
    compactText(profile.subcategory),
  ]
    .filter(Boolean)
    .join(' · ');

  const phones = Array.from(
    new Set([
      compactText(profile.contact?.phone),
      compactText(profile.contact?.whatsapp),
      compactText(profile.whatsapp_number),
    ].filter(Boolean))
  );

  const services = (
    Array.isArray(profile.products)
      ? profile.products
      : []
  )
    .filter((item) =>
      compactText(item?.title)
    )
    .map((item) => {
      const title = markdownEscape(
        compactText(item.title)
      );

      const serviceDescription =
        markdownEscape(
          compactText(item.description)
        );

      return serviceDescription
        ? `- **${title}:** ${serviceDescription}`
        : `- ${title}`;
    });

  const faqs = (
    Array.isArray(profile.faqs)
      ? profile.faqs
      : []
  )
    .filter((faq) =>
      compactText(faq?.question) &&
      compactText(faq?.answer)
    );

  const officialUrls = collectHttpUrls([
    ...(
      Array.isArray(profile.social_links)
        ? profile.social_links.map(
            (item) => item?.url
          )
        : []
    ),
    ...(
      Array.isArray(profile.links)
        ? profile.links.map(
            (item) => item?.url
          )
        : []
    ),
  ]);

  const faqMarkdown = faqs.length
    ? [
        '',
        '## Preguntas frecuentes',
        '',
        ...faqs.flatMap((faq) => [
          `### ${markdownEscape(compactText(faq.question))}`,
          markdownEscape(compactText(faq.answer)),
          '',
        ]),
      ].join('\n')
    : '';

  return `# ${markdownEscape(name)}

> ${markdownEscape(description)}

- URL canónica: ${canonical}
- Tipo de entidad: ${dynamicEntityType(profile)}
- Categoría: ${markdownEscape(category || 'No especificada')}
- Idioma: es-DO
- Última actualización: ${
    profile.updatedAt
      ? discoveryDate(profile.updatedAt)
      : 'No especificada'
  }

## Descripción

${markdownEscape(description)}

## Servicios o productos

${services.length ? services.join('\n') : '- No especificados.'}

## Contacto

${phones.length
  ? phones.map(
      (phone) =>
        `- Teléfono: ${markdownEscape(phone)}`
    ).join('\n')
  : '- Teléfono no especificado.'}
${profile.contact?.email
  ? `- Correo: ${markdownEscape(compactText(profile.contact.email))}`
  : ''}
${profile.contact?.address
  ? `- Dirección: ${markdownEscape(compactText(profile.contact.address))}`
  : ''}
${profile.contact?.hours
  ? `- Horario: ${markdownEscape(compactText(profile.contact.hours))}`
  : ''}

## Enlaces oficiales

${officialUrls.length
  ? officialUrls.map(
      (url) => `- ${url}`
    ).join('\n')
  : `- ${canonical}`}

## Datos estructurados

- JSON verificable: ${profileResourceUrl(canonical, 'facts.json')}
- Página oficial: ${canonical}
${faqMarkdown}
`;
}

function buildDynamicFactsJson(
  profile: DynamicPublicProfile,
  requestedSlug: string,
  runtime: DiscoveryRuntime = DEFAULT_RUNTIME,
): string {
  const slug = compactText(
    profile.slug,
    requestedSlug
  ).toLowerCase();

  const name = compactText(
    profile.name,
    slug
  );

  const description = compactText(
    profile.bio,
    `Perfil de ${name} en INTAP LINK`
  );

  const canonical = publicProfileUrl(slug, runtime);

  const phones = Array.from(
    new Set([
      compactText(profile.contact?.phone),
      compactText(profile.contact?.whatsapp),
      compactText(profile.whatsapp_number),
    ].filter(Boolean))
  );

  const services = (
    Array.isArray(profile.products)
      ? profile.products
      : []
  )
    .filter((item) =>
      compactText(item?.title)
    )
    .map((item) => ({
      name: compactText(item.title),
      description:
        compactText(item.description) || null,
    }));

  const frequentlyAskedQuestions = (
    Array.isArray(profile.faqs)
      ? profile.faqs
      : []
  )
    .filter((faq) =>
      compactText(faq?.question) &&
      compactText(faq?.answer)
    )
    .map((faq) => ({
      question: compactText(faq.question),
      answer: compactText(faq.answer),
    }));

  const officialLinks = collectHttpUrls([
    canonical,
    ...(
      Array.isArray(profile.social_links)
        ? profile.social_links.map(
            (item) => item?.url
          )
        : []
    ),
    ...(
      Array.isArray(profile.links)
        ? profile.links.map(
            (item) => item?.url
          )
        : []
    ),
  ]);

  return JSON.stringify(
    {
      schemaVersion: '1.0',
      language: 'es-DO',
      canonicalUrl: canonical,
      generatedAt: new Date().toISOString(),
      lastUpdated:
        profile.updatedAt
          ? discoveryDate(profile.updatedAt)
          : null,
      entity: {
        type: dynamicEntityType(profile),
        name,
        description,
        category:
          compactText(profile.category) || null,
        subcategory:
          compactText(profile.subcategory) || null,
      },
      contact: {
        telephones: phones,
        email:
          compactText(profile.contact?.email) ||
          null,
        address:
          compactText(profile.contact?.address) ||
          null,
        openingHours:
          compactText(profile.contact?.hours) ||
          null,
        mapUrl:
          compactText(profile.contact?.map_url) ||
          null,
      },
      services,
      frequentlyAskedQuestions,
      officialLinks,
      image: profile.avatarUrl
        ? {
            url: profile.avatarUrl,
          }
        : null,
    },
    null,
    2
  );
}

export const STATIC_PROFILE_DISCOVERY: Record<
  string,
  ProfileDiscovery
> = {
  novi: {
    slug: 'novi',
    title: 'NoviHome -Noldys Vicente-',
    name: 'NoviHome',
    alternateName: [
      'NOVI HOME',
      'Noldys Vicente',
      'NoviHome Noldys Vicente',
    ],
    description:
      'Asesora inmobiliaria. Propiedades listas, orientación clara y acompañamiento confiable para comprar o invertir con seguridad.',
    longDescription:
      'NoviHome ofrece asesoría inmobiliaria personalizada para comprar, vender, alquilar e invertir en propiedades en Santo Domingo, con acompañamiento de Noldys Vicente.',
    url: `${BASE_URL}/novi`,
    image:
      `${BASE_URL}/assets/landing/nuevo-perfil-novi.jpg?v=novi-og-v3`,
    imageType: 'image/jpeg',
    imageWidth: 631,
    imageHeight: 752,
    siteName: 'NoviHome',
    schemaType: 'RealEstateAgent',
    telephones: ['+18099666087'],
    email: 'noldysvicente@gmail.com',
    address: {
      streetAddress: 'Av. Sarasota #45, Sector Bella Vista',
      addressLocality: 'Santo Domingo',
      addressRegion: 'Distrito Nacional',
      addressCountry: 'DO',
    },
    sameAs: [
      'https://www.instagram.com/noldys.novihome/',
    ],
    services: [
      {
        name: 'Compra de propiedades',
        description:
          'Búsqueda de propiedades según presupuesto, zona y estilo de vida.',
      },
      {
        name: 'Venta de propiedades',
        description:
          'Orientación para presentar propiedades y conectar con compradores.',
      },
      {
        name: 'Alquileres residenciales',
        description:
          'Opciones residenciales para personas y familias.',
      },
      {
        name: 'Inversión inmobiliaria',
        description:
          'Evaluación de propiedades con potencial de renta y plusvalía.',
      },
      {
        name: 'Agenda de visitas',
        description:
          'Coordinación de recorridos y visitas a propiedades.',
      },
      {
        name: 'Asesoría inmobiliaria personalizada',
        description:
          'Selección de opciones según zona, presupuesto y objetivo.',
      },
    ],
    faqs: [
      {
        question:
          '¿Me ayudas a buscar según mi presupuesto?',
        answer:
          'Sí. Las opciones se filtran según presupuesto, zona, tipo de propiedad y objetivo.',
      },
      {
        question:
          '¿Trabajas ventas y alquileres?',
        answer:
          'Sí. Se ofrece orientación para compra, venta, alquiler e inversión inmobiliaria.',
      },
      {
        question:
          '¿Puedo agendar una visita?',
        answer:
          'Sí. Las visitas se coordinan según el tipo de propiedad, la zona y la disponibilidad.',
      },
      {
        question:
          '¿Tienes opciones para inversión?',
        answer:
          'Sí. También se evalúan propiedades con potencial de renta, plusvalía o uso comercial.',
      },
    ],
    areaServed: [
      'Santo Domingo',
      'Distrito Nacional',
      'República Dominicana',
    ],
    keywords: [
      'asesora inmobiliaria',
      'propiedades en Santo Domingo',
      'apartamentos',
      'casas',
      'alquileres',
      'inversión inmobiliaria',
      'Noldys Vicente',
      'NoviHome',
    ],
    person: {
      name: 'Noldys Vicente',
      jobTitle: 'Asesora inmobiliaria',
    },
    lastUpdated: '2026-07-24',
  },

  rentaord: {
    slug: 'rentaord',
    title: 'Rentao RD Car Rental',
    name: 'Rentao RD',
    alternateName: [
      'RentaoRD',
      'Rentao RD Car Rental',
    ],
    description:
      'Renta vehículos modernos, seguros y listos para moverte sin complicaciones. Opciones para uso personal, familiar, ejecutivo y de trabajo.',
    longDescription:
      'Rentao RD ofrece alquiler de vehículos modernos e inspeccionados, incluyendo sedanes, SUV, pickups, movilidad ejecutiva y experiencias marítimas privadas.',
    url: `${BASE_URL}/rentaord`,
    image:
      `${BASE_URL}/assets/rentaord/logo-rentao.png?v=rentaord-og-logo-v1`,
    imageType: 'image/png',
    imageWidth: 1667,
    imageHeight: 814,
    siteName: 'Rentao RD',
    schemaType: 'AutoRental',
    telephones: ['+18498516427'],
    address: {
      streetAddress:
        'Calle 2da #61, Jardines del Sur',
      addressLocality: 'Santo Domingo',
      addressRegion: 'Distrito Nacional',
      postalCode: '11105',
      addressCountry: 'DO',
    },
    sameAs: [
      'https://www.instagram.com/rentaord/',
    ],
    services: [
      {
        name: 'Alquiler de vehículos',
        description:
          'Vehículos para uso personal, familiar, ejecutivo y de trabajo.',
      },
      {
        name: 'Alquiler de SUV',
        description:
          'SUV modernas para familias, grupos y viajes.',
      },
      {
        name: 'Alquiler de pickups',
        description:
          'Pickups para trabajo, carretera y movilidad profesional.',
      },
      {
        name: 'Servicio ejecutivo',
        description:
          'Movilidad para reuniones, compromisos y traslados especiales.',
      },
      {
        name: 'Experiencia marítima Marbella',
        description:
          'Experiencia privada en lancha para paseos y celebraciones.',
      },
    ],
    faqs: [
      {
        question:
          '¿Cómo puedo reservar un vehículo?',
        answer:
          'La reserva se solicita por WhatsApp indicando el modelo, la fecha y el tiempo estimado de uso.',
      },
      {
        question:
          '¿Qué tan seguros son los vehículos?',
        answer:
          'Las unidades son revisadas previamente para ofrecer una experiencia confiable.',
      },
      {
        question:
          '¿Cuánto tarda el proceso de reserva?',
        answer:
          'El proceso es ágil cuando se indica el vehículo, la fecha y el servicio requerido.',
      },
      {
        question:
          '¿Qué tipo de vehículos tienen disponibles?',
        answer:
          'Existen opciones compactas, SUV, pickups y vehículos para movilidad ejecutiva.',
      },
      {
        question:
          '¿Puedo solicitar entrega en un punto específico?',
        answer:
          'Se puede consultar entrega o coordinación en un punto específico según disponibilidad.',
      },
      {
        question:
          '¿Ofrecen servicio ejecutivo?',
        answer:
          'Sí. Hay opciones para compromisos profesionales y traslados especiales.',
      },
    ],
    areaServed: [
      'Santo Domingo',
      'República Dominicana',
    ],
    keywords: [
      'alquiler de vehículos',
      'rent a car Santo Domingo',
      'car rental República Dominicana',
      'SUV',
      'pickup',
      'servicio ejecutivo',
      'Rentao RD',
    ],
    lastUpdated: '2026-07-24',
  },

  jason: {
    slug: 'jason',
    title:
      'Comercial Jason S.R.L. | Gomas y aros en Santo Domingo',
    name: 'Comercial Jason S.R.L.',
    alternateName: [
      'Comercial Jason',
      'Jason Gomas y Aros',
    ],
    description:
      'Venta de gomas nuevas y usadas, aros, reparación y mantenimiento de aros en Santo Domingo. Más de 25 años de experiencia.',
    longDescription:
      'Comercial Jason S.R.L. ofrece gomas nuevas y usadas, aros, reparación y mantenimiento de aros, con asesoría para elegir según vehículo, medida, uso y presupuesto.',
    url: `${BASE_URL}/jason`,
    image:
      `${BASE_URL}/assets/landing/hero-jason-05.png?v=jason-og-v1`,
    imageType: 'image/png',
    imageWidth: 629,
    imageHeight: 354,
    siteName: 'Comercial Jason S.R.L.',
    schemaType: 'AutomotiveBusiness',
    telephones: [
      '+18096848842',
      '+18098340794',
    ],
    email: 'comercialjason@hotmail.com',
    address: {
      streetAddress: 'Calle María Montez 213',
      addressLocality: 'Santo Domingo',
      addressRegion: 'Distrito Nacional',
      postalCode: '10411',
      addressCountry: 'DO',
    },
    sameAs: [],
    services: [
      {
        name: 'Venta de gomas',
        description:
          'Gomas nuevas y usadas para diferentes tipos de vehículos.',
      },
      {
        name: 'Venta de aros',
        description:
          'Aros en diferentes estilos, tamaños y diseños.',
      },
      {
        name: 'Reparación de aros',
        description:
          'Diagnóstico, evaluación y reparación de aros.',
      },
      {
        name: 'Mantenimiento de aros',
        description:
          'Inspección y mantenimiento preventivo para aros.',
      },
    ],
    openingHours: [
      'Mo-Sa 07:00-18:30',
    ],
    areaServed: [
      'Santo Domingo',
      'República Dominicana',
    ],
    keywords: [
      'gomas nuevas',
      'gomas usadas',
      'aros',
      'reparación de aros',
      'mantenimiento de aros',
      'neumáticos Santo Domingo',
      'Comercial Jason',
    ],
    lastUpdated: '2026-07-24',
  },

  '1aeventos': {
    slug: '1aeventos',
    title: '1A Eventos | Gabriel Reyes Bello',
    name: '1A Eventos',
    alternateName: [
      '1A Eventos República Dominicana',
      'Gabriel Reyes Bello 1A Eventos',
    ],
    description:
      'Perfil digital de Gabriel Reyes Bello, asesor comercial de 1A Eventos. Mobiliario premium, cristalería, mantelería, lounge y accesorios para eventos.',
    longDescription:
      '1A Eventos ofrece alquiler de mobiliario, sillas, mesas, cristalería, vajillas, barras, lounge, mantelería y accesorios para bodas, celebraciones y eventos corporativos.',
    url: `${BASE_URL}/1aeventos`,
    image:
      `${BASE_URL}/assets/1A%20eventos/perfil/perfil-gabriel-01.jpg?v=1aeventos-og-gabriel-v1`,
    imageType: 'image/jpeg',
    imageWidth: 886,
    imageHeight: 1164,
    siteName: '1A Eventos',
    schemaType: 'ProfessionalService',
    telephones: [
      '+18295571090',
      '+18095345006',
      '+18295211470',
    ],
    email: 'ventas@1aeventos.com',
    address: {
      streetAddress:
        'Calle 2da #5, Sector La Ceiba',
      addressLocality: 'Santo Domingo',
      addressRegion: 'Distrito Nacional',
      addressCountry: 'DO',
    },
    sameAs: [
      'https://1aeventos.com/',
      'https://www.instagram.com/1aeventos/',
    ],
    services: [
      {
        name: 'Alquiler de sillas para eventos',
        description:
          'Sillas para ceremonias, recepciones, banquetes y eventos corporativos.',
      },
      {
        name: 'Alquiler de mesas',
        description:
          'Mesas para banquetes, estaciones, lounge y montajes especiales.',
      },
      {
        name: 'Cristalería y vajillas',
        description:
          'Copas, vasos, vajillas y piezas para montajes de mesa.',
      },
      {
        name: 'Bar y lounge',
        description:
          'Barras móviles, estaciones, muebles lounge y ottomans.',
      },
      {
        name: 'Mantelería y textiles',
        description:
          'Manteles, caminos y textiles para decoración de mesas.',
      },
      {
        name: 'Accesorios para eventos',
        description:
          'Cubertería, bandejas, platos y accesorios para montaje.',
      },
    ],
    areaServed: [
      'Santo Domingo',
      'República Dominicana',
    ],
    keywords: [
      'alquiler para eventos',
      'mobiliario para bodas',
      'sillas para eventos',
      'mesas para eventos',
      'cristalería',
      'mantelería',
      'lounge',
      '1A Eventos',
    ],
    person: {
      name: 'Gabriel Reyes Bello',
      jobTitle: 'Director Comercial',
    },
    lastUpdated: '2026-07-24',
  },

  aycdom2: {
    slug: 'aycdom2',
    title:
      'Freddy Fulgencio | Gerente de operaciones de A&C Dominicana',
    name: 'A&C Dominicana, S.R.L.',
    alternateName: [
      'A&C Dominicana',
      'A y C Dominicana',
      'Freddy Fulgencio A&C Dominicana',
    ],
    description:
      'Integramos diseño técnico, mecanizado, soldadura, fabricación de equipos, automatización e instalación dentro de una misma solución.',
    longDescription:
      'A&C Dominicana integra diseño técnico, mecanizado, soldadura, fabricación de equipos, automatización e instalación dentro de una misma solución. Puede atender desde una pieza puntual hasta una línea de proceso completa.',
    url: `${BASE_URL}/aycdom2`,
    image:
      `${BASE_URL}/assets/aycdom/social/perfil-link-ayc-10.png?v=aycdom-og-v1`,
    imageType: 'image/png',
    imageWidth: 676,
    imageHeight: 675,
    siteName: 'A&C Dominicana, S.R.L.',
    schemaType: 'ProfessionalService',
    telephones: [
      '+18092939270',
      '+18094767325',
    ],
    email: 'freddy@aycdominicana.com',
    address: {
      streetAddress:
        'C/ Juan José Duarte #73, entre Mauricio Báez y Paraguay, Ensanche La Fe',
      addressLocality: 'Santo Domingo',
      addressRegion: 'Distrito Nacional',
      addressCountry: 'DO',
    },
    sameAs: [
      'https://www.instagram.com/aycdominicana/',
      'https://www.facebook.com/aycdominicana/',
    ],
    services: [
      {
        name: 'Metalmecánica y mecanizados',
        description:
          'Fabricación y reparación de piezas industriales mediante procesos convencionales y CNC.',
      },
      {
        name: 'Corte láser CNC',
        description:
          'Corte de precisión para planchas, tubos, piezas y componentes industriales.',
      },
      {
        name: 'Automatización industrial',
        description:
          'Integración de controles y equipos para mejorar productividad, seguridad y continuidad operativa.',
      },
      {
        name: 'Conveyors y transporte',
        description:
          'Sistemas de transporte adaptados al espacio, producto y flujo de cada industria.',
      },
      {
        name: 'Máquinas y equipos a medida',
        description:
          'Soluciones especiales para procesos que requieren equipos personalizados.',
      },
      {
        name: 'Soldaduras especializadas',
        description:
          'Fabricación y reparación en materiales y aplicaciones de exigencia industrial.',
      },
    ],
    areaServed: [
      'Santo Domingo',
      'República Dominicana',
    ],
    keywords: [
      'A&C Dominicana',
      'Freddy Fulgencio',
      'Gerente de operaciones',
      'metalmecánica',
      'mecanizados CNC',
      'corte láser CNC',
      'automatización industrial',
      'conveyors',
      'equipos industriales',
      'soldadura especializada',
      'soluciones industriales',
    ],
    person: {
      name: 'Freddy Fulgencio',
      jobTitle: 'Gerente de operaciones',
    },
    lastUpdated: '2026-08-06',
  },

  aycdom: {
    slug: 'aycdom',
    title:
      'Mario Medina | Sales Engineer de A&C Dominicana',
    name: 'A&C Dominicana, S.R.L.',
    alternateName: [
      'A&C Dominicana',
      'A y C Dominicana',
      'Mario Medina A&C Dominicana',
    ],
    description:
      'Integramos diseño técnico, mecanizado, soldadura, fabricación de equipos, automatización e instalación dentro de una misma solución.',
    longDescription:
      'Integramos diseño técnico, mecanizado, soldadura, fabricación de equipos, automatización e instalación dentro de una misma solución. Podemos atender desde una pieza puntual hasta una línea de proceso completa.',
    url: `${BASE_URL}/aycdom`,
    image:
      `${BASE_URL}/assets/aycdom/social/perfil-link-ayc-10.png?v=aycdom-og-v1`,
    imageType: 'image/png',
    imageWidth: 676,
    imageHeight: 675,
    siteName: 'A&C Dominicana, S.R.L.',
    schemaType: 'ProfessionalService',
    telephones: [
      '+18098163911',
      '+18094767325',
    ],
    email: 'mario.medina@aycdominicana.com',
    address: {
      streetAddress:
        'C/ Juan José Duarte #73, entre Mauricio Báez y Paraguay, Ensanche La Fe',
      addressLocality: 'Santo Domingo',
      addressRegion: 'Distrito Nacional',
      addressCountry: 'DO',
    },
    sameAs: [
      'https://www.instagram.com/aycdominicana/',
      'https://www.facebook.com/aycdominicana/',
    ],
    services: [
      {
        name: 'Metalmecánica y mecanizados',
        description:
          'Fabricación y reparación de piezas industriales mediante procesos convencionales y CNC.',
      },
      {
        name: 'Corte láser CNC',
        description:
          'Corte de precisión para planchas, tubos, piezas y componentes industriales.',
      },
      {
        name: 'Automatización industrial',
        description:
          'Integración de controles y equipos para mejorar productividad, seguridad y continuidad operativa.',
      },
      {
        name: 'Conveyors y transporte',
        description:
          'Sistemas de transporte adaptados al espacio, producto y flujo de cada industria.',
      },
      {
        name: 'Máquinas y equipos a medida',
        description:
          'Soluciones especiales para procesos que requieren equipos personalizados.',
      },
      {
        name: 'Soldaduras especializadas',
        description:
          'Fabricación y reparación en materiales y aplicaciones de exigencia industrial.',
      },
    ],
    areaServed: [
      'Santo Domingo',
      'República Dominicana',
    ],
    keywords: [
      'A&C Dominicana',
      'Mario Medina',
      'Sales Engineer',
      'metalmecánica',
      'mecanizados CNC',
      'corte láser CNC',
      'automatización industrial',
      'conveyors',
      'equipos industriales',
      'soldadura especializada',
      'soluciones industriales',
    ],
    person: {
      name: 'Mario Medina',
      jobTitle: 'Sales Engineer',
    },
    lastUpdated: '2026-08-06',
  },

  biopestsgrd: {
    slug: 'biopestsgrd',
    title:
      'Rene Prieto | CEO de BioPests',
    name: 'BioPests',
    alternateName: [
      'BioPests RD',
      'BioPests Manejo Integral de Plagas',
      'Rene Prieto BioPests',
    ],
    description:
      'Rene Prieto, CEO de BioPests. Soluciones empresariales para prevenir, controlar y monitorear plagas mediante evaluación técnica, prevención y tecnología.',
    longDescription:
      'Rene Prieto representa a BioPests, empresa especializada en proteger instalaciones, procesos y operaciones mediante evaluación técnica, prevención continua y tecnología aplicada al manejo integral de plagas.',
    url: `${BASE_URL}/biopestsgrd`,
    image:
      `${BASE_URL}/assets/biopestrd/values/innovacion.png?v=biopests-shared-og-v1`,
    imageType: 'image/png',
    imageWidth: 628,
    imageHeight: 628,
    siteName: 'BioPests',
    schemaType: 'ProfessionalService',
    telephones: [
      '+18292469777',
    ],
    email: 'grupomatyse@gmail.com',
    address: {
      streetAddress:
        'Av. Gustavo Mejía Ricart #226, Piso 4, Oficina 405',
      addressLocality: 'Santo Domingo',
      addressRegion: 'Distrito Nacional',
      addressCountry: 'DO',
    },
    sameAs: [
      'https://www.instagram.com/biopestsrd/',
    ],
    services: [
      {
        name: 'Desinsectación de precisión',
        description:
          'Control dirigido de insectos en entornos empresariales.',
      },
      {
        name: 'Control de aves',
        description:
          'Medidas profesionales de exclusión y reducción de riesgos sanitarios.',
      },
      {
        name: 'Desinfección profesional',
        description:
          'Protocolos para reforzar la higiene de espacios, equipos y superficies.',
      },
      {
        name: 'Inocuidad en el transporte',
        description:
          'Protección sanitaria para vehículos, flotillas y operaciones logísticas.',
      },
      {
        name: 'Desratización inteligente',
        description:
          'Monitoreo, trazabilidad y control preventivo de roedores.',
      },
    ],
    areaServed: [
      'Santo Domingo',
      'República Dominicana',
    ],
    keywords: [
      'control de plagas',
      'desinsectación',
      'desratización',
      'control de aves',
      'desinfección',
      'inocuidad',
      'BioPests',
      'manejo integral de plagas',
      'Rene Prieto',
    ],
    person: {
      name: 'Rene Prieto',
      jobTitle: 'CEO',
    },
    lastUpdated: '2026-08-04',
  },

  biopestsvrd: {
    slug: 'biopestsvrd',
    title:
      'Yudeimy Timaure | Gerente de Operaciones de BioPests',
    name: 'BioPests',
    alternateName: [
      'BioPests RD',
      'BioPests Manejo Integral de Plagas',
      'Yudeimy Timaure BioPests',
    ],
    description:
      'Yudeimy Timaure, Gerente de Operaciones de BioPests. Soluciones empresariales para prevenir, controlar y monitorear plagas mediante evaluación técnica, prevención y tecnología.',
    longDescription:
      'Yudeimy Timaure representa las operaciones de BioPests, empresa especializada en proteger instalaciones, procesos y operaciones mediante evaluación técnica, prevención continua y tecnología aplicada al manejo integral de plagas.',
    url: `${BASE_URL}/biopestsvrd`,
    image:
      `${BASE_URL}/assets/biopestrd/values/innovacion.png?v=biopests-shared-og-v1`,
    imageType: 'image/png',
    imageWidth: 628,
    imageHeight: 628,
    siteName: 'BioPests',
    schemaType: 'ProfessionalService',
    telephones: [
      '+18297500908',
    ],
    email: 'grupomatyse@gmail.com',
    address: {
      streetAddress:
        'Av. Gustavo Mejía Ricart #226, Piso 4, Oficina 405',
      addressLocality: 'Santo Domingo',
      addressRegion: 'Distrito Nacional',
      addressCountry: 'DO',
    },
    sameAs: [
      'https://www.instagram.com/biopestsrd/',
    ],
    services: [
      {
        name: 'Desinsectación de precisión',
        description:
          'Control dirigido de insectos en entornos empresariales.',
      },
      {
        name: 'Control de aves',
        description:
          'Medidas profesionales de exclusión y reducción de riesgos sanitarios.',
      },
      {
        name: 'Desinfección profesional',
        description:
          'Protocolos para reforzar la higiene de espacios, equipos y superficies.',
      },
      {
        name: 'Inocuidad en el transporte',
        description:
          'Protección sanitaria para vehículos, flotillas y operaciones logísticas.',
      },
      {
        name: 'Desratización inteligente',
        description:
          'Monitoreo, trazabilidad y control preventivo de roedores.',
      },
    ],
    areaServed: [
      'Santo Domingo',
      'República Dominicana',
    ],
    keywords: [
      'control de plagas',
      'desinsectación',
      'desratización',
      'control de aves',
      'desinfección',
      'inocuidad',
      'BioPests',
      'manejo integral de plagas',
      'Yudeimy Timaure',
    ],
    person: {
      name: 'Yudeimy Timaure',
      jobTitle: 'Gerente de Operaciones',
    },
    lastUpdated: '2026-08-04',
  },
};

const AYC_EN_SERVICES: ProfileService[] = [
  {
    name: 'Metalworking and CNC machining',
    description:
      'Precision manufacturing and machining of industrial parts for technical and production applications.',
  },
  {
    name: 'Industrial equipment design and manufacturing',
    description:
      'Development and construction of industrial solutions adapted to each customer’s process.',
  },
  {
    name: 'Automation and instrumentation',
    description:
      'Integration of control, monitoring, and instrumentation systems to optimize industrial processes.',
  },
  {
    name: 'Cutting, forming, and welding',
    description:
      'Material transformation and metal fabrication for industrial structures, parts, and assemblies.',
  },
  {
    name: 'Industrial maintenance and repair',
    description:
      'Technical support services to restore, maintain, and improve equipment performance.',
  },
  {
    name: 'Dust and gas control',
    description:
      'Environmental control and particle-management solutions for industrial and construction operations.',
  },
  {
    name: 'Custom parts, equipment, and components',
    description:
      'Supply and manufacturing of commercial or custom-made industrial components.',
  },
];

const AYC_EN_FAQS: ProfileFaq[] = [
  {
    question: 'Do you provide custom industrial work?',
    answer:
      'Yes. Each project is evaluated according to the requirement, material, process, and operating conditions.',
  },
  {
    question: 'Can you manufacture a part from an existing sample?',
    answer:
      'It depends on the condition of the sample, required tolerances, and material. Our technical team must evaluate it before confirming production.',
  },
  {
    question: 'Do you only work on large projects?',
    answer:
      'No. A&C can handle anything from a single part or specific repair to a complete machine or production line.',
  },
  {
    question: 'Do you provide installation and commissioning?',
    answer:
      'Yes, when required by the project scope. Installation and commissioning are defined as part of the technical proposal.',
  },
];

function runtimeAssetUrl(
  value: string,
  runtime: DiscoveryRuntime,
): string {
  return value.startsWith(`${BASE_URL}/`)
    ? `${runtime.baseUrl}${value.slice(BASE_URL.length)}`
    : value;
}

export function getStaticProfileDiscovery(
  slug: string,
  runtime: DiscoveryRuntime = DEFAULT_RUNTIME,
): ProfileDiscovery | null {
  const source = STATIC_PROFILE_DISCOVERY[slug];
  if (!source) return null;

  const localized = slug === 'aycdom' && runtime.language === 'en'
    ? {
        ...source,
        title: 'Mario Medina | Sales Engineer at A&C Dominicana',
        description:
          'Technical design, machining, welding, equipment manufacturing, automation, and installation integrated into industrial solutions.',
        longDescription:
          'With more than 30 years of experience in the industrial market, A&C Dominicana develops solutions for automation, process improvement, equipment and parts supply, and industrial projects. We integrate technical design, machining, welding, equipment manufacturing, automation, and installation into comprehensive solutions.',
        services: AYC_EN_SERVICES,
        faqs: AYC_EN_FAQS,
        keywords: [
          'A&C Dominicana',
          'Mario Medina',
          'Sales Engineer',
          'CNC machining',
          'industrial automation',
          'industrial equipment',
          'specialized welding',
          'industrial solutions',
        ],
      }
    : source;

  const language = localized === source
    ? 'es-DO'
    : 'en-US';

  return {
    ...localized,
    url: publicProfileUrl(slug, runtime),
    image: runtimeAssetUrl(localized.image, runtime),
    language,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function jsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function buildJsonLd(
  profile: ProfileDiscovery,
  runtime: DiscoveryRuntime = DEFAULT_RUNTIME,
): Record<string, unknown> {
  const websiteId = `${runtime.baseUrl}/#website`;
  const webpageId = `${profile.url}#webpage`;
  const entityId = `${profile.url}#entity`;
  const imageId = `${profile.url}#primaryimage`;

  const entity: Record<string, unknown> = {
    '@type': profile.schemaType,
    '@id': entityId,
    name: profile.name,
    alternateName: profile.alternateName,
    description: profile.longDescription,
    url: profile.url,
    image: {
      '@id': imageId,
    },
    telephone:
      profile.telephones.length === 1
        ? profile.telephones[0]
        : profile.telephones,
    email: profile.email,
    address: profile.address
      ? {
          '@type': 'PostalAddress',
          ...profile.address,
        }
      : undefined,
    sameAs:
      profile.sameAs.length > 0
        ? profile.sameAs
        : undefined,
    areaServed: profile.areaServed?.map((name) => ({
      '@type': 'AdministrativeArea',
      name,
    })),
    openingHours: profile.openingHours,
    employee: profile.person
      ? {
          '@type': 'Person',
          name: profile.person.name,
          jobTitle: profile.person.jobTitle,
        }
      : undefined,
    contactPoint: profile.telephones.map(
      (telephone, index) => ({
        '@type': 'ContactPoint',
        telephone,
        contactType:
          index === 0
            ? 'customer service'
            : 'sales',
        areaServed: 'DO',
        availableLanguage: [
          profile.language === 'en-US' ? 'en' : 'es',
        ],
      })
    ),
    makesOffer: profile.services.map((service) => ({
      '@type': 'Offer',
      itemOffered: {
        '@type': 'Service',
        name: service.name,
        description: service.description,
      },
    })),
  };

  const graph: Record<string, unknown>[] = [
    {
      '@type': 'WebSite',
      '@id': websiteId,
      url: `${runtime.baseUrl}/`,
      name: 'INTAP LINK',
      inLanguage: profile.language || 'es-DO',
    },
    {
      '@type': 'ImageObject',
      '@id': imageId,
      url: profile.image,
      contentUrl: profile.image,
      width: profile.imageWidth,
      height: profile.imageHeight,
      caption: profile.title,
    },
    {
      '@type': 'WebPage',
      '@id': webpageId,
      url: profile.url,
      name: profile.title,
      description: profile.description,
      inLanguage: profile.language || 'es-DO',
      isPartOf: {
        '@id': websiteId,
      },
      primaryImageOfPage: {
        '@id': imageId,
      },
      mainEntity: {
        '@id': entityId,
      },
      dateModified: profile.lastUpdated,
    },
    entity,
  ];

  if (profile.faqs?.length) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${profile.url}#faq`,
      url: `${profile.url}#faq`,
      inLanguage: profile.language || 'es-DO',
      mainEntity: profile.faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    });
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  };
}

export function buildProfileSeoHead(
  profile: ProfileDiscovery,
  runtime: DiscoveryRuntime = DEFAULT_RUNTIME,
): string {
  const keywords = escapeHtml(
    profile.keywords.join(', ')
  );

  const locality = profile.address
    ? escapeHtml(profile.address.addressLocality)
    : 'República Dominicana';

  const indexDirective = runtime.isPreview
    ? 'noindex,nofollow,noarchive'
    : 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1';
  const aiUrl = profileResourceUrl(profile.url, 'ai.md');
  const factsUrl = profileResourceUrl(profile.url, 'facts.json');
  // SEO bilingüe se activará en una fase posterior.
  const hreflang = '';

  return `
  <!-- INTAP LINK: SEO + GEO + AI DISCOVERY -->
  <meta name="robots" content="${indexDirective}" />
  <meta name="googlebot" content="${indexDirective}" />
  <meta name="bingbot" content="${indexDirective}" />
  <meta name="keywords" content="${keywords}" />
  <meta name="geo.region" content="DO" />
  <meta name="geo.placename" content="${locality}" />
  <link rel="alternate" type="text/markdown" title="${escapeHtml(profile.name)} para agentes IA" href="${escapeHtml(aiUrl)}" />
  <link rel="alternate" type="application/json" title="${escapeHtml(profile.name)} datos verificables" href="${escapeHtml(factsUrl)}" />${hreflang}
  <script type="application/ld+json">${jsonForScript(buildJsonLd(profile, runtime))}</script>
`;
}

export function buildDynamicProfileSeoHead(input: {
  name: string;
  description: string;
  url: string;
  image: string;
  entityType?: 'Person' | 'Organization';
  jobTitle?: string;
  telephones?: string[];
  email?: string;
  address?: string;
  sameAs?: string[];
}, runtime: DiscoveryRuntime = DEFAULT_RUNTIME): string {
  const entity: Record<string, unknown> = {
    '@type':
      input.entityType ||
      'Organization',
    '@id': `${input.url}#entity`,
    name: input.name,
    description:
      input.description,
    url: input.url,
    image: input.image,
  }

  if (input.jobTitle) {
    entity.jobTitle =
      input.jobTitle
  }

  if (input.telephones?.length) {
    entity.telephone =
      input.telephones
  }

  if (input.email) {
    entity.email =
      input.email
  }

  if (input.address) {
    entity.address = {
      '@type':
        'PostalAddress',
      streetAddress:
        input.address,
      addressCountry:
        'DO',
    }
  }

  if (input.sameAs?.length) {
    entity.sameAs =
      input.sameAs
  }

  const jsonLd = {
    '@context':
      'https://schema.org',
    '@graph': [
      {
        '@type':
          'WebPage',
        '@id':
          `${input.url}#webpage`,
        url:
          input.url,
        name:
          input.name,
        description:
          input.description,
        inLanguage:
          runtime.language === 'en' ? 'en-US' : 'es-DO',
        mainEntity: {
          '@id':
            `${input.url}#entity`,
        },
      },
      entity,
    ],
  }

  const geoPlacename =
    input.address
      ? `
  <meta name="geo.placename" content="${escapeHtml(input.address)}" />`
      : ''

  const indexDirective = runtime.isPreview
    ? 'noindex,nofollow,noarchive'
    : 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1';
  const aiUrl = profileResourceUrl(input.url, 'ai.md');
  const factsUrl = profileResourceUrl(input.url, 'facts.json');

  return `
  <!-- INTAP LINK: DYNAMIC SEO + GEO + AI DISCOVERY -->
  <meta name="robots" content="${indexDirective}" />
  <meta name="googlebot" content="${indexDirective}" />
  <meta name="bingbot" content="${indexDirective}" />
  <meta name="geo.region" content="DO" />${geoPlacename}
  <link rel="alternate" type="text/markdown" title="${escapeHtml(input.name)} para agentes IA" href="${escapeHtml(aiUrl)}" />
  <link rel="alternate" type="application/json" title="${escapeHtml(input.name)} datos verificables" href="${escapeHtml(factsUrl)}" />
  <script type="application/ld+json">${jsonForScript(jsonLd)}</script>
`
}

export function buildProfileSemanticFallback(
  profile: ProfileDiscovery
): string {
  const services = profile.services
    .map(
      (service) =>
        `<li><strong>${escapeHtml(service.name)}</strong>: ${escapeHtml(service.description)}</li>`
    )
    .join('');

  const phones = profile.telephones
    .map(
      (telephone) =>
        `<li><a href="tel:${escapeHtml(telephone)}">${escapeHtml(telephone)}</a></li>`
    )
    .join('');

  const officialLinks = profile.sameAs
    .map(
      (link) =>
        `<li><a href="${escapeHtml(link)}">${escapeHtml(link)}</a></li>`
    )
    .join('');

  const address = profile.address
    ? [
        profile.address.streetAddress,
        profile.address.addressLocality,
        profile.address.addressRegion,
        profile.address.postalCode,
        profile.address.addressCountry,
      ]
        .filter(Boolean)
        .join(', ')
    : '';

  const english = profile.language === 'en-US';
  const language = english ? 'en-US' : 'es-DO';
  const servicesTitle = english ? 'Services' : 'Servicios';
  const contactTitle = english ? 'Contact' : 'Contacto';
  const officialLinksTitle = english ? 'Official links' : 'Enlaces oficiales';
  const profileLink = english
    ? 'View interactive digital profile'
    : 'Ver perfil digital interactivo';

  return `
  <noscript>
    <main id="intap-semantic-profile" lang="${language}">
      <article>
        <header>
          <h1>${escapeHtml(profile.name)}</h1>
          <p>${escapeHtml(profile.longDescription)}</p>
        </header>

        <section>
          <h2>${servicesTitle}</h2>
          <ul>${services}</ul>
        </section>

        <section>
          <h2>${contactTitle}</h2>
          <ul>${phones}</ul>
          ${
            profile.email
              ? `<p>Correo: <a href="mailto:${escapeHtml(profile.email)}">${escapeHtml(profile.email)}</a></p>`
              : ''
          }
          ${
            address
              ? `<address>${escapeHtml(address)}</address>`
              : ''
          }
        </section>

        ${
            officialLinks
              ? `<section><h2>${officialLinksTitle}</h2><ul>${officialLinks}</ul></section>`
            : ''
        }

        <p>
          <a href="${profile.url}">
            ${profileLink}
          </a>
        </p>
      </article>
    </main>
  </noscript>
`;
}

export function buildDynamicProfileSemanticFallback(
  input: {
    name: string;
    description: string;
    url: string;
    telephones?: string[];
    email?: string;
    address?: string;
    sameAs?: string[];
  },
  runtime: DiscoveryRuntime = DEFAULT_RUNTIME,
): string {
  const phones = (
    input.telephones || []
  )
    .map(
      (telephone) =>
        `<li><a href="tel:${escapeHtml(telephone)}">${escapeHtml(telephone)}</a></li>`
    )
    .join('')

  const links = (
    input.sameAs || []
  )
    .map(
      (url) =>
        `<li><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></li>`
    )
    .join('')

  const english = runtime.language === 'en';
  const language = english ? 'en-US' : 'es-DO';

  return `
  <noscript>
    <main id="intap-semantic-profile" lang="${language}">
      <article>
        <h1>${escapeHtml(input.name)}</h1>
        <p>${escapeHtml(input.description)}</p>

        ${
          phones ||
          input.email ||
          input.address
            ? `<section>
          <h2>${english ? 'Contact' : 'Contacto'}</h2>
          ${phones ? `<ul>${phones}</ul>` : ''}
          ${
            input.email
              ? `<p>Correo: <a href="mailto:${escapeHtml(input.email)}">${escapeHtml(input.email)}</a></p>`
              : ''
          }
          ${
            input.address
              ? `<address>${escapeHtml(input.address)}</address>`
              : ''
          }
        </section>`
            : ''
        }

        ${
            links
              ? `<section><h2>${english ? 'Official links' : 'Enlaces oficiales'}</h2><ul>${links}</ul></section>`
            : ''
        }

        <p>
          <a href="${escapeHtml(input.url)}">
            ${english ? 'View digital profile' : 'Ver perfil digital'}
          </a>
        </p>
      </article>
    </main>
  </noscript>
`
}

function buildAiMarkdown(
  profile: ProfileDiscovery
): string {
  const services = profile.services
    .map(
      (service) =>
        `- **${service.name}:** ${service.description}`
    )
    .join('\n');

  const phones = profile.telephones
    .map((telephone) => `- Teléfono: ${telephone}`)
    .join('\n');

  const links = profile.sameAs
    .map((link) => `- ${link}`)
    .join('\n');

  const address = profile.address
    ? [
        profile.address.streetAddress,
        profile.address.addressLocality,
        profile.address.addressRegion,
        profile.address.postalCode,
        profile.address.addressCountry,
      ]
        .filter(Boolean)
        .join(', ')
    : 'No especificada';

  const faqs = profile.faqs?.length
    ? [
        '',
        '## Preguntas frecuentes',
        '',
        ...profile.faqs.flatMap((faq) => [
          `### ${faq.question}`,
          faq.answer,
          '',
        ]),
      ].join('\n')
    : '';

  return `# ${profile.name}

> ${profile.description}

- URL canónica: ${profile.url}
- Tipo de entidad: ${profile.schemaType}
- Idioma: ${profile.language || 'es-DO'}
- Última actualización: ${profile.lastUpdated}

## Descripción

${profile.longDescription}

## Servicios

${services}

## Contacto

${phones}
${profile.email ? `- Correo: ${profile.email}` : ''}
- Dirección: ${address}

## Enlaces oficiales

${links || `- ${profile.url}`}

## Datos estructurados

- JSON verificable: ${profileResourceUrl(profile.url, 'facts.json')}
- Página oficial: ${profile.url}
${faqs}
`;
}

function buildFactsJson(
  profile: ProfileDiscovery
): string {
  return JSON.stringify(
    {
      schemaVersion: '1.0',
      language: profile.language || 'es-DO',
      canonicalUrl: profile.url,
      lastUpdated: profile.lastUpdated,
      entity: {
        type: profile.schemaType,
        name: profile.name,
        alternateName: profile.alternateName || [],
        description: profile.longDescription,
      },
      contact: {
        telephones: profile.telephones,
        email: profile.email || null,
        address: profile.address || null,
      },
      services: profile.services,
      frequentlyAskedQuestions:
        profile.faqs || [],
      officialLinks: [
        profile.url,
        ...profile.sameAs,
      ],
      image: {
        url: profile.image,
        type: profile.imageType,
        width: profile.imageWidth,
        height: profile.imageHeight,
      },
    },
    null,
    2
  );
}

function buildRobotsTxt(
  runtime: DiscoveryRuntime = DEFAULT_RUNTIME,
): string {
  if (runtime.isPreview) {
    return `# INTAP LINK Preview — no indexar

User-agent: *
Disallow: /
`;
  }

  return `# INTAP LINK — rastreo para buscadores y asistentes IA

User-agent: OAI-SearchBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: Claude-SearchBot
Allow: /

User-agent: Claude-User
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Perplexity-User
Allow: /

User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

# Bots destinados principalmente a entrenamiento masivo

User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: Bytespider
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: *
Allow: /
Disallow: /admin
Disallow: /auth

Sitemap: ${runtime.baseUrl}/sitemap.xml
`;
}

function buildSitemapXml(
  dynamicProfiles: DynamicDiscoveryProfile[],
  runtime: DiscoveryRuntime = DEFAULT_RUNTIME,
): string {
  const entries = new Map<
    string,
    {
      slug: string;
      url: string;
      lastUpdated: string;
    }
  >();

  for (const slug of Object.keys(STATIC_PROFILE_DISCOVERY)) {
    const profile = getStaticProfileDiscovery(slug, runtime);
    if (!profile) continue;
    entries.set(profile.slug, {
      slug: profile.slug,
      url: profile.url,
      lastUpdated: profile.lastUpdated,
    });
  }

  for (const profile of dynamicProfiles) {
    if (entries.has(profile.slug)) continue;

    entries.set(profile.slug, {
      slug: profile.slug,
      url: publicProfileUrl(profile.slug, runtime),
      lastUpdated:
        profile.updatedAt
          ? discoveryDate(profile.updatedAt)
          : '',
    });
  }

  const urls = Array.from(entries.values())
    .sort((a, b) =>
      a.slug.localeCompare(b.slug)
    )
    .map((profile) => `  <url>
    <loc>${escapeHtml(profile.url)}</loc>${
      profile.lastUpdated
        ? `
    <lastmod>${escapeHtml(profile.lastUpdated)}</lastmod>`
        : ''
    }
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

function buildLlmsTxt(
  dynamicProfiles: DynamicDiscoveryProfile[],
  runtime: DiscoveryRuntime = DEFAULT_RUNTIME,
): string {
  const entries = new Map<
    string,
    {
      slug: string;
      name: string;
      description: string;
      url: string;
    }
  >();

  for (const slug of Object.keys(STATIC_PROFILE_DISCOVERY)) {
    const profile = getStaticProfileDiscovery(slug, runtime);
    if (!profile) continue;
    entries.set(profile.slug, {
      slug: profile.slug,
      name: profile.name,
      description: profile.description,
      url: profile.url,
    });
  }

  for (const profile of dynamicProfiles) {
    if (entries.has(profile.slug)) continue;

    entries.set(profile.slug, {
      slug: profile.slug,
      name: profile.name,
      description: profile.bio,
      url: publicProfileUrl(profile.slug, runtime),
    });
  }

  const profiles = Array.from(entries.values())
    .sort((a, b) =>
      a.name.localeCompare(b.name)
    )
    .map((profile) => {
      const name = markdownEscape(
        compactText(profile.name, profile.slug)
      );

      const description = markdownEscape(
        compactText(
          profile.description,
          `Perfil de ${profile.name} en INTAP LINK`
        )
      );

      return `- [${name}](${profile.url}): ${description}
  - [Resumen para agentes](${profileResourceUrl(profile.url, 'ai.md')})
  - [Datos verificables](${profileResourceUrl(profile.url, 'facts.json')})`;
    })
    .join('\n');

  return `# INTAP LINK

> Directorio de perfiles digitales profesionales y empresariales de República Dominicana.

## Perfiles públicos

${profiles}

## Formatos disponibles

Cada perfil incluye:

- Página HTML canónica.
- Datos estructurados Schema.org mediante JSON-LD.
- Resumen Markdown para agentes IA.
- Archivo JSON con hechos verificables.
- Open Graph y Twitter Card.
- Información pública de contacto, servicios y enlaces oficiales.

## Contacto del sitio

- Sitio principal: ${runtime.baseUrl}
- Sitemap: ${runtime.baseUrl}/sitemap.xml
`;
}

function machineResponse(
  body: string,
  contentType: string,
  canonical?: string,
  status = 200,
  runtime: DiscoveryRuntime = DEFAULT_RUNTIME,
): Response {
  const headers = new Headers({
    'content-type': `${contentType}; charset=UTF-8`,
    'content-language': runtime.language === 'en' ? 'en-US' : 'es-DO',
    'cache-control': runtime.isPreview
      ? 'no-store'
      : 'public, max-age=300, s-maxage=300, stale-while-revalidate=86400',
    'access-control-allow-origin': '*',
  });

  if (runtime.isPreview) {
    headers.set('x-robots-tag', 'noindex, nofollow, noarchive');
  }

  if (canonical) {
    headers.set(
      'link',
      `<${canonical}>; rel="canonical"`
    );
  }

  return new Response(body, {
    status,
    headers,
  });
}

export async function handleDiscoveryRequest(
  input: URL | string,
  suppliedRuntime?: DiscoveryRuntime,
): Promise<Response | null> {
  const url = input instanceof URL
    ? input
    : new URL(input, BASE_URL);
  const runtime = suppliedRuntime || createDiscoveryRuntime(url);
  const normalized =
    url.pathname.replace(/\/+$/, '') || '/';

  if (normalized === '/robots.txt') {
    return machineResponse(
      buildRobotsTxt(runtime),
      'text/plain',
      undefined,
      200,
      runtime
    );
  }

  if (normalized === '/sitemap.xml') {
    const dynamicProfiles =
      await fetchDynamicDiscoveryProfiles(runtime);

    return machineResponse(
      buildSitemapXml(dynamicProfiles, runtime),
      'application/xml',
      undefined,
      200,
      runtime
    );
  }

  if (normalized === '/llms.txt') {
    const dynamicProfiles =
      await fetchDynamicDiscoveryProfiles(runtime);

    return machineResponse(
      buildLlmsTxt(dynamicProfiles, runtime),
      'text/plain',
      undefined,
      200,
      runtime
    );
  }

  const match = normalized.match(
    /^\/([^/]+)\/(ai\.md|facts\.json)$/
  );

  if (!match) return null;

  let slug = '';

  try {
    slug = decodeURIComponent(
      match[1]
    ).toLowerCase();
  } catch {
    return machineResponse(
      'Not Found\n',
      'text/plain',
      undefined,
      404,
      runtime
    );
  }

  const staticProfile =
    getStaticProfileDiscovery(slug, runtime);

  if (staticProfile) {
    if (match[2] === 'ai.md') {
      return machineResponse(
        buildAiMarkdown(staticProfile),
        'text/markdown',
        staticProfile.url,
        200,
        runtime
      );
    }

    return machineResponse(
      buildFactsJson(staticProfile),
      'application/json',
      staticProfile.url,
      200,
      runtime
    );
  }

  const dynamicProfile =
    await fetchDynamicPublicProfile(slug, runtime);

  if (!dynamicProfile) {
    return machineResponse(
      'Not Found\n',
      'text/plain',
      undefined,
      404,
      runtime
    );
  }

  const canonicalSlug = compactText(
    dynamicProfile.slug,
    slug
  ).toLowerCase();

  const canonical =
    publicProfileUrl(canonicalSlug, runtime);

  if (match[2] === 'ai.md') {
      return machineResponse(
        buildDynamicAiMarkdown(
          dynamicProfile,
          canonicalSlug,
          runtime,
        ),
      'text/markdown',
      canonical,
      200,
      runtime
    );
  }

  return machineResponse(
    buildDynamicFactsJson(
      dynamicProfile,
      canonicalSlug,
      runtime,
    ),
    'application/json',
    canonical,
    200,
    runtime
  );
}
