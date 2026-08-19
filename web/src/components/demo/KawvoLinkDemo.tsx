import { useEffect, useMemo, useRef, useState } from 'react'
import IntapLinkGratisProfile from '../free-profile/IntapLinkGratisProfile'
import type {
  FreeProfileAppearanceColors,
  FreeProfileData,
  FreeProfileLayoutId,
  FreeProfilePortfolioItem,
  FreeProfileService,
} from '../free-profile/IntapLinkGratis.types'
import './KawvoLinkDemo.css'

type DemoStage = 'welcome' | 'sector' | 'edit' | 'result'
type DemoSectorKey = 'professional' | 'wellness' | 'food' | 'retail' | 'creative' | 'business'

type DemoForm = {
  name: string
  role: string
  bio: string
  whatsapp: string
  instagram: string
  layout: FreeProfileLayoutId
  palette: keyof typeof PALETTES
  services: FreeProfileService[]
  portfolio: FreeProfilePortfolioItem[]
}

type DemoPreset = {
  label: string
  hint: string
  cover: string
  portrait: string
  hero: string
  form: DemoForm
}

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

function demoServices(folder: string, items: Array<[string, string]>): FreeProfileService[] {
  return items.map(([title, description], index) => ({
    id: `demo-service-${index + 1}`,
    title,
    description,
    image: `/assets/free-starter/${folder}/${folder}-${String(index + 3).padStart(2, '0')}.webp`,
    iconKey: index === 1 ? 'chart-line' : 'handshake',
  }))
}

function demoPortfolio(folder: string): FreeProfilePortfolioItem[] {
  return [2, 3, 4, 5, 6].map((number, index) => ({
    id: `demo-portfolio-${index + 1}`,
    title: `Trabajo ${index + 1}`,
    description: 'Ejemplo visual de trabajos, proyectos o productos.',
    image: `/assets/free-starter/${folder}/${folder}-${String(number).padStart(2, '0')}.webp`,
  }))
}

