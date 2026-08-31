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

function isSafari() {
  const ua = window.navigator.userAgent
  return /safari/i.test(ua) && !/crios|fxios|edgios|chrome|chromium|android/i.test(ua)
}

function markInstalled() {
  localStorage.setItem(INSTALLED_KEY, '1')
}

export default function FreePwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(() => isStandalone() || localStorage.getItem(INSTALLED_KEY) === '1')
  const [showHelp, setShowHelp] = useState(false)
  const [copied, setCopied] = useState(false)
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null)
  const ios = useMemo(() => isIos(), [])
  const android = useMemo(() => isAndroid(), [])
  const safari = useMemo(() => isSafari(), [])

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

  const copyInstallUrl = async () => {
    try {
      await navigator.clipboard.writeText(installUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  const content = (
    <section className="rounded-[22px] border border-cyan-200 bg-gradient-to-br from-white to-cyan-50 p-4 font-['Inter'] shadow-sm" aria-label="Acceso rápido a Kawvo">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[#0F5FF7] p-1.5" aria-hidden="true">
          <img src="/kawvo-icon.svg" alt="" className="h-full w-full" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-cyan-700">Acceso rápido a Kawvo</p>
          <h2 className="mt-1 text-lg font-black text-slate-950">{installed ? 'Kawvo está listo en tu dispositivo' : 'Lleva Kawvo contigo'}</h2>
          <p className="mt-1 text-sm font-medium leading-5 text-slate-600">
            {installed
              ? 'Entra a tu perfil y a tu panel cuando quieras desde el icono de Kawvo.'
              : 'Ten acceso a tu perfil y a tu panel en cualquier momento, con un solo toque.'}
          </p>
        </div>
      </div>

      {installed ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <a href="/admin/free/home?source=pwa" className="flex items-center justify-center rounded-2xl bg-cyan-700 px-3 py-3 text-center text-xs font-black text-white">Abrir Kawvo</a>
          <button type="button" onClick={() => setShowHelp((value) => !value)} className="rounded-2xl border border-cyan-200 bg-white px-3 py-3 text-xs font-black text-cyan-700">{showHelp ? 'Ocultar ayuda' : 'Ver instalación'}</button>
        </div>
      ) : (
        <button type="button" onClick={() => void install()} className="mt-4 w-full rounded-2xl bg-cyan-700 px-4 py-3 text-sm font-black text-white">{deferredPrompt ? 'Instalar Kawvo' : 'Cómo instalar Kawvo'}</button>
      )}

      {showHelp && ios && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          <p className="font-black text-slate-950">Instalar Kawvo en iPhone</p>
          <p className="mt-1 text-xs font-medium leading-5 text-slate-500">Usa este acceso de Kawvo para que iPhone guarde el icono azul con la K blanca, no el icono de tu perfil.</p>

          {!safari && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-900">
              Estás usando otro navegador. Para agregar Kawvo correctamente, abre <b>Safari</b>, el icono azul con una brújula.
            </div>
          )}

          <ol className="mt-3 space-y-3 font-medium leading-5">
            <li><b>1.</b> Abre el enlace de Kawvo en <b>Safari</b>. Si ya estás en Safari, toca <b>Abrir Kawvo para instalar</b>.</li>
            <li><b>2.</b> En Safari, busca abajo el botón <b>Compartir</b>: es un cuadro con una flecha apuntando hacia arriba.</li>
            <li><b>3.</b> Toca <b>Compartir</b> y desliza la lista de opciones hacia arriba.</li>
            <li><b>4.</b> Toca <b>Agregar a pantalla de inicio</b>.</li>
            <li><b>5.</b> Verifica que diga <b>Kawvo</b> y toca <b>Agregar</b> arriba a la derecha.</li>
            <li><b>6.</b> En tu pantalla aparecerá el icono azul de Kawvo con la <b>K blanca</b>. Ábrelo una vez para confirmar la instalación.</li>
          </ol>

          <div className="mt-4 grid gap-2">
            <a href={installUrl} className="flex w-full items-center justify-center rounded-xl bg-cyan-700 px-3 py-3 text-xs font-black text-white">Abrir Kawvo para instalar</a>
            <button type="button" onClick={() => void copyInstallUrl()} className="w-full rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-3 text-xs font-black text-cyan-700">{copied ? '✓ Enlace copiado' : 'Copiar enlace para abrir en Safari'}</button>
          </div>
        </div>
      )}

      {showHelp && android && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          <p className="font-black text-slate-950">Instalar Kawvo en Android</p>
          <ol className="mt-3 space-y-3 font-medium leading-5">
            <li><b>1.</b> Abre Kawvo en <b>Chrome</b>.</li>
            <li><b>2.</b> Toca el menú de <b>tres puntos</b> de Chrome.</li>
            <li><b>3.</b> Elige <b>Instalar aplicación</b> o <b>Agregar a pantalla principal</b>.</li>
            <li><b>4.</b> Confirma. Verás el icono azul de Kawvo con la K blanca.</li>
          </ol>
          <a href={installUrl} className="mt-4 flex w-full items-center justify-center rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-3 text-xs font-black text-cyan-700">Abrir Kawvo para instalar</a>
        </div>
      )}

      {showHelp && !ios && !android && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          <p className="font-black text-slate-950">Instalar Kawvo en este equipo</p>
          <ol className="mt-3 space-y-3 font-medium leading-5">
            <li><b>1.</b> Usa Chrome o Edge.</li>
            <li><b>2.</b> Busca el icono de instalación en la barra de direcciones o abre el menú del navegador.</li>
            <li><b>3.</b> Elige <b>Instalar Kawvo</b> o <b>Instalar aplicación</b> y confirma.</li>
          </ol>
          <a href={installUrl} className="mt-4 flex w-full items-center justify-center rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-3 text-xs font-black text-cyan-700">Abrir página de Kawvo</a>
        </div>
      )}
    </section>
  )

  return createPortal(content, portalHost)
}
