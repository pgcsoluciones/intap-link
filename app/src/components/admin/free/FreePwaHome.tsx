import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPost } from '../../../lib/api'

type MeData = {
  name?: string | null
  email?: string | null
  slug?: string | null
  avatar_url?: string | null
}

export default function FreePwaHome() {
  const navigate = useNavigate()
  const [me, setMe] = useState<MeData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet('/me')
      .then((json: any) => {
        if (json?.ok) setMe(json.data || null)
      })
      .finally(() => setLoading(false))
  }, [])

  const logout = async () => {
    try { await apiPost('/auth/logout', {}) } catch { /* ignore */ }
    window.location.replace('/admin/login')
  }

  if (loading) return <div className="min-h-screen bg-[#f7f9fc] flex items-center justify-center"><div className="loading-spinner" /></div>

  const webUrl = (import.meta.env.VITE_WEB_URL ?? 'https://intaprd.com').replace(/\/$/, '')
  const publicUrl = me?.slug ? `${webUrl}/${encodeURIComponent(me.slug)}` : ''
  const displayName = String(me?.name || '').trim() || String(me?.email || '').trim() || 'Kawvo'

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 font-['Inter'] text-slate-950">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[430px] flex-col justify-center">
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-[20px] border border-cyan-100 bg-cyan-50">
              {me?.avatar_url ? <img src={me.avatar_url} alt="" className="h-full w-full object-cover" /> : <img src="/kawvo-icon-192.png" alt="Kawvo" className="h-full w-full object-contain" />}
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-black uppercase tracking-[0.16em] text-cyan-700">KAWVO</p>
              <h1 className="mt-1 text-2xl font-black tracking-[-0.04em]">Hola, {displayName} 👋</h1>
            </div>
          </div>

          <p className="mt-5 text-base font-semibold leading-7 text-slate-600">¿Qué quieres hacer?</p>

          <div className="mt-5 space-y-3">
            <button type="button" onClick={() => navigate('/admin/free')} className="w-full rounded-[22px] border border-cyan-200 bg-cyan-50 p-4 text-left transition active:scale-[0.99]">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan-700 text-xl text-white">⚙</span>
                <div><p className="text-base font-black text-slate-950">Administrar mi perfil</p><p className="mt-1 text-sm font-medium leading-5 text-slate-600">Edita tu información, servicios, imágenes y configuración.</p></div>
              </div>
            </button>

            <button type="button" disabled={!publicUrl} onClick={() => publicUrl && window.location.assign(publicUrl)} className="w-full rounded-[22px] border border-slate-200 bg-white p-4 text-left transition active:scale-[0.99] disabled:opacity-45">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-950 text-xl text-white">👁</span>
                <div><p className="text-base font-black text-slate-950">Ver mi perfil</p><p className="mt-1 text-sm font-medium leading-5 text-slate-600">Mira tu presentación como la ven tus clientes.</p></div>
              </div>
            </button>
          </div>

          {!publicUrl && <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold leading-5 text-amber-900">Completa tu usuario para habilitar el acceso directo a tu perfil público.</p>}

          <button type="button" onClick={() => void logout()} className="mt-5 w-full rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-600">Cerrar sesión</button>
        </div>
      </section>
    </main>
  )
}
