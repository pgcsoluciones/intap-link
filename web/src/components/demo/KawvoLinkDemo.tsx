import { useEffect, useMemo, useRef, useState } from 'react'
import IntapLinkGratisProfile from '../free-profile/IntapLinkGratisProfile'
import type {
  FreeProfileAppearanceColors,
  FreeProfileData,
  FreeProfileLayoutId,
  FreeProfileService,
} from '../free-profile/IntapLinkGratis.types'
import './KawvoLinkDemo.css'

type DemoStage = 'welcome' | 'edit' | 'result'

type DemoForm = {
  name: string
  role: string
  bio: string
  whatsapp: string
  instagram: string
  layout: FreeProfileLayoutId
  palette: keyof typeof PALETTES
  services: FreeProfileService[]
}

const DEFAULT_HERO = '/assets/free-starter/servicios-profesionales/servicios-profesionales-01.webp'
const DEFAULT_PORTRAIT = DEFAULT_HERO
const DEFAULT_LOCATION = 'Parque Duarte, Samaná'
const DEFAULT_MAP_URL = 'https://www.google.com/maps/search/?api=1&query=Parque+Duarte+Samana'
const COMMERCIAL_URL = 'https://nfc.kawvoia.com'

const PALETTES: Record<string, FreeProfileAppearanceColors> = {
  oceano: {
    primary: '#0C4A6E', secondary: '#0284C7', accent: '#0891B2', button: '#0284C7',
    background: '#F0F9FF', surface: '#FFFFFF', text: '#0F172A', heroGradient: '#0C4A6E',
  },
  esmeralda: {
    primary: '#065F46', secondary: '#047857', accent: '#10B981', button: '#047857',
    background: '#ECFDF5', surface: '#FFFFFF', text: '#0F172A', heroGradient: '#065F46',
  },
  violeta: {
    primary: '#5B21B6', secondary: '#7C3AED', accent: '#A855F7', button: '#7C3AED',
    background: '#FAF5FF', surface: '#FFFFFF', text: '#111827', heroGradient: '#5B21B6',
  },
  grafito: {
    primary: '#111827', secondary: '#374151', accent: '#64748B', button: '#111827',
    background: '#F3F4F6', surface: '#FFFFFF', text: '#111827', heroGradient: '#111827',
  },
}

const INITIAL_SERVICES: FreeProfileService[] = [
  {
    id: 'demo-service-1',
    title: 'Asesoría personalizada',
    description: 'Una solución pensada para lo que necesitas.',
    image: '/assets/free-starter/servicios-profesionales/servicios-profesionales-03.webp',
    iconKey: 'handshake',
  },
  {
    id: 'demo-service-2',
    title: 'Servicio profesional',
    description: 'Atención clara, rápida y profesional.',
    image: '/assets/free-starter/servicios-profesionales/servicios-profesionales-04.webp',
    iconKey: 'chart-line',
  },
]

const INITIAL_FORM: DemoForm = {
  name: 'Laura Gómez',
  role: 'Profesional independiente',
  bio: 'Ayudo a mis clientes con soluciones prácticas, atención personalizada y un servicio pensado para sus necesidades.',
  whatsapp: '18090000000',
  instagram: 'kawvolink',
  layout: 'impacto',
  palette: 'oceano',
  services: INITIAL_SERVICES,
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, '').slice(0, 15)
}

function normalizeInstagram(value: string) {
  return value
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^@/, '')
    .replace(/\/$/, '')
    .slice(0, 40)
}

