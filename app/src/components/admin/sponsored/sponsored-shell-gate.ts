type GateContext = {
  mode: string
  hostname: string
  search: string
  isMaster: boolean
  legacyPanel: boolean
  profileId: unknown
}

/** This only selects UI. Profile access remains enforced by the API and route guard. */
export function shouldShowSponsoredShell(context: GateContext): boolean {
  const params = new URLSearchParams(context.search)
  const requestedProfile = (params.get('profile_id') || '').trim()
  const actualProfile = String(context.profileId || '').trim()
  return !context.isMaster && !context.legacyPanel && context.mode === 'preview'
    && context.hostname === 'app.preview.intaprd.com'
    && params.get('kawvo_sponsored_shell') === '1'
    && Boolean(actualProfile)
    && (!requestedProfile || requestedProfile === actualProfile)
}

/** Keep the local draft when a reload races with an edit or a failed operation. */
export function shouldReplaceSponsoredDraft(preserveForm: boolean, currentRevision: number, loadRevision: number): boolean {
  return !preserveForm && currentRevision === loadRevision
}

export function requestSponsoredExit(target: EventTarget): boolean {
  return target.dispatchEvent(new Event('kawvo-sponsored-before-exit', { cancelable: true }))
}

export function sponsoredAgendaReturn(search: string, mode: string, hostname: string): string {
  const source = new URLSearchParams(search)
  const profile = (source.get('profile_id') || '').trim()
  const master = source.get('scope') === 'master'
  if (master && !profile) return '/admin/sponsor'
  const params = new URLSearchParams()
  if (profile) params.set('profile_id', profile)
  if (!master && mode === 'preview' && hostname === 'app.preview.intaprd.com' && source.get('kawvo_sponsored_shell') === '1') {
    params.set('kawvo_sponsored_shell', '1')
  }
  const query = params.toString()
  return `/admin/sponsored${query ? `?${query}` : ''}`
}
