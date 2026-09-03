const FULL_LOGO_PATH = '/assets/free-starter/branding/logo-completo.png'
const MARK_LOGO_PATH = '/assets/free-starter/branding/logo-solo.png'

function webBase() {
  const configured = String(import.meta.env.VITE_WEB_URL || '').replace(/\/$/, '')
  return configured || 'https://intaprd.com'
}

function logoUrl(path: string) {
  return `${webBase()}${path}`
}

function replaceBrandLabel(element: HTMLElement) {
  if (element.dataset.kawvoBrandLogo === '1') return
  if (element.children.length > 0) return

  const text = (element.textContent || '').trim().toUpperCase()
  if (text !== 'KAWVO' && text !== 'KAWVO LINK') return

  const logo = document.createElement('img')
  logo.src = logoUrl(FULL_LOGO_PATH)
  logo.alt = 'Kawvo'
  logo.className = 'kawvo-brand-logo kawvo-brand-logo-full'

  element.textContent = ''
  element.appendChild(logo)
  element.dataset.kawvoBrandLogo = '1'
}

function replaceLegacyMarks() {
  document
    .querySelectorAll<HTMLImageElement>('img[src="/kawvo-icon-192.png"][alt="Kawvo"], img[src="/kawvo-icon.svg"][alt="Kawvo"]')
    .forEach((image) => {
      if (image.dataset.kawvoBrandMark === '1') return
      image.src = logoUrl(MARK_LOGO_PATH)
      image.dataset.kawvoBrandMark = '1'
    })
}

function applyKawvoBranding() {
  document
    .querySelectorAll<HTMLElement>('p, span, strong')
    .forEach(replaceBrandLabel)

  replaceLegacyMarks()
}

export function installKawvoBranding() {
  applyKawvoBranding()

  const observer = new MutationObserver(applyKawvoBranding)
  observer.observe(document.body, { childList: true, subtree: true })

  return () => observer.disconnect()
}
