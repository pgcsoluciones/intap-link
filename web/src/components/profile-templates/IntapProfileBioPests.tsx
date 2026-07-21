import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  FaArrowRight,
  FaBug,
  FaCertificate,
  FaCheckCircle,
  FaClock,
  FaComments,
  FaDesktop,
  FaDownload,
  FaDove,
  FaEnvelope,
  FaLeaf,
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaShieldAlt,
  FaTimes,
  FaTruck,
  FaWhatsapp,
} from 'react-icons/fa'
import './IntapProfileBioPests.css'

type BioPestsProfileProps = {
  profile?: any
}

type Service = {
  id: string
  title: string
  short: string
  description: string
  image: string
  icon: ReactNode
  bullets: string[]
  whatsappMessage: string
}

type Technology = {
  title: string
  description: string
  image: string
  eyebrow: string
}

const BIOPESTS = {
  name: 'BioPests',
  tagline: 'Manejo Inteligente de Plagas',
  heroTitle: 'Protección empresarial con control inteligente de plagas',
  heroSubtitle:
    'Excelencia operativa, monitoreo preventivo y tecnología de vanguardia para proteger la continuidad de su empresa.',
  phonePrimary: '(829) 750-0908',
  phonePrimaryRaw: '18297500908',
  phoneSecondary: '(829) 246-9777',
  phoneSecondaryRaw: '18292469777',
  whatsappRaw: '18297500908',
  email: 'grupomatyse@gmail.com',
  address: 'Av. Gustavo Mejía Ricart #226, Piso 4, Oficina 405, Distrito Nacional, R.D.',
  hours: 'Atención empresarial · Consulte disponibilidad',
  logoGreen: '/assets/biopestrd/brand/biopests-logo-green.png',
  logoWhite: '/assets/biopestrd/brand/biopests-logo-white.png',
  hero: '/assets/biopestrd/hero/hero-operacion-industrial.webp',
  heroSecondary: '/assets/biopestrd/hero/hero-proteccion-logistica.webp',
}

const SERVICES: Service[] = [
  {
    id: 'desinsectacion',
    title: 'Desinsectación de precisión',
    short: 'Intervenciones dirigidas para controlar insectos en entornos empresariales.',
    description:
      'Aplicamos soluciones técnicas orientadas al ciclo de vida de cada plaga, priorizando la prevención, la precisión y la mínima interrupción de sus operaciones.',
    image: '/assets/biopestrd/services/service-desinsectacion-precision.webp',
    icon: <FaBug />,
    bullets: ['Evaluación del foco', 'Aplicación estratégica', 'Seguimiento preventivo'],
    whatsappMessage: 'Hola, necesito información sobre desinsectación de precisión para mi empresa.',
  },
  {
    id: 'aves',
    title: 'Control de aves',
    short: 'Manejo profesional para reducir riesgos sanitarios y operativos.',
    description:
      'Diseñamos medidas de control y exclusión adaptadas a instalaciones industriales, comerciales y logísticas, protegiendo áreas críticas sin afectar la operación.',
    image: '/assets/biopestrd/services/service-control-de-aves.webp',
    icon: <FaDove />,
    bullets: ['Diagnóstico del entorno', 'Medidas de exclusión', 'Monitoreo de recurrencia'],
    whatsappMessage: 'Hola, deseo evaluar un servicio de control de aves para nuestras instalaciones.',
  },
  {
    id: 'desinfeccion',
    title: 'Fortaleza en desinfección',
    short: 'Protocolos para reforzar la higiene de espacios, equipos y superficies.',
    description:
      'Ejecutamos procesos de desinfección con enfoque empresarial, cobertura planificada y productos seleccionados para una intervención efectiva y responsable.',
    image: '/assets/biopestrd/services/service-desinfeccion.webp',
    icon: <FaShieldAlt />,
    bullets: ['Cobertura planificada', 'Productos de baja toxicidad', 'Reporte del servicio'],
    whatsappMessage: 'Hola, quiero cotizar un servicio empresarial de desinfección.',
  },
  {
    id: 'transporte',
    title: 'Inocuidad en el transporte',
    short: 'Protección sanitaria para vehículos, flotillas y operaciones logísticas.',
    description:
      'Ayudamos a preservar condiciones higiénicas en unidades de transporte y áreas de carga mediante inspección, tratamiento y control documentado.',
    image: '/assets/biopestrd/services/service-inocuidad-transporte.webp',
    icon: <FaTruck />,
    bullets: ['Inspección de unidades', 'Tratamiento focalizado', 'Continuidad operativa'],
    whatsappMessage: 'Hola, necesito información sobre inocuidad y control de plagas en transporte.',
  },
  {
    id: 'desratizacion',
    title: 'Desratización inteligente',
    short: 'Monitoreo, trazabilidad y control preventivo de roedores.',
    description:
      'Implementamos estaciones, registros y seguimiento para detectar actividad, reducir riesgos y anticipar infestaciones antes de que afecten la operación.',
    image: '/assets/biopestrd/services/service-desratizacion-inteligente.webp',
    icon: <FaCheckCircle />,
    bullets: ['Estaciones monitoreadas', 'Registro de actividad', 'Plan de mejora continua'],
    whatsappMessage: 'Hola, me interesa una evaluación de desratización inteligente para mi empresa.',
  },
]

