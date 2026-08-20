#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        print(f"✓ {label}: ya aplicado")
        return text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: esperaba 1 coincidencia y encontré {count}")
    print(f"✓ {label}")
    return text.replace(old, new, 1)


def save(path: Path, text: str):
    path.write_text(text, encoding="utf-8")


# ---------------------------------------------------------------------------
# 1) APP ROUTE · identificador final
# ---------------------------------------------------------------------------
app_path = ROOT / "app/src/App.tsx"
app = app_path.read_text(encoding="utf-8")
app = replace_once(
    app,
    "import FreeDashboard from './components/admin/free/FreeDashboard'\n",
    "import FreeDashboard from './components/admin/free/FreeDashboard'\nimport FreeIdentifier from './components/admin/free/FreeIdentifier'\n",
    "App import FreeIdentifier",
)
app = replace_once(
    app,
    "        <Route path=\"/admin/free\" element={<AdminGuard planScope=\"free\"><FreeDashboard /></AdminGuard>} />\n",
    "        <Route path=\"/admin/free\" element={<AdminGuard planScope=\"free\"><FreeDashboard /></AdminGuard>} />\n        <Route path=\"/admin/free/identifier\" element={<AdminGuard planScope=\"free\"><FreeIdentifier /></AdminGuard>} />\n",
    "App route FreeIdentifier",
)
save(app_path, app)


# ---------------------------------------------------------------------------
# 2) IDENTITY · confirmar que dejó de ser texto modelo
# ---------------------------------------------------------------------------
identity_path = ROOT / "app/src/components/admin/free/onboarding/FreeOnboardingIdentity.tsx"
identity = identity_path.read_text(encoding="utf-8")
identity = replace_once(
    identity,
    "        template_data: { ...templateData, role: role.trim(), about_section_title: aboutTitle },\n",
    "        template_data: { ...templateData, role: role.trim(), about_section_title: aboutTitle, free_identity_confirmed: true },\n",
    "marcar identidad confirmada",
)
save(identity_path, identity)


# ---------------------------------------------------------------------------
# 3) API · readiness real + bloqueo server-side + Preview draft + categoría
# ---------------------------------------------------------------------------
api_path = ROOT / "api/src/index.ts"
api = api_path.read_text(encoding="utf-8")

