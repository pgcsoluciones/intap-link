const MARK_LOGO_PATH = '/assets/free-starter/branding/logo-kawlink.png'
const FALLBACK_LOGO_URL = 'https://intaprd.com/assets/free-starter/branding/logo-kawlink.png'

function webBase() {
  const configured = String(import.meta.env.VITE_WEB_URL || '').replace(/\/$/, '')
  return configured || 'https://intaprd.com'
}

function logoUrl(path: string) {
  return `${webBase()}${path}`
}

function applyScreenLogoSizing(image: HTMLImageElement) {
  image.classList.add('kawvo-brand-logo', 'kawvo-brand-logo-screen')
  image.removeAttribute('width')
  image.removeAttribute('height')
  image.style.width = ''
  image.style.height = ''
}

function installWordmarkFallback(image: HTMLImageElement, host: HTMLElement) {
  let usedFallback = false
  image.onerror = () => {
    if (!usedFallback) {
      usedFallback = true
      image.src = FALLBACK_LOGO_URL
      return
    }
    image.onerror = null
    image.remove()
    host.textContent = 'KAWLINK'
    host.dataset.kawvoBrandLogo = '1'
  }
}

function replaceBrandLabel(element: HTMLElement) {
  if (element.dataset.kawvoBrandLogo === '1') return
  if (element.children.length > 0) return

  const text = (element.textContent || '').trim().toUpperCase()
  if (text !== 'KAWVO' && text !== 'KAWVO LINK' && text !== 'KAWLINK') return

  const logo = document.createElement('img')
  logo.src = logoUrl(MARK_LOGO_PATH)
  logo.alt = 'Kawlink'
  installWordmarkFallback(logo, element)
  applyScreenLogoSizing(logo)

  element.textContent = ''
  element.appendChild(logo)
  element.dataset.kawvoBrandLogo = '1'
}

function replaceLegacyMarks() {
  document
    .querySelectorAll<HTMLImageElement>('img[src="/kawvo-icon-192.png"][alt="Kawvo"], img[src="/kawvo-icon.svg"][alt="Kawvo"]')
    .forEach((image) => {
      if (image.dataset.kawvoBrandMark === '1') return
      const host = (image.parentElement || image) as HTMLElement
      image.src = logoUrl(MARK_LOGO_PATH)
      installWordmarkFallback(image, host)
      applyScreenLogoSizing(image)
      image.alt = 'Kawlink'
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
