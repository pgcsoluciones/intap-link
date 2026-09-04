import { FormEvent, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { FaAddressCard, FaArrowLeft, FaArrowRight, FaEnvelope, FaGlobeAmericas, FaInstagram, FaPlay, FaTimes, FaWhatsapp } from 'react-icons/fa'
import type { IntapProfileV2Profile } from './IntapProfileV2'
import { resolveProfileLanguagePolicy, resolveRequestedProfileLanguage, type ProfileLanguageCode } from './profileLanguages'
import './IntapProfileAdonisgV1.css'

type Localized = { es: string; en: string }
type Project = { id: string; title: Localized; category: Localized; cover: string; images: string[]; description: Localized }
type MediaItem = { name: string; title: Localized; image: string }
type Collaboration = { name: string; role?: string }
type FeedItem = { id: string; media_url?: string; thumbnail_url?: string; permalink?: string; caption?: string }
type FaqItem = { q: Localized; a: Localized }
type TestimonialItem = { quote: Localized; by: Localized; image: string; note?: Localized }

const COPY = {
  es: {
    role: 'Asesor de Imagen · Estilista de Moda\nEstratega de Marca Personal', request: 'Solicitar asesoría', manifesto: 'Tu imagen habla antes que tú', about: 'Sobre mí',
    aboutA: 'Mi trabajo va mucho más allá de elegir prendas. Construyo una presencia capaz de comunicar seguridad, credibilidad y propósito antes de pronunciar una sola palabra.',
    aboutB: 'Soy asesor de imagen certificado por IBA, estilista de moda, creador digital y estratega de marca personal. Mi propósito es ayudar a personas, profesionales, artistas y empresas a convertir su imagen en una herramienta de comunicación, presencia y posicionamiento.',
    aboutC: 'Mi enfoque une moda, imagen, comunicación y negocios para construir una presencia auténtica, estratégica y alineada con la esencia y los objetivos de cada cliente.',
    portfolio: 'Portafolio', viewProject: 'Ver proyecto', allProjects: 'Ver proyectos', projectPortal: 'Todos los proyectos', viewDetails: 'Ver detalles', workWithMe: 'Trabaja conmigo',
    testimonials: 'Testimonios', portraits: 'Detrás del estilo: Argenis', portraitsCopy: 'Una mirada a la persona detrás de cada concepto, producción y transformación de imagen.', gallery: 'Ver galería',
    media: 'Me has visto en', mediaDetail: 'Ver aparición', collaborations: 'He trabajado con', expertise: 'Imagen, marca y creatividad',
    certification: 'Formación y certificaciones', certificationCopy: 'Certificado por IBA · Image & Business Academy', viewCredentials: 'Ver credenciales',
    platformTitle: 'Al Estilo de Argenis', platformCopy: 'Una plataforma creada para educar, inspirar y demostrar que la imagen puede convertirse en una poderosa herramienta de transformación personal y profesional.',
    videos: 'Argenis en acción', videosCopy: 'Color, presencia, estilo y propósito. Una selección breve para ver su enfoque en movimiento.',
    latest: 'Argenis ahora', latestCopy: 'Lo último de @argenisgrullonrd', instagramCta: 'Ver más en Instagram', faq: 'Preguntas frecuentes',
    quoteA: 'No solo transformo la manera en que te ves.', quoteB: 'Te ayudo a proyectar el poder de quien realmente eres.',
    contactTitle: 'Solicitar asesoría', contactCopy: 'Cuéntame brevemente qué deseas proyectar y te contacto por WhatsApp.',
    name: 'Nombre y apellido', whatsapp: 'WhatsApp', email: 'Correo electrónico', service: 'Servicio', goal: '¿Qué deseas lograr?', send: 'Enviar solicitud', viaWhatsapp: 'Escribir por WhatsApp', close: 'Cerrar',
    services: ['Asesoría de imagen personal', 'Imagen profesional / ejecutiva', 'Estilismo de moda', 'Marca personal', 'Producción / campaña', 'Evento', 'Otro'],
    imageItems: ['Asesoría de imagen personal', 'Estilismo de moda', 'Imagen masculina', 'Imagen corporativa', 'Colorimetría', 'Compras personales', 'Estilismo nupcial'],
    brandItems: ['Marca personal', 'Proyección profesional', 'Comunicación', 'Estrategia de contenido'],
    creativeItems: ['Producciones fotográficas', 'Campañas', 'Eventos', 'Colaboraciones estratégicas con marcas'],
    contact: 'Contacto'
  },
  en: {
    role: 'Image Consultant · Fashion Stylist\nPersonal Brand Strategist', request: 'Request a consultation', manifesto: 'Your image speaks before you do', about: 'About me',
    aboutA: 'My work goes far beyond choosing clothes. I build a presence capable of communicating confidence, credibility and purpose before you say a single word.',
    aboutB: 'I am an IBA-certified image consultant, fashion stylist, digital creator and personal brand strategist. I help people, professionals, artists and companies turn image into a tool for communication, presence and positioning.',
    aboutC: 'My approach combines fashion, image, communication and business to build an authentic, strategic presence aligned with each client’s essence and goals.',
    portfolio: 'Portfolio', viewProject: 'View project', allProjects: 'View projects', projectPortal: 'All projects', viewDetails: 'View details', workWithMe: 'Work with me',
    testimonials: 'Testimonials', portraits: 'Behind the style: Argenis', portraitsCopy: 'A look at the person behind each concept, production and image transformation.', gallery: 'View gallery',
    media: 'As seen in', mediaDetail: 'View appearance', collaborations: 'I have worked with', expertise: 'Image, brand and creativity',
    certification: 'Training and certifications', certificationCopy: 'Certified by IBA · Image & Business Academy', viewCredentials: 'View credentials',
    platformTitle: 'Al Estilo de Argenis', platformCopy: 'A platform created to educate, inspire and show how image can become a powerful tool for personal and professional transformation.',
    videos: 'Argenis in action', videosCopy: 'Color, presence, style and purpose. A short selection to see his approach in motion.',
    latest: 'Argenis now', latestCopy: 'Latest from @argenisgrullonrd', instagramCta: 'See more on Instagram', faq: 'Frequently asked questions',
    quoteA: 'I do not only transform the way you look.', quoteB: 'I help you project the power of who you truly are.',
    contactTitle: 'Request a consultation', contactCopy: 'Tell me briefly what you want to project and I will contact you through WhatsApp.',
    name: 'Full name', whatsapp: 'WhatsApp', email: 'Email', service: 'Service', goal: 'What would you like to achieve?', send: 'Send request', viaWhatsapp: 'Write on WhatsApp', close: 'Close',
    services: ['Personal image consulting', 'Professional / executive image', 'Fashion styling', 'Personal branding', 'Production / campaign', 'Event', 'Other'],
    imageItems: ['Personal image consulting', 'Fashion styling', 'Mens image', 'Corporate image', 'Color analysis', 'Personal shopping', 'Bridal styling'],
    brandItems: ['Personal branding', 'Professional presence', 'Communication', 'Content strategy'],
    creativeItems: ['Photo productions', 'Campaigns', 'Events', 'Strategic brand collaborations'],
    contact: 'Contact'
  }
} as const

const PROJECTS: Project[] = [
  { id: 'beauty-fragrance', title: { es: 'Belleza y fragancia', en: 'Beauty & Fragrance' }, category: { es: 'Estilismo editorial', en: 'Editorial styling' }, cover: '/assets/adonisg/portfolio/beauty-fragrance/beauty-cover.webp', images: ['/assets/adonisg/portfolio/beauty-fragrance/beauty-cover.webp','/assets/adonisg/portfolio/beauty-fragrance/beauty-02.webp','/assets/adonisg/portfolio/beauty-fragrance/beauty-03.webp','/assets/adonisg/portfolio/beauty-fragrance/beauty-04.webp','/assets/adonisg/portfolio/beauty-fragrance/beauty-05.webp'], description: { es: 'Producción editorial donde belleza, fragancia, accesorios y composición construyen una narrativa visual elegante y coherente.', en: 'An editorial production where beauty, fragrance, accessories and composition build an elegant, coherent visual story.' } },
  { id: 'red-statement', title: { es: 'Declaración en rojo', en: 'Red Statement' }, category: { es: 'Editorial de moda', en: 'Fashion editorial' }, cover: '/assets/adonisg/portfolio/red-statement/red-cover.webp', images: ['/assets/adonisg/portfolio/red-statement/red-cover.webp','/assets/adonisg/portfolio/red-statement/red-02.webp','/assets/adonisg/portfolio/red-statement/red-03.webp','/assets/adonisg/portfolio/red-statement/red-04.webp','/assets/adonisg/portfolio/red-statement/red-05.webp'], description: { es: 'Color, silueta y actitud se unen para construir una presencia fuerte, elegante y memorable.', en: 'Color, silhouette and attitude unite to build a strong, elegant and memorable presence.' } },
  { id: 'noir', title: { es: 'Noir', en: 'Noir' }, category: { es: 'Editorial de moda', en: 'Fashion editorial' }, cover: '/assets/adonisg/portfolio/noir/noir-cover.webp', images: ['/assets/adonisg/portfolio/noir/noir-cover.webp','/assets/adonisg/portfolio/noir/noir-02.webp','/assets/adonisg/portfolio/noir/noir-03.webp','/assets/adonisg/portfolio/noir/noir-04.webp'], description: { es: 'Una narrativa oscura y sofisticada construida desde volumen, accesorios, detalle y presencia.', en: 'A dark sophisticated narrative built through volume, accessories, detail and presence.' } },
  { id: 'couple', title: { es: 'Pareja y estilo de vida', en: 'Couple Lifestyle' }, category: { es: 'Estilismo de estilo de vida', en: 'Lifestyle styling' }, cover: '/assets/adonisg/portfolio/couple-lifestyle/couple-cover.webp', images: ['/assets/adonisg/portfolio/couple-lifestyle/couple-cover.webp','/assets/adonisg/portfolio/couple-lifestyle/couple-02.webp','/assets/adonisg/portfolio/couple-lifestyle/couple-03.webp','/assets/adonisg/portfolio/couple-lifestyle/couple-04.webp'], description: { es: 'Una historia visual donde vestuario, entorno y conexión trabajan como una sola composición.', en: 'A visual story where wardrobe, setting and connection work as one composition.' } },
  { id: 'evening', title: { es: 'Presencia de noche', en: 'Evening Statement' }, category: { es: 'Estilismo de gala', en: 'Evening styling' }, cover: '/assets/adonisg/portfolio/evening/evening-cover.webp', images: ['/assets/adonisg/portfolio/evening/evening-cover.webp','/assets/adonisg/portfolio/evening/evening-02.webp','/assets/adonisg/portfolio/evening/evening-03.webp','/assets/adonisg/portfolio/evening/evening-04.webp','/assets/adonisg/portfolio/evening/evening-05.webp'], description: { es: 'Silueta, color y accesorios diseñados para elevar seguridad, ocasión e impacto.', en: 'Silhouette, color and accessories designed to elevate confidence, occasion and impact.' } },
  { id: 'mens-brand', title: { es: 'Imagen masculina y marca personal', en: 'Mens Image & Personal Brand' }, category: { es: 'Marca personal', en: 'Personal branding' }, cover: '/assets/adonisg/portfolio/mens-brand/mens-cover.webp', images: ['/assets/adonisg/portfolio/mens-brand/mens-cover.webp','/assets/adonisg/portfolio/mens-brand/mens-02.webp','/assets/adonisg/portfolio/mens-brand/mens-03.webp','/assets/adonisg/portfolio/mens-brand/mens-04.webp'], description: { es: 'Estilismo masculino orientado a presencia, coherencia y posicionamiento.', en: 'Mens styling focused on presence, coherence and positioning.' } }
]

const MEDIA: MediaItem[] = [
  { name: 'DMH · DLB Noticias', title: { es: 'Lo Que No Te Cuentan del Éxito', en: 'Lo Que No Te Cuentan del Éxito' }, image: '/assets/adonisg/media/dlb-dmh-exito.webp' },
  { name: 'Gran Bazar de Emprendedores', title: { es: 'Potencializa tu imagen en redes sociales', en: 'Elevate your image on social media' }, image: '/assets/adonisg/media/bazar-emprendedores.webp' },
  { name: 'La Vitrina · Moda & Belleza', title: { es: 'Editorial de moda y belleza', en: 'Fashion and beauty editorial' }, image: '/assets/adonisg/media/la-vitrina.webp' },
  { name: 'El Janis', title: { es: 'Crédito como asesor de imagen', en: 'Image consultant credit' }, image: '/assets/adonisg/media/el-janis.webp' }
]

const FAQS: FaqItem[] = [
  { q: { es: '¿En qué consiste una asesoría de imagen?', en: 'What does an image consultation involve?' }, a: { es: 'No se trata solo de ropa. Es un proceso para descubrir cómo proyectar tu esencia con intención, seguridad y estilo, conectando tu imagen con lo que deseas comunicar.', en: 'It is not only about clothes. It is a process to discover how to project your essence with intention, confidence and style.' } },
  { q: { es: '¿Qué incluye el servicio?', en: 'What is included in the service?' }, a: { es: 'Según el objetivo, puede incluir colorimetría, estudio de silueta y rostro, definición de estilo, revisión de guardarropa, guía de compras y recomendaciones de proyección.', en: 'Depending on the goal, it may include color analysis, body and face assessment, style definition, wardrobe review, shopping guidance and presence recommendations.' } },
  { q: { es: '¿La asesoría incluye acompañamiento de compras?', en: 'Can the consultation include personal shopping?' }, a: { es: 'Sí. Puede realizarse presencialmente en tiendas o virtualmente con opciones y sugerencias ajustadas a tu perfil y presupuesto.', en: 'Yes. It can be done in person in stores or virtually with options tailored to your profile and budget.' } },
  { q: { es: '¿Cuánto dura la asesoría?', en: 'How long does a consultation take?' }, a: { es: 'Puede durar entre 1 y 2 horas, dependiendo del servicio y de los objetivos definidos para la sesión.', en: 'It may last between 1 and 2 hours depending on the service and goals.' } },
  { q: { es: '¿Trabajas con hombres y mujeres?', en: 'Do you work with men and women?' }, a: { es: 'Sí. Cada proceso se construye alrededor de la persona, su contexto, estilo de vida y lo que necesita proyectar.', en: 'Yes. Each process is built around the person, context, lifestyle and what they need to project.' } },
  { q: { es: '¿Las asesorías pueden ser virtuales o presenciales?', en: 'Can consultations be virtual or in person?' }, a: { es: 'Sí. Algunas sesiones pueden realizarse virtualmente y otras de manera presencial en Santiago o según coordinación previa.', en: 'Yes. Some sessions can be virtual and others in person in Santiago or by prior arrangement.' } }
]

const TESTIMONIALS: TestimonialItem[] = [
  { image: '/assets/adonisg/testimonials/dr-hugo-maria.webp', quote: { es: 'Gracias por siempre cuidar cada detalle y hacer que todo se vea con intención y elegancia.', en: 'Thank you for always caring for every detail and making everything look intentional and elegant.' }, by: { es: 'Dr. Hugo María', en: 'Dr. Hugo María' } },
  { image: '/assets/adonisg/portraits/argenis-05.webp', quote: { es: 'La diferencia no fue solo cómo me veía, sino cómo empecé a presentarme.', en: 'The difference was not only how I looked, but how I started presenting myself.' }, by: { es: 'Testimonio de muestra', en: 'Sample testimonial' }, note: { es: 'Referencia visual temporal', en: 'Temporary visual reference' } },
  { image: '/assets/adonisg/portraits/argenis-06.webp', quote: { es: 'Sentí que por fin mi imagen decía lo mismo que yo quería comunicar.', en: 'I finally felt my image was saying what I wanted to communicate.' }, by: { es: 'Testimonio de muestra', en: 'Sample testimonial' }, note: { es: 'Referencia visual temporal', en: 'Temporary visual reference' } }
]

const PORTRAITS = Array.from({ length: 6 }, (_, i) => `/assets/adonisg/portraits/argenis-${String(i + 1).padStart(2, '0')}.webp`)
const HERO_SLIDES = Array.from({ length: 5 }, (_, i) => `/assets/adonisg/hero/slide-${String(i + 1).padStart(2, '0')}.webp`)
const CERTS = Array.from({ length: 5 }, (_, i) => `/assets/adonisg/certifications/cert-${String(i + 1).padStart(2, '0')}.webp`)
const VIDEOS = ['/assets/adonisg/videos/video-01.mp4', '/assets/adonisg/videos/video-02.mp4', '/assets/adonisg/videos/video-03.mp4']

function parseJson<T>(raw: string | undefined, fallback: T): T { if (!raw) return fallback; try { return JSON.parse(raw) as T } catch { return fallback } }
function cleanPhone(value: string) { return value.replace(/\D/g, '') }

function ModalShell({ children, onClose, label }: { children: ReactNode; onClose: () => void; label: string }) {
  useEffect(() => { const old = document.body.style.overflow; document.body.style.overflow = 'hidden'; const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', key); return () => { document.body.style.overflow = old; window.removeEventListener('keydown', key) } }, [onClose])
  return <div className="adonis-modal-backdrop" role="dialog" aria-modal="true" aria-label={label} onMouseDown={e => e.target === e.currentTarget && onClose()}><div className="adonis-modal"><button className="adonis-modal-close" onClick={onClose} aria-label="Cerrar"><FaTimes /></button>{children}</div></div>
}

function TestimonialOverlay({ item, language, onClose }: { item: TestimonialItem; language: ProfileLanguageCode; onClose: () => void }) {
  useEffect(() => { const close = () => onClose(); window.addEventListener('scroll', close, { passive: true }); return () => window.removeEventListener('scroll', close) }, [onClose])
  return <div className="adonis-testimonial-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}><article><button onClick={onClose} aria-label="Cerrar"><FaTimes /></button><img src={item.image} alt={item.by[language]} /><div><span>“</span><blockquote>{item.quote[language]}</blockquote><strong>{item.by[language]}</strong>{item.note && <small>{item.note[language]}</small>}</div></article></div>
}

export default function IntapProfileAdonisgV1({ profile }: { profile: IntapProfileV2Profile }) {
  const td = profile.templateData ?? {}
  const policy = resolveProfileLanguagePolicy(td, { defaultLanguage: 'es', enabled: ['es', 'en'] })
  const [language, setLanguage] = useState<ProfileLanguageCode>(() => typeof window === 'undefined' ? policy.defaultLanguage : resolveRequestedProfileLanguage(window.location.search, policy))
  const t = COPY[language]
  const [heroSlide, setHeroSlide] = useState(0)
  const [portfolioSlide, setPortfolioSlide] = useState(0)
  const [activeProject, setActiveProject] = useState<Project | null>(null)
  const [galleryIndex, setGalleryIndex] = useState(0)
  const [projectPortalOpen, setProjectPortalOpen] = useState(false)
  const [portraitOpen, setPortraitOpen] = useState(false)
  const [portraitIndex, setPortraitIndex] = useState(0)
  const [mediaSlide, setMediaSlide] = useState(0)
  const [activeMedia, setActiveMedia] = useState<MediaItem | null>(null)
  const [testimonialSlide, setTestimonialSlide] = useState(0)
  const [testimonialOpen, setTestimonialOpen] = useState<TestimonialItem | null>(null)
  const [certOpen, setCertOpen] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)
  const [faqOpen, setFaqOpen] = useState<number | null>(0)
  const [selectedVideo, setSelectedVideo] = useState(0)
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [feedReady, setFeedReady] = useState(false)
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([])

  const displayName = profile.name || 'Argenis Grullón'
  const whatsapp = profile.whatsapp || profile.whatsappNumber || profile.whatsapp_number || td.whatsapp || '18293024095'
  const email = profile.email || td.email || ''
  const instagram = td.instagram_url || 'https://www.instagram.com/argenisgrullonrd/'
  const collaborations = useMemo(() => parseJson<Collaboration[]>(td.collaborations_json, []), [td.collaborations_json])

  useEffect(() => { const id = window.setInterval(() => setHeroSlide(v => (v + 1) % HERO_SLIDES.length), 4300); return () => clearInterval(id) }, [])
  useEffect(() => { const id = window.setInterval(() => setPortfolioSlide(v => (v + 1) % PROJECTS.length), 4500); return () => clearInterval(id) }, [])
  useEffect(() => { if (!activeProject) return; const id = window.setInterval(() => setGalleryIndex(v => (v + 1) % activeProject.images.length), 3800); return () => clearInterval(id) }, [activeProject])
  useEffect(() => { if (!portraitOpen) return; const id = window.setInterval(() => setPortraitIndex(v => (v + 1) % PORTRAITS.length), 3800); return () => clearInterval(id) }, [portraitOpen])
  useEffect(() => { const id = window.setInterval(() => setMediaSlide(v => (v + 1) % MEDIA.length), 4600); return () => clearInterval(id) }, [])
  useEffect(() => { if (testimonialOpen) return; const id = window.setInterval(() => setTestimonialSlide(v => (v + 1) % TESTIMONIALS.length), 4300); return () => clearInterval(id) }, [testimonialOpen])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search); if (language === policy.defaultLanguage) params.delete('lang'); else params.set('lang', language); const query = params.toString(); history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`)
  }, [language, policy.defaultLanguage])

  useEffect(() => {
    const origin = (import.meta.env.VITE_PUBLIC_ORIGIN || window.location.origin).replace(/\/$/, '')
    const canonical = `${origin}/adonisg${language === 'en' ? '?lang=en' : ''}`
    const title = language === 'en' ? 'Argenis Grullón | Image Consultant & Fashion Stylist' : 'Argenis Grullón | Asesor de Imagen y Estilista de Moda'
    const description = language === 'en' ? 'IBA-certified image consultant, fashion stylist and personal brand strategist in Santiago, Dominican Republic.' : 'Asesor de imagen certificado por IBA, estilista de moda y estratega de marca personal en Santiago, República Dominicana.'
    document.title = title
    const meta = (key: string, value: string, property = false) => { const selector = `meta[${property ? 'property' : 'name'}="${key}"]`; let el = document.head.querySelector<HTMLMetaElement>(selector); if (!el) { el = document.createElement('meta'); el.setAttribute(property ? 'property' : 'name', key); document.head.appendChild(el) } el.content = value }
    let canonicalEl = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]'); if (!canonicalEl) { canonicalEl = document.createElement('link'); canonicalEl.rel = 'canonical'; document.head.appendChild(canonicalEl) }
    canonicalEl.href = canonical
    meta('description', description); meta('og:title', title, true); meta('og:description', description, true); meta('og:type', 'profile', true); meta('og:url', canonical, true); meta('og:image', `${origin}/assets/adonisg/og/adonisg-og.jpg`, true); meta('twitter:card', 'summary_large_image'); meta('twitter:title', title); meta('twitter:description', description); meta('twitter:image', `${origin}/assets/adonisg/og/adonisg-og.jpg`)
    document.documentElement.lang = language
  }, [language])

  useEffect(() => { const endpoint = td.instagram_feed_endpoint; if (!endpoint) { setFeedReady(true); return } fetch(endpoint, { headers: { Accept: 'application/json' } }).then(r => r.ok ? r.json() : Promise.reject()).then(json => { const items = Array.isArray(json?.items) ? json.items : Array.isArray(json?.data) ? json.data : []; setFeed(items.slice(0, 7)); setFeedReady(true) }).catch(() => setFeedReady(true)) }, [td.instagram_feed_endpoint])

  const openWhatsApp = (message: string) => window.open(`https://wa.me/${cleanPhone(whatsapp)}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
  const openProject = (project: Project) => { setProjectPortalOpen(false); setGalleryIndex(0); setActiveProject(project) }
  const projectWhatsApp = (project: Project) => openWhatsApp(language === 'en' ? `Hello Argenis, I was viewing “${project.title.en}” and would like information about a similar project.` : `Hola Argenis, estaba viendo “${project.title.es}” y quisiera información sobre un proyecto similar.`)
  const handleContact = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const fd = new FormData(event.currentTarget); openWhatsApp(`${t.contactTitle}\nNombre: ${fd.get('name')}\nWhatsApp: ${fd.get('phone')}\nEmail: ${fd.get('email')}\nServicio: ${fd.get('service')}\nObjetivo: ${fd.get('goal')}`) }
  const downloadVcard = () => { const card = ['BEGIN:VCARD','VERSION:3.0','FN:Argenis Grullón','ORG:Al Estilo de Argenis','TITLE:Asesor de Imagen · Fashion Stylist',`TEL;TYPE=CELL:+${cleanPhone(whatsapp)}`,email ? `EMAIL:${email}` : '',`URL:${instagram}`,'END:VCARD'].filter(Boolean).join('\r\n'); const url = URL.createObjectURL(new Blob([card], { type: 'text/vcard;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = 'Argenis-Grullon.vcf'; a.click(); URL.revokeObjectURL(url) }
  const playVideo = (index: number) => { videoRefs.current.forEach((video, i) => { if (video && i !== index) { video.pause(); video.currentTime = 0 } }); setSelectedVideo(index); setTimeout(() => videoRefs.current[index]?.play(), 0) }

  const featuredProject = PROJECTS[portfolioSlide]
  const featuredMedia = MEDIA[mediaSlide]
  const featuredTestimonial = TESTIMONIALS[testimonialSlide]
  const marqueeItems = [...t.imageItems, ...t.brandItems, ...t.creativeItems]

  return <main className="adonis-profile">
    <header className="adonis-hero">
      <div className="adonis-hero-slides">{HERO_SLIDES.map((src, i) => <img key={src} className={i === heroSlide ? 'is-active' : ''} src={src} alt={`${displayName} ${i + 1}`} fetchPriority={i === 0 ? 'high' : undefined} />)}</div>
      <div className="adonis-hero-shade" />
      <nav className="adonis-topbar"><span className="adonis-top-logo-wrap"><img src="/assets/adonisg/brand/top-logo.webp" alt="Al Estilo de Argenis" /></span><button className="adonis-language" onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}><FaGlobeAmericas /> {language === 'es' ? 'English' : 'Español'}</button></nav>
      <div className="adonis-hero-content"><h1>ARGENIS<br />GRULLÓN</h1><p className="adonis-role">{t.role}</p><button className="adonis-btn adonis-btn-light" onClick={() => setContactOpen(true)}>{t.request}</button></div>
      <div className="adonis-hero-dots">{HERO_SLIDES.map((_, i) => <button key={i} className={i === heroSlide ? 'is-active' : ''} onClick={() => setHeroSlide(i)} aria-label={`Slide ${i + 1}`} />)}</div>
    </header>

    <section className="adonis-brand-strip"><img src="/assets/adonisg/brand/top-logo.webp" alt="Al Estilo de Argenis" /></section>
    <section className="adonis-manifesto"><h2>{t.manifesto}</h2></section>
    <section className="adonis-about"><h2>{t.about}</h2><p>{t.aboutA}</p><p>{t.aboutB}</p><p>{t.aboutC}</p></section>

    <section className="adonis-portfolio" id="portfolio"><h2>{t.portfolio}</h2><article className="adonis-featured-project"><button onClick={() => openProject(featuredProject)}><img src={featuredProject.cover} alt={featuredProject.title[language]} /><div><small>{featuredProject.category[language]}</small><h3>{featuredProject.title[language]}</h3></div></button><button className="adonis-btn adonis-btn-dark" onClick={() => openProject(featuredProject)}>{t.viewProject}</button></article><div className="adonis-slider-dots">{PROJECTS.map((_, i) => <button key={i} className={i === portfolioSlide ? 'is-active' : ''} onClick={() => setPortfolioSlide(i)} />)}</div><button className="adonis-btn adonis-btn-outline" onClick={() => setProjectPortalOpen(true)}>{t.allProjects} <FaArrowRight /></button></section>

    <section className="adonis-testimonials"><h2>{t.testimonials}</h2><button className="adonis-testimonial-card" onClick={() => setTestimonialOpen(featuredTestimonial)}><img src={featuredTestimonial.image} alt={featuredTestimonial.by[language]} /><span>{featuredTestimonial.by[language]}</span></button><div className="adonis-slider-dots">{TESTIMONIALS.map((_, i) => <button key={i} className={i === testimonialSlide ? 'is-active' : ''} onClick={() => setTestimonialSlide(i)} />)}</div></section>

    <section className="adonis-personal"><h2>{t.portraits}</h2><button className="adonis-personal-card" onClick={() => { setPortraitIndex(0); setPortraitOpen(true) }}><img src={PORTRAITS[0]} alt={displayName} /><p>{t.portraitsCopy}</p><span className="adonis-btn adonis-btn-dark">{t.gallery} <FaArrowRight /></span></button></section>

    <section className="adonis-media"><h2>{t.media}</h2><button className="adonis-media-card" onClick={() => setActiveMedia(featuredMedia)}><img src={featuredMedia.image} alt={featuredMedia.name} /><div><small>{featuredMedia.name}</small><h3>{featuredMedia.title[language]}</h3><span>{t.mediaDetail} <FaArrowRight /></span></div></button><div className="adonis-slider-dots adonis-slider-dots-light">{MEDIA.map((_, i) => <button key={i} className={i === mediaSlide ? 'is-active' : ''} onClick={() => setMediaSlide(i)} />)}</div></section>

    <section className="adonis-collab"><h2>{t.collaborations}</h2><div>{collaborations.length ? collaborations.map((item, i) => <p key={`${item.name}-${i}`}>{item.name}</p>) : <p>Figuras públicas · Artistas · Influencers · Marcas · Empresas · Producciones</p>}</div></section>

    <section className="adonis-expertise"><h2>{t.expertise}</h2><div className="adonis-marquee"><div>{[...marqueeItems, ...marqueeItems].map((item, i) => <span key={`${item}-${i}`}>{item}</span>)}</div></div></section>

    <section className="adonis-cert"><h2>{t.certification}</h2><p>{t.certificationCopy}</p><button onClick={() => setCertOpen(true)}>{t.viewCredentials} <FaArrowRight /></button></section>
    <section className="adonis-platform"><img src="/assets/adonisg/brand/logo-white.png" alt="Al Estilo de Argenis" /><h2>{t.platformTitle}</h2><p>{t.platformCopy}</p></section>

    <section className="adonis-videos"><h2>{t.videos}</h2><p>{t.videosCopy}</p><div className="adonis-video-feature"><video ref={node => { videoRefs.current[selectedVideo] = node }} key={VIDEOS[selectedVideo]} src={VIDEOS[selectedVideo]} preload="metadata" playsInline controls poster={PORTRAITS[(selectedVideo + 1) % PORTRAITS.length]} onEnded={() => setSelectedVideo(0)} /></div><div className="adonis-video-thumbs">{VIDEOS.map((src, i) => i === selectedVideo ? null : <button key={src} onClick={() => playVideo(i)}><video src={src} preload="metadata" playsInline poster={PORTRAITS[(i + 1) % PORTRAITS.length]} /><span><FaPlay /></span></button>)}</div><button className="adonis-btn adonis-btn-dark adonis-video-cta" onClick={() => setContactOpen(true)}>{t.request}</button></section>

    <section className="adonis-instagram"><h2>{t.latest}</h2><p>{t.latestCopy}</p>{feed.length > 0 ? <div className="adonis-feed-grid">{feed.map((item, i) => <a key={item.id || i} href={item.permalink || instagram} target="_blank" rel="noopener noreferrer"><img src={item.thumbnail_url || item.media_url} alt={item.caption || 'Instagram'} /></a>)}</div> : feedReady && <div className="adonis-feed-empty"><FaInstagram /></div>}<a href={instagram} target="_blank" rel="noopener noreferrer">{t.instagramCta} <FaArrowRight /></a></section>

    <section className="adonis-faq"><h2>{t.faq}</h2>{FAQS.map((item, i) => <article key={i} className={faqOpen === i ? 'is-open' : ''}><button onClick={() => setFaqOpen(faqOpen === i ? null : i)}><span>{item.q[language]}</span><b>{faqOpen === i ? '×' : '+'}</b></button>{faqOpen === i && <p>{item.a[language]}</p>}</article>)}</section>

    <section className="adonis-quote"><div className="adonis-quote-bg" /><div className="adonis-quote-overlay" /><div><p>{t.quoteA}</p><strong>{t.quoteB}</strong><span>— Argenis Grullón</span></div></section>

    <section className="adonis-contact-icons"><button onClick={() => openWhatsApp(language === 'en' ? 'Hello Argenis, I would like information about your services.' : 'Hola Argenis, quisiera información sobre tus servicios.')}><FaWhatsapp /><span>WhatsApp</span></button><a href={instagram} target="_blank" rel="noopener noreferrer"><FaInstagram /><span>Instagram</span></a><button onClick={downloadVcard}><FaAddressCard /><span>{t.contact}</span></button></section>
    <footer className="adonis-brand-footer"><img src="/assets/adonisg/brand/linkedin-banner.jpg" alt="Al Estilo de Argenis" /></footer>

    {projectPortalOpen && <ModalShell label={t.projectPortal} onClose={() => setProjectPortalOpen(false)}><div className="adonis-project-portal"><h2>{t.projectPortal}</h2><div>{PROJECTS.map(project => <button key={project.id} onClick={() => openProject(project)}><img src={project.cover} alt={project.title[language]} /><h3>{project.title[language]}</h3><span>{t.viewDetails}</span></button>)}</div></div></ModalShell>}

    {activeProject && <ModalShell label={activeProject.title[language]} onClose={() => setActiveProject(null)}><div className="adonis-project-modal"><small>{activeProject.category[language]}</small><h2>{activeProject.title[language]}</h2><p>{activeProject.description[language]}</p><div className="adonis-gallery-stage"><img src={activeProject.images[galleryIndex]} alt={`${activeProject.title[language]} ${galleryIndex + 1}`} /><button className="prev" onClick={() => setGalleryIndex(v => (v - 1 + activeProject.images.length) % activeProject.images.length)}><FaArrowLeft /></button><button className="next" onClick={() => setGalleryIndex(v => (v + 1) % activeProject.images.length)}><FaArrowRight /></button><span>{galleryIndex + 1}/{activeProject.images.length}</span></div><div className="adonis-gallery-dots">{activeProject.images.map((_, i) => <button key={i} className={i === galleryIndex ? 'is-active' : ''} onClick={() => setGalleryIndex(i)} />)}</div><button className="adonis-btn adonis-btn-dark" onClick={() => projectWhatsApp(activeProject)}><FaWhatsapp /> {t.workWithMe}</button></div></ModalShell>}

    {portraitOpen && <ModalShell label={t.portraits} onClose={() => setPortraitOpen(false)}><div className="adonis-project-modal"><h2>{t.portraits}</h2><p>{t.portraitsCopy}</p><div className="adonis-gallery-stage"><img src={PORTRAITS[portraitIndex]} alt={`${displayName} ${portraitIndex + 1}`} /><button className="prev" onClick={() => setPortraitIndex(v => (v - 1 + PORTRAITS.length) % PORTRAITS.length)}><FaArrowLeft /></button><button className="next" onClick={() => setPortraitIndex(v => (v + 1) % PORTRAITS.length)}><FaArrowRight /></button><span>{portraitIndex + 1}/{PORTRAITS.length}</span></div><div className="adonis-gallery-dots">{PORTRAITS.map((_, i) => <button key={i} className={i === portraitIndex ? 'is-active' : ''} onClick={() => setPortraitIndex(i)} />)}</div><button className="adonis-btn adonis-btn-dark" onClick={() => openWhatsApp(language === 'en' ? 'Hello Argenis, I viewed your personal gallery and would like to work with you.' : 'Hola Argenis, vi tu galería personal y me gustaría trabajar contigo.')}><FaWhatsapp /> {t.workWithMe}</button></div></ModalShell>}

    {activeMedia && <ModalShell label={activeMedia.name} onClose={() => setActiveMedia(null)}><div className="adonis-media-modal"><img src={activeMedia.image} alt={activeMedia.name} /><small>{activeMedia.name}</small><h2>{activeMedia.title[language]}</h2></div></ModalShell>}
    {testimonialOpen && <TestimonialOverlay item={testimonialOpen} language={language} onClose={() => setTestimonialOpen(null)} />}
    {certOpen && <ModalShell label={t.certification} onClose={() => setCertOpen(false)}><div className="adonis-cert-modal"><h2>{t.certification}</h2><div>{CERTS.map((src, i) => <img src={src} alt={`${t.certification} ${i + 1}`} key={src} />)}</div></div></ModalShell>}
    {contactOpen && <ModalShell label={t.contactTitle} onClose={() => setContactOpen(false)}><form className="adonis-contact-form" onSubmit={handleContact}><h2>{t.contactTitle}</h2><p>{t.contactCopy}</p><label>{t.name}<input name="name" required autoComplete="name" /></label><label>{t.whatsapp}<input name="phone" required inputMode="tel" /></label><label>{t.email}<input name="email" type="email" /></label><label>{t.service}<select name="service" required defaultValue=""><option value="" disabled>—</option>{t.services.map(item => <option key={item}>{item}</option>)}</select></label><label>{t.goal}<textarea name="goal" rows={4} required /></label><button className="adonis-btn adonis-btn-dark" type="submit">{t.send}</button><button className="adonis-whatsapp-btn" type="button" onClick={() => openWhatsApp(language === 'en' ? 'Hello Argenis, I would like an image consultation.' : 'Hola Argenis, me interesa una asesoría de imagen.')}><FaWhatsapp /> {t.viaWhatsapp}</button>{email && <a href={`mailto:${email}`}><FaEnvelope /> {email}</a>}</form></ModalShell>}
  </main>
}
