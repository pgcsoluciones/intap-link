import {
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'

import {
  FaAddressCard,
  FaChartLine,
  FaChevronDown,
  FaExternalLinkAlt,
  FaEdit,
  FaHandshake,
  FaHome,
  FaInstagram,
  FaKey,
  FaLink,
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaQrcode,
  FaShareAlt,
  FaTimes,
  FaWhatsapp,
} from 'react-icons/fa'

import './IntapLinkGratisRebuilt.css'
import './IntapLinkGratisPublicEnhancements.css'

import {
  FREE_PROFILE_LIMITS,
  type FreeProfileAppearanceColors,
  type FreeProfileData,
  type FreeProfileLayoutId,
  type FreeProfilePortfolioItem,
  type FreeProfileQuickAction,
  type FreeProfileService,
  type FreeProfileServiceIconKey,
} from './IntapLinkGratis.types'

export type IntapLinkGratisProfileProps = {
  profile: FreeProfileData
  layout: FreeProfileLayoutId
  colors: FreeProfileAppearanceColors
  topContent?: ReactNode
  beforeShareContent?: ReactNode
  footerSecondaryLabel?: string
  footerSecondaryHref?: string
  editMode?: boolean
  onEditSection?: (section: 'hero' | 'avatar' | 'identity' | 'contact' | 'about' | 'portfolio' | 'services' | 'links' | 'appearance') => void
  onTrackEvent?: (eventType: string, eventLabel?: string) => void
}

type DetailModal =
  | { kind: 'portfolio'; item: FreeProfilePortfolioItem }
  | { kind: 'service'; item: FreeProfileService }
  | null

function normalizeHex(value: string, fallback: string) {
  const normalized = value.trim().toUpperCase()
  return /^#[0-9A-F]{6}$/.test(normalized) ? normalized : fallback
}

function rgb(hex: string) {
  const value = normalizeHex(hex, '#111827').slice(1)
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  }
}

function toHex(value: number) {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')
}

function mixHex(base: string, target: string, weight: number) {
  const a = rgb(base)
  const b = rgb(target)
  const mix = (x: number, y: number) => x * (1 - weight) + y * weight
  return ('#' + toHex(mix(a.r, b.r)) + toHex(mix(a.g, b.g)) + toHex(mix(a.b, b.b))).toUpperCase()
}

function luminance(hex: string) {
  const color = rgb(hex)
  const channel = (value: number) => {
    const normalized = value / 255
    return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b)
}

function contrastRatio(foreground: string, background: string) {
  const a = luminance(foreground)
  const b = luminance(background)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

function readableText(background: string) {
  const white = '#FFFFFF'
  const dark = '#111827'
  return luminance(background) <= 0.62 ? white : dark
}

function ensureReadableColor(foreground: string, background: string, minimum = 4.5) {
  const original = normalizeHex(foreground, '#111827')
  const bg = normalizeHex(background, '#FFFFFF')
  if (contrastRatio(original, bg) >= minimum) return original
  const darkTarget = '#111827'
  const lightTarget = '#FFFFFF'
  const target = contrastRatio(darkTarget, bg) >= contrastRatio(lightTarget, bg) ? darkTarget : lightTarget
  for (let weight = 0.08; weight <= 1; weight += 0.08) {
    const candidate = mixHex(original, target, weight)
    if (contrastRatio(candidate, bg) >= minimum) return candidate
  }
  return target
}

function normalizeWhatsAppNumber(value: string) {
  let digits = String(value || '').replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.length === 10 && /^(809|829|849)/.test(digits)) digits = `1${digits}`
  return digits
}

function whatsappUrl(profile: FreeProfileData, subject?: string) {
  if (!profile.whatsapp) return ''
  const whatsapp = normalizeWhatsAppNumber(profile.whatsapp)
  if (!whatsapp) return ''
  const message = subject
    ? `Hola ${profile.whatsappGreetingName}, vi "${subject}" en tu perfil de Kawvo Link y me gustaría recibir más información.`
    : `Hola ${profile.whatsappGreetingName}, vi tu perfil en Kawvo Link y me gustaría recibir más información.`
  return `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`
}

function loginUrl() {
  if (typeof window === 'undefined') return 'https://app.intaprd.com/admin/login'
  const host = window.location.hostname
  return host.includes('preview') || host.endsWith('.pages.dev')
    ? 'https://app.preview.intaprd.com/admin/login'
    : 'https://app.intaprd.com/admin/login'
}

