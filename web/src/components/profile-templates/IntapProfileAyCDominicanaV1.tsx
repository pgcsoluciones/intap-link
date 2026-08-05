import { useMemo, useState, type ReactNode } from 'react'
import {
  FaAddressCard,
  FaArrowRight,
  FaCheckCircle,
  FaChevronDown,
  FaClock,
  FaCogs,
  FaCut,
  FaEnvelope,
  FaFacebookF,
  FaGlobe,
  FaIndustry,
  FaInstagram,
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaProjectDiagram,
  FaShareAlt,
  FaTimes,
  FaTools,
  FaWhatsapp,
  FaWrench,
} from 'react-icons/fa'
import type { IntapProfileV2Profile } from './IntapProfileV2'
import './IntapProfileAyCDominicanaV1.css'

type ServiceItem = {
  id: string
  title: string
  description: string
  bullets?: string[]
  image?: string
}

type ProjectItem = {
  title: string
  category: string
  image?: string
  description?: string
}

type FaqItem = {
  question: string
  answer: string
}

const FALLBACK_SERVICES: ServiceItem[] = [
  {
    id: 'mecanizados',
    title: 'Metalmecánica y mecanizados',
    description: 'Fabricación y reparación de piezas industriales con procesos convencionales y CNC.',
    bullets: ['Tornos CNC y convencionales', 'Fresadoras CNC', 'Rectificado', 'Moldes y troqueles'],
    image: '/assets/aycdom/services/mecanizados-01.webp',
  },
  {
    id: 'laser',
    title: 'Corte láser CNC',
    description: 'Corte de precisión para planchas, tubos, piezas y componentes industriales.',
    bullets: ['Acero inoxidable', 'Acero al carbono', 'Aluminio', 'Bronce y cobre'],
    image: '/assets/aycdom/services/corte-laser-01.webp',
  },
  {
    id: 'automatizacion',
    title: 'Automatización industrial',
    description: 'Integración de controles y equipos para mejorar productividad, seguridad y continuidad operativa.',
    bullets: ['Control de procesos', 'Automatización de máquinas', 'Sistemas neumáticos', 'Controles de movimiento'],
    image: '/assets/aycdom/services/automatizacion-01.webp',
  },
  {
    id: 'conveyors',
    title: 'Conveyors y transporte',
    description: 'Sistemas de transporte diseñados para el espacio, producto y flujo de cada industria.',
    bullets: ['Bandas rectas', 'Conveyors curvos', 'Sistemas de rodillos', 'Bandas modulares'],
    image: '/assets/aycdom/services/conveyors-01.webp',
  },
  {
    id: 'equipos',
    title: 'Máquinas y equipos a medida',
    description: 'Soluciones especiales cuando un equipo estándar no responde a la necesidad del proceso.',
    bullets: ['Máquinas especiales', 'Fixtures', 'Estructuras', 'Modificación de equipos'],
    image: '/assets/aycdom/services/equipos-01.webp',
  },
  {
    id: 'soldadura',
    title: 'Soldaduras especializadas',
    description: 'Fabricación y reparación en distintos materiales y niveles de exigencia industrial.',
    bullets: ['Aluminio', 'Bronce', 'Argón', 'Alta resistencia'],
    image: '/assets/aycdom/services/soldadura-01.webp',
  },
]

const FALLBACK_PROJECTS: ProjectItem[] = [
  {
    title: 'Sistema de transporte industrial',
    category: 'Conveyors',
    image: '/assets/aycdom/services/conveyors-01.webp',
    description: 'Solución de transporte adaptada al flujo y distribución de planta.',
  },
  {
    title: 'Piezas mecanizadas de precisión',
    category: 'Mecanizados',
    image: '/assets/aycdom/services/mecanizados-01.webp',
    description: 'Fabricación de componentes según muestra, plano o especificación técnica.',
  },
  {
    title: 'Integración de proceso',
    category: 'Automatización',
    image: '/assets/aycdom/services/automatizacion-01.webp',
    description: 'Mejora e integración de equipos para reducir intervención manual.',
  },
]

