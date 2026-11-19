import { KAWMED_PROFILE_SECTIONS, KAWMED_SHELL_TABS, type KawMedProfileSection, type KawMedShellTab } from './kawmed-shell-navigation'

/** UI hints only, following Free's bounded, account-bound return context.
 * No arbitrary destination, credentials, entitlement or active-account mutation. */
export type KawMedShellReturn = {
  account: string; tab: KawMedShellTab; module?: KawMedProfileSection
  query?: string; group?: string; focus?: KawMedProfileSection
  viaRequests?: boolean; filter?: 'pending' | 'confirmed' | 'history'
}
export type KawMedAgendaSection = 'requests' | 'confirmed' | 'availability' | 'blocks' | 'settings'
export const KAWMED_AGENDA_SECTIONS: readonly KawMedAgendaSection[] = ['requests', 'confirmed', 'availability', 'blocks', 'settings']
const section = (value: string | null): value is KawMedProfileSection => KAWMED_PROFILE_SECTIONS.some(item => item.id === value)
const accountId = (value: string) => /^[a-zA-Z0-9_-]{1,160}$/.test(value)
export function isKawMedContextHost(mode = import.meta.env.MODE, hostname = window.location.hostname) {
  return mode === 'preview' && hostname === 'app.preview.intaprd.com'
}
export function getKawMedShellReturn(search: string, pathname = window.location.pathname, eligible = isKawMedContextHost()): KawMedShellReturn | null {
  const params = new URLSearchParams(search), account = params.get('med_account') || '', tab = params.get('med_tab') || 'home'
  if (!eligible || !['/admin/medical', '/admin/medical/agenda', '/admin/medical/notifications', '/admin/accounts'].includes(pathname)
    || params.get('kawvo_med_shell') !== '1' || params.has('scope') || !accountId(account)
    || !KAWMED_SHELL_TABS.some(item => item.id === tab)) return null
  const module = params.get('med_module'), focus = params.get('med_focus')
  const query = params.get('med_q') || '', group = params.get('med_group') || '', filter = params.get('med_filter') || 'pending'
  if ((module && (!section(module) || tab !== 'profile')) || (focus && !section(focus)) || query.length > 160 || group.length > 80
    || !['pending', 'confirmed', 'history'].includes(filter)) return null
  return { account, tab: tab as KawMedShellTab, ...(section(module) ? { module } : {}), query, group,
    ...(section(focus) ? { focus } : {}), viaRequests: params.get('med_via') === 'requests', filter: filter as KawMedShellReturn['filter'] }
}
export function kawMedContextUrl(path: '/admin/medical' | '/admin/medical/agenda' | '/admin/medical/notifications' | '/admin/accounts', context: KawMedShellReturn,
  entry?: { section?: KawMedAgendaSection; request?: string }) {
  const params = new URLSearchParams({ kawvo_med_shell: '1', med_account: context.account, med_tab: context.tab })
  if (context.module) params.set('med_module', context.module)
  if (context.query) params.set('med_q', context.query.slice(0, 160))
  if (context.group) params.set('med_group', context.group.slice(0, 80))
  if (context.focus) params.set('med_focus', context.focus)
  if (context.viaRequests) params.set('med_via', 'requests')
  if (context.filter) params.set('med_filter', context.filter)
  if (entry?.section && KAWMED_AGENDA_SECTIONS.includes(entry.section)) params.set('section', entry.section)
  if (entry?.request && /^[a-zA-Z0-9_-]{1,160}$/.test(entry.request)) params.set('request', entry.request)
  return path + '?' + params.toString()
}
export function kawMedReturnTarget(context: KawMedShellReturn) {
  return kawMedContextUrl(context.viaRequests ? '/admin/medical/notifications' : '/admin/medical', { ...context, viaRequests: false })
}
export function kawMedLegacyReturn(pathname: string, search: string) {
  const guest = pathname.match(/^(\/admin\/medical\/demo\/[^/]+)\/agenda$/)
  if (guest) return guest[1]
  return new URLSearchParams(search).get('scope') === 'sponsor_master' ? '/admin/sponsor/kawmed?tab=profile' : '/admin/medical'
}
