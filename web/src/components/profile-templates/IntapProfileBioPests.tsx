import { useEffect, useState, type ReactNode } from 'react'
import {
  FaAddressCard,
  FaArrowRight,
  FaBug,
  FaCheckCircle,
  FaChevronDown,
  FaDove,
  FaEnvelope,
  FaFileAlt,
  FaHeartbeat,
  FaInstagram,
  FaLeaf,
  FaLightbulb,
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaShieldAlt,
  FaTimes,
  FaTruck,
  FaWhatsapp
} from 'react-icons/fa'
import './IntapProfileBioPests.css'

const BIOPESTS = {
  name: 'BioPests',
  tagline: 'Manejo Inteligente de Plagas',
  headline:
    'Soluciones empresariales para prevenir, controlar y monitorear plagas.',
  description:
    'Protegemos instalaciones, procesos y operaciones mediante evaluación técnica, prevención continua y tecnología aplicada al manejo integral de plagas.',
  phone: '(829) 750-0908',
  phoneRaw: '18297500908',
  phoneSecondary: '(829) 246-9777',
  phoneSecondaryRaw: '18292469777',
  whatsappRaw: '18297500908',
  email: 'grupomatyse@gmail.com',
  instagramUrl: 'https://www.instagram.com/biopestsrd/',
  address:
    'Av. Gustavo Mejía Ricart #226, Piso 4, Oficina 405, Distrito Nacional, República Dominicana.',
  logo: '/assets/biopestrd/brand/biopests-logo-green.png',
}

const HERO_IMAGES = [
  {
    src: '/assets/biopestrd/hero/hero-operacion-industrial.webp',
    alt: 'Operación técnica de BioPests en instalaciones empresariales',
  },
  {
    src: '/assets/biopestrd/hero/hero-proteccion-logistica.webp',
    alt: 'Protección preventiva de operaciones logísticas',
  },
  {
    src: '/assets/biopestrd/hero/hero-desinsectacion-precision.webp',
    alt: 'Servicio técnico de desinsectación de precisión de BioPests',
  },
]

const VALUES: {
  title: string
  description: string
  icon: ReactNode
}[] = [
  {
    title: 'Garantía total',
    description:
      'Monitoreo constante y seguimiento riguroso para respaldar cada intervención.',
    icon: <FaShieldAlt />,
  },
  {
    title: 'Ética ambiental',
    description:
      'Productos de baja toxicidad y alta efectividad aplicados responsablemente.',
    icon: <FaLeaf />,
  },
  {
    title: 'Innovación',
    description:
      'Capacitación continua y tecnologías dinámicas para responder a cada reto.',
    icon: <FaLightbulb />,
  },
]

const SERVICES: {
  title: string
  description: string
  detail: string
  image: string
  icon: ReactNode
  message: string
}[] = [
  {
    title: 'Desinsectación de precisión',
    description:
      'Intervenciones dirigidas para controlar insectos en entornos empresariales.',
    detail:
      'Evaluamos el ciclo biológico de la plaga y aplicamos métodos estratégicos que reducen el impacto en las áreas de trabajo.',
    image:
      '/assets/biopestrd/services/service-desinsectacion-precision.webp',
    icon: <FaBug />,
    message:
      'Hola, necesito información sobre desinsectación de precisión para mi empresa.',
  },
  {
    title: 'Control de aves',
    description:
      'Manejo profesional para reducir riesgos sanitarios y operativos.',
    detail:
      'Diseñamos medidas de exclusión adaptadas a instalaciones industriales, comerciales y logísticas.',
    image:
      '/assets/biopestrd/services/service-control-de-aves.webp',
    icon: <FaDove />,
    message:
      'Hola, deseo evaluar un servicio de control de aves para nuestras instalaciones.',
  },
  {
    title: 'Fortaleza en desinfección',
    description:
      'Protocolos para reforzar la higiene de espacios, equipos y superficies.',
    detail:
      'Realizamos procesos planificados con productos seleccionados para una intervención efectiva y responsable.',
    image:
      '/assets/biopestrd/services/service-desinfeccion.webp',
    icon: <FaShieldAlt />,
    message:
      'Hola, quiero cotizar un servicio empresarial de desinfección.',
  },
  {
    title: 'Inocuidad en el transporte',
    description:
      'Protección sanitaria para vehículos, flotillas y operaciones logísticas.',
    detail:
      'Inspeccionamos unidades de transporte y áreas de carga para preservar condiciones higiénicas.',
    image:
      '/assets/biopestrd/services/service-inocuidad-transporte.webp',
    icon: <FaTruck />,
    message:
      'Hola, necesito información sobre inocuidad y control de plagas en transporte.',
  },
  {
    title: 'Desratización inteligente',
    description:
      'Monitoreo, trazabilidad y control preventivo de roedores.',
    detail:
      'Implementamos estaciones, registros y seguimiento para anticipar infestaciones y reducir riesgos.',
    image:
      '/assets/biopestrd/services/service-desratizacion-inteligente.webp',
    icon: <FaCheckCircle />,
    message:
      'Hola, me interesa una evaluación de desratización inteligente para mi empresa.',
  },
]


// INFORMACION AMPLIADA DE SERVICIOS BIOPESTS
const SERVICE_DETAILS: Record<
  string,
  {
    benefits: string[]
    idealFor: string[]
  }
