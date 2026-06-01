import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import IntapProfileV2, { type IntapProfileV2Profile } from './profile-templates/IntapProfileV2'
import IntapProfileJasonV3 from './profile-templates/IntapProfileJasonV3'
import IntapProfileNoviV4 from './profile-templates/IntapProfileNoviV4'
import IntapProfileRentaoRd from './profile-templates/IntapProfileRentaoRd'
import IntapProfile1AEventos from './profile-templates/IntapProfile1AEventos'
import { applyProfileSeo, buildProfileSeo } from '../lib/profileSeo'
import { getFallbackProfileSeo } from '../lib/profileFallbackSeo'

declare global {
  interface Window {
    turnstile?: any
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProfileLink {
  id: string
  label: string
  url: string
  is_cta?: number
}

interface VideoItem {
  id: string
  title: string
  url: string
  sort_order: number
}

interface SocialLink {
  id: string
  type: 'instagram' | 'tiktok' | 'email' | string
  url: string
  sort_order: number
}

interface GalleryItem {
  image_key: string
  image_url: string | null
}

interface Product {
  id: string
  title: string
  description: string | null
  price: string | null
  image_url: string | null
  whatsapp_text: string | null
  is_featured: number
  sort_order: number
}

interface FAQ {
  id: string
  question: string
  answer: string
  sort_order: number
}

interface ContactInfo {
  whatsapp: string | null
  email: string | null
  phone: string | null
  hours: string | null
  address: string | null
  map_url: string | null
}

interface PublicData {
  profileId: string
  slug: string
  planId: string
  themeId: string
  accentColor?: string
  buttonStyle?: string
  blocksOrder?: string[]
  name: string | null
  bio: string | null
  avatarUrl: string | null
  whatsapp_number: string | null
  templateId?: string | null
  templateData?: Record<string, string>
  social_links: SocialLink[]
  links: ProfileLink[]
  gallery: GalleryItem[]
  faqs: FAQ[]
  products: Product[]
  videos?: VideoItem[]
  featured_product: Product | null
  entitlements: { canUseVCard: boolean; maxLinks: number; maxPhotos: number; maxFaqs: number }
  contact: ContactInfo | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalize(s: string) {
  return (s || '').toLowerCase().trim()
}

function buildWaUrl(phoneOrUrl: string, name: string, slug: string, customText?: string | null): string {
  let phone = phoneOrUrl.replace(/\D/g, '')
  const waMatch = phoneOrUrl.match(/wa\.me\/(\d+)/)
  if (waMatch) phone = waMatch[1]

  const text =
    customText ??
    `Hola ${name || slug}, vi tu perfil en Intap Link y quiero más información`

  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
}

function getWhatsAppSource(data: PublicData): string | null {
  if (data.whatsapp_number) return data.whatsapp_number
  if (data.contact?.whatsapp) return data.contact.whatsapp
  const waLink = data.links.find(l => {
    const label = normalize(l.label)
    const url = normalize(l.url)
    return label.includes('whatsapp') || url.includes('wa.me') || url.includes('whatsapp')
  })
  return waLink?.url ?? null
}

function isMapLink(link: ProfileLink) {
  const label = normalize(link.label)
  const url = normalize(link.url)
  return (
    url.includes('google.com/maps') ||
    url.includes('maps.app.goo.gl') ||
    url.includes('goo.gl/maps') ||
    label.includes('mapa') ||
    label.includes('ubicación') ||
    label.includes('ubicacion') ||
    label.includes('cómo llegar') ||
    label.includes('como llegar') ||
    label.includes('dirección') ||
    label.includes('direccion')
  )
}

// Intenta generar un embed “seguro” si es posible.
// Si no lo logra, igual usamos fallback de abrir Maps.
function toGoogleMapsEmbedUrl(url: string): string | null {
  const u = (url || '').trim()
  if (!u) return null

  // Si el usuario ya pegó un embed, lo usamos tal cual
  if (u.includes('google.com/maps/embed')) return u

  // Para links normales, intentamos convertirlos a embed con “output=embed”.
  // Nota: no siempre funcionará por políticas de Google, por eso el fallback existe.
  try {
    const parsed = new URL(u)
    // Si ya tiene output=embed, ok
    if (parsed.searchParams.get('output') === 'embed') return parsed.toString()
    parsed.searchParams.set('output', 'embed')
    return parsed.toString()
  } catch {
    return null
  }
}

// ─── UI Sub-components ─────────────────────────────────────────────────────────

const SOCIAL_ICONS: Record<string, React.ReactNode> = {
  instagram: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.336 3.608 1.311.975.975 1.249 2.242 1.311 3.608.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.062 1.366-.336 2.633-1.311 3.608-.975.975-2.242 1.249-3.608 1.311-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.366-.062-2.633-.336-3.608-1.311-.975-.975-1.249-2.242-1.311-3.608C2.175 15.584 2.163 15.204 2.163 12s.012-3.584.07-4.85c.062-1.366.336-2.633 1.311-3.608.975-.975 2.242-1.249 3.608-1.311C8.416 2.175 8.796 2.163 12 2.163zm0-2.163C8.741 0 8.332.014 7.052.072 5.197.157 3.355.673 2.014 2.014.673 3.355.157 5.197.072 7.052.014 8.332 0 8.741 0 12c0 3.259.014 3.668.072 4.948.085 1.855.601 3.697 1.942 5.038 1.341 1.341 3.183 1.857 5.038 1.942C8.332 23.986 8.741 24 12 24s3.668-.014 4.948-.072c1.855-.085 3.697-.601 5.038-1.942 1.341-1.341 1.857-3.183 1.942-5.038C23.986 15.668 24 15.259 24 12s-.014-3.668-.072-4.948c-.085-1.855-.601-3.697-1.942-5.038C20.645.673 18.803.157 16.948.072 15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zm0 10.162a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
    </svg>
  ),
  tiktok: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.84 4.84 0 01-1.01-.07z"/>
    </svg>
  ),
  email: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <path d="m22 7-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7"/>
    </svg>
  ),
}

// ─── Template Block ───────────────────────────────────────────────────────────

