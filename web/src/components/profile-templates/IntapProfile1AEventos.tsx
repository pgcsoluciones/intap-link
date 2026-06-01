import { useEffect, useRef, useState } from 'react'
import {
  FaAddressCard,
  FaBars,
  FaBriefcase,
  FaBuilding,
  FaChair,
  FaChevronRight,
  FaEnvelope,
  FaGlassCheers,
  FaGlobe,
  FaInstagram,
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaRegCalendarCheck,
  FaRing,
  FaStar,
  FaUtensils,
  FaWhatsapp,
} from 'react-icons/fa'
import './IntapProfile1AEventos.css'

type QuickLink = {
  label: string
  icon: JSX.Element
  href: string
}

const PROFILE = {
  slug: '1aeventos',
  brand: '1A Eventos',
  advisor: 'Lic. Gabriel Reyes Bello',
  role: 'Director Comercial · 1A Eventos',
  phone: '829-557-1090',
  phoneRaw: '18295571090',
  whatsappRaw: '18295571090',
  vcardName: 'Gabriel Reyes - 1A Eventos',
  personalEmail: 'ventas@1aeventos.com',
  instagramLabel: '@1aeventos',
  instagramUrl: 'https://www.instagram.com/1aeventos/',
  website: 'https://1aeventos.com/',
  location: 'Calle 2da #5, Sector La Ceiba, Santo Domingo',
  companyPhone: '809-534-5006',
  companyWhatsapp: '829-521-1470',
  companyWhatsappRaw: '18295211470',
  companyEmail: 'ventas@1aeventos.com',
  companyEmail2: 'ventas2@1aeventos.com',
  companyRnc: '131-89409-7',
}

const catalogPageSrc = (page: number) =>
  `/assets/1A%20eventos/catalogo/pages/catalogo-${String(page).padStart(3, '0')}.png`

const catalogCategoryImageSrc = (folderName: string, index: number) =>
  `/assets/1A%20eventos/catalogo/categorias/${folderName}-${String(index).padStart(2, '0')}.png`

const catalogCategoryImages = (folderName: string) =>
  [1, 2, 3, 4].map((index) => catalogCategoryImageSrc(folderName, index))


const ONEA_GABRIEL_WHATSAPP_RAW = '18295571090'
const ONEA_SALES_1_WHATSAPP_RAW = '18297501470'
const ONEA_SALES_2_WHATSAPP_RAW = '18295211470'
const ONEA_PROFILE_WHATSAPP_RAW = ONEA_SALES_1_WHATSAPP_RAW
const ONEA_CHAT_WHATSAPP_RAW = ONEA_SALES_2_WHATSAPP_RAW

