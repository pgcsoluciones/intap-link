import {sponsoredSurface,type SponsoredSurface,type SponsoredModule,type SponsoredAgendaSection} from './sponsored-shell-gate'
export type SponsorTab='home'|'profile'|'sponsorship'|'more'
export type SponsorSurface={tab:SponsorTab;view:'devices'|'assignments';tool?:'brand'|'credentials'|'agenda';module?:SponsoredModule;section?:SponsoredAgendaSection;request?:string;profileQuery:string;query:string;status:string;assignment:string;page:number}
export type SponsorPresentationHost={sponsorId:string;surface:SponsoredSurface;onNavigate:(surface:Partial<SponsoredSurface>)=>void;onReady:(id:string,agenda:boolean)=>void}
export const SPONSOR_TABS=[{id:'home',label:'Inicio',icon:'⌂'},{id:'profile',label:'Mi presentación',icon:'◉'},{id:'sponsorship',label:'Patrocinios',icon:'▤'},{id:'more',label:'Más',icon:'☷'}] as const
const id=(v:string)=>/^[a-zA-Z0-9_-]{1,160}$/.test(v)
export function isSponsorShellHost(mode:string,hostname:string){return mode==='preview'&&hostname==='app.preview.intaprd.com'}
export function isSponsorShellRequest(mode:string,hostname:string,search:string){const p=new URLSearchParams(search);return isSponsorShellHost(mode,hostname)&&p.get('legacy')!=='1'&&p.get('kawvo_sponsor_shell')!=='0'&&!p.has('scope')}
export function canUseSponsorShell({mode,hostname,search,tenant,active}:{mode:string;hostname:string;search:string;tenant:any;active:any}){
 const expected=new URLSearchParams(search).get('sm_sponsor')||new URLSearchParams(search).get('sponsor_id')||''
 return isSponsorShellRequest(mode,hostname,search)&&id(String(tenant?.id||''))&&['owner','admin'].includes(String(tenant?.role||''))&&(!expected||expected===tenant.id)&&(!active||active.kind==='sponsor'&&active.id===tenant.id)
}
export function sponsorSurface(search:string):SponsorSurface{
 const p=new URLSearchParams(search),tab=p.get('sm_tab')||'home',tool=p.get('sm_tool'),page=Number(p.get('sm_page')||1)
 const profile=sponsoredSurface(new URLSearchParams({sp_tab:'profile',sp_module:p.get('sm_module')||'',sp_q:p.get('sm_profile_q')||''}).toString())
 const agenda=sponsoredSurface(new URLSearchParams({sp_tab:'agenda',sp_section:p.get('sm_section')||'',request:p.get('sm_request')||''}).toString())
 return {view:p.get('sm_view')==='assignments'?'assignments':'devices',tab:SPONSOR_TABS.some(t=>t.id===tab)?tab as SponsorTab:'home',tool:tab==='more'&&['brand','credentials','agenda'].includes(tool||'')?tool as SponsorSurface['tool']:undefined,module:tab==='profile'?profile.module:undefined,section:tab==='more'&&tool==='agenda'?agenda.section:undefined,request:tab==='more'&&tool==='agenda'?agenda.request:undefined,profileQuery:profile.query,query:(p.get('sm_q')||'').slice(0,160),status:['all','available','activated','published'].includes(p.get('sm_status')||'')?p.get('sm_status')!:'all',assignment:['all','assigned','unassigned'].includes(p.get('sm_assignment')||'')?p.get('sm_assignment')!:'all',page:Number.isSafeInteger(page)&&page>0?Math.min(page,100000):1}
}
/** Closed App destination. Hints never choose or authorize a tenant. */
export function sponsorShellUrl(sponsorId:string,surface:Partial<SponsorSurface>={}){
 if(!id(sponsorId))throw Error('Contexto de patrocinador inválido')
 const p=new URLSearchParams({kawvo_sponsor_shell:'1',sm_sponsor:sponsorId,sm_tab:surface.tab||'home'})
 if(surface.view)p.set('sm_view',surface.view);if(surface.tool)p.set('sm_tool',surface.tool);if(surface.module)p.set('sm_module',surface.module);if(surface.section)p.set('sm_section',surface.section);if(surface.request)p.set('sm_request',surface.request)
 if(surface.profileQuery)p.set('sm_profile_q',surface.profileQuery.slice(0,160));if(surface.query)p.set('sm_q',surface.query.slice(0,160));if(surface.status)p.set('sm_status',surface.status);if(surface.assignment)p.set('sm_assignment',surface.assignment);if(surface.page)p.set('sm_page',String(surface.page))
 const checked=sponsorSurface(p.toString())
 for(const [key,value] of [['sm_view',checked.view],['sm_tab',checked.tab],['sm_tool',checked.tool],['sm_module',checked.module],['sm_section',checked.section],['sm_request',checked.request],['sm_status',checked.status],['sm_assignment',checked.assignment],['sm_page',String(checked.page)]]){if(value)p.set(key!,value);else p.delete(key!)}
 p.sort();return '/admin/sponsor?'+p.toString()
}
export function getSponsorReturn(search:string,mode:string,hostname:string){const p=new URLSearchParams(search),sponsor=p.get('sm_sponsor')||'';return isSponsorShellRequest(mode,hostname,search)&&p.get('kawvo_sponsor_shell')==='1'&&id(sponsor)?{sponsor,surface:sponsorSurface(search)}:null}
export function sponsorSelectionUrl(profileId:string,selection:any,mode:string,hostname:string,search:string,returnSearch=''){
 const route=String(selection?.route||'/admin/accounts')
 if(!isSponsorShellHost(mode,hostname))return route+(route.includes('?')?'&':'?')+'sponsor_id='+encodeURIComponent(profileId)
 if(selection?.kind!=='sponsor'||selection?.id!==profileId||route!=='/admin/sponsor')throw Error('La selección no corresponde al patrocinador autorizado.')
 const p=new URLSearchParams(search),previous=getSponsorReturn(returnSearch,mode,hostname)
 const target=sponsorShellUrl(profileId,previous?.sponsor===profileId?previous.surface:{tab:'home'})+'&sponsor_id='+encodeURIComponent(profileId)
 return p.get('legacy')==='1'||p.get('kawvo_sponsor_shell')==='0'?target+'&legacy=1':target
}
export function sponsorAgendaEntry(search:string,mode:string,hostname:string){
 const p=new URLSearchParams(search)
 const gate=new URLSearchParams(p);gate.delete('scope')
 if(!isSponsorShellRequest(mode,hostname,gate.toString())||p.get('scope')!=='master'||p.getAll('scope').some(scope=>scope!=='master'))return null
 const sponsor=p.get('sm_sponsor')||'',request=p.get('request')||p.get('sm_request')||'',section=p.get('section')||p.get('sm_section')||''
 const target=new URLSearchParams({kawvo_sponsor_shell:'1',sm_tab:'more',sm_tool:'agenda'})
 if(id(sponsor))target.set('sm_sponsor',sponsor)
 if(['requests','confirmed','availability','blocks','settings'].includes(section))target.set('sm_section',section)
 if(id(request)){target.set('sm_section','requests');target.set('sm_request',request)}
 return '/admin/sponsor?'+target.toString()
}
let popGuard:((event:PopStateEvent)=>void)|null=null
if(typeof window!=='undefined')window.addEventListener('popstate',event=>popGuard?.(event),true)
export function installSponsorPopGuard(handler:(event:PopStateEvent)=>void){popGuard=handler;return()=>{if(popGuard===handler)popGuard=null}}
