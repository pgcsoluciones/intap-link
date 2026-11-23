/** Strict release host/build pairing. UI navigation is never an authorization grant. */
export function isKawvoReleaseAppHost(mode: string, hostname: string): boolean {
  const host = hostname.toLowerCase()
  return (mode === 'preview' && host === 'app.preview.intaprd.com')
    || (mode === 'production' && host === 'app.intaprd.com')
}
