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
      // V2 deliberately uses a new name so older host/domain-scoped preview
      // activation cookies cannot shadow the scan-to-claim continuation.
      activationIntent: 'intap_preview_scan_activation_v2',
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

  try {
    const hostname = new URL(appUrl).hostname

    if (!isPreviewEnvironment(env)) {
      if (hostname === 'intaprd.com' || hostname.endsWith('.intaprd.com')) {
        // Production keeps its established cross-subdomain contract for now.
        cookie += '; Domain=.intaprd.com'
      }
    }
    // Preview cookies stay host-only. Scan-to-claim now creates its intent from
    // app.preview.intaprd.com after the public-site handoff, so no activation
    // credential needs to cross subdomains.
  } catch { /* Invalid configuration: omit Domain safely. */ }

  return cookie
}
