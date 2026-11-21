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
  return !params.get('scope') && !context.isMaster && !context.legacyPanel && context.mode === 'preview'
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

export type SponsoredTab = 'home' | 'profile' | 'agenda' | 'more'
export type SponsoredModule = 'identity' | 'contact' | 'location' | 'schedule' | 'gallery' | 'appearance' | 'actions' | 'banks'
export type SponsoredAgendaSection = 'requests' | 'confirmed' | 'availability' | 'blocks' | 'settings'
export type SponsoredSurface = {tab: SponsoredTab; module?: SponsoredModule; section?: SponsoredAgendaSection; request?: string; query: string}
const tabs = ['home','profile','agenda','more'] as const
const modules = ['identity','contact','location','schedule','gallery','appearance','actions','banks'] as const
const sections = ['requests','confirmed','availability','blocks','settings'] as const
export function isSponsoredShellRequest(mode: string, hostname: string, search: string): boolean {
  const p = new URLSearchParams(search)
  return mode === 'preview' && hostname === 'app.preview.intaprd.com' && p.get('kawvo_sponsored_shell') === '1' && !p.get('scope')
}
export function sponsoredSurface(search: string): SponsoredSurface {
  const p = new URLSearchParams(search), tab = p.get('sp_tab') as SponsoredTab
  const module = p.get('sp_module') as SponsoredModule, section = p.get('sp_section') as SponsoredAgendaSection
  return {tab: tabs.includes(tab) ? tab : 'home', module: tab === 'profile' && modules.includes(module) ? module : undefined, section: tab === 'agenda' && sections.includes(section) ? section : undefined, query: (p.get('sp_q') || '').slice(0,160), ...(tab==='agenda'&&section==='requests'&&/^[a-zA-Z0-9_-]{1,128}$/.test(p.get('request')||'')?{request:p.get('request')!}:{})}
}
/** Closed destination; UI hints never select or authorize an account. */
export function sponsoredShellUrl(profileId: string, surface: Partial<SponsoredSurface> = {}): string {
  const p = new URLSearchParams()
  if(profileId) p.set('profile_id',profileId)
  p.set('kawvo_sponsored_shell','1')
  if(surface.tab && tabs.includes(surface.tab)) p.set('sp_tab',surface.tab)
  if(surface.tab === 'profile' && surface.module && modules.includes(surface.module)) p.set('sp_module',surface.module)
  if(surface.tab === 'agenda' && surface.section && sections.includes(surface.section)) p.set('sp_section',surface.section)
  if(surface.tab==='agenda'&&surface.section==='requests'&&surface.request&&/^[a-zA-Z0-9_-]{1,128}$/.test(surface.request))p.set('request',surface.request)
  if(surface.query) p.set('sp_q',surface.query.slice(0,160))
  return '/admin/sponsored?' + p.toString()
}
export function sponsoredEntryUrl(target: string, search: string, mode: string, hostname: string): string {
  if(!isSponsoredShellRequest(mode,hostname,search)) return target
  try {
    const url = new URL(target,'https://app.preview.intaprd.com')
    if(url.origin!=='https://app.preview.intaprd.com'||url.username||url.password||!/^\/admin\/sponsored(?:\/|$)/.test(url.pathname))return target
    url.searchParams.set('kawvo_sponsored_shell','1')
    return url.pathname + url.search
  } catch { return target }
}

// Register before BrowserRouter, matching AppointmentManager's existing cancellation
// pattern: a cancelled native traversal must never unmount the draft owner first.
let sponsoredPopGuard: ((event: PopStateEvent) => void) | null = null
if(typeof window !== 'undefined') window.addEventListener('popstate',event=>sponsoredPopGuard?.(event),true)
export function installSponsoredPopGuard(handler: (event: PopStateEvent) => void): () => void {
  sponsoredPopGuard=handler
  return ()=>{if(sponsoredPopGuard===handler)sponsoredPopGuard=null}
}
