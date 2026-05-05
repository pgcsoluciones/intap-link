import { useEffect, useMemo, useState } from 'react'
import './IntapProfileV2.css'
import { FaEnvelope, FaFacebookF, FaGlobeAmericas, FaInstagram, FaMapMarkerAlt, FaPhoneAlt, FaWhatsapp } from 'react-icons/fa'

type ProfileLink = {
  id?: string
  title?: string
  label?: string
  url?: string
  icon?: string
}

type ProfileProduct = {
  id?: string
  title?: string
  name?: string
  description?: string
  image_url?: string
  imageUrl?: string
  price?: string | number
}

type ProfileFaq = {
  id?: string
  question?: string
  answer?: string
}

type ProfileGalleryItem = {
  id?: string
  image_url?: string
  imageUrl?: string
  title?: string
  caption?: string
}

export type IntapProfileV2Profile = {
  slug?: string
  name?: string
  title?: string
  role?: string
  bio?: string
  avatarUrl?: string
  avatar_url?: string
  accentColor?: string
  accent_color?: string
  whatsapp?: string
  whatsappNumber?: string
  whatsapp_number?: string
  phone?: string
  email?: string
  website?: string
  address?: string
  mapUrl?: string
  map_url?: string
  companyName?: string
  company_name?: string
  companyLogo?: string
  company_logo?: string
  companyAbout?: string
  company_about?: string
  links?: ProfileLink[]
  products?: ProfileProduct[]
  faqs?: ProfileFaq[]
  gallery?: ProfileGalleryItem[]
  templateData?: Record<string, string>
}

function pick(...values: Array<string | number | undefined | null>) {
  for (const value of values) {
    if (value === undefined || value === null) continue
    const text = String(value).trim()
    if (text) return text
  }
  return ''
}

