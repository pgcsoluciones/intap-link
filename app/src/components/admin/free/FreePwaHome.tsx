import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPost } from '../../../lib/api'

type MeData = {
  name?: string | null
  email?: string | null
  slug?: string | null
  avatar_url?: string | null
}

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

export default function FreePwaHome() {
  const navigate = useNavigate()
  const [me, setMe] = useState<MeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCloseHelp, setShowCloseHelp] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)

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

  const closeKawvo = () => {
    setShowCloseHelp(false)
    window.close()
    window.setTimeout(() => setShowCloseHelp(true), 180)
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

          <button type="button" onClick={closeKawvo} className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-3.5 text-base font-black text-white">Salir de la app</button>
          <p className="mt-2 text-center text-xs font-semibold leading-5 text-slate-500">Esta acción no cierra tu sesión.</p>

          {showCloseHelp && (
            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold leading-6 text-slate-700">
              {isIos()
                ? 'Para salir de Kawvo en iPhone, desliza hacia arriba desde el borde inferior de la pantalla. Tu sesión seguirá abierta.'
                : 'Si Kawvo no se cerró automáticamente, ciérralo como cualquier otra app. Tu sesión seguirá abierta.'}
            </div>
          )}

          <div className="mt-5 border-t border-slate-100 pt-4 text-center">
            {!confirmLogout ? (
              <>
                <button type="button" onClick={() => setConfirmLogout(true)} className="text-sm font-bold text-slate-500">Cerrar sesión</button>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-400">Esta acción no elimina tu cuenta.</p>
              </>
            ) : (
              <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-left">
                <p className="text-sm font-black text-slate-950">¿Cerrar tu sesión?</p>
                <p className="mt-1 text-sm font-medium leading-5 text-slate-600">Cerrarás tu sesión en este dispositivo. Esta acción no elimina tu cuenta.</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setConfirmLogout(false)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-black text-slate-700">Cancelar</button>
                  <button type="button" onClick={() => void logout()} className="rounded-xl bg-rose-600 px-3 py-2.5 text-sm font-black text-white">Sí, cerrar sesión</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
