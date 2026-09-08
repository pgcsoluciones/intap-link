function appOrigin() {
  const host = window.location.hostname.toLowerCase()
  if (host === 'preview.intaprd.com' || host.includes('preview') || host.endsWith('.pages.dev')) return 'https://app.preview.intaprd.com'
  return 'https://app.intaprd.com'
}

let checkedKey = ''
let checking = false

async function applyTeamAccessPolicy() {
  const login = document.querySelector<HTMLAnchorElement>('.ilx-footer-login')
  if (!login) return

  const slug = decodeURIComponent(window.location.pathname.split('/').filter(Boolean)[0] || '').trim()
  if (!slug || slug === 'l') return
  const key = `${window.location.pathname}|${slug}`
  if (checking || checkedKey === key) return
  checking = true

  try {
    const response = await fetch(`${appOrigin()}/api/v1/public/team/member-access/policy?slug=${encodeURIComponent(slug)}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
    const json: any = await response.json().catch(() => ({ ok: false }))
    if (!response.ok || !json?.ok) return

    const data = json.data || {}
    if (!data.team_member) {
      login.style.removeProperty('display')
      return
    }

    if (!data.login_enabled) {
      login.style.display = 'none'
      login.removeAttribute('href')
      login.setAttribute('aria-hidden', 'true')
      return
    }

    login.style.removeProperty('display')
    login.removeAttribute('aria-hidden')
    login.href = `${appOrigin()}/team-access/${encodeURIComponent(slug)}`
    login.textContent = 'Iniciar sesión'
  } finally {
    checkedKey = key
    checking = false
  }
}

export function installTeamPublicAccessPolicy() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  const observer = new MutationObserver(() => { void applyTeamAccessPolicy() })
  const start = () => {
    observer.observe(document.documentElement, { childList: true, subtree: true })
    void applyTeamAccessPolicy()
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true })
  else start()

  window.addEventListener('popstate', () => {
    checkedKey = ''
    void applyTeamAccessPolicy()
  })
}
