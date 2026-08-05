import { useMemo, useState } from 'react'
import {
  FaArrowRight,
  FaCogs,
  FaEnvelope,
  FaFacebookF,
  FaIndustry,
  FaInstagram,
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaProjectDiagram,
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
  bullets: string[]
  image?: string
  icon: JSX.Element
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
    bullets: ['Tornos CNC y convencionales', 'Fresadoras CNC', 'Rectificadoras', 'Moldes y troqueles'],
    image: '/assets/aycdom/services/mecanizados-01.webp',
    icon: <FaTools />,
  },
  {
    id: 'laser',
    title: 'Corte láser CNC',
    description: 'Corte de precisión para piezas y componentes en diferentes materiales industriales.',
    bullets: ['Acero inoxidable', 'Acero al carbono', 'Aluminio', 'Bronce y cobre'],
    image: '/assets/aycdom/services/corte-laser-01.webp',
    icon: <FaWrench />,
  },
  {
    id: 'automatizacion',
    title: 'Automatización industrial',
    description: 'Integración de controles, equipos y mejoras orientadas a elevar la eficiencia del proceso.',
    bullets: ['Control de procesos', 'Automatización de máquinas', 'Sistemas neumáticos', 'Controles de movimiento'],
    image: '/assets/aycdom/services/automatizacion-01.webp',
    icon: <FaCogs />,
  },
  {
    id: 'conveyors',
    title: 'Conveyors y manejo de materiales',
    description: 'Diseño y fabricación de transportadores adaptados al espacio, producto y operación.',
    bullets: ['Bandas rectas', 'Conveyors curvos', 'Sistemas de rodillos', 'Bandas modulares'],
    image: '/assets/aycdom/services/conveyors-01.webp',
    icon: <FaProjectDiagram />,
  },
  {
    id: 'equipos',
    title: 'Máquinas y equipos a medida',
    description: 'Desarrollo de soluciones industriales cuando un equipo estándar no responde a la necesidad.',
    bullets: ['Máquinas especiales', 'Fixtures', 'Estructuras', 'Modificación de equipos'],
    image: '/assets/aycdom/services/equipos-01.webp',
    icon: <FaIndustry />,
  },
  {
    id: 'soldadura',
    title: 'Soldaduras especializadas',
    description: 'Trabajos de fabricación y reparación en distintos materiales y niveles de exigencia.',
    bullets: ['Aluminio', 'Bronce', 'Argón', 'Soldaduras de alta resistencia'],
    image: '/assets/aycdom/services/soldadura-01.webp',
    icon: <FaWrench />,
  },
]

