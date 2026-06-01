import { useEffect, useMemo, useState } from 'react'
import { FaWhatsapp, FaInstagram, FaMapMarkerAlt, FaAddressCard, FaPhoneAlt, FaTimes } from 'react-icons/fa'
import './IntapProfileRentaoRd.css'

type RentaoVehicle = {
  brand: string
  model: string
  image: string
  description: string
  benefits: string[]
  idealFor: string[]
}

const RENTAO = {
  brand: 'Rentao RD',
  headline: 'Renta vehículos modernos, seguros y listos para moverte sin complicaciones.',
  blurb:
    'Soluciones de movilidad confiables con unidades cómodas, modernas e inspeccionadas para que puedas desplazarte con tranquilidad.',
  whatsappRaw: '18498516427',
  phonePrimary: '849-851-6427',
  serviceLabel: 'Servicio ejecutivo',
  instagramUrl: 'https://www.instagram.com/rentaord/',
  instagramLabel: '@RentaoRd',
  address: 'C/2da no.61 Jardines del sur, Santo Domingo, Dominican Republic 11105',
  hero: '/assets/rentaord/hero%204-01.png',
  logo: '/assets/rentaord/logo-rentao.png',
  chatAvatar: '/assets/rentaord/avatar-chat.png',
}

const VEHICLES: RentaoVehicle[] = [
  {
    brand: 'Toyota',
    model: 'Hilux 2025',
    image: '/assets/rentaord/Toyota-Hilux.png',
    description:
      'Pickup moderna, fuerte y cómoda, ideal para quienes necesitan potencia, presencia y seguridad en carretera.',
    benefits: [
      'Fuerza y desempeño superior en carretera y trayectos exigentes.',
      'Cabina cómoda y buena presencia para uso personal o profesional.',
      'Versátil y confiable para trabajo, ciudad o escapadas.',
    ],
    idealFor: [
      'Trabajo y movilidad ejecutiva con carácter.',
      'Viajes familiares y recorridos largos.',
      'Personas que valoran potencia, presencia y seguridad.',
    ],
  },
  {
    brand: 'Kia',
    model: 'Sonet 2025',
    image: '/assets/rentaord/Kia-Sonet.png',
    description:
      'SUV compacta, moderna y práctica, ideal para moverse cómodo en ciudad, viajes cortos y actividades diarias.',
    benefits: [
      'Tamaño ideal para ciudad con excelente maniobrabilidad.',
      'Diseño moderno y experiencia de manejo confortable.',
      'Buen equilibrio entre practicidad, estilo y eficiencia.',
    ],
    idealFor: [
      'Uso urbano y movilidad diaria.',
      'Parejas, pequeños grupos o viajes cortos.',
      'Clientes que buscan comodidad sin complicaciones.',
    ],
  },
  {
    brand: 'Kia',
    model: 'K3 2025',
    image: '/assets/rentaord/Kia-K3.png',
    description:
      'Sedán moderno, elegante y eficiente, ideal para uso personal, reuniones, traslados ejecutivos y ciudad.',
    benefits: [
      'Diseño actual con imagen elegante y profesional.',
      'Conducción cómoda y eficiente para trayectos frecuentes.',
      'Buena experiencia para cliente urbano o ejecutivo.',
    ],
    idealFor: [
      'Reuniones y traslados profesionales.',
      'Uso personal en ciudad.',
      'Clientes que buscan una opción cómoda y estilizada.',
    ],
  },
  {
    brand: 'Chevrolet',
    model: 'Tahoe 2025',
    image: '/assets/rentaord/Tahoe.png',
    description:
      'SUV premium, amplia e imponente, ideal para familias, ejecutivos, eventos especiales y clientes que buscan presencia.',
    benefits: [
      'Gran espacio interior y alta comodidad.',
      'Imagen premium y fuerte presencia visual.',
      'Excelente opción para grupos o necesidades especiales.',
    ],
    idealFor: [
      'Familias y grupos.',
      'Eventos especiales y movilidad premium.',
      'Clientes que desean amplitud, comodidad y presencia.',
    ],
  },
  {
    brand: 'Hyundai',
    model: 'Santa Fe 2025',
    image: '/assets/rentaord/Santa-Fe.png',
    description:
      'SUV familiar moderna, cómoda y segura, ideal para viajes, familias y clientes que desean amplitud y confianza.',
    benefits: [
      'Cabina espaciosa y experiencia de viaje confortable.',
      'Diseño moderno y sensación de seguridad.',
      'Muy equilibrada para ciudad y carretera.',
    ],
    idealFor: [
      'Viajes familiares.',
      'Movilidad cómoda para grupos pequeños.',
      'Clientes que priorizan amplitud y confort.',
    ],
  },
  {
    brand: 'Hyundai',
    model: 'Cantus 2026',
    image: '/assets/rentaord/Hyundai-Cantus.png',
    description:
      'Vehículo moderno, amplio y confortable, ideal para familias, viajes largos y grupos pequeños con necesidad de espacio.',
    benefits: [
      'Buen espacio interior para pasajeros y equipaje.',
      'Confort para trayectos prolongados.',
      'Diseño actual y uso versátil.',
    ],
    idealFor: [
      'Grupos pequeños y familias.',
      'Viajes de fin de semana o carretera.',
      'Clientes que buscan comodidad y espacio.',
    ],
  },
  {
    brand: 'Kia',
    model: 'Río 2023',
    image: '/assets/rentaord/Kia-Río.png',
    description:
      'Sedán práctico, ágil y funcional, ideal para ciudad, diligencias y clientes que buscan una opción cómoda y simple.',
    benefits: [
      'Muy práctico para ciudad y movimientos diarios.',
      'Manejo ágil y tamaño funcional.',
      'Opción cómoda para uso sencillo y eficiente.',
    ],
    idealFor: [
      'Movilidad urbana.',
      'Diligencias y uso diario.',
      'Clientes que buscan practicidad.',
    ],
  },
  {
    brand: 'Hyundai',
    model: 'Elantra 2020',
    image: '/assets/rentaord/Elantra.png',
    description:
      'Sedán cómodo, elegante y confiable, ideal para uso personal, traslados ejecutivos y recorridos diarios.',
    benefits: [
      'Diseño sobrio y apariencia cuidada.',
      'Confort para ciudad y trayectos frecuentes.',
      'Buena opción para uso personal o profesional.',
    ],
    idealFor: [
      'Ciudad y uso diario.',
      'Traslados personales o ejecutivos.',
      'Clientes que buscan equilibrio entre confort e imagen.',
    ],
  },
]