helper_marker = "const me = new Hono<{ Bindings: Bindings; Variables: Variables }>()\nme.use('*', requireAuth)\n"
helper_code = """const me = new Hono<{ Bindings: Bindings; Variables: Variables }>()
me.use('*', requireAuth)

type FreePublicationReadiness = {
  ready: boolean
  missing: string[]
  steps: {
    identifier: boolean
    identity: boolean
    contact: boolean
    quick_actions: boolean
    portfolio: boolean
    services: boolean
  }
  counts: {
    quick_actions: number
    portfolio: number
    services: number
  }
}

async function getFreePublicationReadiness(c: any, profileId: string): Promise<FreePublicationReadiness> {
  const [profileRow, contactRow, quickRow, galleryRow, servicesRow] = await Promise.all([
    c.env.DB.prepare(
      `SELECT slug, name, template_data FROM profiles WHERE id = ? LIMIT 1`
    ).bind(profileId).first(),
    c.env.DB.prepare(
      `SELECT whatsapp, phone, email FROM profile_contact WHERE profile_id = ? LIMIT 1`
    ).bind(profileId).first(),
    c.env.DB.prepare(
      `SELECT COUNT(*) AS n
         FROM profile_social_links
        WHERE profile_id = ?
          AND enabled = 1
          AND type IN ('call','instagram','location','email','tiktok')`
    ).bind(profileId).first(),
    c.env.DB.prepare(
      `SELECT COUNT(*) AS n FROM profile_gallery WHERE profile_id = ?`
    ).bind(profileId).first(),
    c.env.DB.prepare(
      `SELECT COUNT(*) AS n
         FROM profile_products
        WHERE profile_id = ?
          AND trim(COALESCE(title, '')) <> ''
          AND trim(COALESCE(description, '')) <> ''
          AND trim(COALESCE(image_url, '')) <> ''`
    ).bind(profileId).first(),
  ])

  const profile = (profileRow || {}) as any
  const contact = (contactRow || {}) as any
  let templateData: Record<string, any> = {}
  try { templateData = JSON.parse(String(profile.template_data || '{}')) } catch { templateData = {} }

  const slug = String(profile.slug || '').trim()
  const role = String(templateData.role || templateData.title || '').trim()
  const quickActions = Number((quickRow as any)?.n || 0)
  const portfolio = Number((galleryRow as any)?.n || 0)
  const services = Number((servicesRow as any)?.n || 0)

  const steps = {
    identifier: Boolean(slug && !slug.startsWith('kawvo-')),
    identity: Boolean(String(profile.name || '').trim() && role && templateData.free_identity_confirmed === true),
    contact: Boolean(String(contact.whatsapp || '').trim() || String(contact.phone || '').trim() || String(contact.email || '').trim()),
    quick_actions: quickActions >= 2,
    portfolio: portfolio >= 3,
    services: services >= 2,
  }

  const labels: Record<keyof typeof steps, string> = {
    identifier: 'Reserva tu identificador público',
    identity: 'Confirma tu nombre o marca y a qué te dedicas',
    contact: 'Agrega al menos un medio de contacto',
    quick_actions: 'Configura al menos 2 accesos rápidos',
    portfolio: 'Agrega al menos 3 imágenes reales a tu portafolio',
    services: 'Completa al menos 2 servicios con título, descripción e imagen',
  }

  const missing = (Object.keys(steps) as Array<keyof typeof steps>)
    .filter((key) => !steps[key])
    .map((key) => labels[key])

  return {
    ready: missing.length === 0,
    missing,
    steps,
    counts: { quick_actions: quickActions, portfolio, services },
  }
}
"""
api = replace_once(api, helper_marker, helper_code, "API helper de readiness")

api = replace_once(
    api,
    "  const templateData = (() => { try { return JSON.parse(r.template_data || '{}') } catch { return {} } })()\n  return c.json({\n",
    "  const templateData = (() => { try { return JSON.parse(r.template_data || '{}') } catch { return {} } })()\n  const freeReadiness = r.profile_id && String(r.plan_id || 'free') === 'free'\n    ? await getFreePublicationReadiness(c, String(r.profile_id)).catch(() => null)\n    : null\n  return c.json({\n",
    "calcular readiness en /me",
)
api = replace_once(
    api,
    "      templateData,\n      // Plan / retention summary",
    "      templateData,\n      freeReadiness,\n      // Plan / retention summary",
    "exponer readiness en /me",
)

api = replace_once(
    api,
    "  const template_data = body.template_data !== undefined\n    ? JSON.stringify(typeof body.template_data === 'object' ? body.template_data : {})\n    : undefined\n\n  try {\n",
    "  const template_data = body.template_data !== undefined\n    ? JSON.stringify(typeof body.template_data === 'object' ? body.template_data : {})\n    : undefined\n\n  if (is_published === 1 && String((profile as any).plan_id || 'free') === 'free') {\n    const readiness = await getFreePublicationReadiness(c, String((profile as any).id))\n    if (!readiness.ready) {\n      return c.json({\n        ok: false,\n        error: 'profile_incomplete',\n        message: 'Completa los pasos mínimos antes de publicar tu perfil.',\n        readiness,\n      }, 422)\n    }\n  }\n\n  try {\n",
    "bloqueo server-side de publicación",
)

