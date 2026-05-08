import { useState, type ReactNode } from 'react'
import { FaPhoneAlt, FaWhatsapp, FaEnvelope, FaMapMarkerAlt, FaClock } from 'react-icons/fa'
import './IntapProfileJasonV3.css'

type JasonProfileProps = {
  profile?: any
}

const JASON = {
  name: 'Comercial Jason S.R.L.',
  subtitle: 'Venta de gomas y aros, nuevos y usados',
  experience: 'Más de 25 años de experiencia',
  description: '',
  phone: '(809) 684-8842',
  phoneRaw: '8096848842',
  whatsapp: '(809) 834-0794',
  whatsappRaw: '18098340794',
  email: 'comercialjason@hotmail.com',
  address: 'C. María Montez 213, Santo Domingo 10411, R.D.',
  hours: 'Lunes a sábado · 7:00 AM – 6:30 PM',
  logo: '/assets/landing/jason-logo-blanco-rojo.png',
  hero: '/assets/landing/hero-jason-05.png',
}

const services = [
  {
    title: 'Gomas',
    text: 'Gomas nuevas y usadas para diferentes tipos de vehículos.',
    icon: '◉',
  },
  {
    title: 'Aros',
    text: 'Aros en diferentes estilos, tamaños y diseños.',
    icon: '✦',
  },
  {
    title: 'Válvulas',
    text: 'Válvulas y piezas complementarias para neumáticos.',
    icon: '◆',
  },
  {
    title: 'Accesorios',
    text: 'Accesorios para aros, neumáticos y vehículos.',
    icon: '●',
  },
]

const waMessage = encodeURIComponent(
  'Hola, vi el perfil digital de Comercial Jason. Me interesa cotizar gomas, aros o servicios para mi vehículo.'
)

function telHref(value: string) {
  return `tel:${value.replace(/[^\d+]/g, '')}`
}

