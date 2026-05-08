import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  FaPhoneAlt,
  FaWhatsapp,
  FaEnvelope,
  FaInstagram,
  FaMapMarkerAlt,
  FaRegAddressCard,
  FaHome,
  FaBuilding,
  FaKey,
  FaHandshake,
  FaCalendarAlt,
  FaTimes,
  FaChevronDown,
} from 'react-icons/fa'
import './IntapProfileNoviV4.css'

type NoviProfileProps = {
  profile?: any
}

type PropertyFeedMode = 'generic' | 'manual' | 'instagram'

type PropertyCard = {
  title: string
  text: string
  icon: string
  waText: string
}

type ServiceCard = {
  title: string
  text: string
  icon: string
  waText: string
}

const NOVI = {
  slug: 'novi',
  brand: 'NOVI HOME',
  advisor: 'Noldys Vicente',
  vcardName: 'Noldys Vicente - NoviHome',
  role: 'Asesora inmobiliaria',
  headline: 'Propiedades listas, orientación clara y acompañamiento confiable para comprar o invertir con seguridad.',
  phone: '809-966-6087',
  phoneRaw: '18099666087',
  whatsappRaw: '18099666087',
  email: 'noldysvicente@gmail.com',
  instagram: 'https://www.instagram.com/noldys.novihome/',
  instagramLabel: '@noldys.novihome',
  location: 'Av. Sarasota #45, Sector Bella Vista, Santo Domingo, Dominican Republic',
  logo: '/assets/landing/novi-logo.png',
  fallbackLogoText: 'NOVI HOME',
  photo: '/assets/landing/perfil-novi-01.png',
  heroImage: '/assets/landing/hero-novi-01.png',
  avatarChat: '/assets/landing/avatar-chat-novi-01.png',
  primary: '#D8566E',
  whatsappMessage: 'Hola Noldys, vi tu perfil digital de NOVI HOME y me interesa recibir asesoría inmobiliaria.',
}

const services: ServiceCard[] = [
  {
    title: 'Comprar',
    text: 'Te ayudo a encontrar opciones alineadas a tu presupuesto, zona y estilo de vida.',
    icon: '🏡',
    waText: 'Hola Noldys, quiero recibir asesoría para comprar una propiedad.',
  },
  {
    title: 'Vender',
    text: 'Acompañamiento para presentar tu propiedad mejor y conectar con compradores reales.',
    icon: '🤝',
    waText: 'Hola Noldys, quiero orientación para vender una propiedad.',
  },
  {
    title: 'Alquilar',
    text: 'Opciones residenciales para quienes buscan mudarse con claridad y confianza.',
    icon: '🔑',
    waText: 'Hola Noldys, me interesa alquilar una propiedad.',
  },
  {
    title: 'Invertir',
    text: 'Orientación para evaluar propiedades con potencial de renta, plusvalía o crecimiento.',
    icon: '📈',
    waText: 'Hola Noldys, quiero información sobre propiedades para inversión.',
  },
  {
    title: 'Agenda de visitas',
    text: 'Coordinamos recorridos para conocer las opciones que más se ajustan a ti.',
    icon: '📅',
    waText: 'Hola Noldys, quiero agendar una visita a una propiedad.',
  },
  {
    title: 'Asesoría personalizada',
    text: 'Filtramos opciones según zona, presupuesto, tamaño, etapa de vida y objetivo.',
    icon: '✨',
    waText: 'Hola Noldys, quiero una asesoría inmobiliaria personalizada.',
  },
]