const PRESETS: Record<DemoSectorKey, DemoPreset> = {
  professional: {
    label: 'Profesional / Servicios',
    hint: 'Asesoría, técnicos, consultores y freelancers',
    cover: '/assets/free-starter/servicios-profesionales/servicios-profesionales-01.webp',
    portrait: '/assets/free-starter/servicios-profesionales/servicios-profesionales-01.webp',
    hero: '/assets/free-starter/servicios-profesionales/servicios-profesionales-01.webp',
    form: {
      name: 'Laura Gómez', role: 'Profesional independiente',
      bio: 'Ayudo a mis clientes con soluciones prácticas, atención personalizada y un servicio pensado para sus necesidades.',
      whatsapp: '18090000000', instagram: 'kawvolink', layout: 'impacto', palette: 'oceano',
      services: demoServices('servicios-profesionales', [
        ['Asesoría personalizada', 'Una solución pensada para lo que necesitas.'],
        ['Consultoría profesional', 'Acompañamiento claro para tomar mejores decisiones.'],
        ['Atención especializada', 'Un servicio directo, profesional y cercano.'],
      ]),
      portfolio: demoPortfolio('servicios-profesionales'),
    },
  },
  wellness: {
    label: 'Belleza, Salud y Bienestar',
    hint: 'Salones, estética, terapeutas y fitness',
    cover: '/assets/free-starter/salud-bienestar/salud-bienestar-01.webp',
    portrait: '/assets/free-starter/salud-bienestar/salud-bienestar-02.webp',
    hero: '/assets/free-starter/salud-bienestar/salud-bienestar-01.webp',
    form: {
      name: 'Carla Wellness', role: 'Especialista en bienestar',
      bio: 'Creo experiencias de cuidado personal pensadas para que te sientas bien, con atención cercana y profesional.',
      whatsapp: '18090000000', instagram: 'kawvolink', layout: 'impacto', palette: 'esmeralda',
      services: demoServices('salud-bienestar', [
        ['Cuidado personalizado', 'Atención adaptada a tus objetivos y necesidades.'],
        ['Tratamientos', 'Opciones de bienestar con acompañamiento profesional.'],
        ['Reserva tu cita', 'Coordina tu próxima atención de forma sencilla.'],
      ]),
      portfolio: demoPortfolio('salud-bienestar'),
    },
  },
  food: {
    label: 'Comida y Restaurantes',
    hint: 'Restaurantes, cafeterías, catering y repostería',
    cover: '/assets/free-starter/gastronomia-alimentos/gastronomia-alimentos-01.webp',
    portrait: '/assets/free-starter/gastronomia-alimentos/gastronomia-alimentos-02.webp',
    hero: '/assets/free-starter/gastronomia-alimentos/gastronomia-alimentos-01.webp',
    form: {
      name: 'Sabor Local', role: 'Cocina & experiencias',
      bio: 'Sabores preparados con dedicación para compartir momentos especiales, pedidos, eventos y experiencias gastronómicas.',
      whatsapp: '18090000000', instagram: 'kawvolink', layout: 'impacto', palette: 'grafito',
      services: demoServices('gastronomia-alimentos', [
        ['Nuestro menú', 'Descubre una selección preparada para cada ocasión.'],
        ['Pedidos', 'Haz tu pedido de forma rápida y sencilla.'],
        ['Eventos y catering', 'Opciones especiales para reuniones y celebraciones.'],
      ]),
      portfolio: demoPortfolio('gastronomia-alimentos'),
    },
  },
  retail: {
    label: 'Tiendas y Ventas',
    hint: 'Moda, accesorios, retail y tiendas online',
    cover: '/assets/free-starter/comercio-retail-tiendas-virtuales/comercio-retail-tiendas-virtuales-01.webp',
    portrait: '/assets/free-starter/comercio-retail-tiendas-virtuales/comercio-retail-tiendas-virtuales-02.webp',
    hero: '/assets/free-starter/comercio-retail-tiendas-virtuales/comercio-retail-tiendas-virtuales-01.webp',
    form: {
      name: 'Nova Store', role: 'Tienda & ventas',
      bio: 'Encuentra productos seleccionados, novedades y atención directa para ayudarte a elegir lo que necesitas.',
      whatsapp: '18090000000', instagram: 'kawvolink', layout: 'impacto', palette: 'violeta',
      services: demoServices('comercio-retail-tiendas-virtuales', [
        ['Novedades', 'Conoce lo más reciente de nuestra tienda.'],
        ['Pedidos', 'Consulta disponibilidad y realiza tu pedido.'],
        ['Atención personalizada', 'Te ayudamos a encontrar la mejor opción.'],
      ]),
      portfolio: demoPortfolio('comercio-retail-tiendas-virtuales'),
    },
  },
  creative: {
    label: 'Creativos / Manualidades',
    hint: 'Diseño, fotografía, arte y productos hechos a mano',
    cover: '/assets/free-starter/arte-diseno-creatividad/arte-diseno-creatividad-01.webp',
    portrait: '/assets/free-starter/arte-diseno-creatividad/arte-diseno-creatividad-02.webp',
    hero: '/assets/free-starter/arte-diseno-creatividad/arte-diseno-creatividad-01.webp',
    form: {
      name: 'Luna Creativa', role: 'Diseño & creación',
      bio: 'Transformo ideas en piezas visuales y creaciones personalizadas con identidad, detalle y un toque único.',
      whatsapp: '18090000000', instagram: 'kawvolink', layout: 'personal', palette: 'violeta',
      services: demoServices('arte-diseno-creatividad', [
        ['Diseño personalizado', 'Creamos una propuesta pensada especialmente para ti.'],
        ['Proyectos creativos', 'Ideas visuales desarrolladas de principio a fin.'],
        ['Creaciones especiales', 'Piezas únicas para regalos, marcas y ocasiones.'],
      ]),
      portfolio: demoPortfolio('arte-diseno-creatividad'),
    },
  },
  business: {
    label: 'Empresa / Negocio',
    hint: 'Construcción, inmobiliaria, logística y multiservicios',
    cover: '/assets/free-starter/servicios-generales/servicios-generales-01.webp',
    portrait: '/assets/free-starter/servicios-generales/servicios-generales-02.webp',
    hero: '/assets/free-starter/servicios-generales/servicios-generales-01.webp',
    form: {
      name: 'Grupo Nova', role: 'Soluciones empresariales',
      bio: 'Ofrecemos soluciones confiables para empresas y clientes que buscan respuesta rápida, atención clara y resultados.',
      whatsapp: '18090000000', instagram: 'kawvolink', layout: 'impacto', palette: 'oceano',
      services: demoServices('servicios-generales', [
        ['Soluciones', 'Servicios adaptados a las necesidades de cada cliente.'],
        ['Soporte y atención', 'Respuesta directa para solicitudes y requerimientos.'],
        ['Cotizaciones', 'Recibe información y una propuesta para tu necesidad.'],
      ]),
      portfolio: demoPortfolio('servicios-generales'),
    },
  },
}