api = replace_once(
    api,
    "'SELECT id, slug, plan_id, theme_id, layout_id, free_palette_id, free_brand_color, hero_url, hero_position_x, hero_position_y, hero_zoom, is_published, name, bio, avatar_url, whatsapp_number, blocks_order, accent_color, button_style, template_id, template_data FROM profiles WHERE slug = ?'",
    "'SELECT id, slug, plan_id, theme_id, layout_id, free_palette_id, free_brand_color, hero_url, hero_position_x, hero_position_y, hero_zoom, is_published, name, bio, avatar_url, category, subcategory, whatsapp_number, blocks_order, accent_color, button_style, template_id, template_data FROM profiles WHERE slug = ?'",
    "public API devuelve actividad comercial",
)
api = replace_once(
    api,
    "    let isOwner = false\n    if (isPreview) {\n      try {\n",
    "    let isOwner = isPreview && isPreviewEnvironment(c.env)\n    if (isPreview && !isOwner) {\n      try {\n",
    "permitir draft preview solo en entorno Preview",
)
api = replace_once(
    api,
    "      bio: (profile as any).bio,\n      avatarUrl:",
    "      bio: (profile as any).bio,\n      category: (profile as any).category ?? null,\n      subcategory: (profile as any).subcategory ?? null,\n      avatarUrl:",
    "respuesta pública incluye actividad/subcategoría",
)

# Términos visibles del endpoint guiado
api = api.replace("Código público inválido.", "Código de compra inválido.")
api = api.replace("Producto INTAP no encontrado.", "Producto Kawvo (antes INTAP) no encontrado.")
api = api.replace("El código secreto no corresponde a este producto o ya no está disponible.", "El código de activación no corresponde a este producto o ya no está disponible.")
save(api_path, api)


# ---------------------------------------------------------------------------
# 4) WEB ADAPTER · starter visual completo sin persistirlo como contenido real
# ---------------------------------------------------------------------------
adapter_path = ROOT / "web/src/components/free-profile/IntapLinkGratis.adapter.ts"
adapter = adapter_path.read_text(encoding="utf-8")

adapter = replace_once(
    adapter,
    """function resolveVisibleServices(data: UnknownRecord, category: string, templateData: UnknownRecord): FreeProfileService[] {
  const actual = resolveServices(data)
  if (actual.length > 0) return actual

  const starterGenerated = templateData.free_starter_generated === true || String(templateData.free_starter_generated || '').toLowerCase() === 'true'
  if (!starterGenerated) return []

  const starter = resolveStarterPack(category)
  const assets = resolveFreeStarterAssets(starter.category)
  return starter.services.slice(0, 3).map((service, index) => ({
    id: `starter-service-${index + 1}`,
    title: service.title,
    description: service.description.slice(0, 90),
    image: assets[index] || undefined,
    iconKey: SERVICE_ICON_SEQUENCE[index % SERVICE_ICON_SEQUENCE.length],
  }))
}
""",
    """function resolveVisibleServices(data: UnknownRecord, category: string, templateData: UnknownRecord): FreeProfileService[] {
  const actual = resolveServices(data)
  if (actual.length > 0) return actual

  const starterGenerated = templateData.free_starter_generated === true || String(templateData.free_starter_generated || '').toLowerCase() === 'true'
  if (!starterGenerated) return []

  const starter = resolveStarterPack(category)
  const assets = resolveFreeStarterAssets(starter.category)
  const variant = Number(templateData.free_starter_variant || 1) === 2 ? 2 : 1
  const offset = variant === 2 ? 2 : 0
  return starter.services.slice(0, 3).map((service, index) => ({
    id: `starter-service-${index + 1}`,
    title: service.title,
    description: service.description.slice(0, 90),
    image: assets.length ? assets[(offset + index) % assets.length] : undefined,
    iconKey: SERVICE_ICON_SEQUENCE[index % SERVICE_ICON_SEQUENCE.length],
  }))
}
""",
    "variar imágenes de servicios starter",
)