const TECHNOLOGY: Technology[] = [
  {
    eyebrow: 'Monitoreo',
    title: 'Control Digital',
    description: 'Sistemas dinámicos para anticipar infestaciones y documentar hallazgos antes de que escalen.',
    image: '/assets/biopestrd/technology/control-digital-dashboard.webp',
  },
  {
    eyebrow: 'Captura',
    title: 'Exter Fly',
    description: 'Lámparas decorativas y tácticas con superficies de alta captura para áreas críticas.',
    image: '/assets/biopestrd/technology/exter-fly.webp',
  },
  {
    eyebrow: 'Sanitización',
    title: 'Allspray Natural',
    description: 'Solución de descarga total con piretrinas naturales para una intervención inmediata y segura.',
    image: '/assets/biopestrd/technology/allspray-natural.webp',
  },
]

const CLIENTS = [
  ['DC', '/assets/biopestrd/clients/dc.webp'],
  ['Editora Corripio', '/assets/biopestrd/clients/editora-corripio.webp'],
  ['Envases Tropicales', '/assets/biopestrd/clients/envases-tropicales.webp'],
  ['Fenwal', '/assets/biopestrd/clients/fenwal.webp'],
  ['Huevos Don Papito', '/assets/biopestrd/clients/huevos-don-papito.webp'],
  ['Trigas del Caribe', '/assets/biopestrd/clients/trigas-del-caribe.webp'],
  ['LOQ Mini Naves', '/assets/biopestrd/clients/loq-mini-naves.webp'],
  ['Biker Burger', '/assets/biopestrd/clients/biker-burger.webp'],
  ['Brazaí', '/assets/biopestrd/clients/brazai.webp'],
] as const

const FAQS = [
  {
    question: '¿Atienden empresas e instalaciones de gran escala?',
    answer:
      'Sí. BioPests está orientada al manejo integral de plagas para empresas, industrias, comercios, logística y operaciones que requieren continuidad y seguimiento.',
  },
  {
    question: '¿El servicio incluye monitoreo y seguimiento?',
    answer:
      'El enfoque es preventivo. Según el plan acordado, se realizan inspecciones, registros, monitoreo y recomendaciones para reducir recurrencias.',
  },
  {
    question: '¿Utilizan productos responsables con el ambiente?',
    answer:
      'La propuesta corporativa prioriza productos de baja toxicidad y alta efectividad, aplicados mediante protocolos que reducen el impacto en las áreas de trabajo.',
  },
  {
    question: '¿Cómo solicito una evaluación?',
    answer:
      'Puede escribir por WhatsApp, llamar o enviar un correo. El equipo recopilará los datos básicos de la instalación para orientar el próximo paso.',
  },
]

const PERMITS = [
  'Registro de Agricultura',
  'Permisos de no objeción',
  'Permisos de Salud Pública',
  'Constancia Ambiental',
]

