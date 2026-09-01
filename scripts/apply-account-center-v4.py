#!/usr/bin/env python3
from pathlib import Path
import runpy

ROOT = Path(__file__).resolve().parents[1]

# Apply the complete V3 refinement first.
runpy.run_path(str(ROOT / 'scripts/apply-account-center-v3.py'), run_name='__main__')

account_path = ROOT / 'app/src/components/admin/free/FreeAccount.tsx'
text = account_path.read_text()

# Harden bank row transformation against the currently deployed V2 wording/icon.
text = text.replace(
    '<SettingsRow icon="$" label="Enviar cuentas bancarias" detail="Comparte el enlace directo a tus datos bancarios"',
    '<SettingsRow icon={<svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 10h18M5 10v8m4-8v8m6-8v8m4-8v8M3 20h18M12 3 3 8h18L12 3Z"/></svg>} label="Enviar enlace de cuentas" detail="Comparte con tus clientes el enlace directo a tus cuentas bancarias"',
)
text = text.replace('label="Enviar cuentas bancarias"', 'label="Enviar enlace de cuentas"')

# PWA installation state + prompt. The browser prompt is captured globally in main.tsx.
state_anchor = "  const [showInvitePreview, setShowInvitePreview] = useState(false)\n"
if 'pwaInstalled' not in text:
    text = text.replace(
        state_anchor,
        state_anchor + "  const [pwaInstalled, setPwaInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches || Boolean((window.navigator as any).standalone) || localStorage.getItem('kawvo_pwa_installed') === '1')\n  const [pwaInstallReady, setPwaInstallReady] = useState(() => Boolean((window as any).__kawvoInstallPrompt))\n  const [showPwaHelp, setShowPwaHelp] = useState(false)\n",
        1,
    )

# Listen for prompt availability and installed state changes.
use_effect_anchor = "  useEffect(() => {\n    const ticketId = new URLSearchParams(window.location.search).get('ticket')"
if 'kawvo:pwa-install-ready' not in text:
    pwa_effect = """  useEffect(() => {
    const onReady = () => setPwaInstallReady(Boolean((window as any).__kawvoInstallPrompt))
    const onInstalled = () => {
      localStorage.setItem('kawvo_pwa_installed', '1')
      setPwaInstalled(true)
      setPwaInstallReady(false)
      setShowPwaHelp(false)
    }
    window.addEventListener('kawvo:pwa-install-ready', onReady)
    window.addEventListener('appinstalled', onInstalled)
    onReady()
    return () => {
      window.removeEventListener('kawvo:pwa-install-ready', onReady)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

"""
    text = text.replace(use_effect_anchor, pwa_effect + use_effect_anchor, 1)

# Install action: native browser prompt when available; otherwise show simple mobile instructions.
logout_anchor = "  const handleLogout = async () => {"
if 'const installPwa = async' not in text:
    install_fn = """  const installPwa = async () => {
    if (pwaInstalled) return
    const prompt = (window as any).__kawvoInstallPrompt
    if (!prompt) {
      setShowPwaHelp(true)
      return
    }
    try {
      await prompt.prompt()
      const choice = await prompt.userChoice
      ;(window as any).__kawvoInstallPrompt = null
      setPwaInstallReady(false)
      if (choice?.outcome === 'accepted') {
        localStorage.setItem('kawvo_pwa_installed', '1')
        setPwaInstalled(true)
      }
    } catch {
      setShowPwaHelp(true)
    }
  }

"""
    text = text.replace(logout_anchor, install_fn + logout_anchor, 1)

# Add PWA as a Mi Kawvo row, keeping the current linear icon language.
products_marker = '<SettingsRow icon={<svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 7h12l1 13H5L6 7Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg>} label="Mis productos"'
if 'label="Instalar app Kawvo"' not in text and products_marker in text:
    row = '<SettingsRow icon={<svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M9 15l3 3 3-3M12 8v10"/></svg>} label="Instalar app Kawvo" detail={pwaInstallReady ? "Instálala en este dispositivo" : "Accede a Kawvo como una app"} onClick={() => void installPwa()} />\n              '
    text = text.replace(products_marker, row + products_marker, 1)

# If already installed, hide the install row rather than offering a redundant action.
if 'label="Instalar app Kawvo"' in text and '{!pwaInstalled && <SettingsRow' not in text:
    target = '<SettingsRow icon={<svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M9 15l3 3 3-3M12 8v10"/></svg>} label="Instalar app Kawvo" detail={pwaInstallReady ? "Instálala en este dispositivo" : "Accede a Kawvo como una app"} onClick={() => void installPwa()} />'
    text = text.replace(target, '{!pwaInstalled && <SettingsRow icon={<svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M9 15l3 3 3-3M12 8v10"/></svg>} label="Instalar app Kawvo" detail={pwaInstallReady ? "Instálala en este dispositivo" : "Accede a Kawvo como una app"} onClick={() => void installPwa()} />}', 1)

# Fallback help for browsers (notably iOS Safari) that do not expose beforeinstallprompt.
insert_anchor = "      {showInvitePreview && ("
if 'aria-label="Cómo instalar Kawvo"' not in text and insert_anchor in text:
    # Insert before invitation modal so both remain independent.
    modal = """      {showPwaHelp && (
        <div className="fixed inset-0 z-[140] flex items-end justify-center bg-slate-950/55 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Cómo instalar Kawvo" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowPwaHelp(false) }}>
          <article className="w-full max-w-[390px] rounded-[26px] bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between"><h2 className="text-lg font-black">Instalar app Kawvo</h2><button type="button" onClick={() => setShowPwaHelp(false)} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">Cerrar</button></div>
            <p className="mt-4 text-sm leading-6 text-slate-600">En iPhone o iPad, abre el menú Compartir del navegador y elige <strong>Agregar a pantalla de inicio</strong>.</p>
            <p className="mt-3 text-sm leading-6 text-slate-500">En Android, abre el menú del navegador y selecciona <strong>Instalar aplicación</strong> o <strong>Agregar a pantalla principal</strong>.</p>
          </article>
        </div>
      )}
"""
    text = text.replace(insert_anchor, modal + insert_anchor, 1)

account_path.write_text(text)
print('✓ Mi cuenta v4: PWA instalable + banco robusto')

# Capture the browser install prompt as early as possible so Mi cuenta can use it later.
main_path = ROOT / 'app/src/main.tsx'
main = main_path.read_text()
if '__kawvoInstallPrompt' not in main:
    anchor = "const standalone = window.matchMedia('(display-mode: standalone)').matches || Boolean((window.navigator as any).standalone)\n"
    capture = """
window.addEventListener('beforeinstallprompt', (event: Event) => {
  event.preventDefault()
  ;(window as any).__kawvoInstallPrompt = event
  window.dispatchEvent(new Event('kawvo:pwa-install-ready'))
})

window.addEventListener('appinstalled', () => {
  localStorage.setItem('kawvo_pwa_installed', '1')
  ;(window as any).__kawvoInstallPrompt = null
})
"""
    main = main.replace(anchor, anchor + capture, 1)
    main_path.write_text(main)
    print('✓ main.tsx: prompt PWA capturado')

print('✓ Account Center v4 aplicado')