const genericPropertyTypes: PropertyCard[] = [
  {
    title: 'Apartamentos',
    text: 'Opciones para vivir, mudarte o invertir en zonas estratégicas.',
    icon: '🏢',
    waText: 'Hola Noldys, me interesan apartamentos disponibles.',
  },
  {
    title: 'Casas familiares',
    text: 'Propiedades pensadas para comodidad, espacio y vida familiar.',
    icon: '🏠',
    waText: 'Hola Noldys, busco una casa familiar.',
  },
  {
    title: 'Alquileres residenciales',
    text: 'Apartamentos y viviendas para quienes necesitan una opción lista para ocupar.',
    icon: '🔑',
    waText: 'Hola Noldys, quiero información sobre alquileres residenciales.',
  },
  {
    title: 'Inversión inmobiliaria',
    text: 'Propiedades con potencial para renta, reventa o crecimiento patrimonial.',
    icon: '📊',
    waText: 'Hola Noldys, quiero evaluar opciones para invertir.',
  },
  {
    title: 'Proyectos nuevos',
    text: 'Alternativas en desarrollo para comprar temprano y planificar mejor.',
    icon: '🏗️',
    waText: 'Hola Noldys, quiero conocer proyectos nuevos.',
  },
  {
    title: 'Locales comerciales',
    text: 'Espacios para negocios, oficinas o expansión comercial.',
    icon: '🏬',
    waText: 'Hola Noldys, me interesan locales comerciales.',
  },
]

const zones = [
  'Piantini',
  'Naco',
  'Serrallés',
  'Evaristo Morales',
  'Bella Vista',
  'Cacicazgos',
  'Mirador Sur',
  'La Esperilla',
  'Paraíso',
  'Julieta Morales',
  'Urbanización Real',
  'Los Cacicazgos',
  'Renacimiento',
  'Arroyo Hondo Viejo',
  'El Millón',
]

const faqItems = [
  {
    q: '¿Me ayudas a buscar según mi presupuesto?',
    a: 'Sí. La idea es filtrar opciones según presupuesto, zona, tipo de propiedad y objetivo para que no pierdas tiempo viendo alternativas que no encajan contigo.',
  },
  {
    q: '¿Trabajas ventas y alquileres?',
    a: 'Sí. Puedo orientarte tanto en compra, venta, alquiler e inversión inmobiliaria, según las propiedades disponibles y tu necesidad.',
  },
  {
    q: '¿Puedo agendar una visita?',
    a: 'Sí. Podemos coordinar una visita luego de validar qué tipo de propiedad buscas, zona de interés y disponibilidad.',
  },
  {
    q: '¿Tienes opciones para inversión?',
    a: 'Sí. También podemos evaluar propiedades con potencial de renta, plusvalía o uso comercial.',
  },
]



const noviServicesList = [
  {
    title: 'Comprar',
    image: '/assets/landing/compra-novi.png',
    description: 'Te ayudo a encontrar opciones alineadas a tu presupuesto, zona y estilo de vida.',
    message: 'Hola Noldys, vi tu perfil digital de NOVIHOME y me interesa recibir asesoría para comprar una propiedad.',
  },
  {
    title: 'Vender',
    image: '/assets/landing/venta-novi.png',
    description: 'Acompañamiento para presentar tu propiedad mejor y conectar con compradores reales.',
    message: 'Hola Noldys, vi tu perfil digital de NOVIHOME y me interesa recibir asesoría para vender una propiedad.',
  },
  {
    title: 'Alquilar',
    image: '/assets/landing/alquiler-novi.png',
    description: 'Opciones residenciales para quienes buscan mudarse con claridad y confianza.',
    message: 'Hola Noldys, vi tu perfil digital de NOVIHOME y me interesa recibir asesoría para alquilar una propiedad.',
  },
  {
    title: 'Invertir',
    image: '/assets/landing/inversion-novi.png',
    description: 'Orientación para evaluar propiedades con potencial de renta, plusvalía o crecimiento.',
    message: 'Hola Noldys, vi tu perfil digital de NOVIHOME y quiero orientación para invertir en una propiedad.',
  },
  {
    title: 'Agenda de visitas',
    image: '/assets/landing/agendar-novi.png',
    description: 'Coordinamos recorridos para conocer las opciones que más se ajustan a ti.',
    message: 'Hola Noldys, vi tu perfil digital de NOVIHOME y quiero agendar una visita a una propiedad.',
  },
  {
    title: 'Asesoría personalizada',
    image: '/assets/landing/atencio-novi.png',
    description: 'Filtramos opciones según zona, presupuesto, tamaño, etapa de vida y objetivo.',
    message: 'Hola Noldys, vi tu perfil digital de NOVIHOME y quiero recibir asesoría inmobiliaria personalizada.',
  },
]