function serviceIcon(key: FreeProfileServiceIconKey) {
  switch (key) {
    case 'home': return <FaHome />
    case 'key': return <FaKey />
    case 'chart-line': return <FaChartLine />
    case 'handshake': return <FaHandshake />
    default: return <FaHandshake />
  }
}

function quickActionIcon(action: FreeProfileQuickAction) {
  switch (action.type) {
    case 'call': return <FaPhoneAlt />
    case 'instagram': return <FaInstagram />
    case 'location': return <FaMapMarkerAlt />
    case 'email': return <FaLink />
    case 'tiktok': return <FaExternalLinkAlt />
    default: return <FaLink />
  }
}

function EditPencil({label,onClick}:{label:string;onClick?:()=>void}){return onClick?<button type="button" className="ilx-live-edit" aria-label={label} onClick={(e)=>{e.preventDefault();e.stopPropagation();onClick()}}><FaEdit /></button>:null}

function Identity({ profile, layout, onEdit }: { profile: FreeProfileData; layout: FreeProfileLayoutId; onEdit?: (section:'hero'|'avatar'|'identity')=>void }) {
  if (layout === 'impacto') {
    return (
      <section className="ilx-identity ilx-impact">
        <div className="ilx-impact-cover ilx-live-editable">
          {profile.hero ? (
            <img src={profile.hero} alt="" style={{ objectPosition: `${profile.heroPositionX}% ${profile.heroPositionY}%`, transform: `scale(${profile.heroZoom})` }} />
          ) : <div className="ilx-impact-fallback" aria-hidden="true" />}
          <EditPencil label="Cambiar portada" onClick={onEdit ? ()=>onEdit('hero') : undefined} />
        </div>
        <div className="ilx-impact-person">
          <div className="ilx-impact-avatar ilx-live-editable"><img src={profile.portrait} alt={profile.name} /><EditPencil label="Cambiar avatar" onClick={onEdit ? ()=>onEdit("avatar") : undefined} /></div>
          <div className="ilx-impact-name ilx-live-editable"><h1>{profile.name}</h1><p>{profile.role}</p><EditPencil label="Editar nombre y cargo" onClick={onEdit ? ()=>onEdit("identity") : undefined} /></div>
        </div>
      </section>
    )
  }

  if (layout === 'personal') {
    return (
      <section className="ilx-identity ilx-personal">
        <div className="ilx-personal-image ilx-live-editable">
          <img src={profile.portrait} alt={profile.name} />
          <EditPencil label="Cambiar avatar" onClick={onEdit ? ()=>onEdit("avatar") : undefined} />
          <div className="ilx-personal-fade" />
          <div className="ilx-personal-text ilx-live-editable"><h1>{profile.name}</h1><p>{profile.role}</p><EditPencil label="Editar nombre y cargo" onClick={onEdit ? ()=>onEdit("identity") : undefined} /></div>
        </div>
      </section>
    )
  }

  return (
    <section className="ilx-identity ilx-essential">
      <div className="ilx-essential-image ilx-live-editable"><img src={profile.portrait} alt={profile.name} /><EditPencil label="Cambiar avatar" onClick={onEdit ? ()=>onEdit("avatar") : undefined} /></div>
      <div className="ilx-essential-name ilx-live-editable"><h1>{profile.name}</h1><p>{profile.role}</p><EditPencil label="Editar nombre y cargo" onClick={onEdit ? ()=>onEdit("identity") : undefined} /></div>
    </section>
  )
}