const FALLBACK_FAQS: FaqItem[] = [
  {
    question: '¿Realizan trabajos personalizados?',
    answer: 'Sí. Cada proyecto se evalúa según la necesidad, el material, el proceso y las condiciones de operación.',
  },
  {
    question: '¿Pueden fabricar una pieza a partir de una muestra?',
    answer: 'Depende del estado de la muestra, las tolerancias requeridas y el material. El equipo técnico debe evaluarla antes de confirmar.',
  },
  {
    question: '¿Trabajan solamente proyectos grandes?',
    answer: 'No. A&C puede atender desde una pieza o reparación puntual hasta una máquina o línea de proceso completa.',
  },
  {
    question: '¿Realizan instalación y puesta en marcha?',
    answer: 'Sí, cuando el alcance del proyecto lo requiere. La instalación y puesta en marcha se definen dentro de la propuesta técnica.',
  },
]

function pick(...values: Array<string | undefined | null>) {
  for (const value of values) {
    const text = value?.trim()
    if (text) return text
  }
  return ''
}

function cleanPhone(value: string) {
  return value.replace(/\D/g, '')
}

function normalizeHttp(value: string) {
  if (!value) return '#'
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

function safeJsonArray<T>(value: string | undefined, fallback: T[]): T[] {
  if (!value) return fallback
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

function serviceIcon(id: string): ReactNode {
  const key = id.toLowerCase()
  if (key.includes('laser')) return <FaCut />
  if (key.includes('automat')) return <FaCogs />
  if (key.includes('conveyor') || key.includes('transporte')) return <FaProjectDiagram />
  if (key.includes('equipo') || key.includes('maquina')) return <FaIndustry />
  if (key.includes('sold')) return <FaWrench />
  return <FaTools />
}

function AssetImage({ src, alt, className }: { src?: string; alt: string; className: string }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) return <div className={`${className} ayc-media-fallback`} role="img" aria-label={alt} />
  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} loading="lazy" />
}

