import type {
  FreeProfileAppearanceColors,
  FreeProfileData,
  FreeProfileLayoutId,
  FreeProfileQuickAction,
  FreeProfileQuickActionType,
  FreeProfileService,
  FreeProfileServiceIconKey,
} from './IntapLinkGratis.types'
import { resolvePalette, resolveStarterPack } from './IntapLinkGratis.experience'

export type FreeProfileAdapterResult = {
  profile: FreeProfileData
  layout: FreeProfileLayoutId
  colors: FreeProfileAppearanceColors
}

type UnknownRecord = Record<string, unknown>

const SERVICE_ICON_SEQUENCE: FreeProfileServiceIconKey[] = ['home', 'key', 'chart-line', 'handshake']
const QUICK_ACTION_LABELS: Record<FreeProfileQuickActionType, string> = {
  call: 'Llamar', instagram: 'Instagram', location: 'Ubicación', email: 'Email', tiktok: 'TikTok',
}
const QUICK_ACTION_TYPES = new Set<FreeProfileQuickActionType>(['call', 'instagram', 'location', 'email', 'tiktok'])
const ABOUT_TITLES = new Set(['Sobre mí', 'Quién soy', 'Conóceme'])
const PORTFOLIO_TITLES = new Set(['Portafolio', 'Mis trabajos', 'Proyectos'])

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function asRecord(value: unknown): UnknownRecord { return isRecord(value) ? value : {} }
function readObject(source: UnknownRecord, key: string): UnknownRecord {
  const value = source[key]
  if (isRecord(value)) return value
  if (typeof value === 'string') { try { return asRecord(JSON.parse(value)) } catch { return {} } }
  return {}
}
function readString(source: UnknownRecord, ...keys: string[]): string {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}
function readRecords(source: UnknownRecord, ...keys: string[]): UnknownRecord[] {
  for (const key of keys) {
    const value = source[key]
    if (Array.isArray(value)) return value.filter(isRecord)
  }
  return []
}
function unwrapProfilePayload(payload: unknown): UnknownRecord {
  const root = asRecord(payload)
  return isRecord(root.data) ? root.data : root
}
function normalizeText(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}
function normalizePhone(value: string): string {
  const waMatch = value.match(/wa\.me\/(\d+)/i)
  if (waMatch) return waMatch[1]
  return value.replace(/\D/g, '')
}
function findLinkUrl(links: UnknownRecord[], matcher: (label: string, url: string) => boolean): string {
  const match = links.find((link) => matcher(normalizeText(readString(link, 'label')), normalizeText(readString(link, 'url'))))
  return match ? readString(match, 'url') : ''
}
function findSocialUrl(socialLinks: UnknownRecord[], type: string): string {
  const normalizedType = normalizeText(type)
  const match = socialLinks.find((link) => normalizeText(readString(link, 'type')) === normalizedType)
  return match ? readString(match, 'url') : ''
}
function isMapLink(label: string, url: string): boolean {
  return label.includes('mapa') || label.includes('ubicacion') || label.includes('direccion') || label.includes('como llegar') || url.includes('google.com/maps') || url.includes('maps.app.goo.gl') || url.includes('goo.gl/maps')
}
function isWhatsAppLink(label: string, url: string): boolean {
  return label.includes('whatsapp') || url.includes('wa.me') || url.includes('whatsapp')
}
function isSystemLink(link: UnknownRecord): boolean {
  const label = normalizeText(readString(link, 'label'))
  const url = normalizeText(readString(link, 'url'))
  return isWhatsAppLink(label, url) || isMapLink(label, url) || url.startsWith('tel:') || url.startsWith('mailto:') || url.includes('instagram.com') || url.includes('tiktok.com')
}
function resolvePortfolio(data: UnknownRecord): FreeProfileData['portfolio'] {
  return readRecords(data, 'gallery').map((item, index) => ({
    id: readString(item, 'id', 'image_key') || `portfolio-${index + 1}`,
    title: readString(item, 'title', 'label') || `Portafolio ${index + 1}`,
    description: readString(item, 'description').slice(0, 90),
    image: readString(item, 'image_url', 'imageUrl'),
  })).filter((item) => Boolean(item.image))
}
function isServiceIconKey(value: string): value is FreeProfileServiceIconKey {
  return SERVICE_ICON_SEQUENCE.includes(value as FreeProfileServiceIconKey)
}
function resolveServices(data: UnknownRecord): FreeProfileService[] {
  return readRecords(data, 'products').map((item, index) => {
    const title = readString(item, 'title')
    const visual = readString(item, 'image_url', 'imageUrl')
    const usesIconToken = visual.startsWith('icon:')
    const iconToken = usesIconToken ? visual.slice('icon:'.length) : ''
    const iconKey = isServiceIconKey(iconToken) ? iconToken : SERVICE_ICON_SEQUENCE[index % SERVICE_ICON_SEQUENCE.length]
    return {
      id: readString(item, 'id') || `service-${index + 1}`,
      title,
      description: (readString(item, 'description') || 'Solicita más información sobre este servicio.').slice(0, 90),
      image: usesIconToken ? undefined : visual || undefined,
      iconKey,
    }
  }).filter((item) => Boolean(item.title))
}
function resolveCustomLinks(data: UnknownRecord): FreeProfileData['customLinks'] {
  return readRecords(data, 'links').filter((link) => !isSystemLink(link)).map((link, index) => ({
    id: readString(link, 'id') || `link-${index + 1}`,
    label: readString(link, 'label') || `Enlace ${index + 1}`,
    url: readString(link, 'url'),
  })).filter((link) => Boolean(link.url))
}
function resolveQuickActions(data: UnknownRecord, phone: string, instagram: string, location: string): FreeProfileQuickAction[] {
  const socialLinks = readRecords(data, 'social_links', 'socialLinks')
  const selected = socialLinks.map((link) => {
    const rawType = normalizeText(readString(link, 'type')).replace(/^free_/, '')
    if (!QUICK_ACTION_TYPES.has(rawType as FreeProfileQuickActionType)) return null
    const type = rawType as FreeProfileQuickActionType
    const url = readString(link, 'url')
    if (!url) return null
    return { type, label: QUICK_ACTION_LABELS[type], url, sortOrder: Number(link.sort_order ?? link.sortOrder ?? 999) }
  }).filter((item): item is FreeProfileQuickAction & { sortOrder: number } => Boolean(item)).sort((a, b) => a.sortOrder - b.sortOrder).slice(0, 3).map(({ sortOrder: _sortOrder, ...item }) => item)
  if (selected.length > 0) return selected
  const fallback: FreeProfileQuickAction[] = []
  if (phone) fallback.push({ type: 'call', label: 'Llamar', url: `tel:+${phone}` })
  if (instagram) fallback.push({ type: 'instagram', label: 'Instagram', url: instagram })
  if (location) fallback.push({ type: 'location', label: 'Ubicación', url: location })
  return fallback.slice(0, 3)
}

