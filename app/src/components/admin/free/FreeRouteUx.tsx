import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export default function FreeRouteUx() {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const enabled = location.pathname.startsWith('/admin/free') || location.pathname.startsWith('/admin/artifacts')
    document.body.classList.toggle('kawvo-free-mobile', enabled)
    return () => document.body.classList.remove('kawvo-free-mobile')
  }, [location.pathname])

  const showAiLauncher = location.pathname === '/admin/free' || location.pathname === '/admin/free/editor'
  if (!showAiLauncher) return null

  return (
    <button
      type="button"
      onClick={() => navigate('/admin/free/ai-profile')}
      className="fixed bottom-5 right-4 z-[70] flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-2xl border border-cyan-200 bg-white px-4 py-3 text-left shadow-[0_16px_45px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:border-cyan-300 sm:right-6"
      aria-label="Ayúdame a crear mi perfil con IA"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cyan-600 text-lg text-white" aria-hidden="true">✦</span>
      <span className="min-w-0">
        <span className="block text-sm font-black text-slate-950">Ayúdame con IA</span>
        <span className="block truncate text-[11px] font-semibold text-slate-500">Revisa la propuesta antes de aplicar</span>
      </span>
    </button>
  )
}