function escapeVCard(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

export default function IntapProfileAyCDominicanaV1({ profile }: { profile: IntapProfileV2Profile }) {
  const td = profile.templateData ?? {}
  const [activeService, setActiveService] = useState<ServiceItem | null>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const [shareLabel, setShareLabel] = useState('Compartir')

  const name = pick(profile.companyName, profile.company_name, profile.name, td.company_name, 'A&C Dominicana, S.R.L.')
  const tagline = pick(td.tagline, 'Metalmecánica · Automatización Industrial')
  const heroTitle = pick(td.mobile_headline, td.headline, 'Soluciones industriales llave en mano')
  const heroCopy = pick(
    td.mobile_hero_copy,
    'Diseño, fabricación e integración para optimizar sus procesos industriales.',
  )
  const about = pick(
    profile.companyAbout,
    profile.company_about,
    td.about,
    'Integramos diseño técnico, mecanizado, soldadura, fabricación de equipos, automatización e instalación dentro de una misma solución. Podemos atender desde una pieza puntual hasta una línea de proceso completa.',
  )

  const phone = pick(profile.phone, td.phone, '809-476-7325')
  const whatsapp = pick(profile.whatsapp, profile.whatsappNumber, profile.whatsapp_number, td.whatsapp, '18094767325')
  const email = pick(profile.email, td.email, 'ventas@aycdominicana.com')
  const website = pick(profile.website, td.website, 'https://aycdominicana.com')
  const address = pick(profile.address, td.address, 'Calle Juan José Duarte #73, Ensanche La Fe, Santo Domingo')
  const hours = pick(td.hours, 'Lunes a viernes, 8:00 a. m. a 5:00 p. m. · Sábados, 8:00 a. m. a 12:00 p. m.')
  const mapUrl = pick(profile.mapUrl, profile.map_url, td.map_url, `https://maps.google.com/?q=${encodeURIComponent(address)}`)
  const mapEmbedUrl = pick(td.map_embed_url, `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`)
  const instagramUrl = pick(td.instagram_url, 'https://www.instagram.com/aycdominicana/')
  const facebookUrl = pick(td.facebook_url, 'https://www.facebook.com/aycdominicana/')

  const logo = pick(profile.companyLogo, profile.company_logo, td.logo_url, '/assets/aycdom/logo/logo-ayc-principal.png')
  const heroImage = pick(td.hero_image, '/assets/aycdom/hero/hero-ayc-01.webp')

  const services = useMemo(() => safeJsonArray<ServiceItem>(td.services_json, FALLBACK_SERVICES), [td.services_json])
  const projects = useMemo(() => safeJsonArray<ProjectItem>(td.projects_json, FALLBACK_PROJECTS), [td.projects_json])
  const faqs = useMemo(() => safeJsonArray<FaqItem>(td.faqs_json, FALLBACK_FAQS), [td.faqs_json])

  const waMessage = pick(td.whatsapp_message, 'Hola, vi su perfil en INTAP LINK y quiero solicitar información sobre una solución industrial.')
  const waHref = `https://wa.me/${cleanPhone(whatsapp)}?text=${encodeURIComponent(waMessage)}`
  const websiteHref = normalizeHttp(website)
  const websiteLabel = website.replace(/^https?:\/\//i, '').replace(/\/$/, '')

  const downloadVCard = () => {
    const card = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${escapeVCard(name)}`,
      `ORG:${escapeVCard(name)}`,
      `TEL;TYPE=WORK,VOICE:${cleanPhone(phone)}`,
      `TEL;TYPE=CELL:${cleanPhone(whatsapp)}`,
      `EMAIL;TYPE=WORK:${email}`,
      `URL:${websiteHref}`,
      `ADR;TYPE=WORK:;;${escapeVCard(address)};;;;`,
      'END:VCARD',
    ].join('\r\n')

    const blob = new Blob([card], { type: 'text/vcard;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'ayc-dominicana.vcf'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  const shareProfile = async () => {
    const shareData = {
      title: name,
      text: heroTitle,
      url: window.location.href,
    }

    try {
      if (navigator.share) {
        await navigator.share(shareData)
      } else {
        await navigator.clipboard.writeText(window.location.href)
        setShareLabel('Enlace copiado')
        window.setTimeout(() => setShareLabel('Compartir'), 1800)
      }
    } catch {
      // El usuario puede cancelar el diálogo nativo de compartir.
    }
  }

  const quickActions = [
    { label: 'Llamar', href: `tel:${cleanPhone(phone)}`, icon: <FaPhoneAlt /> },
    { label: 'WhatsApp', href: waHref, icon: <FaWhatsapp />, featured: true },
    { label: 'Correo', href: `mailto:${email}`, icon: <FaEnvelope /> },
    { label: 'Ubicación', href: mapUrl, icon: <FaMapMarkerAlt /> },
  ]

  const contactRows = [
    { label: 'Teléfono', value: phone, href: `tel:${cleanPhone(phone)}`, icon: <FaPhoneAlt /> },
    { label: 'WhatsApp', value: phone, href: waHref, icon: <FaWhatsapp /> },
    { label: 'Correo electrónico', value: email, href: `mailto:${email}`, icon: <FaEnvelope /> },
    { label: 'Sitio web', value: websiteLabel, href: websiteHref, icon: <FaGlobe /> },
    { label: 'Dirección', value: address, href: mapUrl, icon: <FaMapMarkerAlt /> },
    { label: 'Horario', value: hours, href: '', icon: <FaClock /> },
  ]

  return (
    <main className="ayc-mobile-page">
      <div className="ayc-mobile-shell">
        <section className="ayc-mobile-hero">
          <AssetImage src={heroImage} alt="Proceso industrial de A&C Dominicana" className="ayc-mobile-hero-image" />
          <div className="ayc-mobile-hero-overlay" />
          <div className="ayc-mobile-hero-top">
            <div className="ayc-mobile-logo-card">
              <AssetImage src={logo} alt={name} className="ayc-mobile-logo" />
            </div>
            <button type="button" className="ayc-share-button" onClick={shareProfile} aria-label="Compartir perfil">
              <FaShareAlt />
            </button>
          </div>
          <div className="ayc-mobile-hero-copy">
            <span className="ayc-mobile-kicker">{tagline}</span>
            <h1>{heroTitle}</h1>
            <p>{heroCopy}</p>
            <div className="ayc-mobile-badges">
              <span><FaCheckCircle /> Más de 30 años de experiencia</span>
              <span><FaIndustry /> De una pieza a una línea completa</span>
            </div>
          </div>
        </section>

        <nav className="ayc-quick-actions" aria-label="Acciones rápidas">
          {quickActions.map((action) => (
            <a
              key={action.label}
              href={action.href}
              target={action.href.startsWith('http') ? '_blank' : undefined}
              rel={action.href.startsWith('http') ? 'noreferrer' : undefined}
              className={action.featured ? 'is-featured' : undefined}
            >
              <span className="ayc-quick-icon">{action.icon}</span>
              <strong>{action.label}</strong>
            </a>
          ))}
        </nav>

        <section className="ayc-mobile-section ayc-contact-section">
          <div className="ayc-section-heading compact">
            <span>Contacto directo</span>
            <h2>Estamos a sus órdenes</h2>
          </div>

          <div className="ayc-contact-list">
            {contactRows.map((item) => {
              const content = (
                <>
                  <span className="ayc-contact-icon">{item.icon}</span>
                  <span className="ayc-contact-copy">
                    <small>{item.label}</small>
                    <strong>{item.value}</strong>
                  </span>
                  {item.href ? <FaArrowRight className="ayc-contact-arrow" /> : null}
                </>
              )

              return item.href ? (
                <a key={item.label} href={item.href} target={item.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
                  {content}
                </a>
              ) : (
                <div key={item.label}>{content}</div>
              )
            })}
          </div>

          <button type="button" className="ayc-primary-wide" onClick={downloadVCard}>
            <FaAddressCard /> Guardar contacto
          </button>
        </section>

        <div className="ayc-divider" />

        <section className="ayc-mobile-section ayc-about-section">
          <div className="ayc-section-heading">
            <span>Soluciones llave en mano</span>
            <h2>Ingeniería, fabricación y automatización en un solo lugar</h2>
          </div>
          <p>{about}</p>
          <a href={waHref} target="_blank" rel="noreferrer" className="ayc-inline-cta">
            Cuéntenos sobre su proyecto <FaArrowRight />
          </a>
        </section>

        <section className="ayc-mobile-section ayc-services-section" id="soluciones">
          <div className="ayc-section-heading">
            <span>Nuestras capacidades</span>
            <h2>Soluciones industriales</h2>
          </div>

          <div className="ayc-service-scroller">
            {services.map((service) => (
              <button key={service.id} type="button" className="ayc-service-card" onClick={() => setActiveService(service)}>
                <AssetImage src={service.image} alt={service.title} className="ayc-service-image" />
                <span className="ayc-service-icon">{serviceIcon(service.id)}</span>
                <div>
                  <h3>{service.title}</h3>
                  <p>{service.description}</p>
                  <strong>Ver detalles <FaArrowRight /></strong>
                </div>
              </button>
            ))}
          </div>
          <p className="ayc-scroll-hint">Deslice para explorar las soluciones</p>
        </section>

        <section className="ayc-mobile-section ayc-process-section">
          <div className="ayc-section-heading">
            <span>Cómo trabajamos</span>
            <h2>De la necesidad a la solución</h2>
          </div>
          <div className="ayc-process-grid">
            {[
              ['01', 'Evaluamos', 'Conocemos el proceso, la pieza o el equipo.'],
              ['02', 'Diseñamos', 'Preparamos la propuesta técnica y el modelado.'],
              ['03', 'Fabricamos', 'Producimos, integramos y realizamos los ajustes.'],
              ['04', 'Probamos', 'Verificamos el funcionamiento antes de entregar.'],
            ].map(([number, title, text]) => (
              <article key={number}>
                <span>{number}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="ayc-mobile-section ayc-projects-section">
          <div className="ayc-section-heading">
            <span>Experiencia aplicada</span>
            <h2>Trabajos destacados</h2>
          </div>
          <div className="ayc-project-scroller">
            {projects.map((project) => (
              <article key={`${project.category}-${project.title}`} className="ayc-project-card">
                <AssetImage src={project.image} alt={project.title} className="ayc-project-image" />
                <div>
                  <span>{project.category}</span>
                  <h3>{project.title}</h3>
                  <p>{project.description}</p>
                  <a href={waHref} target="_blank" rel="noreferrer">Solicitar algo similar <FaArrowRight /></a>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="ayc-mobile-section ayc-faq-section">
          <div className="ayc-section-heading">
            <span>Información útil</span>
            <h2>Preguntas frecuentes</h2>
          </div>
          <div className="ayc-faq-list">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index
              return (
                <article key={faq.question} className={isOpen ? 'is-open' : undefined}>
                  <button type="button" onClick={() => setOpenFaq(isOpen ? null : index)} aria-expanded={isOpen}>
                    <span>{faq.question}</span>
                    <FaChevronDown />
                  </button>
                  {isOpen ? <p>{faq.answer}</p> : null}
                </article>
              )
            })}
          </div>
        </section>

        <section className="ayc-mobile-section ayc-location-section">
          <div className="ayc-section-heading">
            <span>Visítenos</span>
            <h2>Nuestra ubicación</h2>
          </div>
          <div className="ayc-map-card">
            <iframe
              title="Ubicación de A&C Dominicana"
              src={mapEmbedUrl}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <div>
              <strong>{name}</strong>
              <p>{address}</p>
              <a href={mapUrl} target="_blank" rel="noreferrer">Cómo llegar</a>
            </div>
          </div>
        </section>

        <section className="ayc-final-cta">
          <span>Hablemos de su proyecto</span>
          <h2>¿Tiene una necesidad industrial que debemos evaluar?</h2>
          <p>Comparta la pieza, equipo, proceso o mejora que necesita.</p>
          <a href={waHref} target="_blank" rel="noreferrer"><FaWhatsapp /> Solicitar cotización</a>
        </section>

        <footer className="ayc-mobile-footer">
          <AssetImage src={logo} alt={name} className="ayc-footer-logo" />
          <div className="ayc-social-row">
            <a href={instagramUrl} target="_blank" rel="noreferrer" aria-label="Instagram"><FaInstagram /></a>
            <a href={facebookUrl} target="_blank" rel="noreferrer" aria-label="Facebook"><FaFacebookF /></a>
            <a href={websiteHref} target="_blank" rel="noreferrer" aria-label="Sitio web"><FaGlobe /></a>
          </div>
          <button type="button" onClick={shareProfile}><FaShareAlt /> {shareLabel}</button>
          <small>Perfil empresarial creado con INTAP LINK</small>
        </footer>
      </div>

      {activeService ? (
        <div className="ayc-service-modal" role="dialog" aria-modal="true" aria-labelledby="ayc-service-modal-title">
          <button type="button" className="ayc-modal-backdrop" onClick={() => setActiveService(null)} aria-label="Cerrar" />
          <article>
            <button type="button" className="ayc-modal-close" onClick={() => setActiveService(null)} aria-label="Cerrar detalle">
              <FaTimes />
            </button>
            <AssetImage src={activeService.image} alt={activeService.title} className="ayc-modal-image" />
            <span className="ayc-modal-icon">{serviceIcon(activeService.id)}</span>
            <h2 id="ayc-service-modal-title">{activeService.title}</h2>
            <p>{activeService.description}</p>
            {activeService.bullets?.length ? (
              <ul>
                {activeService.bullets.map((bullet) => <li key={bullet}><FaCheckCircle /> {bullet}</li>)}
              </ul>
            ) : null}
            <a href={waHref} target="_blank" rel="noreferrer"><FaWhatsapp /> Solicitar información</a>
          </article>
        </div>
      ) : null}
    </main>
  )
}
