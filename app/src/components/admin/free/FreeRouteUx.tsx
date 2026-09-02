import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

const CURRENT_FREE_ROUTE_KEY = 'kawvo_current_free_route'
const PREVIOUS_FREE_ROUTE_KEY = 'kawvo_previous_free_route'
const EDITOR_SCROLL_KEY = 'kawvo_visual_editor_scroll_y'

export default function FreeRouteUx() {
  const location = useLocation()
  const navigate = useNavigate()
  const [aiOpen, setAiOpen] = useState(false)

  useEffect(() => {
    const enabled =
      location.pathname.startsWith('/admin/free') ||
      location.pathname.startsWith('/admin/artifacts')

    document.body.classList.toggle('kawvo-free-mobile', enabled)

    return () => document.body.classList.remove('kawvo-free-mobile')
  }, [location.pathname])

  useEffect(() => {
    const nextRoute = `${location.pathname}${location.search}`
    const currentRoute = sessionStorage.getItem(CURRENT_FREE_ROUTE_KEY) || ''
    if (currentRoute !== nextRoute) {
      sessionStorage.setItem(PREVIOUS_FREE_ROUTE_KEY, currentRoute)
      sessionStorage.setItem(CURRENT_FREE_ROUTE_KEY, nextRoute)
    }
  }, [location.pathname, location.search])

  useEffect(() => {
    if (location.pathname !== '/admin/free/editor') return

    const saveScroll = () => {
      sessionStorage.setItem(EDITOR_SCROLL_KEY, String(Math.max(0, window.scrollY || 0)))
    }
    window.addEventListener('scroll', saveScroll, { passive: true })

    const previousRoute = sessionStorage.getItem(PREVIOUS_FREE_ROUTE_KEY) || ''
    const shouldRestore = previousRoute.startsWith('/admin/free/') && previousRoute !== '/admin/free/editor'
    const stored = Number(sessionStorage.getItem(EDITOR_SCROLL_KEY) || 0)

    if (shouldRestore && Number.isFinite(stored) && stored > 0) {
      const restore = () => window.scrollTo({ top: stored, behavior: 'auto' })
      window.requestAnimationFrame(() => window.requestAnimationFrame(restore))
      const timers = [150, 450, 900].map((delay) => window.setTimeout(restore, delay))
      return () => {
        window.removeEventListener('scroll', saveScroll)
        timers.forEach((timer) => window.clearTimeout(timer))
      }
    }

    return () => window.removeEventListener('scroll', saveScroll)
  }, [location.pathname])

  useEffect(() => {
    setAiOpen(false)
  }, [location.pathname])

  const showAiLauncher =
    location.pathname === '/admin/free' ||
    location.pathname === '/admin/free/editor'

  if (!showAiLauncher) return null

  return (
    <div className="fixed bottom-24 right-5 z-[80] font-['Inter'] sm:right-6">
      {aiOpen && (
        <section
          className="mb-3 w-[min(330px,calc(100vw-32px))] rounded-[24px] border border-cyan-200 bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.20)]"
          aria-label="Optimiza tu perfil con IA"
        >
          <div className="flex items-start gap-3">
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-cyan-600 text-xl text-white"
              aria-hidden="true"
            >
              ✦
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-cyan-700">
                IA de Kawvo
              </p>

              <h2 className="mt-0.5 text-lg font-black text-slate-950">
                Optimiza tu perfil
              </h2>

              <p className="mt-1 text-sm font-medium leading-5 text-slate-600">
                Completa y mejora tu presentación con la IA de Kawvo.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setAiOpen(false)
              navigate('/admin/free/ai-profile')
            }}
            className="mt-4 w-full rounded-2xl bg-cyan-700 px-4 py-3 text-sm font-black text-white transition hover:bg-cyan-800"
          >
            Optimizar mi perfil
          </button>
        </section>
      )}

      <button
        type="button"
        onClick={() => setAiOpen((current) => !current)}
        className="ml-auto grid h-14 w-14 place-items-center rounded-full border border-cyan-200 bg-white text-2xl font-black text-cyan-700 shadow-[0_14px_35px_rgba(15,23,42,0.20)] transition hover:-translate-y-0.5 hover:border-cyan-300"
        aria-label={aiOpen ? 'Cerrar ayuda de IA' : 'Optimiza tu perfil con IA'}
        aria-expanded={aiOpen}
      >
        ✦
      </button>
    </div>
  )
}
