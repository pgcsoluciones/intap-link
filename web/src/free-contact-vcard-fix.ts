function escapeVCard(value: string) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

function safeFileName(value: string) {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || 'contacto'
}

function visibleIdentity() {
  const name = document.querySelector<HTMLElement>('.ilx-identity h1')?.textContent?.trim() || ''
  const role = document.querySelector<HTMLElement>('.ilx-identity p')?.textContent?.trim() || ''
  return { name, role }
}

function visiblePhone() {
  const whatsapp = document.querySelector<HTMLAnchorElement>('.ilx-main-cta[href*="wa.me/"]')?.href || ''
  const waMatch = whatsapp.match(/wa\.me\/(\d+)/i)
  if (waMatch?.[1]) return `+${waMatch[1]}`

  const tel = document.querySelector<HTMLAnchorElement>('.ilx-quick a[href^="tel:"]')?.getAttribute('href') || ''
  return tel.replace(/^tel:/i, '').trim()
}

function downloadContactFromVisibleProfile() {
  const { name, role } = visibleIdentity()
  if (!name) return false

  const phone = visiblePhone()
  const canonicalUrl = `${window.location.origin}${window.location.pathname}`
  const parts = name.split(/\s+/).filter(Boolean)
  const family = parts.length > 1 ? parts.pop() || '' : ''
  const given = parts.join(' ') || name

  const content = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${escapeVCard(name)}`,
    `N:${escapeVCard(family)};${escapeVCard(given)};;;`,
    role ? `TITLE:${escapeVCard(role)}` : '',
    phone ? `TEL;TYPE=CELL:${escapeVCard(phone)}` : '',
    `URL:${canonicalUrl}`,
    'END:VCARD',
    '',
  ].filter(Boolean).join('\r\n')

  const blob = new Blob([content], { type: 'text/vcard;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  const mobile = /iphone|ipad|ipod|android/i.test(window.navigator.userAgent)

  anchor.href = url
  anchor.rel = 'noopener'
  anchor.download = `${safeFileName(name)}.vcf`
  if (mobile) anchor.target = '_self'

  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), mobile ? 60000 : 1500)
  return true
}

export function installFreeContactVCardFix() {
  if (typeof document === 'undefined') return

  document.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof Element)) return
    const button = target.closest('.ilx-save-contact')
    if (!button) return

    if (!downloadContactFromVisibleProfile()) return

    event.preventDefault()
    event.stopPropagation()
    if ('stopImmediatePropagation' in event) event.stopImmediatePropagation()
  }, true)
}
