import { normalizeQuickActionUrl } from './quick-action-url'

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

export async function getFreeProfilePublicationReadiness(
  c: any,
  profileId: string,
): Promise<FreeProfilePublicationReadiness> {
  const [
    profile,
    contact,
    links,
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
      `SELECT whatsapp, phone
       FROM profile_contact
       WHERE profile_id = ?
       LIMIT 1`
    ).bind(profileId).first(),

    c.env.DB.prepare(
      `SELECT url
       FROM profile_links
       WHERE profile_id = ?
         AND COALESCE(is_active, 1) = 1`
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
         AND TRIM(COALESCE(description, '')) <> ''
         AND TRIM(COALESCE(image_url, '')) <> ''`
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

  const actions = new Set<string>()

  for (const link of links.results ?? []) {
    const normalized = normalizeQuickActionUrl(
      text((link as any).url),
    )
    if (normalized) actions.add(normalized)
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
      route: '/admin/free/onboarding/identity',
    },
    {
      key: 'contact',
      label: 'Teléfono, celular o WhatsApp',
      complete: hasContact,
      current: hasContact ? 1 : 0,
      required: 1,
      route: '/admin/free/onboarding/contact',
    },
    {
      key: 'quick_actions',
      label: 'Acciones o enlaces rápidos',
      complete: actions.size >= 2,
      current: actions.size,
      required: 2,
      route: '/admin/free/links',
    },
    {
      key: 'portfolio',
      label: 'Imágenes de portafolio',
      complete: portfolioCount >= 3,
      current: portfolioCount,
      required: 3,
      route: '/admin/free/portfolio',
    },
    {
      key: 'services',
      label: 'Servicios completos',
      complete: servicesCount >= 2,
      current: servicesCount,
      required: 2,
      route: '/admin/free/services',
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