const catalogSections = [
  {
    id: 'completo',
    label: 'Catálogo completo',
    menuLabel: 'Catálogo completo',
    description: 'Explora el catálogo completo 1A Eventos 2025-2026, página por página, como una revista digital.',
    pages: Array.from({ length: 27 }, (_, index) => index + 1),
    catalogStartPage: 1,
    featured: false,
    featuredImages: [
      catalogCategoryImageSrc('sillas', 1),
      catalogCategoryImageSrc('mesas', 1),
      catalogCategoryImageSrc('copas', 1),
      catalogCategoryImageSrc('set-vajillas', 1),
    ],
    items: [],
  },
  {
    id: 'sillas',
    label: 'Sillas',
    menuLabel: 'Sillas',
    description: 'Sillas para ceremonias, recepciones, banquetes y eventos corporativos.',
    pages: [5],
    catalogStartPage: 5,
    featured: true,
    featuredImages: catalogCategoryImages('sillas'),
    items: [
      'Silla Tiffany / Chiavari',
      'Silla Louis XV',
      'Silla Crossback',
      'Silla Napoleón Dorada',
      'Silla Jardinera / Avant Garden',
      'Silla Plegable Metálica',
      'Silla de director',
      'Butacas capitoneadas',
    ],
  },
  {
    id: 'mesas',
    label: 'Mesas',
    menuLabel: 'Mesas',
    description: 'Mesas para banquetes, estaciones, áreas lounge y montajes especiales.',
    pages: [6, 7],
    catalogStartPage: 6,
    featured: true,
    featuredImages: catalogCategoryImages('mesas'),
    items: [
      'Mesa Colonial Redonda 60”',
      'Mesa Blanca de Madera 60” y 72”',
      'Mesa Colonial Rectangular',
      'Mesa Rectangular Imperial',
      'Mesa Vintage Decapada',
      'Mesa Roma',
      'Mesa Carruaje Rústica',
      'Mesa Lounge Kennedy',
      'Mesas plásticas rectangulares y redondas',
    ],
  },
  {
    id: 'copas-vasos',
    label: 'Cristalería',
    menuLabel: 'Cristalería',
    description: 'Cristalería para bebidas, brindis, cocteles y montajes de mesa.',
    pages: [8],
    catalogStartPage: 8,
    featured: true,
    featuredImages: catalogCategoryImages('copas'),
    items: [
      'Copa de agua',
      'Copa multiuso',
      'Copa champagne',
      'Copa margarita',
      'Copa martini',
      'Vaso highball',
      'Vaso shot',
      'Copa gin',
      'Jarra cervecera',
      'Sets Anubis, Timeless y Bahamas',
    ],
  },
  {
    id: 'bar-lounge',
    label: 'Bar & Lounge',
    menuLabel: 'Bar & Lounge',
    description: 'Barras, estaciones y piezas lounge para crear ambientes funcionales y elegantes.',
    pages: [12, 13, 14, 15],
    catalogStartPage: 12,
    featured: true,
    featuredImages: catalogCategoryImages('bar-lounch'),
    items: [
      'Bar Móvil Garden',
      'Bar Móvil Roma',
      'Bar Móvil Pallete',
      'Bar Móvil Acrílico Negro',
      'Candy Cart Blanco',
      'Mesas altas',
      'Silla alta Marble',
      'Muebles lounge',
      'Ottomans',
      'Línea Louis XV y Kennedy',
    ],
  },
  {
    id: 'set-vajillas',
    label: 'Set de vajillas',
    menuLabel: 'Set de vajillas',
    description: 'Vajillas y piezas de mesa para elevar la presentación del servicio.',
    pages: [9],
    catalogStartPage: 9,
    featured: false,
    featuredImages: catalogCategoryImages('set-vajillas'),
    items: [
      'Set Ambrosia blanco y dorado',
      'Set Ambrosia negro y dorado',
      'Set Royal',
      'Set Ulala',
      'Set MarieFleur',
      'Set London',
    ],
  },
  {
    id: 'bandejas-platos-otros',
    label: 'Bandejas, platos y otros',
    menuLabel: 'Bandejas y platos',
    description: 'Piezas complementarias para servicio, presentación y montaje gastronómico.',
    pages: [10],
    catalogStartPage: 10,
    featured: false,
    featuredImages: catalogCategoryImages('bandejas-platos-otros'),
    items: [
      'Vajillas Anubis',
      'Porcelana blanca',
      'Platos base',
      'Bandejas varios modelos',
      'Bowl',
      'Ensaladeras y platones',
      'Ramekin / salsera',
      'Tazas de café, té o chocolate',
    ],
  },
  {
    id: 'cubierteria',
    label: 'Cubertería',
    menuLabel: 'Cubertería',
    description: 'Cubiertos y sets para completar la mesa con una presentación cuidada.',
    pages: [11],
    catalogStartPage: 11,
    featured: false,
    featuredImages: catalogCategoryImages('cubierteria'),
    items: [
      'Set Royal',
      'Set negro con dorado',
      'Set Gold',
      'Set Bamboo',
      'Set Angus',
      'Cuchillos',
      'Tenedores',
      'Cucharas',
      'Cubiertos de postre y café',
    ],
  },
  {
    id: 'manteles-caminos-topes',
    label: 'Manteles, caminos y topes',
    menuLabel: 'Manteles y caminos',
    description: 'Textiles para vestir mesas, armonizar colores y dar terminación al montaje.',
    pages: [16],
    catalogStartPage: 16,
    featured: false,
    featuredImages: catalogCategoryImages('manteles-caminos-topes'),
    items: [
      'Manteles Gabardina',
      'Manteles Premium',
      'Mantel Licra / Spandex',
      'Topes de lino',
      'Mantel dorado',
      'Mantel navideño',
      'Mantel mexicano',
      'Camino de mesa',
    ],
  },
  {
    id: 'individuales-servilletas-doyles',
    label: 'Individuales, servilletas y doyles',
    menuLabel: 'Individuales y servilletas',
    description: 'Detalles textiles para reforzar estilo, color y presentación en mesa.',
    pages: [17],
    catalogStartPage: 17,
    featured: false,
    featuredImages: catalogCategoryImages('individuales-servilletas-doyle'),
    items: [
      'Mantel individual',
      'Doyles',
      'Servilleta Tropical Print',
      'Servilleta de Gabardina',
      'Servilleta Tipo Picnic',
      'Servilletas de lino',
    ],
  },
  {
    id: 'utensilios',
    label: 'Utensilios',
    menuLabel: 'Utensilios',
    description: 'Utensilios y piezas de apoyo para servicio, montaje y operación del evento.',
    pages: [19],
    catalogStartPage: 19,
    featured: false,
    featuredImages: catalogCategoryImages('utensilios'),
    items: [
      'Chafing dishes',
      'Dispensadores de bebidas',
      'Jarras de agua y/o jugo',
      'Champañeras',
      'Termo de café, té o chocolate',
      'Cafetera / coffee maker',
      'Fuente de chocolate',
      'Neverita de hielo / cooler',
      'Piezas de servir',
    ],
  },
  {
    id: 'accesorios',
    label: 'Accesorios',
    menuLabel: 'Accesorios',
    description: 'Complementos decorativos y funcionales para organizar y elevar la experiencia.',
    pages: [20, 21, 22, 23, 24],
    catalogStartPage: 20,
    featured: false,
    featuredImages: catalogCategoryImages('accesorios'),
    items: [
      'Elevadores',
      'Separadores de fila',
      'Podiums',
      'Astas de banderas',
      'Porta platos',
      'Mamparas',
      'Alfombras',
      'Candeleros y floreros',
      'Bomboneras',
      'Pedestales',
      'Faroles, jaulas y canastas',
    ],
  },
]

