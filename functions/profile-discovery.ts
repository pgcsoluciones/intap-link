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
};

const BASE_URL = 'https://intaprd.com';

const PUBLIC_API_BASE =
  `${BASE_URL}/api/v1/public`;

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

function publicProfileUrl(slug: string): string {
  return `${BASE_URL}/${encodeURIComponent(slug)}`;
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

async function fetchDynamicDiscoveryProfiles():
Promise<DynamicDiscoveryProfile[]> {
  try {
    const response = await fetch(
      `${PUBLIC_API_BASE}/discovery/profiles`,
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
  slug: string
): Promise<DynamicPublicProfile | null> {
  try {
    const response = await fetch(
      `${PUBLIC_API_BASE}/profiles/${encodeURIComponent(slug)}`,
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

function buildDynamicAiMarkdown(
  profile: DynamicPublicProfile,
  requestedSlug: string
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

  const canonical = publicProfileUrl(slug);

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
- Tipo de entidad: Organization
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

- JSON verificable: ${canonical}/facts.json
- Página oficial: ${canonical}
${faqMarkdown}
`;
}

function buildDynamicFactsJson(
  profile: DynamicPublicProfile,
  requestedSlug: string
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

  const canonical = publicProfileUrl(slug);

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
        type: 'Organization',
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

export function getStaticProfileDiscovery(
  slug: string
): ProfileDiscovery | null {
  return STATIC_PROFILE_DISCOVERY[slug] || null;
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
  profile: ProfileDiscovery
): Record<string, unknown> {
  const websiteId = `${BASE_URL}/#website`;
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
        availableLanguage: ['es'],
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
      url: `${BASE_URL}/`,
      name: 'INTAP LINK',
      inLanguage: 'es-DO',
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
      inLanguage: 'es-DO',
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
      inLanguage: 'es-DO',
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
  profile: ProfileDiscovery
): string {
  const keywords = escapeHtml(
    profile.keywords.join(', ')
  );

  const locality = profile.address
    ? escapeHtml(profile.address.addressLocality)
    : 'República Dominicana';

  return `
  <!-- INTAP LINK: SEO + GEO + AI DISCOVERY -->
  <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" />
  <meta name="googlebot" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" />
  <meta name="bingbot" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" />
  <meta name="keywords" content="${keywords}" />
  <meta name="geo.region" content="DO" />
  <meta name="geo.placename" content="${locality}" />
  <link rel="alternate" type="text/markdown" title="${escapeHtml(profile.name)} para agentes IA" href="${profile.url}/ai.md" />
  <link rel="alternate" type="application/json" title="${escapeHtml(profile.name)} datos verificables" href="${profile.url}/facts.json" />
  <script type="application/ld+json">${jsonForScript(buildJsonLd(profile))}</script>
`;
}

export function buildDynamicProfileSeoHead(input: {
  name: string;
  description: string;
  url: string;
  image: string;
}): string {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${input.url}#webpage`,
        url: input.url,
        name: input.name,
        description: input.description,
        inLanguage: 'es-DO',
        mainEntity: {
          '@id': `${input.url}#entity`,
        },
      },
      {
        '@type': 'Organization',
        '@id': `${input.url}#entity`,
        name: input.name,
        description: input.description,
        url: input.url,
        image: input.image,
      },
    ],
  };

  return `
  <!-- INTAP LINK: DYNAMIC SEO DISCOVERY -->
  <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" />
  <meta name="googlebot" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" />
  <meta name="bingbot" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" />
  <link rel="alternate" type="text/markdown" title="${escapeHtml(input.name)} para agentes IA" href="${escapeHtml(input.url)}/ai.md" />
  <link rel="alternate" type="application/json" title="${escapeHtml(input.name)} datos verificables" href="${escapeHtml(input.url)}/facts.json" />
  <script type="application/ld+json">${jsonForScript(jsonLd)}</script>
`;
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

  return `
  <noscript>
    <main id="intap-semantic-profile" lang="es-DO">
      <article>
        <header>
          <h1>${escapeHtml(profile.name)}</h1>
          <p>${escapeHtml(profile.longDescription)}</p>
        </header>

        <section>
          <h2>Servicios</h2>
          <ul>${services}</ul>
        </section>

        <section>
          <h2>Contacto</h2>
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
            ? `<section><h2>Enlaces oficiales</h2><ul>${officialLinks}</ul></section>`
            : ''
        }

        <p>
          <a href="${profile.url}">
            Ver perfil digital interactivo
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
  }
): string {
  return `
  <noscript>
    <main id="intap-semantic-profile" lang="es-DO">
      <article>
        <h1>${escapeHtml(input.name)}</h1>
        <p>${escapeHtml(input.description)}</p>
        <p>
          <a href="${escapeHtml(input.url)}">
            Ver perfil digital
          </a>
        </p>
      </article>
    </main>
  </noscript>
`;
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
- Idioma: es-DO
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

- JSON verificable: ${profile.url}/facts.json
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
      language: 'es-DO',
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

function buildRobotsTxt(): string {
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

Sitemap: ${BASE_URL}/sitemap.xml
`;
}

function buildSitemapXml(
  dynamicProfiles: DynamicDiscoveryProfile[]
): string {
  const entries = new Map<
    string,
    {
      slug: string;
      url: string;
      lastUpdated: string;
    }
  >();

  for (
    const profile of Object.values(
      STATIC_PROFILE_DISCOVERY
    )
  ) {
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
      url: publicProfileUrl(profile.slug),
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
  dynamicProfiles: DynamicDiscoveryProfile[]
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

  for (
    const profile of Object.values(
      STATIC_PROFILE_DISCOVERY
    )
  ) {
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
      url: publicProfileUrl(profile.slug),
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
  - [Resumen para agentes](${profile.url}/ai.md)
  - [Datos verificables](${profile.url}/facts.json)`;
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

- Sitio principal: ${BASE_URL}
- Sitemap: ${BASE_URL}/sitemap.xml
`;
}

function machineResponse(
  body: string,
  contentType: string,
  canonical?: string,
  status = 200
): Response {
  const headers = new Headers({
    'content-type': `${contentType}; charset=UTF-8`,
    'content-language': 'es-DO',
    'cache-control':
      'public, max-age=300, s-maxage=300, stale-while-revalidate=86400',
    'access-control-allow-origin': '*',
  });

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
  pathname: string
): Promise<Response | null> {
  const normalized =
    pathname.replace(/\/+$/, '') || '/';

  if (normalized === '/robots.txt') {
    return machineResponse(
      buildRobotsTxt(),
      'text/plain'
    );
  }

  if (normalized === '/sitemap.xml') {
    const dynamicProfiles =
      await fetchDynamicDiscoveryProfiles();

    return machineResponse(
      buildSitemapXml(dynamicProfiles),
      'application/xml'
    );
  }

  if (normalized === '/llms.txt') {
    const dynamicProfiles =
      await fetchDynamicDiscoveryProfiles();

    return machineResponse(
      buildLlmsTxt(dynamicProfiles),
      'text/plain'
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
      404
    );
  }

  const staticProfile =
    getStaticProfileDiscovery(slug);

  if (staticProfile) {
    if (match[2] === 'ai.md') {
      return machineResponse(
        buildAiMarkdown(staticProfile),
        'text/markdown',
        staticProfile.url
      );
    }

    return machineResponse(
      buildFactsJson(staticProfile),
      'application/json',
      staticProfile.url
    );
  }

  const dynamicProfile =
    await fetchDynamicPublicProfile(slug);

  if (!dynamicProfile) {
    return machineResponse(
      'Not Found\n',
      'text/plain',
      undefined,
      404
    );
  }

  const canonicalSlug = compactText(
    dynamicProfile.slug,
    slug
  ).toLowerCase();

  const canonical =
    publicProfileUrl(canonicalSlug);

  if (match[2] === 'ai.md') {
    return machineResponse(
      buildDynamicAiMarkdown(
        dynamicProfile,
        canonicalSlug
      ),
      'text/markdown',
      canonical
    );
  }

  return machineResponse(
    buildDynamicFactsJson(
      dynamicProfile,
      canonicalSlug
    ),
    'application/json',
    canonical
  );
}
