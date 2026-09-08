function isPreviewHost() {
  const host = window.location.hostname.toLowerCase()
  return host === 'app.preview.intaprd.com' || host.includes('preview') || host.endsWith('.pages.dev')
}

function previewWebOrigin() {
  return 'https://preview.intaprd.com'
}

export function installFreePreviewLinkFallback() {
  if (typeof window === 'undefined' || typeof document === 'undefined' || !isPreviewHost()) return

  document.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof Element)) return
    const anchor = target.closest<HTMLAnchorElement>('a[href*="/api/v1/me/free/profile-preview/"]')
    if (!anchor) return

    let parsed: URL
    try { parsed = new URL(anchor.href, window.location.origin) } catch { return }
    const marker = '/api/v1/me/free/profile-preview/'
    const index = parsed.pathname.indexOf(marker)
    if (index < 0) return
    const slug = decodeURIComponent(parsed.pathname.slice(index + marker.length)).trim()
    if (!slug) return

    event.preventDefault()
    event.stopPropagation()
    window.open(`${previewWebOrigin()}/${encodeURIComponent(slug)}?preview=1`, '_blank', 'noopener,noreferrer')
  }, true)
}