const catalogCategories = catalogSections.filter((section) => section.id !== 'completo')
const featuredCatalogCategories = catalogCategories.filter((section) => section.featured)

const services = [
  { label: 'Alquiler de mobiliario', icon: <FaChair />, catalogId: 'sillas' },
  { label: 'Bodas', icon: <FaRing />, catalogId: 'completo' },
  { label: 'Eventos corporativos', icon: <FaBriefcase />, catalogId: 'accesorios' },
  { label: 'Cocteles', icon: <FaGlassCheers />, catalogId: 'copas-vasos' },
  { label: 'Banquetes', icon: <FaUtensils />, catalogId: 'bandejas-platos-otros' },
  { label: 'Accesorios', icon: <FaStar />, catalogId: 'accesorios' },
]
const faqs = [
  
  {
    question: '¿Cómo puedo solicitar una cotización?',
    answer: 'Puedes solicitar una cotización mediante nuestra página web: https://1aeventos.com/ o a través de nuestro equipo de ventas por WhatsApp: 829-750-1470 y 829-521-1470. Indícanos el tipo de evento, fecha, cantidad aproximada de invitados y las piezas que necesitas para orientarte mejor.',
  },
{
    question: '¿Con cuánto tiempo de anticipación debo reservar?',
    answer:
      'Lo ideal es escribir con anticipación para confirmar disponibilidad, fecha, tipo de evento y necesidades del montaje. En temporadas altas, bodas, eventos corporativos y celebraciones grandes conviene reservar lo antes posible.',
  },
  {
    question: '¿Qué tipo de mobiliario y accesorios puedo cotizar?',
    answer:
      'Puedes consultar sillas, mesas, cristalería, vajillas, bandejas, mantelería, cubertería, barras, salas lounge, utensilios y accesorios para eventos. La recomendación es enviar el tipo de actividad para ayudarte a elegir piezas coherentes con el espacio y el estilo.',
  },
  {
    question: '¿Trabajan bodas, eventos corporativos y celebraciones privadas?',
    answer:
      'Sí. 1A Eventos ofrece soluciones para bodas, cocteles, banquetes, celebraciones familiares, montajes corporativos e institucionales, cuidando que el mobiliario y los detalles visuales estén alineados al tipo de evento.',
  },
  {
    question: '¿Pueden orientarme si aún no sé exactamente qué necesito?',
    answer:
      'Sí. En 1A Eventos te orientamos según el tipo de evento, la cantidad de invitados, el espacio y el estilo que deseas proyectar. Así puedes elegir mobiliario, cristalería, mantelería y accesorios con mayor claridad antes de cotizar.',
  },
]

function whatsappHref(message: string) {
  return `https://wa.me/${ONEA_SALES_1_WHATSAPP_RAW}?text=${encodeURIComponent(message)}`
}

function mapHref() {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('1A eventos')}`
}


function renderFaqAnswer(answer: string) {
  const parts = answer.split(/(https:\/\/1aeventos\.com\/|829-750-1470|829-521-1470)/g)

  return parts.map((part, index) => {
    if (part === 'https://1aeventos.com/') {
      return <a key={`${part}-${index}`} href={part} target="_blank" rel="noopener noreferrer">{part}</a>
    }

    if (part === '829-750-1470') {
      return <a key={`${part}-${index}`} href="https://wa.me/18297501470" target="_blank" rel="noopener noreferrer">{part}</a>
    }

    if (part === '829-521-1470') {
      return <a key={`${part}-${index}`} href="https://wa.me/18295211470" target="_blank" rel="noopener noreferrer">{part}</a>
    }

    return part
  })
}

function vcardHref() {
  const vcard = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${PROFILE.vcardName}`,
    'N:Reyes - 1A Eventos;Gabriel;;;',
    `ORG:${PROFILE.brand}`,
    'TITLE:Director Comercial',
    `TEL;TYPE=CELL,VOICE:+${PROFILE.phoneRaw}`,
    `TEL;TYPE=CELL,WHATSAPP:+${PROFILE.whatsappRaw}`,
    `TEL;TYPE=WORK,VOICE:${PROFILE.companyPhone}`,
    `TEL;TYPE=WORK,CELL,WHATSAPP:+${PROFILE.companyWhatsappRaw}`,
    `EMAIL;TYPE=WORK:${PROFILE.companyEmail}`,
    `URL:${PROFILE.website}`,
    `ADR;TYPE=WORK:;;${PROFILE.location};;;;`,
    `NOTE:Gabriel Reyes Bello, Director Comercial de ${PROFILE.brand}. Contacto para orientación, disponibilidad y cotización de mobiliario, cristalería, mantelería, lounge y accesorios para eventos.`,
    'END:VCARD',
  ].join('\n')

  return `data:text/vcard;charset=utf-8,${encodeURIComponent(vcard)}`
}

function CatalogImage({ title, image }: { title: string; image: string }) {
  return (
    <div className="onea-catalog-card">
      <img src={image} alt={title} loading="lazy" />
      <span>{title}</span>
    </div>
  )
}