const DEFAULT_FREE_PROFILE_COLORS: FreeProfileAppearanceColors = {
  primary: '#071f5f', secondary: '#0b61c9', accent: '#07966a', button: '#10b981', background: '#eaf0f7', surface: '#ffffff', text: '#11213d', heroGradient: '#071f5f',
}
function normalizeHexColor(value: string): string {
  const trimmed = value.trim()
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) return '#' + trimmed.slice(1).split('').map((character) => character.repeat(2)).join('')
  return ''
}
function pickColor(fallback: string, ...candidates: string[]): string {
  for (const candidate of candidates) { const color = normalizeHexColor(candidate); if (color) return color }
  return fallback
}
function escapeSvgText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}
function resolveInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'IL'
  return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('')
}
function buildAvatarPlaceholder(name: string, colors: FreeProfileAppearanceColors): string {
  const initials = escapeSvgText(resolveInitials(name))
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><rect width="600" height="600" fill="${colors.background}"/><circle cx="300" cy="300" r="230" fill="${colors.primary}"/><text x="300" y="335" text-anchor="middle" font-family="Arial, sans-serif" font-size="170" font-weight="700" fill="#ffffff">${initials}</text></svg>`
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg)
}

export function resolveFreeProfileAppearanceColors(payload: unknown): FreeProfileAppearanceColors {
  const data = unwrapProfilePayload(payload)
  const paletteId = readString(data, 'freePaletteId', 'free_palette_id') || 'intap'
  const freeBrandColor = readString(data, 'freeBrandColor', 'free_brand_color')
  if (paletteId) return resolvePalette(paletteId, freeBrandColor || null)
  const templateData = readObject(data, 'templateData')
  const appearance = readObject(templateData, 'appearance')
  const brandColor = pickColor(DEFAULT_FREE_PROFILE_COLORS.primary, readString(data, 'accentColor', 'accent_color'))
  return {
    primary: pickColor(brandColor, readString(appearance, 'primary'), readString(templateData, 'primary_color')),
    secondary: pickColor(brandColor, readString(appearance, 'secondary'), readString(templateData, 'secondary_color')),
    accent: pickColor(brandColor, readString(appearance, 'accent'), readString(templateData, 'accent_color')),
    button: pickColor(brandColor, readString(appearance, 'button'), readString(templateData, 'button_color')),
    background: pickColor(DEFAULT_FREE_PROFILE_COLORS.background, readString(appearance, 'background'), readString(templateData, 'background_color')),
    surface: pickColor(DEFAULT_FREE_PROFILE_COLORS.surface, readString(appearance, 'surface'), readString(templateData, 'surface_color')),
    text: pickColor(DEFAULT_FREE_PROFILE_COLORS.text, readString(appearance, 'text'), readString(templateData, 'text_color')),
    heroGradient: pickColor(brandColor, readString(appearance, 'heroGradient'), readString(templateData, 'hero_gradient')),
  }
}
function isFreeProfileLayoutId(value: string): value is FreeProfileLayoutId { return value === 'impacto' || value === 'personal' || value === 'esencial' }
export function resolveFreeProfileLayout(payload: unknown): FreeProfileLayoutId {
  const data = unwrapProfilePayload(payload)
  const templateData = readObject(data, 'templateData')
  const candidate = readString(data, 'layoutId', 'layout_id') || readString(templateData, 'layout_id')
  return isFreeProfileLayoutId(candidate) ? candidate : 'esencial'
}
function allowedTitle(value: string, allowed: Set<string>, fallback: string) {
  return allowed.has(value) ? value : fallback
}

export function adaptPublicProfileApiResponse(payload: unknown): FreeProfileAdapterResult {
  const data = unwrapProfilePayload(payload)
  const templateData = readObject(data, 'templateData')
  const contact = readObject(data, 'contact')
  const links = readRecords(data, 'links')
  const socialLinks = readRecords(data, 'social_links', 'socialLinks')
  const slug = readString(data, 'slug') || 'perfil'
  const name = readString(data, 'name') || slug
  const colors = resolveFreeProfileAppearanceColors(data)
  const starter = resolveStarterPack(readString(data, 'category'))

  const whatsappLink = findLinkUrl(links, isWhatsAppLink)
  const mapLink = findLinkUrl(links, isMapLink)
  const phoneSource = readString(data, 'whatsapp_number', 'whatsappNumber') || readString(contact, 'whatsapp', 'phone') || whatsappLink
  const phone = normalizePhone(phoneSource)
  const instagram = findSocialUrl(socialLinks, 'instagram') || findSocialUrl(socialLinks, 'free_instagram') || findLinkUrl(links, (_, url) => url.includes('instagram.com'))
  const location = findSocialUrl(socialLinks, 'free_location') || readString(contact, 'map_url') || mapLink
  const category = readString(data, 'category')
  const role = readString(templateData, 'role', 'title') || readString(data, 'subcategory', 'category') || starter.role
  const greetingName = readString(templateData, 'whatsapp_greeting_name') || name.split(/\s+/)[0] || name
  const portrait = readString(data, 'avatarUrl', 'avatar_url') || buildAvatarPlaceholder(name, colors)
  const hero = readString(data, 'heroUrl', 'hero_url') || readString(templateData, 'hero_url')
  const heroPositionX = Number(data.heroPositionX ?? data.hero_position_x ?? 50)
  const heroPositionY = Number(data.heroPositionY ?? data.hero_position_y ?? 50)
  const heroZoom = Number(data.heroZoom ?? data.hero_zoom ?? 1)
  const safeSlug = slug.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'perfil'

  return {
    layout: resolveFreeProfileLayout(data),
    colors,
    profile: {
      id: readString(data, 'profileId', 'profile_id', 'id') || slug,
      slug,
      name,
      role,
      personalBadge: readString(templateData, 'personal_badge') || 'Marca personal',
      aboutTitle: allowedTitle(readString(templateData, 'about_section_title'), ABOUT_TITLES, 'Sobre mí'),
      portfolioTitle: allowedTitle(readString(templateData, 'portfolio_section_title'), PORTFOLIO_TITLES, 'Portafolio'),
      servicesTitle: readString(templateData, 'services_section_title').slice(0, 60) || 'Servicios',
      servicesDescription: readString(templateData, 'services_section_description').slice(0, 240),
      bio: readString(data, 'bio') || starter.bio,
      phone,
      whatsappGreetingName: greetingName,
      whatsappCtaLabel: readString(templateData, 'whatsapp_cta_label') || 'Escríbeme por WhatsApp',
      instagram,
      location,
      portrait,
      hero,
      heroPositionX: Number.isFinite(heroPositionX) ? heroPositionX : 50,
      heroPositionY: Number.isFinite(heroPositionY) ? heroPositionY : 50,
      heroZoom: Number.isFinite(heroZoom) ? heroZoom : 1,
      category: category || starter.category,
      vcardFileName: `${safeSlug}.vcf`,
      quickActions: resolveQuickActions(data, phone, instagram, location),
      services: resolveServices(data),
      portfolio: resolvePortfolio(data),
      customLinks: resolveCustomLinks(data),
    },
  }
}