> = {
  'Desinsectación de precisión': {
    benefits: [
      'Identificación del tipo de insecto y su ciclo biológico.',
      'Aplicación dirigida para reducir exposición innecesaria.',
      'Seguimiento técnico para prevenir nuevas infestaciones.',
    ],
    idealFor: [
      'Industrias, almacenes y centros de distribución.',
      'Restaurantes, comercios y oficinas corporativas.',
      'Instalaciones que requieren continuidad operativa.',
    ],
  },
  'Control de aves': {
    benefits: [
      'Reducción de riesgos sanitarios y contaminación.',
      'Protección de techos, fachadas y zonas de carga.',
      'Métodos de exclusión adaptados a cada estructura.',
    ],
    idealFor: [
      'Naves industriales y centros logísticos.',
      'Edificios comerciales y corporativos.',
      'Instalaciones con presencia recurrente de aves.',
    ],
  },
  'Fortaleza en desinfección': {
    benefits: [
      'Refuerzo de la higiene en espacios y superficies.',
      'Aplicación planificada según las áreas de riesgo.',
      'Productos seleccionados para uso profesional.',
    ],
    idealFor: [
      'Oficinas, comercios y áreas de atención al público.',
      'Centros de producción y almacenamiento.',
      'Vehículos, equipos y espacios de uso frecuente.',
    ],
  },
  'Inocuidad en el transporte': {
    benefits: [
      'Protección sanitaria para vehículos y áreas de carga.',
      'Reducción de contaminación cruzada.',
      'Inspección y recomendaciones preventivas.',
    ],
    idealFor: [
      'Empresas de transporte y distribución.',
      'Flotillas de alimentos, bebidas y materias primas.',
      'Operaciones logísticas con controles sanitarios.',
    ],
  },
  'Desratización inteligente': {
    benefits: [
      'Monitoreo preventivo mediante estaciones identificadas.',
      'Trazabilidad de hallazgos y puntos críticos.',
      'Control continuo para reducir riesgos operativos.',
    ],
    idealFor: [
      'Almacenes, industrias y plantas de producción.',
      'Restaurantes, supermercados y comercios.',
      'Instalaciones con alto flujo de mercancías.',
    ],
  },
}

const METHOD = [
  {
    number: '01',
    title: 'Análisis biológico',
    description:
      'Estudiamos el ciclo de vida y comportamiento de la plaga para identificar el origen del problema.',
  },
  {
    number: '02',
    title: 'Aplicación estratégica',
    description:
      'Seleccionamos métodos precisos que minimizan interrupciones y protegen las áreas de trabajo.',
  },
  {
    number: '03',
    title: 'Control y seguimiento',
    description:
      'Verificamos resultados, documentamos hallazgos y reforzamos las medidas preventivas.',
  },
]

const METHODOLOGY_IMAGES = [
  {
    src:
      '/assets/biopestrd/methodology/digital-monitoring-security.png',
    alt:
      'Sistema de monitoreo digital y seguridad preventiva de BioPests',
  },
  {
    src:
      '/assets/biopestrd/methodology/pest-control-spectrum.png',
    alt:
      'Espectro de soluciones integrales para control de plagas',
  },
]

const TECHNOLOGY = [
  {
    eyebrow: 'MONITOREO',
    title: 'Control Digital',
    description:
      'Sistemas dinámicos para anticipar infestaciones, documentar hallazgos y fortalecer la trazabilidad.',
    image:
      '/assets/biopestrd/technology/control-digital-dashboard.webp',
  },
  {
    eyebrow: 'CAPTURA',
    title: 'Exter Fly',
    description:
      'Lámparas decorativas y tácticas con superficies de alta captura para áreas empresariales críticas.',
    image:
      '/assets/biopestrd/technology/exter-fly.webp',
  },
  {
    eyebrow: 'SANITIZACIÓN',
    title: 'Allspray Natural',
    description:
      'Solución de descarga total con piretrinas naturales para una intervención inmediata y responsable.',
    image:
      '/assets/biopestrd/technology/allspray-natural.png',
  },
]


// DETALLES DE TECNOLOGIA BIOPESTS
const TECHNOLOGY_DETAILS: Record<
  string,
  {
    lead: string
    benefits: string[]
    applications: string[]
    message: string
  }
> = {
  'Control Digital': {
    lead:
      'Una solución de monitoreo y trazabilidad que permite documentar hallazgos, analizar tendencias y fortalecer la prevención.',
    benefits: [
      'Registro organizado de inspecciones y hallazgos.',
      'Seguimiento de puntos críticos dentro de la instalación.',
      'Mayor trazabilidad para auditorías y controles internos.',
      'Información disponible para apoyar decisiones preventivas.',
    ],
    applications: [
      'Industrias y plantas de producción.',
      'Almacenes y centros logísticos.',
      'Empresas con programas de inocuidad y calidad.',
    ],
    message:
      'Hola, deseo información sobre la solución Control Digital de BioPests.',
  },
  'Exter Fly': {
    lead:
      'Sistema profesional para el control de insectos voladores mediante equipos diseñados para áreas empresariales sensibles.',
    benefits: [
      'Captura eficiente de insectos voladores.',
      'Operación discreta dentro de espacios comerciales.',
      'Apoyo a los programas de higiene e inocuidad.',
      'Instalación estratégica según el nivel de riesgo.',
    ],
    applications: [
      'Restaurantes y áreas de preparación de alimentos.',
      'Industrias, almacenes y comercios.',
      'Áreas de recepción, producción y despacho.',
    ],
    message:
      'Hola, quiero conocer más sobre la tecnología Exter Fly de BioPests.',
  },
  'Allspray Natural': {
    lead:
      'Solución de descarga total formulada con piretrinas naturales para intervenciones rápidas y responsables.',
    benefits: [
      'Aplicación rápida en espacios previamente evaluados.',
      'Uso de piretrinas naturales.',
      'Apoyo en intervenciones correctivas programadas.',
      'Cobertura integral del área tratada.',
    ],
    applications: [
      'Áreas cerradas que requieren intervención puntual.',
      'Almacenes, oficinas y espacios empresariales.',
      'Programas profesionales de control integrado.',
    ],
    message:
      'Hola, deseo información sobre Allspray Natural de BioPests.',
  },
}

