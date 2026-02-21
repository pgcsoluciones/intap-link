import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'

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

interface PublicData {
  profileId: string
  slug: string
  themeId: string
  name: string | null
  bio: string | null
  whatsapp_number: string | null
  links: ProfileLink[]
  gallery: GalleryItem[]
  faqs: FAQ[]
  products: Product[]
  featured_product: Product | null
  entitlements: { canUseVCard: boolean; maxLinks: number; maxPhotos: number; maxFaqs: number }
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
    `Hola ${name || 'amigo'}, vi tu perfil en intap.link/${slug} y me interesa saber más.`

  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
}

function getWhatsAppSource(data: PublicData): string | null {
  if (data.whatsapp_number) return data.whatsapp_number
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-4 pb-4 sm:pb-0"
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
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-4 pb-4 sm:pb-0"
      onClick={handleOverlay}
      role="dialog"
      aria-modal="true"
      aria-label="Mapa"
    >
      <div className="bg-intap-card w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl border border-white/10 animate-fade-in">
        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="text-white font-bold text-lg">Cómo llegar</h3>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors"
              aria-label="Cerrar"
              type="button"
            >
              ✕
            </button>
          </div>

          <p className="text-slate-400 text-sm mb-4">
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

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => window.open(mapUrl, '_blank', 'noopener,noreferrer')}
              className="flex-1 py-3 rounded-2xl bg-intap-mint text-black font-extrabold hover:brightness-110 transition-all active:scale-95"
            >
              Abrir en Maps
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
      className="fixed inset-0 z-[55] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-4 pb-4 sm:pb-0"
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

// ─── Main component ───────────────────────────────────────────────────────────

