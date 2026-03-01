import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { API_BASE, apiGet, apiPost, apiPut, apiUpload } from '../../lib/api'

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
}

interface Stats {
  totalViews: number
  topLinks: { label: string; clics: number }[]
}

interface GalleryPhoto {
  id: string
  image_key: string
}

const THEMES = [
  { id: 'default', label: 'Clásico' },
  { id: 'light',   label: 'Claro'   },
  { id: 'modern',  label: 'Moderno' },
]

function photoUrl(key: string) {
  return `${API_BASE}/public/assets/${key.split('/').map(encodeURIComponent).join('/')}`
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [me, setMe] = useState<MeData | null>(null)
  const [linkCount, setLinkCount] = useState(0)
  const [stats, setStats] = useState<Stats | null>(null)
  const [gallery, setGallery] = useState<GalleryPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    Promise.all([apiGet('/me'), apiGet('/me/links')])
      .then(([meJson, linksJson]: any[]) => {
        if (meJson.ok) {
          const data: MeData = meJson.data
          setMe(data)
          if (data.profile_id) {
            Promise.all([
              apiGet(`/profile/stats/${data.profile_id}`),
              apiGet(`/profile/gallery/${data.profile_id}`),
            ]).then(([statsJson, galleryJson]: any[]) => {
              if (statsJson.ok) setStats(statsJson.stats)
              if (galleryJson.ok) setGallery(galleryJson.photos || [])
            })
          }
        }
        if (linksJson.ok) setLinkCount(linksJson.data?.length || 0)
      })
      .finally(() => setLoading(false))
  }, [])

  const handleLogout = async () => {
    try { await apiPost('/auth/logout', {}) } catch { /* ignore */ }
    navigate('/admin/login', { replace: true })
  }

  const togglePublished = async () => {
    if (!me) return
    setPublishing(true)
    const next = me.is_published ? 0 : 1
    const res: any = await apiPut('/me/profile', { is_published: next === 1 })
    if (res.ok) setMe({ ...me, is_published: next })
    setPublishing(false)
  }

  const setTheme = async (themeId: string) => {
    if (!me || me.theme_id === themeId) return
    const res: any = await apiPut('/me/profile', { theme_id: themeId })
    if (res.ok) setMe({ ...me, theme_id: themeId })
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !me?.profile_id) return
    setUploading(true)
    const fd = new FormData()
    fd.append('profileId', me.profile_id)
    fd.append('file', file)
    const res: any = await apiUpload('/profile/gallery/upload', fd)
    if (res.ok && res.key) {
      setGallery((prev) => [...prev, { id: res.id || res.key, image_key: res.key }])
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  if (loading) return (
    <div className="min-h-screen bg-intap-dark flex items-center justify-center">
      <div className="loading-spinner" />
    </div>
  )

  const profileUrl = me?.slug ? `/${me.slug}` : null
  const currentTheme = me?.theme_id || 'default'
  const maxTopLink = stats?.topLinks?.[0]?.clics || 1

  return (
    <div className="min-h-screen bg-intap-dark text-white font-['Inter'] flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-lg">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-xl font-black">Mi Panel</h1>
          <div className="flex items-center gap-4">
            {profileUrl && (
              <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-intap-mint font-bold hover:underline">
                Ver perfil →
              </a>
            )}
            <button onClick={handleLogout} className="text-xs text-slate-500 hover:text-white transition-colors">
              Salir
            </button>
          </div>
        </header>

        {/* Profile card */}
        <div className="glass-card p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-intap-mint/10 border border-intap-mint/20 flex items-center justify-center text-2xl overflow-hidden">
              {me?.avatar_url
                ? <img src={me.avatar_url} alt="" className="w-full h-full object-cover" />
                : '👤'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold truncate">{me?.name || me?.email || '—'}</p>
              {me?.slug && <p className="text-xs text-slate-400">@{me.slug}</p>}
              {me?.category && <p className="text-xs text-intap-mint mt-0.5">{me.category}</p>}
            </div>
            <Link to="/admin/links" className="text-xs bg-white/5 border border-white/10 px-3 py-1.5 rounded-full hover:bg-white/10 transition-colors">
              Editar
            </Link>
          </div>
          {me?.bio && <p className="text-sm text-slate-400 leading-relaxed">{me.bio}</p>}
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="glass-card p-4 text-center">
            <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Links</p>
            <p className="text-xl font-black">{linkCount}</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Vistas</p>
            <p className="text-xl font-black">{stats?.totalViews ?? '—'}</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Plan</p>
            <p className="text-xs font-black mt-1 text-intap-mint">Free</p>
          </div>
        </div>

        {/* Visibility toggle */}
        <div className="glass-card p-5 mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold">Perfil público</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {me?.is_published ? 'Visible para todos' : 'Solo tú puedes verlo'}
            </p>
          </div>
          <button
            onClick={togglePublished}
            disabled={publishing}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${
              me?.is_published
                ? 'bg-intap-mint/20 text-intap-mint hover:bg-red-500/20 hover:text-red-400'
                : 'bg-white/5 text-slate-400 hover:bg-intap-mint/20 hover:text-intap-mint'
            }`}
          >
            {publishing ? '...' : me?.is_published ? 'Publicado' : 'Publicar'}
          </button>
        </div>

        {/* Theme selector */}
        <div className="glass-card p-5 mb-6">
          <p className="text-xs text-slate-500 font-bold uppercase mb-3">Tema del perfil</p>
          <div className="flex gap-2">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`flex-1 py-2 rounded-2xl text-xs font-bold border transition-colors ${
                  currentTheme === t.id
                    ? 'bg-intap-mint/20 border-intap-mint text-intap-mint'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/30'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Analytics — top links */}
        {stats && stats.topLinks.length > 0 && (
          <div className="glass-card p-5 mb-6">
            <p className="text-xs text-slate-500 font-bold uppercase mb-4">Links más clicados</p>
            <div className="flex flex-col gap-3">
              {stats.topLinks.map((link) => (
                <div key={link.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300 truncate max-w-[75%]">{link.label}</span>
                    <span className="text-intap-mint font-bold">{link.clics}</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-intap-mint rounded-full"
                      style={{ width: `${Math.round((link.clics / maxTopLink) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Gallery */}
        {me?.profile_id && (
          <div className="glass-card p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-slate-500 font-bold uppercase">Galería de fotos</p>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="text-xs bg-intap-mint/10 border border-intap-mint/20 text-intap-mint px-3 py-1.5 rounded-full hover:bg-intap-mint/20 transition-colors"
              >
                {uploading ? 'Subiendo…' : '+ Foto'}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            </div>
            {gallery.length === 0
              ? <p className="text-xs text-slate-500 text-center py-4">No hay fotos todavía</p>
              : (
                <div className="grid grid-cols-3 gap-2">
                  {gallery.map((photo) => (
                    <div key={photo.id} className="aspect-square rounded-xl overflow-hidden bg-white/5">
                      <img src={photoUrl(photo.image_key)} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )
            }
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Link to="/admin/links" className="glass-card p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-3">
              <span className="text-lg">🔗</span>
              <div>
                <p className="text-sm font-bold">Mis links</p>
                <p className="text-xs text-slate-400">Agregar, editar y reordenar</p>
              </div>
            </div>
            <span className="text-slate-400">›</span>
          </Link>

          <Link to="/admin/onboarding/identity" className="glass-card p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-3">
              <span className="text-lg">✏️</span>
              <div>
                <p className="text-sm font-bold">Editar perfil</p>
                <p className="text-xs text-slate-400">Nombre, bio, foto</p>
              </div>
            </div>
            <span className="text-slate-400">›</span>
          </Link>

          <Link to="/admin/onboarding/contact" className="glass-card p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-3">
              <span className="text-lg">📞</span>
              <div>
                <p className="text-sm font-bold">Datos de contacto</p>
                <p className="text-xs text-slate-400">WhatsApp, email, horario…</p>
              </div>
            </div>
            <span className="text-slate-400">›</span>
          </Link>

          {profileUrl && (
            <a
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="glass-card p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">👁️</span>
                <div>
                  <p className="text-sm font-bold">Ver mi perfil público</p>
                  <p className="text-xs text-slate-400">/{me?.slug}</p>
                </div>
              </div>
              <span className="text-slate-400">↗</span>
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
