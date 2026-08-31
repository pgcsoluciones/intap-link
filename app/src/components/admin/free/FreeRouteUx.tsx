import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import FreePwaInstallPrompt from './FreePwaInstallPrompt'

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || Boolean((window.navigator as any).standalone)
}

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

export default function FreeRouteUx() {
  const location = useLocation()
  const navigate = useNavigate()
  const [aiOpen, setAiOpen] = useState(false)
  const [standalone, setStandalone] = useState(() => isStandalone())
  const [showExitHelp, setShowExitHelp] = useState(false)

  useEffect(() => {
    const enabled =
      location.pathname.startsWith('/admin/free') ||
      location.pathname.startsWith('/admin/artifacts')

    document.body.classList.toggle('kawvo-free-mobile', enabled)

    return () => document.body.classList.remove('kawvo-free-mobile')
  }, [location.pathname])

  useEffect(() => {
    setAiOpen(false)
    setShowExitHelp(false)
  }, [location.pathname])

  useEffect(() => {
    const media = window.matchMedia('(display-mode: standalone)')
    const update = () => setStandalone(isStandalone())
    update()
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [])

  useEffect(() => {
    if (!standalone || !location.pathname.startsWith('/admin/free')) return

    const renameLogout = () => {
      document.querySelectorAll('header button').forEach((button) => {
        if (button.textContent?.trim() === 'Salir') {
          button.textContent = 'Cerrar sesión'
          button.setAttribute('aria-label', 'Cerrar sesión')
        }
      })
    }

    renameLogout()
    const observer = new MutationObserver(renameLogout)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [standalone, location.pathname])

  const showAiLauncher =
    location.pathname === '/admin/free' ||
    location.pathname === '/admin/free/editor'
  const showInstallPrompt = location.pathname === '/admin/free'
  const showPwaControls = standalone && location.pathname.startsWith('/admin/free') && location.pathname !== '/admin/free/home'

  const exitApp = () => {
    setShowExitHelp(false)
    window.close()
    window.setTimeout(() => setShowExitHelp(true), 180)
  }

  if (!showAiLauncher && !showInstallPrompt && !showPwaControls) return null

  return (
    <>
      {showInstallPrompt && <FreePwaInstallPrompt />}

      {showPwaControls && (
        <div className="fixed inset-x-0 bottom-0 z-[90] border-t border-slate-200 bg-white/95 px-4 pb-[max(10px,env(safe-area-inset-bottom))] pt-2.5 font-['Inter'] shadow-[0_-10px_30px_rgba(15,23,42,0.10)] backdrop-blur">
          <div className="mx-auto flex w-full max-w-[430px] gap-2">
            <button
              type="button"
              onClick={() => navigate('/admin/free/home?source=pwa')}
              className="flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-black text-slate-700"
            >
              Inicio Kawvo
            </button>
            <button
              type="button"
              onClick={exitApp}
              className="flex-1 rounded-2xl bg-slate-950 px-3 py-3 text-sm font-black text-white"
            >
              Salir de la app
            </button>
          </div>
          <p className="mx-auto mt-1.5 w-full max-w-[430px] text-center text-xs font-semibold leading-4 text-slate-500">
            Salir de la app no cierra tu sesión.
          </p>
          {showExitHelp && (
            <div className="mx-auto mt-2 w-full max-w-[430px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold leading-5 text-slate-700">
              {isIos()
                ? 'Desliza hacia arriba desde el borde inferior para salir de Kawvo. Tu sesión seguirá abierta.'
                : 'Cierra Kawvo como cualquier otra app en tu dispositivo. Tu sesión seguirá abierta.'}
            </div>
          )}
        </div>
      )}

      {showAiLauncher && (
        <div className={`${showPwaControls ? 'bottom-36' : 'bottom-24'} fixed right-5 z-[80] font-['Inter'] sm:right-6`}>
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
      )}
    </>
  )
}