export default function IntapLinkGratisProfile({ profile, layout, colors, topContent, beforeShareContent, footerSecondaryLabel, footerSecondaryHref, editMode=false, onEditSection, onTrackEvent }: IntapLinkGratisProfileProps) {
  const [copied, setCopied] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [linksOpen, setLinksOpen] = useState(false)
  const [modal, setModal] = useState<DetailModal>(null)

  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'auto' }) }, [])
  useEffect(() => {
    if (!modal && !qrOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setModal(null); setQrOpen(false) }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', onKeyDown) }
  }, [modal, qrOpen])

  const portfolio = profile.portfolio.slice(0, FREE_PROFILE_LIMITS.maxPortfolioImages)
  const customLinks = profile.customLinks.slice(0, FREE_PROFILE_LIMITS.maxCustomLinks)
  const quickActions = profile.quickActions.slice(0, FREE_PROFILE_LIMITS.maxQuickActions)
  const services = profile.services.slice(0, FREE_PROFILE_LIMITS.maxServices)

  const surface = normalizeHex(colors.surface, '#FFFFFF')
  const pageBackground = normalizeHex(colors.background, '#F8FAFC')
  const text = ensureReadableColor(colors.text, surface, 7)
  const primary = ensureReadableColor(colors.primary, surface, 4.5)
  const accent = ensureReadableColor(colors.accent, surface, 3.4)
  const action = normalizeHex(colors.button, colors.primary)
  const onAction = readableText(action)
  const actionHover = mixHex(action, luminance(action) > 0.52 ? '#111827' : '#FFFFFF', 0.13)
  const muted = ensureReadableColor(mixHex(text, surface, 0.38), surface, 4.5)
  const border = mixHex(accent, surface, 0.64)
  const softPrimary = mixHex(primary, surface, 0.91)
  const softAccent = mixHex(accent, surface, 0.91)
  const variables = {
    '--ilx-page-bg': pageBackground,
    '--ilx-surface': surface,
    '--ilx-text': text,
    '--ilx-muted': muted,
    '--ilx-primary': primary,
    '--ilx-accent': accent,
    '--ilx-action': action,
    '--ilx-action-hover': actionHover,
    '--ilx-on-action': onAction,
    '--ilx-border': border,
    '--ilx-soft-primary': softPrimary,
    '--ilx-soft-accent': softAccent,
  } as CSSProperties

  function canonicalProfileUrl() {
    return `${window.location.origin}${window.location.pathname}`
  }

  function socialShareProfileUrl() {
    return `${canonicalProfileUrl()}?share=perfil&card=3`
  }

  async function downloadVCard() {
    onTrackEvent?.('save_contact','Guardar contacto')
    const canonicalUrl = `${window.location.origin}${window.location.pathname}`
    const escapeVCard = (value: string) => String(value || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
    const phone = String(profile.phone || '').trim()
    const mobile = String(profile.whatsapp || '').trim()
    const phoneKey = phone.replace(/\D/g, '')
    const mobileKey = mobile.replace(/\D/g, '')
    const distinctPhone = Boolean(phone && (!mobile || phoneKey !== mobileKey))
    const content = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${escapeVCard(profile.name)}`,
      `N:;${escapeVCard(profile.name)};;;`,
      profile.role ? `TITLE:${escapeVCard(profile.role)}` : '',
      mobile ? `TEL;TYPE=CELL:${mobile}` : '',
      distinctPhone ? `TEL;TYPE=VOICE:${phone}` : '',
      profile.email ? `EMAIL;TYPE=INTERNET:${escapeVCard(profile.email)}` : '',
      `URL:${canonicalUrl}`,
      'END:VCARD',
      '',
    ].filter((line) => line !== '').join('\r\n')
    const blob = new Blob([content], { type: 'text/vcard;charset=utf-8' })
    const fileName = profile.vcardFileName || `${profile.slug || 'contacto'}.vcf`
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    const isMobileContactFlow = /iphone|ipad|ipod|android/i.test(window.navigator.userAgent)

    anchor.href = url
    anchor.rel = 'noopener'

    if (isMobileContactFlow) {
      anchor.target = '_self'
    } else {
      anchor.download = fileName
    }

    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), isMobileContactFlow ? 60000 : 1500)
  }

  async function copyProfileLink() {
    onTrackEvent?.('copy_link','Copiar enlace')
    try {
      await navigator.clipboard.writeText(canonicalProfileUrl())
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch { setCopied(false) }
  }

  async function openQrModal() {
    onTrackEvent?.('qr_open','Código QR')
    try {
      const QRCode = await import('qrcode')
      setQrDataUrl(await QRCode.toDataURL(canonicalProfileUrl(), { width: 1200, margin: 3, errorCorrectionLevel: 'H', color: { dark: '#111111', light: '#FFFFFF' } }))
      setQrOpen(true)
    } catch (error) { console.error('No se pudo generar el QR', error) }
  }

  function downloadProfileQr() {
    if (!qrDataUrl) return
    onTrackEvent?.('qr_download','Descargar QR PNG')
    const link = document.createElement('a')
    link.href = qrDataUrl
    link.download = `${profile.slug || 'kawvo-link'}-qr.png`
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  async function saveProfileQrToPhotos() {
    if (!qrDataUrl) return
    onTrackEvent?.('qr_save_photo','Guardar QR en fotos')
    try {
      const response = await fetch(qrDataUrl)
      const blob = await response.blob()
      const file = new File([blob], `${profile.slug || 'kawvo-link'}-qr.png`, { type: 'image/png' })
      const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean }
      if (navigator.share && nav.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Código QR de ${profile.name}` })
        return
      }
    } catch { /* fallback below */ }
    const imageWindow = window.open(qrDataUrl, '_blank', 'noopener,noreferrer')
    if (!imageWindow) {
      const link = document.createElement('a')
      link.href = qrDataUrl
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      document.body.appendChild(link)
      link.click()
      link.remove()
    }
  }

  function shareProfileQrWhatsApp() {
    const message = `Conoce el perfil de ${profile.name} en Kawvo Link:\n${socialShareProfileUrl()}`
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
  }

  async function shareProfile() {
    onTrackEvent?.('share','Compartir perfil')
    try {
      if (navigator.share) await navigator.share({ title: `${profile.name} | Kawvo Link`, text: `Conoce el perfil de ${profile.name}`, url: socialShareProfileUrl() })
      else await copyProfileLink()
    } catch { /* cancelar compartir no es error */ }
  }

  const hasWhatsapp = Boolean(profile.whatsapp)

  return (
    <main className={`ilx-page ilx-layout-${layout}`} style={variables}>
      {topContent}
      <div className="ilx-shell">
        <Identity profile={profile} layout={layout} onEdit={editMode ? onEditSection : undefined} />
        <div className="ilx-body">
          {editMode && <div className="ilx-live-contact-edit"><EditPencil label="Editar datos de contacto" onClick={()=>onEditSection?.("contact")} /></div>}
          {hasWhatsapp && <a className="ilx-main-cta" href={whatsappUrl(profile)} target="_blank" rel="noopener noreferrer" onClick={()=>onTrackEvent?.('whatsapp','CTA principal')}><FaWhatsapp /><span>Hablar por WhatsApp</span></a>}

          {quickActions.length > 0 && (
            <nav className="ilx-quick" aria-label="Acciones rápidas">
              {quickActions.map((actionItem) => (
                <a key={`${actionItem.type}-${actionItem.url}`} href={actionItem.url} target={actionItem.type === 'call' || actionItem.type === 'email' ? undefined : '_blank'} rel={actionItem.type === 'call' || actionItem.type === 'email' ? undefined : 'noopener noreferrer'} onClick={()=>onTrackEvent?.(`quick_${actionItem.type}`,actionItem.label)}>
                  <span>{quickActionIcon(actionItem)}</span><strong>{actionItem.label}</strong>
                </a>
              ))}
            </nav>
          )}

          <button type="button" className="ilx-save-contact" onClick={downloadVCard}><FaAddressCard /><strong>Guardar contacto</strong></button>

          <section className="ilx-section ilx-about ilx-live-editable"><h2>{profile.aboutTitle}</h2><p className="ilx-copy">{profile.bio}</p>{editMode && <EditPencil label="Editar sobre mí" onClick={()=>onEditSection?.("about")} />}</section>

          {portfolio.length > 0 && (
            <section className="ilx-section ilx-portfolio ilx-live-editable">
              <h2>{profile.portfolioTitle}</h2>{editMode && <EditPencil label="Editar portafolio" onClick={()=>onEditSection?.("portfolio")} />}
              <div className="ilx-portfolio-marquee"><div className="ilx-portfolio-track">
                {[...portfolio.map((item) => ({ item, duplicate: false })), ...portfolio.map((item) => ({ item, duplicate: true }))].map(({ item, duplicate }, index) => (
                  <button key={`${duplicate ? 'copy' : 'original'}-${item.id}-${index}`} type="button" className="ilx-portfolio-item" tabIndex={duplicate ? -1 : 0} aria-hidden={duplicate ? true : undefined} onClick={() => {onTrackEvent?.('portfolio_open',item.title);setModal({ kind: 'portfolio', item })}}>
                    <img src={item.image} alt={duplicate ? '' : item.title} loading="lazy" decoding="async" />
                    <span className="ilx-portfolio-title">{item.title}</span>
                  </button>
                ))}
              </div></div>
            </section>
          )}

          {services.length > 0 && (
            <section className="ilx-section ilx-services-section">
              <div className="ilx-services-heading ilx-live-editable">
                <h2>{profile.servicesTitle}</h2>
                {editMode && <EditPencil label="Editar servicios" onClick={()=>onEditSection?.("services")} />}
                {profile.servicesDescription && <p>{profile.servicesDescription}</p>}
              </div>
              <div className="ilx-services" data-service-count={Math.max(1, services.length)} style={{ '--ilx-service-count': Math.max(1, services.length) } as CSSProperties}>
                {services.map((service) => (
                  <button key={service.id} type="button" className="ilx-service" onClick={() => {onTrackEvent?.('service_open',service.title);setModal({ kind: 'service', item: service })}}>
                    <div className="ilx-service-media">{service.image ? <img src={service.image} alt={service.title} loading="lazy" decoding="async" /> : <span>{serviceIcon(service.iconKey)}</span>}</div>
                    <div className="ilx-service-copy">
                      <h3>{service.title}</h3>
                      <p>{service.description}</p>
                      <span className="ilx-service-more">Ver detalles</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {customLinks.length > 0 && (
            <section className="ilx-section ilx-links ilx-live-editable">
              {editMode && <EditPencil label="Editar enlaces" onClick={()=>onEditSection?.("links")} />}<button type="button" className="ilx-links-toggle" onClick={() => setLinksOpen((current) => !current)} aria-expanded={linksOpen}><strong>Mis enlaces</strong><FaChevronDown className={linksOpen ? 'ilx-chevron-open' : ''} /></button>
              {linksOpen && <div className="ilx-links-list">{customLinks.map((link) => <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" onClick={()=>onTrackEvent?.('custom_link',link.label)}><span>{link.label}</span><FaExternalLinkAlt /></a>)}</div>}
            </section>
          )}

          {beforeShareContent}

          <section className="ilx-share">
            <button type="button" onClick={shareProfile}><FaShareAlt /><span>Compartir</span></button>
            <button type="button" onClick={copyProfileLink}><FaLink /><span>{copied ? 'Enlace copiado' : 'Copiar enlace'}</span></button>
            <button type="button" onClick={openQrModal}><FaQrcode /><span>Código QR</span></button>
          </section>

          <footer className="ilx-footer">
            <a href="https://nfc.kawvoia.com" target="_blank" rel="noopener noreferrer">Creado con <strong>Kawvo Link</strong> · Crea el tuyo <strong>Gratis</strong></a>
            <a className="ilx-footer-login" href={footerSecondaryHref || loginUrl()} target={footerSecondaryHref ? "_blank" : undefined} rel={footerSecondaryHref ? "noopener noreferrer" : undefined} onClick={()=>footerSecondaryHref&&onTrackEvent?.('interest_click',footerSecondaryLabel||'Interés')}>{footerSecondaryLabel || "Iniciar sesión"}</a>
          </footer>
        </div>
      </div>

      {qrOpen && (
        <div className="ilx-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setQrOpen(false) }}>
          <article className="ilx-qr-modal" role="dialog" aria-modal="true" aria-labelledby="ilx-qr-title">
            <button type="button" className="ilx-modal-close" onClick={() => setQrOpen(false)} aria-label="Cerrar"><FaTimes /></button>
            <div className="ilx-qr-modal-body"><span className="ilx-qr-kicker">KAWVO LINK</span><h2 id="ilx-qr-title">Código QR</h2><p>Escanea para abrir este perfil.</p>{qrDataUrl && <div className="ilx-qr-image"><img src={qrDataUrl} alt={`Código QR de ${profile.name}`} /></div>}<strong className="ilx-qr-profile-name">{profile.name}</strong><div className="ilx-qr-actions"><button type="button" onClick={downloadProfileQr}><FaQrcode /><span>Descargar PNG</span></button><button type="button" onClick={saveProfileQrToPhotos}><FaAddressCard /><span>Guardar en Fotos</span></button><button type="button" className="ilx-qr-whatsapp" onClick={shareProfileQrWhatsApp}><FaWhatsapp /><span>Compartir por WhatsApp</span></button></div></div>
          </article>
        </div>
      )}

      {modal && (
        <div className="ilx-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null) }}>
          <article className="ilx-modal" role="dialog" aria-modal="true" aria-label={modal.item.title}>
            <button type="button" className="ilx-modal-close" onClick={() => setModal(null)} aria-label="Cerrar"><FaTimes /></button>
            <div className="ilx-modal-media">{modal.kind === 'portfolio' ? <img src={modal.item.image} alt={modal.item.title} /> : modal.item.image ? <img src={modal.item.image} alt={modal.item.title} /> : <span className="ilx-modal-service-icon">{serviceIcon(modal.item.iconKey)}</span>}</div>
            <div className="ilx-modal-body"><h2>{modal.item.title}</h2><p>{modal.item.description}</p>{hasWhatsapp && <a className="ilx-modal-cta" href={whatsappUrl(profile, modal.item.title)} target="_blank" rel="noopener noreferrer" onClick={()=>onTrackEvent?.('whatsapp',modal.item.title)}><FaWhatsapp /><span>Consultar por WhatsApp</span></a>}</div>
          </article>
        </div>
      )}
    </main>
  )
}