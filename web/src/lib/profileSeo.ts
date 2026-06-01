export interface SeoSocialLink {
  type: string
  url: string
}

export interface SeoGalleryItem {
  image_url: string | null
}

export interface SeoProduct {
  title: string
  description: string | null
  image_url: string | null
}

export interface SeoFAQ {
  question: string
  answer: string
}

export interface SeoContactInfo {
  whatsapp: string | null
  email: string | null
  phone: string | null
  hours: string | null
  address: string | null
  map_url: string | null
}

export interface SeoPublicProfile {
  slug: string
  name: string | null
  bio: string | null
  avatarUrl: string | null
  whatsapp_number: string | null
  templateId?: string | null
  templateData?: Record<string, string>
  social_links: SeoSocialLink[]
  gallery: SeoGalleryItem[]
  faqs: SeoFAQ[]
  products: SeoProduct[]
  contact: SeoContactInfo | null
}

export interface ProfileSeoPayload {
  title: string
  description: string
  canonicalUrl: string
  imageUrl: string
  jsonLd: Record<string, unknown>[]
}

const DEFAULT_SITE_NAME = 'INTAP LINK'
const DEFAULT_BASE_URL = 'https://intaprd.com'
const DEFAULT_IMAGE = 'https://intaprd.com/assets/marketing/hero/hero-intap-main.png'

function cleanText(value?: string | null): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function truncate(value: string, max = 155): string {
  const clean = cleanText(value)
  if (clean.length <= max) return clean
  return `${clean.slice(0, max - 1).trim()}…`
}

function absoluteUrl(value?: string | null, baseUrl = DEFAULT_BASE_URL): string | null {
  const clean = cleanText(value)
  if (!clean) return null

  try {
    return new URL(clean).toString()
  } catch {
    if (clean.startsWith('/')) {
      return `${baseUrl.replace(/\/$/, '')}${clean}`
    }
  }

  return null
}

function normalizePhone(value?: string | null): string | null {
  const digits = String(value || '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return `+${digits}`
}

function getPrimaryImage(profile: SeoPublicProfile, baseUrl = DEFAULT_BASE_URL): string {
  const fromTemplate =
    profile.templateData?.og_image ||
    profile.templateData?.hero_image ||
    profile.templateData?.profile_image ||
    profile.templateData?.avatar

  return (
    absoluteUrl(fromTemplate, baseUrl) ||
    absoluteUrl(profile.avatarUrl, baseUrl) ||
    absoluteUrl(profile.gallery?.find(item => item.image_url)?.image_url, baseUrl) ||
    DEFAULT_IMAGE
  )
}

function getSameAs(profile: SeoPublicProfile): string[] {
  return (profile.social_links || [])
    .map(link => absoluteUrl(link.url))
    .filter((url): url is string => Boolean(url))
}

function inferBusinessType(profile: SeoPublicProfile): string {
  const text = `${profile.slug} ${profile.name || ''} ${profile.bio || ''} ${profile.templateId || ''}`.toLowerCase()

  if (text.includes('inmobili') || text.includes('novi') || text.includes('renta')) return 'LocalBusiness'
  if (text.includes('goma') || text.includes('aro') || text.includes('jason')) return 'AutoPartsStore'
  if (text.includes('constructora') || text.includes('ingenier')) return 'HomeAndConstructionBusiness'

  return 'LocalBusiness'
}

export function buildProfileSeo(profile: SeoPublicProfile, baseUrl = DEFAULT_BASE_URL): ProfileSeoPayload {
  const name = cleanText(profile.name) || profile.slug
  const description = truncate(
    profile.templateData?.seo_description ||
      profile.bio ||
      `Perfil digital oficial de ${name} en INTAP LINK.`
  )

  const canonicalUrl = `${baseUrl.replace(/\/$/, '')}/${encodeURIComponent(profile.slug)}`
  const imageUrl = getPrimaryImage(profile, baseUrl)
  const phone = normalizePhone(profile.contact?.phone || profile.whatsapp_number || profile.contact?.whatsapp)
  const whatsapp = normalizePhone(profile.whatsapp_number || profile.contact?.whatsapp)
  const sameAs = getSameAs(profile)
  const businessType = profile.templateData?.schema_type || inferBusinessType(profile)

  const title = truncate(
    profile.templateData?.seo_title ||
      `${name} | Perfil oficial`,
    70
  )

  const organizationJsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': businessType,
    '@id': `${canonicalUrl}#profile`,
    name,
    url: canonicalUrl,
    image: imageUrl,
    description,
    sameAs,
    telephone: phone || whatsapp || undefined,
    email: profile.contact?.email || undefined,
    address: profile.contact?.address
      ? {
          '@type': 'PostalAddress',
          streetAddress: profile.contact.address,
        }
      : undefined,
    contactPoint: phone || whatsapp || profile.contact?.email
      ? [
          {
            '@type': 'ContactPoint',
            telephone: phone || whatsapp || undefined,
            email: profile.contact?.email || undefined,
            contactType: 'customer service',
            availableLanguage: ['es'],
          },
        ]
      : undefined,
  }

  const websiteJsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${canonicalUrl}#webpage`,
    url: canonicalUrl,
    name: title,
    description,
    primaryImageOfPage: {
      '@type': 'ImageObject',
      url: imageUrl,
    },
    isPartOf: {
      '@type': 'WebSite',
      name: DEFAULT_SITE_NAME,
      url: baseUrl,
    },
    about: {
      '@id': `${canonicalUrl}#profile`,
    },
  }

  const faqJsonLd: Record<string, unknown> | null = profile.faqs?.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: profile.faqs.slice(0, 10).map(faq => ({
          '@type': 'Question',
          name: cleanText(faq.question),
          acceptedAnswer: {
            '@type': 'Answer',
            text: cleanText(faq.answer),
          },
        })),
      }
    : null

  const servicesJsonLd = (profile.products || []).slice(0, 12).map(product => ({
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: cleanText(product.title),
    description: truncate(product.description || product.title, 220),
    provider: {
      '@id': `${canonicalUrl}#profile`,
    },
    image: absoluteUrl(product.image_url, baseUrl) || undefined,
    url: canonicalUrl,
  }))

  const jsonLd = [
    organizationJsonLd,
    websiteJsonLd,
    faqJsonLd,
    ...servicesJsonLd,
  ].filter(Boolean) as Record<string, unknown>[]

  return {
    title,
    description,
    canonicalUrl,
    imageUrl,
    jsonLd,
  }
}

