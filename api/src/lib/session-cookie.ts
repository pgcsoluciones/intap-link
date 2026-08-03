type SessionCookieEnv = {
  APP_URL?: string
  ENVIRONMENT?: string
}

export function parseCookie(header: string, name: string): string | null {
  const encodedName = encodeURIComponent(name)
  const match = header.match(new RegExp(`(?:^|;\\s*)${encodedName}=([^;]*)`))
  if (match) return decodeURIComponent(match[1])

  const fallbackMatch = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return fallbackMatch ? decodeURIComponent(fallbackMatch[1]) : null
}

export function getSessionCookieName(env: SessionCookieEnv): string {
  return env.ENVIRONMENT === 'preview'
    ? 'session_id_preview'
    : 'session_id'
}

function getSessionCookieDomain(env: SessionCookieEnv): string | null {
  try {
    const hostname = new URL(env.APP_URL || '').hostname

    if (
      env.ENVIRONMENT === 'preview' &&
      (hostname === 'preview.intaprd.com' ||
        hostname.endsWith('.preview.intaprd.com'))
    ) {
      return '.preview.intaprd.com'
    }

    if (
      env.ENVIRONMENT !== 'preview' &&
      (hostname === 'intaprd.com' || hostname.endsWith('.intaprd.com'))
    ) {
      return '.intaprd.com'
    }
  } catch {
    // Una APP_URL inválida produce una cookie host-only.
  }

  return null
}

export function buildSessionCookie(
  value: string,
  env: SessionCookieEnv,
  maxAge: number,
): string {
  const cookieName = getSessionCookieName(env)
  let cookie = `${cookieName}=${encodeURIComponent(value)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`
  const domain = getSessionCookieDomain(env)
  if (domain) cookie += `; Domain=${domain}`
  return cookie
}

export function buildExpiredSessionCookie(env: SessionCookieEnv): string {
  return buildSessionCookie('', env, 0)
}
