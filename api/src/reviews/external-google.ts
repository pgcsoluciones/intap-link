import { normalizeGoogleReviewUrl } from '../../../shared/google-review-link'
export { normalizeGoogleReviewUrl, buildGoogleReviewUrl } from '../../../shared/google-review-link'
/** KAW-R4-001: provider-specific URL validation, independent of profile type. */
export type ExternalReviewSettings = Readonly<{ enabled: boolean; googleReviewUrl: string }>
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
