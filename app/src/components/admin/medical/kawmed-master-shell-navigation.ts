import type {MutableRefObject, ReactNode} from 'react'
import {getKawMedShellReturn,kawMedContextUrl,KAWMED_AGENDA_SECTIONS,type KawMedShellReturn,type KawMedAgendaSection} from './KawMedShellReturn'
import type {KawMedShellTab} from './kawmed-shell-navigation'
export type KawMedMasterSection='identity'|'codes'|'account'
export type KawMedMasterTab=KawMedShellTab|'sponsorship'
export type KawMedMasterReturn=KawMedShellReturn&{sponsor:string;masterSection?:KawMedMasterSection;codeQuery?:string;codeStatus?:string;codeRep?:string}
export type KawMedMasterNavigation={selectTab:(tab:KawMedShellTab)=>void;context:()=>KawMedShellReturn;hasPending:()=>boolean}
export type KawMedMasterHost={sponsorId:string;navigation:MutableRefObject<KawMedMasterNavigation|null>;onReady:(id:string,agendaAllowed:boolean)=>void;beforeExit:()=>boolean;moreTools:ReactNode;toolsPending?:boolean}
export const KAWMED_MASTER_TABS:readonly {id:KawMedMasterTab;label:string;icon:string}[]=[{id:'home',label:'Inicio',icon:'⌂'},{id:'profile',label:'Perfil',icon:'◉'},{id:'sponsorship',label:'Patrocinios',icon:'▤'},{id:'more',label:'Más',icon:'☷'}]
const id=(v:unknown):v is string=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,160}$/.test(v)
export function isKawMedMasterReturnContext(context:KawMedShellReturn):context is KawMedMasterReturn{return 'sponsor'in context&&id(context.sponsor)}
export function isKawMedMasterShellRequest({mode,hostname,pathname,search}:{mode:string;hostname:string;pathname:string;search:string}){
 const p=new URLSearchParams(search),flag=p.get('kawvo_med_shell')
 return mode==='preview'&&hostname==='app.preview.intaprd.com'&&['/admin/sponsor/kawmed','/admin/medical/agenda','/admin/accounts'].includes(pathname)
  &&p.get('legacy')!=='1'&&(pathname==='/admin/sponsor/kawmed'?(flag===null||flag==='1'):flag==='1')&&(pathname==='/admin/sponsor/kawmed'?!p.has('scope')||p.get('scope')==='sponsor_master':p.get('scope')==='sponsor_master')
}
export function isKawMedMasterIdentity({sponsorId,currentSponsorId,role,active}:{sponsorId:unknown;currentSponsorId:unknown;role:unknown;active:any}){
 return id(sponsorId)&&['owner','admin'].includes(String(role))&&(!currentSponsorId||currentSponsorId===sponsorId)&&(!active||active.kind==='medical_master'&&active.id===sponsorId)
}
export function getKawMedMasterReturn(search:string,pathname:string):KawMedMasterReturn|null{
 const p=new URLSearchParams(search),sponsor=p.get('med_sponsor'),section=p.get('med_master_section')
 if(!['/admin/sponsor/kawmed','/admin/medical/agenda','/admin/accounts'].includes(pathname)||p.get('med_role')!=='master'||!id(sponsor)||p.get('scope')!=='sponsor_master')return null
 p.delete('scope')
 const core=getKawMedShellReturn('?'+p,'/admin/medical',true)
 const codeQuery=p.get('master_q')||'',codeStatus=p.get('master_status')||'all',codeRep=p.get('master_rep')||'all'
 if(!core||core.viaRequests||section&&!['identity','codes','account'].includes(section)||section&&core.tab!=='more'||codeQuery.length>160||!['all','available','claimed','inactive'].includes(codeStatus)||!id(codeRep))return null
 return {...core,sponsor,...(section?{masterSection:section as KawMedMasterSection}:{}),codeQuery,codeStatus,codeRep}
}
export function kawMedMasterContextUrl(path:'/admin/sponsor/kawmed'|'/admin/medical/agenda'|'/admin/accounts',context:KawMedMasterReturn,entry?:{section?:KawMedAgendaSection;request?:string}){
 if(!['/admin/sponsor/kawmed','/admin/medical/agenda','/admin/accounts'].includes(path)||!id(context.sponsor)||!id(context.account))throw Error('Contexto Master inválido')
 const p=new URLSearchParams(kawMedContextUrl('/admin/medical',context,entry).split('?')[1]);p.set('scope','sponsor_master');p.set('med_role','master');p.set('med_sponsor',context.sponsor)
 if(context.masterSection&&context.tab==='more')p.set('med_master_section',context.masterSection)
 if(context.codeQuery)p.set('master_q',context.codeQuery.slice(0,160));if(context.codeStatus)p.set('master_status',context.codeStatus);if(context.codeRep)p.set('master_rep',context.codeRep)
 return path+'?'+p.toString()
}
export function kawMedMasterInitialSurface(search:string){
 const p=new URLSearchParams(search),legacy=p.get('tab'),context=getKawMedMasterReturn(search,'/admin/sponsor/kawmed')
 if(context)return {tab:context.tab,section:context.masterSection}
 return {tab:(legacy==='profile'?'profile':legacy==='agenda'?'agenda':['identity','codes','account'].includes(legacy||'')?'more':'home') as KawMedShellTab,section:['identity','codes','account'].includes(legacy||'')?legacy as KawMedMasterSection:undefined}
}
export function kawMedMasterAgendaEntry(pathname:string,search:string){
 const p=new URLSearchParams(search)
 if(pathname!=='/admin/medical/agenda'||p.get('scope')!=='sponsor_master'||p.get('kawvo_med_shell')!=='1'||p.has('med_role'))return null
 const next=new URLSearchParams({kawvo_med_shell:'1',tab:'agenda'}),section=p.get('section') as KawMedAgendaSection,request=p.get('request')||''
 if(KAWMED_AGENDA_SECTIONS.includes(section))next.set('master_enter',section)
 if(id(request)){next.set('master_enter','requests');next.set('request',request)}
 return '/admin/sponsor/kawmed?'+next
}
