function currentHostname(): string {
  return typeof window === 'undefined'
    ? ''
    : window.location.hostname.toLowerCase()
}

function isPreviewHostname(hostname: string): boolean {
  return (
    hostname === 'app.preview.intaprd.com' ||
    hostname.endsWith('.intap-web2.pages.dev')
  )
}

const hostname = currentHostname()
const isPreview = isPreviewHostname(hostname)

const configuredApiOrigin =
  import.meta.env.VITE_API_URL ??
  import.meta.env.VITE_API_BASE_URL ??
  ''

const configuredWebOrigin = import.meta.env.VITE_WEB_URL ?? ''

export const API_ORIGIN = (
  isPreview
    ? 'https://app.preview.intaprd.com'
    : configuredApiOrigin ||
      (typeof window !== 'undefined' ? window.location.origin : '')
).replace(/\/$/, '')

export const WEB_ORIGIN = (
  isPreview
    ? 'https://preview.intaprd.com'
    : configuredWebOrigin || 'https://intaprd.com'
).replace(/\/$/, '')
