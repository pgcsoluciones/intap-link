export type CookieNames = {
  session: string
  activationIntent: string
  oauthState: string
}

export function isPreviewEnvironment(env: any): boolean {
  return String(env?.ENVIRONMENT || '').trim().toLowerCase() === 'preview'
}

export function cookieNames(env: any): CookieNames {
  if (isPreviewEnvironment(env)) {
    return {
      session: 'intap_preview_session_id',
      activationIntent: 'intap_preview_activation_intent',
      oauthState: 'intap_preview_oauth_state',
    }
  }

  return {
    session: 'session_id',
    activationIntent: 'intap_activation_intent',
    oauthState: 'oauth_state',
  }
}

export function buildScopedCookie(
  env: any,
  appUrl: string,
  name: string,
  value: string,
  maxAge: number,
  path = '/',
): string {
  let cookie = `${name}=${encodeURIComponent(value)}; HttpOnly; Secure; SameSite=Lax; Path=${path}; Max-Age=${maxAge}`

  // Preview cookies are deliberately host-only. Production keeps its
  // established cross-subdomain session contract for app.intaprd.com.
  if (!isPreviewEnvironment(env)) {
    try {
      const hostname = new URL(appUrl).hostname
      if (hostname === 'intaprd.com' || hostname.endsWith('.intaprd.com')) {
        cookie += '; Domain=.intaprd.com'
      }
    } catch { /* Invalid configuration: omit Domain safely. */ }
  }

  return cookie
}
