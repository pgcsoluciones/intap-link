import { getKawMedShellReturn, kawMedContextUrl, KAWMED_AGENDA_SECTIONS, type KawMedShellReturn, type KawMedAgendaSection } from './KawMedShellReturn'
import type { KawMedShellTab } from './kawmed-shell-navigation'

export type KawMedGuestRole = 'demo' | 'delegate'
export type KawMedGuestReturn = KawMedShellReturn & { role: KawMedGuestRole }
/** Existing invitation routes only. A token/path is a hint, never a grant. */
export function kawMedGuestRoute(pathname: string) {
  const match = pathname.match(/^\/admin\/medical\/demo\/([a-f0-9]{64}|i-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})(\/agenda)?$/)
  return match ? { base: '/admin/medical/demo/' + match[1], token: match[1], agenda: Boolean(match[2]) } : null
}
export function isKawMedGuestShellRequest({ mode, hostname, pathname, search }: { mode: string; hostname: string; pathname: string; search: string }) {
  const params = new URLSearchParams(search), optIn = params.get('kawvo_med_shell')
  return mode === 'preview' && hostname === 'app.preview.intaprd.com' && Boolean(kawMedGuestRoute(pathname))
    && params.get('legacy') !== '1' && !params.has('scope') && (optIn === null || optIn === '1')
}
export function canUseKawMedDelegateShell(context: Parameters<typeof isKawMedGuestShellRequest>[0] & {
  scope: string; assignedId: unknown; verifiedId: unknown; profileId: unknown
}) {
  return isKawMedGuestShellRequest(context) && context.scope === 'doctor'
    && typeof context.assignedId === 'string' && Boolean(context.assignedId)
    && context.assignedId === context.verifiedId && context.profileId === context.verifiedId
}
export function getKawMedGuestReturn(search: string, pathname: string, role: KawMedGuestRole): KawMedGuestReturn | null {
  if (!kawMedGuestRoute(pathname) || new URLSearchParams(search).get('med_role') !== role) return null
  const context = getKawMedShellReturn(search, '/admin/medical', true)
  return context ? { ...context, role } : null
}
export function kawMedGuestContextUrl(base: string, context: KawMedGuestReturn, entry?: { section?: KawMedAgendaSection; request?: string }) {
  if (!kawMedGuestRoute(base) || kawMedGuestRoute(base)?.agenda) throw Error('Ruta de invitación inválida')
  const target = kawMedContextUrl('/admin/medical', context, entry), params = new URLSearchParams(target.split('?')[1])
  params.set('med_role', context.role)
  return base + (entry ? '/agenda' : '') + '?' + params.toString()
}
export function kawMedGuestTab(search: string, agendaAllowed: boolean): KawMedShellTab {
  const tab = new URLSearchParams(search).get('med_tab')
  return tab === 'home' || tab === 'more' || tab === 'profile' ? tab : tab === 'agenda' && agendaAllowed ? tab : 'profile'
}
/** Canonical entry from the unchanged public guest toolbar: verify invitation at its original entry first. */
export function kawMedGuestAgendaEntry(pathname: string, search: string) {
  const route = kawMedGuestRoute(pathname), params = new URLSearchParams(search)
  if (!route?.agenda || params.has('med_role')) return null
  const next = new URLSearchParams({ kawvo_med_shell: '1', med_tab: 'agenda' })
  const section = params.get('section') as KawMedAgendaSection, request = params.get('request') || ''
  if (KAWMED_AGENDA_SECTIONS.includes(section)) next.set('med_enter', section)
  if (/^[a-zA-Z0-9_-]{1,160}$/.test(request)) { next.set('request', request); next.set('med_enter', 'requests') }
  return route.base + '?' + next.toString()
}