const noviPropertiesList = [
  {
    title: 'Apartamentos',
    image: '/assets/landing/apartamentos-novi.png',
    description: 'Opciones residenciales listas para vivir, alquilar o invertir con ubicación estratégica.',
    message: 'Hola Noldys, vi tu perfil digital de NOVIHOME y me interesa recibir información sobre apartamentos disponibles.',
  },
  {
    title: 'Casas',
    image: '/assets/landing/casas-novi.png',
    description: 'Propiedades familiares con espacios cómodos, funcionales y listas para evaluar.',
    message: 'Hola Noldys, vi tu perfil digital de NOVIHOME y quiero información sobre casas disponibles.',
  },
  {
    title: 'Locales comerciales',
    image: '/assets/landing/locales-novi.png',
    description: 'Espacios para negocios, oficinas o proyectos comerciales con buena proyección.',
    message: 'Hola Noldys, vi tu perfil digital de NOVIHOME y quiero información sobre locales comerciales disponibles.',
  },
  {
    title: 'Nuevos proyectos',
    image: '/assets/landing/nuevo-proy-novi.png',
    description: 'Proyectos inmobiliarios actuales para quienes desean comprar temprano o invertir.',
    message: 'Hola Noldys, vi tu perfil digital de NOVIHOME y me interesa conocer nuevos proyectos inmobiliarios disponibles.',
  },
  {
    title: 'Residenciales',
    image: '/assets/landing/residencial-novi.png',
    description: 'Opciones residenciales pensadas para vivir con comodidad, seguridad y buena ubicación.',
    message: 'Hola Noldys, vi tu perfil digital de NOVIHOME y quiero información sobre residenciales disponibles.',
  },
  {
    title: 'Inversiones',
    image: '/assets/landing/inversiones-novi.png',
    description: 'Alternativas con potencial de renta, plusvalía y crecimiento patrimonial.',
    message: 'Hola Noldys, vi tu perfil digital de NOVIHOME y quiero orientación sobre propiedades para inversión.',
  },
]

const chatOptions = [
  {
    label: 'Quiero agendar una visita',
    message: 'Hola Noldys, vi tu perfil digital de NOVIHOME y quiero agendar una visita a una propiedad.',
  },
  {
    label: '¿Qué propiedades listas tienes disponibles?',
    message: 'Hola Noldys, quiero información sobre propiedades listas disponibles.',
  },
  {
    label: 'Busco una propiedad para invertir',
    message: 'Hola Noldys, me interesa recibir orientación sobre propiedades para inversión.',
  },
  {
    label: 'Quiero recibir asesoría personalizada',
    message: 'Hola Noldys, quiero una asesoría inmobiliaria personalizada.',
  },
]

const propertyFeedConfig = {
  mode: 'generic' as PropertyFeedMode,
  instagramReady: true,
  instagramUsername: 'noldys.novihome',
  futureEndpoint: '/api/v1/public/profiles/novi/instagram-feed',
}

function cleanPhone(value: string) {
  return value.replace(/[^\d+]/g, '')
}

function waHref(message: string) {
  return `https://wa.me/${NOVI.whatsappRaw}?text=${encodeURIComponent(message)}`
}

function telHref(value: string) {
  return `tel:${cleanPhone(value)}`
}

function mailHref(subject = 'Consulta inmobiliaria NOVI HOME') {
  return `mailto:${NOVI.email}?subject=${encodeURIComponent(subject)}`
}

function mapHref() {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(NOVI.location)}`
}

function vcardHref() {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${NOVI.vcardName || NOVI.advisor}`,
    `ORG:${NOVI.brand}`,
    `TITLE:${NOVI.role}`,
    `TEL;TYPE=CELL:${NOVI.phoneRaw}`,
    `EMAIL:${NOVI.email}`,
    `ADR;TYPE=WORK:;;${NOVI.location};;;;`,
    `URL:${NOVI.instagram}`,
    'NOTE:Asesoría inmobiliaria personalizada para compra, venta, alquiler e inversión.',
    'END:VCARD',
  ]

  return `data:text/vcard;charset=utf-8,${encodeURIComponent(lines.join('\n'))}`
}