function normalizeHttp(url: string) {
  if (!url) return ''
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

function cleanPhone(phone: string) {
  return phone.replace(/\D/g, '')
}

function waUrl(phone: string, message: string) {
  const clean = cleanPhone(phone)
  if (!clean) return '#'
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`
}

function toParagraphs(text: string) {
  return text
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseServiceLines(raw: string) {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('::')
      return {
        title: parts[0]?.trim() || '',
        description: parts[1]?.trim() || '',
      }
    })
    .filter((item) => item.title || item.description)
}

function findLink(links: ProfileLink[], terms: string[]) {
  const lowerTerms = terms.map((term) => term.toLowerCase())
  return (
    links.find((item) => {
      const haystack = `${item.title || ''} ${item.label || ''} ${item.url || ''}`.toLowerCase()
      return lowerTerms.some((term) => haystack.includes(term))
    }) || null
  )
}

function extractHandle(urlOrText: string) {
  if (!urlOrText) return ''
  const text = urlOrText.trim()
  if (text.startsWith('@')) return text
  const parts = text.split('/').filter(Boolean)
  const last = parts[parts.length - 1] || text
  if (!last || last.includes('.')) return text
  return `@${last.replace(/^@/, '')}`
}

function loadFontAwesome() {
  const id = 'intap-fontawesome-650'
  if (document.getElementById(id)) return

  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css'
  document.head.appendChild(link)
}

function loadJakartaFont() {
  const id = 'intap-plus-jakarta-font'
  if (document.getElementById(id)) return

  const preconnect = document.createElement('link')
  preconnect.rel = 'preconnect'
  preconnect.href = 'https://fonts.googleapis.com'
  document.head.appendChild(preconnect)

  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap'
  document.head.appendChild(link)
}

export default function IntapProfileV2({ profile }: { profile?: IntapProfileV2Profile }) {
  const [chatOpen, setChatOpen] = useState(false)
  const [activeSlide, setActiveSlide] = useState(0)
  const [projectsModalOpen, setProjectsModalOpen] = useState(false)
  const [detailProjectIndex, setDetailProjectIndex] = useState<number | null>(null)
  const [detailImageIndex, setDetailImageIndex] = useState(0)

  useEffect(() => {
    loadFontAwesome()
    loadJakartaFont()
  }, [])

  const td = (profile?.templateData ?? {}) as Record<string, string>
  const links = profile?.links ?? []

  const accent = pick(profile?.accentColor, profile?.accent_color, td.accentColor, '#D32F2F')
  const name = pick(profile?.name, td.name, 'Enmanuel Pérez')
  const role = pick(profile?.role, profile?.title, td.role, td.title, 'Gestor de Marketing y Ventas')
  const avatar = pick(
    profile?.avatarUrl,
    profile?.avatar_url,
    td.avatarUrl,
    td.avatar_url,
    'https://framerusercontent.com/images/Qx4aaXjorgutFi7olgDodGhGLX4.jpg?scale-down-to=1024',
  )

  const phone = pick(profile?.phone, td.phone, '829 994 3102')
  const whatsapp = pick(profile?.whatsapp, profile?.whatsappNumber, profile?.whatsapp_number, td.whatsapp, td.phone, '18299943102')
  const email = pick(profile?.email, td.email, 'ventas@constructorajprez.com')
  const website = pick(profile?.website, td.website, 'constructorajprez.com')
  const address = pick(
    profile?.address,
    td.address,
    'Av. Winston Churchill 1550, Plaza Orleans Local 213-214, Santo Domingo, República Dominicana',
  )
  const mapUrl = pick(
    profile?.mapUrl,
    profile?.map_url,
    td.mapUrl,
    td.map_url,
    'https://www.google.com/maps/search/?api=1&query=Plaza%20Orleans%20Av.%20Winston%20Churchill%20Santo%20Domingo',
  )

  const instagramLink = findLink(links, ['instagram'])
  const facebookLink = findLink(links, ['facebook'])
  const whatsappLink = findLink(links, ['whatsapp', 'wa.me'])

  const instagramText = pick(td.instagram, instagramLink?.label, instagramLink?.title, instagramLink?.url ? extractHandle(instagramLink.url) : '@enmanuelperez.jprez')
  const instagramUrl = pick(td.instagramUrl, instagramLink?.url, 'https://instagram.com/enmanuelperez.jprez')

  const facebookText = pick(td.facebook, facebookLink?.label, facebookLink?.title, '@constructorajprez')
  const facebookUrl = pick(td.facebookUrl, facebookLink?.url, 'https://www.facebook.com/constructorajprez')

  const companyName = pick(profile?.companyName, profile?.company_name, td.companyName, 'Constructora JPREZ')
  const companyLogo = pick(
    profile?.companyLogo,
    profile?.company_logo,
    td.companyLogo,
    td.company_logo,
    '/assets/marketing/mockups/logo_jprez.png',
  )
  const companyHeadline = pick(td.companyHeadline, 'Más de 22 años creando hogares llenos de vida.')
  const companyAbout = pick(
    profile?.companyAbout,
    profile?.company_about,
    td.companyAbout,
    'En Constructora JPREZ nos apasiona construir más que estructuras: creamos hogares con propósito, calidad y visión de futuro. Con más de 22 años de experiencia en el sector inmobiliario de República Dominicana, hemos entregado más de 1,300 viviendas y seguimos desarrollando comunidades con más de 400 unidades actualmente en ejecución.\n\nNos mueve el compromiso con el bienestar de las familias dominicanas, integrando diseño innovador, sostenibilidad y eficiencia en cada proyecto. Creemos en hacer las cosas bien desde el principio, con ética, transparencia y un firme enfoque en la calidad y satisfacción de nuestros clientes.\n\nNuestra visión se refleja en cada detalle de nuestras obras: espacios funcionales, modernos y con un enfoque humano. Trabajamos cada día para ser líderes en el sector de la construcción, aportando valor al país y creando oportunidades de inversión seguras y duraderas.',
  )
  const companyAboutParagraphs = toParagraphs(companyAbout)
  const companyPhone = pick(td.companyPhone, '(809) 385-1616')
  const companyInstagram = pick(td.companyInstagram, '@constructorajprez')
  const companyFacebook = pick(td.companyFacebook, '@constructorajprez')
  const companyShortAddress = pick(td.companyShortAddress, 'Plaza Orleans, Av. Winston Churchill, Santo Domingo, R. D.')

  const bioHeadline = pick(td.bioHeadline, 'Tu propiedad ideal no está lejos. Empecemos hoy.')
  const bio = pick(profile?.bio, td.bio)
  const bioParagraphs = toParagraphs(bio)

  const servicesHeadline = pick(td.servicesHeadline, 'Soluciones integrales para construir con confianza')
  const servicesIntro = pick(td.servicesIntro, `En ${companyName} te acompañamos en cada paso con un enfoque profesional, humano y de alta calidad:`)
  const services = parseServiceLines(pick(td.servicesList))

  const productGallery = (profile?.products ?? [])
    .map((item) => ({
      id: item.id,
      title: pick(item.title, item.name),
      caption: pick(item.description),
      image: pick(item.image_url, item.imageUrl),
      images: [] as string[],
    }))
    .filter((item) => item.image)

  const rawGallery = (profile?.gallery ?? [])
    .map((item) => ({
      id: item.id,
      title: pick(item.title),
      caption: pick(item.caption),
      image: pick(item.image_url, item.imageUrl),
      images: [] as string[],
    }))
    .filter((item) => item.image)

  const jprezProjectImages = [
    [
      '/assets/marketing/mockups/jprez1.png',
      '/assets/marketing/mockups/jprez2.png',
      '/assets/marketing/mockups/jprez3.png',
    ],
    [
      '/assets/marketing/mockups/jprez2.png',
      '/assets/marketing/mockups/jprez4.png',
      '/assets/marketing/mockups/jprez5.png',
    ],
    [
      '/assets/marketing/mockups/jprez3.png',
      '/assets/marketing/mockups/jprez5.png',
      '/assets/marketing/mockups/jprez6.png',
    ],
    [
      '/assets/marketing/mockups/jprez4.png',
      '/assets/marketing/mockups/jprez1.png',
      '/assets/marketing/mockups/jprez6.png',
    ],
  ]

  const finalGallery = useMemo(() => {
    const source = rawGallery.length ? rawGallery : productGallery
    const fallback = [
      {
        id: 'demo-1',
        title: 'PRADO RESIDENCES 4',
        caption: 'Evaristo Morales, Santo Domingo',
        image: '/assets/marketing/mockups/jprez1.png',
        images: jprezProjectImages[0],
      },
      {
        id: 'demo-2',
        title: 'PRADO RESIDENCES 3',
        caption: 'Ensanche Paraíso, Santo Domingo',
        image: '/assets/marketing/mockups/jprez2.png',
        images: jprezProjectImages[1],
      },
      {
        id: 'demo-3',
        title: 'PRADO SUITES PUERTO PLATA',
        caption: 'Puerto Plata',
        image: '/assets/marketing/mockups/jprez3.png',
        images: jprezProjectImages[2],
      },
      {
        id: 'demo-4',
        title: 'PRADO SUITES LAS TERRENAS',
        caption: 'Las Terrenas',
        image: '/assets/marketing/mockups/jprez4.png',
        images: jprezProjectImages[3],
      },
    ]

    return (source.length ? source : fallback).map((item, index) => {
      const localImages = jprezProjectImages[index % jprezProjectImages.length]
      const images = item.images?.length ? item.images : localImages

      return {
        ...item,
        image: images[0] || item.image,
        images,
      }
    })
  }, [rawGallery, productGallery])

  const faqs = (profile?.faqs ?? []).filter((faq) => pick(faq.question, faq.answer))

  const faqItems = faqs.length
    ? faqs
    : [
        {
          question: '¿Cómo puedo solicitar una visita a uno de los proyectos?',
          answer: 'Puedes escribir por WhatsApp para coordinar una visita según disponibilidad del proyecto.',
        },
        {
          question: '¿Cuáles son los métodos de financiamiento disponibles?',
          answer: 'El equipo te orienta sobre opciones de financiamiento según el proyecto y tu perfil.',
        },
        {
          question: '¿Cuáles son los plazos de entrega de los proyectos?',
          answer: 'Los plazos varían según el proyecto y la etapa de construcción.',
        },
        {
          question: '¿Qué garantías ofrecen en sus propiedades?',
          answer: 'Las garantías dependen de las condiciones del proyecto y del contrato correspondiente.',
        },
      ]

  const chatTitle = pick(td.chatTitle, 'Enmanuel')
  const chatText = pick(td.chatText, 'Hola 👋 Gracias por tu interés en nuestros proyectos. ¿En qué puedo ayudarte hoy?')
  const chatMessage = pick(td.chatMessage, 'Hola Enmanuel, vi tu perfil digital y me interesa recibir información de los proyectos.')

  const chatOptions = [
    pick(td.chatButton1, 'Quiero agendar una visita a un proyecto'),
    pick(td.chatButton2, '¿Cuáles proyectos tienen actualmente disponibles?'),
    pick(td.chatButton3, '¿Qué opciones de financiamiento ofrecen?'),
    pick(td.chatButton4, '¿Tienes unidades para fines de AirBnB?'),
  ].filter(Boolean)

  const contactTitle = pick(td.contactTitle, '¡A tus órdenes!')
  const galleryHeadline = pick(td.galleryHeadline, 'Proyectos destacados')
  const companyContactHeadline = pick(td.companyContactHeadline, `¡Conecta con ${companyName}!`)
  const companyEmail = pick(td.companyEmail, 'ventas@constructorajprez.com')
  const companyWebsite = pick(td.companyWebsite, 'www.constructorajprez.com')
  const companyAddress = pick(td.companyAddress, 'Plaza Orleans, Av. Winston Churchill, Santo Domingo, R. D.')
  const companyContactIntro = pick(td.companyContactIntro, 'Llámanos, escríbenos o síguenos en nuestras redes:')
  const faqHeadline = pick(td.faqHeadline, 'Preguntas frecuentes sobre nuestros proyectos')
  const finalCtaTitle = pick(td.finalCtaTitle, '¿Aún tienes dudas?')
  const finalCtaText = pick(td.finalCtaText, 'Escríbenos y recibe asesoría personalizada para elegir el proyecto ideal o resolver cualquier inquietud.')
  const vcardLabel = pick(td.vcardLabel, 'Agrégame a tus contactos')

  const vcardHref = `data:text/vcard;charset=utf-8,BEGIN:VCARD%0AVERSION:3.0%0AFN:${encodeURIComponent(name || companyName || 'Contacto')}${phone ? `%0ATEL:${encodeURIComponent(phone)}` : ''}${email ? `%0AEMAIL:${encodeURIComponent(email)}` : ''}${website ? `%0AURL:${encodeURIComponent(normalizeHttp(website))}` : ''}%0AEND:VCARD`

  const currentSlide = finalGallery[Math.min(activeSlide, finalGallery.length - 1)]
  const detailProject = detailProjectIndex !== null ? finalGallery[detailProjectIndex] : null

  useEffect(() => {
    if (!finalGallery.length) return

    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % finalGallery.length)
    }, 4200)

    return () => window.clearInterval(timer)
  }, [finalGallery.length])

  useEffect(() => {
    const root = document.querySelector('.intap-profile-page')
    if (!root) return

    const closeOtherFaqs = (activeItem: Element | null) => {
      const faqItems = Array.from(root.querySelectorAll('.s-faq .faq-item, .s-faq details'))

      faqItems.forEach((item) => {
        if (item === activeItem) {
          item.classList.remove('faq-force-closed')
          return
        }

        item.classList.add('faq-force-closed')

        if (item instanceof HTMLDetailsElement) {
          item.open = false
        }

        const trigger = item.querySelector('.faq-question, summary')
        if (trigger) {
          trigger.setAttribute('aria-expanded', 'false')
        }
      })
    }

    const handleFaqClick = (event: Event) => {
      const target = event.target as HTMLElement | null
      const trigger = target?.closest('.s-faq .faq-question, .s-faq summary')
      if (!trigger) return

      const activeItem = trigger.closest('.faq-item, details')

      window.requestAnimationFrame(() => {
        closeOtherFaqs(activeItem)
        trigger.setAttribute('aria-expanded', 'true')
      })
    }

    root.addEventListener('click', handleFaqClick, true)

    return () => {
      root.removeEventListener('click', handleFaqClick, true)
    }
  }, [])

  const goToWhatsapp = (message: string) => {
    window.open(waUrl(whatsapp, message), '_blank', 'noopener,noreferrer')
  }

  const openProjectDetail = (index: number) => {
    setDetailProjectIndex(index)
    setDetailImageIndex(0)
    setProjectsModalOpen(false)
  }

  const closeProjectDetail = () => {
    setDetailProjectIndex(null)
  }

  const nextDetailProject = () => {
    if (!detailProject) return
    const images = detailProject.images?.length ? detailProject.images : [detailProject.image]
    setDetailImageIndex((detailImageIndex + 1) % images.length)
  }

  const prevDetailProject = () => {
    if (!detailProject) return
    const images = detailProject.images?.length ? detailProject.images : [detailProject.image]
    setDetailImageIndex((detailImageIndex - 1 + images.length) % images.length)
  }

  const projectMapSrc = mapUrl
    ? mapUrl.replace('https://www.google.com/maps/search/?api=1&query=', 'https://www.google.com/maps?q=') + '&output=embed'
    : ''

  const detailImages = detailProject?.images?.length ? detailProject.images : detailProject?.image ? [detailProject.image] : []
  const detailImage = detailImages[detailImageIndex] || detailProject?.image || ''

  return (
    <main className="intap-profile-page" style={{ ['--red' as string]: accent }}>
      <section className="s-header">
        {avatar && (
          <div className="avatar-wrap">
            <img src={avatar} alt={name} />
          </div>
        )}

        <h1 className="header-name">{name}</h1>
        <p className="header-role">{role}</p>

        <div className="header-icons" aria-label="Accesos rápidos">
          {phone && (
            <a href={`tel:${phone}`} className="hicon" aria-label="Llamar">
              <i className="fas fa-phone-alt" />
            </a>
          )}
          {email && (
            <a href={`mailto:${email}`} className="hicon" aria-label="Enviar correo">
              <i className="fas fa-envelope" />
            </a>
          )}
          {mapUrl && (
            <a href={mapUrl} target="_blank" rel="noreferrer" className="hicon" aria-label="Ver ubicación">
              <i className="fas fa-map-marker-alt" />
            </a>
          )}
        </div>
      </section>

      <div className="divider" />

      <section className="s-contact">
        <div className="contact-header">{contactTitle}</div>

        <div className="contact-list">
          {whatsapp && (
            <a href={pick(whatsappLink?.url, waUrl(whatsapp, chatMessage))} className="contact-row" target="_blank" rel="noreferrer">
              <div className="crow-icon"><i className="fab fa-whatsapp" /></div>
              <span className="crow-text">{phone || whatsapp}</span>
            </a>
          )}

          {instagramText && (
            <a href={instagramUrl} className="contact-row" target="_blank" rel="noreferrer">
              <div className="crow-icon"><i className="fab fa-instagram" /></div>
              <span className="crow-text">{instagramText}</span>
            </a>
          )}

          {email && (
            <a href={`mailto:${email}`} className="contact-row">
              <div className="crow-icon"><i className="fas fa-envelope" /></div>
              <span className="crow-text">{email}</span>
            </a>
          )}

          {website && (
            <a href={normalizeHttp(website)} className="contact-row" target="_blank" rel="noreferrer">
              <div className="crow-icon"><i className="fas fa-globe" /></div>
              <span className="crow-text">{website}</span>
            </a>
          )}

          {address && (
            <a href={mapUrl || '#'} className="contact-row" target="_blank" rel="noreferrer">
              <div className="crow-icon"><i className="fas fa-map-marker-alt" /></div>
              <span className="crow-text">{address}</span>
            </a>
          )}
        </div>
      </section>

      <section className="s-vcard">
        <a href={vcardHref} className="vcard-btn" download={`${name.replace(/\s+/g, '-').toLowerCase()}.vcf`}>
          <i className="fas fa-address-book" /> {vcardLabel}
        </a>
      </section>

      {bioParagraphs.length > 0 && (
        <>
          <div className="divider" />
          <section className="s-bio">
            <h2 className="bio-title">{bioHeadline}</h2>

            {bioParagraphs.map((paragraph, index) => {
              const isHelpLine = /¿Tienes dudas\?|Estoy aquí para ayudarte/.test(paragraph)

              return (
                <p className={isHelpLine ? 'bio-help-line' : 'bio-text'} key={index}>
                  {paragraph}
                </p>
              )
            })}
          </section>
        </>
      )}

      {finalGallery.length > 0 && currentSlide && (
        <>
          <div className="divider" />
          <section className="s-gallery">
            <div className="gallery-header">
              <h2 className="gallery-title">{galleryHeadline}</h2>
              <span className="gallery-count">{finalGallery.length} proyectos</span>
            </div>

            <div className="carousel-wrap">
              <div className="carousel-track" style={{ transform: `translateX(-${activeSlide * 100}%)` }}>
                {finalGallery.map((item, index) => (
                  <button
                    className="carousel-slide"
                    key={item.id || index}
                    type="button"
                    onClick={() => setProjectsModalOpen(true)}
                    title="Haz clic para ver todos los proyectos"
                  >
                    <img src={item.image} alt={item.title || 'Proyecto'} />
                    {item.title && <span className="slide-label">{item.title}</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="carousel-dots">
              {finalGallery.map((item, index) => (
                <button
                  key={item.id || index}
                  type="button"
                  className={`dot ${index === activeSlide ? 'active' : ''}`}
                  onClick={() => setActiveSlide(index)}
                  aria-label={`Ver proyecto ${index + 1}`}
                />
              ))}
            </div>

            <div className="carousel-btns">
              <button className="cbtn primary" type="button" onClick={() => setProjectsModalOpen(true)}>
                Ver proyectos
              </button>
              <button
                className="cbtn outline"
                type="button"
                onClick={() => goToWhatsapp('Hola, vengo de ver su portafolio en su perfil digital. Me gustaría recibir más información sobre sus proyectos, productos o servicios.')}
              >
                Más información
              </button>
            </div>
          </section>

          {projectsModalOpen && (
            <div className="projects-modal-backdrop" role="dialog" aria-modal="true" aria-label="Todos los proyectos">
              <div className="projects-modal projects-modal--list">
                <button className="projects-modal-close" type="button" onClick={() => setProjectsModalOpen(false)} aria-label="Cerrar">
                  ×
                </button>

                <div className="projects-modal-head">
                  <h2>Todos los proyectos</h2>
                  <span>{finalGallery.length} proyectos</span>
                </div>

                <div className="projects-grid">
                  {finalGallery.map((item, index) => (
                    <article className="project-card" key={item.id || index}>
                      <button className="project-card-image" type="button" onClick={() => openProjectDetail(index)}>
                        <img src={item.image} alt={item.title || 'Proyecto'} />
                      </button>

                      <div className="project-card-body">
                        {item.title && <h3>{item.title}</h3>}
                        {item.caption && <p>{item.caption}</p>}

                        <div className="project-tags">
                          <span>Inmobiliaria</span>
                          <span>Residencial</span>
                        </div>

                        <button className="project-card-btn primary" type="button" onClick={() => openProjectDetail(index)}>
                          Ver detalles
                        </button>

                        <button
                          className="project-card-btn outline"
                          type="button"
                          onClick={() => goToWhatsapp(`Hola, vengo de ver su portafolio en su perfil digital. Me interesa ${item.title || 'este proyecto'} y me gustaría recibir más información.`)}
                        >
                          Más información
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          )}

          {detailProject && detailProjectIndex !== null && (
            <div className="projects-modal-backdrop" role="dialog" aria-modal="true" aria-label="Detalle del proyecto">
              <div className="projects-modal projects-modal--detail">
                <button className="projects-modal-close" type="button" onClick={closeProjectDetail} aria-label="Cerrar">
                  ×
                </button>

                <div className="project-detail-grid">
                  <div className="project-detail-info">
                    <h2>{detailProject.title || 'Proyecto destacado'}</h2>
                    {detailProject.caption && <p className="project-detail-location">{detailProject.caption}</p>}
                    {detailProject.caption && <p className="project-detail-desc">{detailProject.caption}</p>}

                    <div className="project-detail-actions">
                      <button
                        className="project-whatsapp-btn"
                        type="button"
                        onClick={() => goToWhatsapp(`Hola, vengo de ver su perfil digital. Me interesa ${detailProject.title || 'este proyecto'} y quiero contactar por WhatsApp.`)}
                      >
                        Contactar por WhatsApp
                      </button>

                      <button
                        className="project-more-btn"
                        type="button"
                        onClick={() => goToWhatsapp(`Hola, vengo de ver su portafolio en su perfil digital. Me gustaría más información sobre ${detailProject.title || 'este proyecto'}.`)}
                      >
                        Más información
                      </button>
                    </div>

                    {projectMapSrc && (
                      <div className="project-map">
                        <iframe
                          title={`Mapa ${detailProject.title || 'proyecto'}`}
                          src={projectMapSrc}
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                        />
                      </div>
                    )}

                    {mapUrl && (
                      <a className="project-map-link" href={mapUrl} target="_blank" rel="noreferrer">
                        Ver en Google Maps
                      </a>
                    )}
                  </div>

                  <div className="project-detail-media">
                    <img src={detailImage} alt={detailProject.title || 'Proyecto'} />

                    {detailImages.length > 1 && (
                      <>
                        <button className="project-detail-arrow project-detail-arrow--left" type="button" onClick={prevDetailProject} aria-label="Imagen anterior">
                          ‹
                        </button>

                        <button className="project-detail-arrow project-detail-arrow--right" type="button" onClick={nextDetailProject} aria-label="Imagen siguiente">
                          ›
                        </button>

                        <div className="project-detail-thumbs">
                          {detailImages.map((image, index) => (
                            <button
                              key={image}
                              className={`project-detail-thumb ${index === detailImageIndex ? 'active' : ''}`}
                              type="button"
                              onClick={() => setDetailImageIndex(index)}
                              aria-label={`Ver imagen ${index + 1}`}
                            >
                              <img src={image} alt={`${detailProject.title || 'Proyecto'} ${index + 1}`} />
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {(companyHeadline || companyLogo || companyAboutParagraphs.length > 0) && (
        <>
          <div className="divider" />
          <section className="s-company-about">
            {companyHeadline && (
              <div className="company-highlight">
                <h2>{companyHeadline}</h2>
              </div>
            )}

            {companyLogo && (
              <div className="company-logo-wrap">
                <img
                  src={companyLogo}
                  alt={companyName}
                  onError={(event) => {
                    event.currentTarget.style.display = 'none'
                  }}
                />
              </div>
            )}

            {companyAboutParagraphs.length > 0 && (
              <div className="company-copy">
                {companyAboutParagraphs.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {services.length > 0 && (
        <>
          <div className="divider" />
          <section className="s-services">
            <h2 className="services-title">{servicesHeadline}</h2>
            {servicesIntro && <p className="services-intro">{servicesIntro}</p>}

            <div className="services-list">
              {services.map((service, index) => (
                <article className="service-row" key={index}>
                  <span className="service-check">✓</span>
                  <div>
                    {service.title && <strong>{service.title}</strong>}
                    {service.description && <span>{service.description}</span>}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}

      <div className="divider" />
      <section className="s-company-contact">
        <div className="company-contact-header">¡Conecta con {companyName}!</div>
        <p className="company-contact-subtitle">Llámanos, escríbenos o síguenos en nuestras redes:</p>

        <div className="company-contact-list">
          <a className="company-contact-row" href={`tel:${companyPhone.replace(/\s/g, '')}`}>
            <span className="company-contact-icon cc-phone" aria-hidden="true"><FaPhoneAlt /></span>
            <span>{companyPhone}</span>
          </a>

          <button
            className="company-contact-row"
            type="button"
            onClick={() => goToWhatsapp('Hola, vengo de ver su perfil digital. Me gustaría recibir más información.')}
          >
            <span className="company-contact-icon cc-whatsapp" aria-hidden="true"><FaWhatsapp /></span>
            <span>Escríbenos por WhatsApp</span>
          </button>

          <a
            className="company-contact-row"
            href={`https://instagram.com/${companyInstagram.replace(/^@/, '')}`}
            target="_blank"
            rel="noreferrer"
          >
            <span className="company-contact-icon cc-instagram" aria-hidden="true"><FaInstagram /></span>
            <span>{companyInstagram}</span>
          </a>

          <a
            className="company-contact-row"
            href={`https://facebook.com/${companyFacebook.replace(/^@/, '')}`}
            target="_blank"
            rel="noreferrer"
          >
            <span className="company-contact-icon cc-facebook" aria-hidden="true"><FaFacebookF /></span>
            <span>{companyFacebook}</span>
          </a>

          <a className="company-contact-row" href={`mailto:${companyEmail}`}>
            <span className="company-contact-icon cc-email" aria-hidden="true"><FaEnvelope /></span>
            <span>{companyEmail}</span>
          </a>

          <a
            className="company-contact-row"
            href={companyWebsite.startsWith('http') ? companyWebsite : `https://${companyWebsite}`}
            target="_blank"
            rel="noreferrer"
          >
            <span className="company-contact-icon cc-web" aria-hidden="true"><FaGlobeAmericas /></span>
            <span>{companyWebsite}</span>
          </a>

          <a className="company-contact-row" href={mapUrl} target="_blank" rel="noreferrer">
            <span className="company-contact-icon cc-map" aria-hidden="true"><FaMapMarkerAlt /></span>
            <span>{companyAddress}</span>
          </a>
        </div>
      </section>

      <div className="divider" />

      <section className="s-faq">
        <h2 className="faq-title">{faqHeadline}</h2>

        <div className="faq-list">
          {faqItems.map((faq, index) => (
            <details className="faq-item" key={faq.id || index}>
              <summary className="faq-question">
                <span>{index + 1}. {faq.question}</span>
                <span className="faq-icon">+</span>
              </summary>
              {faq.answer && <div className="faq-answer"><p>{faq.answer}</p></div>}
            </details>
          ))}
        </div>

        <div className="faq-cta-box">
          <p className="faq-cta-title">{finalCtaTitle}</p>
          <p className="faq-cta-sub">{finalCtaText}</p>
          <button className="faq-cta-btn" type="button" onClick={() => goToWhatsapp(chatMessage)}>
            Sí, tengo más dudas
          </button>
        </div>
      </section>




      <footer className="s-footer">
        <p className="footer-credit">Developed by: <strong>Intap</strong></p>
      </footer>

      {whatsapp && (
        <div className="chatbot-bubble">
          <div className={`chat-panel ${chatOpen ? 'open' : ''}`}>
            <div className="chat-head">
              <img src={avatar} alt={chatTitle} />
              <span className="chat-head-name">{chatTitle}</span>
              <button className="chat-close" type="button" onClick={() => setChatOpen(false)}>✖</button>
            </div>

            <div className="chat-body">
              <p className="chat-greeting">
                {chatText}
              </p>

              <div className="chat-options">
                {chatOptions.map((option) => (
                  <button className="chat-opt" type="button" key={option} onClick={() => goToWhatsapp(option)}>
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <p className="chat-footer">Se abrirá un chat de WhatsApp.</p>
          </div>

          <div className="chat-trigger-wrap">
            <button className="chat-trigger" type="button" onClick={() => setChatOpen((value) => !value)} aria-label="Abrir chat">
              <img src={avatar} alt="Chat" />
            </button>
            <span className="chat-badge">1</span>
          </div>
        </div>
      )}
    </main>
  )
}