const DEFAULT_PRESET = PRESETS.professional

function normalizePhone(value: string) {
  return value.replace(/\D/g, '').slice(0, 15)
}

function normalizeInstagram(value: string) {
  return value.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/\/$/, '').slice(0, 40)
}

export default function KawvoLinkDemo() {
  const [stage, setStage] = useState<DemoStage>('sector')
  const [form, setForm] = useState<DemoForm>(DEFAULT_PRESET.form)
  const [portrait, setPortrait] = useState(DEFAULT_PRESET.portrait)
  const [hero, setHero] = useState(DEFAULT_PRESET.hero)
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
      id: 'demo-local-only', slug: 'demo',
      name: form.name.trim() || 'Tu nombre', role: form.role.trim() || 'Tu puesto / cargo',
      personalBadge: 'Demo Kawvo Link', aboutTitle: 'Sobre mí', portfolioTitle: 'Mis trabajos',
      servicesTitle: 'Mis servicios', servicesDescription: 'Una muestra de lo que puedo hacer por ti.',
      bio: form.bio.trim() || 'Aquí aparecerá una descripción breve sobre ti o tu negocio.', phone,
      whatsappGreetingName: form.name.trim() || 'Hola', whatsappCtaLabel: 'Hablar por WhatsApp', instagram,
      location: DEFAULT_LOCATION, portrait, hero, heroPositionX: 50, heroPositionY: 50, heroZoom: 1,
      category: 'Demo', vcardFileName: 'kawvo-demo.vcf',
      quickActions: [
        ...(phone ? [{ type: 'call' as const, label: 'Llamar', url: `tel:+${phone}` }] : []),
        ...(instagram ? [{ type: 'instagram' as const, label: 'Instagram', url: `https://instagram.com/${instagram}` }] : []),
        { type: 'location' as const, label: 'Ubicación', url: DEFAULT_MAP_URL },
      ],
      services: form.services, portfolio: form.portfolio, customLinks: [],
    }
  }, [form, portrait, hero])

  function update<K extends keyof DemoForm>(key: K, value: DemoForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function updateService(index: number, key: 'title' | 'description', value: string) {
    setForm((current) => ({ ...current, services: current.services.map((service, currentIndex) => currentIndex === index ? { ...service, [key]: value } : service) }))
  }

  function clearTemporaryImages() {
    if (uploadedPortrait) URL.revokeObjectURL(uploadedPortrait)
    Object.values(serviceUploads).forEach((url) => URL.revokeObjectURL(url))
    setUploadedPortrait(null)
    setServiceUploads({})
  }

  function applyPreset(key: DemoSectorKey) {
    clearTemporaryImages()
    const preset = PRESETS[key]
    setForm(preset.form)
    setPortrait(preset.portrait)
    setHero(preset.hero)
    setStage('welcome')
    window.scrollTo({ top: 0, behavior: 'smooth' })
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
    setForm((current) => ({ ...current, services: current.services.map((service) => service.id === serviceId ? { ...service, image: url } : service) }))
  }

  function resetDemo() {
    clearTemporaryImages()
    setPortrait(DEFAULT_PRESET.portrait)
    setHero(DEFAULT_PRESET.hero)
    setForm(DEFAULT_PRESET.form)
    setStage('sector')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function blockDemoFooterNavigation(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement
    if (target.closest('.ilx-footer a')) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  const preview = (
    <div className="kawvo-demo-preview" aria-label="Vista previa del perfil demo" onClickCapture={blockDemoFooterNavigation}>
      <style>{`.kawvo-demo-preview .ilx-footer a { pointer-events: none; cursor: default; opacity: .72; }`}</style>
      <IntapLinkGratisProfile profile={profile} layout={form.layout} colors={PALETTES[form.palette]} />
    </div>
  )

  if (stage === 'welcome') {
    return (
      <main className="kawvo-demo-page">
        <button
          type="button"
          onClick={() => setStage('sector')}
          style={{
            display: 'block',
            margin: '0 auto',
            padding: '14px 16px 2px',
            border: 0,
            background: 'transparent',
            color: '#64748b',
            fontSize: 13,
            fontWeight: 600,
            textAlign: 'center',
            cursor: 'pointer',
          }}
        >
          Cambiar profesión
        </button>
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

  if (stage === 'sector') {
    return (
      <main className="kawvo-demo-page kawvo-demo-sector-page">
        <section className="kawvo-demo-sector-shell">
          <span className="kawvo-demo-pill">ELIGE UN EJEMPLO</span>
          <h1>¿Cuál se parece más a ti o a tu negocio?</h1>
          <p>Elige una opción y cargaremos un ejemplo para que puedas personalizarlo en segundos.</p>
          <div className="kawvo-demo-sector-grid">
            {(Object.keys(PRESETS) as DemoSectorKey[]).map((key) => {
              const preset = PRESETS[key]
              return (
                <button key={key} type="button" className="kawvo-demo-sector-card" onClick={() => applyPreset(key)}>
                  <img src={preset.cover} alt="" />
                  <span><strong>{preset.label}</strong><small>{preset.hint}</small></span>
                </button>
              )
            })}
          </div>
          <button type="button" className="kawvo-demo-sector-skip" onClick={() => applyPreset('professional')}>Probaré con cualquiera</button>
          <small className="kawvo-demo-sector-note">No es un registro. Elegiremos un ejemplo para que empieces más rápido.</small>
        </section>
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
          <button type="button" className="kawvo-demo-reset" onClick={() => setStage('sector')}>Cambiar la profesión</button>
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
        <div><span>DEMO KAWVO LINK</span><strong>Personalízalo en vivo</strong></div>
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
                  <span style={{ background: PALETTES[palette].primary }} />{palette}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <div className="kawvo-demo-services-head"><legend>Servicios</legend></div>
            <div className="kawvo-demo-services-list">
              {form.services.map((service, index) => (
                <article key={service.id}>
                  <div className="kawvo-demo-service-top"><strong>Servicio {index + 1}</strong></div>
                  <div className="kawvo-demo-photo-row">
                    {service.image && <img src={service.image} alt={`Imagen de ${service.title}`} />}
                    <button type="button" onClick={() => serviceFileRefs.current[service.id]?.click()}>Cambiar imagen</button>
                    <input ref={(node) => { serviceFileRefs.current[service.id] = node }} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => chooseServicePhoto(service.id, event.target.files?.[0])} />
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