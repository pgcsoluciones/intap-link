/** KAW-R4-001: provider-specific URL validation, independent of profile type. */
export type ExternalReviewSettings = Readonly<{ enabled: boolean; googleReviewUrl: string }>
export function normalizeGoogleReviewUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048 || /[\u0000-\u0020\u007f\\]/.test(value)) return null
  let url: URL
  try { url = new URL(value) } catch { return null }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) return null
  const host = url.hostname
  // Only known review-entry paths. Never fetch or follow redirects server-side.
  if (host === 'search.google.com' && url.pathname === '/local/writereview') {
    const ids = url.searchParams.getAll('placeid')
    if (ids.length !== 1 || !/^[A-Za-z0-9_-]{1,256}$/.test(ids[0])) return null
    if ([...url.searchParams.keys()].some(key => key !== 'placeid')) return null
    return url.href
  }
  if (host === 'g.page' && /^\/r\/[A-Za-z0-9_-]+\/review\/?$/.test(url.pathname) && !url.search) return url.href
  return null
}
export function parseExternalReviewSettings(value: unknown): ExternalReviewSettings | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  if (typeof raw.enabled !== 'boolean') return null
  if (raw.enabled === false && raw.googleReviewUrl === '') return { enabled: false, googleReviewUrl: '' }
  const googleReviewUrl = normalizeGoogleReviewUrl(raw.googleReviewUrl)
  return googleReviewUrl ? { enabled: raw.enabled, googleReviewUrl } : null
}
/** Only call with settings and eligibility obtained from an authorized profile adapter. */
export function publicExternalReviews(settings: unknown, eligible: boolean, published: boolean): { googleReviewUrl: string } | null {
  if (!eligible || !published) return null
  const parsed = parseExternalReviewSettings(settings)
  return parsed?.enabled ? { googleReviewUrl: parsed.googleReviewUrl } : null
}