function setMetaAttribute(selector: string, attr: 'content' | 'href', value: string) {
  if (typeof document === 'undefined') return

  let element = document.head.querySelector(selector) as HTMLMetaElement | HTMLLinkElement | null

  if (!element) {
    if (selector.startsWith('link')) {
      element = document.createElement('link')
      const rel = selector.match(/rel="([^"]+)"/)?.[1]
      if (rel) element.setAttribute('rel', rel)
    } else {
      element = document.createElement('meta')
      const name = selector.match(/name="([^"]+)"/)?.[1]
      const property = selector.match(/property="([^"]+)"/)?.[1]
      if (name) element.setAttribute('name', name)
      if (property) element.setAttribute('property', property)
    }

    document.head.appendChild(element)
  }

  element.setAttribute(attr, value)
}

export function applyProfileSeo(payload: ProfileSeoPayload) {
  if (typeof document === 'undefined') return

  document.title = payload.title

  setMetaAttribute('link[rel="canonical"]', 'href', payload.canonicalUrl)
  setMetaAttribute('meta[name="description"]', 'content', payload.description)

  setMetaAttribute('meta[property="og:type"]', 'content', 'website')
  setMetaAttribute('meta[property="og:title"]', 'content', payload.title)
  setMetaAttribute('meta[property="og:description"]', 'content', payload.description)
  setMetaAttribute('meta[property="og:url"]', 'content', payload.canonicalUrl)
  setMetaAttribute('meta[property="og:image"]', 'content', payload.imageUrl)

  setMetaAttribute('meta[name="twitter:card"]', 'content', 'summary_large_image')
  setMetaAttribute('meta[name="twitter:title"]', 'content', payload.title)
  setMetaAttribute('meta[name="twitter:description"]', 'content', payload.description)
  setMetaAttribute('meta[name="twitter:image"]', 'content', payload.imageUrl)

  document
    .querySelectorAll('script[data-intap-profile-jsonld="true"]')
    .forEach(node => node.remove())

  payload.jsonLd.forEach(item => {
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.dataset.intapProfileJsonld = 'true'
    script.textContent = JSON.stringify(item)
    document.head.appendChild(script)
  })
}