export default function KawvoLinkDemo() {
  const [stage, setStage] = useState<DemoStage>('welcome')
  const [form, setForm] = useState<DemoForm>(INITIAL_FORM)
  const [portrait, setPortrait] = useState(DEFAULT_PORTRAIT)
  const [uploadedPortrait, setUploadedPortrait] = useState<string | null>(null)
  const [serviceUploads, setServiceUploads] = useState<Record<string, string>>({})
  const fileRef = useRef<HTMLInputElement>(null)
  const serviceFileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    document.body.classList.add('kawvo-demo-body')
    return () => document.body.classList.remove('kawvo-demo-body')
  }, [])

  useEffect(() => () => {
    if (uploadedPortrait) URL.revokeObjectURL(uploadedPortrait)
    Object.values(serviceUploads).forEach((url) => URL.revokeObjectURL(url))
  }, [uploadedPortrait, serviceUploads])

  const profile = useMemo<FreeProfileData>(() => {
    const instagram = normalizeInstagram(form.instagram)
    const phone = normalizePhone(form.whatsapp)
    return {
      id: 'demo-local-only',
      slug: 'demo',
      name: form.name.trim() || 'Tu nombre',
      role: form.role.trim() || 'Tu puesto / cargo',
      personalBadge: 'Demo Kawvo Link',
      aboutTitle: 'Sobre mí',
      portfolioTitle: 'Mis trabajos',
      servicesTitle: 'Mis servicios',
      servicesDescription: 'Una muestra de lo que puedo hacer por ti.',
      bio: form.bio.trim() || 'Aquí aparecerá una descripción breve sobre ti o tu negocio.',
      phone,
      whatsappGreetingName: form.name.trim() || 'Hola',
      whatsappCtaLabel: 'Hablar por WhatsApp',
      instagram,
      location: DEFAULT_LOCATION,
      portrait,
      hero: DEFAULT_HERO,
      heroPositionX: 50,
      heroPositionY: 50,
      heroZoom: 1,
      category: 'Demo',
      vcardFileName: 'kawvo-demo.vcf',
      quickActions: [
        ...(phone ? [{ type: 'call' as const, label: 'Llamar', url: `tel:+${phone}` }] : []),
        ...(instagram ? [{ type: 'instagram' as const, label: 'Instagram', url: `https://instagram.com/${instagram}` }] : []),
        { type: 'location' as const, label: 'Ubicación', url: DEFAULT_MAP_URL },
      ],
      services: form.services,
      portfolio: [],
      customLinks: [],
    }
  }, [form, portrait])

  function update<K extends keyof DemoForm>(key: K, value: DemoForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function updateService(index: number, key: 'title' | 'description', value: string) {
    setForm((current) => ({
      ...current,
      services: current.services.map((service, currentIndex) =>
        currentIndex === index ? { ...service, [key]: value } : service,
      ),
    }))
  }

  function addService() {
    setForm((current) => {
      if (current.services.length >= 3) return current
      return {
        ...current,
        services: [
          ...current.services,
          {
            id: `demo-service-${current.services.length + 1}`,
            title: 'Nuevo servicio',
            description: 'Describe brevemente este servicio.',
            image: '/assets/free-starter/servicios-profesionales/servicios-profesionales-05.webp',
            iconKey: 'handshake',
          },
        ],
      }
    })
  }

  function removeService(index: number) {
    setForm((current) => {
      const service = current.services[index]
      if (service && serviceUploads[service.id]) {
        URL.revokeObjectURL(serviceUploads[service.id])
        setServiceUploads((uploads) => {
          const next = { ...uploads }
          delete next[service.id]
          return next
        })
      }
      return { ...current, services: current.services.filter((_, i) => i !== index) }
    })
  }

  function choosePhoto(file?: File) {
    if (!file || !file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) return
    if (uploadedPortrait) URL.revokeObjectURL(uploadedPortrait)
    const url = URL.createObjectURL(file)
    setUploadedPortrait(url)
    setPortrait(url)
  }

  function chooseServicePhoto(serviceId: string, file?: File) {
    if (!file || !file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) return
    const previousUrl = serviceUploads[serviceId]
    if (previousUrl) URL.revokeObjectURL(previousUrl)
    const url = URL.createObjectURL(file)
    setServiceUploads((current) => ({ ...current, [serviceId]: url }))
    setForm((current) => ({
      ...current,
      services: current.services.map((service) =>
        service.id === serviceId ? { ...service, image: url } : service,
      ),
    }))
  }

  function resetDemo() {
    if (uploadedPortrait) URL.revokeObjectURL(uploadedPortrait)
    Object.values(serviceUploads).forEach((url) => URL.revokeObjectURL(url))
    setUploadedPortrait(null)
    setServiceUploads({})
    setPortrait(DEFAULT_PORTRAIT)
    setForm(INITIAL_FORM)
    setStage('welcome')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const preview = (
    <div className="kawvo-demo-preview" aria-label="Vista previa del perfil demo">
      <IntapLinkGratisProfile profile={profile} layout={form.layout} colors={PALETTES[form.palette]} />
    </div>
  )

  if (stage === 'welcome') {
    return (
      <main className="kawvo-demo-page">
        <section className="kawvo-demo-intro">
          <span className="kawvo-demo-pill">DEMO INTERACTIVO</span>
          <h1>Mira cómo podría verse tu perfil digital.</h1>
          <p>Esta demostración es temporal. No crea cuentas, no publica perfiles y no guarda tus datos.</p>
        </section>
        {preview}
        <div className="kawvo-demo-sticky-cta">
          <button type="button" onClick={() => setStage('edit')}>Pruébalo con tus datos</button>
          <small>Lo que cambies existe solamente en este dispositivo mientras mantengas abierta la demo.</small>
        </div>
      </main>
    )
  }

  if (stage === 'result') {
    return (
      <main className="kawvo-demo-page kawvo-demo-result-page">
        <section className="kawvo-demo-result-copy">
          <span className="kawvo-demo-success">✓</span>
          <p className="kawvo-demo-eyebrow">KAWVO LINK</p>
          <h1>Así se vería tu Perfil Digital.</h1>
          <p>Esta es una demostración. Para crear y conservar tu perfil real debes adquirir un artículo de contacto Kawvo.</p>
        </section>
        {preview}
        <section className="kawvo-demo-purchase">
          <p>Tarjeta · Llavero · Ping · Pulsera · Estación</p>
          <a href={COMMERCIAL_URL}>Quiero mi Perfil Digital</a>
          <button type="button" onClick={() => setStage('edit')}>Seguir probando</button>
          <button type="button" className="kawvo-demo-reset" onClick={resetDemo}>Reiniciar demo</button>
        </section>
      </main>
    )
  }

  return (
    <main className="kawvo-demo-editor-page">
      <header className="kawvo-demo-editor-header">
        <div>
          <span>DEMO KAWVO LINK</span>
          <strong>Personalízalo en vivo</strong>
        </div>
        <button type="button" onClick={resetDemo} aria-label="Cerrar demostración">×</button>
      </header>

      <div className="kawvo-demo-editor-grid">
        <section className="kawvo-demo-form">
          <div className="kawvo-demo-note">Nada de esto se guarda. La información desaparece al cerrar o reiniciar la demostración.</div>

          <label>
            <span>Tu foto</span>
            <div className="kawvo-demo-photo-row">
              <img src={portrait} alt="Vista previa de tu foto" />
              <button type="button" onClick={() => fileRef.current?.click()}>Cambiar foto</button>
              <input ref={fileRef} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => choosePhoto(event.target.files?.[0])} />
            </div>
          </label>

          <label><span>Nombre o marca</span><input maxLength={60} value={form.name} onChange={(event) => update('name', event.target.value)} /></label>
          <label><span>Puesto / Cargo</span><input maxLength={60} value={form.role} onChange={(event) => update('role', event.target.value)} /></label>
          <label><span>Descripción breve</span><textarea rows={4} maxLength={240} value={form.bio} onChange={(event) => update('bio', event.target.value)} /></label>
          <label><span>WhatsApp</span><input inputMode="tel" maxLength={20} value={form.whatsapp} onChange={(event) => update('whatsapp', event.target.value)} /></label>
          <label><span>Instagram</span><input maxLength={50} value={form.instagram} onChange={(event) => update('instagram', event.target.value)} /></label>

          <fieldset>
            <legend>Plantilla</legend>
            <div className="kawvo-demo-choice-row">
              {(['impacto', 'personal', 'esencial'] as FreeProfileLayoutId[]).map((layout) => (
                <button key={layout} type="button" className={form.layout === layout ? 'is-active' : ''} onClick={() => update('layout', layout)}>{layout[0].toUpperCase() + layout.slice(1)}</button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Color</legend>
            <div className="kawvo-demo-palette-row">
              {(Object.keys(PALETTES) as Array<keyof typeof PALETTES>).map((palette) => (
                <button key={palette} type="button" className={form.palette === palette ? 'is-active' : ''} onClick={() => update('palette', palette)} aria-label={`Usar paleta ${palette}`}>
                  <span style={{ background: PALETTES[palette].primary }} />
                  {palette}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <div className="kawvo-demo-services-head"><legend>Servicios</legend><button type="button" onClick={addService} disabled={form.services.length >= 3}>+ Agregar</button></div>
            <div className="kawvo-demo-services-list">
              {form.services.map((service, index) => (
                <article key={service.id}>
                  <div className="kawvo-demo-service-top"><strong>Servicio {index + 1}</strong>{form.services.length > 1 && <button type="button" onClick={() => removeService(index)}>Quitar</button>}</div>
                  <div className="kawvo-demo-photo-row">
                    {service.image && <img src={service.image} alt={`Imagen de ${service.title}`} />}
                    <button type="button" onClick={() => serviceFileRefs.current[service.id]?.click()}>Cambiar imagen</button>
                    <input
                      ref={(node) => { serviceFileRefs.current[service.id] = node }}
                      hidden
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) => chooseServicePhoto(service.id, event.target.files?.[0])}
                    />
                  </div>
                  <input aria-label={`Título servicio ${index + 1}`} maxLength={60} value={service.title} onChange={(event) => updateService(index, 'title', event.target.value)} />
                  <textarea aria-label={`Descripción servicio ${index + 1}`} rows={2} maxLength={120} value={service.description} onChange={(event) => updateService(index, 'description', event.target.value)} />
                </article>
              ))}
            </div>
          </fieldset>

          <button type="button" className="kawvo-demo-finish" onClick={() => { setStage('result'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Ver cómo quedó</button>
        </section>

        <aside className="kawvo-demo-live">
          <div className="kawvo-demo-live-label"><strong>Vista en vivo</strong><span>Los cambios aparecen al instante</span></div>
          {preview}
        </aside>
      </div>
    </main>
  )
}