adapter = replace_once(
    adapter,
    """  const slug = readString(data, 'slug') || 'perfil'
  const name = readString(data, 'name') || slug
  const colors = resolveFreeProfileAppearanceColors(data)
  const starter = resolveStarterPack(readString(data, 'category'))
""",
    """  const slug = readString(data, 'slug') || 'perfil'
  const colors = resolveFreeProfileAppearanceColors(data)
  const category = readString(data, 'category')
  const starter = resolveStarterPack(category)
  const starterGenerated = templateData.free_starter_generated === true || String(templateData.free_starter_generated || '').toLowerCase() === 'true'
  const starterVariant = Number(templateData.free_starter_variant || 1) === 2 ? 2 : 1
  const starterAssets = resolveFreeStarterAssets(starter.category)
  const starterOffset = starterVariant === 2 ? 2 : 0
  const starterAsset = (offset: number) => starterAssets.length ? starterAssets[(starterOffset + offset) % starterAssets.length] : ''
  const name = readString(data, 'name') || (starterGenerated ? (starter.heroLabel || readString(data, 'subcategory') || starter.role) : slug)
""",
    "resolver nombre/activos starter",
)
adapter = replace_once(
    adapter,
    "  const category = readString(data, 'category')\n  const role =",
    "  const role =",
    "evitar categoría duplicada en adapter",
)
adapter = replace_once(
    adapter,
    """  const portrait = readString(data, 'avatarUrl', 'avatar_url') || buildAvatarPlaceholder(name, colors)
  const hero = readString(data, 'heroUrl', 'hero_url') || readString(templateData, 'hero_url')
""",
    """  const portrait = readString(data, 'avatarUrl', 'avatar_url') || (starterGenerated ? starterAsset(0) : '') || buildAvatarPlaceholder(name, colors)
  const hero = readString(data, 'heroUrl', 'hero_url') || readString(templateData, 'hero_url') || (starterGenerated ? starterAsset(1) : '')
""",
    "foto/hero starter desde banco gráfico",
)
adapter = replace_once(
    adapter,
    "  const safeSlug = slug.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'perfil'\n\n  return {",
    """  const safeSlug = slug.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'perfil'
  const actualPortfolio = resolvePortfolio(data)
  const starterPortfolio = starterGenerated
    ? [starterAsset(3), starterAsset(4), starterAsset(5)].filter(Boolean).map((image, index) => ({
        id: `starter-portfolio-${index + 1}`,
        title: `Inspiración ${index + 1}`,
        description: 'Imagen de referencia para ayudarte a visualizar tu perfil. Sustitúyela por una foto real de tu negocio.',
        image,
      }))
    : []

  return {""",
    "portafolio visual starter",
)
adapter = replace_once(
    adapter,
    "      portfolio: resolvePortfolio(data),\n",
    "      portfolio: actualPortfolio.length > 0 ? actualPortfolio : starterPortfolio,\n",
    "usar portafolio starter solo como fallback",
)
save(adapter_path, adapter)


