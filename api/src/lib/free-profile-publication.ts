export type PublicationRequirement = {
  key:
    | 'identity'
    | 'contact'
    | 'quick_actions'
    | 'portfolio'
    | 'services'
  label: string
  complete: boolean
  current: number
  required: number
  route: string
}

export type FreeProfilePublicationReadiness = {
  ready: boolean
  items: PublicationRequirement[]
  missing: PublicationRequirement[]
}

function text(value: unknown): string {
  return String(value ?? '').trim()
}

function parseTemplateData(
  value: unknown,
): Record<string, unknown> {
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value)
  ) {
    return value as Record<string, unknown>
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value)

      if (
        parsed &&
        typeof parsed === 'object' &&
        !Array.isArray(parsed)
      ) {
        return parsed
      }
    } catch {
      return {}
    }
  }

  return {}
}

function classifyLink(
  actions: Set<string>,
  row: any,
): void {
  const id = text(row.id)
  const label = text(row.label).toLowerCase()
  const url = text(row.url).toLowerCase()

  if (!url) return

  const combined = `${label} ${url}`

  if (
    combined.includes('whatsapp') ||
    url.includes('wa.me/')
  ) {
    actions.add('whatsapp')
    return
  }

  if (
    combined.includes('ubicacion') ||
    combined.includes('ubicación') ||
    combined.includes('mapa') ||
    url.includes('google.com/maps') ||
    url.includes('maps.app.goo.gl')
  ) {
    actions.add('location')
    return
  }

  const socialHosts = [
    'instagram.com',
    'facebook.com',
    'tiktok.com',
    'linkedin.com',
    'youtube.com',
    'twitter.com',
    'x.com/',
  ]

  const socialHost = socialHosts.find(
    (host) => url.includes(host),
  )

  if (socialHost) {
    actions.add(`social:${socialHost}`)
    return
  }

  actions.add(`link:${id}`)
}

export async function getFreeProfilePublicationReadiness(
  c: any,
  profileId: string,
): Promise<FreeProfilePublicationReadiness> {
  const [
    profile,
    contact,
    links,
    socials,
    gallery,
    services,
  ] = await Promise.all([
    c.env.DB.prepare(
      `SELECT
         name,
         template_data,
         whatsapp_number
       FROM profiles
       WHERE id = ?
       LIMIT 1`
    ).bind(profileId).first(),

    c.env.DB.prepare(
      `SELECT whatsapp, phone, email, map_url
       FROM profile_contact
       WHERE profile_id = ?
       LIMIT 1`
    ).bind(profileId).first(),

    c.env.DB.prepare(
      `SELECT id, label, url
       FROM profile_links
       WHERE profile_id = ?
         AND COALESCE(is_active, 1) = 1`
    ).bind(profileId).all(),

    c.env.DB.prepare(
      `SELECT id, type, url
       FROM profile_social_links
       WHERE profile_id = ?
         AND COALESCE(enabled, 1) = 1`
    ).bind(profileId).all(),

    c.env.DB.prepare(
      `SELECT COUNT(*) AS n
       FROM profile_gallery
       WHERE profile_id = ?`
    ).bind(profileId).first(),

    c.env.DB.prepare(
      `SELECT COUNT(*) AS n
       FROM profile_products
       WHERE profile_id = ?
         AND TRIM(COALESCE(title, '')) <> ''
         AND TRIM(COALESCE(description, '')) <> ''`
    ).bind(profileId).first(),
  ])

  if (!profile) {
    throw new Error('Perfil no encontrado')
  }

  const p = profile as any
  const contactData = (contact ?? {}) as any
  const templateData = parseTemplateData(p.template_data)

  const name = text(p.name)
  const role =
    text(templateData.role) ||
    text(templateData.title)

  const whatsapp =
    text(contactData.whatsapp) ||
    text(p.whatsapp_number)

  const phone = text(contactData.phone)
  const email = text(contactData.email)
  const mapUrl = text(contactData.map_url)

  const actions = new Set<string>()

  if (whatsapp) actions.add('whatsapp')
  if (phone) actions.add('phone')
  if (email) actions.add('email')
  if (mapUrl) actions.add('location')

  for (const social of socials.results ?? []) {
    const type = text((social as any).type)

    if (type && text((social as any).url)) {
      actions.add(`social:${type}`)
    }
  }

  for (const link of links.results ?? []) {
    classifyLink(actions, link)
  }

  const portfolioCount =
    Number((gallery as any)?.n ?? 0)

  const servicesCount =
    Number((services as any)?.n ?? 0)

  const identityCount =
    (name ? 1 : 0) +
    (role ? 1 : 0)

  const hasContact = Boolean(phone || whatsapp)

  const items: PublicationRequirement[] = [
    {
      key: 'identity',
      label: 'Nombre y cargo',
      complete: identityCount === 2,
      current: identityCount,
      required: 2,
      route: '/admin/onboarding/identity',
    },
    {
      key: 'contact',
      label: 'Teléfono, celular o WhatsApp',
      complete: hasContact,
      current: hasContact ? 1 : 0,
      required: 1,
      route: '/admin/onboarding/contact',
    },
    {
      key: 'quick_actions',
      label: 'Acciones o enlaces rápidos',
      complete: actions.size >= 2,
      current: actions.size,
      required: 2,
      route: '/admin/links',
    },
    {
      key: 'portfolio',
      label: 'Imágenes de portafolio',
      complete: portfolioCount >= 3,
      current: portfolioCount,
      required: 3,
      route: '/admin/gallery',
    },
    {
      key: 'services',
      label: 'Servicios completos',
      complete: servicesCount >= 2,
      current: servicesCount,
      required: 2,
      route: '/admin/products',
    },
  ]

  return {
    ready: items.every((item) => item.complete),
    items,
    missing: items.filter((item) => !item.complete),
  }
}

export type FreeProfilePublicationEnforcement = {
  readiness: FreeProfilePublicationReadiness
  unpublished: boolean
}

/**
 * Garantiza que un perfil Gratis incompleto no permanezca publicado.
 *
 * Se utiliza en las lecturas autenticadas y públicas para cubrir:
 * - perfiles publicados antes de existir la regla;
 * - perfiles que pierden contenido mínimo después de publicarse.
 */
export async function enforceFreeProfilePublicationState(
  c: any,
  profileId: string,
  isPublished: boolean | number,
): Promise<FreeProfilePublicationEnforcement> {
  const readiness =
    await getFreeProfilePublicationReadiness(
      c,
      profileId,
    )

  let unpublished = false

  if (Boolean(isPublished) && !readiness.ready) {
    const result = await c.env.DB.prepare(
      `UPDATE profiles
       SET is_published = 0,
           updated_at = datetime('now')
       WHERE id = ?
         AND plan_id = 'free'
         AND is_published = 1`
    )
      .bind(profileId)
      .run()

    unpublished =
      Number(result?.meta?.changes ?? 0) > 0
  }

  return {
    readiness,
    unpublished,
  }
}
