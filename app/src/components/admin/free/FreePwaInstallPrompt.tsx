import { useEffect, useMemo, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || Boolean((window.navigator as any).standalone)
}

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

export default function FreePwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(() => isStandalone())
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem('kawvo_pwa_prompt_dismissed') === '1')
  const [showIosHelp, setShowIosHelp] = useState(false)
  const ios = useMemo(() => isIos(), [])

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferredPrompt(null)
      setShowIosHelp(false)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed || dismissed) return null

  const install = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      if (choice.outcome === 'accepted') setInstalled(true)
      setDeferredPrompt(null)
      return
    }
    if (ios) {
      setShowIosHelp(true)
      return
    }
    setShowIosHelp(true)
  }

  const dismiss = () => {
    sessionStorage.setItem('kawvo_pwa_prompt_dismissed', '1')
    setDismissed(true)
  }

  return (
    <section className="fixed inset-x-4 bottom-[96px] z-[75] mx-auto w-auto max-w-[398px] rounded-[24px] border border-cyan-200 bg-white p-4 font-['Inter'] shadow-[0_20px_60px_rgba(15,23,42,0.18)]" aria-label="Instalar Kawvo">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan-50 text-xl" aria-hidden="true">📱</div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-cyan-700">Lleva Kawvo contigo</p>
          <h2 className="mt-1 text-lg font-black text-slate-950">Entra con un toque</h2>
          <p className="mt-1 text-sm font-medium leading-5 text-slate-600">Instala Kawvo en tu pantalla de inicio para abrir tu panel o ver tu perfil sin recordar direcciones.</p>
        </div>
        <button type="button" onClick={dismiss} className="rounded-full px-2 py-1 text-sm font-black text-slate-400" aria-label="Cerrar sugerencia">×</button>
      </div>

      {showIosHelp && (
        <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold leading-5 text-slate-700">
          {ios
            ? <>En iPhone: toca <b>Compartir</b> en Safari y luego <b>Agregar a pantalla de inicio</b>.</>
            : <>Abre el menú de tu navegador y elige <b>Instalar aplicación</b> o <b>Agregar a pantalla de inicio</b>.</>}
        </div>
      )}

      <button type="button" onClick={() => void install()} className="mt-4 w-full rounded-2xl bg-cyan-700 px-4 py-3 text-sm font-black text-white">Instalar Kawvo</button>
    </section>
  )
}
