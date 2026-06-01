import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPost, apiPut } from '../../lib/api'
import RetentionPanel from './RetentionPanel'

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
  const [me, setMe]               = useState<MeData | null>(null)
  const [linkCount, setLinkCount] = useState(0)
  const [stats, setStats]         = useState<Stats | null>(null)
  const [loading, setLoading]     = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [slugEditing, setSlugEditing] = useState(false)
  const [newSlug, setNewSlug]       = useState('')
  const [slugSaving, setSlugSaving] = useState(false)
  const [slugError, setSlugError]   = useState('')
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
    window.location.replace('/admin/login')
  }

  const togglePublished = async () => {
    if (!me) return
    setPublishing(true)
    const next = me.is_published ? 0 : 1
    const res: any = await apiPut('/me/profile', { is_published: next === 1 })
    if (res.ok) setMe({ ...me, is_published: next })
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

  const handleShare = async () => {
    if (!profileUrl) return
    if (navigator.share) {
      try { await navigator.share({ title: me?.name ?? 'Mi perfil', url: profileUrl }) } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(profileUrl)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="loading-spinner" />
    </div>
  )

  const WEB_URL    = (import.meta.env.VITE_WEB_URL ?? 'https://intaprd.com').replace(/\/$/, '')
  const profileUrl = me?.slug ? `${WEB_URL}/${me.slug}` : null
  const previewUrl = me?.slug ? `${WEB_URL}/${me.slug}?preview=1` : null

  const navItems = [
    { emoji: '✏️', label: 'Editar perfil',           sub: 'Nombre, bio y foto',               to: '/admin/onboarding/identity' },
    { emoji: '📞', label: 'Datos de contacto',        sub: 'WhatsApp, email, horario…',        to: '/admin/onboarding/contact' },
    { emoji: '🛍️', label: 'Productos / Servicios',   sub: 'Catálogo con precios',              to: '/admin/products' },
    { emoji: '🔗', label: 'Links',                    sub: 'Agregar, editar y reordenar',       to: '/admin/links' },
    { emoji: '📋', label: 'Preguntas frecuentes',     sub: 'FAQs de tu perfil',                 to: '/admin/faqs' },
    { emoji: '▶️', label: 'Videos',                  sub: 'YouTube y Vimeo',                   to: '/admin/videos' },
    { emoji: '📸', label: 'Galería de fotos',         sub: 'Fotos de tu perfil y negocio',      to: '/admin/gallery' },
    { emoji: '🎨', label: 'Estilo visual',            sub: 'Colores y estilo de botones',       to: '/admin/visual' },
    { emoji: '⬛', label: 'Orden de secciones',       sub: 'Arrastra para reordenar',           to: '/admin/blocks' },
    { emoji: '🏷️', label: 'Plantilla vertical',      sub: 'Restaurante · Servicios · Eventos', to: '/admin/template' },
  ]

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-['Inter']">

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <span className="text-base font-black tracking-tight text-slate-900">
          INTAP<span className="text-intap-mint">·</span>link
        </span>
        <button
          onClick={handleLogout}
          className="text-xs text-slate-600 hover:text-slate-900 transition-colors border border-slate-200 px-3 py-1.5 rounded-full"
        >
          Cerrar sesión
        </button>
      </header>

      <div className="max-w-sm mx-auto px-4 py-6 flex flex-col gap-4 pb-10">

        {/* ── Sin slug ── */}
        {!me?.slug && (
          <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4">
            <p className="text-sm font-bold text-yellow-700 mb-1">Completa tu perfil</p>
            <p className="text-xs text-yellow-600 mb-3">Elige tu URL para que tu perfil sea accesible.</p>
            <button
              onClick={() => navigate('/admin/onboarding/slug')}
              className="w-full py-2 rounded-xl bg-yellow-100 text-yellow-700 text-xs font-bold border border-yellow-200 hover:bg-yellow-200 transition-colors"
            >
              Elegir mi URL →
            </button>
          </div>
        )}

        {/* ── Tarjeta de perfil ── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-2xl overflow-hidden shrink-0">
            {me?.avatar_url
              ? <img src={me.avatar_url} alt="" className="w-full h-full object-cover" />
              : '👤'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-900 truncate">{me?.name || me?.email || '—'}</p>
            {me?.slug && <p className="text-xs text-slate-600">@{me.slug}</p>}
            {me?.category && <p className="text-xs text-intap-mint mt-0.5">{me.category}</p>}
            {me?.bio && <p className="text-xs text-slate-600 mt-1 line-clamp-2">{me.bio}</p>}
          </div>
        </div>

        {/* ── URL pública ── */}
        {me?.slug && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Tu URL pública</p>
              {!slugEditing && (
                <button onClick={startSlugEdit} className="text-xs text-intap-mint hover:underline font-bold">
                  Cambiar
                </button>
              )}
            </div>
            {slugEditing ? (
              <div className="flex flex-col gap-2 mt-2">
                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus-within:border-intap-mint/50 transition-colors">
                  <span className="text-slate-600 text-xs select-none mr-1">…/</span>
                  <input
                    type="text"
                    value={newSlug}
                    onChange={(e) => { setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '')); setSlugError('') }}
                    maxLength={32}
                    className="bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none flex-1"
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
                  <button onClick={handleSlugSave} disabled={slugSaving} className="flex-1 text-xs bg-intap-mint/20 text-intap-mint border border-intap-mint/30 py-2 rounded-xl font-bold hover:bg-intap-mint/30 disabled:opacity-50">
                    {slugSaving ? 'Guardando…' : 'Guardar'}
                  </button>
                  <button onClick={() => setSlugEditing(false)} className="flex-1 text-xs bg-slate-100 text-slate-600 border border-slate-200 py-2 rounded-xl hover:text-slate-900">
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm font-mono text-intap-mint font-bold">intaprd.com/{me.slug}</p>
            )}
          </div>
        )}

        {/* ── Estado del perfil ── */}
        {me?.slug && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`w-2 h-2 rounded-full ${me.is_published ? 'bg-green-500' : 'bg-orange-400'}`} />
                <span className={`text-xs font-black uppercase tracking-wide ${me.is_published ? 'text-green-600' : 'text-orange-500'}`}>
                  {me.is_published ? 'PUBLICADO' : 'NO PUBLICADO'}
                </span>
              </div>
              <p className="text-xs text-slate-600">{me.is_published ? 'Visible para todos en tu URL' : 'Solo tú puedes verlo'}</p>
            </div>
            <button
              onClick={togglePublished}
              disabled={publishing}
              className={`px-4 py-2 rounded-full text-xs font-bold border transition-colors disabled:opacity-50 ${
                me.is_published
                  ? 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200'
                  : 'bg-intap-mint/10 text-intap-mint border-intap-mint/30 hover:bg-intap-mint/20'
              }`}
            >
              {publishing ? '…' : me.is_published ? 'Despublicar' : 'Publicar'}
            </button>
          </div>
        )}

        {/* ── Acciones rápidas ── */}
        {me?.slug && (
          <div className="flex gap-2">
            <a
              href={profileUrl ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-intap-mint/10 border border-intap-mint/30 text-intap-mint text-xs font-bold hover:bg-intap-mint/20 transition-colors"
            >
              Ver perfil ↗
            </a>
            <button
              onClick={handleShare}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-200 transition-colors"
            >
              {shareCopied ? '¡Copiado!' : 'Compartir 🔗'}
            </button>
            {previewUrl && (
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
                title="Vista previa"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </a>
            )}
          </div>
        )}

        {/* ── Retención ── */}
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
          <p className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-2 px-1">Edición rápida</p>
          <div className="flex flex-col gap-1.5">
            {navItems.map((item) => (
              <button
                key={item.to}
                onClick={() => navigate(item.to)}
                className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between hover:bg-slate-50 active:scale-[0.98] transition-all text-left w-full"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl w-7 text-center">{item.emoji}</span>
                  <div>
                    <p className="text-sm font-bold text-slate-900 leading-tight">{item.label}</p>
                    <p className="text-xs text-slate-600 mt-0.5">{item.sub}</p>
                  </div>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        </div>

        {/* ── Mi plan ── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-2">Mi plan</p>
          <p className="text-sm font-bold capitalize text-intap-mint">{me?.plan_id ?? 'Free'}</p>
          <p className="text-xs text-slate-600 mt-0.5">
            {linkCount} link{linkCount !== 1 ? 's' : ''}
            {stats?.totalViews != null && <> · {stats.totalViews} visitas</>}
          </p>
        </div>

      </div>
    </div>
  )
}
