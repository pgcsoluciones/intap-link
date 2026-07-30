import type {
  FreeProfileData,
  FreeProfileLayoutId,
  FreeProfileService,
  FreeProfileServiceIconKey,
} from './IntapLinkGratis.types'

export type FreeProfileAdapterResult = {
  profile: FreeProfileData
  layout: FreeProfileLayoutId
}

type UnknownRecord = Record<string, unknown>

const SERVICE_ICON_SEQUENCE:
  FreeProfileServiceIconKey[] = [
    'home',
    'key',
    'chart-line',
    'handshake',
  ]

function isRecord(
  value: unknown,
): value is UnknownRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

function asRecord(
  value: unknown,
): UnknownRecord {
  return isRecord(value) ? value : {}
}

function readObject(
  source: UnknownRecord,
  key: string,
): UnknownRecord {
  const value = source[key]

  if (isRecord(value)) {
    return value
  }

  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value)
      return asRecord(parsed)
    } catch {
      return {}
    }
  }

  return {}
}

function readString(
  source: UnknownRecord,
  ...keys: string[]
): string {
  for (const key of keys) {
    const value = source[key]

    if (
      typeof value === 'string' &&
      value.trim()
    ) {
      return value.trim()
    }
  }

  return ''
}

function readRecords(
  source: UnknownRecord,
  key: string,
): UnknownRecord[] {
  const value = source[key]

  if (!Array.isArray(value)) {
    return []
  }

  return value.filter(isRecord)
}