const VALUES = [
  {
    title: 'Garantía total',
    text: 'Monitoreo constante y seguimiento riguroso para respaldar cada intervención.',
    icon: <FaShieldAlt />,
  },
  {
    title: 'Ética ambiental',
    text: 'Productos de baja toxicidad y alta efectividad aplicados con responsabilidad.',
    icon: <FaLeaf />,
  },
  {
    title: 'Innovación',
    text: 'Capacitación continua y adopción de tecnologías para responder a cada reto.',
    icon: <FaDesktop />,
  },
]

const waUrl = (message: string) =>
  `https://wa.me/${BIOPESTS.whatsappRaw}?text=${encodeURIComponent(message)}`

const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`

function buildVCardHref() {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${BIOPESTS.name}`,
    `ORG:${BIOPESTS.name}`,
    `TITLE:${BIOPESTS.tagline}`,
    `TEL;TYPE=WORK,VOICE:${BIOPESTS.phonePrimaryRaw}`,
    `TEL;TYPE=WORK,VOICE:${BIOPESTS.phoneSecondaryRaw}`,
    `TEL;TYPE=CELL:${BIOPESTS.whatsappRaw}`,
    `EMAIL;TYPE=WORK:${BIOPESTS.email}`,
    `ADR;TYPE=WORK:;;${BIOPESTS.address};;;;`,
    'URL:https://intaprd.com/biopestrd',
    'NOTE:Manejo integral e inteligente de plagas para el sector empresarial.',
    'END:VCARD',
  ]

  return `data:text/vcard;charset=utf-8,${encodeURIComponent(lines.join('\n'))}`
}