const BENEFITS = [
  {
    title: 'Vehículos modernos',
    description: 'Unidades actuales, cómodas y listas para que te muevas con confianza.',
    image: '/assets/rentaord/moderno.png',
  },
  {
    title: 'Inspección previa',
    description: 'Revisamos las unidades para ofrecerte mayor seguridad y tranquilidad.',
    image: '/assets/rentaord/inspeccion.png',
  },
  {
    title: 'Atención personalizada',
    description: 'Te orientamos según tu necesidad, destino, fecha y tipo de servicio.',
    image: '/assets/rentaord/atencion.png',
  },
  {
    title: 'Proceso simple',
    description: 'Consulta disponibilidad, coordina los detalles y reserva sin complicaciones.',
    image: '/assets/rentaord/proceso.png',
  },
]

const MARBELLA = {
  title: 'Marbella | Across the Ocean',
  eyebrow: 'EXPERIENCIA MARÍTIMA',
  pdf: '/assets/rentaord/MARBELLA-BOAT%20.pdf',
  images: [
    '/assets/rentaord/marbella-exterior-principal.jpg',
    '/assets/rentaord/marbella-navegando-lateral.jpg',
    '/assets/rentaord/marbella-proa-vista-mar.jpg',
    '/assets/rentaord/marbella-cubierta-asientos.jpg',
    '/assets/rentaord/marbella-cabina-control.jpg',
    '/assets/rentaord/marbella-motores-mercury.jpg',
  ],
  summary:
    'Una experiencia privada para disfrutar el mar con comodidad, seguridad y estilo. Marbella es ideal para paseos familiares, celebraciones o escapadas con amigos, con capacidad para hasta 10 personas, tripulación profesional y rutas hacia destinos paradisíacos.',
  review:
    'Marbella es una lancha Wellcraft de 35 pies diseñada para vivir el mar con tranquilidad. Combina espacio, rendimiento y confort, integrando baño a bordo, camarote, sonido premium y asistencia de tripulación para que cada salida sea cómoda, segura y memorable.',
  specs: [
    'Lancha Wellcraft de 35 pies',
    'Capacidad máxima: 10 personas',
    'Tripulación profesional: 2 personas',
    'Baño a bordo y camarote',
    'Sistema de sonido premium',
    'Velocidad aproximada: 45/55 nudos',
  ],
  routes: ['Isla Saona', 'Piscina Natural Palmilla', 'Isla Catalina'],
  includes: [
    'Nevera para refrigerios',
    '10 refrescos de 12 oz',
    '20 botellas de agua',
    '2 fundas de hielo',
    '2 marinos o personal de tripulación',
  ],
  allowed: [
    'Toallas y artículos personales si planeas nadar',
    'Comida, aperitivos y bebidas de tu preferencia',
  ],
  notAllowed: [
    'Fumar; solo se permiten vaporizadores electrónicos',
    'Barbacoa, hookah o artículos con llamas abiertas, gas, propano o carbón',
  ],
}