function LogoBlock() {
  return (
    <div className="novi-logo-wrap" aria-label={NOVI.brand}>
      <img
        src={NOVI.logo}
        alt={NOVI.brand}
        className="novi-logo-img"
        onError={(event) => {
          event.currentTarget.style.display = 'none'
          const fallback = event.currentTarget.nextElementSibling as HTMLElement | null
          if (fallback) fallback.style.display = 'block'
        }}
      />
      <span className="novi-logo-fallback">{NOVI.fallbackLogoText}</span>
    </div>
  )
}

function SectionTitle({
  eyebrow,
  title,
  text,
}: {
  eyebrow?: string
  title: string
  text?: string
}) {
  return (
    <div className="novi-section-head">
      {eyebrow && <span className="novi-eyebrow">{eyebrow}</span>}
      <h2>{title}</h2>
      {text && <p>{text}</p>}
    </div>
  )
}

function NoviPropertyFeed({ mode = 'generic' as PropertyFeedMode }) {
  const items = genericPropertyTypes

  return (
    <section className="novi-section novi-property-section" id="propiedades">
      <SectionTitle
        eyebrow="Propiedades"
        title="Propiedades que puedo ayudarte a encontrar"
        text="Esta sección se mantiene vigente aunque las publicaciones cambien. Más adelante podrá conectarse al feed real de Instagram."
      />

      <div className="novi-property-grid">
        {items.map((item) => (
          <article className="novi-property-card" key={item.title}>
            <div className="novi-property-icon">{item.icon}</div>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
            <a href={waHref(item.waText)} target="_blank" rel="noopener noreferrer">
              Consultar
            </a>
          </article>
        ))}
      </div>

      <div className="novi-instagram-ready">
        <div>
          <span>Últimas publicaciones</span>
          <strong>Feed de Instagram preparado</strong>
          <p>
            Mientras activamos la conexión automática, puedes ver las publicaciones recientes directamente en Instagram.
          </p>
        </div>
        <a href={NOVI.instagram} target="_blank" rel="noopener noreferrer">
          Ver Instagram
        </a>
      </div>
    </section>
  )
}

