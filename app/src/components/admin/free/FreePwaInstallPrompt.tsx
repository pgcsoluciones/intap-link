import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const INSTALLED_KEY = 'kawvo_pwa_installed'

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || Boolean((window.navigator as any).standalone)
}

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

function isAndroid() {
  return /android/i.test(window.navigator.userAgent)
}

function markInstalled() {
  localStorage.setItem(INSTALLED_KEY, '1')
}

export default function FreePwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(() => isStandalone() || localStorage.getItem(INSTALLED_KEY) === '1')
  const [showHelp, setShowHelp] = useState(false)
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null)
  const ios = useMemo(() => isIos(), [])
  const android = useMemo(() => isAndroid(), [])

  useEffect(() => {
    if (isStandalone()) {
      markInstalled()
      setInstalled(true)
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      markInstalled()
      setInstalled(true)
      setDeferredPrompt(null)
      setShowHelp(false)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  useEffect(() => {
    let created: HTMLElement | null = null

    const attach = () => {
      const dashboardMain = document.querySelector('main')
      const dashboardSection = dashboardMain?.querySelector(':scope > section')
      if (!dashboardSection) return false

      let host = document.getElementById('kawvo-pwa-panel-slot')
      if (!host) {
        host = document.createElement('div')
        host.id = 'kawvo-pwa-panel-slot'
        const firstCard = dashboardSection.firstElementChild
        if (firstCard?.nextSibling) dashboardSection.insertBefore(host, firstCard.nextSibling)
        else dashboardSection.appendChild(host)
        created = host
      }
      setPortalHost(host)
      return true
    }

    if (attach()) return () => {
      if (created?.parentElement) created.parentElement.removeChild(created)
    }

    const observer = new MutationObserver(() => {
      if (attach()) observer.disconnect()
    })
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      if (created?.parentElement) created.parentElement.removeChild(created)
    }
  }, [])

  if (!portalHost) return null

  const install = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      if (choice.outcome === 'accepted') {
        markInstalled()
        setInstalled(true)
      }
      setDeferredPrompt(null)
      return
    }
    setShowHelp(true)
  }

  const installUrl = `${window.location.origin}/admin/free/home?source=install`

  const content = (
    <section className="rounded-[22px] border border-cyan-200 bg-gradient-to-br from-white to-cyan-50 p-4 font-['Inter'] shadow-sm" aria-label="Acceso rápido a Kawvo">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[#0E5CF5] p-1.5" aria-hidden="true">
          <img src="/kawvo-icon.svg" alt="" className="h-full w-full" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-cyan-700">Lleva Kawvo contigo</p>
          <h2 className="mt-1 text-lg font-black text-slate-950">{installed ? 'Kawvo está listo en tu dispositivo' : 'Ten Kawvo siempre a mano'}</h2>
          <p className="mt-1 text-sm font-medium leading-5 text-slate-600">
            {installed
              ? 'Entra a tu perfil y a tu panel cuando quieras desde el icono de Kawvo.'
              : 'Ten acceso a tu perfil y a tu panel en cualquier momento, con un solo toque.'}
          </p>
        </div>
      </div>

      {installed ? (
        <a href="/admin/free/home?source=pwa" className="mt-4 flex w-full items-center justify-center rounded-2xl bg-cyan-700 px-4 py-3 text-sm font-black text-white">Abrir inicio Kawvo</a>
      ) : (
        <>
          <button type="button" onClick={() => void install()} className="mt-4 w-full rounded-2xl bg-cyan-700 px-4 py-3 text-sm font-black text-white">{deferredPrompt ? 'Instalar Kawvo' : 'Cómo instalar Kawvo'}</button>

          {showHelp && ios && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
              <p className="font-black text-slate-950">Cómo agregar Kawvo en iPhone</p>
              <ol className="mt-3 space-y-3 font-medium leading-5">
                <li><b>1.</b> Toca <b>Abrir página para instalar</b> aquí debajo. Haz los siguientes pasos en Safari.</li>
                <li><b>2.</b> En Safari, mira la barra inferior y toca <b>Compartir</b>: es el icono de un cuadro con una flecha hacia arriba.</li>
                <li><b>3.</b> Desliza el menú hasta encontrar <b>Agregar a pantalla de inicio</b>.</li>
                <li><b>4.</b> Toca <b>Agregar</b> en la esquina superior derecha.</li>
                <li><b>5.</b> Verás el icono azul de Kawvo en tu pantalla. Tócalo para entrar.</li>
              </ol>
              <a href={installUrl} className="mt-4 flex w-full items-center justify-center rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-3 text-xs font-black text-cyan-700">Abrir página para instalar</a>
            </div>
          )}

          {showHelp && android && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
              <p className="font-black text-slate-950">Cómo instalar Kawvo en Android</p>
              <ol className="mt-3 space-y-3 font-medium leading-5">
                <li><b>1.</b> Abre esta página en <b>Chrome</b>.</li>
                <li><b>2.</b> Toca el menú de <b>tres puntos</b> de Chrome.</li>
                <li><b>3.</b> Elige <b>Instalar aplicación</b> o <b>Agregar a pantalla principal</b>.</li>
                <li><b>4.</b> Confirma. El icono de Kawvo aparecerá en tu dispositivo.</li>
              </ol>
            </div>
          )}

          {showHelp && !ios && !android && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
              <p className="font-black text-slate-950">Cómo instalar Kawvo en este equipo</p>
              <ol className="mt-3 space-y-3 font-medium leading-5">
                <li><b>1.</b> Usa Chrome o Edge.</li>
                <li><b>2.</b> Busca el icono de instalación en la barra de direcciones o abre el menú del navegador.</li>
                <li><b>3.</b> Elige <b>Instalar Kawvo</b> o <b>Instalar aplicación</b> y confirma.</li>
              </ol>
            </div>
          )}
        </>
      )}
    </section>
  )

  return createPortal(content, portalHost)
}