const FALLBACK_PROJECTS: ProjectItem[] = [
  {
    title: 'Sistema de transporte industrial',
    category: 'Conveyors',
    image: '/assets/aycdom/projects/proyecto-conveyor-01.webp',
    description: 'Solución de transporte adaptada al flujo y distribución de planta.',
  },
  {
    title: 'Piezas mecanizadas de precisión',
    category: 'Mecanizados',
    image: '/assets/aycdom/projects/proyecto-mecanizado-01.webp',
    description: 'Fabricación de componentes según muestra, plano o especificación técnica.',
  },
  {
    title: 'Integración de proceso',
    category: 'Automatización',
    image: '/assets/aycdom/projects/proyecto-automatizacion-01.webp',
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
    answer: 'La posibilidad depende del estado de la muestra, las tolerancias requeridas y el material. El equipo técnico debe evaluarla antes de confirmar.',
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

function safeJsonArray<T>(value: string | undefined, fallback: T[]): T[] {
  if (!value) return fallback
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

function AssetImage({ src, alt, className }: { src?: string; alt: string; className: string }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) return <div className={`${className} ayc-image-fallback`} aria-label={alt} />
  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} loading="lazy" />
}

export default function IntapProfileAyCDominicanaV1({ profile }: { profile: IntapProfileV2Profile }) {
  const td = profile.templateData ?? {}
  const [activeService, setActiveService] = useState<ServiceItem | null>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  const name = pick(profile.companyName, profile.company_name, profile.name, td.company_name, 'A&C Dominicana, S.R.L.')
  const tagline = pick(td.tagline, 'Metalmecánica · Automatización Industrial')
  const headline = pick(td.headline, 'Soluciones industriales diseñadas con precisión')
  const heroCopy = pick(
    td.hero_copy,
    'Diseñamos, fabricamos e integramos soluciones para optimizar procesos industriales, desde una pieza o máquina especializada hasta una línea de producción completa.',
  )
  const about = pick(
    profile.companyAbout,
    profile.company_about,
    td.about,
    'Acompañamos a empresas que necesitan mejorar, reparar, fabricar o automatizar sus procesos. Integramos diseño técnico, mecanizado, soldadura, fabricación de equipos e instalación dentro de una misma solución.',
  )

  const phone = pick(profile.phone, td.phone, '809-476-7325')
  const whatsapp = pick(profile.whatsapp, profile.whatsappNumber, profile.whatsapp_number, td.whatsapp, '18094767325')
  const email = pick(profile.email, td.email, 'ventas@aycdominicana.com')
  const website = pick(profile.website, td.website, 'https://aycdominicana.com')
  const address = pick(profile.address, td.address, 'Calle Juan José Duarte #73, Ensanche La Fe, Santo Domingo')
  const mapUrl = pick(profile.mapUrl, profile.map_url, td.map_url, 'https://maps.google.com/?q=Calle+Juan+Jose+Duarte+73+Ensanche+La+Fe+Santo+Domingo')
  const instagramUrl = pick(td.instagram_url, 'https://www.instagram.com/aycdominicana/')
  const facebookUrl = pick(td.facebook_url, 'https://www.facebook.com/aycdominicana/')

  const logo = pick(profile.companyLogo, profile.company_logo, td.logo_url, '/assets/aycdom/logo/logo-ayc-principal.png')
  const heroImage = pick(td.hero_image, '/assets/aycdom/hero/hero-ayc-01.webp')

  const services = useMemo(() => safeJsonArray<ServiceItem>(td.services_json, FALLBACK_SERVICES), [td.services_json])
  const projects = useMemo(() => safeJsonArray<ProjectItem>(td.projects_json, FALLBACK_PROJECTS), [td.projects_json])
  const faqs = useMemo(() => safeJsonArray<FaqItem>(td.faqs_json, FALLBACK_FAQS), [td.faqs_json])

  const waHref = `https://wa.me/${cleanPhone(whatsapp)}?text=${encodeURIComponent('Hola, vi su perfil en INTAP LINK y quiero solicitar información sobre una solución industrial.')}`

  const quickActions = [
    { label: 'Llamar', href: `tel:${cleanPhone(phone)}`, icon: <FaPhoneAlt /> },
    { label: 'WhatsApp', href: waHref, icon: <FaWhatsapp /> },
    { label: 'Correo', href: `mailto:${email}`, icon: <FaEnvelope /> },
    { label: 'Ubicación', href: mapUrl, icon: <FaMapMarkerAlt /> },
  ]

  return (
    <div className="ayc-page">
      <header className="ayc-hero">
        <AssetImage src={heroImage} alt="Soluciones industriales A&C Dominicana" className="ayc-hero-image" />
        <div className="ayc-hero-overlay" />
        <div className="ayc-hero-content">
          <div className="ayc-logo-shell">
            <AssetImage src={logo} alt={name} className="ayc-logo" />
          </div>
          <p className="ayc-eyebrow">{tagline}</p>
          <h1>{headline}</h1>
          <p className="ayc-hero-copy">{heroCopy}</p>
          <div className="ayc-hero-actions">
            <a href={waHref} target="_blank" rel="noreferrer" className="ayc-btn ayc-btn-primary">
              Solicitar cotización <FaArrowRight />
            </a>
            <a href="#soluciones" className="ayc-btn ayc-btn-secondary">Explorar soluciones</a>
          </div>
        </div>
      </header>

      <main>
        <section className="ayc-quick-actions" aria-label="Acciones rápidas">
          {quickActions.map((item) => (
            <a key={item.label} href={item.href} target={item.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
              <span>{item.icon}</span>
              <small>{item.label}</small>
            </a>
          ))}
        </section>

        <section className="ayc-section ayc-intro">
          <div className="ayc-section-heading">
            <p>Soluciones llave en mano</p>
            <h2>Ingeniería, fabricación y automatización en un solo lugar</h2>
          </div>
          <div className="ayc-intro-grid">
            <p>{about}</p>
            <div className="ayc-highlight-card">
              <strong>De una pieza a una línea completa</strong>
              <span>Diseño, fabricación, integración, instalación y soporte según el alcance del proyecto.</span>
            </div>
          </div>
        </section>

        <section className="ayc-section ayc-solutions" id="soluciones">
          <div className="ayc-section-heading ayc-section-heading-light">
            <p>Nuestras capacidades</p>
            <h2>Soluciones pensadas para necesidades industriales reales</h2>
          </div>
          <div className="ayc-service-grid">
            {services.map((service) => (
              <article key={service.id} className="ayc-service-card">
                <AssetImage src={service.image} alt={service.title} className="ayc-service-image" />
                <div className="ayc-service-body">
                  <span className="ayc-service-icon">{service.icon}</span>
                  <h3>{service.title}</h3>
                  <p>{service.description}</p>
                  <button type="button" onClick={() => setActiveService(service)}>
                    Ver detalles <FaArrowRight />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="ayc-section ayc-process">
          <div className="ayc-section-heading">
            <p>Nuestro proceso</p>
            <h2>Convertimos una necesidad industrial en una solución funcional</h2>
          </div>
          <div className="ayc-process-grid">
            {[
              ['01', 'Evaluamos', 'Conocemos el proceso, el equipo o la pieza que requiere atención.'],
              ['02', 'Diseñamos', 'Preparamos la solución técnica y validamos sus requerimientos.'],
              ['03', 'Fabricamos', 'Producimos las piezas, estructuras o equipos definidos.'],
              ['04', 'Integramos', 'Instalamos, ajustamos y conectamos la solución cuando aplica.'],
            ].map(([number, title, text]) => (
              <article key={number}>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="ayc-section ayc-projects">
          <div className="ayc-section-heading">
            <p>Proyectos y trabajos</p>
            <h2>Capacidad aplicada a diferentes procesos</h2>
          </div>
          <div className="ayc-project-grid">
            {projects.map((project) => (
              <article key={`${project.category}-${project.title}`}>
                <AssetImage src={project.image} alt={project.title} className="ayc-project-image" />
                <div>
                  <span>{project.category}</span>
                  <h3>{project.title}</h3>
                  {project.description && <p>{project.description}</p>}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="ayc-section ayc-faq">
          <div className="ayc-section-heading">
            <p>Preguntas frecuentes</p>
            <h2>Antes de solicitar una cotización</h2>
          </div>
          <div className="ayc-faq-list">
            {faqs.map((faq, index) => {
              const open = openFaq === index
              return (
                <article key={faq.question} className={open ? 'is-open' : ''}>
                  <button type="button" onClick={() => setOpenFaq(open ? null : index)} aria-expanded={open}>
                    <span>{faq.question}</span>
                    <b>{open ? '−' : '+'}</b>
                  </button>
                  {open && <p>{faq.answer}</p>}
                </article>
              )
            })}
          </div>
        </section>

        <section className="ayc-contact">
          <div>
            <p>Hablemos de su proyecto</p>
            <h2>¿Tiene una necesidad industrial que debemos evaluar?</h2>
            <span>Comparta la pieza, equipo, proceso o mejora que necesita. Nuestro equipo revisará la información para orientarle sobre el próximo paso.</span>
          </div>
          <div className="ayc-contact-card">
            <h3>{name}</h3>
            <a href={`tel:${cleanPhone(phone)}`}><FaPhoneAlt /> {phone}</a>
            <a href={`mailto:${email}`}><FaEnvelope /> {email}</a>
            <a href={mapUrl} target="_blank" rel="noreferrer"><FaMapMarkerAlt /> {address}</a>
            <a href={waHref} target="_blank" rel="noreferrer" className="ayc-btn ayc-btn-primary">Solicitar cotización</a>
          </div>
        </section>
      </main>

      <footer className="ayc-footer">
        <div>
          <AssetImage src={logo} alt={name} className="ayc-footer-logo" />
          <span>Metalmecánica · Automatización Industrial</span>
        </div>
        <nav aria-label="Redes sociales">
          <a href={instagramUrl} target="_blank" rel="noreferrer" aria-label="Instagram"><FaInstagram /></a>
          <a href={facebookUrl} target="_blank" rel="noreferrer" aria-label="Facebook"><FaFacebookF /></a>
          <a href={website} target="_blank" rel="noreferrer" aria-label="Sitio web"><FaIndustry /></a>
        </nav>
        <small>Perfil creado con INTAP LINK</small>
      </footer>

      {activeService && (
        <div className="ayc-modal-backdrop" role="presentation" onClick={() => setActiveService(null)}>
          <section className="ayc-modal" role="dialog" aria-modal="true" aria-label={activeService.title} onClick={(event) => event.stopPropagation()}>
            <button type="button" className="ayc-modal-close" onClick={() => setActiveService(null)} aria-label="Cerrar">×</button>
            <AssetImage src={activeService.image} alt={activeService.title} className="ayc-modal-image" />
            <div className="ayc-modal-body">
              <span className="ayc-service-icon">{activeService.icon}</span>
              <h2>{activeService.title}</h2>
              <p>{activeService.description}</p>
              <ul>{activeService.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
              <a href={`${waHref}&text=${encodeURIComponent(`Hola, quiero información sobre ${activeService.title}.`)}`} target="_blank" rel="noreferrer" className="ayc-btn ayc-btn-primary">
                Consultar por WhatsApp
              </a>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