export default function IntapProfileNoviV4({ profile }: NoviProfileProps) {
  const [contactOpen, setContactOpen] = useState(false)
  const [noviServicesOpen, setNoviServicesOpen] = useState(false)
  const [noviPropertiesOpen, setNoviPropertiesOpen] = useState(false)
  const [noviZonesOpen, setNoviZonesOpen] = useState(false)
  const [noviDetailItem, setNoviDetailItem] = useState<null | { title: string; image: string; description: string; message: string }>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [showNoviIntro, setShowNoviIntro] = useState(true)
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const [form, setForm] = useState({
    name: '',
    phone: '',
    message: '',
  })

  const profileName = profile?.name || NOVI.advisor
  const profileRole = profile?.role || NOVI.role
  const profileBio = profile?.bio || NOVI.headline

  useEffect(() => {
    const noviIntroTimer = window.setTimeout(() => {
      setShowNoviIntro(false)
    }, 3300)

    return () => window.clearTimeout(noviIntroTimer)
  }, [])

  const contactMessage = useMemo(() => {
    const intro = `Hola Noldys, vi tu perfil digital de NOVI HOME.`
    const name = form.name.trim() ? `\nMi nombre es: ${form.name.trim()}` : ''
    const phone = form.phone.trim() ? `\nMi teléfono es: ${form.phone.trim()}` : ''
    const message = form.message.trim() ? `\nMensaje: ${form.message.trim()}` : ''
    return `${intro}${name}${phone}${message}`
  }, [form])

  function submitContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    window.open(waHref(contactMessage), '_blank', 'noopener,noreferrer')
    setContactOpen(false)
  }

  return (
    <main className="novi-v4-page">
      {showNoviIntro && (
        <div className="noviBootOverlay4B" aria-label="Cargando perfil NOVI HOME">
          <style>{`
            .noviBootOverlay4B {
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
              animation: noviBootFade4B 0.55s ease 3.05s forwards;
            }

            .noviBootLogoWrap4B {
              width: min(420px, 82vw);
              height: min(420px, 82vw);
              display: flex;
              align-items: center;
              justify-content: center;
              opacity: 1;
              visibility: visible;
            }

            .noviBootLogo4B {
              display: block;
              width: min(380px, 78vw);
              height: auto;
              max-height: 380px;
              object-fit: contain;
              opacity: 0;
              visibility: visible;
              filter: blur(12px);
              transform: translateY(34px) scale(0.2);
              animation: noviBootZoom4B 3s ease-in-out forwards;
            }

            @keyframes noviBootZoom4B {
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

            @keyframes noviBootFade4B {
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

          <div className="noviBootLogoWrap4B">
            <img
              className="noviBootLogo4B"
              src="/assets/landing/logo-novi-01.png"
              alt="NOVI HOME"
            />
          </div>
        </div>
      )}

      <section className="novi-hero">
        <div className="novi-hero-card">
          <div
            className="novi-hero-property"
            style={{ backgroundImage: `url(${NOVI.heroImage})` }}
            aria-hidden="true"
          />

          <div className="novi-avatar-shell">
            {NOVI.photo ? (
              <img src={NOVI.photo} alt={profileName} />
            ) : (
              <div className="novi-avatar-placeholder">
                <FaHome />
              </div>
            )}
          </div>

          <span className="novi-profile-kicker">{'NOVIHOME S.R.L.'}</span>
          <h1>{profileName}</h1>
          <p className="novi-role">{profileRole}</p>
          <p className="novi-headline">{profileBio}</p>

          <a className="novi-main-cta" href={waHref(NOVI.whatsappMessage)} target="_blank" rel="noopener noreferrer">
            <FaWhatsapp />
            Solicitar asesoría por WhatsApp
          </a>

          <div className="novi-quick-actions" aria-label="Accesos rápidos">
            <a href={telHref(NOVI.phoneRaw)}>
              <FaPhoneAlt />
              <span>Llamar</span>
            </a>
            <a href={waHref(NOVI.whatsappMessage)} target="_blank" rel="noopener noreferrer">
              <FaWhatsapp />
              <span>WhatsApp</span>
            </a>
            <a href={NOVI.instagram} target="_blank" rel="noopener noreferrer">
              <FaInstagram />
              <span>Instagram</span>
            </a>
          </div>

          <a className="novi-vcard-btn" href={vcardHref()} download="Noldys-Vicente-NOVI-HOME.vcf">
            <FaRegAddressCard />
            Guardar contacto
          </a>
        </div>
      </section>

      <section className="novi-section novi-about">
        <SectionTitle
          eyebrow="Sobre mí"
          title="Acompañamiento inmobiliario claro, cercano y profesional"
        />
        <div className="novi-about-card">
          <p>
            Soy Noldys Vicente, asesora inmobiliaria y fundadora de NOVIHOME. Me especializo en acompañar a personas que buscan propiedades listas, con una orientación clara, profesional y enfocada en sus objetivos.
          </p>
          <p>
            Soy licenciada en Comunicación Digital y afiliada a la Asociación de Empresas Inmobiliarias (AEI). Mi enfoque no es solo mostrar propiedades, sino generar confianza, guiarte correctamente y ayudarte a tomar una decisión segura y sin complicaciones.
          </p>
        </div>
      </section>

      <section className="novi-section novi-services novi-card-section">
        <SectionTitle
          eyebrow="Servicios"
          title="Soluciones inmobiliarias"
          text="Elige el tipo de asesoría que necesitas y conversemos por WhatsApp."
        />

        <div className="novi-mini-card-grid">
          {noviServicesList.slice(0, 2).map((item) => (
            <article className="novi-mini-card" key={item.title}>
              <div className="novi-card-thumb" role="button" tabIndex={0} onClick={() => setNoviDetailItem(item)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setNoviDetailItem(item) }}>
                <img src={item.image} alt={item.title} />
              </div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <a className="novi-whatsapp-cta" href={waHref(item.message)} target="_blank" rel="noopener noreferrer">
                Me interesa
              </a>
            </article>
          ))}
        </div>

        <button className="novi-more-btn" type="button" onClick={() => setNoviServicesOpen(true)}>
          Ver todos los servicios
        </button>
      </section>
      <section className="novi-section novi-properties novi-card-section">
        <SectionTitle
          eyebrow="Propiedades"
          title="Tipos de propiedades"
          text="Opciones listas para comprar, alquilar o invertir con mayor claridad."
        />

        <div className="novi-mini-card-grid">
          {noviPropertiesList.slice(0, 2).map((item) => (
            <article className="novi-mini-card" key={item.title}>
              <div className="novi-card-thumb" role="button" tabIndex={0} onClick={() => setNoviDetailItem(item)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setNoviDetailItem(item) }}>
                <img src={item.image} alt={item.title} />
              </div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <a className="novi-whatsapp-cta" href={waHref(item.message)} target="_blank" rel="noopener noreferrer">
                Me interesa
              </a>
            </article>
          ))}
        </div>

        <button className="novi-more-btn" type="button" onClick={() => setNoviPropertiesOpen(true)}>
          Ver todas las propiedades
        </button>
      </section>
      <section className="novi-section novi-zones">
        <SectionTitle
          eyebrow="Zonas"
          title="Zonas exclusivas"
          text="Estas zonas pueden variar según disponibilidad, presupuesto y tipo de propiedad."
        />

        <div className="novi-zone-list novi-zone-featured-list">
          {zones.slice(0, 6).map((zone) => (
            <span key={zone}>{zone}</span>
          ))}
        </div>

        <button className="novi-more-btn novi-zones-more-btn" type="button" onClick={() => setNoviZonesOpen(true)}>
          Ver todas las zonas
        </button>
      </section>

      {noviZonesOpen && (
        <div className="novi-list-modal-overlay novi-zones-modal-overlay" role="presentation" onClick={() => setNoviZonesOpen(false)}>
          <div className="novi-list-modal novi-zones-modal" role="dialog" aria-modal="true" aria-label="Todas las zonas exclusivas" onClick={(event) => event.stopPropagation()}>
            <button className="novi-list-modal-close" type="button" onClick={() => setNoviZonesOpen(false)} aria-label="Cerrar zonas">
              <FaTimes />
            </button>

            <h2>Zonas exclusivas</h2>
            <p className="novi-zones-modal-intro">
              La disponibilidad puede variar según presupuesto, tipo de propiedad, ubicación y objetivo de compra o inversión.
            </p>

            <div className="novi-zones-modal-grid">
              {zones.map((zone) => (
                <span className="novi-zone-modal-item" key={zone}>
                  <span className="novi-zone-check">✓</span>
                  <span>{zone}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <section className="novi-section novi-company">
        <div className="novi-company-logo-title">
          <img src="/assets/landing/logo-novi-01.png" alt="NOVI HOME" />
        </div>
        <div className="novi-about-clean-heading">Sobre nosotros</div>

<div className="novi-company-card">
<p>
            NOVIHOME es una marca inmobiliaria en República Dominicana enfocada en soluciones reales, confiables y sin complicaciones. Nos especializamos en propiedades listas para que cada cliente pueda decidir con claridad, seguridad y sin largos tiempos de espera.
          </p>
          <p>
            Trabajamos con propiedades previamente evaluadas y ofrecemos un acompañamiento cercano, transparente y personalizado en cada etapa del proceso.
          </p>
          <p className="novi-company-legal-note">NOVI HOME está debidamente registrada como NOVIHOME SRL, RNC 133-34137-9, garantizando respaldo, formalidad y compromiso en cada operación.</p>
        </div>
      </section>

      <section className="novi-section novi-company-contact">
        <SectionTitle
          eyebrow="Contacto"
          title="Contactos de NOVI HOME"
          text="Comunícate por el canal que prefieras para recibir orientación inmobiliaria."
        />

        <div className="novi-contact-strip">
          <a href={telHref(NOVI.phoneRaw)}>
            <FaPhoneAlt />
            <span>{NOVI.phone}</span>
          </a>
          <a href={mailHref()}>
            <FaEnvelope />
            <span>{NOVI.email}</span>
          </a>
          <a href={NOVI.instagram} target="_blank" rel="noopener noreferrer">
            <FaInstagram />
            <span>{NOVI.instagramLabel}</span>
          </a>
          <a className="novi-map-link" href={mapHref()} target="_blank" rel="noopener noreferrer">
            <FaMapMarkerAlt />
            <span>{NOVI.location}</span>
          </a>
        </div>
      </section>

      <section className="novi-section novi-contact-cta">
        <h2>¿Buscas una propiedad o quieres orientación?</h2>
        <p>Déjame tus datos y abrimos la conversación por WhatsApp para ayudarte mejor.</p>
        <button type="button" onClick={() => setContactOpen(true)}>
          Contáctanos
        </button>
      </section>

      <section className="novi-section novi-faq">
        <SectionTitle eyebrow="Preguntas frecuentes" title="Antes de comenzar" />
        <div className="novi-faq-list">
          {faqItems.map((item, index) => {
            const isOpen = openFaq === index
            return (
              <article className={`novi-faq-item ${isOpen ? 'is-open' : ''}`} key={item.q}>
                <button type="button" onClick={() => setOpenFaq(isOpen ? null : index)}>
                  <span>{item.q}</span>
                  <FaChevronDown />
                </button>
                {isOpen && <p>{item.a}</p>}
              </article>
            )
          })}
        </div>
      </section>

      <footer className="novi-footer">
        <strong>NOVIHOME S.R.L.</strong>
        <span>RNC: 133-34137-9</span>
        <span>Santo Domingo R.D.</span>
        <span className="novi-intap-brand">Perfil digital creado por INTAP LINK</span>
      </footer>

      <div className={`novi-chat-widget ${chatOpen ? 'is-open' : ''}`}>
        {chatOpen && (
          <div className="novi-chat-panel" role="dialog" aria-label="Chat rápido NOVI HOME">
            <div className="novi-chat-panel-head">
              <div className="novi-chat-avatar">
                {NOVI.avatarChat ? <img src={NOVI.avatarChat} alt="Noldys chat" /> : (NOVI.photo ? <img src={NOVI.photo} alt="Noldys Vicente" /> : <FaHome />)}
              </div>
              <strong>Noldys</strong>
              <button type="button" onClick={() => setChatOpen(false)} aria-label="Cerrar chat">
                <FaTimes />
              </button>
            </div>

            <div className="novi-chat-body">
              <p>
                Hola 👋<br />
                Gracias por tu interés en NOVIHOME.<br />
                <b>¿En qué puedo ayudarte hoy?</b>
              </p>

              <div className="novi-chat-options">
                {chatOptions.map((option) => (
                  <a
                    key={option.label}
                    href={waHref(option.message)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setChatOpen(false)}
                  >
                    {option.label}
                  </a>
                ))}
              </div>

              <small>Se abrirá un chat de WhatsApp con tu consulta.</small>
            </div>
          </div>
        )}

        <button
          className="novi-floating-chat"
          type="button"
          onClick={() => setChatOpen((value) => !value)}
          aria-label={chatOpen ? 'Cerrar chat rápido' : 'Abrir chat rápido'}
        >
          <span className="novi-floating-dot">1</span>
          {NOVI.avatarChat ? <img src={NOVI.avatarChat} alt="Noldys chat" /> : (NOVI.photo ? <img src={NOVI.photo} alt="Noldys Vicente" /> : <FaWhatsapp />)}
        </button>
      </div>

      {noviServicesOpen && (
        <div className="novi-list-modal-overlay" role="presentation" onClick={() => setNoviServicesOpen(false)}>
          <div className="novi-list-modal" role="dialog" aria-modal="true" aria-label="Todos los servicios" onClick={(event) => event.stopPropagation()}>
            <button className="novi-list-modal-close" type="button" onClick={() => setNoviServicesOpen(false)} aria-label="Cerrar servicios">
              <FaTimes />
            </button>

            <h2>Todos los servicios</h2>

            <div className="novi-list-modal-grid">
              {noviServicesList.map((item) => (
                <article className="novi-list-modal-card" key={item.title}>
                  <div className="novi-modal-card-thumb" role="button" tabIndex={0} onClick={() => setNoviDetailItem(item)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setNoviDetailItem(item) }}>
                    <img src={item.image} alt={item.title} />
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  <a className="novi-whatsapp-cta" href={waHref(item.message)} target="_blank" rel="noopener noreferrer" onClick={() => setNoviServicesOpen(false)}>
                    Me interesa
                  </a>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}

      {noviPropertiesOpen && (
        <div className="novi-list-modal-overlay" role="presentation" onClick={() => setNoviPropertiesOpen(false)}>
          <div className="novi-list-modal" role="dialog" aria-modal="true" aria-label="Tipos de propiedades" onClick={(event) => event.stopPropagation()}>
            <button className="novi-list-modal-close" type="button" onClick={() => setNoviPropertiesOpen(false)} aria-label="Cerrar propiedades">
              <FaTimes />
            </button>

            <h2>Tipos de propiedades</h2>

            <div className="novi-list-modal-grid">
              {noviPropertiesList.map((item) => (
                <article className="novi-list-modal-card" key={item.title}>
                  <div className="novi-modal-card-thumb" role="button" tabIndex={0} onClick={() => setNoviDetailItem(item)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setNoviDetailItem(item) }}>
                    <img src={item.image} alt={item.title} />
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  <a className="novi-whatsapp-cta" href={waHref(item.message)} target="_blank" rel="noopener noreferrer" onClick={() => setNoviPropertiesOpen(false)}>
                    Me interesa
                  </a>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}

      {noviDetailItem && (
        <div className="novi-detail-modal-overlay" role="presentation" onClick={() => setNoviDetailItem(null)}>
          <div className="novi-detail-modal" role="dialog" aria-modal="true" aria-label={`Detalle de ${noviDetailItem.title}`} onClick={(event) => event.stopPropagation()}>
            <button className="novi-detail-modal-close" type="button" onClick={() => setNoviDetailItem(null)} aria-label="Cerrar detalle">
              <FaTimes />
            </button>

            <div className="novi-detail-media">
              <img src={noviDetailItem.image} alt={noviDetailItem.title} />
            </div>

            <div className="novi-detail-content">
              <span>Referencia disponible</span>
              <h2>{noviDetailItem.title}</h2>
              <p>{noviDetailItem.description}</p>
              <a className="novi-whatsapp-cta novi-detail-whatsapp-cta" href={waHref(noviDetailItem.message)} target="_blank" rel="noopener noreferrer" onClick={() => setNoviDetailItem(null)}>
                Consultar por WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}

      {contactOpen && (
        <div className="novi-modal-backdrop" role="presentation" onClick={() => setContactOpen(false)}>
          <div className="novi-modal" role="dialog" aria-modal="true" aria-label="Formulario de contacto" onClick={(event) => event.stopPropagation()}>
            <button className="novi-modal-close" type="button" onClick={() => setContactOpen(false)} aria-label="Cerrar">
              <FaTimes />
            </button>

            <h2>Contáctanos</h2>
            <p>Completa estos datos y enviaremos el mensaje por WhatsApp.</p>

            <form onSubmit={submitContact}>
              <label>
                Nombre
                <input
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder="Tu nombre"
                />
              </label>

              <label>
                Teléfono
                <input
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  placeholder="Tu número"
                />
              </label>

              <label>
                ¿Qué estás buscando?
                <textarea
                  value={form.message}
                  onChange={(event) => setForm({ ...form, message: event.target.value })}
                  placeholder="Ej.: Busco apartamento en alquiler en Santo Domingo..."
                  rows={4}
                />
              </label>

              <button type="submit">
                <FaWhatsapp />
                Enviar por WhatsApp
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