const FAQS = [
  {
    q: '¿Cómo puedo reservar un vehículo?',
    a: 'Puedes escribirnos por WhatsApp indicando el modelo que te interesa, la fecha en que lo necesitas y el tiempo estimado de uso. Con esos datos verificamos disponibilidad y te orientamos con el siguiente paso de forma rápida.',
  },
  {
    q: '¿Qué tan seguros son los vehículos?',
    a: 'Trabajamos con unidades previamente revisadas para ofrecer una experiencia confiable. Antes de confirmar una renta, se verifica el estado general del vehículo para que puedas moverte con mayor tranquilidad y seguridad.',
  },
  {
    q: '¿Cuánto tarda el proceso de reserva?',
    a: 'El proceso suele ser ágil cuando ya tienes claro el tipo de vehículo, la fecha y el servicio que necesitas. Te confirmamos disponibilidad por WhatsApp y coordinamos los detalles de entrega o recogida según el caso.',
  },
  {
    q: '¿Qué tipo de vehículos tienen disponibles?',
    a: 'Contamos con opciones para distintas necesidades: vehículos compactos para moverte cómodo en la ciudad, SUVs para viajes familiares o de mayor espacio, pickups para trabajo o carga, y modelos con presencia para uso ejecutivo.',
  },
  {
    q: '¿Puedo solicitar entrega en aeropuerto o punto específico?',
    a: 'Sí, puedes consultar la posibilidad de entrega o coordinación en un punto específico. El equipo te confirmará disponibilidad, horario, condiciones y cualquier detalle adicional según la ubicación solicitada.',
  },
  {
    q: '¿Ofrecen servicio ejecutivo?',
    a: 'Sí. Si necesitas movilidad para compromisos profesionales, traslados especiales o una experiencia más cómoda y representativa, podemos orientarte con opciones adecuadas según disponibilidad y tipo de servicio.',
  },
]

function getWhatsAppHref(message: string) {
  const digits = RENTAO.whatsappRaw.replace(/\D/g, '')
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}

function getVehicleAvailabilityMessage(vehicle: RentaoVehicle) {
  return `Hola, vi el perfil digital de Rentao RD y quiero consultar disponibilidad del ${vehicle.brand} ${vehicle.model}.`
}

function getGeneralAvailabilityMessage() {
  return 'Hola, vi el perfil digital de Rentao RD y quiero consultar disponibilidad de vehículos.'
}