export default function PublicProfile() {
  const params = useParams()
  const slug =
    (params.slug as string | undefined) ||
    new URLSearchParams(window.location.search).get('slug') ||
    ''

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

  // ── Track ───────────────────────────────────────────────────────────────────
  const trackEvent = (profileId: string, eventType: string, targetId?: string) => {
    const apiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
    fetch(`${apiUrl}/api/v1/public/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId, eventType, targetId })
    }).catch(() => { })
  }

  // ── Fetch profile ───────────────────────────────────────────────────────────
  useEffect(() => {
    const apiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

    if (!slug) {
      setLoading(false)
      setErrorStatus(404)
      return
    }

    fetch(`${apiUrl}/api/v1/public/profiles/${encodeURIComponent(slug)}`)
      .then(res => {
        if (!res.ok) {
          setErrorStatus(res.status)
          throw new Error(`HTTP ${res.status}`)
        }
        return res.json()
      })
      .then(json => {
        setData(json.data)
        trackEvent(json.data.profileId, 'view')
      })
      .catch(() => { })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  // ── Lead modal: ESC + scroll lock ───────────────────────────────────────────
  useEffect(() => {
    if (!leadOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLeadOpen(false) }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [leadOpen])

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

  const submitLead = async () => {
    if (!data) return
    setLeadStatus(null)

    if (!leadName.trim() || leadName.trim().length < 2) { setLeadStatus('Por favor escribe tu nombre.'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leadEmail.trim())) { setLeadStatus('Por favor escribe un correo válido.'); return }
    if (!leadMessage.trim() || leadMessage.trim().length < 10) { setLeadStatus('Cuéntame un poco más (mín. 10 caracteres).'); return }

    const apiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
    setLeadSending(true)

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
          turnstile_token: turnstileToken || undefined
        })
      })

      const json: any = await res.json().catch(() => ({}))

      // ✅ Condicional: backend exige Turnstile
      if (res.status === 403 && json?.error === 'turnstile_required') {
        const sitekey = String(json.sitekey || '').trim()
        if (!sitekey) { setLeadStatus('⚠️ Verificación requerida, pero falta sitekey.'); return }

        setTurnstileSitekey(sitekey)
        setLeadStatus('⚠️ Completa la verificación para poder enviar.')

        const renderWidget = () => {
          const w: any = window.turnstile
          const container = document.getElementById('intap-turnstile')
          if (!w || !container) return false
          if (container.getAttribute('data-rendered') === '1') return true

          container.innerHTML = ''
          w.render(container, {
            sitekey,
            callback: (token: string) => {
              setTurnstileToken(token || '')
              setLeadStatus('✅ Verificación lista. Presiona Enviar nuevamente.')
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
          container.setAttribute('data-rendered', '1')
          return true
        }

        if (!renderWidget()) {
          const t = setInterval(() => { if (renderWidget()) clearInterval(t) }, 250)
          setTimeout(() => clearInterval(t), 5000)
        }

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
  }

  // ── Guard clauses ───────────────────────────────────────────────────────────
  if (loading) return <div className="loading-screen"><div className="loading-spinner"></div></div>
  if (errorStatus === 403) return <PrivateBlock slug={slug || ''} />
  if (errorStatus || !data) return <NotFound />

  // ── Derived data ────────────────────────────────────────────────────────────
  const waSource = getWhatsAppSource(data)
  const mapLink = data.links?.find(isMapLink) || null

  const otherLinks = data.links.filter(l => {
    const label = normalize(l.label)
    const url = normalize(l.url)
    const isWhatsApp = label.includes('whatsapp') || url.includes('wa.me') || url.includes('whatsapp')
    const isMap = isMapLink(l)
    return !isWhatsApp && !isMap
  })

  const sliderImages = data.gallery.slice(1).filter(g => g.image_url).map(g => g.image_url!)

  const promoLink = shouldShowPromoPopup(data.links)

  return (
    <div className="min-h-screen bg-intap-dark flex justify-center items-start pt-12 pb-20 px-4">
      <div className="w-full max-width-mobile text-center animate-fade-in">

        {/* ── Hero ── */}
        <div className="mb-8">
          <div className="w-24 h-24 rounded-full mx-auto mb-6 border-2 border-intap-mint p-1 shadow-[0_0_20px_rgba(13,242,201,0.3)] bg-intap-card flex items-center justify-center overflow-hidden">
            {data.gallery.length > 0 && data.gallery[0].image_url ? (
              <img src={data.gallery[0].image_url} alt={data.name || ''} className="w-full h-full object-cover rounded-full" />
            ) : (
              <span className="text-3xl font-bold text-intap-mint">
                {data.name?.charAt(0).toUpperCase() || slug?.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">{data.name || `@${slug}`}</h1>
          <p className="text-sm text-slate-400 font-medium px-4 leading-relaxed">
            {data.bio || 'Bienvenido a mi perfil digital profesional.'}
          </p>
        </div>

        {/* ── Smart WhatsApp CTA ── */}
        {waSource && (
          <div className="mb-6">
            <SmartWaButton
              waSource={waSource}
              name={data.name || slug || ''}
              slug={data.slug}
              profileId={data.profileId}
              onTrack={(id) => trackEvent(data.profileId, 'click', id)}
            />
          </div>
        )}

        {/* ── Fase 3: Botón Mapa (Punto B) ── */}
        {mapLink && (
          <div className="mb-6 grid grid-cols-2 gap-2">
            <button
              type="button"
              className="w-full rounded-2xl py-3 px-4 text-sm font-semibold bg-intap-mint text-black hover:brightness-110 active:scale-95 transition-all"
              onClick={() => { setMapOpen(true); trackEvent(data.profileId, 'click', 'map-modal') }}
            >
              Ver mapa
            </button>
            <button
              type="button"
              className="w-full rounded-2xl py-3 px-4 text-sm font-semibold border border-white/10 text-white/90 glass-card hover:bg-white/10 active:scale-95 transition-all"
              onClick={() => { window.open(mapLink.url, "_blank", "noopener,noreferrer"); trackEvent(data.profileId, 'click', 'map-open') }}
            >
              Cómo llegar
            </button>
          </div>
        )}

        {/* ── vCard ── */}
        {data.entitlements?.canUseVCard && (
          <a
            href={`${(import.meta.env.VITE_API_URL || '').replace(/\/$/, '')}/api/v1/public/vcard/${data.profileId}`}
            className="btn-gradient w-full mb-6 transform hover:scale-[1.02] active:scale-95 transition-all"
            onClick={() => trackEvent(data.profileId, 'click', 'vcard')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Guardar Contacto (vCard)
          </a>
        )}

        {/* ── CTA Captura (Fase 3: Leads) ── */}
        <div className="mb-6">
          <button
            type="button"
            className="w-full py-4 rounded-3xl font-bold text-white/90 border border-white/10 glass-card hover:bg-white/10 transition-colors active:scale-95"
            onClick={() => { setLeadStatus(null); setLeadOpen(true); trackEvent(data.profileId, 'click', 'lead-open') }}
          >
            Solicitar información
          </button>
        </div>

        {/* ── Producto Destacado ── */}
        {data.featured_product && (
          <div className="mb-2 text-left">
            <FeaturedProductCard
              product={data.featured_product}
              onOpen={() => setModalProduct(data.featured_product)}
            />
          </div>
        )}

        {/* ── Otros enlaces ── */}
        {otherLinks.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-8">
            {otherLinks.map(link => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-3 px-2 rounded-2xl glass-card text-sm font-semibold text-white/90 hover:bg-white/10 transition-colors"
                onClick={() => trackEvent(data.profileId, 'click', link.id)}
              >
                <span className="truncate">{link.label}</span>
              </a>
            ))}
          </div>
        )}

        {/* ── Slider ── */}
        {sliderImages.length > 0 && <ImageSlider images={sliderImages} />}

        {/* ── Productos / Servicios ── */}
        {data.products && data.products.length > 0 && (
          <div className="mb-8 text-left">
            <h2 className="text-xs font-bold text-intap-mint uppercase tracking-widest mb-3 px-1">
              Servicios
            </h2>
            <Accordion
              items={data.products}
              renderHeader={(p: Product) => (
                <span className="flex items-center justify-between gap-2 w-full pr-1">
                  <span>{p.title}</span>
                  {p.price && <span className="text-intap-mint text-xs font-bold shrink-0">{p.price}</span>}
                </span>
              )}
              renderBody={(p: Product) => (
                <div>
                  {p.description && <p className="mb-3">{p.description}</p>}
                  {waSource && (
                    <a
                      href={buildWaUrl(waSource, data.name || slug || '', data.slug, p.whatsapp_text)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-[#25D366] text-white text-xs font-bold px-4 py-2 rounded-full hover:brightness-110 transition-all"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                      Me interesa
                    </a>
                  )}
                </div>
              )}
            />
          </div>
        )}

        {/* ── FAQ ── */}
        {data.faqs && data.faqs.length > 0 && (
          <div className="mb-8 text-left">
            <h2 className="text-xs font-bold text-intap-mint uppercase tracking-widest mb-3 px-1">
              Preguntas frecuentes
            </h2>
            <Accordion
              items={data.faqs}
              renderHeader={(f: FAQ) => f.question}
              renderBody={(f: FAQ) => f.answer}
            />
          </div>
        )}

        <footer className="mt-12 opacity-40 text-xs font-medium tracking-tight">
          <Link to="/">Crea tu propio perfil en <span className="font-bold">INTAP LINK</span></Link>
        </footer>
      </div>

      {/* ── Chat Bubble (Fase 3) ── */}
      <ChatBubble
        hasWa={!!waSource}
        onWhatsApp={() => {
          if (!waSource) return
          const url = buildWaUrl(waSource, data.name || slug || '', data.slug)
          window.open(url, '_blank', 'noopener,noreferrer')
          trackEvent(data.profileId, 'click', 'chat-whatsapp')
        }}
        onLead={() => { setLeadStatus(null); setLeadOpen(true); trackEvent(data.profileId, 'click', 'chat-lead') }}
        onMap={() => { if (mapLink) { setMapOpen(true); trackEvent(data.profileId, 'click', 'chat-map') } }}
        canMap={!!mapLink}
      />

      {/* ── Modal Producto ── */}
      {modalProduct && (
        <ProductModal
          product={modalProduct}
          name={data.name || slug || ''}
          slug={data.slug}
          waSource={waSource}
          onClose={() => setModalProduct(null)}
        />
      )}

      {/* ── Modal Mapa (Fase 3 Punto B) ── */}
      {mapOpen && mapLink && (
        <MapModal
          title={`Ubicación de ${data.name || '@' + data.slug}`}
          mapUrl={mapLink.url}
          onClose={() => setMapOpen(false)}
        />
      )}

      {/* ── Popup Promo (Fase 3 MVP) ── */}
      {promoOpen && promoLink && (
        <PromoPopup
          title={promoLink.label || 'Oferta'}
          message="Tenemos una promoción disponible. Presiona el botón para ver los detalles."
          ctaLabel="Ver oferta"
          ctaUrl={promoLink.url}
          onClose={() => setPromoOpen(false)}
        />
      )}

      {/* ── Modal Contacto (Fase 3 Leads) ── */}
      {leadOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-4 pb-4 sm:pb-0"
          onClick={(e) => { if (e.target === e.currentTarget) setLeadOpen(false) }}
          role="dialog"
          aria-modal="true"
          aria-label="Formulario de contacto"
        >
          <div className="bg-intap-card w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl border border-white/10 animate-fade-in">
            <div className="p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="text-white font-bold text-lg">Contáctame</h3>
                <button
                  onClick={() => setLeadOpen(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                  aria-label="Cerrar"
                  type="button"
                >
                  ✕
                </button>
              </div>

              <p className="text-slate-400 text-sm mb-4">
                Déjame tus datos y te respondo lo antes posible.
              </p>

              {/* Honeypot */}
              <input
                value={leadHp}
                onChange={(e) => setLeadHp(e.target.value)}
                autoComplete="off"
                tabIndex={-1}
                style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, width: 0 }}
              />

              <div className="flex flex-col gap-3">
                <input
                  className="w-full px-4 py-3 rounded-2xl bg-black/20 border border-white/10 text-white placeholder:text-white/30 outline-none focus:border-intap-mint/50"
                  placeholder="Tu nombre"
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                />
                <input
                  className="w-full px-4 py-3 rounded-2xl bg-black/20 border border-white/10 text-white placeholder:text-white/30 outline-none focus:border-intap-mint/50"
                  placeholder="Tu correo"
                  value={leadEmail}
                  onChange={(e) => setLeadEmail(e.target.value)}
                />
                <input
                  className="w-full px-4 py-3 rounded-2xl bg-black/20 border border-white/10 text-white placeholder:text-white/30 outline-none focus:border-intap-mint/50"
                  placeholder="Teléfono (opcional)"
                  value={leadPhone}
                  onChange={(e) => setLeadPhone(e.target.value)}
                />
                <textarea
                  className="w-full px-4 py-3 rounded-2xl bg-black/20 border border-white/10 text-white placeholder:text-white/30 outline-none focus:border-intap-mint/50"
                  placeholder="¿Qué necesitas?"
                  rows={4}
                  value={leadMessage}
                  onChange={(e) => setLeadMessage(e.target.value)}
                />

                {/* Turnstile condicional */}
                {turnstileSitekey && (
                  <div className="bg-black/20 border border-white/10 rounded-2xl px-4 py-4">
                    <div className="text-xs text-slate-300 mb-3">Verificación de seguridad</div>
                    <div id="intap-turnstile" className="flex justify-center" />
                  </div>
                )}

                <button
                  type="button"
                  disabled={leadSending}
                  onClick={submitLead}
                  className="w-full py-3.5 rounded-2xl bg-intap-mint text-black font-extrabold hover:brightness-110 transition-all active:scale-95 disabled:opacity-60"
                >
                  {leadSending ? 'Enviando...' : 'Enviar'}
                </button>

                {leadStatus && (
                  <div className="text-sm text-slate-200 bg-black/20 border border-white/10 rounded-2xl px-4 py-3">
                    {leadStatus}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
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