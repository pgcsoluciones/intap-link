/** Preview-only navigation hint. Never an authentication or account-selection mechanism. */
export function freeShellPreviewReturnUrl(): string | null {
  if (typeof window === 'undefined') return null
  // Public/production profiles and other role previews must retain their original actions.
  if (window.location.hostname !== 'preview.intaprd.com') return null
  const query = new URLSearchParams(window.location.search)
  if (query.get('preview') !== '1' || query.get('embedded') === '1') return null

  // The private App Preview begins this flow by appending a fragment to the
  // existing authenticated profile-preview URL. HTTP redirects inherit a
  // fragment when Location does not specify one (RFC 9110 §10.2.2).
  const marker = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  if (marker.get('kawvo_shell') !== '1' || marker.get('tab') !== 'profile') return null
  const slug = marker.get('slug') || ''
  let pageSlug = ''
  try { pageSlug = decodeURIComponent(window.location.pathname.replace(/^\/+|\/+$/g, '')) }
  catch { return null }
  if (!/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(slug) || slug.toLowerCase() !== pageSlug.toLowerCase()) return null
  return 'https://app.preview.intaprd.com/admin/free/shell-preview?kawvo_shell=1&resume=profile&slug=' + encodeURIComponent(slug)
}
