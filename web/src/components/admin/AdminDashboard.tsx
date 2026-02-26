import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiGet } from '../../lib/api'

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
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [me, setMe] = useState<MeData | null>(null)
  const [linkCount, setLinkCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([apiGet('/me'), apiGet('/me/links')])
      .then(([meJson, linksJson]: any[]) => {
        if (meJson.ok) setMe(meJson.data)
        if (linksJson.ok) setLinkCount(linksJson.data?.length || 0)
      })
      .finally(() => setLoading(false))
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('intap_token')
    navigate('/admin/login', { replace: true })
  }

  if (loading) return (
    <div className="min-h-screen bg-intap-dark flex items-center justify-center">
      <div className="loading-spinner" />
    </div>
  )

  const profileUrl = me?.slug ? `/${me.slug}` : null

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
            <div className="w-14 h-14 rounded-2xl bg-intap-mint/10 border border-intap-mint/20 flex items-center justify-center text-2xl">
              {me?.avatar_url ? (
                <img src={me.avatar_url} alt="" className="w-full h-full object-cover rounded-2xl" />
              ) : '👤'}
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
            <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Estado</p>
            <p className={`text-xs font-black mt-1 ${me?.is_published ? 'text-intap-mint' : 'text-slate-400'}`}>
              {me?.is_published ? 'Público' : 'Borrador'}
            </p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Plan</p>
            <p className="text-xs font-black mt-1 text-intap-mint">Free</p>
          </div>
        </div>

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