# ---------------------------------------------------------------------------
# 5) DASHBOARD · guía dinámica + publicación bloqueada en UI
# ---------------------------------------------------------------------------
dash_path = ROOT / "app/src/components/admin/free/FreeDashboard.tsx"
dash = dash_path.read_text(encoding="utf-8")
dash = replace_once(
    dash,
    "import FreeProfileDangerZone from './FreeProfileDangerZone'\n",
    "import FreeProfileDangerZone from './FreeProfileDangerZone'\nimport FreeFirstRunGuide, { type FreePublicationReadiness } from './FreeFirstRunGuide'\n",
    "Dashboard import guide",
)
dash = replace_once(
    dash,
    "  plan_code?: string\n}\n",
    "  plan_code?: string\n  freeReadiness?: FreePublicationReadiness | null\n}\n",
    "Dashboard readiness type",
)
dash = replace_once(
    dash,
    "const freeItems = [\n  { title: 'Estilo de mi perfil'",
    "const freeItems = [\n  { title: 'Reservar mi identificador', text: 'Elige tu enlace corto /usuario', to: '/admin/free/identifier', icon: '@' },\n  { title: 'Estilo de mi perfil'",
    "Dashboard card de identificador",
)
dash = replace_once(
    dash,
    "  const [watermarkUpsellOpen, setWatermarkUpsellOpen] = useState(false)\n",
    "  const [watermarkUpsellOpen, setWatermarkUpsellOpen] = useState(false)\n  const [publishError, setPublishError] = useState('')\n",
    "Dashboard mensaje de publicación",
)
dash = replace_once(
    dash,
    """  const togglePublished = async () => {
    if (!me || publishing) return
    setPublishing(true)
    const next = me.is_published ? 0 : 1
    try {
      const result: any = await apiPut('/me/profile', { is_published: next === 1 })
      if (result.ok) setMe({ ...me, is_published: next })
    } finally {
      setPublishing(false)
    }
  }
""",
    """  const togglePublished = async () => {
    if (!me || publishing) return
    const next = me.is_published ? 0 : 1
    if (next === 1 && me.freeReadiness && !me.freeReadiness.ready) {
      setPublishError('Todavía faltan algunos pasos. Sigue la guía y te avisaremos cuando esté listo para publicar.')
      return
    }
    setPublishing(true)
    setPublishError('')
    try {
      const result: any = await apiPut('/me/profile', { is_published: next === 1 })
      if (result.ok) {
        setMe({ ...me, is_published: next })
      } else if (result.error === 'profile_incomplete') {
        setPublishError(result.message || 'Completa los pasos mínimos antes de publicar.')
        setMe({ ...me, freeReadiness: result.readiness || me.freeReadiness })
      } else {
        setPublishError(result.error || 'No pudimos cambiar el estado de publicación.')
      }
    } finally {
      setPublishing(false)
    }
  }
""",
    "Dashboard bloqueo amable de publicar",
)
dash = replace_once(
    dash,
    "        {publicUrl && (\n",
    "        {me?.freeReadiness && <FreeFirstRunGuide readiness={me.freeReadiness} />}\n\n        {publicUrl && (\n",
    "render guía antes del enlace público",
)
dash = replace_once(
    dash,
    """              <button onClick={togglePublished} disabled={publishing} className={`rounded-full px-4 py-2 text-xs font-black ${me?.is_published ? 'bg-slate-100 text-slate-700' : 'bg-cyan-600 text-white'} disabled:opacity-50`}>
                {publishing ? 'Guardando…' : me?.is_published ? 'Ocultar' : 'Publicar'}
              </button>
""",
    """              <button onClick={togglePublished} disabled={publishing || (!me?.is_published && Boolean(me?.freeReadiness && !me.freeReadiness.ready))} className={`rounded-full px-4 py-2 text-xs font-black ${me?.is_published ? 'bg-slate-100 text-slate-700' : me?.freeReadiness?.ready ? 'bg-cyan-600 text-white' : 'bg-slate-200 text-slate-400'} disabled:cursor-not-allowed disabled:opacity-80`}>
                {publishing ? 'Guardando…' : me?.is_published ? 'Ocultar' : me?.freeReadiness?.ready ? 'Publicar' : 'Completa los pasos'}
              </button>
""",
    "estado visual del botón Publicar",
)
dash = replace_once(
    dash,
    "          </article>\n        )}\n\n        <div className=\"pt-2\">",
    "          </article>\n        )}\n\n        {publishError && <p className=\"rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold leading-5 text-amber-800\">{publishError}</p>}\n\n        <div className=\"pt-2\">",
    "mensaje visible si publicación está bloqueada",
)
dash = dash.replace("<p className=\"text-[11px] font-black uppercase tracking-[0.2em] text-cyan-600\">INTAP LINK</p>", "<p className=\"text-[11px] font-black uppercase tracking-[0.2em] text-cyan-600\">KAWVO LINK</p>")
dash = dash.replace("Activa y administra tus productos INTAP", "Activa y administra tus productos Kawvo")
save(dash_path, dash)

print("\nOK · hardening de onboarding Free aplicado.")
print("Siguiente: git diff --check + builds app/web/api antes de deploy Preview.")