function vcardHref() {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${JASON.name}`,
    `ORG:${JASON.name}`,
    `TEL;TYPE=WORK,VOICE:${JASON.phoneRaw}`,
    `TEL;TYPE=CELL:${JASON.whatsappRaw}`,
    `ADR;TYPE=WORK:;;${JASON.address};;;;`,
    'NOTE:Venta de gomas nuevas y usadas, aros, reparación y mantenimiento. Más de 25 años de experiencia.',
    'END:VCARD',
  ]

  return `data:text/vcard;charset=utf-8,${encodeURIComponent(lines.join('\n'))}`
}


const JASON_GALLERY_IMAGES = [
  '/assets/landing/galeria jason-01.png',
  '/assets/landing/galeria jason-02.png',
  '/assets/landing/galeria jason-03.png',
  '/assets/landing/galeria jason-04.png',
  '/assets/landing/galeria jason-05.png',
  '/assets/landing/galeria jason-06.png',
  '/assets/landing/galeria jason-07.png',
  '/assets/landing/galeria jason-08.png',
]

type JasonService = {
  id: string
  title: string
  short: string
  description: string
  measures: string[]
  images: string[]
  whatsappMessage: string
}

const JASON_SERVICES: JasonService[] = [
  {
    id: 'gomas',
    title: 'Gomas',
    short: 'Gomas nuevas y usadas para distintos tipos de vehículos.',
    description:
      'Venta de gomas nuevas y usadas, con orientación personalizada para elegir la opción adecuada según el vehículo, el uso y la medida disponible.',
    measures: ['13"', '14"', '15"', '16"', '17"', '18"', '19"', '20"'],
    images: [
      '/assets/landing/goma-1.png',
      '/assets/landing/goma-2.png',
      '/assets/landing/goma-3.png',
      '/assets/landing/goma-4.png',
      '/assets/landing/goma-5.png',
      '/assets/landing/goma-6.png',
      '/assets/landing/goma-7.png',
      '/assets/landing/goma-aro.png',
    ],
    whatsappMessage: 'Hola, me interesa cotizar gomas para mi vehículo.',
  },
  {
    id: 'aros',
    title: 'Aros',
    short: 'Aros deportivos y estilos para mejorar la presencia del vehículo.',
    description:
      'Aros para distintos estilos de vehículos, ideales para renovar la imagen, mejorar presencia visual y complementar la elección de neumáticos.',
    measures: ['15"', '16"', '17"', '18"', '19"', '20"'],
    images: [
      '/assets/landing/aro-1.png',
      '/assets/landing/aro-2.png',
      '/assets/landing/aro-3.png',
      '/assets/landing/aro-4.png',
      '/assets/landing/aro-5.png',
      '/assets/landing/aro-6.png',
      '/assets/landing/aro-7.png',
    ],
    whatsappMessage: 'Hola, me interesa cotizar aros disponibles.',
  },
  {
    id: 'reparacion',
    title: 'Reparación',
    short: 'Revisión y reparación de gomas para ayudarte a seguir en ruta.',
    description:
      'Servicio de reparación de aros, enfocado en corregir detalles, evaluar condiciones y ayudarte a recuperar la funcionalidad y presentación del aro con una orientación clara y profesional.',
    measures: ['Diagnóstico', 'Corrección', 'Evaluación', 'Consulta disponibilidad'],
    images: [
      '/assets/landing/reparacion-aro.png',
      '/assets/landing/goma-aro.png',
      '/assets/landing/goma-1.png',
    ],
    whatsappMessage: 'Hola, me interesa información sobre reparación de aros.',
  },
  {
    id: 'mantenimiento',
    title: 'Mantenimiento',
    short: 'Atención para prolongar el buen estado de gomas y aros.',
    description:
      'Servicio de mantenimiento preventivo para aros, ideal para conservar su apariencia, revisar su estado y ayudarte a prolongar su buen funcionamiento con asesoría experta y atención personalizada.',
    measures: ['Inspección', 'Limpieza', 'Evaluación', 'Consulta disponibilidad'],
    images: [
      '/assets/landing/manten-aro.png',
      '/assets/landing/aro-1.png',
      '/assets/landing/goma-2.png',
    ],
    whatsappMessage: 'Hola, me interesa información sobre mantenimiento de aros.',
  },
]


export default function IntapProfileJasonV3(_props: JasonProfileProps) {
  const whatsappUrl = `https://wa.me/${JASON.whatsappRaw}?text=${waMessage}`
  const whatsappNumberForChat = (JASON.whatsapp || '').replace(/\D/g, '')
  const chatTitle = 'Comercial Jason'
  const chatGreeting = 'Hola 👋\nGracias por comunicarte con Comercial Jason.\n¿En qué podemos ayudarte hoy?'
  const chatOptions = [
    'Quiero cotizar gomas para mi vehículo',
    'Quiero cotizar aros disponibles',
    'Quiero información sobre reparación de aros',
    'Quiero información sobre mantenimiento de aros',
  ]

  const openWhatsappWithText = (text: string) => {
    if (!whatsappNumberForChat) return
    const url = `https://wa.me/${whatsappNumberForChat}?text=${encodeURIComponent(text)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const mapSearchQuery = 'Comercial Jason S.R.L.'
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapSearchQuery)}`
  const [activeServiceId, setActiveServiceId] = useState<string | null>(null)
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [lightboxImages, setLightboxImages] = useState<string[]>([])
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [chatOpen, setChatOpen] = useState(false)
  const [galleryIndex, setGalleryIndex] = useState(0)
  const activeService = JASON_SERVICES.find((service) => service.id === activeServiceId) || null
  const lightboxImage = lightboxImages[lightboxIndex] || null

  const openLightbox = (images: string[], index = 0) => {
    if (!images.length) return
    const safeIndex = Math.max(0, Math.min(index, images.length - 1))
    setLightboxImages(images)
    setLightboxIndex(safeIndex)
  }

  const closeLightbox = () => {
    setLightboxImages([])
    setLightboxIndex(0)
  }

  const showPrevLightboxImage = () => {
    setLightboxIndex((current) =>
      current === 0 ? lightboxImages.length - 1 : current - 1
    )
  }

  const showNextLightboxImage = () => {
    setLightboxIndex((current) =>
      current === lightboxImages.length - 1 ? 0 : current + 1
    )
  }



  return (
    <main className="jason-v3-page">
      <section
        className="jason-v3-hero"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(0,0,0,.95), rgba(0,0,0,.62)), url(${JASON.hero})`,
        }}
      >
        <div className="jason-v3-hero__content">
          <img src={JASON.logo} alt="Comercial Jason" className="jason-v3-logo" />
          <h1>{JASON.name}</h1>
          <p>{JASON.subtitle}</p>
          <span className="jason-v3-badge">★ {JASON.experience}</span>
        </div>
      </section>

      <section className="jason-v3-quick" aria-label="Accesos rápidos">
        <a href={telHref(JASON.phone)} className="jason-v3-quick__item">
          <span aria-hidden="true"><FaPhoneAlt /></span>
          <strong>Teléfono</strong>
        </a>
        <a href={whatsappUrl} className="jason-v3-quick__item">
          <span aria-hidden="true"><FaWhatsapp /></span>
          <strong>WhatsApp</strong>
        </a>
        <a href={mapUrl} target="_blank" rel="noreferrer" className="jason-v3-quick__item">
          <span aria-hidden="true"><FaMapMarkerAlt /></span>
          <strong>Ubicación</strong>
        </a>
      </section>

      <section className="jason-v3-card jason-v3-contact">
        <ContactRow variant="phone" icon={<FaPhoneAlt />} label="Teléfono" value={JASON.phone} href={telHref(JASON.phone)} />
        <ContactRow variant="whatsapp" icon={<FaWhatsapp />} label="WhatsApp" value={JASON.whatsapp} href={whatsappUrl} />
        <ContactRow variant="email" icon={<FaEnvelope />} label="Correo electrónico" value={JASON.email} href={`mailto:${JASON.email}`} />
        <ContactRow variant="address" icon={<FaMapMarkerAlt />} label="Dirección" value={JASON.address} href={mapUrl} external />
        <ContactRow variant="hours" icon={<FaClock />} label="Horario de atención" value={JASON.hours} />
      </section>

      <section className="jason-v3-vcard">
        <a href={vcardHref()} download="comercial-jason.vcf">
          Guardar contacto
        </a>
      </section>

      <section className="jason-v3-card jason-v3-about">
        <div className="jason-v3-section-head">
          <span>●</span>
          <h2>Sobre nosotros</h2>
        </div>
        <p>
          En Comercial Jason S.R.L. llevamos más de 25 años ayudando a conductores, empresas y negocios a elegir gomas y aros con confianza. Ofrecemos gomas nuevas y usadas, aros seleccionados y servicios especializados para aros, con asesoría experta, atención personalizada y orientación clara según el tipo de vehículo, uso y presupuesto.

          Trabajamos con marcas líderes del mercado y respaldamos nuestros productos y servicios con garantía, porque sabemos que una buena elección no solo mejora la presencia del vehículo: también aporta seguridad, rendimiento y tranquilidad en cada trayecto.
        </p>
      </section>

      <section className="jason-v3-card jason-v3-services-section">
        <div className="jason-v3-section-head">
          <span>✦</span>
          <h2>Servicios / Productos</h2>
        </div>

        <div className="jason-v3-services">
          {JASON_SERVICES.map((service) => (
            <button
              key={service.id}
              type="button"
              className="jason-v3-service"
              onClick={() => {
                setActiveServiceId(service.id)
                setActiveImageIndex(0)
              }}
            >
              <img src={service.images[0]} alt={service.title} loading="lazy" />
              <strong>{service.title}</strong>
              <small>{service.short}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="jason-v3-card jason-v3-gallery-section">
        <div className="jason-v3-section-head">
          <span>▣</span>
          <h2>Galería</h2>
        </div>

        <div className="jason-v3-gallery-slider">
          <button
            type="button"
            className="jason-v3-gallery-arrow jason-v3-gallery-arrow--prev"
            onClick={() =>
              setGalleryIndex((current) =>
                current === 0 ? JASON_GALLERY_IMAGES.length - 1 : current - 1
              )
            }
            aria-label="Imagen anterior de la galería"
          >
            ‹
          </button>

          <button
            type="button"
            className="jason-v3-gallery-main"
            onClick={() => openLightbox(JASON_GALLERY_IMAGES, galleryIndex)}
            aria-label="Ampliar imagen de galería"
          >
            <img
              src={JASON_GALLERY_IMAGES[galleryIndex]}
              alt={`Galería Comercial Jason ${galleryIndex + 1}`}
              loading="lazy"
            />
          </button>

          <button
            type="button"
            className="jason-v3-gallery-arrow jason-v3-gallery-arrow--next"
            onClick={() =>
              setGalleryIndex((current) =>
                current === JASON_GALLERY_IMAGES.length - 1 ? 0 : current + 1
              )
            }
            aria-label="Imagen siguiente de la galería"
          >
            ›
          </button>
        </div>

        <div className="jason-v3-gallery-thumbs">
          {JASON_GALLERY_IMAGES.map((image, index) => (
            <button
              key={image}
              type="button"
              className={index === galleryIndex ? 'is-active' : ''}
              onClick={() => setGalleryIndex(index)}
              aria-label={`Ver imagen de galería ${index + 1}`}
            >
              <img src={image} alt={`Miniatura Comercial Jason ${index + 1}`} loading="lazy" />
            </button>
          ))}
        </div>
      </section>


      {activeService && (
        <div className="jason-v3-modal-backdrop" role="dialog" aria-modal="true">
          <div className="jason-v3-product-modal">
            <button
              type="button"
              className="jason-v3-modal-close"
              onClick={() => setActiveServiceId(null)}
              aria-label="Cerrar modal"
            >
              ×
            </button>

            <div className="jason-v3-modal-media">
              <button
                type="button"
                className="jason-v3-modal-main-image"
                onClick={() => openLightbox(activeService.images, activeImageIndex)}
              >
                <img
                  src={activeService.images[activeImageIndex]}
                  alt={activeService.title}
                />
              </button>

              <div className="jason-v3-modal-arrows">
                <button
                  type="button"
                  onClick={() =>
                    setActiveImageIndex((current) =>
                      current === 0 ? activeService.images.length - 1 : current - 1
                    )
                  }
                  aria-label="Imagen anterior"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setActiveImageIndex((current) =>
                      current === activeService.images.length - 1 ? 0 : current + 1
                    )
                  }
                  aria-label="Imagen siguiente"
                >
                  ›
                </button>
              </div>

              <div className="jason-v3-modal-thumbs">
                {activeService.images.map((image, index) => (
                  <button
                    key={image}
                    type="button"
                    className={index === activeImageIndex ? 'is-active' : ''}
                    onClick={() => setActiveImageIndex(index)}
                  >
                    <img src={image} alt={`${activeService.title} ${index + 1}`} />
                  </button>
                ))}
              </div>
            </div>

            <div className="jason-v3-modal-copy">
              <p className="jason-v3-modal-kicker">Servicio disponible</p>
              <h3>{activeService.title}</h3>
              <p>{activeService.description}</p>

              <div className="jason-v3-modal-measures">
                <strong>Opciones / medidas disponibles</strong>
                <div>
                  {activeService.measures.map((measure) => (
                    <span key={measure}>{measure}</span>
                  ))}
                </div>
              </div>

              <a
                href={`https://wa.me/${JASON.whatsappRaw}?text=${encodeURIComponent(activeService.whatsappMessage)}`}
                className="jason-v3-modal-cta"
                target="_blank"
                rel="noreferrer"
              >
                Cotizar por WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}

      {lightboxImage && (
        <div
          className="jason-v3-lightbox"
          role="dialog"
          aria-modal="true"
          onClick={closeLightbox}
        >
          <button
            type="button"
            className="jason-v3-lightbox-close"
            aria-label="Cerrar imagen ampliada"
            onClick={(event) => {
              event.stopPropagation()
              closeLightbox()
            }}
          >
            ×
          </button>

          {lightboxImages.length > 1 && (
            <button
              type="button"
              className="jason-v3-lightbox-nav jason-v3-lightbox-nav--prev"
              aria-label="Imagen anterior"
              onClick={(event) => {
                event.stopPropagation()
                showPrevLightboxImage()
              }}
            >
              ‹
            </button>
          )}

          <img
            src={lightboxImage}
            alt="Imagen ampliada Comercial Jason"
            onClick={(event) => event.stopPropagation()}
          />

          {lightboxImages.length > 1 && (
            <button
              type="button"
              className="jason-v3-lightbox-nav jason-v3-lightbox-nav--next"
              aria-label="Imagen siguiente"
              onClick={(event) => {
                event.stopPropagation()
                showNextLightboxImage()
              }}
            >
              ›
            </button>
          )}
        </div>
      )}

      <section className="jason-v3-section jason-v3-map-section" id="ubicacion">
        <div className="jason-v3-section-title">
          <span className="jason-v3-section-dot" aria-hidden="true" />
          <h2>Nuestra ubicación</h2>
        </div>

        <div className="jason-v3-map-card">
          <div className="jason-v3-map-frame">
            <iframe
              title="Ubicación Comercial Jason"
              src="https://maps.google.com/maps?q=Comercial%20Jason%20Santo%20Domingo&z=16&output=embed"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>

          <div className="jason-v3-map-info">
            <strong>Comercial Jason S.R.L.</strong>
            <span>C. María Montez 213, Santo Domingo 10411, R.D.</span>
            <a
              href="https://www.google.com/maps/search/?api=1&query=Comercial%20Jason%20Santo%20Domingo"
              target="_blank"
              rel="noreferrer"
              className="jason-v3-map-btn"
            >
              Cómo llegar
            </a>
          </div>
        </div>
      </section>

      <div className="jason-v3-chatbot">
        <div className={`jason-v3-chat-panel ${chatOpen ? 'is-open' : ''}`}>
          <div className="jason-v3-chat-head">
            <img
              className="jason-v3-chat-avatar"
              src="/assets/landing/avatar-jason.png"
              alt="Asistente Comercial Jason"
            />
            <span className="jason-v3-chat-head-name">{chatTitle}</span>
            <button
              className="jason-v3-chat-close"
              type="button"
              onClick={() => setChatOpen(false)}
              aria-label="Cerrar chat"
            >
              ✕
            </button>
          </div>

          <div className="jason-v3-chat-body">
            <p className="jason-v3-chat-greeting">{chatGreeting}</p>

            <div className="jason-v3-chat-options">
              {chatOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  className="jason-v3-chat-option"
                  onClick={() => openWhatsappWithText(option)}
                >
                  {option}
                </button>
              ))}
            </div>

            <p className="jason-v3-chat-footer">Se abrirá un chat de WhatsApp.</p>
          </div>
        </div>

        <div className="jason-v3-chat-trigger-wrap">
          <button
            className="jason-v3-chat-trigger"
            type="button"
            onClick={() => setChatOpen((value) => !value)}
            aria-label="Abrir chat"
          >
            <img
              className="jason-v3-chat-avatar jason-v3-chat-avatar--trigger"
              src="/assets/landing/avatar-jason.png"
              alt="Abrir chat"
            />
          </button>
          <span className="jason-v3-chat-badge">1</span>
        </div>
      </div>
    </main>
  )
}

function ContactRow({
  icon,
  label,
  value,
  href,
  external = false,
  variant = 'default',
}: {
  icon: ReactNode
  label: string
  value: string
  href?: string
  external?: boolean
  variant?: 'phone' | 'whatsapp' | 'email' | 'address' | 'hours' | 'default'
}) {
  const content = (
    <>
      <span className="jason-v3-contact__icon">{icon}</span>
      <span>
        <small>{label}</small>
        <strong>{value}</strong>
      </span>
    </>
  )

  if (!href) {
    return <div className="jason-v3-contact__row">{content}</div>
  }

  return (
    <a
      className={`jason-v3-contact__row jason-v3-contact__row--${variant}` }
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
    >
      {content}
    </a>
  )
}
