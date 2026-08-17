import { useMemo } from 'react'
import { resolveFreeStarterContent } from '../../../../../../shared/free-profile-starter-content'
import { FREE_PROFILE_STARTER_ASSETS } from '../../../../../../shared/free-profile-starter-assets'

type Props = {
  category: string
  subcategory: string
  variant: 1 | 2
}

const PALETTES: Record<string, { primary: string; accent: string; background: string; surface: string; text: string }> = {
  intap: { primary: '#0097C7', accent: '#16B8A6', background: '#F5F8FB', surface: '#FFFFFF', text: '#11223B' },
  oceano: { primary: '#087EA4', accent: '#14B8A6', background: '#F4F9FB', surface: '#FFFFFF', text: '#102A3A' },
  esmeralda: { primary: '#138A72', accent: '#32B894', background: '#F3F9F7', surface: '#FFFFFF', text: '#15352F' },
  violeta: { primary: '#7057B8', accent: '#9B7CE2', background: '#F8F6FC', surface: '#FFFFFF', text: '#2A2340' },
  coral: { primary: '#D66C5B', accent: '#E99979', background: '#FCF6F4', surface: '#FFFFFF', text: '#3B2926' },
  grafito: { primary: '#34445A', accent: '#718096', background: '#F5F7FA', surface: '#FFFFFF', text: '#182230' },
  arena: { primary: '#9A7851', accent: '#C4A77D', background: '#FAF7F2', surface: '#FFFFFF', text: '#342B22' },
}

function externalAssetUrl(path: string) {
  const webBase = import.meta.env.VITE_ENVIRONMENT === 'preview'
    ? 'https://feature-intap-link-approved-v9ix.intap-link.pages.dev'
    : (import.meta.env.VITE_WEB_URL ?? 'https://intaprd.com').replace(/\/$/, '')
  return `${webBase}${path}`
}

export default function FreeStarterNativePreview({ category, subcategory, variant }: Props) {
  const starter = useMemo(() => resolveFreeStarterContent(category), [category])
  const assets = useMemo(() => {
    const values = (FREE_PROFILE_STARTER_ASSETS as Record<string, readonly string[]>)[starter.category] || []
    if (variant === 2 && values.length > 3) return [...values.slice(3), ...values.slice(0, 3)]
    return [...values]
  }, [starter.category, variant])
  const colors = PALETTES[starter.recommendedPalette] || PALETTES.intap

  const hero = assets[0] ? externalAssetUrl(assets[0]) : ''
  const portrait = assets[1] ? externalAssetUrl(assets[1]) : hero
  const portfolio = assets.slice(2, 5).map(externalAssetUrl)
  const serviceImages = [assets[3] || assets[0], assets[4] || assets[1], assets[5] || assets[2]].map((value) => value ? externalAssetUrl(value) : '')
  const role = subcategory || starter.role

  return (
    <div className="mx-auto w-full max-w-[440px] overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_20px_65px_rgba(15,23,42,0.12)]" style={{ background: colors.background, color: colors.text }}>
      <div className="relative h-[250px] overflow-hidden bg-slate-200">
        {hero ? <img src={hero} alt="" className="h-full w-full object-cover" /> : null}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 via-transparent to-transparent" />
        <div className="absolute bottom-5 left-5 right-5 flex items-end gap-3">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border-4 border-white bg-white shadow-lg">
            {portrait ? <img src={portrait} alt="" className="h-full w-full object-cover" /> : null}
          </div>
          <div className="min-w-0 pb-1 text-white">
            <h2 className="truncate text-[25px] font-black leading-tight">Tu nombre o negocio</h2>
            <p className="mt-1 text-sm font-semibold text-white/90">{role}</p>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-5" style={{ background: colors.surface }}>
        <div className="grid grid-cols-3 gap-2">
          {[
            ['☎', 'Llamar'],
            ['◎', 'Instagram'],
            ['⌖', 'Ubicación'],
          ].map(([icon, label]) => (
            <div key={label} className="rounded-2xl border px-2 py-3 text-center" style={{ borderColor: `${colors.primary}55`, color: colors.text }}>
              <div className="text-lg" style={{ color: colors.primary }}>{icon}</div>
              <div className="mt-1 text-[11px] font-extrabold">{label}</div>
            </div>
          ))}
        </div>

        <button type="button" className="w-full rounded-2xl border px-4 py-3 text-sm font-extrabold" style={{ borderColor: colors.primary, color: colors.primary }}>
          ▣ Guardar contacto
        </button>

        <section className="border-t pt-5" style={{ borderColor: `${colors.accent}55` }}>
          <h3 className="text-xl font-black">Sobre mí</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{starter.bio}</p>
        </section>

        <section className="border-t pt-5" style={{ borderColor: `${colors.accent}55` }}>
          <h3 className="text-xl font-black">Mis trabajos</h3>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {portfolio.map((image, index) => (
              <div key={image} className="overflow-hidden rounded-2xl bg-slate-100">
                <img src={image} alt={`Ejemplo ${index + 1}`} className="aspect-[4/5] h-full w-full object-cover" />
              </div>
            ))}
          </div>
        </section>

        <section className="border-t pt-5" style={{ borderColor: `${colors.accent}55` }}>
          <h3 className="text-xl font-black">{starter.servicesTitle}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{starter.servicesDescription}</p>
          <div className="mt-4 space-y-3">
            {starter.services.map((service, index) => (
              <article key={service.title} className="flex gap-3 rounded-2xl border p-3" style={{ borderColor: `${colors.primary}35`, background: colors.background }}>
                <div className="h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                  {serviceImages[index] ? <img src={serviceImages[index]} alt="" className="h-full w-full object-cover" /> : null}
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-black">{service.title}</h4>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{service.description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl px-4 py-4 text-sm" style={{ background: colors.background }}>
          <div className="font-black">Datos base de ejemplo</div>
          <div className="mt-2 space-y-1 text-slate-600">
            <div>Teléfono: 8090000000</div>
            <div>Instagram: @intaprd</div>
            <div>Ubicación: Santo Domingo, República Dominicana</div>
          </div>
        </section>

        <div className="pt-1 text-center text-[11px] font-semibold text-slate-400">
          Esta propuesta es una base visual. Debes sustituir textos, imágenes y datos por los reales antes de publicar.
        </div>
      </div>
    </div>
  )
}
