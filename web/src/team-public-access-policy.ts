function appOrigin() {
  const host = window.location.hostname.toLowerCase()
  if (host === 'preview.intaprd.com' || host.includes('preview') || host.endsWith('.pages.dev')) return 'https://app.preview.intaprd.com'
  return 'https://app.intaprd.com'
}

type TeamPolicy = { team_member: boolean; login_enabled: boolean; role?: string | null; synchronized?: boolean }

const policyCache = new Map<string, TeamPolicy>()
const pending = new Map<string, Promise<TeamPolicy | null>>()

function currentSlug() {
  return decodeURIComponent(window.location.pathname.split('/').filter(Boolean)[0] || '').trim()
}

async function loadPolicy(slug: string): Promise<TeamPolicy | null> {
  const cached = policyCache.get(slug)
  if (cached) return cached
  const existing = pending.get(slug)
  if (existing) return existing

  const request = fetch(`${appOrigin()}/api/v1/public/team/member-access/policy?slug=${encodeURIComponent(slug)}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  }).then(async (response) => {
    const json: any = await response.json().catch(() => ({ ok: false }))
    if (!response.ok || !json?.ok) return null
    const policy: TeamPolicy = {
      team_member: Boolean(json.data?.team_member),
      login_enabled: Boolean(json.data?.login_enabled),
      role: json.data?.role ?? null,
      synchronized: Boolean(json.data?.synchronized),
    }
    policyCache.set(slug, policy)
    return policy
  }).catch(() => null).finally(() => pending.delete(slug))

  pending.set(slug, request)
  return request
}

async function applyTeamAccessPolicy() {
  const login = document.querySelector<HTMLAnchorElement>('.ilx-footer-login')
  if (!login) return

  const slug = currentSlug()
  if (!slug || slug === 'l') return

  // No dejamos visible el acceso mientras todavía no sabemos si el perfil es Team.
  // Así un miembro común nunca recibe un parpadeo de "Iniciar sesión".
  login.style.display = 'none'
  login.setAttribute('aria-hidden', 'true')

  const data = await loadPolicy(slug)
  if (!data) return

  if (!data.team_member) {
    login.style.removeProperty('display')
    login.removeAttribute('aria-hidden')
    return
  }

  // La API actualiza las secciones heredadas desde el Master. Como la consulta
  // pública del perfil pudo ocurrir unos milisegundos antes, hacemos una sola
  // recarga por visita para que el usuario vea inmediatamente la versión nueva.
  if (data.synchronized) {
    const key = `kawvo_team_synced_reload:${slug}`
    if (sessionStorage.getItem(key) !== '1') {
      sessionStorage.setItem(key, '1')
      window.location.reload()
      return
    }
  }

  if (!data.login_enabled) {
    login.removeAttribute('href')
    return
  }

  login.style.removeProperty('display')
  login.removeAttribute('aria-hidden')
  login.href = `${appOrigin()}/team-access/${encodeURIComponent(slug)}`
  login.textContent = 'Iniciar sesión'
}

export function installTeamPublicAccessPolicy() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  let scheduled = false
  const scheduleApply = () => {
    if (scheduled) return
    scheduled = true
    window.requestAnimationFrame(() => {
      scheduled = false
      void applyTeamAccessPolicy()
    })
  }

  const observer = new MutationObserver(scheduleApply)
  const start = () => {
    observer.observe(document.documentElement, { childList: true, subtree: true })
    scheduleApply()
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true })
  else start()

  window.addEventListener('popstate', () => {
    policyCache.delete(currentSlug())
    scheduleApply()
  })
}
