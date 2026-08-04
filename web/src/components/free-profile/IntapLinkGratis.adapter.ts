import type {
  FreeProfileAppearanceColors,
  FreeProfileData,
  FreeProfileLayoutId,
  FreeProfileService,
  FreeProfileServiceIconKey,
} from './IntapLinkGratis.types'

export type FreeProfileAdapterResult = {
  profile: FreeProfileData
  layout: FreeProfileLayoutId
  colors: FreeProfileAppearanceColors
}

type UnknownRecord = Record<string, unknown>

const SERVICE_ICON_SEQUENCE:
  FreeProfileServiceIconKey[] = [
    'home',
    'key',
    'chart-line',
    'handshake',
  ]


function isServiceIconKey(
  value: string,
): value is FreeProfileServiceIconKey {
  return SERVICE_ICON_SEQUENCE.includes(
    value as FreeProfileServiceIconKey,
  )
}

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

      const visual = readString(
        item,
        'image_url',
        'imageUrl',
      )

      const usesIconToken =
        visual.startsWith('icon:')

      const iconToken =
        usesIconToken
          ? visual.slice('icon:'.length)
          : ''

      const iconKey =
        isServiceIconKey(iconToken)
          ? iconToken
          : SERVICE_ICON_SEQUENCE[
              index %
                SERVICE_ICON_SEQUENCE.length
            ]

      const image =
        usesIconToken
          ? ''
          : visual

      services.push({
        id:
          readString(item, 'id') ||
          `service-${index + 1}`,

        title,

        description:
          readString(item, 'description') ||
          'Solicita más información sobre este servicio.',

        image: image || undefined,

        iconKey,
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


const DEFAULT_FREE_PROFILE_COLORS:
  FreeProfileAppearanceColors = {
    primary: '#071f5f',
    secondary: '#0b61c9',
    accent: '#07966a',
    button: '#10b981',
    background: '#eaf0f7',
    surface: '#ffffff',
    text: '#11213d',
    heroGradient: '#071f5f',
  }

function normalizeHexColor(
  value: string,
): string {
  const trimmed = value.trim()

  if (/^#[0-9a-f]{6}$/i.test(trimmed)) {
    return trimmed
  }

  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    return (
      '#' +
      trimmed
        .slice(1)
        .split('')
        .map((character) => character.repeat(2))
        .join('')
    )
  }

  return ''
}

function pickColor(
  fallback: string,
  ...candidates: string[]
): string {
  for (const candidate of candidates) {
    const color = normalizeHexColor(candidate)

    if (color) {
      return color
    }
  }

  return fallback
}

function escapeSvgText(
  value: string,
): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function resolveInitials(
  name: string,
): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length === 0) {
    return 'IL'
  }

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

function buildAvatarPlaceholder(
  name: string,
  colors: FreeProfileAppearanceColors,
): string {
  const initials = escapeSvgText(
    resolveInitials(name),
  )

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `width="600" height="600" viewBox="0 0 600 600">` +
    `<rect width="600" height="600" fill="${colors.background}"/>` +
    `<circle cx="300" cy="300" r="230" fill="${colors.primary}"/>` +
    `<text x="300" y="335" text-anchor="middle" ` +
    `font-family="Arial, sans-serif" font-size="170" ` +
    `font-weight="700" fill="#ffffff">${initials}</text>` +
    `</svg>`

  return (
    'data:image/svg+xml;charset=UTF-8,' +
    encodeURIComponent(svg)
  )
}

export function resolveFreeProfileAppearanceColors(
  payload: unknown,
): FreeProfileAppearanceColors {
  const data = unwrapProfilePayload(payload)

  const templateData = readObject(
    data,
    'templateData',
  )

  const appearance = readObject(
    templateData,
    'appearance',
  )

  const brandColor = pickColor(
    DEFAULT_FREE_PROFILE_COLORS.primary,
    readString(
      data,
      'accentColor',
      'accent_color',
    ),
  )

  return {
    primary: pickColor(
      brandColor,
      readString(appearance, 'primary'),
      readString(templateData, 'primary_color'),
    ),

    secondary: pickColor(
      brandColor,
      readString(appearance, 'secondary'),
      readString(templateData, 'secondary_color'),
    ),

    accent: pickColor(
      brandColor,
      readString(appearance, 'accent'),
      readString(templateData, 'accent_color'),
    ),

    button: pickColor(
      brandColor,
      readString(appearance, 'button'),
      readString(templateData, 'button_color'),
    ),

    background: pickColor(
      DEFAULT_FREE_PROFILE_COLORS.background,
      readString(appearance, 'background'),
      readString(templateData, 'background_color'),
    ),

    surface: pickColor(
      DEFAULT_FREE_PROFILE_COLORS.surface,
      readString(appearance, 'surface'),
      readString(templateData, 'surface_color'),
    ),

    text: pickColor(
      DEFAULT_FREE_PROFILE_COLORS.text,
      readString(appearance, 'text'),
      readString(templateData, 'text_color'),
    ),

    heroGradient: pickColor(
      brandColor,
      readString(appearance, 'heroGradient'),
      readString(
        templateData,
        'hero_gradient',
      ),
    ),
  }
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

  const colors =
    resolveFreeProfileAppearanceColors(data)

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

  const portrait =
    readString(
      data,
      'avatarUrl',
      'avatar_url',
    ) ||
    buildAvatarPlaceholder(
      name,
      colors,
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

    colors,

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