function getMapHref() {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(RENTAO.address)}`
}

function getContactFormMessage(name: string, phone: string, need: string) {
  const safeName = name.trim() || 'No indicado'
  const safePhone = phone.trim() || 'No indicado'
  const safeNeed = need.trim() || 'Deseo información sobre disponibilidad de vehículos.'
  return [
    'Hola, vi el perfil digital de Rentao RD y quiero recibir asistencia.',
    `Nombre: ${safeName}`,
    `Teléfono: ${safePhone}`,
    `Solicitud: ${safeNeed}`,
  ].join('\n')
}

function getChatMessage(option: string) {
  return `Hola, vi el perfil digital de Rentao RD. ${option}`
}

function getVCardHref() {
  return '/assets/rentaord/eduardo-fernandez-rentao.vcf?v=rentao-vcard-2'
}

export default function IntapProfileRentaoRd({ profile }: { profile?: any }) {
  const [showcaseIndex, setShowcaseIndex] = useState(0)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [selectedVehicle, setSelectedVehicle] = useState<RentaoVehicle | null>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [marbellaOpen, setMarbellaOpen] = useState(false)
  const [marbellaSlideIndex, setMarbellaSlideIndex] = useState(0)
  const [marbellaZoomIndex, setMarbellaZoomIndex] = useState<number | null>(null)
  const [showRentaoIntro, setShowRentaoIntro] = useState(true)
  const [contactOpen, setContactOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [leadName, setLeadName] = useState('')
  const [leadPhone, setLeadPhone] = useState('')
  const [leadNeed, setLeadNeed] = useState('')

  useEffect(() => {
    const introTimer = window.setTimeout(() => setShowRentaoIntro(false), 3200)
    return () => window.clearTimeout(introTimer)
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setShowcaseIndex((prev) => (prev + 1) % VEHICLES.length)
    }, 3600)
    return () => window.clearInterval(timer)
  }, [])

  const visibleVehicles = useMemo(() => {
    return [VEHICLES[showcaseIndex], VEHICLES[(showcaseIndex + 1) % VEHICLES.length]]
  }, [showcaseIndex])

  const openDetails = (vehicle: RentaoVehicle) => {
    setGalleryOpen(false)
    setSelectedVehicle(vehicle)
  }

  useEffect(() => {
    const marbellaTimer = window.setInterval(() => {
      setMarbellaSlideIndex((current) => (current + 1) % MARBELLA.images.length)
    }, 3200)
    return () => window.clearInterval(marbellaTimer)
  }, [])

  return (
    <div className="rentaord-page">
      {showRentaoIntro ? (
        <div className="rentaordBootOverlay" aria-hidden="true">
          <div className="rentaordBootLogoWrap">
            <img className="rentaordBootLogo" src={RENTAO.logo} alt="" />
          </div>
        </div>
      ) : null}

      <div className="rentaord-shell">
        <section className="rentaord-hero">
          <img className="rentaord-hero-img" src={RENTAO.hero} alt="" aria-hidden="true" />
          <div className="rentaord-hero-message" aria-label="Promesa principal Rentao RD">
            <strong>Tranquilidad<br />y seguridad sin<br />complicaciones.</strong>
          </div>
        </section>

        <div className="rentaord-logo-center" aria-label="Logo Rentao RD">
          <img src={RENTAO.logo} alt={RENTAO.brand} />
        </div>

        <section className="rentaord-identity">
          <h1>{RENTAO.brand}</h1>
          <h2>{RENTAO.headline}</h2>
          <p className="rentaord-lead">{RENTAO.blurb}</p>
          <div className="rentaord-hero-actions">
            <a className="rentaord-btn rentaord-btn--primary" href={getWhatsAppHref(getGeneralAvailabilityMessage())} target="_blank" rel="noopener noreferrer">
              Reservar por WhatsApp
            </a>
            <a className="rentaord-btn rentaord-btn--secondary" href="#vehiculos">Ver vehículos disponibles</a>
          </div>
        </section>

        <div className="rentaord-quick-grid">
          <a href={getWhatsAppHref('Hola, vi el perfil digital de Rentao RD y deseo información.')} target="_blank" rel="noopener noreferrer">
            <FaWhatsapp aria-hidden="true" /><span>WhatsApp</span>
          </a>
          <a href={RENTAO.instagramUrl} target="_blank" rel="noopener noreferrer">
            <FaInstagram aria-hidden="true" /><span>Instagram</span>
          </a>
          <a href={getMapHref()} target="_blank" rel="noopener noreferrer">
            <FaMapMarkerAlt aria-hidden="true" /><span>Ubicación</span>
          </a>
          <a href={getVCardHref()} download="Eduardo-Fernandez-Rentao.vcf">
            <FaAddressCard aria-hidden="true" /><span>Guardar contacto</span>
          </a>
        </div>

        <section className="rentaord-about">
          <span className="rentaord-section-mini">SOBRE NOSOTROS</span>
          <h3>Movilidad segura, cómoda y sin complicaciones.</h3>
          <p>RENTAO RD es una empresa de rent car en República Dominicana enfocada en ofrecer soluciones de movilidad seguras, confiables y sin complicaciones.</p>
          <p>Nos especializamos en vehículos cómodos, modernos y listos para que cada cliente pueda desplazarse con tranquilidad.</p>
        </section>

        <section className="rentaord-section" id="vehiculos">
          <div className="rentaord-section-head">
            <span>CATÁLOGO</span>
            <h3>Vehículos disponibles</h3>
            <p>Elige el vehículo según tu necesidad.</p>
          </div>
          <div className="rentaord-showcase-grid">
            {visibleVehicles.map((vehicle, index) => (
              <button key={`${vehicle.brand}-${vehicle.model}-${index}`} type="button" className="rentaord-feature-card" onClick={() => setGalleryOpen(true)}>
                <div className="rentaord-feature-media"><img src={vehicle.image} alt={`${vehicle.brand} ${vehicle.model}`} /></div>
                <div className="rentaord-feature-copy">
                  <span>{vehicle.brand}</span>
                  <h4>{vehicle.model}</h4>
                  <small>Toca para ver todos los modelos</small>
                </div>
              </button>
            ))}
          </div>
          <button type="button" className="rentaord-all-models-btn" onClick={() => setGalleryOpen(true)}>Ver todos los modelos</button>
        </section>

        <section className="rentaord-section rentaord-marbella-section" id="marbella">
          <div className="rentaord-section-head">
            <span>{MARBELLA.eyebrow}</span>
            <h3>Lancha Marbella</h3>
          </div>
          <article className="rentaord-marbella-card">
            <button type="button" className="rentaord-marbella-slider" aria-label="Ver detalles de Lancha Marbella" onClick={() => setMarbellaOpen(true)}>
              {MARBELLA.images.map((image, index) => (
                <img key={image} className={`rentaord-marbella-slide${index === marbellaSlideIndex ? ' is-active' : ''}`} src={image} alt={`Marbella Boat vista ${index + 1}`} />
              ))}
              <span className="rentaord-marbella-slider-dots" aria-hidden="true">
                {MARBELLA.images.map((image, index) => (
                  <span key={image} className={index === marbellaSlideIndex ? 'is-active' : ''} />
                ))}
              </span>
            </button>
            <div className="rentaord-marbella-copy">
              <p>{MARBELLA.summary}</p>
              <button type="button" className="rentaord-btn rentaord-btn--primary" onClick={() => setMarbellaOpen(true)}>Ver más detalles</button>
            </div>
          </article>
        </section>

        <section className="rentaord-section rentaord-section--light">
          <div className="rentaord-section-head">
            <span>¿POR QUÉ ELEGIRNOS?</span>
            <h3>Una experiencia clara y confiable.</h3>
          </div>
          <div className="rentaord-benefits-grid">
            {BENEFITS.map((benefit) => (
              <article key={benefit.title}>
                <div className="rentaord-benefit-icon"><img src={benefit.image} alt="" aria-hidden="true" /></div>
                <strong>{benefit.title}</strong>
                <p>{benefit.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rentaord-contact" id="contacto">
          <div className="rentaord-section-head">
            <span>CONTACTO</span>
            <h3>Contactos de Rentao RD</h3>
          </div>
          <div className="rentaord-contact-list">
            <a href={`tel:+1${RENTAO.phonePrimary.replace(/\D/g, '')}`} className="rentaord-contact-row">
              <FaPhoneAlt aria-hidden="true" /><strong>{RENTAO.phonePrimary}</strong>
            </a>
            <a href={getWhatsAppHref('Hola, vi el perfil digital de Rentao RD y deseo consultar disponibilidad.')} target="_blank" rel="noopener noreferrer" className="rentaord-contact-row">
              <FaWhatsapp aria-hidden="true" /><strong>{RENTAO.phonePrimary}</strong>
            </a>
            <a href={RENTAO.instagramUrl} target="_blank" rel="noopener noreferrer" className="rentaord-contact-row">
              <FaInstagram aria-hidden="true" /><strong>{RENTAO.instagramLabel}</strong>
            </a>
            <a href={getMapHref()} target="_blank" rel="noopener noreferrer" className="rentaord-contact-row">
              <FaMapMarkerAlt aria-hidden="true" /><strong>{RENTAO.address}</strong>
            </a>
          </div>
        </section>

        <section className="rentaord-contact-cta">
          <h3>¿Necesitas reservar o consultar disponibilidad?</h3>
          <p>Déjanos tus datos y abrimos la conversación por WhatsApp para ayudarte mejor.</p>
          <button type="button" className="rentaord-btn rentaord-btn--primary" onClick={() => setContactOpen(true)}>Contáctanos</button>
        </section>

        <section className="rentaord-section rentaord-section--faq">
          <div className="rentaord-section-head">
            <span>PREGUNTAS FRECUENTES</span>
            <h3>Información rápida</h3>
          </div>
          <div className="rentaord-faq-list">
            {FAQS.map((item, index) => {
              const isOpen = openFaq === index
              return (
                <article key={item.q} className={`rentaord-faq-item ${isOpen ? 'is-open' : ''}`}>
                  <button type="button" onClick={() => setOpenFaq(isOpen ? null : index)}>
                    <span>{item.q}</span>
                    <strong>{isOpen ? '−' : '+'}</strong>
                  </button>
                  {isOpen ? <p>{item.a}</p> : null}
                </article>
              )
            })}
          </div>
        </section>

        <footer className="rentaord-footer">
          <strong>RENTAORD CAR RENTAL</strong>
          <span>{RENTAO.serviceLabel}</span>
          <span>Santo Domingo R.D.</span>
          <small>Perfil digital creado por INTAP LINK</small>
        </footer>
      </div>

      {marbellaOpen ? (
        <div className="rentaord-modal-backdrop" onClick={() => setMarbellaOpen(false)}>
          <div className="rentaord-modal rentaord-marbella-modal" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="rentaord-modal-close" onClick={() => { setMarbellaOpen(false); setMarbellaZoomIndex(null) }}>×</button>
            <div className="rentaord-marbella-modal-head">
              <span>MARBELLA BOAT</span>
              <h3>{MARBELLA.title}</h3>
              <p>{MARBELLA.review}</p>
              <div className="rentaord-marbella-pills">
                <span>35 pies</span><span>Hasta 10 personas</span><span>2 tripulantes</span><span>Sonido premium</span>
              </div>
            </div>
            <div className="rentaord-marbella-gallery">
              {MARBELLA.images.map((image, index) => (
                <button type="button" key={image} className="rentaord-marbella-gallery-item" onClick={() => setMarbellaZoomIndex(index)}>
                  <img src={image} alt={`Marbella Boat foto ${index + 1}`} />
                </button>
              ))}
            </div>
            <div className="rentaord-marbella-detail-grid">
              <section><h4>Datos principales</h4><ul>{MARBELLA.specs.map((item) => <li key={item}>{item}</li>)}</ul></section>
              <section><h4>Incluye</h4><ul>{MARBELLA.includes.map((item) => <li key={item}>{item}</li>)}</ul></section>
              <section><h4>Rutas disponibles</h4><ul>{MARBELLA.routes.map((item) => <li key={item}>{item}</li>)}</ul></section>
              <section><h4>Permitido</h4><ul>{MARBELLA.allowed.map((item) => <li key={item}>{item}</li>)}</ul></section>
              <section className="rentaord-marbella-wide"><h4>No permitido</h4><ul>{MARBELLA.notAllowed.map((item) => <li key={item}>{item}</li>)}</ul></section>
            </div>
            <div className="rentaord-marbella-actions">
              <a className="rentaord-btn rentaord-btn--primary" href={getWhatsAppHref('Hola, vi la experiencia Marbella Boat y quiero consultar disponibilidad, rutas y precios.')} target="_blank" rel="noopener noreferrer">Consultar disponibilidad</a>
            </div>
          </div>
        </div>
      ) : null}

      {marbellaZoomIndex !== null ? (
        <div className="rentaord-marbella-zoom" onClick={() => setMarbellaZoomIndex(null)}>
          <div className="rentaord-marbella-zoom-stage" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="rentaord-marbella-zoom-close" onClick={() => setMarbellaZoomIndex(null)}>×</button>
            <button type="button" className="rentaord-marbella-zoom-nav rentaord-marbella-zoom-nav--prev" onClick={() => setMarbellaZoomIndex((c) => c === null ? c : (c - 1 + MARBELLA.images.length) % MARBELLA.images.length)}>‹</button>
            <img src={MARBELLA.images[marbellaZoomIndex]} alt={`Marbella Boat imagen ampliada ${marbellaZoomIndex + 1}`} />
            <button type="button" className="rentaord-marbella-zoom-nav rentaord-marbella-zoom-nav--next" onClick={() => setMarbellaZoomIndex((c) => c === null ? c : (c + 1) % MARBELLA.images.length)}>›</button>
            <div className="rentaord-marbella-zoom-count">{marbellaZoomIndex + 1} / {MARBELLA.images.length}</div>
          </div>
        </div>
      ) : null}

      {contactOpen ? (
        <div className="rentaord-modal-backdrop" onClick={() => setContactOpen(false)}>
          <div className="rentaord-modal rentaord-contact-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="rentaord-modal-close" onClick={() => setContactOpen(false)}>×</button>
            <h3>Contáctanos</h3>
            <p>Completa estos datos y enviaremos el mensaje por WhatsApp.</p>
            <label><span>Nombre</span><input type="text" value={leadName} onChange={(e) => setLeadName(e.target.value)} placeholder="Tu nombre" /></label>
            <label><span>Teléfono</span><input type="tel" value={leadPhone} onChange={(e) => setLeadPhone(e.target.value)} placeholder="Tu número" /></label>
            <label><span>¿Qué estás buscando?</span><textarea value={leadNeed} onChange={(e) => setLeadNeed(e.target.value)} placeholder="Ej.: Necesito una SUV para fin de semana..." /></label>
            <a className="rentaord-btn rentaord-btn--primary" href={getWhatsAppHref(getContactFormMessage(leadName, leadPhone, leadNeed))} target="_blank" rel="noopener noreferrer">
              <FaWhatsapp aria-hidden="true" /> Enviar por WhatsApp
            </a>
          </div>
        </div>
      ) : null}

      <div className={`rentaord-chat ${chatOpen ? 'is-open' : ''}`}>
        {chatOpen ? (
          <div className="rentaord-chat-panel">
            <div className="rentaord-chat-head">
              <img src={RENTAO.chatAvatar} alt="Rentao RD" />
              <strong>Rentao RD</strong>
              <button type="button" aria-label="Cerrar chat" onClick={() => setChatOpen(false)}><FaTimes aria-hidden="true" /></button>
            </div>
            <div className="rentaord-chat-body">
              <p>Hola 👋<br />Gracias por tu interés en Rentao RD.<br /><strong>¿En qué podemos ayudarte hoy?</strong></p>
              <a href={getWhatsAppHref(getChatMessage('Quiero consultar disponibilidad de un vehículo.'))} target="_blank" rel="noopener noreferrer">Consultar disponibilidad</a>
              <a href={getWhatsAppHref(getChatMessage('Quiero saber qué modelos tienen disponibles.'))} target="_blank" rel="noopener noreferrer">Ver modelos disponibles</a>
              <a href={getWhatsAppHref(getChatMessage('Necesito un vehículo ejecutivo.'))} target="_blank" rel="noopener noreferrer">Necesito servicio ejecutivo</a>
              <a href={getWhatsAppHref(getChatMessage('Quiero recibir asistencia personalizada.'))} target="_blank" rel="noopener noreferrer">Asistencia personalizada</a>
              <small>Se abrirá WhatsApp con tu consulta.</small>
            </div>
          </div>
        ) : null}
        <button type="button" className="rentaord-chat-bubble" aria-label="Abrir chat Rentao RD" onClick={() => setChatOpen((c) => !c)}>
          <img src={RENTAO.chatAvatar} alt="" aria-hidden="true" />
          <span>1</span>
        </button>
      </div>

      {galleryOpen ? (
        <div className="rentaord-modal-backdrop" onClick={() => setGalleryOpen(false)}>
          <div className="rentaord-modal rentaord-modal--catalog" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="rentaord-modal-close" onClick={() => setGalleryOpen(false)}>×</button>
            <div className="rentaord-modal-head">
              <span>GALERÍA DE MODELOS</span>
              <h3>Todos los vehículos disponibles</h3>
            </div>
            <div className="rentaord-gallery-grid">
              {VEHICLES.map((vehicle) => (
                <article key={`${vehicle.brand}-${vehicle.model}`} className="rentaord-gallery-card" role="button" tabIndex={0} onClick={() => openDetails(vehicle)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetails(vehicle) } }}>
                  <div className="rentaord-gallery-media"><img src={vehicle.image} alt={`${vehicle.brand} ${vehicle.model}`} /></div>
                  <div className="rentaord-gallery-copy"><span>{vehicle.brand}</span><h4>{vehicle.model}</h4></div>
                  <div className="rentaord-gallery-actions">
                    <button type="button" className="rentaord-btn rentaord-btn--secondary rentaord-btn--details" onClick={(e) => { e.stopPropagation(); openDetails(vehicle) }}>Detalles</button>
                    <a className="rentaord-btn rentaord-btn--primary" href={getWhatsAppHref(getVehicleAvailabilityMessage(vehicle))} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>Ver disponibilidad</a>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {selectedVehicle ? (
        <div className="rentaord-modal-backdrop" onClick={() => setSelectedVehicle(null)}>
          <div className="rentaord-modal rentaord-modal--detail" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="rentaord-modal-close" onClick={() => setSelectedVehicle(null)}>×</button>
            <div className="rentaord-detail-top">
              <div className="rentaord-detail-media"><img src={selectedVehicle.image} alt={`${selectedVehicle.brand} ${selectedVehicle.model}`} /></div>
              <div className="rentaord-detail-summary"><span>{selectedVehicle.brand}</span><h3>{selectedVehicle.model}</h3><p>{selectedVehicle.description}</p></div>
            </div>
            <div className="rentaord-detail-block"><h4>Beneficios</h4><ul>{selectedVehicle.benefits.map((item) => <li key={item}>{item}</li>)}</ul></div>
            <div className="rentaord-detail-block"><h4>Ideal para</h4><ul>{selectedVehicle.idealFor.map((item) => <li key={item}>{item}</li>)}</ul></div>
            <div className="rentaord-detail-actions">
              <a className="rentaord-btn rentaord-btn--primary" href={getWhatsAppHref(getVehicleAvailabilityMessage(selectedVehicle))} target="_blank" rel="noopener noreferrer">Consultar disponibilidad</a>
              <button type="button" className="rentaord-btn rentaord-btn--secondary" onClick={() => { setSelectedVehicle(null); setGalleryOpen(true) }}>Volver a la galería</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
