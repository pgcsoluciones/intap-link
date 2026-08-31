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
    const refreshInstalledState = () => {
      if (isStandalone() || localStorage.getItem(INSTALLED_KEY) === '1') {
        markInstalled()
        setInstalled(true)
      }
    }

    refreshInstalledState()

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
    window.addEventListener('focus', refreshInstalledState)
    document.addEventListener('visibilitychange', refreshInstalledState)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onInstalled)
      window.removeEventListener('focus', refreshInstalledState)
      document.removeEventListener('visibilitychange', refreshInstalledState)
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
        setShowHelp(false)
      }
      setDeferredPrompt(null)
      return
    }
    setShowHelp(true)
  }

  const confirmInstalled = () => {
    markInstalled()
    setInstalled(true)
    setShowHelp(false)
  }

  const installUrl = `${window.location.origin}/admin/free/home?source=install`

  const content = (
    <section className="rounded-[22px] border border-cyan-200 bg-gradient-to-br from-white to-cyan-50 p-5 font-['Inter'] shadow-sm" aria-label="Acceso rápido a Kawvo">
      <div className="flex items-start gap-3.5">
        <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[#0F5FF7] p-1.5" aria-hidden="true">
          <img src="/kawvo-icon.svg" alt="" className="h-full w-full" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-black uppercase tracking-[0.1em] text-cyan-700">Acceso rápido a Kawvo</p>
          <h2 className="mt-1 text-xl font-black leading-6 text-slate-950">{installed ? 'Kawvo está listo' : 'Lleva Kawvo contigo'}</h2>
          <p className="mt-2 text-[15px] font-medium leading-6 text-slate-600">
            {installed
              ? 'Entra a tu perfil y a tu panel cuando quieras, con un solo toque.'
              : 'Ten acceso a tu perfil y a tu panel en cualquier momento, con un solo toque.'}
          </p>
        </div>
      </div>

      {installed ? (
        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <a href="/admin/free/home?source=pwa" className="flex min-h-12 items-center justify-center rounded-2xl bg-cyan-700 px-4 py-3 text-center text-[15px] font-black text-white">Abrir Kawvo</a>
          <button type="button" onClick={() => setShowHelp((value) => !value)} className="min-h-12 rounded-2xl border border-cyan-200 bg-white px-4 py-3 text-[15px] font-black text-cyan-700">{showHelp ? 'Ocultar pasos' : 'Ver cómo instalar'}</button>
        </div>
      ) : (
        <button type="button" onClick={() => void install()} className="mt-5 min-h-12 w-full rounded-2xl bg-cyan-700 px-4 py-3 text-[15px] font-black text-white">{deferredPrompt ? 'Instalar Kawvo' : 'Ver cómo instalar'}</button>
      )}

      {showHelp && ios && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 text-[15px] text-slate-700">
          <p className="text-lg font-black text-slate-950">Instalar Kawvo en iPhone</p>
          <ol className="mt-4 space-y-4 font-medium leading-6">
            <li><b>1.</b> Toca <b>Abrir Kawvo en Safari</b>.</li>
            <li><b>2.</b> En Safari, toca <b>Compartir</b>: el botón con un cuadro y una flecha hacia arriba, normalmente en la barra inferior.</li>
            <li><b>3.</b> Desliza las opciones y toca <b>Agregar a pantalla de inicio</b>.</li>
            <li><b>4.</b> Toca <b>Agregar</b> arriba a la derecha.</li>
            <li><b>5.</b> Regresa aquí y toca <b>Ya lo agregué</b>.</li>
          </ol>

          <div className="mt-5 grid gap-2">
            <a href={installUrl} className="flex min-h-12 w-full items-center justify-center rounded-xl bg-cyan-700 px-4 py-3 text-[15px] font-black text-white">Abrir Kawvo en Safari</a>
            <button type="button" onClick={confirmInstalled} className="min-h-12 w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[15px] font-black text-emerald-700">✓ Ya lo agregué</button>
          </div>
        </div>
      )}

      {showHelp && android && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 text-[15px] text-slate-700">
          <p className="text-lg font-black text-slate-950">Instalar Kawvo en Android</p>
          <ol className="mt-4 space-y-4 font-medium leading-6">
            <li><b>1.</b> Abre Kawvo en <b>Chrome</b>.</li>
            <li><b>2.</b> Toca el menú de <b>tres puntos</b>.</li>
            <li><b>3.</b> Toca <b>Instalar aplicación</b> o <b>Agregar a pantalla principal</b>.</li>
            <li><b>4.</b> Confirma la instalación.</li>
          </ol>
          <a href={installUrl} className="mt-5 flex min-h-12 w-full items-center justify-center rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-[15px] font-black text-cyan-700">Abrir Kawvo</a>
        </div>
      )}

      {showHelp && !ios && !android && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 text-[15px] text-slate-700">
          <p className="text-lg font-black text-slate-950">Instalar Kawvo</p>
          <ol className="mt-4 space-y-4 font-medium leading-6">
            <li><b>1.</b> Usa Chrome o Edge.</li>
            <li><b>2.</b> Busca <b>Instalar</b> en la barra de direcciones o en el menú del navegador.</li>
            <li><b>3.</b> Confirma para tener Kawvo disponible en este equipo.</li>
          </ol>
        </div>
      )}
    </section>
  )

  return createPortal(content, portalHost)
}
