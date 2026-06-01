import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiGet, apiPost, apiPut } from '../../lib/api'
import RetentionPanel from './RetentionPanel'

// ─── Preview Panel ────────────────────────────────────────────────────────────
function PreviewPanel({ previewUrl, iframeRef, onClose }: {
  previewUrl: string
  iframeRef: React.RefObject<HTMLIFrameElement>
  onClose: () => void
}) {
  const refresh = () => {
    if (iframeRef.current) {
      const src = iframeRef.current.src
      iframeRef.current.src = ''
      iframeRef.current.src = src
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-intap-dark flex flex-col" style={{ fontFamily: 'Inter, sans-serif' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0 bg-intap-dark">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Cerrar
        </button>
        <span className="text-sm font-bold text-white">Vista previa</span>
        <button
          onClick={refresh}
          className="flex items-center gap-1.5 text-sm text-intap-mint hover:text-white transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Actualizar
        </button>
      </div>
      <iframe
        ref={iframeRef}
        src={previewUrl}
        className="flex-1 w-full border-0"
        title="Vista previa del perfil"
      />
    </div>
  )
}

const SLUG_RE  = /^[a-z0-9_-]{2,32}$/
const RESERVED = new Set(['admin','api','auth','me','assets','health','public','login','logout',
  'check-email','onboarding','dashboard','settings','account','profile','superadmin',
  'about','pricing','blog','help','terms','privacy','contact','www','favicon','static',
  'images','app','link'])

interface MeData {
  id: string
  email: string
  profile_id: string | null
  slug: string | null
  name: string | null
  bio: string | null
  avatar_url: string | null
  category: string | null
  is_published: number
  theme_id: string | null
  plan_id: string | null
  plan_code?: string
  trial_status?: 'active' | 'expired' | 'none'
  trial_expires_at?: string | null
  paused_features_count?: number
  recoverable_items_count?: number
}

interface Stats {
  totalViews: number
  topLinks: { label: string; clics: number }[]
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [me, setMe]             = useState<MeData | null>(null)
  const [linkCount, setLinkCount] = useState(0)
  const [stats, setStats]       = useState<Stats | null>(null)
  const [loading, setLoading]   = useState(true)
  const [publishing, setPublishing]   = useState(false)
  // Slug editing
  const [slugEditing, setSlugEditing] = useState(false)
  const [newSlug, setNewSlug]         = useState('')
  const [slugSaving, setSlugSaving]   = useState(false)
  const [slugError, setSlugError]     = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)

  useEffect(() => {
    Promise.all([apiGet('/me'), apiGet('/me/links')])
      .then(([meJson, linksJson]: any[]) => {
        if (meJson.ok) {
          const data: MeData = meJson.data
          setMe(data)
          if (data.profile_id) {
            apiGet(`/profile/stats/${data.profile_id}`).then((statsJson: any) => {
              if (statsJson.ok) setStats(statsJson.stats)
            })
          }
        }
        if (linksJson.ok) setLinkCount(linksJson.data?.length || 0)
      })
      .finally(() => setLoading(false))
  }, [])

  const handleLogout = async () => {
    try { await apiPost('/auth/logout', {}) } catch { /* ignore */ }
    // Hard redirect (not SPA navigate) so the full page reloads and all
    // React state is cleared. AdminGuard will re-check the session from scratch.
    window.location.replace('/admin/login')
  }

  const refreshPreview = () => {
    if (iframeRef.current) {
      const src = iframeRef.current.src
      iframeRef.current.src = ''
      iframeRef.current.src = src
    }
  }

  const togglePublished = async () => {
    if (!me) return
    setPublishing(true)
    const next = me.is_published ? 0 : 1
    const res: any = await apiPut('/me/profile', { is_published: next === 1 })
    if (res.ok) {
      setMe({ ...me, is_published: next })
      refreshPreview()
    }
    setPublishing(false)
  }

  const startSlugEdit = () => {
    setNewSlug(me?.slug || '')
    setSlugError('')
    setSlugEditing(true)
  }

  const handleSlugSave = async () => {
    const s = newSlug.toLowerCase().replace(/[^a-z0-9_-]/g, '')
    setNewSlug(s)
    if (!SLUG_RE.test(s)) { setSlugError('2–32 chars: letras, números, _ o -'); return }
    if (RESERVED.has(s))  { setSlugError('Slug reservado, elige otro'); return }
    setSlugSaving(true)
    setSlugError('')
    try {
      const res: any = await apiPut('/me/profile/slug', { slug: s })
      if (res.ok) {
        setMe((prev) => prev ? { ...prev, slug: res.slug } : prev)
        setSlugEditing(false)
      } else {
        setSlugError(res.error || 'No disponible')
      }
    } catch {
      setSlugError('Error de conexión')
    } finally {
      setSlugSaving(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-intap-dark flex items-center justify-center">
      <div className="loading-spinner" />
    </div>
  )

  const WEB_URL    = (import.meta.env.VITE_WEB_URL ?? 'https://intaprd.com').replace(/\/$/, '')
  const profileUrl = me?.slug ? `${WEB_URL}/${me.slug}` : null
  const previewUrl = me?.slug ? `${WEB_URL}/${me.slug}?preview=1` : null

  const handleShare = async () => {
    if (!profileUrl) return
    if (navigator.share) {
      try {
        await navigator.share({ title: me?.name ?? 'Mi perfil', url: profileUrl })
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(profileUrl)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    }
  }

  const navItems = [
    { emoji: '📝', label: 'Info principal',         sub: 'Nombre, bio y foto',               to: '/admin/onboarding/identity' },
    { emoji: '📱', label: 'Contacto y redes',        sub: 'WhatsApp, email, horario…',        to: '/admin/onboarding/contact' },
    { emoji: '🛍️', label: 'Productos / Servicios',  sub: 'Catálogo con precios',              to: '/admin/products' },
    { emoji: '🔗', label: 'Links',                   sub: 'Agregar, editar y reordenar',       to: '/admin/links' },
    { emoji: '🎨', label: 'Estilo visual',           sub: 'Colores, plantilla y botones',      to: '/admin/visual' },
    { emoji: '📋', label: 'Preguntas frecuentes',    sub: 'FAQs de tu perfil',                 to: '/admin/faqs' },
    { emoji: '▶️', label: 'Videos',                 sub: 'YouTube y Vimeo',                   to: '/admin/videos' },
    { emoji: '⬛', label: 'Orden de secciones',      sub: 'Arrastra para reordenar',           to: '/admin/blocks' },
    { emoji: '🏷️', label: 'Plantilla vertical',     sub: 'Restaurante · Servicios · Eventos', to: '/admin/template' },
    { emoji: '📸', label: 'Galería de fotos',        sub: 'Fotos de tu perfil y negocio',      to: '/admin/visual' },
  ]

  return (
    <div className="min-h-screen bg-intap-dark text-white font-['Inter']">
      {/* Live preview overlay */}
      {previewOpen && previewUrl && (
        <PreviewPanel
          previewUrl={previewUrl}
          iframeRef={iframeRef}
          onClose={() => setPreviewOpen(false)}
        />
      )}

      {/* ── Top bar ── */}
      <header className="sticky top-0 z-40 bg-intap-dark/95 backdrop-blur border-b border-white/5 px-4 py-3 flex items-center justify-between">
        <span className="text-base font-black tracking-tight text-white">
          INTAP<span className="text-intap-mint">·</span>link
        </span>
        <button
          onClick={handleLogout}
          className="text-xs text-slate-400 hover:text-white transition-colors border border-white/10 px-3 py-1.5 rounded-full"
        >
          Cerrar sesión
        </button>
      </header>

      <div className="max-w-sm mx-auto px-4 py-6 flex flex-col gap-6 pb-10">

        {/* ── Hero: avatar + greeting ── */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-intap-mint/10 border border-intap-mint/20 flex items-center justify-center text-2xl overflow-hidden shrink-0">
            {me?.avatar_url
              ? <img src={me.avatar_url} alt="" className="w-full h-full object-cover" />
              : '👤'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-base leading-tight">
              Hola, {me?.name?.split(' ')[0] || 'bienvenido'} 👋
            </p>
            {me?.category && <p className="text-xs text-intap-mint mt-0.5">{me.category}</p>}
          </div>
        </div>

        {/* ── No slug banner ── */}
        {!me?.slug && (
          <div className="glass-card p-4 border border-yellow-400/30 bg-yellow-400/5">
            <p className="text-sm font-bold text-yellow-300 mb-1">Completa tu perfil</p>
            <p className="text-xs text-slate-400 mb-3">Elige tu URL para que tu perfil sea accesible.</p>
            <button
              onClick={() => navigate('/admin/onboarding/slug')}
              className="w-full py-2 rounded-xl bg-yellow-400/20 text-yellow-300 text-xs font-bold border border-yellow-400/30 hover:bg-yellow-400/30 transition-colors"
            >
              Elegir mi URL →
            </button>
          </div>
        )}

        {/* ── Profile status card ── */}
        {me?.slug && (
          <div className="glass-card p-4 flex flex-col gap-3">
            {/* Status badge */}
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${me.is_published ? 'bg-intap-mint' : 'bg-orange-400'}`} />
              <span className={`text-xs font-black uppercase tracking-wide ${me.is_published ? 'text-intap-mint' : 'text-orange-400'}`}>
                {me.is_published ? 'PUBLICADO' : 'NO PUBLICADO'}
              </span>
            </div>

            {/* URL */}
            <p className="text-sm font-mono text-slate-300">intaprd.com/{me.slug}</p>

            {/* Actions row */}
            <div className="flex gap-2">
              <a
                href={profileUrl ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-intap-mint/10 border border-intap-mint/30 text-intap-mint text-xs font-bold hover:bg-intap-mint/20 transition-colors"
              >
                Ver perfil
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
              <button
                onClick={handleShare}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-xs font-bold hover:bg-white/10 transition-colors"
              >
                {shareCopied ? '¡Copiado!' : 'Compartir 🔗'}
              </button>
              {previewUrl && (
                <button
                  onClick={() => setPreviewOpen(true)}
                  className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-colors"
                  title="Vista previa"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </button>
              )}
            </div>

            {/* Toggle published */}
            <button
              onClick={togglePublished}
              disabled={publishing}
              className={`w-full py-2 rounded-xl text-xs font-bold transition-colors border ${
                me.is_published
                  ? 'bg-white/5 text-slate-400 hover:bg-red-500/10 hover:text-red-400 border-white/10'
                  : 'bg-intap-mint/10 text-intap-mint hover:bg-intap-mint/20 border-intap-mint/30'
              }`}
            >
              {publishing ? '…' : me.is_published ? 'Despublicar perfil' : 'Publicar perfil'}
            </button>
          </div>
        )}

        {/* ── Slug editor ── */}
        {me?.slug && (
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Tu URL</p>
              {!slugEditing && (
                <button onClick={startSlugEdit} className="text-xs text-intap-mint hover:underline">
                  Cambiar
                </button>
              )}
            </div>
            {slugEditing ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-3 py-2 focus-within:border-intap-mint/50 transition-colors">
                  <span className="text-slate-500 text-xs select-none mr-1">…/</span>
                  <input
                    type="text"
                    value={newSlug}
                    onChange={(e) => {
                      setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))
                      setSlugError('')
                    }}
                    maxLength={32}
                    className="bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none flex-1"
                    placeholder="mi-nombre"
                    autoFocus
                  />
                  {newSlug.length >= 2 && (
                    <span className={`text-xs font-bold ml-1 ${SLUG_RE.test(newSlug) && !RESERVED.has(newSlug) ? 'text-intap-mint' : 'text-red-400'}`}>
                      {SLUG_RE.test(newSlug) && !RESERVED.has(newSlug) ? '✓' : '✗'}
                    </span>
                  )}
                </div>
                {slugError && <p className="text-xs text-red-400">{slugError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={handleSlugSave}
                    disabled={slugSaving}
                    className="flex-1 text-xs bg-intap-mint/20 text-intap-mint border border-intap-mint/30 py-2 rounded-xl font-bold hover:bg-intap-mint/30 transition-colors disabled:opacity-50"
                  >
                    {slugSaving ? 'Guardando…' : 'Guardar'}
                  </button>
                  <button
                    onClick={() => setSlugEditing(false)}
                    className="flex-1 text-xs bg-white/5 text-slate-400 border border-white/10 py-2 rounded-xl hover:text-white transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm font-mono text-intap-mint">intaprd.com/{me.slug}</p>
            )}
          </div>
        )}

        {/* ── Retention panel ── */}
        {me?.profile_id && (
          <RetentionPanel
            profileId={me.profile_id}
            initialPausedFeaturesCount={me.paused_features_count ?? 0}
            initialRecoverableItemsCount={me.recoverable_items_count ?? 0}
            initialTrialStatus={me.trial_status ?? 'none'}
            initialTrialExpiresAt={me.trial_expires_at ?? null}
          />
        )}

        {/* ── Edición rápida ── */}
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Edición rápida</p>
          <div className="flex flex-col gap-2">
            {navItems.map((item) => (
              <button
                key={item.to + item.label}
                onClick={() => navigate(item.to)}
                className="glass-card p-4 flex items-center justify-between hover:bg-white/5 active:scale-[0.98] transition-all text-left w-full"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl w-7 text-center">{item.emoji}</span>
                  <div>
                    <p className="text-sm font-bold leading-tight">{item.label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{item.sub}</p>
                  </div>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        </div>

        {/* ── Mi plan ── */}
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Mi plan</p>
          <div className="glass-card p-4 flex flex-col gap-1">
            <p className="text-sm font-bold capitalize text-intap-mint">{me?.plan_id ?? 'Free'}</p>
            <p className="text-xs text-slate-400">
              {linkCount} link{linkCount !== 1 ? 's' : ''}
              {stats?.totalViews != null && (
                <> · <span className="text-slate-300">{stats.totalViews} visitas este mes</span></>
              )}
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}
