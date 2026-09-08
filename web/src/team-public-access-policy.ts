function appOrigin() {
  const host = window.location.hostname.toLowerCase()
  if (host === 'preview.intaprd.com' || host.includes('preview') || host.endsWith('.pages.dev')) return 'https://app.preview.intaprd.com'
  return 'https://app.intaprd.com'
}

type TeamPolicy = { team_member: boolean; login_enabled: boolean; role?: string | null; synchronized?: boolean; team_name?: string; company_name?: string; show_bank_accounts?: boolean }

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
  root.dataset.kawvoTeamName = String(policy.company_name || '').trim()
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
      company_name: String(json.data?.company_name || '').trim(),
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

function applyTeamIdentityPolicy(data: TeamPolicy) {
  if (!data.team_member) return
  const companyName = String(data.company_name || '').trim()
  if (!companyName) return

  const containers = Array.from(document.querySelectorAll<HTMLElement>('.ilx-impact-name, .ilx-personal-text, .ilx-essential-name'))
  for (const container of containers) {
    const memberName = container.querySelector<HTMLElement>('h1')
    const role = container.querySelector<HTMLElement>('p')
    if (!memberName) continue

    let company = container.querySelector<HTMLElement>('.ilx-team-company')
    if (!company) {
      company = document.createElement('div')
      company.className = 'ilx-team-company'
      container.insertBefore(company, memberName)
    }
    company.textContent = companyName
    company.style.fontSize = 'clamp(1.7rem, 5vw, 2.35rem)'
    company.style.fontWeight = '900'
    company.style.lineHeight = '1.05'
    company.style.letterSpacing = '-0.035em'
    company.style.marginBottom = '6px'

    memberName.classList.add('ilx-team-member-name')
    memberName.style.fontSize = 'clamp(1.15rem, 3.5vw, 1.45rem)'
    memberName.style.fontWeight = '800'
    memberName.style.lineHeight = '1.15'
    memberName.style.margin = '0'

    if (role) {
      role.classList.add('ilx-team-member-role')
      role.style.fontSize = '0.82rem'
      role.style.fontWeight = '650'
      role.style.lineHeight = '1.25'
      role.style.marginTop = '4px'
      role.style.opacity = '0.78'
    }
  }
}

async function applyTeamAccessPolicy() {
  const slug = currentSlug()
  if (!slug || slug === 'l') return

  const data = await loadPolicy(slug)
  exposePolicy(data)
  if (!data) return

  applyTeamIdentityPolicy(data)

  const bankSection = document.getElementById('bancos')
  if (data.team_member && data.show_bank_accounts === false && bankSection) bankSection.remove()

  const login = document.querySelector<HTMLAnchorElement>('.ilx-footer-login')
  if (!login) return

  login.style.setProperty('display', 'none', 'important')
  login.setAttribute('aria-hidden', 'true')

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
