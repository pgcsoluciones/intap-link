/** Navigation-only state for the opt-in Free shell; NEVER grants permissions or changes account. */
export type KawvoShellTab = 'home' | 'profile' | 'agenda' | 'more'
export type KawvoShellListState = { query: string; group: string }
export type KawvoShellReturn = {
  kawvoShellReturn: true
  kawvoShellTab: KawvoShellTab
  kawvoShellAccount: string
  kawvoShellList?: KawvoShellListState
  kawvoShellItem?: string
  kawvoShellViaEditor?: boolean
}
export const KAWVO_SHELL_PREVIEW_ROUTE = '/admin/free/shell-preview?kawvo_shell=1'

const tabs: KawvoShellTab[] = ['home', 'profile', 'agenda', 'more']
export function isKawvoShellPreviewHost(): boolean {
  return import.meta.env.MODE === 'preview'
    && typeof window !== 'undefined'
    && window.location.hostname === 'app.preview.intaprd.com'
}
/** Validate history.state as an untrusted navigation hint, never as proof of role or identity. */
export function getKawvoShellReturn(value: unknown): KawvoShellReturn | null {
  if (!value || typeof value !== 'object') return null
  const state = value as Record<string, unknown>
  if (state.kawvoShellReturn !== true
    || !tabs.includes(state.kawvoShellTab as KawvoShellTab)
    || typeof state.kawvoShellAccount !== 'string'
    || !state.kawvoShellAccount.trim()
    || state.kawvoShellAccount.length > 160) return null
  const result: KawvoShellReturn = {
    kawvoShellReturn: true,
    kawvoShellTab: state.kawvoShellTab as KawvoShellTab,
    kawvoShellAccount: state.kawvoShellAccount
  }
  const list = state.kawvoShellList
  if (list && typeof list === 'object') {
    const fields = list as Record<string, unknown>
    if (typeof fields.query === 'string' && fields.query.length <= 160
      && typeof fields.group === 'string' && fields.group.length <= 80) {
      result.kawvoShellList = { query: fields.query, group: fields.group }
    }
  }
  if (typeof state.kawvoShellItem === 'string' && /^[a-z0-9_-]{1,45}$/.test(state.kawvoShellItem)) {
    result.kawvoShellItem = state.kawvoShellItem
  }
  if (state.kawvoShellViaEditor === true) result.kawvoShellViaEditor = true
  return result
}
