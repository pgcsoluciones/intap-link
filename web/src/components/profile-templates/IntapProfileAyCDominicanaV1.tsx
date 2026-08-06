import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { FaAddressCard, FaArrowRight, FaCheckCircle, FaChevronDown, FaCogs, FaCut, FaFacebookF, FaGlobe, FaIndustry, FaInstagram, FaMapMarkerAlt, FaPhoneAlt, FaProjectDiagram, FaShareAlt, FaTimes, FaTools, FaWhatsapp, FaWrench, FaEnvelope } from 'react-icons/fa'
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

type HeroImage = {
  src: string
  alt: string
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

function upsertAyCMeta(
  selector: string,
  attribute: 'name' | 'property',
  key: string,
  value: string,
) {
  let element =
    document.head.querySelector<HTMLMetaElement>(
      selector,
    )

  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.appendChild(element)
  }

  element.content = value
}

function upsertAyCCanonical(value: string) {
  let canonical =
    document.head.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    )

  if (!canonical) {
    canonical = document.createElement('link')
    canonical.rel = 'canonical'
    document.head.appendChild(canonical)
  }

  canonical.href = value
}

function filenameSlug(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
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
  const [activeHero, setActiveHero] = useState(0)

  const name = pick(profile.companyName, profile.company_name, profile.name, td.company_name, 'A&C Dominicana, S.R.L.')
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
  const mapUrl = pick(profile.mapUrl, profile.map_url, td.map_url, `https://maps.google.com/?q=${encodeURIComponent(address)}`)
  const mapEmbedUrl = pick(td.map_embed_url, `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`)
  const instagramUrl = pick(td.instagram_url, 'https://www.instagram.com/aycdominicana/')
  const facebookUrl = pick(td.facebook_url, 'https://www.facebook.com/aycdominicana/')

  const logo = pick(profile.companyLogo, profile.company_logo, td.logo_url, '/assets/aycdom/logo/logo-ayc.png')
  const contactName = pick(td.contact_name, 'Mario Medina')
  const contactTitle = pick(td.contact_title, 'Sales Engineer')
  const mobilePhone = pick(td.mobile_phone, '809-816-3911')
  const vcardFilename = pick(
    td.vcard_filename,
    `${filenameSlug(contactName)}-ayc-dominicana.vcf`,
  )

  useEffect(() => {
    const socialTitle =
      `${contactName} | ${contactTitle} de A&C Dominicana`

    const socialDescription =
      'Integramos diseño técnico, mecanizado, soldadura, fabricación de equipos, automatización e instalación dentro de una misma solución.'

    const currentSlug =
      window.location.pathname
        .replace(/^\/+|\/+$/g, '')
        .toLowerCase() || 'aycdom'

    const socialUrl = pick(
      td.canonical_url,
      `https://intaprd.com/${currentSlug}`,
    )

    const socialImage = pick(
      td.social_image_url,
      currentSlug === 'aycdom'
        ? 'https://intaprd.com/assets/aycdom/social/perfil-link-ayc-10.png?v=aycdom-og-v1'
        : 'https://intaprd.com/assets/aycdom/logo/logo-ayc.png?v=aycdom-company-og-v1',
    )

    document.title = socialTitle

    upsertAyCMeta(
      'meta[name="description"]',
      'name',
      'description',
      socialDescription,
    )

    upsertAyCMeta(
      'meta[property="og:type"]',
      'property',
      'og:type',
      'profile',
    )

    upsertAyCMeta(
      'meta[property="og:site_name"]',
      'property',
      'og:site_name',
      'A&C Dominicana, S.R.L.',
    )

    upsertAyCMeta(
      'meta[property="og:title"]',
      'property',
      'og:title',
      socialTitle,
    )

    upsertAyCMeta(
      'meta[property="og:description"]',
      'property',
      'og:description',
      socialDescription,
    )

    upsertAyCMeta(
      'meta[property="og:url"]',
      'property',
      'og:url',
      socialUrl,
    )

    upsertAyCMeta(
      'meta[property="og:image"]',
      'property',
      'og:image',
      socialImage,
    )

    upsertAyCMeta(
      'meta[property="og:image:secure_url"]',
      'property',
      'og:image:secure_url',
      socialImage,
    )

    upsertAyCMeta(
      'meta[property="og:image:type"]',
      'property',
      'og:image:type',
      'image/png',
    )

    upsertAyCMeta(
      'meta[property="og:image:width"]',
      'property',
      'og:image:width',
      '676',
    )

    upsertAyCMeta(
      'meta[property="og:image:height"]',
      'property',
      'og:image:height',
      '675',
    )

    upsertAyCMeta(
      'meta[property="og:image:alt"]',
      'property',
      'og:image:alt',
      socialTitle,
    )

    upsertAyCMeta(
      'meta[name="twitter:card"]',
      'name',
      'twitter:card',
      'summary',
    )

    upsertAyCMeta(
      'meta[name="twitter:title"]',
      'name',
      'twitter:title',
      socialTitle,
    )

    upsertAyCMeta(
      'meta[name="twitter:description"]',
      'name',
      'twitter:description',
      socialDescription,
    )

    upsertAyCMeta(
      'meta[name="twitter:image"]',
      'name',
      'twitter:image',
      socialImage,
    )

    upsertAyCMeta(
      'meta[name="twitter:image:alt"]',
      'name',
      'twitter:image:alt',
      socialTitle,
    )

    upsertAyCCanonical(socialUrl)
  }, [
    contactName,
    contactTitle,
    td.canonical_url,
    td.social_image_url,
  ])

  const heroImages = useMemo(
    () =>
      safeJsonArray<HeroImage>(
        td.hero_images_json,
        [
          {
            src: '/assets/aycdom/hero/hero-ayc-01.png',
            alt: 'Solución industrial de A&C Dominicana',
          },
          {
            src: '/assets/aycdom/hero/hero-ayc-02.png',
            alt: 'Equipos y procesos industriales de A&C Dominicana',
          },
          {
            src: '/assets/aycdom/hero/hero-ayc-03.png',
            alt: 'Metalmecánica y automatización industrial A&C',
          },
        ],
      ),
    [td.hero_images_json],
  )

  const services = useMemo(() => safeJsonArray<ServiceItem>(td.services_json, FALLBACK_SERVICES), [td.services_json])
  const projects = useMemo(() => safeJsonArray<ProjectItem>(td.projects_json, FALLBACK_PROJECTS), [td.projects_json])
  const faqs = useMemo(() => safeJsonArray<FaqItem>(td.faqs_json, FALLBACK_FAQS), [td.faqs_json])

  useEffect(() => {
    if (heroImages.length < 2) return undefined

    const timer = window.setInterval(() => {
      setActiveHero(
        (current) => (current + 1) % heroImages.length,
      )
    }, 4500)

    return () => window.clearInterval(timer)
  }, [heroImages.length])

  const waMessage = pick(td.whatsapp_message, 'Hola, vi su perfil en INTAP LINK y quiero solicitar información sobre una solución industrial.')
  const waHref = `https://wa.me/${cleanPhone(whatsapp)}?text=${encodeURIComponent(waMessage)}`
  const websiteHref = normalizeHttp(website)

  const downloadVCard = () => {
    const card = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `N:${escapeVCard(contactName)};;;;`,
      `FN:${escapeVCard(contactName)}`,
      `ORG:${escapeVCard(name)}`,
      `TITLE:${escapeVCard(contactTitle)}`,
      `TEL;TYPE=WORK,VOICE:${cleanPhone(phone)}`,
      `TEL;TYPE=CELL:${cleanPhone(mobilePhone)}`,
      `TEL;TYPE=CELL,WHATSAPP:${cleanPhone(whatsapp)}`,
      `EMAIL;TYPE=WORK:${email}`,
      `URL:${websiteHref}`,
      `ADR;TYPE=WORK:;;${escapeVCard(address)};;;;`,
      'END:VCARD',
    ].join('\r\n')

    const blob = new Blob([card], { type: 'text/vcard;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = vcardFilename
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

  const [isBrandPaused, setIsBrandPaused] = useState(false)
  const [isServicesCatalogOpen, setIsServicesCatalogOpen] =
    useState(false)
  const [activeServiceIndex, setActiveServiceIndex] =
    useState<number | null>(null)
  const [isClientCarouselPaused, setIsClientCarouselPaused] =
    useState(false)
  const [activeClientLogo, setActiveClientLogo] =
    useState<string | null>(null)
  const clientPauseTimeoutRef =
    useRef<number | null>(null)
  const clientClickLockRef =
    useRef<string | null>(null)

  const clearClientPauseTimeout = () => {
    if (clientPauseTimeoutRef.current !== null) {
      window.clearTimeout(clientPauseTimeoutRef.current)
      clientPauseTimeoutRef.current = null
    }
  }

  const pauseClientCarousel = (logoKey: string) => {
    if (clientClickLockRef.current !== null) {
      return
    }

    clearClientPauseTimeout()
    setActiveClientLogo(logoKey)
    setIsClientCarouselPaused(true)
  }

  const releaseClientHover = () => {
    if (clientClickLockRef.current !== null) {
      return
    }

    clearClientPauseTimeout()
    setActiveClientLogo(null)
    setIsClientCarouselPaused(false)
  }

  const toggleClientPauseOnClick = (logoKey: string) => {
    if (clientClickLockRef.current === logoKey) {
      clearClientPauseTimeout()
      clientClickLockRef.current = null
      setActiveClientLogo(null)
      setIsClientCarouselPaused(false)
      return
    }

    clearClientPauseTimeout()
    clientClickLockRef.current = logoKey
    setActiveClientLogo(logoKey)
    setIsClientCarouselPaused(true)

    clientPauseTimeoutRef.current = window.setTimeout(() => {
      clientClickLockRef.current = null
      setActiveClientLogo(null)
      setIsClientCarouselPaused(false)
      clientPauseTimeoutRef.current = null
    }, 10000)
  }

  const brandLogos = [
    '/assets/aycdom/marcas/marcas-1.png',
    '/assets/aycdom/marcas/marcas-2.png',
    '/assets/aycdom/marcas/marcas-3.png',
    '/assets/aycdom/marcas/marcas-4.png',
    '/assets/aycdom/marcas/marcas-5.png',
    '/assets/aycdom/marcas/marcas-6.png',
    '/assets/aycdom/marcas/marcas-7.png',
    '/assets/aycdom/marcas/marcas-8.png',
  ]

  type AycServiceGroup = {
    title: string
    summary: string
    image: string
    items: string[]
  }

  const defaultServiceGroups: AycServiceGroup[] = [

    {
      title: 'Metalmecánica y mecanizado CNC',
      summary:
        'Fabricación y mecanizado de piezas industriales con precisión para aplicaciones técnicas y productivas.',
      image: '/assets/aycdom/services/metalmecanica.png',
      items: [
        'Fresado CNC',
        'Torneado CNC',
        'Rectificado',
        'Moldes y troqueles',
        'Tratamientos térmicos',
        'Diseño CAD en SolidWorks',
      ],
    },
    {
      title: 'Diseño y fabricación de equipos industriales',
      summary:
        'Desarrollo y construcción de soluciones industriales adaptadas al proceso de cada cliente.',
      image: '/assets/aycdom/services/equipos-industriales.png',
      items: [
        'Conveyors o cintas transportadoras',
        'Máquinas industriales',
        'Fixtures',
        'Soluciones industriales personalizadas',
      ],
    },
    {
      title: 'Automatización e instrumentación',
      summary:
        'Integración de control, monitoreo e instrumentación para optimizar procesos industriales.',
      image: '/assets/aycdom/services/automatizacion.png',
      items: [
        'Proyectos de control industrial',
        'Instrumentación industrial',
        'Neumática industrial',
        'Sistemas de pesaje',
      ],
    },
    {
      title: 'Corte, conformado y soldadura',
      summary:
        'Transformación de materiales y fabricación metálica para estructuras, piezas y montajes industriales.',
      image: '/assets/aycdom/services/soldadura.png',
      items: [
        'Corte láser CNC',
        'Corte y doblez de planchas',
        'Soldadura especializada',
        'Fabricación de estructuras metálicas',
        'Mobiliario industrial y montajes',
      ],
    },
    {
      title: 'Mantenimiento y reparación industrial',
      summary:
        'Servicios de soporte técnico para recuperar, conservar y mejorar el funcionamiento de equipos.',
      image: '/assets/aycdom/services/ayc-mantenimiento.png',
      items: [
        'Reparación de máquinas industriales',
        'Mantenimiento mecánico',
        'Mantenimiento eléctrico',
      ],
    },
    {
      title: 'Control de polvo y gases',
      summary:
        'Soluciones para control ambiental y manejo de partículas en operaciones industriales y de obra.',
      image: '/assets/aycdom/services/ayc-recolector-polvo.png',
      items: [
        'Colectores de polvo',
        'Cañones de niebla',
        'Control de polvo en vías y suelos',
      ],
    },
    {
      title: 'Partes, equipos y piezas personalizadas',
      summary:
        'Suministro y fabricación de componentes industriales comerciales o hechos a la medida.',
      image: '/assets/aycdom/services/piezas.png',
      items: [
        'Venta de partes comerciales',
        'Venta de máquinas industriales',
        'Piezas plásticas personalizadas',
        'Piezas metálicas personalizadas',
      ],
    },
  ]

  const serviceGroups: AycServiceGroup[] =
    Array.isArray(td.service_groups) &&
    td.service_groups.length > 0
      ? (
          td.service_groups as unknown as
            AycServiceGroup[]
        )
      : defaultServiceGroups

  const featuredServices: AycServiceGroup[] =
    serviceGroups.slice(0, 4)

  const clientLogos = [
    { src: "/assets/aycdom/clients/110-1101390_transparent-kappa-logo-png-smurfit-kappa-png-download.png", alt: "110 1101390 Transparent Kappa Logo Png Smurfit Kappa Png Download" },
    { src: "/assets/aycdom/clients/1388167873-5218398797_09600a512b_z.jpeg", alt: "1388167873 5218398797 09600A512B Z" },
    { src: "/assets/aycdom/clients/1630423547180.jpeg", alt: "1630423547180" },
    { src: "/assets/aycdom/clients/2560px-Baxter.svg.png", alt: "2560Px Baxter.Svg" },
    { src: "/assets/aycdom/clients/4-LOGO-CONVATEC-CLINICA.png", alt: "4 Logo Convatec Clinica" },
    { src: "/assets/aycdom/clients/Barrick_logo_Gold_Corporation.png", alt: "Barrick Logo Gold Corporation" },
    { src: "/assets/aycdom/clients/Cardinal_Health_Logo.png", alt: "Cardinal Health Logo" },
    { src: "/assets/aycdom/clients/GERDAU-METALDOM_Logo.jpeg", alt: "Gerdau Metaldom Logo" },
    { src: "/assets/aycdom/clients/Gildan_logo.png", alt: "Gildan Logo" },
    { src: "/assets/aycdom/clients/Grupo Mercasid.jpeg", alt: "Grupo Mercasid" },
    { src: "/assets/aycdom/clients/Grupo-Mallen-Logo.jpeg", alt: "Grupo Mallen Logo" },
    { src: "/assets/aycdom/clients/Induban.jpeg", alt: "Induban" },
    { src: "/assets/aycdom/clients/Induveca-Logo.jpeg", alt: "Induveca Logo" },
    { src: "/assets/aycdom/clients/Johnson-Johnson-Logo.jpeg", alt: "Johnson Johnson Logo" },
    { src: "/assets/aycdom/clients/Logo-Grupo-Bocel.jpeg", alt: "Logo Grupo Bocel" },
    { src: "/assets/aycdom/clients/Logo_Actual_de_EGE_Haina.png", alt: "Logo Actual De Ege Haina" },
    { src: "/assets/aycdom/clients/Punta-Catalina.png", alt: "Punta Catalina" },
    { src: "/assets/aycdom/clients/Sued-1-400x400.jpeg", alt: "Sued 1 400X400" },
    { src: "/assets/aycdom/clients/aes-dominicana.jpeg", alt: "Aes Dominicana" },
    { src: "/assets/aycdom/clients/agrifeedrd-logo.jpeg", alt: "Agrifeedrd Logo" },
    { src: "/assets/aycdom/clients/cff16bc10f37112b0769d2e8bf378283.jpeg", alt: "Cff16Bc10F37112B0769D2E8Bf378283" },
    { src: "/assets/aycdom/clients/domicem.png", alt: "Domicem" },
    { src: "/assets/aycdom/clients/general_cigars.jpeg", alt: "General Cigars" },
    { src: "/assets/aycdom/clients/logo coral.jpeg", alt: "Logo Coral" },
    { src: "/assets/aycdom/clients/logo-1.png", alt: "Logo 1" },
    { src: "/assets/aycdom/clients/logo-crystal-300-x-300.png", alt: "Logo Crystal 300 X 300" },
    { src: "/assets/aycdom/clients/logo.png", alt: "Logo" },
    { src: "/assets/aycdom/clients/logoRetina.png", alt: "Logoretina" },
    { src: "/assets/aycdom/clients/logo_ci.png", alt: "Logo Ci" },
    { src: "/assets/aycdom/clients/maxresdefault.jpeg", alt: "Maxresdefault" },
    { src: "/assets/aycdom/clients/quienes.png", alt: "Quienes" },
  ]

  const quickActions = [
    {
      label: 'Llamar',
      href: `tel:${cleanPhone(phone)}`,
      icon: <FaPhoneAlt />,
      featured: false,
      external: false,
    },
    {
      label: 'Instagram',
      href: instagramUrl,
      icon: <FaInstagram />,
      featured: false,
      external: true,
    },
    {
      label: 'Correo',
      href: `mailto:${email}`,
      icon: <FaEnvelope />,
      featured: false,
      external: false,
    },
    {
      label: 'Ubicación',
      href: mapUrl,
      icon: <FaMapMarkerAlt />,
      featured: false,
      external: true,
    },
  ]

  return (
    <main className="ayc-mobile-page">
      <div className="ayc-mobile-shell">
        <section
          className="ayc-mobile-cover"
          aria-label="Galería principal de A&C Dominicana"
        >
          <div className="ayc-mobile-cover-media">
            {heroImages.map((image, index) => (
              <img
                key={image.src}
                src={image.src}
                alt={index === activeHero ? image.alt : ''}
                aria-hidden={index !== activeHero}
                className={index === activeHero ? 'is-active' : ''}
                loading={index === 0 ? 'eager' : 'lazy'}
              />
            ))}
          </div>

          <div
            className="ayc-mobile-cover-dots"
            aria-label="Seleccionar imagen principal"
          >
            {heroImages.map((image, index) => (
              <button
                key={image.src}
                type="button"
                className={index === activeHero ? 'is-active' : ''}
                onClick={() => setActiveHero(index)}
                aria-label={`Ver imagen ${index + 1}`}
                aria-pressed={index === activeHero}
              />
            ))}
          </div>
        </section>

        <div className="ayc-mobile-brand-logo">
          <AssetImage
            src={logo}
            alt={name}
            className="ayc-mobile-logo"
          />
        </div>

        <div className="ayc-mobile-contact-person">
          <strong>{contactName}</strong>
          <span>{contactTitle}</span>
        </div>

        <section className="ayc-mobile-identity">
          <h1>{heroTitle}</h1>

          <p className="ayc-mobile-identity-description">
            {heroCopy}
          </p>

          <a
            href={waHref}
            target="_blank"
            rel="noreferrer"
            className="ayc-mobile-whatsapp"
          >
            <FaWhatsapp />
            Hablar por WhatsApp
          </a>
        </section>

        <nav
          className="ayc-quick-actions"
          aria-label="Accesos directos"
        >
          {quickActions.map((action) => (
            <a
              key={action.label}
              href={action.href}
              className={action.featured ? 'is-featured' : undefined}
              target={action.external ? '_blank' : undefined}
              rel={action.external ? 'noreferrer' : undefined}
            >
              <span className="ayc-quick-icon">
                {action.icon}
              </span>
              <strong>{action.label}</strong>
            </a>
          ))}
        </nav>

        <section className="ayc-mobile-vcard">
          <button
            type="button"
            className="ayc-primary-wide"
            onClick={downloadVCard}
          >
            <FaAddressCard />
            Guardar contacto
          </button>
        </section>

        <section className="ayc-mobile-section ayc-about-section">
          <div className="ayc-section-heading ayc-about-heading">
            <h2>Sobre nosotros</h2>
          </div>

          <p>{about}</p>

        </section>
        <section
          className={`ayc-brand-belt${isBrandPaused ? ' is-paused' : ''}`}
          aria-label="Marcas representadas por A&C Dominicana"
        >
          <div className="ayc-brand-belt-track">
            <div className="ayc-brand-belt-group">
              {brandLogos.map((logoSrc, index) => (
                <div
                  key={`primary-${logoSrc}`}
                  className="ayc-brand-belt-item"
                  onPointerDown={() => setIsBrandPaused(true)}
                  onPointerUp={() => setIsBrandPaused(false)}
                  onPointerCancel={() => setIsBrandPaused(false)}
                  onPointerLeave={() => setIsBrandPaused(false)}
                  onLostPointerCapture={() => setIsBrandPaused(false)}
                >
                  <img
                    src={logoSrc}
                    alt={`Marca representada ${index + 1}`}
                    className="ayc-brand-belt-logo"
                  loading="eager"
                  decoding="async"
                  draggable={false}
                />
                </div>
              ))}
            </div>

            <div
              className="ayc-brand-belt-group"
              aria-hidden="true"
            >
              {brandLogos.map((logoSrc) => (
                <div
                  key={`duplicate-${logoSrc}`}
                  className="ayc-brand-belt-item"
                  onPointerDown={() => setIsBrandPaused(true)}
                  onPointerUp={() => setIsBrandPaused(false)}
                  onPointerCancel={() => setIsBrandPaused(false)}
                  onPointerLeave={() => setIsBrandPaused(false)}
                  onLostPointerCapture={() => setIsBrandPaused(false)}
                >
                  <img
                    src={logoSrc}
                    alt=""
                    className="ayc-brand-belt-logo"
                  loading="eager"
                  decoding="async"
                  draggable={false}
                />
                </div>
              ))}
            </div>
          </div>
        </section>

                <section
          id="soluciones"
          className="ayc-organized-services-section"
        >
          <div
            className="
              ayc-section-heading
              ayc-organized-services-heading
            "
          >
            <span>Nuestros servicios</span>

            <h2>
              Soluciones industriales
            </h2>

            <p>
              Descubre soluciones industriales diseñadas
              para optimizar procesos, resolver necesidades
              técnicas y llevar cada proyecto desde la idea
              hasta una ejecución eficiente y precisa.
            </p>
          </div>

          <div className="ayc-featured-services-grid">
            {featuredServices.map((group, index) => (
              <article
                key={group.title}
                className="ayc-featured-service-card"
              >
                <div className="ayc-featured-service-media">
                  <AssetImage
                    src={group.image}
                    alt={group.title}
                    className="ayc-featured-service-image"
                  />
                </div>

                <div className="ayc-featured-service-body">
                  <span>Servicio industrial</span>

                  <h3>{group.title}</h3>

                  <p>{group.summary}</p>

                  <button
                    type="button"
                    className="ayc-featured-service-link"
                    onClick={() => {
                      setIsServicesCatalogOpen(false)
                      setActiveServiceIndex(index)
                    }}
                  >
                    Ver detalles
                  </button>
                </div>
              </article>
            ))}
          </div>

          <button
            type="button"
            className="ayc-services-catalog-trigger"
            onClick={() => {
              setActiveServiceIndex(null)
              setIsServicesCatalogOpen(true)
            }}
          >
            Ver todos los servicios
          </button>
        </section>

        {isServicesCatalogOpen ? (
          <div
            className="ayc-services-modal-backdrop"
            role="presentation"
            onClick={() =>
              setIsServicesCatalogOpen(false)
            }
          >
            <section
              className="ayc-services-modal-sheet"
              role="dialog"
              aria-modal="true"
              aria-label="Todos nuestros servicios"
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              <button
                type="button"
                className="ayc-services-modal-close"
                aria-label="Cerrar catálogo"
                onClick={() =>
                  setIsServicesCatalogOpen(false)
                }
              >
                ×
              </button>

              <div className="ayc-services-modal-heading">
                <span>Portafolio de soluciones</span>

                <h2>Todos nuestros servicios</h2>

                <p>
                  Selecciona una solución para conocer
                  su alcance y los servicios incluidos.
                </p>
              </div>

              <div className="ayc-services-modal-grid">
                {serviceGroups.map((group, index) => (
                  <article
                    key={group.title}
                    className="ayc-services-modal-card"
                  >
                    <div
                      className="ayc-services-modal-media"
                    >
                      <AssetImage
                        src={group.image}
                        alt={group.title}
                        className="
                          ayc-services-modal-image
                        "
                      />
                    </div>

                    <div
                      className="ayc-services-modal-body"
                    >
                      <span>Servicio industrial</span>

                      <h3>{group.title}</h3>

                      <p>{group.summary}</p>

                      <button
                        type="button"
                        className="
                          ayc-services-modal-action
                        "
                        onClick={() => {
                          setIsServicesCatalogOpen(false)
                          setActiveServiceIndex(index)
                        }}
                      >
                        Ver detalles
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        ) : null}

        {activeServiceIndex !== null &&
        serviceGroups[activeServiceIndex] ? (
          <div
            className="ayc-service-detail-backdrop"
            role="presentation"
            onClick={() =>
              setActiveServiceIndex(null)
            }
          >
            <section
              className="ayc-service-detail-sheet"
              role="dialog"
              aria-modal="true"
              aria-label={
                serviceGroups[activeServiceIndex].title
              }
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              <button
                type="button"
                className="ayc-services-modal-close"
                aria-label="Cerrar detalle"
                onClick={() =>
                  setActiveServiceIndex(null)
                }
              >
                ×
              </button>

              <div className="ayc-service-detail-media">
                <AssetImage
                  src={
                    serviceGroups[activeServiceIndex]
                      .image
                  }
                  alt={
                    serviceGroups[activeServiceIndex]
                      .title
                  }
                  className="ayc-service-detail-image"
                />
              </div>

              <div className="ayc-service-detail-body">
                <span>Servicio industrial</span>

                <h3>
                  {
                    serviceGroups[activeServiceIndex]
                      .title
                  }
                </h3>

                <p className="ayc-service-detail-summary">
                  {
                    serviceGroups[activeServiceIndex]
                      .summary
                  }
                </p>

                <div className="ayc-service-detail-box">
                  <h4>Servicios incluidos</h4>

                  <ul>
                    {
                      serviceGroups[
                        activeServiceIndex
                      ].items.map((item: string) => (
                        <li key={item}>{item}</li>
                      ))
                    }
                  </ul>
                </div>

                <a
                  href={waHref}
                  target="_blank"
                  rel="noreferrer"
                  className="ayc-service-detail-cta"
                >
                  <FaWhatsapp />
                  Consultar por WhatsApp
                </a>

                <button
                  type="button"
                  className="
                    ayc-service-detail-backlink
                  "
                  onClick={() => {
                    setActiveServiceIndex(null)
                    setIsServicesCatalogOpen(true)
                  }}
                >
                  Volver a todos los servicios
                </button>
              </div>
            </section>
          </div>
        ) : null}

        <section
          className="ayc-clients-belt-section"
          aria-labelledby="ayc-clients-title"
        >
          <div className="ayc-clients-heading">
            <span>Nuestros clientes</span>

            <h2 id="ayc-clients-title">
              Empresas que confían en nuestro trabajo
            </h2>

            <p>
              Relaciones construidas con experiencia,
              capacidad técnica y soluciones que responden
              a las necesidades reales de cada operación.
            </p>
          </div>

          <div
            className={`ayc-clients-belt ${
              isClientCarouselPaused
                ? 'is-paused'
                : ''
            }`}
          >
            <div className="ayc-clients-track">
              {[0, 1].map((groupIndex) => (
                <div
                  key={`clients-group-${groupIndex}`}
                  className="ayc-clients-group"
                  aria-hidden={groupIndex === 1}
                >
                  {clientLogos.map(
                    (client, clientIndex) => {
                      const clientKey =
                        `${groupIndex}-${clientIndex}`

                      const isActive =
                        activeClientLogo === clientKey

                      return (
                        <div
                          key={clientKey}
                          className={`ayc-client-logo-card ${
                            isActive
                              ? 'is-active'
                              : ''
                          }`}
                          onPointerEnter={() =>
                            pauseClientCarousel(clientKey)
                          }
                          onPointerLeave={() =>
                            releaseClientHover()
                          }
                          onClick={() =>
                            toggleClientPauseOnClick(clientKey)
                          }
                        >
                          <AssetImage
                            src={client.src}
                            alt={client.alt}
                            className="ayc-client-logo-image"
                          />
                        </div>
                      )
                    }
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

<section className="ayc-mobile-section ayc-services-section" aria-hidden="true">
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





                <section
          className="ayc-corporate-contact-section"
          aria-labelledby="ayc-corporate-contact-title"
        >
          <div className="ayc-corporate-contact-banner">
            ¡Conecta con A&C Dominicana!
          </div>

          <p className="ayc-corporate-contact-intro">
            Llámanos, escríbenos o síguenos en nuestras redes:
          </p>

          <div className="ayc-corporate-contact-list">
            <a
              className="ayc-corporate-contact-item"
              href={`tel:${cleanPhone(phone)}`}
            >
              <span className="ayc-corporate-contact-itemIcon">
                <FaPhoneAlt />
              </span>
              <span className="ayc-corporate-contact-itemText">
                <strong>Teléfono</strong>
                <span>{phone}</span>
              </span>
            </a>

            <a
              className="
                ayc-corporate-contact-item
                ayc-corporate-whatsapp-row
              "
              href={waHref}
              target="_blank"
              rel="noreferrer"
            >
              <span className="ayc-corporate-contact-itemIcon">
                <FaWhatsapp />
              </span>
              <span className="ayc-corporate-contact-itemText">
                <strong>WhatsApp</strong>
                <span>{mobilePhone}</span>
              </span>
            </a>

            <a
              className="ayc-corporate-contact-item"
              href={`mailto:${email}`}
            >
              <span className="ayc-corporate-contact-itemIcon">
                <FaEnvelope />
              </span>
              <span className="ayc-corporate-contact-itemText">
                <strong>Correo corporativo</strong>
                <span>{email}</span>
              </span>
            </a>

            <a
              className="ayc-corporate-contact-item"
              href={instagramUrl}
              target="_blank"
              rel="noreferrer"
            >
              <span className="ayc-corporate-contact-itemIcon">
                <FaInstagram />
              </span>
              <span className="ayc-corporate-contact-itemText">
                <strong>Instagram</strong>
                <span>@aycdominicana</span>
              </span>
            </a>

            <a
              className="ayc-corporate-contact-item"
              href={websiteHref}
              target="_blank"
              rel="noreferrer"
            >
              <span
                className="
                  ayc-corporate-contact-itemIcon
                  is-web
                "
              >
                <FaGlobe />
              </span>
              <span className="ayc-corporate-contact-itemText">
                <strong>Web</strong>
                <span>www.aycdominicana.com</span>
              </span>
            </a>

            <a
              className="ayc-corporate-contact-item"
              href="https://www.google.com/maps/search/?api=1&query=A%26C+Dominicana+C%2F+Juan+Jos%C3%A9+Duarte+73+Ensanche+La+Fe+Santo+Domingo"
              target="_blank"
              rel="noreferrer"
            >
              <span className="ayc-corporate-contact-itemIcon">
                <FaMapMarkerAlt />
              </span>
              <span className="ayc-corporate-contact-itemText">
                <strong>Ubicación</strong>
                <span>
                  C/ Juan José Duarte #73, entre Mauricio Báez y Paraguay,
                  Ensanche La Fe, Santo Domingo, Rep. Dom.
                </span>
              </span>
            </a>
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

        <section className="ayc-mobile-section ayc-location-section ayc-location-section-v21">
          <div className="ayc-section-heading">
            <span>Visítenos</span>
            <h2 className="ayc-map-company-v21">Nuestra ubicación</h2>
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
              <a href={mapUrl} target="_blank" rel="noreferrer" className="ayc-route-button-v21">Cómo llegar</a>
            </div>
          </div>
        </section>

        <section className="ayc-final-cta ayc-quote-section-v21">
          <span>Hablemos de su proyecto</span>
          <h2>¿Tiene una necesidad industrial que debemos evaluar?</h2>
          <p>Comparta la pieza, equipo, proceso o mejora que necesita.</p>
          <a
            href={waHref}
            target="_blank"
            rel="noreferrer"
            className="ayc-quote-button-v21"
          >
            <FaWhatsapp
              className="ayc-quote-icon-v23"
              color="#05197A"
            />
            Solicitar cotización
          </a>
        </section>

        <footer
          className="
            ayc-mobile-footer
            ayc-footer-v21
            ayc-footer-v23
          "
        >
          <AssetImage
            src={logo}
            alt={name}
            className="ayc-footer-logo"
          />

          <p className="ayc-footer-location-v23">
            Santo Domingo, Rep. Dom.
          </p>

          <small className="ayc-footer-watermark-v23">
            Perfil empresarial creado con INTAP LINK
          </small>
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