function unwrapProfilePayload(
  payload: unknown,
): UnknownRecord {
  const root = asRecord(payload)

  return isRecord(root.data)
    ? root.data
    : root
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function normalizePhone(value: string): string {
  const waMatch = value.match(
    /wa\.me\/(\d+)/i,
  )

  if (waMatch) {
    return waMatch[1]
  }

  return value.replace(/\D/g, '')
}

function findLinkUrl(
  links: UnknownRecord[],
  matcher: (
    label: string,
    url: string,
  ) => boolean,
): string {
  const match = links.find((link) => {
    const label = normalizeText(
      readString(link, 'label'),
    )

    const url = normalizeText(
      readString(link, 'url'),
    )

    return matcher(label, url)
  })

  return match
    ? readString(match, 'url')
    : ''
}

function findSocialUrl(
  socialLinks: UnknownRecord[],
  type: string,
): string {
  const normalizedType =
    normalizeText(type)

  const match = socialLinks.find((link) => {
    return (
      normalizeText(
        readString(link, 'type'),
      ) === normalizedType
    )
  })

  return match
    ? readString(match, 'url')
    : ''
}

function isMapLink(
  label: string,
  url: string,
): boolean {
  return (
    label.includes('mapa') ||
    label.includes('ubicacion') ||
    label.includes('direccion') ||
    label.includes('como llegar') ||
    url.includes('google.com/maps') ||
    url.includes('maps.app.goo.gl') ||
    url.includes('goo.gl/maps')
  )
}

function isWhatsAppLink(
  label: string,
  url: string,
): boolean {
  return (
    label.includes('whatsapp') ||
    url.includes('wa.me') ||
    url.includes('whatsapp')
  )
}

function isSystemLink(
  link: UnknownRecord,
): boolean {
  const label = normalizeText(
    readString(link, 'label'),
  )

  const url = normalizeText(
    readString(link, 'url'),
  )

  return (
    isWhatsAppLink(label, url) ||
    isMapLink(label, url) ||
    url.startsWith('tel:') ||
    url.startsWith('mailto:') ||
    url.includes('instagram.com')
  )
}

function resolvePortfolio(
  data: UnknownRecord,
): FreeProfileData['portfolio'] {
  const portfolio:
    FreeProfileData['portfolio'] = []

  readRecords(data, 'gallery').forEach(
    (item, index) => {
      const image = readString(
        item,
        'image_url',
        'imageUrl',
      )

      if (!image) {
        return
      }

      portfolio.push({
        id:
          readString(item, 'id', 'image_key') ||
          `portfolio-${index + 1}`,

        title:
          readString(item, 'title', 'label') ||
          `Portafolio ${index + 1}`,

        image,
      })
    },
  )

  return portfolio
}

function resolveServices(
  data: UnknownRecord,
): FreeProfileService[] {
  const services: FreeProfileService[] = []

  readRecords(data, 'products').forEach(
    (item, index) => {
      const title = readString(
        item,
        'title',
      )

      if (!title) {
        return
      }

      const image = readString(
        item,
        'image_url',
        'imageUrl',
      )

      services.push({
        id:
          readString(item, 'id') ||
          `service-${index + 1}`,

        title,

        description:
          readString(item, 'description') ||
          'Solicita más información sobre este servicio.',

        image: image || undefined,

        iconKey:
          SERVICE_ICON_SEQUENCE[
            index %
              SERVICE_ICON_SEQUENCE.length
          ],
      })
    },
  )

  return services
}

function resolveCustomLinks(
  data: UnknownRecord,
): FreeProfileData['customLinks'] {
  const links = readRecords(data, 'links')

  return links
    .filter((link) => !isSystemLink(link))
    .map((link, index) => ({
      id:
        readString(link, 'id') ||
        `link-${index + 1}`,

      label:
        readString(link, 'label') ||
        `Enlace ${index + 1}`,

      url: readString(link, 'url'),
    }))
    .filter((link) => Boolean(link.url))
}

function isFreeProfileLayoutId(
  value: string,
): value is FreeProfileLayoutId {
  return (
    value === 'impacto' ||
    value === 'personal' ||
    value === 'esencial'
  )
}

export function resolveFreeProfileLayout(
  payload: unknown,
): FreeProfileLayoutId {
  const data = unwrapProfilePayload(payload)

  const templateData = readObject(
    data,
    'templateData',
  )

  const candidate =
    readString(
      data,
      'layoutId',
      'layout_id',
    ) ||
    readString(
      templateData,
      'layout_id',
    )

  return isFreeProfileLayoutId(candidate)
    ? candidate
    : 'esencial'
}

export function adaptPublicProfileApiResponse(
  payload: unknown,
): FreeProfileAdapterResult {
  const data = unwrapProfilePayload(payload)

  const templateData = readObject(
    data,
    'templateData',
  )

  const contact = readObject(
    data,
    'contact',
  )

  const links = readRecords(
    data,
    'links',
  )

  const socialLinks = readRecords(
    data,
    'social_links',
  )

  const gallery = resolvePortfolio(data)

  const slug =
    readString(data, 'slug') ||
    'perfil'

  const name =
    readString(data, 'name') ||
    slug

  const whatsappLink = findLinkUrl(
    links,
    isWhatsAppLink,
  )

  const mapLink = findLinkUrl(
    links,
    isMapLink,
  )

  const phoneSource =
    readString(
      data,
      'whatsapp_number',
      'whatsappNumber',
    ) ||
    readString(
      contact,
      'whatsapp',
      'phone',
    ) ||
    whatsappLink

  const role =
    readString(
      templateData,
      'role',
      'title',
    ) ||
    readString(
      data,
      'subcategory',
      'category',
    ) ||
    'Perfil profesional'

  const greetingName =
    readString(
      templateData,
      'whatsapp_greeting_name',
    ) ||
    name.split(/\s+/)[0] ||
    name

  const portrait = readString(
    data,
    'avatarUrl',
    'avatar_url',
  )

  const hero =
    readString(
      templateData,
      'hero_url',
    ) ||
    readString(
      data,
      'heroUrl',
      'hero_url',
    ) ||
    gallery[0]?.image ||
    portrait

  const safeSlug = slug
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '') ||
    'perfil'

  return {
    layout: resolveFreeProfileLayout(data),

    profile: {
      id:
        readString(
          data,
          'profileId',
          'profile_id',
          'id',
        ) ||
        slug,

      slug,

      name,

      role,

      personalBadge:
        readString(
          templateData,
          'personal_badge',
        ) ||
        'Marca personal',

      aboutTitle:
        readString(
          templateData,
          'about_title',
          'headline',
        ) ||
        `Conoce más sobre ${name}.`,

      bio:
        readString(data, 'bio'),

      phone:
        normalizePhone(phoneSource),

      whatsappGreetingName:
        greetingName,

      whatsappCtaLabel:
        readString(
          templateData,
          'whatsapp_cta_label',
        ) ||
        'Escríbeme por WhatsApp',

      instagram:
        findSocialUrl(
          socialLinks,
          'instagram',
        ) ||
        findLinkUrl(
          links,
          (_, url) =>
            url.includes('instagram.com'),
        ),

      location:
        readString(
          contact,
          'map_url',
        ) ||
        mapLink,

      portrait,

      hero,

      vcardFileName:
        `${safeSlug}.vcf`,

      services:
        resolveServices(data),

      portfolio:
        gallery,

      customLinks:
        resolveCustomLinks(data),
    },
  }
}
