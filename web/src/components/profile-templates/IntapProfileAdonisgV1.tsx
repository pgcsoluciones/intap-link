import { FormEvent, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { FaArrowRight, FaEnvelope, FaGlobeAmericas, FaInstagram, FaPlay, FaTimes, FaWhatsapp } from 'react-icons/fa'
import type { IntapProfileV2Profile } from './IntapProfileV2'
import { resolveProfileLanguagePolicy, resolveRequestedProfileLanguage, type ProfileLanguageCode } from './profileLanguages'
import './IntapProfileAdonisgV1.css'

type Localized = { es: string; en: string }
type Project = { id:string; title:Localized; category:Localized; cover:string; images:string[]; description:Localized }
type MediaItem = { name:string; title:Localized; image:string; url?:string }
type Collaboration = { name:string; role?:string; image?:string; url?:string }
type FeedItem = { id:string; media_url?:string; thumbnail_url?:string; permalink?:string; caption?:string; media_type?:string }
type FaqItem = { q:Localized; a:Localized }

type Copy = {
  heroEyebrow:string; heroRole:string; heroLine:string; request:string; portfolio:string; manifestoTitle:string; manifesto:string;
  manifestoKicker:string; selectedWork:string; selectedWorkKicker:string; viewProject:string; portraitsTitle:string; portraitsKicker:string;
  media:string; mediaKicker:string; collaborations:string; collaborationsKicker:string; expertise:string; image:string; brand:string; creative:string;
  imageItems:string[]; brandItems:string[]; creativeItems:string[]; certification:string; certificationCopy:string; viewCredentials:string;
  platformTitle:string; platformCopy:string; latest:string; latestCopy:string; instagramCta:string; testimonialTitle:string; testimonialKicker:string;
  testimonialQuote:string; testimonialBy:string; videosTitle:string; videosKicker:string; videosCopy:string; faqTitle:string; faqKicker:string;
  about:string; aboutCopy:string; aboutCopy2:string; quoteA:string; quoteB:string; contactTitle:string; contactCopy:string;
  name:string; whatsapp:string; email:string; service:string; goal:string; date:string; send:string; viaWhatsapp:string; serviceOptions:string[];
  success:string; noFeed:string; viewMore:string; close:string; languageLabel:string;
}

const COPY:Record<ProfileLanguageCode,Copy> = {
  es:{
    heroEyebrow:'Santiago · República Dominicana', heroRole:'Asesor de Imagen · Estilista de Moda · Estratega de Marca',
    heroLine:'Transformo tu imagen en una herramienta de poder, comunicación y posicionamiento.', request:'Solicitar asesoría', portfolio:'Ver portafolio',
    manifestoTitle:'Tu imagen habla antes que tú', manifesto:'Mi trabajo va mucho más allá de elegir prendas. Construyo una presencia capaz de comunicar seguridad, credibilidad y propósito antes de pronunciar una sola palabra.', manifestoKicker:'Manifiesto',
    selectedWork:'Portafolio destacado', selectedWorkKicker:'Proyectos seleccionados', viewProject:'Ver proyecto', portraitsTitle:'Argenis, en primera persona', portraitsKicker:'Estilo · presencia · identidad',
    media:'Me has visto en', mediaKicker:'Prensa · televisión · publicaciones', collaborations:'He trabajado con', collaborationsKicker:'Clientes y colaboraciones seleccionadas',
    expertise:'Mi trabajo conecta imagen, marca y creatividad', image:'IMAGEN', brand:'MARCA', creative:'CREATIVIDAD',
    imageItems:['Asesoría de imagen personal','Estilismo de moda','Imagen masculina','Imagen corporativa','Colorimetría','Compras personales','Estilismo nupcial'],
    brandItems:['Marca personal','Proyección profesional','Comunicación','Estrategia de contenido'], creativeItems:['Producciones fotográficas','Campañas','Eventos','Colaboraciones estratégicas con marcas'],
    certification:'Formación y certificaciones', certificationCopy:'Certificado por IBA · Image & Business Academy', viewCredentials:'Ver credenciales',
    platformTitle:'Al Estilo de Argenis', platformCopy:'Una plataforma creada para educar, inspirar y demostrar que la imagen puede convertirse en una poderosa herramienta de transformación personal y profesional.',
    latest:'Argenis ahora', latestCopy:'Lo último de @argenisgrullonrd', instagramCta:'Ver más en Instagram',
    testimonialTitle:'Cuando el estilo deja huella', testimonialKicker:'Testimonio', testimonialQuote:'“Gracias por siempre cuidar cada detalle y hacer que todo se vea con intención y elegancia.”', testimonialBy:'Dr. Hugo María · publicación en Instagram',
    videosTitle:'Argenis en movimiento', videosKicker:'Videos destacados', videosCopy:'Color, presencia, estilo y propósito: una selección de contenidos para ver su enfoque en acción.',
    faqTitle:'Preguntas frecuentes', faqKicker:'Antes de comenzar', about:'Detrás del estilo',
    aboutCopy:'Soy asesor de imagen certificado por IBA, estilista de moda, creador digital y estratega de marca personal. Mi propósito es ayudar a personas, profesionales, artistas y empresas a convertir su imagen en una herramienta de comunicación, presencia y posicionamiento.',
    aboutCopy2:'Mi enfoque une moda, imagen, comunicación y negocios para construir una presencia auténtica, estratégica y alineada con la esencia y los objetivos de cada cliente.',
    quoteA:'No solo transformo la manera en que te ves.', quoteB:'Te ayudo a proyectar el poder de quien realmente eres.',
    contactTitle:'Cuéntame qué deseas proyectar', contactCopy:'Comparte algunos detalles sobre tu objetivo, imagen o proyecto.', name:'Nombre y apellido', whatsapp:'WhatsApp', email:'Correo electrónico',
    service:'¿Qué servicio te interesa?', goal:'¿Qué deseas lograr?', date:'Fecha o plazo del proyecto (opcional)', send:'Enviar solicitud', viaWhatsapp:'Prefiero escribir por WhatsApp',
    serviceOptions:['Asesoría de imagen personal','Imagen profesional / ejecutiva','Estilismo de moda','Estilismo para artista / figura pública','Marca personal','Producción / campaña','Evento','Colaboración con marca','Otro'],
    success:'Gracias. Tu solicitud está lista para enviar.', noFeed:'El feed en vivo se activará al conectar la cuenta de Instagram.', viewMore:'Ver más', close:'Cerrar', languageLabel:'Cambiar idioma'
  },
  en:{
    heroEyebrow:'Santiago · Dominican Republic', heroRole:'Image Consultant · Fashion Stylist · Personal Brand Strategist',
    heroLine:'I transform your image into a tool for power, communication and positioning.', request:'Request a consultation', portfolio:'View portfolio',
    manifestoTitle:'Your image speaks before you do', manifesto:'My work goes far beyond choosing clothes. I build a presence capable of communicating confidence, credibility and purpose before you say a single word.', manifestoKicker:'Manifesto',
    selectedWork:'Selected portfolio', selectedWorkKicker:'Featured projects', viewProject:'View project', portraitsTitle:'Argenis, up close', portraitsKicker:'Style · presence · identity',
    media:'As seen in', mediaKicker:'Press · television · publications', collaborations:'I have worked with', collaborationsKicker:'Selected clients and collaborations',
    expertise:'My work connects image, brand and creativity', image:'IMAGE', brand:'BRAND', creative:'CREATIVE',
    imageItems:['Personal image consulting','Fashion styling','Mens image','Corporate image','Color analysis','Personal shopping','Bridal styling'],
    brandItems:['Personal branding','Professional presence','Communication','Content strategy'], creativeItems:['Photo productions','Campaigns','Events','Strategic brand collaborations'],
    certification:'Training and certifications', certificationCopy:'Certified by IBA · Image & Business Academy', viewCredentials:'View credentials',
    platformTitle:'Al Estilo de Argenis', platformCopy:'A platform created to educate, inspire and show how image can become a powerful tool for personal and professional transformation.',
    latest:'Argenis now', latestCopy:'Latest from @argenisgrullonrd', instagramCta:'See more on Instagram',
    testimonialTitle:'When style leaves a mark', testimonialKicker:'Testimonial', testimonialQuote:'“Thank you for always taking care of every detail and making everything look intentional and elegant.”', testimonialBy:'Dr. Hugo María · Instagram post',
    videosTitle:'Argenis in motion', videosKicker:'Featured videos', videosCopy:'Color, presence, style and purpose: a selection of content that shows his approach in action.',
    faqTitle:'Frequently asked questions', faqKicker:'Before we begin', about:'Behind the style',
    aboutCopy:'I am an IBA-certified image consultant, fashion stylist, digital creator and personal brand strategist. My purpose is to help people, professionals, artists and companies turn their image into a tool for communication, presence and positioning.',
    aboutCopy2:'My approach combines fashion, image, communication and business to build an authentic, strategic presence aligned with each client’s essence and goals.',
    quoteA:'I do not only transform the way you look.', quoteB:'I help you project the power of who you truly are.',
    contactTitle:'Tell me what you want to project', contactCopy:'Share a few details about your goals, image or project.', name:'Full name', whatsapp:'WhatsApp', email:'Email',
    service:'Which service are you interested in?', goal:'What would you like to achieve?', date:'Project date or timeline (optional)', send:'Send request', viaWhatsapp:'I prefer WhatsApp',
    serviceOptions:['Personal image consulting','Professional / executive image','Fashion styling','Artist / public figure styling','Personal branding','Production / campaign','Event','Brand collaboration','Other'],
    success:'Thank you. Your request is ready to send.', noFeed:'The live feed will activate once the Instagram account is connected.', viewMore:'View more', close:'Close', languageLabel:'Change language'
  }
}

const PROJECTS:Project[] = [
  {id:'beauty-fragrance',title:{es:'Belleza y fragancia',en:'Beauty & Fragrance'},category:{es:'Estilismo editorial',en:'Editorial Styling'},cover:'/assets/adonisg/portfolio/beauty-fragrance/beauty-cover.webp',images:['/assets/adonisg/portfolio/beauty-fragrance/beauty-cover.webp','/assets/adonisg/portfolio/beauty-fragrance/beauty-02.webp','/assets/adonisg/portfolio/beauty-fragrance/beauty-03.webp','/assets/adonisg/portfolio/beauty-fragrance/beauty-04.webp'],description:{es:'Belleza, fragancia, accesorios y narrativa visual dentro de una misma producción.',en:'Beauty, fragrance, accessories and visual storytelling within one production.'}},
  {id:'red-statement',title:{es:'Declaración en rojo',en:'Red Statement'},category:{es:'Editorial de moda',en:'Fashion Editorial'},cover:'/assets/adonisg/portfolio/red-statement/red-cover.webp',images:['/assets/adonisg/portfolio/red-statement/red-cover.webp','/assets/adonisg/portfolio/red-statement/red-02.webp','/assets/adonisg/portfolio/red-statement/red-03.webp','/assets/adonisg/portfolio/red-statement/red-04.webp'],description:{es:'Una producción unificada por color, silueta y actitud.',en:'One production unified by color, silhouette and attitude.'}},
  {id:'noir',title:{es:'Noir',en:'Noir'},category:{es:'Editorial de moda',en:'Fashion Editorial'},cover:'/assets/adonisg/portfolio/noir/noir-cover.webp',images:['/assets/adonisg/portfolio/noir/noir-cover.webp','/assets/adonisg/portfolio/noir/noir-02.webp','/assets/adonisg/portfolio/noir/noir-03.webp','/assets/adonisg/portfolio/noir/noir-04.webp'],description:{es:'Una narrativa oscura y elegante enfocada en presencia y detalle.',en:'A dark, elegant narrative focused on presence and detail.'}},
  {id:'couple',title:{es:'Pareja y estilo de vida',en:'Couple Lifestyle'},category:{es:'Estilismo lifestyle',en:'Lifestyle Styling'},cover:'/assets/adonisg/portfolio/couple-lifestyle/couple-cover.webp',images:['/assets/adonisg/portfolio/couple-lifestyle/couple-cover.webp','/assets/adonisg/portfolio/couple-lifestyle/couple-02.webp','/assets/adonisg/portfolio/couple-lifestyle/couple-03.webp','/assets/adonisg/portfolio/couple-lifestyle/couple-04.webp'],description:{es:'Una misma historia visual construida a través de estilismo y conexión.',en:'One visual story built through styling and connection.'}},
  {id:'evening',title:{es:'Presencia de noche',en:'Evening Statement'},category:{es:'Estilismo de gala',en:'Evening Styling'},cover:'/assets/adonisg/portfolio/evening/evening-cover.webp',images:['/assets/adonisg/portfolio/evening/evening-cover.webp','/assets/adonisg/portfolio/evening/evening-02.webp','/assets/adonisg/portfolio/evening/evening-03.webp','/assets/adonisg/portfolio/evening/evening-04.webp'],description:{es:'Un look refinado construido para impacto, seguridad y ocasión.',en:'A refined look built for impact, confidence and occasion.'}},
  {id:'mens-brand',title:{es:'Imagen masculina y marca personal',en:'Mens Image & Personal Brand'},category:{es:'Marca personal',en:'Personal Branding'},cover:'/assets/adonisg/portfolio/mens-brand/mens-cover.webp',images:['/assets/adonisg/portfolio/mens-brand/mens-cover.webp','/assets/adonisg/portfolio/mens-brand/mens-02.webp','/assets/adonisg/portfolio/mens-brand/mens-03.webp','/assets/adonisg/portfolio/mens-brand/mens-04.webp'],description:{es:'Estilismo masculino orientado a presencia y posicionamiento personal.',en:'Mens styling focused on presence and personal positioning.'}}
]

const MEDIA:MediaItem[] = [
  {name:'DMH Magazine',title:{es:'Historia de esfuerzo e inspiración · “Lo Que No Te Cuentan del Éxito”',en:'A story of effort and inspiration · “Lo Que No Te Cuentan del Éxito”'},image:'/assets/adonisg/media/dlb-dmh-exito.webp',url:'https://dmhmagazine.com/el-estilista-dominicano-argenis-grullon-llevara-su-historia-de-esfuerzo-e-inspiracion-al-evento-lo-que-no-te-cuentan-del-exito/'},
  {name:'Buena Noche · Cachicha',title:{es:'Entrevista sobre moda, estilo de vida y trayectoria emprendedora',en:'Interview about fashion, lifestyle and his entrepreneurial journey'},image:'/assets/adonisg/media/bazar-emprendedores.webp',url:'https://www.cachicha.com/2021/01/gente-emprendedora-en-buena-noche/'},
  {name:'Diario Libre',title:{es:'Participación en el audiovisual “Bajo la lluvia” de Daniel Santacruz',en:'Appearance in Daniel Santacruz’s “Bajo la lluvia” music video'},image:'/assets/adonisg/media/la-vitrina.webp',url:'https://www.diariolibre.com/revista/musica/bajo-la-lluvia-nuevo-video-de-daniel-santacruz-EO23787377'},
  {name:'La Vitrina · Moda & Belleza',title:{es:'Editorial de moda y belleza',en:'Fashion and beauty editorial'},image:'/assets/adonisg/media/la-vitrina.webp'},
  {name:'El Janis',title:{es:'Crédito como asesor de imagen en editorial de moda',en:'Image consultant credit in fashion editorial'},image:'/assets/adonisg/media/el-janis.webp'}
]

const FAQS:FaqItem[] = [
  {q:{es:'¿Qué incluye una asesoría de imagen?',en:'What does an image consultation include?'},a:{es:'El proceso se adapta a cada objetivo e integra análisis de estilo, color, proporciones, presencia, comunicación y recomendaciones prácticas.',en:'The process is tailored to each goal and may include style, color, proportion, presence, communication and practical recommendations.'}},
  {q:{es:'¿Trabajas con hombres y mujeres?',en:'Do you work with men and women?'},a:{es:'Sí. Las asesorías se construyen alrededor de la persona, su contexto y lo que necesita proyectar.',en:'Yes. Consultations are built around the person, their context and what they need to project.'}},
  {q:{es:'¿Trabajas con artistas, figuras públicas y marcas?',en:'Do you work with artists, public figures and brands?'},a:{es:'Sí. Argenis desarrolla estilismo, conceptos visuales, campañas, producciones y colaboraciones estratégicas.',en:'Yes. Argenis develops styling, visual concepts, campaigns, productions and strategic collaborations.'}},
  {q:{es:'¿Puedo solicitar una asesoría para mi marca personal?',en:'Can I request a consultation for my personal brand?'},a:{es:'Sí. La imagen se trabaja junto a presencia, comunicación y objetivos de posicionamiento.',en:'Yes. Image is developed together with presence, communication and positioning goals.'}},
  {q:{es:'¿Cómo inicio una consulta?',en:'How do I start a consultation?'},a:{es:'Completa el formulario de este perfil o escribe por WhatsApp. Con esa información se define el siguiente paso.',en:'Complete the form on this profile or contact via WhatsApp. From there, the next step is defined.'}}
]

const PORTRAITS = Array.from({length:6},(_,i)=>`/assets/adonisg/portraits/argenis-${String(i+1).padStart(2,'0')}.webp`)
const CERTS = Array.from({length:5},(_,i)=>`/assets/adonisg/certifications/cert-${String(i+1).padStart(2,'0')}.webp`)
const VIDEOS = ['/assets/adonisg/videos/video-01.mp4','/assets/adonisg/videos/video-02.mp4','/assets/adonisg/videos/video-03.mp4']

function parseJson<T>(raw:string|undefined,fallback:T):T{if(!raw)return fallback;try{return JSON.parse(raw) as T}catch{return fallback}}
function cleanPhone(value:string){return value.replace(/\D/g,'')}
function normalizeHttp(value:string){return !value?'':/^https?:\/\//i.test(value)?value:`https://${value}`}
function Reveal({children,className=''}:{children:ReactNode;className?:string}){const ref=useRef<HTMLDivElement>(null);const[visible,setVisible]=useState(false);useEffect(()=>{const node=ref.current;if(!node)return;if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){setVisible(true);return}const observer=new IntersectionObserver(([entry])=>{if(entry.isIntersecting){setVisible(true);observer.disconnect()}},{threshold:.1});observer.observe(node);return()=>observer.disconnect()},[]);return <div ref={ref} className={`adonis-reveal ${visible?'is-visible':''} ${className}`}>{children}</div>}
function ModalShell({children,onClose,label}:{children:ReactNode;onClose:()=>void;label:string}){useEffect(()=>{const old=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=old}},[]);return <div className="adonis-modal-backdrop" role="dialog" aria-modal="true" aria-label={label} onMouseDown={(e)=>{if(e.target===e.currentTarget)onClose()}}><div className="adonis-modal"><button className="adonis-modal-close" onClick={onClose} aria-label={label}><FaTimes/></button>{children}</div></div>}

