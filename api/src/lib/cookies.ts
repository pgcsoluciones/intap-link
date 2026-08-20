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

  try {
    const hostname = new URL(appUrl).hostname

    if (isPreviewEnvironment(env)) {
      // Preview sessions and OAuth state stay host-only. The activation intent is
      // the one exception: it starts on preview.intaprd.com from /l/:publicCode
      // and must survive the handoff to app.preview.intaprd.com for login/claim.
      // Scope only that opaque intent cookie to the isolated preview subtree;
      // it never reaches production intaprd.com/app.intaprd.com.
      if (name === cookieNames(env).activationIntent && hostname.endsWith('.preview.intaprd.com')) {
        cookie += '; Domain=.preview.intaprd.com'
      }
    } else if (hostname === 'intaprd.com' || hostname.endsWith('.intaprd.com')) {
      // Production keeps its established cross-subdomain cookie contract.
      cookie += '; Domain=.intaprd.com'
    }
  } catch { /* Invalid configuration: omit Domain safely. */ }

  return cookie
}
