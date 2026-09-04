import { FormEvent, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { FaArrowLeft, FaArrowRight, FaEnvelope, FaGlobeAmericas, FaInstagram, FaPlay, FaTimes, FaWhatsapp } from 'react-icons/fa'
import type { IntapProfileV2Profile } from './IntapProfileV2'
import { resolveProfileLanguagePolicy, resolveRequestedProfileLanguage, type ProfileLanguageCode } from './profileLanguages'
import './IntapProfileAdonisgV1.css'

type Localized = { es: string; en: string }
type Project = { id: string; title: Localized; category: Localized; cover: string; images: string[]; description: Localized }
type MediaItem = { name: string; title: Localized; image: string; url?: string }
type Collaboration = { name: string; role?: string; image?: string; url?: string }
type FeedItem = { id: string; media_url?: string; thumbnail_url?: string; permalink?: string; caption?: string; media_type?: string }
type FaqItem = { q: Localized; a: Localized }
type TestimonialItem = { quote: Localized; by: Localized; note?: Localized }

type Copy = {
  heroEyebrow: string; heroRole: string; heroLine: string; request: string; portfolio: string; manifestoTitle: string; manifesto: string;
  manifestoKicker: string; selectedWork: string; selectedWorkKicker: string; fullPortfolio: string; fullPortfolioKicker: string; viewProject: string;
  portraitsTitle: string; portraitsKicker: string; portraitsCopy: string; media: string; mediaKicker: string; collaborations: string; collaborationsKicker: string;
  expertise: string; image: string; brand: string; creative: string; imageItems: string[]; brandItems: string[]; creativeItems: string[];
  certification: string; certificationCopy: string; viewCredentials: string; platformTitle: string; platformCopy: string; latest: string; latestCopy: string;
  instagramCta: string; testimonialTitle: string; testimonialKicker: string; videosTitle: string; videosKicker: string; videosCopy: string;
  faqTitle: string; faqKicker: string; about: string; aboutCopy: string; aboutCopy2: string; quoteA: string; quoteB: string;
  contactTitle: string; contactCopy: string; name: string; whatsapp: string; email: string; service: string; goal: string; date: string;
  send: string; viaWhatsapp: string; serviceOptions: string[]; success: string; noFeed: string; viewMore: string; close: string;
  languageLabel: string; workWithMe: string; mediaDetail: string; gallery: string;
}

const COPY: Record<ProfileLanguageCode, Copy> = {
  es: {
    heroEyebrow: 'Santiago · República Dominicana',
    heroRole: 'Asesor de Imagen · Estilista de Moda · Estratega de Marca',
    heroLine: 'Transformo tu imagen en una herramienta de poder, comunicación y posicionamiento.',
    request: 'Solicitar asesoría', portfolio: 'Ver portafolio',
    manifestoTitle: 'Tu imagen habla antes que tú',
    manifesto: 'Mi trabajo va mucho más allá de elegir prendas. Construyo una presencia capaz de comunicar seguridad, credibilidad y propósito antes de pronunciar una sola palabra.',
    manifestoKicker: 'Manifiesto', selectedWork: 'Portafolio', selectedWorkKicker: 'Trabajo seleccionado', fullPortfolio: 'Portafolio completo', fullPortfolioKicker: 'Todos los proyectos',
    viewProject: 'Ver proyecto', portraitsTitle: 'Detrás del estilo: Argenis', portraitsKicker: 'Presencia · identidad · proceso',
    portraitsCopy: 'Una mirada breve a la persona detrás de cada concepto, producción y transformación de imagen.',
    media: 'Me has visto en', mediaKicker: 'Prensa · televisión · publicaciones', collaborations: 'He trabajado con', collaborationsKicker: 'Clientes y colaboraciones seleccionadas',
    expertise: 'Imagen, marca y creatividad', image: 'Imagen', brand: 'Marca', creative: 'Creatividad',
    imageItems: ['Asesoría de imagen personal', 'Estilismo de moda', 'Imagen masculina', 'Imagen corporativa', 'Colorimetría', 'Compras personales', 'Estilismo nupcial'],
    brandItems: ['Marca personal', 'Proyección profesional', 'Comunicación', 'Estrategia de contenido'],
    creativeItems: ['Producciones fotográficas', 'Campañas', 'Eventos', 'Colaboraciones estratégicas con marcas'],
    certification: 'Formación y certificaciones', certificationCopy: 'Certificado por IBA · Image & Business Academy', viewCredentials: 'Ver credenciales',
    platformTitle: 'Al Estilo de Argenis', platformCopy: 'Una plataforma creada para educar, inspirar y demostrar que la imagen puede convertirse en una poderosa herramienta de transformación personal y profesional.',
    latest: 'Argenis ahora', latestCopy: 'Lo último de @argenisgrullonrd', instagramCta: 'Ver más en Instagram',
    testimonialTitle: 'Lo que deja una buena imagen', testimonialKicker: 'Testimonios',
    videosTitle: 'Argenis en movimiento', videosKicker: 'Videos destacados', videosCopy: 'Color, presencia, estilo y propósito: una selección de contenidos para ver su enfoque en acción.',
    faqTitle: 'Preguntas frecuentes', faqKicker: 'Antes de comenzar', about: 'Detrás del estilo',
    aboutCopy: 'Soy asesor de imagen certificado por IBA, estilista de moda, creador digital y estratega de marca personal. Mi propósito es ayudar a personas, profesionales, artistas y empresas a convertir su imagen en una herramienta de comunicación, presencia y posicionamiento.',
    aboutCopy2: 'Mi enfoque une moda, imagen, comunicación y negocios para construir una presencia auténtica, estratégica y alineada con la esencia y los objetivos de cada cliente.',
    quoteA: 'No solo transformo la manera en que te ves.', quoteB: 'Te ayudo a proyectar el poder de quien realmente eres.',
    contactTitle: 'Cuéntame qué deseas proyectar', contactCopy: 'Comparte algunos detalles sobre tu objetivo, imagen o proyecto.',
    name: 'Nombre y apellido', whatsapp: 'WhatsApp', email: 'Correo electrónico', service: '¿Qué servicio te interesa?', goal: '¿Qué deseas lograr?', date: 'Fecha o plazo del proyecto (opcional)',
    send: 'Enviar solicitud', viaWhatsapp: 'Prefiero escribir por WhatsApp',
    serviceOptions: ['Asesoría de imagen personal', 'Imagen profesional / ejecutiva', 'Estilismo de moda', 'Estilismo para artista / figura pública', 'Marca personal', 'Producción / campaña', 'Evento', 'Colaboración con marca', 'Otro'],
    success: 'Gracias. Tu solicitud está lista para enviar.', noFeed: 'El feed en vivo se activará al conectar la cuenta de Instagram.', viewMore: 'Ver detalle', close: 'Cerrar', languageLabel: 'Cambiar idioma',
    workWithMe: 'Trabaja conmigo', mediaDetail: 'Ver aparición', gallery: 'Galería'
  },
  en: {
    heroEyebrow: 'Santiago · Dominican Republic', heroRole: 'Image Consultant · Fashion Stylist · Personal Brand Strategist',
    heroLine: 'I transform your image into a tool for power, communication and positioning.', request: 'Request a consultation', portfolio: 'View portfolio',
    manifestoTitle: 'Your image speaks before you do', manifesto: 'My work goes far beyond choosing clothes. I build a presence capable of communicating confidence, credibility and purpose before you say a single word.',
    manifestoKicker: 'Manifesto', selectedWork: 'Portfolio', selectedWorkKicker: 'Selected work', fullPortfolio: 'Full portfolio', fullPortfolioKicker: 'All projects', viewProject: 'View project',
    portraitsTitle: 'Behind the style: Argenis', portraitsKicker: 'Presence · identity · process', portraitsCopy: 'A brief look at the person behind each concept, production and image transformation.',
    media: 'As seen in', mediaKicker: 'Press · television · publications', collaborations: 'I have worked with', collaborationsKicker: 'Selected clients and collaborations',
    expertise: 'Image, brand and creativity', image: 'Image', brand: 'Brand', creative: 'Creativity',
    imageItems: ['Personal image consulting', 'Fashion styling', 'Mens image', 'Corporate image', 'Color analysis', 'Personal shopping', 'Bridal styling'],
    brandItems: ['Personal branding', 'Professional presence', 'Communication', 'Content strategy'], creativeItems: ['Photo productions', 'Campaigns', 'Events', 'Strategic brand collaborations'],
    certification: 'Training and certifications', certificationCopy: 'Certified by IBA · Image & Business Academy', viewCredentials: 'View credentials',
    platformTitle: 'Al Estilo de Argenis', platformCopy: 'A platform created to educate, inspire and show how image can become a powerful tool for personal and professional transformation.',
    latest: 'Argenis now', latestCopy: 'Latest from @argenisgrullonrd', instagramCta: 'See more on Instagram',
    testimonialTitle: 'What a strong image leaves behind', testimonialKicker: 'Testimonials', videosTitle: 'Argenis in motion', videosKicker: 'Featured videos',
    videosCopy: 'Color, presence, style and purpose: a selection of content that shows his approach in action.', faqTitle: 'Frequently asked questions', faqKicker: 'Before we begin', about: 'Behind the style',
    aboutCopy: 'I am an IBA-certified image consultant, fashion stylist, digital creator and personal brand strategist. My purpose is to help people, professionals, artists and companies turn their image into a tool for communication, presence and positioning.',
    aboutCopy2: 'My approach combines fashion, image, communication and business to build an authentic, strategic presence aligned with each client’s essence and goals.',
    quoteA: 'I do not only transform the way you look.', quoteB: 'I help you project the power of who you truly are.',
    contactTitle: 'Tell me what you want to project', contactCopy: 'Share a few details about your goals, image or project.', name: 'Full name', whatsapp: 'WhatsApp', email: 'Email',
    service: 'Which service are you interested in?', goal: 'What would you like to achieve?', date: 'Project date or timeline (optional)', send: 'Send request', viaWhatsapp: 'I prefer WhatsApp',
    serviceOptions: ['Personal image consulting', 'Professional / executive image', 'Fashion styling', 'Artist / public figure styling', 'Personal branding', 'Production / campaign', 'Event', 'Brand collaboration', 'Other'],
    success: 'Thank you. Your request is ready to send.', noFeed: 'The live feed will activate once the Instagram account is connected.', viewMore: 'View details', close: 'Close', languageLabel: 'Change language',
    workWithMe: 'Work with me', mediaDetail: 'View appearance', gallery: 'Gallery'
  }
}

const PROJECTS: Project[] = [
  { id: 'beauty-fragrance', title: { es: 'Belleza y fragancia', en: 'Beauty & Fragrance' }, category: { es: 'Estilismo editorial', en: 'Editorial Styling' }, cover: '/assets/adonisg/portfolio/beauty-fragrance/beauty-cover.webp', images: ['/assets/adonisg/portfolio/beauty-fragrance/beauty-cover.webp', '/assets/adonisg/portfolio/beauty-fragrance/beauty-02.webp', '/assets/adonisg/portfolio/beauty-fragrance/beauty-03.webp', '/assets/adonisg/portfolio/beauty-fragrance/beauty-04.webp', '/assets/adonisg/portfolio/beauty-fragrance/beauty-05.webp'], description: { es: 'Producción editorial centrada en belleza, fragancia, accesorios y una narrativa visual cuidada. El trabajo conecta styling, composición y presencia para convertir cada detalle en parte del concepto.', en: 'An editorial production focused on beauty, fragrance, accessories and refined visual storytelling. Styling, composition and presence work together so every detail supports the concept.' } },
  { id: 'red-statement', title: { es: 'Declaración en rojo', en: 'Red Statement' }, category: { es: 'Editorial de moda', en: 'Fashion Editorial' }, cover: '/assets/adonisg/portfolio/red-statement/red-cover.webp', images: ['/assets/adonisg/portfolio/red-statement/red-cover.webp', '/assets/adonisg/portfolio/red-statement/red-02.webp', '/assets/adonisg/portfolio/red-statement/red-03.webp', '/assets/adonisg/portfolio/red-statement/red-04.webp', '/assets/adonisg/portfolio/red-statement/red-05.webp'], description: { es: 'Una misma producción unificada por color, silueta y actitud. El rojo funciona como lenguaje visual y el styling construye una presencia fuerte, elegante y memorable.', en: 'One production unified by color, silhouette and attitude. Red becomes the visual language while styling builds a strong, elegant and memorable presence.' } },
  { id: 'noir', title: { es: 'Noir', en: 'Noir' }, category: { es: 'Editorial de moda', en: 'Fashion Editorial' }, cover: '/assets/adonisg/portfolio/noir/noir-cover.webp', images: ['/assets/adonisg/portfolio/noir/noir-cover.webp', '/assets/adonisg/portfolio/noir/noir-02.webp', '/assets/adonisg/portfolio/noir/noir-03.webp', '/assets/adonisg/portfolio/noir/noir-04.webp'], description: { es: 'Una narrativa oscura y elegante enfocada en presencia, volumen, accesorios y detalle. El resultado equilibra dramatismo con sofisticación.', en: 'A dark, elegant narrative focused on presence, volume, accessories and detail. The result balances drama with sophistication.' } },
  { id: 'couple', title: { es: 'Pareja y estilo de vida', en: 'Couple Lifestyle' }, category: { es: 'Estilismo de estilo de vida', en: 'Lifestyle Styling' }, cover: '/assets/adonisg/portfolio/couple-lifestyle/couple-cover.webp', images: ['/assets/adonisg/portfolio/couple-lifestyle/couple-cover.webp', '/assets/adonisg/portfolio/couple-lifestyle/couple-02.webp', '/assets/adonisg/portfolio/couple-lifestyle/couple-03.webp', '/assets/adonisg/portfolio/couple-lifestyle/couple-04.webp'], description: { es: 'Una historia visual construida desde la armonía entre dos personas, el entorno y el vestuario. El styling acompaña la conexión sin competir con ella.', en: 'A visual story built around harmony between two people, their setting and wardrobe. Styling supports the connection without competing with it.' } },
  { id: 'evening', title: { es: 'Presencia de noche', en: 'Evening Statement' }, category: { es: 'Estilismo de gala', en: 'Evening Styling' }, cover: '/assets/adonisg/portfolio/evening/evening-cover.webp', images: ['/assets/adonisg/portfolio/evening/evening-cover.webp', '/assets/adonisg/portfolio/evening/evening-02.webp', '/assets/adonisg/portfolio/evening/evening-03.webp', '/assets/adonisg/portfolio/evening/evening-04.webp', '/assets/adonisg/portfolio/evening/evening-05.webp'], description: { es: 'Un look refinado construido para impacto, seguridad y ocasión. La silueta, el color y los accesorios trabajan juntos para elevar la presencia.', en: 'A refined look built for impact, confidence and occasion. Silhouette, color and accessories work together to elevate presence.' } },
  { id: 'mens-brand', title: { es: 'Imagen masculina y marca personal', en: 'Mens Image & Personal Brand' }, category: { es: 'Marca personal', en: 'Personal Branding' }, cover: '/assets/adonisg/portfolio/mens-brand/mens-cover.webp', images: ['/assets/adonisg/portfolio/mens-brand/mens-cover.webp', '/assets/adonisg/portfolio/mens-brand/mens-02.webp', '/assets/adonisg/portfolio/mens-brand/mens-03.webp', '/assets/adonisg/portfolio/mens-brand/mens-04.webp'], description: { es: 'Estilismo masculino orientado a presencia, coherencia y posicionamiento. La imagen se trabaja como parte de la comunicación personal.', en: 'Mens styling focused on presence, coherence and positioning. Image is developed as part of personal communication.' } }
]

const MEDIA: MediaItem[] = [
  { name: 'DMH Magazine', title: { es: 'Historia de esfuerzo e inspiración · “Lo Que No Te Cuentan del Éxito”', en: 'A story of effort and inspiration · “Lo Que No Te Cuentan del Éxito”' }, image: '/assets/adonisg/media/dlb-dmh-exito.webp' },
  { name: 'Buena Noche · Cachicha', title: { es: 'Entrevista sobre moda, estilo de vida y trayectoria emprendedora', en: 'Interview about fashion, lifestyle and his entrepreneurial journey' }, image: '/assets/adonisg/media/bazar-emprendedores.webp' },
  { name: 'Diario Libre', title: { es: 'Participación en el audiovisual “Bajo la lluvia” de Daniel Santacruz', en: 'Appearance in Daniel Santacruz’s “Bajo la lluvia” music video' }, image: '/assets/adonisg/media/la-vitrina.webp' },
  { name: 'La Vitrina · Moda & Belleza', title: { es: 'Editorial de moda y belleza', en: 'Fashion and beauty editorial' }, image: '/assets/adonisg/media/la-vitrina.webp' },
  { name: 'El Janis', title: { es: 'Crédito como asesor de imagen en editorial de moda', en: 'Image consultant credit in fashion editorial' }, image: '/assets/adonisg/media/el-janis.webp' }
]

const FAQS: FaqItem[] = [
  { q: { es: '¿En qué consiste una asesoría de imagen?', en: 'What does an image consultation involve?' }, a: { es: 'No se trata solo de ropa. Es un proceso para descubrir cómo proyectar tu esencia con intención, seguridad y estilo, conectando tu imagen con lo que deseas comunicar.', en: 'It is not only about clothes. It is a process to discover how to project your essence with intention, confidence and style, connecting your image with what you want to communicate.' } },
  { q: { es: '¿Qué incluye el servicio?', en: 'What is included in the service?' }, a: { es: 'Según el objetivo, puede incluir análisis de colorimetría, estudio de silueta y rostro, definición de estilo personal, revisión de guardarropa, guía de compras inteligentes y recomendaciones de proyección y actitud.', en: 'Depending on the goal, it may include color analysis, body and face assessment, personal style definition, wardrobe review, smart-shopping guidance and recommendations for presence and attitude.' } },
  { q: { es: '¿La asesoría incluye acompañamiento de compras?', en: 'Can the consultation include personal shopping?' }, a: { es: 'Sí, si así lo deseas. Puede realizarse de forma presencial acompañándote en tiendas o de manera virtual con opciones, enlaces y sugerencias ajustadas a tu perfil, ubicación y presupuesto.', en: 'Yes, if you want it. It can be done in person while shopping together or virtually with options, links and suggestions tailored to your profile, location and budget.' } },
  { q: { es: '¿Cuánto dura la asesoría?', en: 'How long does a consultation take?' }, a: { es: 'Una asesoría puede durar entre 1 y 2 horas, dependiendo del tipo de servicio y de los objetivos definidos para la sesión.', en: 'A consultation may last between 1 and 2 hours, depending on the service and the goals defined for the session.' } },
  { q: { es: '¿Trabajas con hombres y mujeres?', en: 'Do you work with men and women?' }, a: { es: 'Sí. Cada proceso se construye alrededor de la persona, su contexto, su estilo de vida y lo que necesita proyectar.', en: 'Yes. Each process is built around the person, their context, lifestyle and what they need to project.' } },
  { q: { es: '¿Las asesorías pueden ser virtuales o presenciales?', en: 'Can consultations be virtual or in person?' }, a: { es: 'Sí. La modalidad se define según el servicio. Algunas sesiones pueden realizarse virtualmente y otras de manera presencial en Santiago o según coordinación previa.', en: 'Yes. The format depends on the service. Some sessions can be virtual and others in person in Santiago or by prior arrangement.' } }
]

const TESTIMONIALS: TestimonialItem[] = [
  { quote: { es: '“Gracias por cuidar cada detalle y hacer que todo se vea con intención y elegancia.”', en: '“Thank you for caring for every detail and making everything look intentional and elegant.”' }, by: { es: 'Dr. Hugo María', en: 'Dr. Hugo María' } },
  { quote: { es: '“La diferencia no fue solo cómo me veía, sino cómo empecé a presentarme.”', en: '“The difference was not only how I looked, but how I started presenting myself.”' }, by: { es: 'Testimonio de muestra', en: 'Sample testimonial' }, note: { es: 'Contenido temporal para definir estilo visual', en: 'Temporary content to define visual style' } },
  { quote: { es: '“Sentí que por fin mi imagen decía lo mismo que yo quería comunicar.”', en: '“I finally felt my image was saying what I wanted to communicate.”' }, by: { es: 'Testimonio de muestra', en: 'Sample testimonial' }, note: { es: 'Contenido temporal para definir estilo visual', en: 'Temporary content to define visual style' } }
]

const PORTRAITS = Array.from({ length: 6 }, (_, i) => `/assets/adonisg/portraits/argenis-${String(i + 1).padStart(2, '0')}.webp`)
const HERO_SLIDES = Array.from({ length: 5 }, (_, i) => `/assets/adonisg/hero/slide-${String(i + 1).padStart(2, '0')}.webp`)
const CERTS = Array.from({ length: 5 }, (_, i) => `/assets/adonisg/certifications/cert-${String(i + 1).padStart(2, '0')}.webp`)
const VIDEOS = ['/assets/adonisg/videos/video-01.mp4', '/assets/adonisg/videos/video-02.mp4', '/assets/adonisg/videos/video-03.mp4']

function parseJson<T>(raw: string | undefined, fallback: T): T { if (!raw) return fallback; try { return JSON.parse(raw) as T } catch { return fallback } }
function cleanPhone(value: string) { return value.replace(/\D/g, '') }
function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setVisible(true); return }
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } }, { threshold: .1 })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return <div ref={ref} className={`adonis-reveal ${visible ? 'is-visible' : ''} ${className}`}>{children}</div>
}
function ModalShell({ children, onClose, label }: { children: ReactNode; onClose: () => void; label: string }) {
  useEffect(() => { const old = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = old } }, [])
  return <div className="adonis-modal-backdrop" role="dialog" aria-modal="true" aria-label={label} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}><div className="adonis-modal"><button className="adonis-modal-close" onClick={onClose} aria-label={label}><FaTimes /></button>{children}</div></div>
}