function TemplateBlock({ templateId, data, waSource, name, slug }: {
  templateId: string
  data: Record<string, string>
  waSource: string | null
  name: string | null
  slug: string
}) {
  if (templateId === 'restaurante') {
    const hasContent = data.menu_highlight || data.reservas_url || data.delivery_url || data.delivery_note
    if (!hasContent) return null
    return (
      <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
          <span className="text-base">🍽️</span>
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Nuestro restaurante</p>
        </div>
        <div className="p-4 flex flex-col gap-3">
          {data.menu_highlight && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Especialidad</p>
              <p className="text-sm text-white/90">{data.menu_highlight}</p>
            </div>
          )}
          {data.delivery_note && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Horario</p>
              <p className="text-sm text-white/80">{data.delivery_note}</p>
            </div>
          )}
          <div className="flex flex-col gap-2 mt-1">
            {data.reservas_url && (
              <a
                href={data.reservas_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm bg-white/10 border border-white/10 text-white hover:bg-white/20 transition-colors active:scale-95"
              >
                📅 Reservar mesa
              </a>
            )}
            {data.delivery_url && (
              <a
                href={data.delivery_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm bg-white/10 border border-white/10 text-white hover:bg-white/20 transition-colors active:scale-95"
              >
                🛵 Pedir a domicilio
              </a>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (templateId === 'servicios') {
    const credentials = [data.credential_1, data.credential_2, data.credential_3].filter(Boolean)
    const hasContent = data.services_intro || data.calendly_url || data.years_experience || credentials.length > 0
    if (!hasContent) return null
    return (
      <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
          <span className="text-base">💼</span>
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Servicios profesionales</p>
        </div>
        <div className="p-4 flex flex-col gap-3">
          {data.services_intro && (
            <p className="text-sm text-white/80 leading-relaxed">{data.services_intro}</p>
          )}
          {(data.years_experience || credentials.length > 0) && (
            <div className="flex flex-wrap gap-2">
              {data.years_experience && (
                <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-white/80">
                  🏆 {data.years_experience} de experiencia
                </span>
              )}
              {credentials.map((c, i) => (
                <span key={i} className="text-xs font-bold px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-white/80">
                  ✓ {c}
                </span>
              ))}
            </div>
          )}
          {data.calendly_url && (
            <a
              href={data.calendly_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm bg-white/10 border border-white/10 text-white hover:bg-white/20 transition-colors active:scale-95"
            >
              📆 Agendar cita
            </a>
          )}
        </div>
      </div>
    )
  }

  if (templateId === 'eventos') {
    const hasContent = data.event_name || data.event_date || data.event_venue || data.ticket_url || data.lineup
    if (!hasContent) return null
    const fmtDate = data.event_date
      ? new Date(data.event_date + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
      : null
    return (
      <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
          <span className="text-base">🎭</span>
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Próximo evento</p>
        </div>
        <div className="p-4 flex flex-col gap-3">
          {data.event_name && <p className="text-base font-black text-white">{data.event_name}</p>}
          <div className="flex flex-wrap gap-3">
            {fmtDate && (
              <span className="flex items-center gap-1.5 text-xs text-white/70">
                📅 {fmtDate}
              </span>
            )}
            {data.event_venue && (
              <span className="flex items-center gap-1.5 text-xs text-white/70">
                📍 {data.event_venue}
              </span>
            )}
          </div>
          {data.lineup && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Programa</p>
              <p className="text-sm text-white/80 whitespace-pre-line">{data.lineup}</p>
            </div>
          )}
          {data.ticket_url && (
            <a
              href={data.ticket_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm bg-white/10 border border-white/10 text-white hover:bg-white/20 transition-colors active:scale-95"
            >
              🎟️ Comprar boletos
            </a>
          )}
        </div>
      </div>
    )
  }

  return null
}

function SocialIcons({ links }: { links: SocialLink[] }) {
  if (!links.length) return null
  return (
    <div className="flex justify-center gap-4 mb-6">
      {links.map(link => (
        <a
          key={link.id}
          href={link.type === 'email' && !link.url.startsWith('mailto:') ? `mailto:${link.url}` : link.url}
          target={link.type === 'email' ? undefined : '_blank'}
          rel="noopener noreferrer"
          aria-label={link.type}
          className="text-white/60 hover:text-intap-mint transition-colors active:scale-95"
        >
          {SOCIAL_ICONS[link.type] ?? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656l-1.1-1.1" />
            </svg>
          )}
        </a>
      ))}
    </div>
  )
}

function getEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      const vid =
        u.searchParams.get('v') ||
        (u.hostname === 'youtu.be' ? u.pathname.slice(1) : null) ||
        u.pathname.split('/').pop()
      if (vid) return `https://www.youtube.com/embed/${vid}`
    }
    if (u.hostname.includes('vimeo.com')) {
      const vid = u.pathname.split('/').filter(Boolean).pop()
      if (vid) return `https://player.vimeo.com/video/${vid}`
    }
  } catch { /* ignore */ }
  return null
}

function VideoBlock({ videos }: { videos: VideoItem[] }) {
  if (!videos.length) return null
  return (
    <div className="mb-8 text-left">
      <h2 className="text-xs font-bold text-intap-mint uppercase tracking-widest mb-3 px-1">Videos</h2>
      <div className="flex flex-col gap-4">
        {videos.map((v) => {
          const embedUrl = getEmbedUrl(v.url)
          if (!embedUrl) return null
          return (
            <div key={v.id} className="rounded-2xl overflow-hidden">
              {v.title && <p className="text-sm font-semibold text-white/80 mb-2">{v.title}</p>}
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  src={embedUrl}
                  title={v.title || 'Video'}
                  className="absolute inset-0 w-full h-full rounded-2xl"
                  frameBorder="0"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SmartWaButton({
  waSource,
  name,
  slug,
  profileId,
  onTrack
}: {
  waSource: string
  name: string
  slug: string
  profileId: string
  onTrack: (id: string) => void
}) {
  const url = buildWaUrl(waSource, name, slug)
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center gap-3 bg-[#25D366] text-white font-bold py-4 rounded-3xl w-full transition-transform active:scale-95 hover:brightness-110 shadow-lg"
      onClick={() => onTrack('whatsapp-smart')}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 shrink-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
      Enviar WhatsApp
    </a>
  )
}

function FeaturedProductCard({ product, onOpen }: { product: Product; onOpen: () => void }) {
  return (
    <div
      className="glass-card rounded-2xl overflow-hidden mb-4 text-left cursor-pointer hover:border-intap-mint/30 border border-white/5 transition-all"
      onClick={onOpen}
    >
      {product.image_url && <img src={product.image_url} alt={product.title} className="w-full h-36 object-cover" />}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="text-xs font-semibold text-intap-mint uppercase tracking-wider">Servicio Destacado</p>
          {product.price && (
            <span className="text-xs bg-intap-mint/10 text-intap-mint px-2 py-0.5 rounded-full font-bold shrink-0">
              {product.price}
            </span>
          )}
        </div>
        <h3 className="text-white font-bold text-base leading-snug mb-1">{product.title}</h3>
        {product.description && <p className="text-slate-400 text-sm leading-relaxed line-clamp-2">{product.description}</p>}
        <p className="mt-3 text-intap-mint text-sm font-semibold flex items-center gap-1">
          Ver detalles
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </p>
      </div>
    </div>
  )
}

function ProductModal({
  product,
  name,
  slug,
  waSource,
  onClose
}: {
  product: Product
  name: string
  slug: string
  waSource: string | null
  onClose: () => void
}) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose()
  }

  const waUrl = waSource ? buildWaUrl(waSource, name, slug, product.whatsapp_text) : null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-4 pb-24 sm:pb-0"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label={product.title}
    >
      <div className="bg-intap-card w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl border border-white/10 animate-fade-in">
        {product.image_url && (
          <div className="relative">
            <img src={product.image_url} alt={product.title} className="w-full h-44 object-cover" />
            <button
              onClick={onClose}
              className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm text-white rounded-full p-1.5 hover:bg-black/70 transition-colors"
              aria-label="Cerrar"
              type="button"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        <div className="p-5">
          {!product.image_url && (
            <div className="flex justify-end mb-2">
              <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors" aria-label="Cerrar" type="button">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {product.price && (
            <span className="inline-block text-xs bg-intap-mint/10 text-intap-mint px-2 py-0.5 rounded-full font-bold mb-2">
              {product.price}
            </span>
          )}
          <h2 className="text-white font-bold text-xl mb-2 leading-tight">{product.title}</h2>
          {product.description && <p className="text-slate-300 text-sm leading-relaxed mb-5">{product.description}</p>}

          {waUrl ? (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 bg-[#25D366] text-white font-bold py-3.5 rounded-2xl w-full transition-transform active:scale-95 hover:brightness-110"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Me interesa — Escribir por WhatsApp
            </a>
          ) : (
            <button
              onClick={onClose}
              className="w-full py-3.5 rounded-2xl border border-white/10 text-white/70 text-sm font-medium hover:bg-white/5 transition-colors"
              type="button"
            >
              Cerrar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function ImageSlider({ images }: { images: string[] }) {
  const [current, setCurrent] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => setCurrent(c => (c + 1) % images.length), 4000)
  }, [images.length])

  useEffect(() => {
    if (images.length < 2) return
    resetTimer()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [images.length, resetTimer])

  const prev = () => {
    setCurrent(c => (c - 1 + images.length) % images.length)
    resetTimer()
  }
  const next = () => {
    setCurrent(c => (c + 1) % images.length)
    resetTimer()
  }

  if (images.length === 0) return null

  return (
    <div className="relative w-full overflow-hidden rounded-2xl mb-6 bg-intap-card" style={{ height: 200 }}>
      {images.map((src, i) => (
        <div
          key={i}
          className="absolute inset-0 transition-opacity duration-500"
          style={{ opacity: i === current ? 1 : 0, pointerEvents: i === current ? 'auto' : 'none' }}
        >
          <img src={src} alt={`Slide ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
        </div>
      ))}

      {images.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 backdrop-blur-sm text-white rounded-full p-1.5 hover:bg-black/70 transition-colors z-10"
            aria-label="Anterior"
            type="button"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 backdrop-blur-sm text-white rounded-full p-1.5 hover:bg-black/70 transition-colors z-10"
            aria-label="Siguiente"
            type="button"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  setCurrent(i)
                  resetTimer()
                }}
                className={`rounded-full transition-all ${i === current ? 'w-4 h-2 bg-intap-mint' : 'w-2 h-2 bg-white/40'}`}
                aria-label={`Ir a slide ${i + 1}`}
                type="button"
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function Accordion({
  items,
  renderHeader,
  renderBody
}: {
  items: { id: string }[]
  renderHeader: (item: any) => React.ReactNode
  renderBody: (item: any) => React.ReactNode
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const toggle = (id: string) => setOpenId(prev => (prev === id ? null : id))

  return (
    <div className="flex flex-col gap-2">
      {items.map((item: any) => {
        const isOpen = openId === item.id
        return (
          <div key={item.id} className="glass-card rounded-2xl overflow-hidden border border-white/5">
            <button
              className="w-full flex items-center justify-between p-4 text-left"
              onClick={() => toggle(item.id)}
              aria-expanded={isOpen}
              type="button"
            >
              <span className="font-semibold text-sm text-white">{renderHeader(item)}</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-4 w-4 text-intap-mint shrink-0 ml-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div className="overflow-hidden transition-all duration-200" style={{ maxHeight: isOpen ? '400px' : '0px' }}>
              <div className="px-4 pb-4 text-sm text-slate-400 leading-relaxed border-t border-white/5 pt-3">
                {renderBody(item)}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Fase 3: Map Modal ────────────────────────────────────────────────────────

function MapModal({
  title,
  mapUrl,
  onClose
}: {
  title: string
  mapUrl: string
  onClose: () => void
}) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const embedUrl = useMemo(() => toGoogleMapsEmbedUrl(mapUrl), [mapUrl])
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const handleOverlay = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose()
  }

  const copyLocation = () => {
    navigator.clipboard.writeText(mapUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const waShare = () => {
    const text = encodeURIComponent(`Mi ubicación: ${mapUrl}`)
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-4 pb-24 sm:pb-0"
      onClick={handleOverlay}
      role="dialog"
      aria-modal="true"
      aria-label="Mapa"
    >
      <div className="bg-intap-card w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl border border-white/10 animate-fade-in">
        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-1">
            <div>
              <h3 className="text-white font-bold text-lg">Nuestra ubicación</h3>
              <button
                type="button"
                onClick={() => window.open(mapUrl, '_blank', 'noopener,noreferrer')}
                className="text-intap-mint text-sm font-semibold hover:underline cursor-pointer"
              >
                Cómo llegar
              </button>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors"
              aria-label="Cerrar"
              type="button"
            >
              ✕
            </button>
          </div>

          <p className="text-slate-400 text-sm mb-4 mt-2">
            {title}
          </p>

          <div className="rounded-2xl overflow-hidden border border-white/10 bg-black/20">
            {embedUrl ? (
              <iframe
                title="Mapa"
                src={embedUrl}
                className="w-full"
                style={{ height: 280 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div className="p-4 text-sm text-slate-300">
                No se pudo mostrar el mapa aquí, pero puedes abrirlo en Google Maps.
              </div>
            )}
          </div>

          {copied && (
            <div className="mt-3 text-sm text-intap-mint text-center font-semibold">
              ✅ Se copió tu ubicación
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={copyLocation}
              className="flex-1 py-3 rounded-2xl bg-intap-mint text-black font-extrabold hover:brightness-110 transition-all active:scale-95"
            >
              Copiar ubicación
            </button>
            <button
              type="button"
              onClick={waShare}
              className="flex-1 py-3 rounded-2xl bg-[#25D366] text-white font-extrabold hover:brightness-110 transition-all active:scale-95"
            >
              WhatsApp
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 rounded-2xl border border-white/10 text-white/80 hover:bg-white/5 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Fase 3: Popup (MVP) ──────────────────────────────────────────────────────
// Se activa por “link especial” (sin backend): si existe un link con label que contenga "promo" / "oferta" / "anuncio"
function shouldShowPromoPopup(links: ProfileLink[]) {
  const promo = links.find(l => {
    const label = normalize(l.label)
    return label.includes('promo') || label.includes('oferta') || label.includes('anuncio')
  })
  return promo || null
}

function PromoPopup({
  title,
  message,
  ctaLabel,
  ctaUrl,
  onClose
}: {
  title: string
  message: string
  ctaLabel: string
  ctaUrl: string
  onClose: () => void
}) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const handleOverlay = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose()
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[55] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-4 pb-24 sm:pb-0"
      onClick={handleOverlay}
      role="dialog"
      aria-modal="true"
      aria-label="Anuncio"
    >
      <div className="bg-intap-card w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl border border-white/10 animate-fade-in">
        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="text-white font-bold text-lg">{title}</h3>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors"
              aria-label="Cerrar"
              type="button"
            >
              ✕
            </button>
          </div>

          <p className="text-slate-300 text-sm leading-relaxed mb-4">
            {message}
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => window.open(ctaUrl, '_blank', 'noopener,noreferrer')}
              className="flex-1 py-3 rounded-2xl bg-intap-mint text-black font-extrabold hover:brightness-110 transition-all active:scale-95"
            >
              {ctaLabel}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 rounded-2xl border border-white/10 text-white/80 hover:bg-white/5 transition-colors"
            >
              Ahora no
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Fase 3: Chat Bubble (MVP) ────────────────────────────────────────────────
// Sin dependencias: burbuja + mini menú.
// Acciones: WhatsApp, Solicitar info, Mapa (si hay), Cerrar.
function ChatBubble({
  hasWa,
  onWhatsApp,
  onLead,
  onMap,
  canMap
}: {
  hasWa: boolean
  onWhatsApp: () => void
  onLead: () => void
  onMap: () => void
  canMap: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="fixed bottom-5 right-5 z-[70]">
      {open && (
        <div className="mb-3 w-72 rounded-2xl border border-white/10 bg-intap-card shadow-2xl overflow-hidden">
          <div className="p-4 border-b border-white/10">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-white font-bold text-sm">Asistente</p>
                <p className="text-slate-400 text-xs">¿Cómo te ayudo?</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
                aria-label="Cerrar chat"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="p-3 flex flex-col gap-2">
            {hasWa && (
              <button
                type="button"
                onClick={() => { setOpen(false); onWhatsApp() }}
                className="w-full text-left px-4 py-3 rounded-2xl bg-black/20 border border-white/10 text-white text-sm font-semibold hover:bg-white/5 transition-colors"
              >
                📲 Escribir por WhatsApp
              </button>
            )}

            <button
              type="button"
              onClick={() => { setOpen(false); onLead() }}
              className="w-full text-left px-4 py-3 rounded-2xl bg-black/20 border border-white/10 text-white text-sm font-semibold hover:bg-white/5 transition-colors"
            >
              📝 Solicitar información
            </button>

            {canMap && (
              <button
                type="button"
                onClick={() => { setOpen(false); onMap() }}
                className="w-full text-left px-4 py-3 rounded-2xl bg-black/20 border border-white/10 text-white text-sm font-semibold hover:bg-white/5 transition-colors"
              >
                🗺️ Ver mapa / Cómo llegar
              </button>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="h-14 w-14 rounded-full bg-intap-mint text-black font-black shadow-2xl flex items-center justify-center hover:brightness-110 active:scale-95 transition-all"
        aria-label="Abrir asistente"
      >
        💬
      </button>
    </div>
  )
}

// ─── Classic Pro Layout ───────────────────────────────────────────────────────

function ClassicAccordion({ items, accentColor }: { items: { id: string; question: string; answer: string }[]; accentColor: string }) {
  const [openId, setOpenId] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-2">
      {items.map(item => {
        const isOpen = openId === item.id
        return (
          <div key={item.id} className="classic-faq-item">
            <button
              type="button"
              className="classic-faq-trigger"
              onClick={() => setOpenId(prev => prev === item.id ? null : item.id)}
              aria-expanded={isOpen}
            >
              <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#0f172a', flex: 1 }}>{item.question}</span>
              <svg
                style={{ width: 16, height: 16, flexShrink: 0, color: accentColor, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div className="classic-faq-answer" style={{ maxHeight: isOpen ? '400px' : '0px' }}>
              <div className="classic-faq-answer-inner">{item.answer}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

const WA_SVG = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
)

function ClassicLayout({
  data,
  waSource,
  slug,
  accentColor,
  otherLinks,
  socialLinks,
  sliderImages,
  blocksOrder,
  onTrack,
  onOpenLead,
  onOpenProduct,
  anyModalOpen,
  onWhatsApp,
  onMap,
  canMap,
}: {
  data: PublicData
  waSource: string | null
  slug: string
  accentColor: string
  otherLinks: ProfileLink[]
  socialLinks: SocialLink[]
  sliderImages: string[]
  blocksOrder: string[]
  onTrack: (id: string) => void
  onOpenLead: () => void
  onOpenProduct: (p: Product) => void
  anyModalOpen: boolean
  onWhatsApp: () => void
  onMap: () => void
  canMap: boolean
}) {
  useEffect(() => {
    const id = 'intap-dancing-font'
    if (!document.getElementById(id)) {
      const link = document.createElement('link')
      link.id = id
      link.rel = 'stylesheet'
      link.href = 'https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&display=swap'
      document.head.appendChild(link)
    }
  }, [])

  const bannerImage = data.gallery[0]?.image_url ?? null

  const socialLinkHref = (link: SocialLink) =>
    link.type === 'email' && !link.url.startsWith('mailto:') ? `mailto:${link.url}` : link.url

  return (
    <div className="min-h-screen theme-classic pb-20">

      {/* ── Banner ── */}
      <div className="w-full relative overflow-hidden" style={{ height: 200 }}>
        {bannerImage ? (
          <img src={bannerImage} alt="portada" className="w-full h-full object-cover" />
        ) : (
          <div style={{ height: '100%', background: `linear-gradient(135deg, ${accentColor}55 0%, ${accentColor}cc 100%)` }} />
        )}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, background: 'linear-gradient(to top, #f0f9ff, transparent)' }} />
      </div>

      {/* ── Main content ── */}
      <div className="flex flex-col items-center px-4 animate-fade-in max-width-mobile mx-auto">

        {/* ── Avatar (overlaps banner) ── */}
        <div className="classic-avatar-wrap">
          {data.avatarUrl ? (
            <img src={data.avatarUrl} alt={data.name || ''} className="w-full h-full object-cover" />
          ) : (
            <span className="text-3xl font-bold" style={{ color: accentColor }}>
              {data.name?.charAt(0).toUpperCase() || slug?.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        {/* ── Name + Bio ── */}
        <h1 style={{ fontFamily: '"Dancing Script", cursive', fontSize: '2rem', lineHeight: 1.2, marginTop: 10, color: '#0f172a', textAlign: 'center' }}>
          {data.name || `@${slug}`}
        </h1>
        {data.bio && (
          <p style={{ color: '#64748b', fontSize: '0.875rem', textAlign: 'center', maxWidth: 320, marginTop: 8, lineHeight: 1.6 }}>
            {data.bio}
          </p>
        )}

        {/* ── WhatsApp CTA ── */}
        {waSource && (
          <a
            href={buildWaUrl(waSource, data.name || slug, data.slug)}
            target="_blank"
            rel="noopener noreferrer"
            className="classic-wa-btn"
            style={{ marginTop: 16 }}
            onClick={() => onTrack('whatsapp-smart')}
          >
            {WA_SVG}
            Enviar WhatsApp
          </a>
        )}

        {/* ── Social pills ── */}
        {socialLinks.length > 0 && (
          <div className="classic-social-row" style={{ marginTop: 12 }}>
            {socialLinks.map(link => (
              <a
                key={link.id}
                href={socialLinkHref(link)}
                target={link.type === 'email' ? undefined : '_blank'}
                rel="noopener noreferrer"
                className="classic-pill"
                style={{ borderColor: accentColor, color: accentColor }}
                onClick={() => onTrack(link.id)}
              >
                <span style={{ width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {SOCIAL_ICONS[link.type] ?? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                    </svg>
                  )}
                </span>
                <span className="capitalize">{link.type}</span>
              </a>
            ))}
          </div>
        )}

        {/* ── vCard pill ── */}
        {data.entitlements?.canUseVCard && (
          <div style={{ marginTop: 8 }}>
            <a
              href={`${(import.meta.env.VITE_API_URL || '').replace(/\/$/, '')}/api/v1/public/vcard/${data.profileId}`}
              download
              className="classic-pill"
              style={{ borderColor: '#94a3b8', color: '#475569' }}
              onClick={() => onTrack('vcard')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              Guardar Contacto
            </a>
          </div>
        )}

        {/* ── Featured product ── */}
        {data.featured_product && (
          <div style={{ width: '100%', marginTop: 20 }}>
            <p className="classic-section-title">Servicio destacado</p>
            <div className="classic-product-card" onClick={() => onOpenProduct(data.featured_product!)}>
              {data.featured_product.image_url && (
                <img src={data.featured_product.image_url} alt={data.featured_product.title} className="classic-product-img" />
              )}
              <div className="classic-product-body">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                  <p className="classic-product-title">{data.featured_product.title}</p>
                  {data.featured_product.price && (
                    <span className="classic-product-price" style={{ color: accentColor, whiteSpace: 'nowrap' }}>{data.featured_product.price}</span>
                  )}
                </div>
                {data.featured_product.description && (
                  <p className="classic-product-desc">{data.featured_product.description}</p>
                )}
                <div className="classic-product-actions">
                  {waSource && (
                    <a
                      href={buildWaUrl(waSource, data.name || slug, data.slug, data.featured_product.whatsapp_text)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="classic-btn-wa"
                      onClick={e => { e.stopPropagation(); onTrack(data.featured_product!.id) }}
                    >
                      {WA_SVG}
                      Compartir
                    </a>
                  )}
                  <button type="button" className="classic-btn-outline" onClick={e => { e.stopPropagation(); onOpenProduct(data.featured_product!) }}>
                    Ver detalles
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Dynamic sections (respeta blocksOrder) ── */}
        <div style={{ width: '100%', marginTop: 20 }}>
          {blocksOrder.map(blockId => {

            if (blockId === 'gallery' && sliderImages.length > 0) {
              return (
                <div key="gallery" style={{ marginBottom: 24 }}>
                  <p className="classic-section-title">Galería</p>
                  <div className="bento-snap-scroll">
                    {sliderImages.map((src, i) => (
                      <div key={i} className="bento-snap-item" style={{ height: 200 }}>
                        <img src={src} alt={`Imagen ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                      </div>
                    ))}
                  </div>
                </div>
              )
            }

            if (blockId === 'products' && data.products && data.products.length > 0) {
              return (
                <div key="products" style={{ marginBottom: 24 }}>
                  <p className="classic-section-title">Servicios</p>
                  {data.products.map(p => (
                    <div key={p.id} className="classic-product-card" onClick={() => onOpenProduct(p)}>
                      {p.image_url && <img src={p.image_url} alt={p.title} className="classic-product-img" />}
                      <div className="classic-product-body">
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                          <p className="classic-product-title">{p.title}</p>
                          {p.price && <span className="classic-product-price" style={{ color: accentColor, whiteSpace: 'nowrap' }}>{p.price}</span>}
                        </div>
                        {p.description && <p className="classic-product-desc">{p.description}</p>}
                        <div className="classic-product-actions">
                          {waSource && (
                            <a
                              href={buildWaUrl(waSource, data.name || slug, data.slug, p.whatsapp_text)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="classic-btn-wa"
                              onClick={e => { e.stopPropagation(); onTrack(p.id) }}
                            >
                              {WA_SVG}
                              Compartir
                            </a>
                          )}
                          <button type="button" className="classic-btn-outline" onClick={e => { e.stopPropagation(); onOpenProduct(p) }}>
                            Ver detalles
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            }

            if (blockId === 'video' && data.videos && data.videos.length > 0) {
              return (
                <div key="video" style={{ marginBottom: 24 }}>
                  <p className="classic-section-title">Videos</p>
                  {data.videos.map(v => {
                    const embedUrl = getEmbedUrl(v.url)
                    if (!embedUrl) return null
                    return (
                      <div key={v.id} className="classic-card" style={{ marginBottom: 10 }}>
                        {v.title && <p style={{ padding: '10px 14px 0', fontWeight: 600, fontSize: '0.8125rem', color: '#0f172a' }}>{v.title}</p>}
                        <div style={{ position: 'relative', paddingBottom: '56.25%', marginTop: v.title ? 8 : 0 }}>
                          <iframe
                            src={embedUrl}
                            title={v.title || 'Video'}
                            className="absolute inset-0 w-full h-full"
                            frameBorder="0"
                            allowFullScreen
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            }

            if (blockId === 'faqs' && data.faqs && data.faqs.length > 0) {
              return (
                <div key="faqs" style={{ marginBottom: 24 }}>
                  <p className="classic-section-title">Preguntas frecuentes</p>
                  <ClassicAccordion items={data.faqs} accentColor={accentColor} />
                </div>
              )
            }

            if (blockId === 'links' && otherLinks.length > 0) {
              return (
                <div key="links" style={{ marginBottom: 24 }}>
                  <p className="classic-section-title">Enlaces</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {otherLinks.map(link => (
                      <a
                        key={link.id}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="classic-link-btn"
                        style={{
                          borderColor: link.is_cta ? accentColor : '#e2e8f0',
                          backgroundColor: link.is_cta ? accentColor : '#fff',
                          color: link.is_cta ? '#fff' : '#0f172a',
                        }}
                        onClick={() => onTrack(link.id)}
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                </div>
              )
            }

            return null
          })}
        </div>

        {/* ── CTA contacto ── */}
        <button type="button" className="classic-contact-btn" style={{ marginBottom: 16 }} onClick={onOpenLead}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          Solicitar información
        </button>

        {/* ── Footer ── */}
        <footer className="mt-4 mb-2 opacity-40 text-xs font-medium tracking-tight text-[#0f172a]">
          <Link to="/">Crea tu perfil en <span className="font-bold">INTAP LINK</span></Link>
        </footer>
      </div>

      {/* ── Chat Bubble ── */}
      {!anyModalOpen && (
        <ChatBubble
          hasWa={!!waSource}
          onWhatsApp={onWhatsApp}
          onLead={onOpenLead}
          onMap={onMap}
          canMap={canMap}
        />
      )}
    </div>
  )
}

// ─── Bento Mastery Layout ─────────────────────────────────────────────────────

function getBentoVideoEmbed(url: string): { type: 'iframe' | 'video'; src: string } | null {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      const vid =
        u.searchParams.get('v') ||
        (u.hostname === 'youtu.be' ? u.pathname.slice(1) : null) ||
        u.pathname.split('/').pop()
      if (vid)
        return {
          type: 'iframe',
          src: `https://www.youtube.com/embed/${vid}?autoplay=1&mute=1&loop=1&playlist=${vid}&controls=0&modestbranding=1&rel=0`,
        }
    }
    if (u.hostname.includes('vimeo.com')) {
      const vid = u.pathname.split('/').filter(Boolean).pop()
      if (vid)
        return {
          type: 'iframe',
          src: `https://player.vimeo.com/video/${vid}?autoplay=1&muted=1&loop=1&background=1`,
        }
    }
    if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url)) return { type: 'video', src: url }
  } catch { /* ignore */ }
  return null
}

function BentoLayout({
  data,
  waSource,
  slug,
  accentColor,
  otherLinks,
  socialLinks,
  sliderImages,
  onTrack,
  onOpenLead,
  anyModalOpen,
  onWhatsApp,
  onMap,
  canMap,
}: {
  data: PublicData
  waSource: string | null
  slug: string
  accentColor: string
  otherLinks: ProfileLink[]
  socialLinks: SocialLink[]
  sliderImages: string[]
  onTrack: (id: string) => void
  onOpenLead: () => void
  anyModalOpen: boolean
  onWhatsApp: () => void
  onMap: () => void
  canMap: boolean
}) {
  const firstVideo = data.videos && data.videos.length > 0 ? data.videos[0] : null
  const videoEmbed = firstVideo ? getBentoVideoEmbed(firstVideo.url) : null

  // Up to 2 social icons placed alongside the video cell
  const sideIcons = socialLinks.slice(0, 2)
  // Remaining items for the second row of small cards
  const extraIcons = [...socialLinks.slice(2), ...otherLinks.slice(0, 4)]

  const renderSocialSvg = (type: string) => {
    if (type === 'instagram')
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.336 3.608 1.311.975.975 1.249 2.242 1.311 3.608.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.062 1.366-.336 2.633-1.311 3.608-.975.975-2.242 1.249-3.608 1.311-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.366-.062-2.633-.336-3.608-1.311-.975-.975-1.249-2.242-1.311-3.608C2.175 15.584 2.163 15.204 2.163 12s.012-3.584.07-4.85c.062-1.366.336-2.633 1.311-3.608.975-.975 2.242-1.249 3.608-1.311C8.416 2.175 8.796 2.163 12 2.163zm0-2.163C8.741 0 8.332.014 7.052.072 5.197.157 3.355.673 2.014 2.014.673 3.355.157 5.197.072 7.052.014 8.332 0 8.741 0 12c0 3.259.014 3.668.072 4.948.085 1.855.601 3.697 1.942 5.038 1.341 1.341 3.183 1.857 5.038 1.942C8.332 23.986 8.741 24 12 24s3.668-.014 4.948-.072c1.855-.085 3.697-.601 5.038-1.942 1.341-1.341 1.857-3.183 1.942-5.038C23.986 15.668 24 15.259 24 12s-.014-3.668-.072-4.948c-.085-1.855-.601-3.697-1.942-5.038C20.645.673 18.803.157 16.948.072 15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zm0 10.162a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
        </svg>
      )
    if (type === 'tiktok')
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7">
          <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.84 4.84 0 01-1.01-.07z" />
        </svg>
      )
    if (type === 'email')
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
          <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7" />
        </svg>
      )
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101M10.172 13.828a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656l-1.1-1.1" />
      </svg>
    )
  }

  return (
    <div className="min-h-screen theme-bento flex flex-col items-center pb-20 px-4 pt-10">
      <div className="w-full max-width-mobile animate-fade-in">

        {/* ── Hero ── */}
        <div className="flex flex-col items-center text-center mb-6">
          <div
            className="w-20 h-20 rounded-full mb-4 overflow-hidden flex items-center justify-center bg-white shadow-md"
            style={{ border: `3px solid ${accentColor}` }}
          >
            {data.avatarUrl ? (
              <img src={data.avatarUrl} alt={data.name || ''} className="w-full h-full object-cover" />
            ) : data.gallery.length > 0 && data.gallery[0].image_url ? (
              <img src={data.gallery[0].image_url} alt={data.name || ''} className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-bold" style={{ color: accentColor }}>
                {data.name?.charAt(0).toUpperCase() || slug?.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold text-[#1d1d1f] mb-1">{data.name || `@${slug}`}</h1>
          {data.bio && (
            <p className="text-sm text-[#6e6e73] leading-relaxed max-w-xs">{data.bio}</p>
          )}
        </div>

        {/* ── WhatsApp CTA ── */}
        {waSource && (
          <div className="mb-4">
            <a
              href={buildWaUrl(waSource, data.name || slug, data.slug)}
              target="_blank"
              rel="noopener noreferrer"
              className="bento-wa-btn"
              onClick={() => onTrack('whatsapp-smart')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Enviar WhatsApp
            </a>
          </div>
        )}

        {/* ── Bento Grid (3 columns) ── */}
        <div className="bento-grid mb-3">

          {/* Video cell — 2 cols × 2 rows */}
          <div className="bento-video-cell bento-card">
            {videoEmbed ? (
              videoEmbed.type === 'iframe' ? (
                <iframe
                  src={videoEmbed.src}
                  title={firstVideo?.title || 'Último Proyecto'}
                  className="absolute inset-0 w-full h-full"
                  frameBorder="0"
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                  style={{ pointerEvents: 'none' }}
                />
              ) : (
                <video
                  src={videoEmbed.src}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )
            ) : (
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ backgroundColor: `${accentColor}12` }}
              >
                <svg className="w-12 h-12 opacity-25" style={{ color: accentColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            )}
            {/* Text overlay */}
            <div
              className="absolute bottom-0 left-0 right-0 p-3"
              style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)' }}
            >
              <p className="text-white text-[10px] font-bold uppercase tracking-widest opacity-80">Último Proyecto</p>
              {firstVideo?.title && (
                <p className="text-white/80 text-xs leading-snug mt-0.5 line-clamp-2">{firstVideo.title}</p>
              )}
            </div>
          </div>

          {/* Side icon cells (1×1 each) — first 2 social links */}
          {sideIcons.length >= 1 && (
            <div className="bento-icon-cell bento-card">
              <a
                href={sideIcons[0].type === 'email' && !sideIcons[0].url.startsWith('mailto:') ? `mailto:${sideIcons[0].url}` : sideIcons[0].url}
                target={sideIcons[0].type === 'email' ? undefined : '_blank'}
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1.5 text-[#6e6e73] hover:text-[#1d1d1f] transition-colors w-full h-full justify-center"
                aria-label={sideIcons[0].type}
                onClick={() => onTrack(sideIcons[0].id)}
              >
                {renderSocialSvg(sideIcons[0].type)}
                <span className="text-[10px] font-semibold capitalize">{sideIcons[0].type}</span>
              </a>
            </div>
          )}
          {sideIcons.length >= 2 ? (
            <div className="bento-icon-cell bento-card">
              <a
                href={sideIcons[1].type === 'email' && !sideIcons[1].url.startsWith('mailto:') ? `mailto:${sideIcons[1].url}` : sideIcons[1].url}
                target={sideIcons[1].type === 'email' ? undefined : '_blank'}
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1.5 text-[#6e6e73] hover:text-[#1d1d1f] transition-colors w-full h-full justify-center"
                aria-label={sideIcons[1].type}
                onClick={() => onTrack(sideIcons[1].id)}
              >
                {renderSocialSvg(sideIcons[1].type)}
                <span className="text-[10px] font-semibold capitalize">{sideIcons[1].type}</span>
              </a>
            </div>
          ) : sideIcons.length === 1 ? (
            /* Filler cell when only 1 social link */
            <div className="bento-icon-cell bento-card">
              <button
                type="button"
                onClick={onOpenLead}
                className="flex flex-col items-center gap-1.5 text-[#6e6e73] hover:text-[#1d1d1f] transition-colors w-full h-full justify-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span className="text-[10px] font-semibold">Contacto</span>
              </button>
            </div>
          ) : (
            /* 2 filler cells when no social links */
            <>
              <div className="bento-icon-cell bento-card">
                <button
                  type="button"
                  onClick={onOpenLead}
                  className="flex flex-col items-center gap-1.5 text-[#6e6e73] hover:text-[#1d1d1f] transition-colors w-full h-full justify-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span className="text-[10px] font-semibold">Contacto</span>
                </button>
              </div>
              <div className="bento-icon-cell bento-card">
                <div className="flex flex-col items-center gap-1.5 text-[#6e6e73]">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3l14 9-14 9V3z" />
                  </svg>
                  <span className="text-[10px] font-semibold">Proyectos</span>
                </div>
              </div>
            </>
          )}

          {/* Image snap-scroll carousel — full width (col-span 3) */}
          {sliderImages.length > 0 && (
            <div className="bento-carousel-cell bento-card p-3">
              <p className="text-[10px] font-bold text-[#6e6e73] uppercase tracking-widest mb-2 px-1">Galería</p>
              <div className="bento-snap-scroll">
                {sliderImages.map((src, i) => (
                  <div key={i} className="bento-snap-item" style={{ height: 160 }}>
                    <img src={src} alt={`Imagen ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Extra small icon cards (remaining social + links) ── */}
        {extraIcons.length > 0 && (
          <div className="bento-grid mb-3">
            {extraIcons.slice(0, 6).map((item: any) => {
              const isSocial = 'type' in item
              const href = isSocial
                ? (item.type === 'email' && !item.url.startsWith('mailto:') ? `mailto:${item.url}` : item.url)
                : item.url
              const label = isSocial ? item.type : item.label
              return (
                <div key={item.id} className="bento-icon-cell bento-card" style={{ minHeight: 80 }}>
                  <a
                    href={href}
                    target={isSocial && item.type === 'email' ? undefined : '_blank'}
                    rel="noopener noreferrer"
                    className="flex flex-col items-center gap-1.5 text-[#6e6e73] hover:text-[#1d1d1f] transition-colors w-full h-full justify-center py-4"
                    onClick={() => onTrack(item.id)}
                  >
                    {isSocial ? renderSocialSvg(item.type) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101M10.172 13.828a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656l-1.1-1.1" />
                      </svg>
                    )}
                    <span className="text-[10px] font-semibold text-center px-1 truncate w-full text-center capitalize">{label}</span>
                  </a>
                </div>
              )
            })}
          </div>
        )}

        {/* ── CTA card — Solicitar información ── */}
        <button
          type="button"
          className="bento-card w-full p-4 mb-3 flex items-center gap-3 active:scale-[0.98] transition-transform text-left"
          onClick={onOpenLead}
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${accentColor}15` }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" style={{ color: accentColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-bold text-[#1d1d1f]">Solicitar información</p>
            <p className="text-xs text-[#6e6e73]">Respondo lo antes posible</p>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#6e6e73] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* ── Footer ── */}
        <footer className="mt-8 text-center opacity-40 text-xs font-medium tracking-tight text-[#1d1d1f]">
          <Link to="/">Crea tu perfil en <span className="font-bold">INTAP LINK</span></Link>
        </footer>

        {/* ── Chat Bubble ── */}
        {!anyModalOpen && (
          <ChatBubble
            hasWa={!!waSource}
            onWhatsApp={onWhatsApp}
            onLead={onOpenLead}
            onMap={onMap}
            canMap={canMap}
          />
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PublicProfile() {
  const params = useParams()
  const slug =
    (params.slug as string | undefined) ||
    new URLSearchParams(window.location.search).get('slug') ||
    ''
  const isPreview = new URLSearchParams(window.location.search).get('preview') === '1'

  const [data, setData] = useState<PublicData | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorStatus, setErrorStatus] = useState<number | null>(null)

  // Modals
  const [modalProduct, setModalProduct] = useState<Product | null>(null)
  const [leadOpen, setLeadOpen] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const [promoOpen, setPromoOpen] = useState(false)

  // Lead form state
  const [leadSending, setLeadSending] = useState(false)
  const [leadStatus, setLeadStatus] = useState<string | null>(null)
  const [leadName, setLeadName] = useState('')
  const [leadEmail, setLeadEmail] = useState('')
  const [leadPhone, setLeadPhone] = useState('')
  const [leadMessage, setLeadMessage] = useState('')
  const [leadHp, setLeadHp] = useState('') // honeypot

  // Turnstile (solo cuando el backend lo pida)
  const [turnstileSitekey, setTurnstileSitekey] = useState<string | null>(null)
  const [turnstileToken, setTurnstileToken] = useState<string>('')

  /** Cierra el modal de contacto y limpia todo el estado relacionado */
  const closeLead = useCallback(() => {
    setLeadOpen(false)
    setTurnstileSitekey(null)
    setTurnstileToken('')
    setLeadStatus(null)
  }, [])

  // ── Track ───────────────────────────────────────────────────────────────────
  const trackEvent = (profileId: string, eventType: string, targetId?: string) => {
    const apiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
    fetch(`${apiUrl}/api/v1/public/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId, eventType, targetId })
    }).catch(() => { })
  }

  // ── GEO / SEO metadata + JSON-LD ─────────────────────────────────────────────
  useEffect(() => {
    if (!data) return

    const seo = buildProfileSeo(data)
    applyProfileSeo(seo)
  }, [data])

  // ── GEO / SEO fallback metadata para plantillas rápidas ─────────────────────
  useEffect(() => {
    if (data) return

    const seo = getFallbackProfileSeo(slug)
    if (!seo) return

    applyProfileSeo(seo)
  }, [data, slug])

  // ── Fetch profile ───────────────────────────────────────────────────────────
  useEffect(() => {
    const apiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

    if (!slug) {
      setLoading(false)
      setErrorStatus(404)
      return
    }

    const profileUrl = isPreview
      ? `${apiUrl}/api/v1/public/profiles/${encodeURIComponent(slug)}?preview=1`
      : `${apiUrl}/api/v1/public/profiles/${encodeURIComponent(slug)}`

    fetch(profileUrl, { credentials: 'include' })
      .then(res => {
        if (!res.ok) {
          setErrorStatus(res.status)
          throw new Error(`HTTP ${res.status}`)
        }
        return res.json()
      })
      .then(json => {
        setData(json.data)
        if (!isPreview) trackEvent(json.data.profileId, 'view')
      })
      .catch(() => { })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  // ── Lead modal: ESC + scroll lock ───────────────────────────────────────────
  useEffect(() => {
    if (!leadOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeLead() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [leadOpen, closeLead])

  // ── Turnstile script load (only when needed) ────────────────────────────────
  useEffect(() => {
    if (!leadOpen || !turnstileSitekey) return
    if (document.querySelector('script[data-intap-turnstile="1"]')) return

    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true
    s.defer = true
    s.setAttribute('data-intap-turnstile', '1')
    document.body.appendChild(s)
  }, [leadOpen, turnstileSitekey])

  // ✅ Promo popup (once per session) — debe ir ANTES de guard clauses (rules of hooks)
  useEffect(() => {
    if (!data) return
    const promo = shouldShowPromoPopup(data.links)
    if (!promo) return

    const key = `intap_promo_seen_${data.profileId}`
    const already = sessionStorage.getItem(key) === '1'
    if (already) return

    sessionStorage.setItem(key, '1')
    setPromoOpen(true)
  }, [data])

  // ── Turnstile helpers ───────────────────────────────────────────────────────
  const turnstileWidgetIdRef = useRef<string | null>(null)
  const lastRenderSitekeyRef = useRef<string | null>(null)

  const cleanupTurnstile = useCallback(() => {
    const container = document.getElementById('intap-turnstile')
    if (container) {
      container.removeAttribute('data-rendered')
      container.innerHTML = ''
    }

    const w: any = window.turnstile
    const wid = turnstileWidgetIdRef.current
    try {
      if (w && wid) {
        if (typeof w.remove === 'function') w.remove(wid)
        if (typeof w.reset === 'function') w.reset(wid)
      }
    } catch { /* noop */ }

    turnstileWidgetIdRef.current = null
    lastRenderSitekeyRef.current = null
  }, [])

  // ── Submit lead (near-production) ───────────────────────────────────────────
  const submitLead = useCallback(async (tokenOverride?: string) => {
    if (!data) return
    setLeadStatus(null)

    if (!leadName.trim() || leadName.trim().length < 2) { setLeadStatus('Por favor escribe tu nombre.'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leadEmail.trim())) { setLeadStatus('Por favor escribe un correo válido.'); return }
    if (!leadMessage.trim() || leadMessage.trim().length < 10) { setLeadStatus('Cuéntame un poco más (mín. 10 caracteres).'); return }

    const apiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
    setLeadSending(true)

    const tokenToSend = (tokenOverride ?? turnstileToken) || undefined

    try {
      const res = await fetch(`${apiUrl}/api/v1/public/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_slug: data.slug,
          name: leadName.trim(),
          email: leadEmail.trim(),
          phone: leadPhone.trim(),
          message: leadMessage.trim(),
          hp: leadHp.trim(),
          source_url: window.location.href,
          turnstile_token: tokenToSend
        })
      })

      const json: any = await res.json().catch(() => ({}))

      // ✅ Condicional: backend exige Turnstile
      if (res.status === 403 && json?.error === 'turnstile_required') {
        const sitekey = String(json.sitekey || '').trim()
        if (!sitekey) { setLeadStatus('⚠️ Verificación requerida, pero falta sitekey.'); return }

        // resetea token previo (evita loops)
        setTurnstileToken('')
        setTurnstileSitekey(sitekey)
        setLeadStatus('⚠️ Completa la verificación para poder enviar.')
        return
      }

      if (res.status === 201 && json.ok) {
        setLeadStatus('✅ Listo. Recibí tu mensaje.')
        setLeadName('')
        setLeadEmail('')
        setLeadPhone('')
        setLeadMessage('')
        setLeadHp('')

        setTurnstileToken('')
        setTurnstileSitekey(null)

        setTimeout(() => setLeadOpen(false), 700)
        return
      }

      setLeadStatus(`⚠️ No se pudo enviar: ${json.error || `Error ${res.status}`}`)
    } catch {
      setLeadStatus('⚠️ Error de red. Intenta de nuevo.')
    } finally {
      setLeadSending(false)
    }
  }, [data, leadName, leadEmail, leadPhone, leadMessage, leadHp, turnstileToken])

  // ── Cleanup cuando se cierra el modal ───────────────────────────────────────
  useEffect(() => {
    if (leadOpen) return
    cleanupTurnstile()
    setTurnstileToken('')
    setTurnstileSitekey(null)
    setLeadStatus(null)
  }, [leadOpen, cleanupTurnstile])

  // ── Render Turnstile + auto-resubmit ────────────────────────────────────────
  useEffect(() => {
    if (!leadOpen || !turnstileSitekey) return

    const tryRender = () => {
      const w: any = window.turnstile
      const container = document.getElementById('intap-turnstile')
      if (!w || !container) return false

      // evita rerender si ya está renderizado para ese sitekey
      if (lastRenderSitekeyRef.current === turnstileSitekey && container.getAttribute('data-rendered') === '1') {
        return true
      }

      cleanupTurnstile()
      container.innerHTML = ''

      const widgetId = w.render(container, {
        sitekey: turnstileSitekey,
        callback: (token: string) => {
          const t = token || ''
          setTurnstileToken(t)
          setLeadStatus('✅ Verificación lista. Enviando...')
          void submitLead(t)
        },
        'error-callback': () => {
          setTurnstileToken('')
          setLeadStatus('⚠️ Falló la verificación. Intenta de nuevo.')
        },
        'expired-callback': () => {
          setTurnstileToken('')
          setLeadStatus('⚠️ Verificación expirada. Vuelve a intentar.')
        }
      })

      turnstileWidgetIdRef.current = widgetId ? String(widgetId) : null
      lastRenderSitekeyRef.current = turnstileSitekey
      container.setAttribute('data-rendered', '1')
      return true
    }

    if (tryRender()) return

    const t = setInterval(() => {
      if (tryRender()) clearInterval(t)
    }, 250)

    const kill = setTimeout(() => {
      clearInterval(t)
      setLeadStatus(prev => prev || '⚠️ No se pudo cargar la verificación. Intenta de nuevo.')
    }, 5000)

    return () => {
      clearInterval(t)
      clearTimeout(kill)
    }
  }, [leadOpen, turnstileSitekey, cleanupTurnstile, submitLead])

  // ── Guard clauses ───────────────────────────────────────────────────────────
  if (loading) return <div className="loading-screen"><div className="loading-spinner"></div></div>
  if (errorStatus === 403) return <PrivateBlock slug={slug || ''} />

  // Preview controlado: permite desarrollar la plantilla nueva /jason aunque el slug aún no exista en D1.
  // Cuando el perfil jason esté sembrado en DB, seguirá usando el flujo normal con data real.
  if ((errorStatus || !data) && slug === 'jason') {
    return <IntapProfileJasonV3 profile={{ slug: 'jason' }} />
  }

  if ((errorStatus || !data) && slug === 'novi') {
    return <IntapProfileNoviV4 profile={{ slug: 'novi' }} />
  }

  if ((errorStatus || !data) && slug === 'rentaord') {
    return <IntapProfileRentaoRd profile={{ slug: 'rentaord' }} />
  }

  if ((errorStatus || !data) && slug === '1aeventos') {
    return <IntapProfile1AEventos />
  }

  if (errorStatus || !data) return <NotFound />

  // ── Derived data ────────────────────────────────────────────────────────────
  const waSource = getWhatsAppSource(data)
  const mapLink = data.links?.find(isMapLink) || null
  const anyModalOpen = !!(modalProduct || leadOpen || mapOpen || promoOpen)
  const isFree = data.planId === 'basic'

  const allOtherLinks = data.links.filter(l => {
    const label = normalize(l.label)
    const url = normalize(l.url)
    const isWhatsApp = label.includes('whatsapp') || url.includes('wa.me') || url.includes('whatsapp')
    const isMap = isMapLink(l)
    return !isWhatsApp && !isMap
  })
  const otherLinks = isFree ? allOtherLinks.slice(0, 2) : allOtherLinks

  const allSocialLinks = data.social_links ?? []
  const socialLinks = isFree ? allSocialLinks.slice(0, 3) : allSocialLinks

  const sliderImages = data.gallery.slice(1).filter(g => g.image_url).map(g => g.image_url!)

  const promoLink = shouldShowPromoPopup(data.links)

  const accentColor = data.accentColor || '#3B82F6'
  const buttonStyle = data.buttonStyle || 'rounded'
  const blocksOrder: string[] = data.blocksOrder?.length ? data.blocksOrder : ['links', 'faqs', 'products', 'video', 'gallery']

  const buttonRadius = buttonStyle === 'pill' ? '9999px' : buttonStyle === 'square' ? '4px' : '12px'
  const isOutline = buttonStyle === 'outline'

  function LinkButton({ link }: { link: ProfileLink }) {
    const isCTA = link.is_cta === 1
    return (
      <a
        key={link.id}
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackEvent(data!.profileId, 'click', link.id)}
        className="flex items-center justify-center gap-2 py-3 px-2 text-sm font-semibold transition-colors active:scale-95"
        style={{
          borderRadius: buttonRadius,
          backgroundColor: isCTA
            ? accentColor
            : isOutline
            ? 'transparent'
            : 'rgba(255,255,255,0.05)',
          color: isCTA ? '#fff' : isOutline ? accentColor : 'rgba(255,255,255,0.9)',
          border: isOutline || isCTA ? `2px solid ${accentColor}` : '1px solid rgba(255,255,255,0.08)',
          boxShadow: isCTA ? `0 4px 18px ${accentColor}55` : undefined,
        }}
      >
        <span className="truncate">{link.label}</span>
        {isCTA && <span className="shrink-0 text-xs opacity-70">→</span>}
      </a>
    )
  }

  // Plantillas legacy classic/bento inactivadas.
  // Desde este punto todo perfil público renderiza la plantilla base oficial IntapProfileV2.
  // La selección visual anterior se conserva en código histórico/backups, pero ya no decide el render público.

  const publicProfileV2: IntapProfileV2Profile = {
    ...(data as any),
    avatarUrl: (data as any).avatarUrl ?? (data as any).avatar_url,
    accentColor: (data as any).accentColor ?? (data as any).accent_color,
    whatsappNumber: (data as any).whatsappNumber ?? (data as any).whatsapp_number,
    companyName: (data as any).companyName ?? (data as any).company_name,
    companyLogo: (data as any).companyLogo ?? (data as any).company_logo,
    companyAbout: (data as any).companyAbout ?? (data as any).company_about,
    mapUrl: (data as any).mapUrl ?? (data as any).map_url,
    templateData: (data as any).templateData ?? {},
  }

  if (data.slug === 'novi') {
    return <IntapProfileNoviV4 profile={publicProfileV2} />
  }

  if (data.slug === 'jason') {
    return <IntapProfileJasonV3 profile={publicProfileV2} />
  }

  if (data.slug === 'rentaord') {
    return <IntapProfileRentaoRd profile={publicProfileV2} />
  }

  if (data.slug === '1aeventos') {
    return <IntapProfile1AEventos />
  }

  return <IntapProfileV2 profile={publicProfileV2} />


}

// ─── Error screens ────────────────────────────────────────────────────────────

function PrivateBlock({ slug }: { slug: string }) {
  return (
    <div className="public-profile error-page">
      <div className="profile-card">
        <h1>Perfil Privado 🔒</h1>
        <p>El perfil de <strong>@{slug}</strong> no está disponible públicamente en este momento.</p>
        <Link
          to="/"
          className="btn-primary"
          style={{ marginTop: '1.5rem', display: 'inline-block', textDecoration: 'none' }}
        >
          Volver al Inicio
        </Link>
      </div>
    </div>
  )
}

function NotFound() {
  return (
    <div className="public-profile error-page">
      <div className="profile-card">
        <h1>No encontrado 😕</h1>
        <p>Este perfil no existe o no está disponible.</p>
        <Link
          to="/"
          className="btn-primary"
          style={{ marginTop: '1.5rem', display: 'inline-block', textDecoration: 'none' }}
        >
          Volver al Inicio
        </Link>
      </div>
    </div>
  )
}
