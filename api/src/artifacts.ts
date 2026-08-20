export const ARTIFACT_PRODUCT_TYPES = [
  'card',
  'ping',
  'bracelet',
  'keychain',
  'stand',
  'qr',
  'other',
] as const

export type ArtifactProductType = typeof ARTIFACT_PRODUCT_TYPES[number]

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function normalizeActivationCode(value: unknown): string {
  return typeof value === 'string'
    ? value.trim().toUpperCase().replace(/[\s-]+/g, '')
    : ''
}

export function isActivationCodeShape(value: string): boolean {
  return /^[A-Z2-9]{12,64}$/.test(value)
}

export function isPublicCodeShape(value: string): boolean {
  return /^[A-Z2-9]{8,24}$/.test(value)
}

export function generateHumanCode(length = 20): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, byte => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('')
}

export async function hashActivationCode(value: string): Promise<string> {
  const data = new TextEncoder().encode(normalizeActivationCode(value))
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

export function publicArtifactUrl(baseUrl: string, publicCode: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/l/${encodeURIComponent(publicCode)}`
}