export default function IntapProfileAdonisgV1({profile}:{profile:IntapProfileV2Profile}){
  const td=profile.templateData??{}
  const policy=resolveProfileLanguagePolicy(td,{defaultLanguage:'es',enabled:['es','en']})
  const[language,setLanguage]=useState<ProfileLanguageCode>(()=>typeof window==='undefined'?policy.defaultLanguage:resolveRequestedProfileLanguage(window.location.search,policy))
  const t=COPY[language]
  const[activeProject,setActiveProject]=useState<Project|null>(null)
  const[contactOpen,setContactOpen]=useState(false)
  const[certOpen,setCertOpen]=useState(false)
  const[feed,setFeed]=useState<FeedItem[]>([])
  const[feedReady,setFeedReady]=useState(false)
  const[sent,setSent]=useState(false)
  const[heroSlide,setHeroSlide]=useState(0)
  const displayName=profile.name||'Argenis Grullón'
  const whatsapp=profile.whatsapp||profile.whatsappNumber||profile.whatsapp_number||td.whatsapp||''
  const email=profile.email||td.email||''
  const instagram=td.instagram_url||'https://www.instagram.com/argenisgrullonrd/'
  const collaborations=useMemo(()=>parseJson<Collaboration[]>(td.collaborations_json,[]),[td.collaborations_json])
  const extraMedia=useMemo(()=>parseJson<MediaItem[]>(td.media_mentions_json,[]),[td.media_mentions_json])
  const media=[...MEDIA,...extraMedia]
  const immersiveSlides=[PORTRAITS[1],PORTRAITS[4],PORTRAITS[3],PORTRAITS[5]]

  useEffect(()=>{const params=new URLSearchParams(window.location.search);if(language===policy.defaultLanguage)params.delete('lang');else params.set('lang',language);const query=params.toString();history.replaceState(null,'',`${window.location.pathname}${query?`?${query}`:''}${window.location.hash}`)},[language,policy.defaultLanguage])
  useEffect(()=>{const id=window.setInterval(()=>setHeroSlide(v=>(v+1)%immersiveSlides.length),3400);return()=>window.clearInterval(id)},[immersiveSlides.length])
  useEffect(()=>{const origin=(import.meta.env.VITE_PUBLIC_ORIGIN||window.location.origin).replace(/\/$/,'');const canonical=`${origin}/adonisg${language==='en'?'?lang=en':''}`;const title=language==='en'?'Argenis Grullón | Image Consultant & Fashion Stylist':'Argenis Grullón | Asesor de Imagen y Estilista de Moda';const description=language==='en'?'IBA-certified image consultant, fashion stylist, digital creator and personal brand strategist in Santiago, Dominican Republic.':'Asesor de imagen certificado por IBA, estilista de moda, creador digital y estratega de marca personal en Santiago, República Dominicana.';document.title=title;const meta=(key:string,value:string,property=false)=>{const selector=`meta[${property?'property':'name'}="${key}"]`;let el=document.head.querySelector<HTMLMetaElement>(selector);if(!el){el=document.createElement('meta');el.setAttribute(property?'property':'name',key);document.head.appendChild(el)}el.content=value};let canonicalEl=document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');if(!canonicalEl){canonicalEl=document.createElement('link');canonicalEl.rel='canonical';document.head.appendChild(canonicalEl)}canonicalEl.href=canonical;meta('description',description);meta('og:title',title,true);meta('og:description',description,true);meta('og:type','profile',true);meta('og:url',canonical,true);meta('og:image',`${origin}/assets/adonisg/og/adonisg-og.jpg`,true);meta('twitter:card','summary_large_image');meta('twitter:title',title);meta('twitter:description',description);meta('twitter:image',`${origin}/assets/adonisg/og/adonisg-og.jpg`);document.documentElement.lang=language==='en'?'en':'es'},[language])
  useEffect(()=>{const endpoint=td.instagram_feed_endpoint;if(!endpoint){setFeedReady(true);return}fetch(endpoint,{headers:{Accept:'application/json'}}).then(r=>r.ok?r.json():Promise.reject()).then((json)=>{const items=Array.isArray(json?.items)?json.items:Array.isArray(json?.data)?json.data:[];setFeed(items.slice(0,7));setFeedReady(true)}).catch(()=>setFeedReady(true))},[td.instagram_feed_endpoint])

  const openWhatsApp=(message:string)=>{const phone=cleanPhone(whatsapp);if(!phone)return false;window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`,'_blank','noopener,noreferrer');return true}
  const handleContact=(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();const fd=new FormData(event.currentTarget);const subject=language==='en'?'Consultation request':'Solicitud de asesoría';const message=[subject,`Nombre: ${fd.get('name')}`,`WhatsApp: ${fd.get('phone')}`,`Email: ${fd.get('email')}`,`Servicio: ${fd.get('service')}`,`Objetivo: ${fd.get('goal')}`,`Fecha/plazo: ${fd.get('date')||'-'}`].join('\n');setSent(true);if(!openWhatsApp(message)&&email)window.location.href=`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`}

  return <main className="adonis-profile">
    <header className="adonis-hero">
      <img className="adonis-hero-image" src="/assets/adonisg/hero/argenis-hero.webp" alt="Argenis Grullón" fetchPriority="high"/>
      <div className="adonis-hero-shade"/>
      <nav className="adonis-topbar">
        <img src="/assets/adonisg/brand/mark-white.png" alt="Al Estilo de Argenis" className="adonis-mark"/>
        <button className="adonis-language" aria-label={t.languageLabel} onClick={()=>setLanguage(language==='es'?'en':'es')}><FaGlobeAmericas/><span>{language==='es'?'English':'Español'}</span></button>
      </nav>
      <div className="adonis-hero-content"><p className="adonis-eyebrow">{t.heroEyebrow}</p><h1>ARGENIS<br/>GRULLÓN</h1><p className="adonis-role">{t.heroRole}</p><p className="adonis-hero-line">{t.heroLine}</p><div className="adonis-hero-actions"><button className="adonis-btn adonis-btn-light" onClick={()=>setContactOpen(true)}>{t.request}</button><a className="adonis-btn adonis-btn-ghost" href="#portfolio">{t.portfolio}</a></div></div>
    </header>

    <section className="adonis-intro-slider" aria-label={t.portraitsTitle}>
      {immersiveSlides.map((src,i)=><img key={src} className={i===heroSlide?'is-active':''} src={src} alt={`${displayName} ${i+1}`} loading={i===0?'eager':'lazy'}/>)}
      <div className="adonis-intro-copy"><p>{language==='es'?'Una imagen no se improvisa. Se construye.':'An image is not improvised. It is built.'}</p><span>{language==='es'?'Presencia · intención · propósito':'Presence · intention · purpose'}</span></div>
      <div className="adonis-slider-dots">{immersiveSlides.map((_,i)=><button key={i} className={i===heroSlide?'is-active':''} onClick={()=>setHeroSlide(i)} aria-label={`Slide ${i+1}`}/>)}</div>
    </section>

    <section className="adonis-manifesto"><div className="adonis-manifesto-media"><img src="/assets/adonisg/hero/argenis-manifesto.webp" alt="Argenis Grullón" loading="lazy"/></div><Reveal className="adonis-manifesto-copy"><p className="adonis-section-kicker">01 · {t.manifestoKicker}</p><h2>{t.manifestoTitle}</h2><p>{t.manifesto}</p><div className="adonis-disciplines">{(language==='es'?['Colorimetría','Morfología','Visagismo','Estilismo','Análisis de estilo','Protocolo','Proyección profesional']:['Color analysis','Body morphology','Visagism','Styling','Style analysis','Protocol','Professional presence']).map(v=><span key={v}>{v}</span>)}</div></Reveal></section>

    <section className="adonis-section adonis-work" id="portfolio"><Reveal><p className="adonis-section-kicker">02 · {t.selectedWorkKicker}</p><h2>{t.selectedWork}</h2></Reveal><div className="adonis-project-grid">{PROJECTS.map((project,i)=><Reveal key={project.id} className="adonis-project"><button onClick={()=>setActiveProject(project)}><div className="adonis-project-media"><img src={project.cover} alt={project.title[language]} loading="lazy"/><div className="adonis-project-strip">{project.images.slice(1,4).map(src=><img src={src} alt="" loading="lazy" key={src}/>)}</div><span className="adonis-project-number">0{i+1}</span></div><div className="adonis-project-meta"><div><p>{project.category[language]}</p><h3>{project.title[language]}</h3></div><span>{t.viewProject} <FaArrowRight/></span></div></button></Reveal>)}</div></section>

    <section className="adonis-portraits"><Reveal><p className="adonis-section-kicker">03 · {t.portraitsKicker}</p><h2>{t.portraitsTitle}</h2></Reveal><div className="adonis-portrait-grid">{PORTRAITS.map((src,i)=><figure className={i===0||i===3?'is-tall':''} key={src}><img src={src} alt={`${displayName} ${i+1}`} loading="lazy"/></figure>)}</div></section>

    <section className="adonis-section adonis-media-section"><Reveal><p className="adonis-section-kicker">04 · {t.mediaKicker}</p><h2>{t.media}</h2></Reveal><div className="adonis-media-track">{media.map((item,i)=><article className="adonis-media-card" key={`${item.name}-${i}`}><img src={item.image} alt={item.name} loading="lazy"/><div><p>{item.name}</p><h3>{item.title[language]}</h3>{item.url&&<a href={normalizeHttp(item.url)} target="_blank" rel="noopener noreferrer">{t.viewMore} <FaArrowRight/></a>}</div></article>)}</div></section>

    <section className="adonis-collab"><Reveal><p className="adonis-section-kicker">05 · {t.collaborationsKicker}</p><h2>{t.collaborations}</h2></Reveal>{collaborations.length>0?<div className="adonis-collab-list">{collaborations.map((item,i)=><div key={`${item.name}-${i}`} className="adonis-collab-item"><span>{String(i+1).padStart(2,'0')}</span><strong>{item.name}</strong><em>{item.role||''}</em></div>)}</div>:<p className="adonis-collab-fallback">{language==='es'?'Figuras públicas · Artistas · Influencers · Marcas · Empresas · Producciones':'Public figures · Artists · Influencers · Brands · Companies · Productions'}</p>}</section>

    <section className="adonis-expertise"><Reveal><p className="adonis-section-kicker">06 · {language==='es'?'Áreas de trabajo':'Expertise'}</p><h2>{t.expertise}</h2></Reveal><div className="adonis-expertise-grid">{[[t.image,t.imageItems],[t.brand,t.brandItems],[t.creative,t.creativeItems]].map(([title,items])=><article key={title as string}><h3>{title as string}</h3><ul>{(items as string[]).map(item=><li key={item}>{item}</li>)}</ul></article>)}</div></section>

    <section className="adonis-testimonial"><img src="/assets/adonisg/testimonials/dr-hugo-maria.webp" alt={t.testimonialBy} loading="lazy"/><Reveal><p className="adonis-section-kicker">07 · {t.testimonialKicker}</p><h2>{t.testimonialTitle}</h2><blockquote>{t.testimonialQuote}</blockquote><span>{t.testimonialBy}</span></Reveal></section>

    <section className="adonis-cert"><Reveal><p className="adonis-section-kicker">08 · IBA</p><h2>{t.certification}</h2><p>{t.certificationCopy}</p><button className="adonis-text-btn" onClick={()=>setCertOpen(true)}>{t.viewCredentials} <FaArrowRight/></button></Reveal><img src="/assets/adonisg/hero/argenis-cowboy.webp" alt="Argenis Grullón" loading="lazy"/></section>

    <section className="adonis-platform"><img className="adonis-platform-logo" src="/assets/adonisg/brand/logo-white.png" alt="Al Estilo de Argenis" loading="lazy"/><Reveal><h2>{t.platformTitle}</h2><p>{t.platformCopy}</p></Reveal></section>

    <section className="adonis-section adonis-videos"><Reveal><p className="adonis-section-kicker">09 · {t.videosKicker}</p><h2>{t.videosTitle}</h2><p>{t.videosCopy}</p></Reveal><div className="adonis-video-track">{VIDEOS.map((src,i)=><article key={src}><div className="adonis-video-shell"><video controls preload="none" playsInline poster={PORTRAITS[(i+1)%PORTRAITS.length]}><source src={src} type="video/mp4"/></video><span className="adonis-video-badge"><FaPlay/> {String(i+1).padStart(2,'0')}</span></div></article>)}</div></section>

    <section className="adonis-section adonis-instagram"><Reveal><p className="adonis-section-kicker">10 · Instagram</p><h2>{t.latest}</h2><p>{t.latestCopy}</p></Reveal>{feed.length>0?<div className="adonis-feed-grid">{feed.map((item,i)=><a key={item.id||i} href={item.permalink||instagram} target="_blank" rel="noopener noreferrer" className={i===0?'is-featured':''}><img src={item.thumbnail_url||item.media_url} alt={item.caption||'Instagram'} loading="lazy"/></a>)}</div>:feedReady&&<div className="adonis-feed-empty"><FaInstagram/><p>{t.noFeed}</p></div>}<a className="adonis-text-btn" href={instagram} target="_blank" rel="noopener noreferrer">{t.instagramCta} <FaArrowRight/></a></section>

    <section className="adonis-about"><div className="adonis-about-image"><img src={PORTRAITS[2]} alt={displayName} loading="lazy"/></div><Reveal><p className="adonis-section-kicker">11 · {t.about}</p><h2>{displayName}</h2><p>{t.aboutCopy}</p><p>{t.aboutCopy2}</p><div className="adonis-about-facts"><span>IBA</span><span>CEO · Al Estilo de Argenis</span><span>Santiago · RD</span></div></Reveal></section>

    <section className="adonis-faq"><Reveal><p className="adonis-section-kicker">12 · {t.faqKicker}</p><h2>{t.faqTitle}</h2></Reveal><div className="adonis-faq-list">{FAQS.map((item,i)=><details key={i}><summary>{item.q[language]}<span>+</span></summary><p>{item.a[language]}</p></details>)}</div></section>

    <section className="adonis-quote"><Reveal><p>{t.quoteA}</p><strong>{t.quoteB}</strong><span>— Argenis Grullón</span></Reveal></section>
    <section className="adonis-contact-cta"><p>ARGENIS GRULLÓN</p><h2>{t.contactTitle}</h2><button className="adonis-btn adonis-btn-light" onClick={()=>setContactOpen(true)}>{t.request}</button><a href={instagram} target="_blank" rel="noopener noreferrer"><FaInstagram/> @argenisgrullonrd</a></section>

    {activeProject&&<ModalShell label={activeProject.title[language]} onClose={()=>setActiveProject(null)}><div className="adonis-project-modal"><p className="adonis-section-kicker">{activeProject.category[language]}</p><h2>{activeProject.title[language]}</h2><p>{activeProject.description[language]}</p><div className="adonis-project-gallery">{activeProject.images.map((src,i)=><img src={src} key={src} alt={`${activeProject.title[language]} ${i+1}`} loading={i===0?'eager':'lazy'}/>)}</div></div></ModalShell>}
    {certOpen&&<ModalShell label={t.certification} onClose={()=>setCertOpen(false)}><div className="adonis-cert-modal"><p className="adonis-section-kicker">IBA</p><h2>{t.certification}</h2><div>{CERTS.map((src,i)=><img src={src} alt={`${t.certification} ${i+1}`} loading="lazy" key={src}/>)}</div></div></ModalShell>}
    {contactOpen&&<ModalShell label={t.contactTitle} onClose={()=>{setContactOpen(false);setSent(false)}}><form className="adonis-contact-form" onSubmit={handleContact}><p className="adonis-section-kicker">{language==='es'?'TRABAJA CON ARGENIS':'WORK WITH ARGENIS'}</p><h2>{t.contactTitle}</h2><p>{t.contactCopy}</p><label>{t.name}<input name="name" required autoComplete="name"/></label><div className="adonis-form-row"><label>{t.whatsapp}<input name="phone" required inputMode="tel" autoComplete="tel"/></label><label>{t.email}<input name="email" type="email" autoComplete="email"/></label></div><label>{t.service}<select name="service" required defaultValue=""><option value="" disabled>—</option>{t.serviceOptions.map(item=><option value={item} key={item}>{item}</option>)}</select></label><label>{t.goal}<textarea name="goal" required rows={4}/></label><label>{t.date}<input name="date"/></label>{sent&&<p className="adonis-form-success">{t.success}</p>}<button className="adonis-btn adonis-btn-dark" type="submit">{t.send}</button>{whatsapp&&<button type="button" className="adonis-whatsapp-btn" onClick={()=>openWhatsApp(language==='en'?'Hello Argenis, I would like information about an image consultation.':'Hola Argenis, me interesa recibir información sobre una asesoría de imagen.')}><FaWhatsapp/> {t.viaWhatsapp}</button>}{email&&<a className="adonis-email-link" href={`mailto:${email}`}><FaEnvelope/> {email}</a>}</form></ModalShell>}
  </main>
}
