function appOrigin() {
  const host = window.location.hostname.toLowerCase()
  if (host === 'preview.intaprd.com' || host.includes('preview') || host.endsWith('.pages.dev')) return 'https://app.preview.intaprd.com'
  return 'https://app.intaprd.com'
}

type TeamPolicy = { team_member: boolean; login_enabled: boolean; role?: string | null; synchronized?: boolean; team_name?: string; show_bank_accounts?: boolean }

const policyCache = new Map<string, TeamPolicy>()
const pending = new Map<string, Promise<TeamPolicy | null>>()

function currentSlug() {
  return decodeURIComponent(window.location.pathname.split('/').filter(Boolean)[0] || '').trim()
}

function exposePolicy(policy: TeamPolicy | null) {
  const root = document.documentElement
  if (!policy?.team_member) {
    delete root.dataset.kawvoTeamMember
    delete root.dataset.kawvoTeamName
    delete root.dataset.kawvoTeamShowBanks
    return
  }
  root.dataset.kawvoTeamMember = '1'
  root.dataset.kawvoTeamName = String(policy.team_name || '').trim()
  root.dataset.kawvoTeamShowBanks = policy.show_bank_accounts === false ? '0' : '1'
}

async function loadPolicy(slug: string): Promise<TeamPolicy | null> {
  const cached = policyCache.get(slug)
  if (cached) { exposePolicy(cached); return cached }
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
      team_name: String(json.data?.team_name || '').trim(),
      show_bank_accounts: json.data?.show_bank_accounts !== false,
    }
    policyCache.set(slug, policy)
    exposePolicy(policy)
    return policy
  }).catch(() => null).finally(() => pending.delete(slug))

  pending.set(slug, request)
  return request
}

export async function warmTeamPublicProfile() {
  if (typeof window === 'undefined') return
  const slug = currentSlug()
  if (!slug || slug === 'l') return
  exposePolicy(await loadPolicy(slug))
}

async function applyTeamAccessPolicy() {
  const login = document.querySelector<HTMLAnchorElement>('.ilx-footer-login')
  if (!login) return

  const slug = currentSlug()
  if (!slug || slug === 'l') return

  login.style.setProperty('display', 'none', 'important')
  login.setAttribute('aria-hidden', 'true')

  const data = await loadPolicy(slug)
  exposePolicy(data)
  if (!data) return

  if (!data.team_member) {
    login.style.removeProperty('display')
    login.removeAttribute('aria-hidden')
    return
  }

  if (!data.login_enabled) {
    login.remove()
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