export default function IntapProfile1AEventos() {
  const [showOneABootIntro, setShowOneABootIntro] = useState(true)






  const [catalogMenuOpen, setCatalogMenuOpen] = useState(false)
  const [activeCatalogId, setActiveCatalogId] = useState<string | null>(null)
  const [showAllCatalogCategories, setShowAllCatalogCategories] = useState(false)
  const [catalogShowcaseIndex, setCatalogShowcaseIndex] = useState(0)
  const [activeCategoryImageIndex, setActiveCategoryImageIndex] = useState(0)
  const [activeCatalogPageIndex, setActiveCatalogPageIndex] = useState(0)
  const [zoomImage, setZoomImage] = useState<string | null>(null)
  const [zoomImageIndex, setZoomImageIndex] = useState(0)
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null)
  const [contactModalOpen, setContactModalOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactMessage, setContactMessage] = useState('')
  const [showSplash, setShowSplash] = useState(true)
  const catalogSliderRef = useRef<HTMLDivElement | null>(null)

  const selectedCatalog = activeCatalogId
    ? catalogSections.find((section) => section.id === activeCatalogId)
    : null

  const openCatalog = (catalogId: string) => {
    setActiveCatalogId(catalogId)
    setCatalogMenuOpen(false)
    setActiveCategoryImageIndex(0)
    setActiveCatalogPageIndex(0)
    setZoomImage(null)
    setZoomImageIndex(0)
  }

  const closeCatalog = () => {
    setActiveCatalogId(null)
    setActiveCategoryImageIndex(0)
    setActiveCatalogPageIndex(0)
    setZoomImage(null)
    setZoomImageIndex(0)
  }
  const catalogShowcaseSource = catalogCategories
  const visibleCatalogCategories =
    catalogShowcaseSource.length <= 2
      ? catalogShowcaseSource
      : [0, 1]
          .map((offset) => catalogShowcaseSource[(catalogShowcaseIndex + offset) % catalogShowcaseSource.length])
          .filter((category): category is (typeof catalogShowcaseSource)[number] => Boolean(category))

  const selectedFeaturedImages = selectedCatalog?.featuredImages ?? []
  const selectedPages = selectedCatalog?.pages ?? []
  const selectedItems = selectedCatalog?.items ?? []
  const selectedCategoryStartPage = selectedCatalog?.catalogStartPage ?? 1
  const activeCategoryImage = selectedFeaturedImages[activeCategoryImageIndex] ?? selectedFeaturedImages[0]
  const activeCatalogPage = selectedPages[activeCatalogPageIndex] ?? selectedPages[0]
  const isFullCatalogModal = selectedCatalog?.id === 'completo'
  const selectedZoomImages = isFullCatalogModal
    ? selectedPages.map((page) => catalogPageSrc(page))
    : selectedFeaturedImages

  const catalogWhatsappUrl = (label: string) =>
    `https://wa.me/${ONEA_SALES_2_WHATSAPP_RAW}?text=${encodeURIComponent(`Hola 1A Eventos, quiero consultar disponibilidad de ${label} para mi evento.`)}`


  const chatWhatsappUrl = (message: string) =>
    `https://wa.me/${ONEA_SALES_2_WHATSAPP_RAW}?text=${encodeURIComponent(message)}`

  const goPrevCategoryImage = () => {
    if (!selectedFeaturedImages.length) return
    setActiveCategoryImageIndex((value) =>
      value === 0 ? selectedFeaturedImages.length - 1 : value - 1
    )
  }

  const goNextCategoryImage = () => {
    if (!selectedFeaturedImages.length) return
    setActiveCategoryImageIndex((value) =>
      value === selectedFeaturedImages.length - 1 ? 0 : value + 1
    )
  }

  const goPrevCatalogPage = () => {
    if (!selectedPages.length) return
    setActiveCatalogPageIndex((value) =>
      value === 0 ? selectedPages.length - 1 : value - 1
    )
  }

  const goNextCatalogPage = () => {
    if (!selectedPages.length) return
    setActiveCatalogPageIndex((value) =>
      value === selectedPages.length - 1 ? 0 : value + 1
    )
  }

  const openFullCatalogAtPage = (page: number) => {
    setActiveCatalogId('completo')
    setCatalogMenuOpen(false)
    setActiveCategoryImageIndex(0)
    setZoomImage(null)
    setZoomImageIndex(0)
    setActiveCatalogPageIndex(Math.max(0, page - 1))
  }

  const openZoomImage = (index: number) => {
    const image = selectedZoomImages[index]
    if (!image) return
    setZoomImageIndex(index)
    setZoomImage(image)
  }

  const goPrevZoomImage = () => {
    if (!selectedZoomImages.length) return
    setZoomImageIndex((value) => {
      const nextIndex = value === 0 ? selectedZoomImages.length - 1 : value - 1
      setZoomImage(selectedZoomImages[nextIndex])
      return nextIndex
    })
  }

  const goNextZoomImage = () => {
    if (!selectedZoomImages.length) return
    setZoomImageIndex((value) => {
      const nextIndex = value === selectedZoomImages.length - 1 ? 0 : value + 1
      setZoomImage(selectedZoomImages[nextIndex])
      return nextIndex
    })
  }

  useEffect(() => {
    const splashTimer = window.setTimeout(() => setShowSplash(false), 3300)
    return () => window.clearTimeout(splashTimer)
  }, [])
  useEffect(() => {
    const sourceLength = catalogCategories.length

    if (sourceLength <= 2) return

    const timer = window.setInterval(() => {
      setCatalogShowcaseIndex((prev) => (prev + 2) % sourceLength)
    }, 3600)

    return () => window.clearInterval(timer)
  }, [showAllCatalogCategories])

  useEffect(() => {
    setCatalogShowcaseIndex(0)
  }, [showAllCatalogCategories])

  const quickLinks: QuickLink[] = [
    {
      label: 'Llamar',
      icon: <FaPhoneAlt />,
      href: `tel:+${PROFILE.phoneRaw}`,
    },
    {
      label: 'Instagram',
      icon: <FaInstagram />,
      href: PROFILE.instagramUrl,
    },
    {
      label: 'Web',
      icon: <FaGlobe />,
      href: PROFILE.website,
    },
    {
      label: 'Guardar',
      icon: <FaAddressCard />,
      href: vcardHref(),
    },
  ]

  const openContactModal = (message = '') => {
    setContactMessage(message)
    setContactModalOpen(true)
  }

  const submitContactForm = () => {
    const lines = [
      'Hola 1A Eventos, quiero recibir orientación para mi evento.',
      contactName.trim() ? `Nombre: ${contactName.trim()}` : '',
      contactPhone.trim() ? `Teléfono: ${contactPhone.trim()}` : '',
      contactMessage.trim() ? `Necesito: ${contactMessage.trim()}` : '',
    ].filter(Boolean)

    window.open(whatsappHref(lines.join('\n')), '_blank', 'noopener,noreferrer')
    setContactModalOpen(false)
  }

  const chatOptions = [
    {
      label: 'Quiero cotizar mi evento',
      message: 'Hola 1A Eventos, quiero cotizar mobiliario y detalles para mi evento.',
    },
    {
      label: 'Necesito asesoría para elegir piezas',
      message: 'Hola 1A Eventos, necesito orientación para elegir las piezas adecuadas para mi evento.',
    },
    {
      label: 'Tengo dudas sobre los servicios',
      message: 'Hola 1A Eventos, tengo algunas dudas sobre sus servicios y disponibilidad.',
    },
    {
      label: 'Consultar disponibilidad',
      message: 'Hola 1A Eventos, quiero consultar disponibilidad para una fecha de evento.',
    },
  ]

  useEffect(() => {
    const oneABootIntroTimer = window.setTimeout(() => {
      setShowOneABootIntro(false)
    }, 3300)

    return () => window.clearTimeout(oneABootIntroTimer)
  }, [])

  return (
    <main className="onea-page">
      {showOneABootIntro && (
        <div className="oneaBootOverlay4BExact" aria-label="Cargando perfil 1A Eventos">
          <style>{`
            .oneaBootOverlay4BExact {
              position: fixed;
              inset: 0;
              width: 100vw;
              height: 100vh;
              z-index: 2147483647;
              display: flex;
              align-items: center;
              justify-content: center;
              background: #ffffff;
              overflow: hidden;
              pointer-events: all;
              opacity: 1;
              visibility: visible;
              animation: oneaBootFade4BExact 0.55s ease 3.05s forwards;
            }

            .oneaBootLogoWrap4BExact {
              width: min(420px, 82vw);
              height: min(420px, 82vw);
              display: flex;
              align-items: center;
              justify-content: center;
              opacity: 1;
              visibility: visible;
            }

            .oneaBootLogo4BExact {
              display: block;
              width: min(380px, 78vw);
              height: auto;
              max-height: 380px;
              object-fit: contain;
              opacity: 0;
              visibility: visible;
              filter: blur(12px);
              transform: translateY(34px) scale(0.2);
              animation: oneaBootZoom4BExact 3s ease-in-out forwards;
            }

            @keyframes oneaBootZoom4BExact {
              0% {
                opacity: 0;
                filter: blur(12px);
                transform: translateY(34px) scale(0.2);
              }

              18% {
                opacity: 1;
              }

              50% {
                opacity: 1;
                filter: blur(1px);
                transform: translateY(0) scale(1.08);
              }

              100% {
                opacity: 1;
                filter: blur(0);
                transform: translateY(-8px) scale(1);
              }
            }

            @keyframes oneaBootFade4BExact {
              from {
                opacity: 1;
                visibility: visible;
              }

              to {
                opacity: 0;
                visibility: hidden;
              }
            }
          `}</style>

          <div className="oneaBootLogoWrap4BExact">
            <img
              className="oneaBootLogo4BExact"
              src="/assets/1aeventos/perfil/logo-1aeventos.png"
              alt="1A Eventos"
            />
          </div>
        </div>
      )}

      {showSplash ? (
        <div className="oneaIntroOverlayBg" aria-hidden="true">
          <div className="oneaIntroLogoBg" />
        </div>
      ) : null}

      <section className="onea-hero">
        <div className="onea-hero-media">
          <div className="onea-logo-mark">
            <strong>1A</strong>
            <span>EVENTOS</span>
          </div>
        </div>

        <div className="onea-hero-card">
          <div className="onea-avatar">
            <img
              src="/assets/1A%20eventos/perfil/perfil-gabriel-01.jpg"
              alt={PROFILE.advisor}
              loading="eager"
            />
          </div>

          
          <h1>{PROFILE.advisor}</h1>
          <p className="onea-role">{PROFILE.role}</p>

          <p className="onea-hero-intro">
            Soy Gabriel Reyes Bello, Director Comercial de 1A Eventos. Estoy a tu disposición para orientarte y ayudarte a elegir las piezas adecuadas para que tu evento luzca elegante, organizado y memorable.
          </p>

          <a
            className="onea-primary-cta"
            href={`https://wa.me/${ONEA_GABRIEL_WHATSAPP_RAW}?text=${encodeURIComponent('Hola Gabriel, vi tu perfil de 1A Eventos y quiero recibir orientación para cotizar mi evento.')}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <FaWhatsapp />
            Hablar por WhatsApp
          </a>

          <div className="onea-quick-links onea-quick-links-hero" aria-label="Enlaces rápidos">
            {quickLinks.map((item) => (
              <a
                key={item.label}
                href={item.href}
                target={item.label === 'Guardar' ? undefined : '_blank'}
                rel="noopener noreferrer"
                download={item.label === 'Guardar' ? 'Gabriel-Reyes-1A-Eventos.vcf' : undefined}
              >
                <span>{item.icon}</span>
                <small>{item.label}</small>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="onea-section onea-company-intro" aria-labelledby="onea-about-title">
        <div className="onea-company-intro-brand">
          <img
            className="onea-company-intro-logo"
            src="/assets/1A%20eventos/perfil/1A%20Eventos-logo1.png"
            alt="1A Eventos"
          />
        </div>

        <div className="onea-company-intro-label">Sobre nosotros</div>

        <h2 id="onea-about-title">
          Mobiliario premium y detalles pensados para elevar tu evento.
        </h2>

        <div className="onea-company-stats" aria-label="Estadísticas de 1A Eventos">
          <div>
            <strong>650+</strong>
            <span>Clientes</span>
          </div>
          <div>
            <strong>6,000+</strong>
            <span>Eventos realizados</span>
          </div>
          <div>
            <strong>10+</strong>
            <span>Años de experiencia</span>
          </div>
        </div>

        <p>
          En 1A Eventos ayudamos a convertir una idea de celebración en una experiencia organizada,
          elegante y visualmente coherente. Nuestro trabajo va más allá de alquilar piezas: orientamos
          al cliente para elegir mobiliario, cristalería, mantelería, banquetes, barras, salas lounge y
          accesorios que se ajusten al tipo de evento, al espacio y al estilo que desea proyectar.
        </p>

        <p>
          Ya sea una boda, un coctel, una celebración familiar, un montaje corporativo o un evento
          institucional, el objetivo es que el cliente no tenga que improvisar. Gabriel y el equipo de
          1A Eventos están para ayudarte a seleccionar lo necesario, confirmar disponibilidad y avanzar
          hacia una cotización clara con una solución pensada para tu ocasión.
        </p>
</section>
      <section className="onea-section onea-catalog onea-catalog-premium" id="catalogo-1a">
        <div className="onea-section-head onea-catalog-head">
          <div>
            <h2>Nuestro catálogo</h2>
            <p>Explora piezas seleccionadas y recibe orientación para tu evento.</p>
          </div>
        </div>

        <div className="onea-featured-category-showcase" ref={catalogSliderRef}>
          {visibleCatalogCategories.map((category) => (
            <button
              className="onea-featured-category-card"
              key={category.id}
              type="button"
              onClick={() => openCatalog(category.id)}
            >
              <img src={category.featuredImages[0]} alt={category.label} loading="lazy" />
              <span>{category.label}</span>
            </button>
          ))}
        </div>

        <div className="onea-category-button-panel">
          {(showAllCatalogCategories ? catalogCategories : featuredCatalogCategories).map((category) => (
            <button key={category.id} type="button" onClick={() => openCatalog(category.id)}>
              {category.menuLabel}
            </button>
          ))}
        </div>

        <button
          className="onea-category-more-link"
          type="button"
          onClick={() => setShowAllCatalogCategories((value) => !value)}
        >
          {showAllCatalogCategories ? 'Ver menos categorías' : 'Ver todas las categorías'}
        </button>

        <div className="onea-catalog-actions">
          <button className="onea-secondary-cta" type="button" onClick={() => openCatalog('completo')}>
            Ver catálogo completo
          </button>
        </div>
      </section>

      <section className="onea-section onea-services">
        <div className="onea-section-head">
          
          <h2>Soluciones para eventos memorables</h2>
        </div>

        <div className="onea-service-chips">
          {services.map((service) => (
            <button key={service.label} type="button" onClick={() => openCatalog(service.catalogId)}>
              {service.icon}
              {service.label}
            </button>
          ))}
        </div>
      </section>
<section className="onea-section onea-company">
        <div className="onea-section-head">
          
          <h2>Contacto corporativo de 1A Eventos</h2>
        </div>

        <div className="onea-contact-list">
          <a href={`tel:+18095345006`}>
            <FaPhoneAlt />
            <span>Showroom: {PROFILE.companyPhone}</span>
            <FaChevronRight />
          </a>
          <a href="https://wa.me/18297501470" target="_blank" rel="noopener noreferrer">
            <FaWhatsapp />
            <span>WhatsApp Ventas 1: 829-750-1470</span>
            <FaChevronRight />
          </a>
          <a href="https://wa.me/18295211470" target="_blank" rel="noopener noreferrer">
            <FaWhatsapp />
            <span>WhatsApp Ventas 2: 829-521-1470</span>
            <FaChevronRight />
          </a>
          <a href={PROFILE.instagramUrl} target="_blank" rel="noopener noreferrer">
            <FaInstagram />
            <span>Instagram: {PROFILE.instagramLabel}</span>
            <FaChevronRight />
          </a>
          <a href={`mailto:${PROFILE.companyEmail}`}>
            <FaEnvelope />
            <span>{PROFILE.companyEmail}</span>
            <FaChevronRight />
          </a>
          <a href={PROFILE.website} target="_blank" rel="noopener noreferrer">
            <FaGlobe />
            <span>1aeventos.com</span>
            <FaChevronRight />
          </a>
          <a href={mapHref()} target="_blank" rel="noopener noreferrer">
            <FaMapMarkerAlt />
            <span>Calle 2da #5, Sector La Ceiba, Santo Domingo</span>
            <FaChevronRight />
          </a>
        </div>
      </section>

      <section className="onea-section onea-contact-cta">
        <div className="onea-contact-cta-inner">
          <h2>¿Necesitas reservar o recibir orientación?</h2>
          <p>
            Déjanos tus datos y te ayudamos por WhatsApp a elegir una solución práctica,
            elegante y ajustada a tu evento.
          </p>
          <button type="button" onClick={() => openContactModal('Quiero recibir orientación para mi evento.')}>
            Quiero que me contacten
          </button>
        </div>
      </section>

      <section className="onea-section onea-faq">
        <div className="onea-section-head">
          <h2>Aclara tus dudas antes de reservar</h2>
          <p className="onea-faq-selling-copy">Resuelve las preguntas más comunes antes de cotizar: tiempos de reserva, disponibilidad, mobiliario y acompañamiento para elegir lo ideal para tu evento.</p>
        </div>

        <div className="onea-faq-list">
          {faqs.map((faq, index) => (
            <details
              key={faq.question}
              open={openFaqIndex === index}
              onToggle={(event) => {
                if (event.currentTarget.open) {
                  setOpenFaqIndex(index)
                } else if (openFaqIndex === index) {
                  setOpenFaqIndex(null)
                }
              }}
            >
              <summary>{faq.question}</summary>
              <p>{renderFaqAnswer(faq.answer)}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="onea-map-card">
        <div>
          <p>Cómo llegar al showroom</p>
          <h2>Visítanos y conoce el catálogo en persona.</h2>
        </div>
        <a href={mapHref()} target="_blank" rel="noopener noreferrer">
          Ver en el mapa
        </a>
      </section>

      {selectedCatalog && (
        <div
          className="onea-catalog-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="onea-catalog-modal-title"
        >
          <div className={`onea-catalog-modal ${isFullCatalogModal ? 'onea-catalog-modal-book' : 'onea-catalog-modal-product'}`}>
            <button className="onea-catalog-modal-close" type="button" onClick={closeCatalog} aria-label="Cerrar catálogo">
              ×
            </button>

            <div className="onea-catalog-modal-head">
              <p>Catálogo 1A Eventos</p>
              <h2 id="onea-catalog-modal-title">{selectedCatalog.label}</h2>
              <span>{selectedCatalog.description}</span>
            </div>

            {isFullCatalogModal ? (
              <div className="onea-book-viewer">
                <div className="onea-book-stage">
                  <button className="onea-book-arrow onea-book-arrow-left" type="button" onClick={goPrevCatalogPage} aria-label="Página anterior">
                    ‹
                  </button>

                  <figure className="onea-book-page">
                    <button
                      className="onea-book-page-zoom"
                      type="button"
                      onClick={() => openZoomImage(activeCatalogPageIndex)}
                      aria-label={`Ampliar página ${activeCatalogPage}`}
                    >
                      <img
                        src={catalogPageSrc(activeCatalogPage)}
                        alt={`Catálogo 1A Eventos página ${activeCatalogPage}`}
                        loading="lazy"
                      />
                    </button>
                    <figcaption>
                      Página {activeCatalogPageIndex + 1} de {selectedPages.length}
                    </figcaption>
                  </figure>

                  <button className="onea-book-arrow onea-book-arrow-right" type="button" onClick={goNextCatalogPage} aria-label="Página siguiente">
                    ›
                  </button>
                </div>

                <div className="onea-book-controls">
                  <button type="button" onClick={goPrevCatalogPage}>Anterior</button>
                  <span>{activeCatalogPageIndex + 1} / {selectedPages.length}</span>
                  <button type="button" onClick={goNextCatalogPage}>Siguiente</button>
                </div>

                <div className="onea-modal-cta-row onea-modal-cta-row-single">
                  <a href={catalogWhatsappUrl('asesoría para elegir piezas del catálogo completo')} target="_blank" rel="noopener noreferrer">
                    Hablar con 1A Eventos
                  </a>
                </div>
              </div>
            ) : (
              <div className="onea-product-viewer">
                <div className="onea-product-stage">
                  <button className="onea-product-arrow onea-product-arrow-left" type="button" onClick={goPrevCategoryImage} aria-label="Imagen anterior">
                    ‹
                  </button>

                  <button className="onea-product-main-image" type="button" onClick={() => openZoomImage(activeCategoryImageIndex)}>
                    <img src={activeCategoryImage} alt={selectedCatalog.label} loading="lazy" />
                  </button>

                  <button className="onea-product-arrow onea-product-arrow-right" type="button" onClick={goNextCategoryImage} aria-label="Imagen siguiente">
                    ›
                  </button>
                </div>

                <div className="onea-product-thumbs">
                  {selectedFeaturedImages.map((image, index) => (
                    <button
                      key={image}
                      type="button"
                      className={index === activeCategoryImageIndex ? 'is-active' : ''}
                      onClick={() => setActiveCategoryImageIndex(index)}
                    >
                      <img src={image} alt={`${selectedCatalog.label} ${index + 1}`} loading="lazy" />
                    </button>
                  ))}
                </div>

                <div className="onea-product-copy">
                  <h3>{selectedCatalog.label}</h3>
                  <p>{selectedCatalog.description}</p>
                </div>

                {selectedItems.length > 0 && (
                  <div className="onea-product-items">
                    <span>Estilos disponibles</span>
                    <ul>
                      {selectedItems.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="onea-modal-cta-row">
                  <a href={catalogWhatsappUrl(`asesoría para ${selectedCatalog.label}`)} target="_blank" rel="noopener noreferrer">
                    Recibir asesoría
                  </a>
                  <button type="button" onClick={() => openFullCatalogAtPage(selectedCategoryStartPage)}>
                    Ver más {selectedCatalog.label.toLowerCase()}
                  </button>
                </div>
              </div>
            )}
          </div>

          {zoomImage && (
            <div className="onea-image-zoom" role="dialog" aria-modal="true">
              <button className="onea-image-zoom-close" type="button" onClick={() => setZoomImage(null)} aria-label="Cerrar imagen ampliada">
                ×
              </button>

              <button className="onea-image-zoom-arrow onea-image-zoom-prev" type="button" onClick={goPrevZoomImage} aria-label="Imagen anterior">
                ‹
              </button>

              <img src={zoomImage} alt="Imagen ampliada del catálogo" />

              <button className="onea-image-zoom-arrow onea-image-zoom-next" type="button" onClick={goNextZoomImage} aria-label="Imagen siguiente">
                ›
              </button>
            </div>
          )}
        </div>
      )}

      <button
        className="onea-floating-chat"
        type="button"
        onClick={() => setChatOpen(true)}
        aria-label="Abrir chat de 1A Eventos"
      >
        <FaWhatsapp />
        <span>1</span>
      </button>

      {chatOpen && (
        <div className="onea-chat-panel-backdrop" role="dialog" aria-modal="true" aria-label="Chat 1A Eventos">
          <div className="onea-chat-panel">
            <div className="onea-chat-head">
              <div>
                <strong>1A Eventos</strong>
                <span>Asesoría para tu evento</span>
              </div>
              <button type="button" onClick={() => setChatOpen(false)} aria-label="Cerrar chat">×</button>
            </div>

            <div className="onea-chat-body">
              <p>Hola 👋</p>
              <h2>Gracias por escribir a 1A Eventos.</h2>
              <span>¿Cómo podemos ayudarte con tu evento?</span>

              <div className="onea-chat-options">
                {chatOptions.map((option) => (
                  <a key={option.label} href={whatsappHref(option.message)} target="_blank" rel="noopener noreferrer">
                    {option.label}
                  </a>
                ))}
              </div>

              <small>Se abrirá WhatsApp con tu consulta.</small>
            </div>
          </div>
        </div>
      )}

      {contactModalOpen && (
        <div className="onea-contact-modal-backdrop" role="dialog" aria-modal="true" aria-label="Formulario de contacto">
          <div className="onea-contact-modal">
            <button className="onea-contact-modal-close" type="button" onClick={() => setContactModalOpen(false)} aria-label="Cerrar formulario">
              ×
            </button>

            <h2>Cuéntanos qué necesitas</h2>
            <p>Completa estos datos y abriremos la conversación por WhatsApp con 1A Eventos.</p>

            <label>
              Nombre
              <input value={contactName} onChange={(event) => setContactName(event.target.value)} placeholder="Tu nombre" />
            </label>

            <label>
              Teléfono
              <input value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} placeholder="Tu número" />
            </label>

            <label>
              ¿Qué necesitas para tu evento?
              <textarea
                value={contactMessage}
                onChange={(event) => setContactMessage(event.target.value)}
                placeholder="Ej.: Quiero cotizar mobiliario para una boda, celebración familiar o evento corporativo."
              />
            </label>

            <button className="onea-contact-submit" type="button" onClick={submitContactForm}>
              Enviar por WhatsApp
            </button>
          </div>
        </div>
      )}

      <footer className="onea-footer">
        <strong>1A Eventos SRL</strong>
        <span>RNC: {PROFILE.companyRnc}</span>
        <small>Perfil digital por INTAP LINK</small>
      </footer>
    </main>
  )
}