export default function IntapProfileAdonisgV1({ profile }: { profile: IntapProfileV2Profile }) {
  const td = profile.templateData ?? {}
  const policy = resolveProfileLanguagePolicy(td, { defaultLanguage: 'es', enabled: ['es', 'en'] })
  const [language, setLanguage] = useState<ProfileLanguageCode>(() => typeof window === 'undefined' ? policy.defaultLanguage : resolveRequestedProfileLanguage(window.location.search, policy))
  const t = COPY[language]
  const [activeProject, setActiveProject] = useState<Project | null>(null)
  const [galleryIndex, setGalleryIndex] = useState(0)
  const [portraitOpen, setPortraitOpen] = useState(false)
  const [portraitIndex, setPortraitIndex] = useState(0)
  const [activeMedia, setActiveMedia] = useState<MediaItem | null>(null)
  const [contactOpen, setContactOpen] = useState(false)
  const [certOpen, setCertOpen] = useState(false)
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [feedReady, setFeedReady] = useState(false)
  const [sent, setSent] = useState(false)
  const [heroSlide, setHeroSlide] = useState(0)
  const [activeVideo, setActiveVideo] = useState<number | null>(null)
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([])

  const displayName = profile.name || 'Argenis Grullón'
  const whatsapp = profile.whatsapp || profile.whatsappNumber || profile.whatsapp_number || td.whatsapp || '18293024095'
  const email = profile.email || td.email || ''
  const instagram = td.instagram_url || 'https://www.instagram.com/argenisgrullonrd/'
  const collaborations = useMemo(() => parseJson<Collaboration[]>(td.collaborations_json, []), [td.collaborations_json])
  const extraMedia = useMemo(() => parseJson<MediaItem[]>(td.media_mentions_json, []), [td.media_mentions_json])
  const media = [...MEDIA, ...extraMedia]

  useEffect(() => { const params = new URLSearchParams(window.location.search); if (language === policy.defaultLanguage) params.delete('lang'); else params.set('lang', language); const query = params.toString(); history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`) }, [language, policy.defaultLanguage])
  useEffect(() => { const id = window.setInterval(() => setHeroSlide(v => (v + 1) % HERO_SLIDES.length), 4300); return () => window.clearInterval(id) }, [])
  useEffect(() => {
    const origin = (import.meta.env.VITE_PUBLIC_ORIGIN || window.location.origin).replace(/\/$/, '')
    const canonical = `${origin}/adonisg${language === 'en' ? '?lang=en' : ''}`
    const title = language === 'en' ? 'Argenis Grullón | Image Consultant & Fashion Stylist' : 'Argenis Grullón | Asesor de Imagen y Estilista de Moda'
    const description = language === 'en' ? 'IBA-certified image consultant, fashion stylist, digital creator and personal brand strategist in Santiago, Dominican Republic.' : 'Asesor de imagen certificado por IBA, estilista de moda, creador digital y estratega de marca personal en Santiago, República Dominicana.'
    document.title = title
    const meta = (key: string, value: string, property = false) => { const selector = `meta[${property ? 'property' : 'name'}="${key}"]`; let el = document.head.querySelector<HTMLMetaElement>(selector); if (!el) { el = document.createElement('meta'); el.setAttribute(property ? 'property' : 'name', key); document.head.appendChild(el) } el.content = value }
    let canonicalEl = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]'); if (!canonicalEl) { canonicalEl = document.createElement('link'); canonicalEl.rel = 'canonical'; document.head.appendChild(canonicalEl) }
    canonicalEl.href = canonical
    meta('description', description); meta('og:title', title, true); meta('og:description', description, true); meta('og:type', 'profile', true); meta('og:url', canonical, true); meta('og:image', `${origin}/assets/adonisg/og/adonisg-og.jpg`, true); meta('twitter:card', 'summary_large_image'); meta('twitter:title', title); meta('twitter:description', description); meta('twitter:image', `${origin}/assets/adonisg/og/adonisg-og.jpg`)
    document.documentElement.lang = language === 'en' ? 'en' : 'es'
  }, [language])
  useEffect(() => { const endpoint = td.instagram_feed_endpoint; if (!endpoint) { setFeedReady(true); return } fetch(endpoint, { headers: { Accept: 'application/json' } }).then(r => r.ok ? r.json() : Promise.reject()).then((json) => { const items = Array.isArray(json?.items) ? json.items : Array.isArray(json?.data) ? json.data : []; setFeed(items.slice(0, 7)); setFeedReady(true) }).catch(() => setFeedReady(true)) }, [td.instagram_feed_endpoint])

  const openWhatsApp = (message: string) => { const phone = cleanPhone(whatsapp); if (!phone) return false; window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer'); return true }
  const projectWhatsApp = (project: Project) => openWhatsApp(language === 'en' ? `Hello Argenis, I would like to work with you. I was viewing the project “${project.title.en}” on your portfolio and would like information about a similar service.` : `Hola Argenis, me gustaría trabajar contigo. Estaba viendo el proyecto “${project.title.es}” en tu portafolio y quisiera información sobre un servicio similar.`)
  const handleContact = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const fd = new FormData(event.currentTarget); const subject = language === 'en' ? 'Consultation request' : 'Solicitud de asesoría'; const message = [subject, `Nombre: ${fd.get('name')}`, `WhatsApp: ${fd.get('phone')}`, `Email: ${fd.get('email')}`, `Servicio: ${fd.get('service')}`, `Objetivo: ${fd.get('goal')}`, `Fecha/plazo: ${fd.get('date') || '-'}`].join('\n'); setSent(true); if (!openWhatsApp(message) && email) window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}` }
  const openProject = (project: Project) => { setGalleryIndex(0); setActiveProject(project) }
  const stepProject = (delta: number) => { if (!activeProject) return; setGalleryIndex(v => (v + delta + activeProject.images.length) % activeProject.images.length) }
  const stepPortrait = (delta: number) => setPortraitIndex(v => (v + delta + PORTRAITS.length) % PORTRAITS.length)
  const playVideo = (index: number) => { videoRefs.current.forEach((video, i) => { if (video && i !== index) video.pause() }); const target = videoRefs.current[index]; if (target) { target.play(); setActiveVideo(index) } }

  return <main className="adonis-profile">
    <header className="adonis-hero">
      <div className="adonis-hero-slides" aria-label={language === 'es' ? 'Estilos de Argenis Grullón' : 'Argenis Grullón styles'}>
        {HERO_SLIDES.map((src, i) => <img key={src} className={i === heroSlide ? 'is-active' : ''} src={src} alt={`${displayName} ${i + 1}`} fetchPriority={i === 0 ? 'high' : undefined} />)}
      </div>
      <div className="adonis-hero-shade" />
      <nav className="adonis-topbar">
        <span className="adonis-top-logo-wrap"><img src="/assets/adonisg/brand/top-logo.webp" alt="Al Estilo de Argenis" className="adonis-mark" /></span>
        <button className="adonis-language" aria-label={t.languageLabel} onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}><FaGlobeAmericas /><span>{language === 'es' ? 'English' : 'Español'}</span></button>
      </nav>
      <div className="adonis-hero-content"><p className="adonis-eyebrow">{t.heroEyebrow}</p><h1>ARGENIS<br />GRULLÓN</h1><p className="adonis-role">{t.heroRole}</p><p className="adonis-hero-line">{t.heroLine}</p><div className="adonis-hero-actions"><button className="adonis-btn adonis-btn-light" onClick={() => setContactOpen(true)}>{t.request}</button><a className="adonis-btn adonis-btn-ghost" href="#portfolio">{t.portfolio}</a></div></div>
      <div className="adonis-hero-dots">{HERO_SLIDES.map((_, i) => <button key={i} className={i === heroSlide ? 'is-active' : ''} onClick={() => setHeroSlide(i)} aria-label={`Slide ${i + 1}`} />)}</div>
    </header>

    <section className="adonis-manifesto"><Reveal><p className="adonis-section-kicker">01 · {t.manifestoKicker}</p><h2>{t.manifestoTitle}</h2><p>{t.manifesto}</p><div className="adonis-disciplines">{(language === 'es' ? ['Colorimetría', 'Morfología', 'Visagismo', 'Estilismo', 'Análisis de estilo', 'Protocolo', 'Proyección profesional'] : ['Color analysis', 'Body morphology', 'Visagism', 'Styling', 'Style analysis', 'Protocol', 'Professional presence']).map(v => <span key={v}>{v}</span>)}</div></Reveal></section>

    <section className="adonis-section adonis-work" id="portfolio"><Reveal><p className="adonis-section-kicker">02 · {t.selectedWorkKicker}</p><h2>{t.selectedWork}</h2></Reveal><div className="adonis-featured-projects">{PROJECTS.slice(0, 3).map((project, i) => <Reveal key={project.id} className="adonis-project-card"><button onClick={() => openProject(project)}><div className="adonis-project-media"><img src={project.cover} alt={project.title[language]} loading="lazy" /><span className="adonis-project-number">0{i + 1}</span></div><div className="adonis-project-copy"><p>{project.category[language]}</p><h3>{project.title[language]}</h3><p className="adonis-project-description">{project.description[language]}</p><span>{t.viewProject} <FaArrowRight /></span></div></button></Reveal>)}</div></section>

    <section className="adonis-full-portfolio"><Reveal><p className="adonis-section-kicker">03 · {t.fullPortfolioKicker}</p><h2>{t.fullPortfolio}</h2><p className="adonis-section-intro">{language === 'es' ? 'Explora los trabajos por concepto. Cada portada abre su galería completa con contexto, detalles y una vía directa para trabajar un proyecto similar.' : 'Explore work by concept. Each cover opens its complete gallery with context, details and a direct way to start a similar project.'}</p></Reveal><div className="adonis-full-track">{PROJECTS.map(project => <article key={project.id} className="adonis-full-card"><button onClick={() => openProject(project)}><img src={project.cover} alt={project.title[language]} loading="lazy" /><div><small>{project.category[language]}</small><h3>{project.title[language]}</h3><p>{project.description[language]}</p><span>{t.viewProject} <FaArrowRight /></span></div></button></article>)}</div></section>

    <section className="adonis-personal-feature"><Reveal><p className="adonis-section-kicker">04 · {t.portraitsKicker}</p><h2>{t.portraitsTitle}</h2></Reveal><button className="adonis-personal-card" onClick={() => { setPortraitIndex(0); setPortraitOpen(true) }}><img src={PORTRAITS[0]} alt={displayName} loading="lazy" /><div><p>{t.portraitsCopy}</p><span>{t.gallery} <FaArrowRight /></span></div></button></section>

    <section className="adonis-section adonis-media-section"><Reveal><p className="adonis-section-kicker">05 · {t.mediaKicker}</p><h2>{t.media}</h2></Reveal><div className="adonis-media-track">{media.map((item, i) => <article className="adonis-media-card" key={`${item.name}-${i}`}><button onClick={() => setActiveMedia(item)}><img src={item.image} alt={item.name} loading="lazy" /><div><p>{item.name}</p><h3>{item.title[language]}</h3><span>{t.mediaDetail} <FaArrowRight /></span></div></button></article>)}</div></section>

    <section className="adonis-collab"><Reveal><p className="adonis-section-kicker">06 · {t.collaborationsKicker}</p><h2>{t.collaborations}</h2></Reveal>{collaborations.length > 0 ? <div className="adonis-collab-list">{collaborations.map((item, i) => <div key={`${item.name}-${i}`} className="adonis-collab-item"><span>{String(i + 1).padStart(2, '0')}</span><strong>{item.name}</strong></div>)}</div> : <p className="adonis-collab-fallback">{language === 'es' ? 'Figuras públicas · Artistas · Influencers · Marcas · Empresas · Producciones' : 'Public figures · Artists · Influencers · Brands · Companies · Productions'}</p>}</section>

    <section className="adonis-expertise"><Reveal><p className="adonis-section-kicker">07 · {language === 'es' ? 'Áreas de trabajo' : 'Expertise'}</p><h2>{t.expertise}</h2></Reveal><div className="adonis-expertise-track">{[[t.image, t.imageItems], [t.brand, t.brandItems], [t.creative, t.creativeItems]].map(([title, items], i) => <article key={title as string}><span>0{i + 1}</span><h3>{title as string}</h3><ul>{(items as string[]).map(item => <li key={item}>{item}</li>)}</ul></article>)}</div></section>

    <section className="adonis-testimonials"><Reveal><p className="adonis-section-kicker">08 · {t.testimonialKicker}</p><h2>{t.testimonialTitle}</h2></Reveal><div className="adonis-testimonial-track">{TESTIMONIALS.map((item, i) => <article key={i}><span className="adonis-quote-mark">“</span><blockquote>{item.quote[language]}</blockquote><strong>{item.by[language]}</strong>{item.note && <small>{item.note[language]}</small>}</article>)}</div></section>

    <section className="adonis-cert"><Reveal><p className="adonis-section-kicker">09 · IBA</p><h2>{t.certification}</h2><p>{t.certificationCopy}</p><button className="adonis-text-btn" onClick={() => setCertOpen(true)}>{t.viewCredentials} <FaArrowRight /></button></Reveal></section>

    <section className="adonis-platform"><img className="adonis-platform-logo" src="/assets/adonisg/brand/logo-white.png" alt="Al Estilo de Argenis" loading="lazy" /><Reveal><h2>{t.platformTitle}</h2><p>{t.platformCopy}</p></Reveal></section>

    <section className="adonis-section adonis-videos"><Reveal><p className="adonis-section-kicker">10 · {t.videosKicker}</p><h2>{t.videosTitle}</h2><p>{t.videosCopy}</p></Reveal><div className="adonis-video-track">{VIDEOS.map((src, i) => <article key={src}><div className="adonis-video-shell"><video ref={node => { videoRefs.current[i] = node }} preload="metadata" playsInline controls={activeVideo === i} poster={PORTRAITS[(i + 1) % PORTRAITS.length]} onPlay={() => { videoRefs.current.forEach((video, idx) => { if (video && idx !== i) video.pause() }); setActiveVideo(i) }} onPause={() => setActiveVideo(v => v === i ? null : v)} onEnded={() => setActiveVideo(null)}><source src={src} type="video/mp4" /></video>{activeVideo !== i && <button className="adonis-video-play" onClick={() => playVideo(i)} aria-label={`${t.videosTitle} ${i + 1}`}><FaPlay /></button>}<span className="adonis-video-count">{String(i + 1).padStart(2, '0')}</span></div></article>)}</div></section>

    <section className="adonis-section adonis-instagram"><Reveal><p className="adonis-section-kicker">11 · Instagram</p><h2>{t.latest}</h2><p>{t.latestCopy}</p></Reveal>{feed.length > 0 ? <div className="adonis-feed-grid">{feed.map((item, i) => <a key={item.id || i} href={item.permalink || instagram} target="_blank" rel="noopener noreferrer" className={i === 0 ? 'is-featured' : ''}><img src={item.thumbnail_url || item.media_url} alt={item.caption || 'Instagram'} loading="lazy" /></a>)}</div> : feedReady && <div className="adonis-feed-empty"><FaInstagram /><p>{t.noFeed}</p></div>}<a className="adonis-text-btn" href={instagram} target="_blank" rel="noopener noreferrer">{t.instagramCta} <FaArrowRight /></a></section>

    <section className="adonis-about"><Reveal><p className="adonis-section-kicker">12 · {t.about}</p><h2>{displayName}</h2><p>{t.aboutCopy}</p><p>{t.aboutCopy2}</p><div className="adonis-about-facts"><span>IBA</span><span>CEO · Al Estilo de Argenis</span><span>Santiago · RD</span></div></Reveal></section>

    <section className="adonis-faq"><Reveal><p className="adonis-section-kicker">13 · {t.faqKicker}</p><h2>{t.faqTitle}</h2></Reveal><div className="adonis-faq-list">{FAQS.map((item, i) => <details key={i}><summary>{item.q[language]}<span>+</span></summary><p>{item.a[language]}</p></details>)}</div></section>

    <section className="adonis-quote"><div className="adonis-quote-bg" /><div className="adonis-quote-overlay" /><Reveal><p>{t.quoteA}</p><strong>{t.quoteB}</strong><span>— Argenis Grullón</span></Reveal></section>

    <section className="adonis-contact-cta"><p>ARGENIS GRULLÓN</p><h2>{t.contactTitle}</h2><button className="adonis-btn adonis-btn-light" onClick={() => setContactOpen(true)}>{t.request}</button><button className="adonis-contact-whatsapp" onClick={() => openWhatsApp(language === 'en' ? 'Hello Argenis, I would like information about your image consulting services.' : 'Hola Argenis, quisiera información sobre tus servicios de asesoría de imagen.')}><FaWhatsapp /> WhatsApp</button><a href={instagram} target="_blank" rel="noopener noreferrer"><FaInstagram /> @argenisgrullonrd</a></section>
    <footer className="adonis-brand-footer"><img src="/assets/adonisg/brand/linkedin-banner.jpg" alt="Al Estilo de Argenis" loading="lazy" /></footer>

    {activeProject && <ModalShell label={activeProject.title[language]} onClose={() => setActiveProject(null)}><div className="adonis-project-modal"><p className="adonis-section-kicker">{activeProject.category[language]}</p><h2>{activeProject.title[language]}</h2><p>{activeProject.description[language]}</p><div className="adonis-gallery-stage"><img src={activeProject.images[galleryIndex]} alt={`${activeProject.title[language]} ${galleryIndex + 1}`} /><button className="adonis-gallery-prev" onClick={() => stepProject(-1)} aria-label="Previous"><FaArrowLeft /></button><button className="adonis-gallery-next" onClick={() => stepProject(1)} aria-label="Next"><FaArrowRight /></button><span>{galleryIndex + 1} / {activeProject.images.length}</span></div><div className="adonis-gallery-thumbs">{activeProject.images.map((src, i) => <button key={src} className={i === galleryIndex ? 'is-active' : ''} onClick={() => setGalleryIndex(i)}><img src={src} alt="" loading="lazy" /></button>)}</div><button className="adonis-btn adonis-btn-dark" onClick={() => projectWhatsApp(activeProject)}><FaWhatsapp /> {t.workWithMe}</button></div></ModalShell>}

    {portraitOpen && <ModalShell label={t.portraitsTitle} onClose={() => setPortraitOpen(false)}><div className="adonis-project-modal"><p className="adonis-section-kicker">{t.portraitsKicker}</p><h2>{t.portraitsTitle}</h2><p>{t.portraitsCopy}</p><div className="adonis-gallery-stage"><img src={PORTRAITS[portraitIndex]} alt={`${displayName} ${portraitIndex + 1}`} /><button className="adonis-gallery-prev" onClick={() => stepPortrait(-1)} aria-label="Previous"><FaArrowLeft /></button><button className="adonis-gallery-next" onClick={() => stepPortrait(1)} aria-label="Next"><FaArrowRight /></button><span>{portraitIndex + 1} / {PORTRAITS.length}</span></div><div className="adonis-gallery-thumbs">{PORTRAITS.map((src, i) => <button key={src} className={i === portraitIndex ? 'is-active' : ''} onClick={() => setPortraitIndex(i)}><img src={src} alt="" loading="lazy" /></button>)}</div><button className="adonis-btn adonis-btn-dark" onClick={() => openWhatsApp(language === 'en' ? 'Hello Argenis, I viewed your personal gallery and would like to learn more about working with you.' : 'Hola Argenis, vi tu galería personal y me gustaría conocer más sobre cómo trabajar contigo.')}><FaWhatsapp /> {t.workWithMe}</button></div></ModalShell>}

    {activeMedia && <ModalShell label={activeMedia.name} onClose={() => setActiveMedia(null)}><div className="adonis-media-modal"><img src={activeMedia.image} alt={activeMedia.name} /><p className="adonis-section-kicker">{activeMedia.name}</p><h2>{activeMedia.title[language]}</h2><p>{language === 'es' ? 'Aparición incorporada al archivo editorial de Argenis. La experiencia se mantiene dentro del perfil para no interrumpir la navegación.' : 'Appearance included in Argenis’ editorial archive. The experience stays inside the profile so navigation is not interrupted.'}</p></div></ModalShell>}

    {certOpen && <ModalShell label={t.certification} onClose={() => setCertOpen(false)}><div className="adonis-cert-modal"><p className="adonis-section-kicker">IBA</p><h2>{t.certification}</h2><div>{CERTS.map((src, i) => <img src={src} alt={`${t.certification} ${i + 1}`} loading="lazy" key={src} />)}</div></div></ModalShell>}

    {contactOpen && <ModalShell label={t.contactTitle} onClose={() => { setContactOpen(false); setSent(false) }}><form className="adonis-contact-form" onSubmit={handleContact}><p className="adonis-section-kicker">{language === 'es' ? 'TRABAJA CON ARGENIS' : 'WORK WITH ARGENIS'}</p><h2>{t.contactTitle}</h2><p>{t.contactCopy}</p><label>{t.name}<input name="name" required autoComplete="name" /></label><div className="adonis-form-row"><label>{t.whatsapp}<input name="phone" required inputMode="tel" autoComplete="tel" /></label><label>{t.email}<input name="email" type="email" autoComplete="email" /></label></div><label>{t.service}<select name="service" required defaultValue=""><option value="" disabled>—</option>{t.serviceOptions.map(item => <option value={item} key={item}>{item}</option>)}</select></label><label>{t.goal}<textarea name="goal" required rows={4} /></label><label>{t.date}<input name="date" /></label>{sent && <p className="adonis-form-success">{t.success}</p>}<button className="adonis-btn adonis-btn-dark" type="submit">{t.send}</button><button type="button" className="adonis-whatsapp-btn" onClick={() => openWhatsApp(language === 'en' ? 'Hello Argenis, I would like information about an image consultation.' : 'Hola Argenis, me interesa recibir información sobre una asesoría de imagen.')}><FaWhatsapp /> {t.viaWhatsapp}</button>{email && <a className="adonis-email-link" href={`mailto:${email}`}><FaEnvelope /> {email}</a>}</form></ModalShell>}
  </main>
}