const CERTIFICATIONS = [
  {
    name: 'ISO 9001:2015',
    image:
      '/assets/biopestrd/certifications/iso-9001-2015.png',
  },
  {
    name: 'Accurate Global Management Certification',
    image:
      '/assets/biopestrd/certifications/accurate-global.png',
  },
]

const PERMITS = [
  {
    title: 'Registro de Agricultura',
    description:
      'Cumplimiento para servicios especializados.',
    icon: <FaLeaf />,
  },
  {
    title: 'Permisos de no objeción',
    description:
      'Documentación requerida para la operación.',
    icon: <FaFileAlt />,
  },
  {
    title: 'Permisos de Salud Pública',
    description:
      'Protocolos orientados a la protección sanitaria.',
    icon: <FaHeartbeat />,
  },
  {
    title: 'Constancia Ambiental',
    description:
      'Compromiso con prácticas responsables.',
    icon: <FaShieldAlt />,
  },
]

const CLIENTS = [
  {
    name: 'DC',
    image: '/assets/biopestrd/clients/dc.png',
  },
  {
    name: 'Editora Corripio',
    image: '/assets/biopestrd/clients/editora-corripio.png',
  },
  {
    name: 'Envases Tropicales',
    image: '/assets/biopestrd/clients/envases-tropicales.png',
  },
  {
    name: 'Fenwal',
    image: '/assets/biopestrd/clients/fenwal.png',
  },
  {
    name: 'Huevos Don Papito',
    image: '/assets/biopestrd/clients/huevos-don-papito.png',
  },
  {
    name: 'Trigas del Caribe',
    image: '/assets/biopestrd/clients/trigas-del-caribe.png',
  },
  {
    name: 'LOQ Mini Naves',
    image: '/assets/biopestrd/clients/loq-mini-naves.png',
  },
  {
    name: 'Biker Burger',
    image: '/assets/biopestrd/clients/biker-burger.png',
  },
  {
    name: 'Brazaí',
    image: '/assets/biopestrd/clients/brazai.png',
  },
]

const FAQS = [
  {
    question:
      '¿Atienden empresas e instalaciones de gran escala?',
    answer:
      'Sí. BioPests está orientada al manejo integral de plagas para empresas, industrias, comercios, logística y operaciones que requieren continuidad y seguimiento.',
  },
  {
    question:
      '¿El servicio incluye monitoreo y seguimiento?',
    answer:
      'El enfoque es preventivo. Según el plan acordado, se realizan inspecciones, registros, monitoreo y recomendaciones para reducir recurrencias.',
  },
  {
    question:
      '¿Utilizan productos responsables con el ambiente?',
    answer:
      'La propuesta prioriza productos de baja toxicidad y alta efectividad, aplicados mediante protocolos que reducen el impacto en las áreas de trabajo.',
  },
  {
    question: '¿Cómo solicito una evaluación?',
    answer:
      'Puede escribir por WhatsApp, llamar o enviar un correo. El equipo recopilará los datos básicos de la instalación para orientar el próximo paso.',
  },
]

const whatsappUrl = (message: string) =>
  `https://wa.me/${BIOPESTS.whatsappRaw}?text=${encodeURIComponent(
    message,
  )}`