export default function IntapProfileBioPests(_props: BioPestsProfileProps) {
  const [activeServiceId, setActiveServiceId] = useState<string | null>(null)
  const [activeHero, setActiveHero] = useState(0)
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const [chatOpen, setChatOpen] = useState(false)

  const heroImages = useMemo(() => [BIOPESTS.hero, BIOPESTS.heroSecondary], [])
  const activeService = SERVICES.find((service) => service.id === activeServiceId) || null

  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(BIOPESTS.address)}`
  const mapEmbed = `https://maps.google.com/maps?q=${encodeURIComponent(BIOPESTS.address)}&z=16&output=embed`

  useEffect(() => {
    const previousTitle = document.title
    document.title = 'BioPests | Manejo inteligente de plagas para empresas'

    let description = document.querySelector('meta[name="description"]') as HTMLMetaElement | null
    if (!description) {
      description = document.createElement('meta')
      description.name = 'description'
      document.head.appendChild(description)
    }
    const previousDescription = description.content
    description.content =
      'Manejo integral de plagas, monitoreo preventivo, desinfección, control de aves y soluciones tecnológicas para empresas en República Dominicana.'

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    const previousCanonical = canonical.href
    canonical.href = 'https://intaprd.com/biopestrd'

    return () => {
      document.title = previousTitle
      description!.content = previousDescription
      canonical!.href = previousCanonical
    }
  }, [])

  useEffect(() => {
    if (!activeService) return

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveServiceId(null)
    }

    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [activeService])

  const openWhatsapp = (message: string) => {
    window.open(waUrl(message), '_blank', 'noopener,noreferrer')
  }

  return (
    <main className="biopests-page">
      <div className="biopests-shell">
        <section className="biopests-hero" aria-label="Presentación BioPests">
          <div className="biopests-hero__slides" aria-hidden="true">
            {heroImages.map((image, index) => (
              <img
                key={image}
                src={image}
                alt=""
                className={index === activeHero ? 'is-active' : ''}
              />
            ))}
          </div>
          <div className="biopests-hero__overlay" />

          <header className="biopests-hero__topbar">
            <img src={BIOPESTS.logoWhite} alt="BioPests" className="biopests-hero__logo" />
            <span className="biopests-hero__sector">Soluciones empresariales</span>
          </header>

          <div className="biopests-hero__content">
            <span className="biopests-kicker">{BIOPESTS.tagline}</span>
            <h1>{BIOPESTS.heroTitle}</h1>
            <p>{BIOPESTS.heroSubtitle}</p>

            <div className="biopests-hero__actions">
              <a
                href={waUrl('Hola, vi el perfil de BioPests y deseo solicitar una evaluación para mi empresa.')}
                target="_blank"
                rel="noreferrer"
                className="biopests-btn biopests-btn--primary"
              >
                <FaWhatsapp /> Solicitar evaluación
              </a>
              <a href="#servicios" className="biopests-btn biopests-btn--ghost">
                Ver servicios <FaArrowRight />
              </a>
            </div>
          </div>

          <div className="biopests-hero__dots" aria-label="Cambiar imagen principal">
            {heroImages.map((_, index) => (
              <button
                key={index}
                type="button"
                className={index === activeHero ? 'is-active' : ''}
                onClick={() => setActiveHero(index)}
                aria-label={`Ver imagen ${index + 1}`}
              />
            ))}
          </div>
        </section>

        <nav className="biopests-quick" aria-label="Accesos rápidos">
          <QuickAction
            icon={<FaWhatsapp />}
            label="WhatsApp"
            href={waUrl('Hola, deseo información sobre los servicios empresariales de BioPests.')}
            external
          />
          <QuickAction icon={<FaPhoneAlt />} label="Llamar" href={telHref(BIOPESTS.phonePrimary)} />
          <QuickAction icon={<FaMapMarkerAlt />} label="Ubicación" href={mapUrl} external />
          <QuickAction icon={<FaDownload />} label="Contacto" href={buildVCardHref()} download="biopests.vcf" />
        </nav>

        <section className="biopests-section biopests-intro">
          <SectionHeading
            eyebrow="Liderazgo en el sector"
            title="Control integral que protege la continuidad de su empresa"
          />
          <p className="biopests-lead">
            Somos una empresa dedicada al manejo integral de plagas (MIP), operando bajo altos estándares para proteger la salud, la calidad de vida y la estabilidad de cada operación.
          </p>

          <div className="biopests-stats">
            <Stat value="MIP" label="Enfoque integral" />
            <Stat value="24/7" label="Prevención continua" />
            <Stat value="B2B" label="Atención empresarial" />
          </div>

          <div className="biopests-values">
            {VALUES.map((value) => (
              <article key={value.title} className="biopests-value-card">
                <span>{value.icon}</span>
                <h3>{value.title}</h3>
                <p>{value.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="biopests-section biopests-services-section" id="servicios">
          <SectionHeading
            eyebrow="Nuestros servicios"
            title="Soluciones diseñadas para áreas críticas y operaciones exigentes"
          />

          <div className="biopests-services-grid">
            {SERVICES.map((service) => (
              <button
                key={service.id}
                type="button"
                className="biopests-service-card"
                onClick={() => setActiveServiceId(service.id)}
              >
                <div className="biopests-service-card__image">
                  <img src={service.image} alt={service.title} loading="lazy" />
                  <span>{service.icon}</span>
                </div>
                <div className="biopests-service-card__body">
                  <h3>{service.title}</h3>
                  <p>{service.short}</p>
                  <small>Ver detalles <FaArrowRight /></small>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="biopests-method">
          <div className="biopests-method__copy">
            <SectionHeading
              eyebrow="Método preventivo"
              title="No solo reaccionamos: analizamos, intervenimos y monitoreamos"
              light
            />
            <div className="biopests-method__steps">
              <MethodStep number="01" title="Análisis biológico" text="Entendemos el ciclo de vida de la plaga para dirigir el tratamiento." />
              <MethodStep number="02" title="Aplicación estratégica" text="Minimizamos el impacto en las áreas de trabajo y la operación." />
              <MethodStep number="03" title="Control total" text="Seguimiento y eficacia frente a especies persistentes y resistentes." />
            </div>
          </div>
          <div className="biopests-method__visual">
            <img
              src="/assets/biopestrd/methodology/pest-control-spectrum.webp"
              alt="Espectro de plagas bajo control"
              loading="lazy"
            />
          </div>
        </section>

        <section className="biopests-section biopests-technology">
          <SectionHeading
            eyebrow="Tecnología de última generación"
            title="Herramientas que convierten el control de plagas en información accionable"
          />
          <div className="biopests-tech-grid">
            {TECHNOLOGY.map((technology) => (
              <article key={technology.title} className="biopests-tech-card">
                <div className="biopests-tech-card__image">
                  <img src={technology.image} alt={technology.title} loading="lazy" />
                </div>
                <div>
                  <span>{technology.eyebrow}</span>
                  <h3>{technology.title}</h3>
                  <p>{technology.description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="biopests-trust">
          <div className="biopests-trust__header">
            <div>
              <span className="biopests-kicker biopests-kicker--dark">Respaldo corporativo</span>
              <h2>Certificaciones y permisos</h2>
            </div>
            <FaCertificate aria-hidden="true" />
          </div>

          <div className="biopests-certifications">
            <article>
              <img src="/assets/biopestrd/certifications/iso-9001-2015.webp" alt="ISO 9001:2015" loading="lazy" />
              <p>Certificación ISO 9001:2015 presentada por BioPests.</p>
            </article>
            <article>
              <img src="/assets/biopestrd/certifications/accurate-global.webp" alt="Accurate Global Management Certification" loading="lazy" />
              <p>Respaldo de gestión y procesos corporativos.</p>
            </article>
          </div>

          <div className="biopests-permits">
            {PERMITS.map((permit) => (
              <span key={permit}>
                <FaCheckCircle /> {permit}
              </span>
            ))}
          </div>
        </section>

        <section className="biopests-section biopests-clients">
          <SectionHeading
            eyebrow="Referencias comerciales"
            title="Empresas que forman parte de nuestra experiencia operativa"
          />
          <div className="biopests-clients__track" aria-label="Referencias comerciales">
            {CLIENTS.map(([name, image]) => (
              <div key={name} className="biopests-client-logo">
                <img src={image} alt={name} loading="lazy" />
              </div>
            ))}
          </div>
        </section>

        <section className="biopests-section biopests-faq">
          <SectionHeading eyebrow="Preguntas frecuentes" title="Lo esencial antes de solicitar una evaluación" />
          <div className="biopests-faq__list">
            {FAQS.map((faq, index) => {
              const isOpen = openFaq === index
              return (
                <article key={faq.question} className={isOpen ? 'is-open' : ''}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    aria-expanded={isOpen}
                  >
                    <span>{faq.question}</span>
                    <b>{isOpen ? '−' : '+'}</b>
                  </button>
                  <div className="biopests-faq__answer">
                    <p>{faq.answer}</p>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <section className="biopests-contact" id="contacto">
          <div className="biopests-contact__copy">
            <span className="biopests-kicker">Prevención y corrección empresarial</span>
            <h2>Estamos listos para optimizar y proteger su entorno</h2>
            <p>Cuéntenos sobre su instalación y coordinemos el próximo paso.</p>
            <a
              href={waUrl('Hola, deseo coordinar una evaluación empresarial con BioPests.')}
              target="_blank"
              rel="noreferrer"
              className="biopests-btn biopests-btn--primary"
            >
              <FaWhatsapp /> Hablar con BioPests
            </a>
          </div>

          <div className="biopests-contact__details">
            <ContactRow icon={<FaPhoneAlt />} label="Teléfonos">
              <a href={telHref(BIOPESTS.phonePrimary)}>{BIOPESTS.phonePrimary}</a>
              <a href={telHref(BIOPESTS.phoneSecondary)}>{BIOPESTS.phoneSecondary}</a>
            </ContactRow>
            <ContactRow icon={<FaEnvelope />} label="Correo">
              <a href={`mailto:${BIOPESTS.email}`}>{BIOPESTS.email}</a>
            </ContactRow>
            <ContactRow icon={<FaMapMarkerAlt />} label="Dirección">
              <a href={mapUrl} target="_blank" rel="noreferrer">{BIOPESTS.address}</a>
            </ContactRow>
            <ContactRow icon={<FaClock />} label="Horario">
              <span>{BIOPESTS.hours}</span>
            </ContactRow>
          </div>

          <div className="biopests-map">
            <iframe
              title="Ubicación BioPests"
              src={mapEmbed}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
        </section>

        <footer className="biopests-footer">
          <img src={BIOPESTS.logoGreen} alt="BioPests" />
          <p>© {new Date().getFullYear()} BioPests · Manejo Inteligente de Plagas</p>
          <a href="/" aria-label="Conoce INTAP LINK">Perfil desarrollado en INTAP LINK</a>
        </footer>
      </div>

      {activeService && (
        <div
          className="biopests-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={activeService.title}
          onClick={(event) => {
            if (event.currentTarget === event.target) setActiveServiceId(null)
          }}
        >
          <div className="biopests-modal">
            <button
              type="button"
              className="biopests-modal__close"
              onClick={() => setActiveServiceId(null)}
              aria-label="Cerrar detalle"
            >
              <FaTimes />
            </button>
            <img src={activeService.image} alt={activeService.title} className="biopests-modal__image" />
            <div className="biopests-modal__body">
              <span className="biopests-kicker biopests-kicker--dark">Servicio empresarial</span>
              <h2>{activeService.title}</h2>
              <p>{activeService.description}</p>
              <ul>
                {activeService.bullets.map((bullet) => (
                  <li key={bullet}><FaCheckCircle /> {bullet}</li>
                ))}
              </ul>
              <a
                href={waUrl(activeService.whatsappMessage)}
                target="_blank"
                rel="noreferrer"
                className="biopests-btn biopests-btn--primary"
              >
                <FaWhatsapp /> Solicitar cotización
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="biopests-chat">
        <div className={`biopests-chat__panel ${chatOpen ? 'is-open' : ''}`}>
          <div className="biopests-chat__head">
            <img src={BIOPESTS.logoGreen} alt="BioPests" />
            <div>
              <strong>Asistente BioPests</strong>
              <span>Respuesta por WhatsApp</span>
            </div>
            <button type="button" onClick={() => setChatOpen(false)} aria-label="Cerrar chat"><FaTimes /></button>
          </div>
          <div className="biopests-chat__body">
            <p>Hola 👋 ¿En qué podemos ayudarte?</p>
            {[
              'Necesito una evaluación para mi empresa',
              'Quiero cotizar un servicio de control de plagas',
              'Deseo información sobre monitoreo preventivo',
              'Quiero confirmar cobertura y disponibilidad',
            ].map((option) => (
              <button key={option} type="button" onClick={() => openWhatsapp(option)}>{option}</button>
            ))}
          </div>
        </div>
        <button
          type="button"
          className="biopests-chat__trigger"
          onClick={() => setChatOpen((current) => !current)}
          aria-label="Abrir asistencia rápida"
        >
          <FaComments />
          <span>1</span>
        </button>
      </div>

      <div className="biopests-mobile-cta">
        <a href={telHref(BIOPESTS.phonePrimary)}><FaPhoneAlt /> Llamar</a>
        <a href={waUrl('Hola, deseo solicitar una evaluación empresarial con BioPests.')} target="_blank" rel="noreferrer"><FaWhatsapp /> WhatsApp</a>
      </div>
    </main>
  )
}

function QuickAction({
  icon,
  label,
  href,
  external = false,
  download,
}: {
  icon: ReactNode
  label: string
  href: string
  external?: boolean
  download?: string
}) {
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
      download={download}
      className="biopests-quick__item"
    >
      <span>{icon}</span>
      <strong>{label}</strong>
    </a>
  )
}

function SectionHeading({
  eyebrow,
  title,
  light = false,
}: {
  eyebrow: string
  title: string
  light?: boolean
}) {
  return (
    <div className={`biopests-section-heading ${light ? 'is-light' : ''}`}>
      <span>{eyebrow}</span>
      <h2>{title}</h2>
    </div>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

function MethodStep({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <article>
      <span>{number}</span>
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
    </article>
  )
}

function ContactRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="biopests-contact-row">
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        {children}
      </div>
    </div>
  )
}