const mapUrl =
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    'Biopest',
  )}`

const emailUrl =
  `mailto:${BIOPESTS.email}?subject=${encodeURIComponent(
    'Solicitud de información — BioPests',
  )}`

const vcardContent = [
  'BEGIN:VCARD',
  'VERSION:3.0',
  `FN:${BIOPESTS.name}`,
  `ORG:${BIOPESTS.name}`,
  `TEL;TYPE=CELL:${BIOPESTS.phoneRaw}`,
  `TEL;TYPE=WORK:${BIOPESTS.phoneSecondaryRaw}`,
  `EMAIL:${BIOPESTS.email}`,
  `URL:${BIOPESTS.instagramUrl}`,
  `ADR;TYPE=WORK:;;${BIOPESTS.address};;;;`,
  'END:VCARD',
].join('\r\n')

const vcardUrl =
  `data:text/vcard;charset=utf-8,${encodeURIComponent(
    vcardContent,
  )}`

type QuickActionProps = {
  href: string
  label: string
  icon: ReactNode
  external?: boolean
  download?: string
}

function QuickAction({
  href,
  label,
  icon,
  external = false,
  download,
}: QuickActionProps) {
  return (
    <a
      href={href}
      className="biopests-quick__item"
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      download={download}
    >
      <span aria-hidden="true">{icon}</span>
      <strong>{label}</strong>
    </a>
  )
}

function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
}: {
  eyebrow: string
  title: string
  description?: string
  align?: 'left' | 'center'
}) {
  return (
    <header
      className={`biopests-section-head biopests-section-head--${align}`}
    >
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </header>
  )
}



// CINTILLO DE PLAGAS BIOPESTS
const METHODOLOGY_PESTS = [
  'Cucarachas',
  'Hormigas',
  'Moscas',
  'Mosquitos',
  'Ratas',
  'Termitas',
  'Arañas',
  'Escarabajos',
]


// ADN CORPORATIVO REPLICA SERVICIOS V7
const BIOPESTS_VALUES = [
  {
    eyebrow: 'RESPALDO Y SEGUIMIENTO',
    title: 'Garantía total',
    summary:
      'Supervisión, control y acompañamiento documentado en cada intervención.',
    intro:
      'Cada servicio queda respaldado mediante seguimiento técnico, verificación posterior y trazabilidad operativa.',
    detailTitle: '¿Qué respalda esta garantía?',
    details: [
      'Monitoreo periódico de los puntos tratados.',
      'Seguimiento documentado por intervención.',
      'Recomendaciones preventivas para reducir riesgos.',
    ],
    applicationsTitle: '¿Dónde aporta más valor?',
    applications: [
      'Empresas con procesos sensibles o auditables.',
      'Operaciones que requieren evidencia y seguimiento.',
      'Instalaciones que buscan continuidad preventiva.',
    ],
    image:
      '/assets/biopestrd/values/garantia-total.svg',
    imageAlt:
      'Ilustración de seguimiento, verificación y garantía BioPests',
  },
  {
    eyebrow: 'RESPONSABILIDAD AMBIENTAL',
    title: 'Ética ambiental',
    summary:
      'Aplicaciones responsables para proteger personas, instalaciones y entorno.',
    intro:
      'Intervenimos con criterios técnicos responsables, seleccionando soluciones acordes con cada espacio y necesidad.',
    detailTitle: 'Principios de aplicación',
    details: [
      'Productos seleccionados según cada entorno.',
      'Aplicaciones estratégicas y controladas.',
      'Uso racional de recursos durante la intervención.',
    ],
    applicationsTitle: 'Beneficios para la operación',
    applications: [
      'Mayor confianza en procesos responsables.',
      'Protección del entorno de trabajo.',
      'Mejor percepción de control e inocuidad.',
    ],
    image:
      '/assets/biopestrd/values/etica-ambiental.svg',
    imageAlt:
      'Ilustración de protección ambiental y aplicación responsable',
  },
  {
    eyebrow: 'EVOLUCIÓN CONSTANTE',
    title: 'Innovación',
    summary:
      'Capacitación y herramientas para responder con mayor precisión.',
    intro:
      'Integramos mejora continua, análisis y recursos tecnológicos para fortalecer las decisiones preventivas.',
    detailTitle: '¿En qué se refleja?',
    details: [
      'Capacitación continua del personal técnico.',
      'Mejor lectura de hallazgos y prioridades.',
      'Procesos más claros para observar y responder.',
    ],
    applicationsTitle: 'Impacto en el servicio',
    applications: [
      'Mayor precisión en la toma de decisiones.',
      'Comunicación más clara con el cliente.',
      'Adaptación constante según cada reto.',
    ],
    image:
      '/assets/biopestrd/values/innovacion.svg',
    imageAlt:
      'Ilustración de análisis, tecnología e innovación BioPests',
  },
]

export default function IntapProfileBioPests() {
  const [activeHero, setActiveHero] = useState(0)

  // MODAL ADN CORPORATIVO V5
  const [selectedValueIndex, setSelectedValueIndex] = useState<number | null>(null)

  const selectedValue =
    selectedValueIndex !== null
      ? BIOPESTS_VALUES[selectedValueIndex]
      : null


  // SLIDER AUTOMATICO BIOPESTS
  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveHero(
        (current) => (current + 1) % HERO_IMAGES.length,
      )
    }, 4500)



  return () => window.clearInterval(timer)
  }, [])
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [servicesModalOpen, setServicesModalOpen] =
    useState(false)
  const [selectedServiceIndex, setSelectedServiceIndex] =
    useState<number | null>(null)
  const [technologyModalOpen, setTechnologyModalOpen] =
    useState(false)
  const [selectedTechnologyIndex, setSelectedTechnologyIndex] =
    useState<number | null>(null)

  // CONTROL DEL MODAL DE SERVICIOS BIOPESTS
  useEffect(() => {
    if (!servicesModalOpen) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow

    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setServicesModalOpen(false)
        setSelectedServiceIndex(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [servicesModalOpen])

  // CONTROL DEL MODAL DE TECNOLOGIA BIOPESTS
  useEffect(() => {
    if (!technologyModalOpen) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow

    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setTechnologyModalOpen(false)
        setSelectedTechnologyIndex(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [technologyModalOpen])

  // CONTROL MODAL ADN REPLICA SERVICIOS V7
  useEffect(() => {
    if (selectedValueIndex === null) {
      return undefined
    }

    const previousOverflow =
      document.body.style.overflow

    document.body.style.overflow = 'hidden'

    const handleKeyDown = (
      event: globalThis.KeyboardEvent,
    ) => {
      if (event.key === 'Escape') {
        setSelectedValueIndex(null)
      }
    }

    window.addEventListener(
      'keydown',
      handleKeyDown,
    )

    return () => {
      document.body.style.overflow =
        previousOverflow

      window.removeEventListener(
        'keydown',
        handleKeyDown,
      )
    }
  }, [selectedValueIndex])

  return (
    <main className="biopests-page">
      <div className="biopests-shell">
        <section
          className="biopests-cover"
          aria-label="Galería principal de BioPests"
        >
          <div className="biopests-cover__media">
            {HERO_IMAGES.map((image, index) => (
              <img
                key={image.src}
                src={image.src}
                alt={index === activeHero ? image.alt : ''}
                aria-hidden={index !== activeHero}
                className={
                  index === activeHero ? 'is-active' : ''
                }
              />
            ))}
          </div>

          <div
            className="biopests-cover__dots"
            aria-label="Seleccionar imagen principal"
          >
            {HERO_IMAGES.map((image, index) => (
              <button
                key={image.src}
                type="button"
                className={
                  index === activeHero ? 'is-active' : ''
                }
                onClick={() => setActiveHero(index)}
                aria-label={`Ver imagen ${index + 1}`}
                aria-pressed={index === activeHero}
              />
            ))}
          </div>
        </section>

        <div className="biopests-logo">
          <img src={BIOPESTS.logo} alt="BioPests" />
        </div>

        <section className="biopests-identity">
<h2>{BIOPESTS.tagline}</h2>

          <p className="biopests-identity__headline">
            {BIOPESTS.headline}
          </p>

          <p className="biopests-identity__description">
            {BIOPESTS.description}
          </p>

          <div className="biopests-actions">
            <a
              className="biopests-btn biopests-btn--primary"
              href={whatsappUrl(
                'Hola, vi el perfil digital de BioPests y deseo solicitar una evaluación para mi empresa.',
              )}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FaWhatsapp aria-hidden="true" />
              Hablar por WhatsApp
            </a>
          </div>
        </section>

        <nav
          className="biopests-quick"
          aria-label="Accesos rápidos de BioPests"
        >
          <QuickAction
            icon={<FaPhoneAlt />}
            label="Llamar"
            href={`tel:+${BIOPESTS.phoneRaw}`}
          />

          <QuickAction
            icon={<FaWhatsapp />}
            label="WhatsApp"
            href={whatsappUrl(
              'Hola, vi el perfil digital de BioPests y deseo información sobre sus servicios.',
            )}
            external
          />

          <QuickAction
            icon={<FaInstagram />}
            label="Instagram"
            href={BIOPESTS.instagramUrl}
            external
          />

          <QuickAction
            icon={<FaAddressCard />}
            label="Guardar contacto"
            href={vcardUrl}
            download="BioPests.vcf"
          />
        </nav>

        <section className="biopests-intro">
          <span className="biopests-section-label">
            LIDERAZGO EN EL SECTOR
          </span>

          <h3>
            Manejo integral respaldado por una estructura
            empresarial sólida.
          </h3>

          <p>
            BioPests opera bajo altos estándares para proteger la
            salud, la calidad de vida y la continuidad operativa de
            grandes corporaciones.
          </p>

          <div className="biopests-proof">
            <article>
              <strong>Atención empresarial</strong>
              <span>Planes adaptados a cada instalación.</span>
            </article>

            <article>
              <strong>Enfoque preventivo</strong>
              <span>Inspección, seguimiento y control.</span>
            </article>

            <article>
              <strong>Santo Domingo</strong>
              <span>{BIOPESTS.phone}</span>
            </article>
          </div>
        </section>

        <section className="biopests-section biopests-values-section-v7">
          <SectionHeading
            eyebrow="ADN CORPORATIVO"
            title="Principios que respaldan cada servicio."
            description="Una operación responsable necesita garantía, innovación y respeto por el entorno."
          />

          <div className="biopests-services-featured biopests-values-featured-v7">
            {BIOPESTS_VALUES.map((value, index) => (
              <button
                key={value.title}
                type="button"
                className="biopests-service-feature-card"
                onClick={() => setSelectedValueIndex(index)}
              >
                <div className="biopests-service-feature-card__media">
                  <img
                    src={value.image}
                    alt={value.imageAlt}
                    loading="lazy"
                  />
                </div>

                <div className="biopests-service-feature-card__body">
                  <small>{value.eyebrow}</small>
                  <h3>{value.title}</h3>
                  <p>{value.summary}</p>
                  <strong>Ver detalles</strong>
                </div>
              </button>
            ))}
          </div>

          {selectedValue && (
            <div
              className="biopests-services-modal-overlay"
              role="presentation"
              onMouseDown={() => setSelectedValueIndex(null)}
            >
              <section
                className="biopests-services-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="biopests-value-detail-title"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  className="biopests-services-modal__close"
                  aria-label="Cerrar detalle"
                  onClick={() => setSelectedValueIndex(null)}
                >
                  ×
                </button>

                <div className="biopests-service-detail">
                  <div className="biopests-service-detail__media">
                    <img
                      src={selectedValue.image}
                      alt={selectedValue.imageAlt}
                    />
                  </div>

                  <div className="biopests-service-detail__content">
                    <span>{selectedValue.eyebrow}</span>

                    <h2 id="biopests-value-detail-title">
                      {selectedValue.title}
                    </h2>

                    <p className="biopests-service-detail__lead">
                      {selectedValue.summary}
                    </p>

                    <p className="biopests-service-detail__description">
                      {selectedValue.intro}
                    </p>

                    <div className="biopests-service-detail__panel">
                      <h3>{selectedValue.detailTitle}</h3>

                      <ul>
                        {selectedValue.details.map((item) => (
                          <li key={item}>
                            <FaCheckCircle aria-hidden="true" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="biopests-service-detail__panel">
                      <h3>{selectedValue.applicationsTitle}</h3>

                      <ul>
                        {selectedValue.applications.map((item) => (
                          <li key={item}>
                            <FaCheckCircle aria-hidden="true" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <a
                      href={whatsappUrl(
                        `Hola, deseo información sobre ${selectedValue.title} en BioPests.`,
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="biopests-service-detail__whatsapp"
                    >
                      <FaWhatsapp aria-hidden="true" />
                      Consultar por WhatsApp
                    </a>
                  </div>
                </div>
              </section>
            </div>
          )}
        </section>

        <section
          id="servicios"
          className="biopests-section biopests-services"
        >
          <SectionHeading
            eyebrow="NUESTROS SERVICIOS"
            title="Soluciones para proteger cada punto crítico."
            description="Conoce dos de nuestras soluciones principales o explora el portafolio completo."
          />

          <div className="biopests-services-featured">
            {[0, 4].map((serviceIndex) => {
              const service = SERVICES[serviceIndex]

              return (
                <button
                  key={service.title}
                  type="button"
                  className="biopests-service-feature-card"
                  onClick={() => {
                    setSelectedServiceIndex(serviceIndex)
                    setServicesModalOpen(true)
                  }}
                >
                  <div className="biopests-service-feature-card__media">
                    <img
                      src={service.image}
                      alt={service.title}
                      loading="lazy"
                    />
                  </div>

                  <div className="biopests-service-feature-card__body">
                    <small>SERVICIO EMPRESARIAL</small>
                    <h3>{service.title}</h3>
                    <p>{service.description}</p>
                    <strong>Toca para conocer el servicio</strong>
                  </div>
                </button>
              )
            })}
          </div>

          <button
            type="button"
            className="biopests-services-all-button"
            onClick={() => {
              setSelectedServiceIndex(null)
              setServicesModalOpen(true)
            }}
          >
            Ver todos los servicios
          </button>
        </section>

        <section className="biopests-section biopests-methodology">
          <SectionHeading
            eyebrow="NUESTRA METODOLOGÍA"
            title="Un proceso pensado para anticipar riesgos."
            description="El control efectivo comienza con análisis, precisión y seguimiento."
          />

          <div className="biopests-methodology-stage">
            <article
              className="
                biopests-methodology-card
                biopests-methodology-card--analysis
              "
            >
              <img
                src="/assets/biopestrd/methodology/digital-monitoring-security.png"
                alt="Análisis, monitoreo y control digital de BioPests"
                className="
                  biopests-methodology-card__image
                  biopests-methodology-card__image--analysis
                "
              />
            </article>

            <article
              className="
                biopests-methodology-card
                biopests-methodology-card--pests
              "
            >
              <div
                className="biopests-methodology-card__scanner"
                aria-hidden="true"
              />

              <div
                className="biopests-methodology-card__pulse"
                aria-hidden="true"
              />

              <img
                src="/assets/biopestrd/methodology/pest-control-spectrum.png"
                alt="Plagas controladas por BioPests"
                className="
                  biopests-methodology-card__image
                  biopests-methodology-card__image--pests
                "
              />
            </article>
          </div>

          <div
            className="biopests-methodology-pest-strip"
            aria-label="Plagas controladas por BioPests"
            tabIndex={0}
          >
            <div className="biopests-methodology-pest-strip__track">
              {[0, 1].map((groupIndex) => (
                <div
                  key={groupIndex}
                  className="
                    biopests-methodology-pest-strip__group
                  "
                  aria-hidden={
                    groupIndex === 1 ? true : undefined
                  }
                >
                  {METHODOLOGY_PESTS.map((pest) => (
                    <span
                      key={`${groupIndex}-${pest}`}
                      className="
                        biopests-methodology-pest-strip__item
                      "
                    >
                      <span
                        className="
                          biopests-methodology-pest-strip__dot
                        "
                        aria-hidden="true"
                      />

                      {pest}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>

        </section>

        <section className="biopests-section biopests-technology">
          <SectionHeading
            eyebrow="TECNOLOGÍA DE ÚLTIMA GENERACIÓN"
            title="Herramientas para observar, anticipar y responder."
            description="Conoce las soluciones tecnológicas que fortalecen nuestros programas de prevención y control."
          />

          <div className="biopests-technology-showcase">
            {TECHNOLOGY.map((technology, index) => (
              <button
                key={technology.title}
                type="button"
                className={`biopests-technology-showcase-card ${
                  index === 2
                    ? 'biopests-technology-showcase-card--wide'
                    : ''
                }`}
                onClick={() => {
                  setSelectedTechnologyIndex(index)
                  setTechnologyModalOpen(true)
                }}
              >
                <div className="biopests-technology-showcase-card__media">
                  <img
                    src={technology.image}
                    alt={technology.title}
                    loading="lazy"
                  />
                </div>

                <div className="biopests-technology-showcase-card__body">
                  <small>{technology.eyebrow}</small>
                  <h3>{technology.title}</h3>
                  <p>{technology.description}</p>
                  <strong>Toca para conocer la tecnología</strong>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="biopests-trust">
          <div
            className="biopests-trust__glow"
            aria-hidden="true"
          />

          <header className="biopests-trust__intro">
            <span className="biopests-trust__eyebrow">
              RESPALDO INSTITUCIONAL
            </span>

            <h2>
              Certificaciones y permisos que respaldan cada
              operación.
            </h2>

            <p>
              Calidad, cumplimiento y trazabilidad para ofrecer
              soluciones empresariales con mayor confianza.
            </p>

            <div className="biopests-trust__seal">
              <span aria-hidden="true">
                <FaShieldAlt />
              </span>

              <div>
                <strong>Operación respaldada</strong>
                <small>
                  Calidad, responsabilidad y control documentado
                </small>
              </div>
            </div>
          </header>

          <div className="biopests-certifications">
            {CERTIFICATIONS.map((certification, index) => (
              <article key={certification.name}>
                <div className="biopests-certifications__logo">
                  <img
                    src={certification.image}
                    alt={certification.name}
                    loading="lazy"
                  />
                </div>

                <div className="biopests-certifications__copy">
                  <small>
                    {index === 0
                      ? 'GESTIÓN DE CALIDAD'
                      : 'CERTIFICACIÓN GLOBAL'}
                  </small>

                  <strong>{certification.name}</strong>

                  <span>
                    <FaCheckCircle aria-hidden="true" />
                    Respaldo institucional
                  </span>
                </div>
              </article>
            ))}
          </div>

          <div className="biopests-permits-heading">
            <span>DOCUMENTACIÓN OPERATIVA</span>
            <h3>Permisos y registros</h3>
          </div>

          <div className="biopests-permits">
            {PERMITS.map((permit) => (
              <article key={permit.title}>
                <span aria-hidden="true">
                  {permit.icon}
                </span>

                <div>
                  <strong>{permit.title}</strong>
                  <small>{permit.description}</small>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="biopests-section biopests-clients">
          <div className="biopests-clients__header">
            <SectionHeading
              eyebrow="NUESTROS CLIENTES"
              title="Empresas que confían en nuestro trabajo."
              description="Organizaciones que han confiado en BioPests para proteger sus instalaciones y operaciones."
            />
          </div>

          <div
            className="biopests-clients-marquee"
            aria-label="Portafolio de clientes BioPests"
          >
            <div className="biopests-clients-marquee__track">
              {[0, 1].map((groupIndex) => (
                <div
                  key={groupIndex}
                  className="biopests-clients-marquee__group"
                  aria-hidden={
                    groupIndex === 1 ? true : undefined
                  }
                >
                  {CLIENTS.map((client) => {
                    const duplicate = groupIndex === 1

                    return (
                      <div
                        key={`${groupIndex}-${client.name}`}
                        className="biopests-client-logo"
                        tabIndex={duplicate ? -1 : 0}
                        role={duplicate ? undefined : 'img'}
                        aria-label={
                          duplicate
                            ? undefined
                            : `Cliente BioPests: ${client.name}`
                        }
                      >
                        <img
                          src={client.image}
                          alt={duplicate ? '' : client.name}
                          loading="lazy"
                        />
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="biopests-section biopests-faq">
          <SectionHeading
            eyebrow="PREGUNTAS FRECUENTES"
            title="Información rápida antes de solicitar una evaluación."
          />

          <div className="biopests-faq-list">
            {FAQS.map((item, index) => {
              const isOpen = openFaq === index

              return (
                <article
                  key={item.question}
                  className={isOpen ? 'is-open' : ''}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setOpenFaq(isOpen ? null : index)
                    }
                    aria-expanded={isOpen}
                  >
                    <span>{item.question}</span>
                    <FaChevronDown aria-hidden="true" />
                  </button>

                  {isOpen ? <p>{item.answer}</p> : null}
                </article>
              )
            })}
          </div>
        </section>

        <section className="biopests-contact">
          <span>PREVENCIÓN Y CORRECCIÓN EMPRESARIAL</span>

          <h2>Estamos listos para optimizar su entorno.</h2>

          <p>
            Comparta las características de su instalación y nuestro
            equipo le orientará sobre el próximo paso.
          </p>

          <a
            className="biopests-contact__cta"
            href={whatsappUrl(
              'Hola, deseo solicitar una evaluación empresarial con BioPests.',
            )}
            target="_blank"
            rel="noopener noreferrer"
          >
            <FaWhatsapp aria-hidden="true" />
            Solicitar evaluación
          </a>

          <div className="biopests-contact-list">
            <a href={`tel:+${BIOPESTS.phoneRaw}`}>
              <FaPhoneAlt aria-hidden="true" />

              <span>
                <small>Teléfono principal</small>
                <strong>{BIOPESTS.phone}</strong>
              </span>
            </a>

            <a href={`tel:+${BIOPESTS.phoneSecondaryRaw}`}>
              <FaPhoneAlt aria-hidden="true" />

              <span>
                <small>Teléfono alternativo</small>
                <strong>{BIOPESTS.phoneSecondary}</strong>
              </span>
            </a>

            <a href={emailUrl}>
              <FaEnvelope aria-hidden="true" />

              <span>
                <small>Correo</small>
                <strong>{BIOPESTS.email}</strong>
              </span>
            </a>

            <a
              href={mapUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FaMapMarkerAlt aria-hidden="true" />

              <span>
                <small>Dirección</small>
                <strong>{BIOPESTS.address}</strong>
              </span>
            </a>
          </div>
        </section>

        <footer className="biopests-footer">
          <img src={BIOPESTS.logo} alt="BioPests" />
          <strong>{BIOPESTS.tagline}</strong>
          <span>Santo Domingo, República Dominicana</span>
          <small>Perfil digital creado por INTAP LINK</small>
        </footer>
      </div>

      {/* MODAL DE TECNOLOGIA BIOPESTS */}
      {technologyModalOpen &&
      selectedTechnologyIndex !== null ? (
        <div
          className="biopests-technology-modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setTechnologyModalOpen(false)
              setSelectedTechnologyIndex(null)
            }
          }}
        >
          <section
            className="biopests-technology-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Detalles de ${
              TECHNOLOGY[selectedTechnologyIndex].title
            }`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="biopests-technology-modal__close"
              aria-label="Cerrar tecnología"
              onClick={() => {
                setTechnologyModalOpen(false)
                setSelectedTechnologyIndex(null)
              }}
            >
              ×
            </button>

            {(() => {
              const technology =
                TECHNOLOGY[selectedTechnologyIndex]

              const details =
                TECHNOLOGY_DETAILS[technology.title]

              return (
                <div className="biopests-technology-detail">
                  <div className="biopests-technology-detail__media">
                    <img
                      src={technology.image}
                      alt={technology.title}
                    />
                  </div>

                  <div className="biopests-technology-detail__content">
                    <span>{technology.eyebrow}</span>

                    <h2>{technology.title}</h2>

                    <p className="biopests-technology-detail__lead">
                      {details.lead}
                    </p>

                    <section className="biopests-technology-detail__panel">
                      <h3>Beneficios</h3>

                      <ul>
                        {details.benefits.map((benefit) => (
                          <li key={benefit}>
                            <FaCheckCircle aria-hidden="true" />
                            <span>{benefit}</span>
                          </li>
                        ))}
                      </ul>
                    </section>

                    <section className="biopests-technology-detail__panel">
                      <h3>Aplicaciones</h3>

                      <ul>
                        {details.applications.map((application) => (
                          <li key={application}>
                            <FaCheckCircle aria-hidden="true" />
                            <span>{application}</span>
                          </li>
                        ))}
                      </ul>
                    </section>

                    <a
                      className="biopests-technology-detail__whatsapp"
                      href={whatsappUrl(details.message)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <FaWhatsapp aria-hidden="true" />
                      Consultar por WhatsApp
                    </a>
                  </div>
                </div>
              )
            })()}
          </section>
        </div>
      ) : null}

      {/* MODAL DE SERVICIOS BIOPESTS */}
      {servicesModalOpen ? (
        <div
          className="biopests-services-modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setServicesModalOpen(false)
              setSelectedServiceIndex(null)
            }
          }}
        >
          <section
            className="biopests-services-modal"
            role="dialog"
            aria-modal="true"
            aria-label={
              selectedServiceIndex === null
                ? 'Todos los servicios de BioPests'
                : `Detalles de ${
                    SERVICES[selectedServiceIndex].title
                  }`
            }
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="biopests-services-modal__close"
              aria-label="Cerrar servicios"
              onClick={() => {
                setServicesModalOpen(false)
                setSelectedServiceIndex(null)
              }}
            >
              ×
            </button>

            {selectedServiceIndex === null ? (
              <div className="biopests-services-gallery">
                <header>
                  <span>PORTAFOLIO DE SOLUCIONES</span>
                  <h2>Todos nuestros servicios</h2>
                  <p>
                    Selecciona una solución para conocer sus
                    beneficios, alcance y aplicaciones.
                  </p>
                </header>

                <div className="biopests-services-gallery__grid">
                  {SERVICES.map((service, index) => (
                    <article
                      key={service.title}
                      className="biopests-services-gallery-card"
                    >
                      <div className="biopests-services-gallery-card__media">
                        <img
                          src={service.image}
                          alt={service.title}
                          loading="lazy"
                        />
                      </div>

                      <div className="biopests-services-gallery-card__body">
                        <small>SERVICIO BIOPESTS</small>
                        <h3>{service.title}</h3>
                        <p>{service.description}</p>

                        <button
                          type="button"
                          onClick={() =>
                            setSelectedServiceIndex(index)
                          }
                        >
                          Ver detalles
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : (
              (() => {
                const service =
                  SERVICES[selectedServiceIndex]

                const details =
                  SERVICE_DETAILS[service.title]

                return (
                  <div className="biopests-service-detail">
                    <div className="biopests-service-detail__media">
                      <img
                        src={service.image}
                        alt={service.title}
                      />
                    </div>

                    <div className="biopests-service-detail__content">
                      <span>SERVICIO EMPRESARIAL</span>
                      <h2>{service.title}</h2>
                      <p className="biopests-service-detail__lead">
                        {service.description}
                      </p>

                      <p className="biopests-service-detail__description">
                        {service.detail}
                      </p>

                      <section className="biopests-service-detail__panel">
                        <h3>Beneficios</h3>

                        <ul>
                          {details.benefits.map((benefit) => (
                            <li key={benefit}>
                              <FaCheckCircle
                                aria-hidden="true"
                              />
                              <span>{benefit}</span>
                            </li>
                          ))}
                        </ul>
                      </section>

                      <section className="biopests-service-detail__panel">
                        <h3>Ideal para</h3>

                        <ul>
                          {details.idealFor.map((item) => (
                            <li key={item}>
                              <FaCheckCircle
                                aria-hidden="true"
                              />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </section>

                      <a
                        className="biopests-service-detail__whatsapp"
                        href={whatsappUrl(service.message)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <FaWhatsapp aria-hidden="true" />
                        Consultar por WhatsApp
                      </a>

                      <button
                        type="button"
                        className="biopests-service-detail__back"
                        onClick={() =>
                          setSelectedServiceIndex(null)
                        }
                      >
                        Volver a todos los servicios
                      </button>
                    </div>
                  </div>
                )
              })()
            )}
          </section>
        </div>
      ) : null}

      <a
        className="biopests-floating-whatsapp"
        href={whatsappUrl(
          'Hola, vi el perfil digital de BioPests y deseo recibir asistencia.',
        )}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Contactar BioPests por WhatsApp"
      >
        <FaWhatsapp aria-hidden="true" />
        <span>1</span>
      </a>
    </main>
  )
}
