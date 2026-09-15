import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type Step={id:string;target:string;title:string;text:string}
type Props={storageId:string;firstTeam?:boolean}
type TourState={completed?:boolean;snoozeUntil?:number}
const SNOOZE_MS=24*60*60*1000

const FIRST:Step[]=[
  {id:'intro',target:'[data-team-tour="header"]',title:'Vamos a preparar tu primer Team',text:'Team integra varios perfiles bajo una misma administración. Configuras una base común una sola vez y evitas repetir la misma información perfil por perfil.'},
  {id:'team-name',target:'[data-team-tour="team-name"]',title:'Identifica tu Team',text:'Ponle un nombre interno para organizar el grupo. Este nombre te ayuda a distinguir el equipo dentro de Kawvo.'},
  {id:'company',target:'[data-team-tour="company"]',title:'Define la empresa del grupo',text:'Aquí indicas la empresa o marca común que servirá como referencia para los perfiles vinculados al Team.'},
  {id:'banking',target:'[data-team-tour="banking"]',title:'Controla las cuentas del Team',text:'Como Master decides si las cuentas bancarias administradas por la empresa estarán disponibles en los perfiles vinculados. La administración mantiene el control de esta información.'},
  {id:'variable-data',target:'[data-team-tour="variable-data"]',title:'Define qué cambia en cada miembro',text:'Como Administrador Master defines la data variable de cada perfil: por ejemplo nombre, cargo, foto, teléfono, WhatsApp o correo. Los datos corporativos compartidos permanecen centralizados y bajo control de administración.'},
  {id:'codes',target:'[data-team-tour="codes"]',title:'Prepara el acceso del primer miembro',text:'Genera un código para vincular un producto al Team. Al asignarlo, Kawvo utilizará la estructura común y solo tendrás que completar la data variable definida por administración.'},
  {id:'assignments',target:'[data-team-tour="assignments"]',title:'Revisa códigos y asignaciones',text:'Aquí sabrás qué códigos siguen disponibles, cuáles ya fueron utilizados y a qué miembro quedó vinculado cada producto.'},
  {id:'members',target:'[data-team-tour="members"]',title:'Aquí aparecerá tu equipo',text:'Cuando vincules miembros, sus perfiles aparecerán aquí para administrarlos desde un solo lugar. No tendrás que reconstruir la información común de cada perfil.'},
]
const NORMAL:Step[]=[
  {id:'header',target:'[data-team-tour="header"]',title:'Tu centro de administración Team',text:'Desde aquí administras los perfiles conectados a una misma base y mantienes la información del grupo organizada desde un solo lugar.'},
  {id:'role',target:'[data-team-tour="role"]',title:'Tu función dentro del Team',text:'Aquí ves tu nivel de administración y las funciones que corresponden a tu rol dentro del equipo.'},
  {id:'team-name',target:'[data-team-tour="team-name"]',title:'Nombre interno del Team',text:'Este nombre sirve para identificar y organizar el grupo dentro de Kawvo.'},
  {id:'company',target:'[data-team-tour="company"]',title:'Empresa o marca compartida',text:'Aquí defines la identidad de empresa que sirve como referencia común para los perfiles vinculados.'},
  {id:'banking',target:'[data-team-tour="banking"]',title:'Cuentas administradas por el Master',text:'El Master controla si las cuentas bancarias de la empresa estarán disponibles en los perfiles vinculados. Esta información se administra de forma centralizada.'},
  {id:'variable-data',target:'[data-team-tour="variable-data"]',title:'Data variable administrada',text:'El Administrador Master define qué campos cambian de un miembro a otro. Por ejemplo nombre, cargo, foto o contacto. Los datos corporativos compartidos permanecen bajo control de administración.'},
  {id:'codes',target:'[data-team-tour="codes"]',title:'Genera accesos para nuevos miembros',text:'Cada código prepara la vinculación de un producto al Team utilizando la estructura y la data variable que ya definiste.'},
  {id:'assignments',target:'[data-team-tour="assignments"]',title:'Códigos y asignaciones',text:'Consulta qué códigos siguen disponibles y a qué miembro quedó asignado cada producto.'},
  {id:'members',target:'[data-team-tour="members"]',title:'Perfiles del equipo',text:'Desde aquí administras miembros, roles, estado y perfiles. La información común se mantiene centralizada para evitar configuraciones repetidas.'},
]

function clamp(v:number,min:number,max:number){return Math.max(min,Math.min(max,v))}
function read(k:string):TourState{try{return JSON.parse(localStorage.getItem(k)||'{}')}catch{return {}}}
function write(k:string,v:TourState){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}

export default function FreeTeamGuidedTour({storageId,firstTeam=false}:Props){
  const steps=firstTeam?FIRST:NORMAL
  const key=useMemo(()=>`kawvo:team-tour-${firstTeam?'first':'standard'}-v2:${storageId||'anonymous'}`,[firstTeam,storageId])
  const autoKey=useMemo(()=>`kawvo:tour-auto-disabled:team:${storageId||'anonymous'}`,[storageId])
  const [open,setOpen]=useState(false),[index,setIndex]=useState(0),[rect,setRect]=useState<DOMRect|null>(null)
  const started=useRef(false)
  const find=useCallback((start:number,dir:1|-1=1)=>{let i=start;while(i>=0&&i<steps.length){if(document.querySelector(steps[i].target))return i;i+=dir}return -1},[steps])
  const TOP_CARD_STEPS=new Set(['team-name','company','banking','variable-data'])
  const position=useCallback((i=index)=>{const step=steps[i];const el=document.querySelector(step?.target) as HTMLElement|null;if(!el)return;const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;const behavior:ScrollBehavior=reduced?'auto':'smooth';if(TOP_CARD_STEPS.has(step.id)){el.scrollIntoView({block:'start',inline:'nearest',behavior});window.setTimeout(()=>{const r=el.getBoundingClientRect();const desiredTop=Math.min(330,Math.max(300,window.innerHeight*0.36));window.scrollBy({top:r.top-desiredTop,left:0,behavior});window.setTimeout(()=>setRect(el.getBoundingClientRect()),reduced?20:220)},reduced?20:180);return}el.scrollIntoView({block:'center',inline:'nearest',behavior});window.setTimeout(()=>setRect(el.getBoundingClientRect()),reduced?20:220)},[index,steps])
  const start=useCallback((force=false)=>{if(!force){const s=read(key);if(localStorage.getItem(autoKey)==='1'||s.completed||Number(s.snoozeUntil||0)>Date.now())return}const first=find(0);if(first<0)return;setIndex(first);setOpen(true);window.setTimeout(()=>position(first),40)},[autoKey,find,key,position])
  useEffect(()=>{if(started.current||!storageId)return;started.current=true;if(firstTeam){const t=window.setTimeout(()=>start(false),900);return()=>window.clearTimeout(t)}},[firstTeam,start,storageId])
  useEffect(()=>{const fn=()=>start(true);window.addEventListener('kawvo:team-tour:start',fn);return()=>window.removeEventListener('kawvo:team-tour:start',fn)},[start])
  useEffect(()=>{if(!open)return;const update=()=>{const el=document.querySelector(steps[index]?.target) as HTMLElement|null;if(el)setRect(el.getBoundingClientRect())};window.addEventListener('resize',update);window.addEventListener('scroll',update,true);update();return()=>{window.removeEventListener('resize',update);window.removeEventListener('scroll',update,true)}},[index,open,steps])
  const later=()=>{write(key,{snoozeUntil:Date.now()+SNOOZE_MS});setOpen(false)}
  const disableAuto=()=>{try{localStorage.setItem(autoKey,'1')}catch{};write(key,{completed:true});setOpen(false)}
  const complete=()=>{try{localStorage.setItem(autoKey,'1')}catch{};write(key,{completed:true});setOpen(false)}
  const go=(dir:1|-1)=>{const next=find(index+dir,dir);if(next<0){if(dir===1)complete();return}setIndex(next);setRect(null);window.setTimeout(()=>position(next),30)}
  if(!open)return null
  const step=steps[index];if(!step)return null
  const pad=14
  const safe=rect?{left:clamp(rect.left-pad,8,window.innerWidth-16),top:clamp(rect.top-pad,8,window.innerHeight-16),right:clamp(rect.right+pad,8,window.innerWidth-8),bottom:clamp(rect.bottom+pad,8,window.innerHeight-8)}:null
  const w=safe?Math.max(0,safe.right-safe.left):0,h=safe?Math.max(0,safe.bottom-safe.top):0,cardWidth=Math.min(370,window.innerWidth-32),cardHeight=280,gap=14
  const forceTopCard=TOP_CARD_STEPS.has(step.id)
  let top=16;if(forceTopCard){top=12}else if(safe){const below=safe.bottom+gap,above=safe.top-gap-cardHeight;top=below+cardHeight<=window.innerHeight-12?below:above>=12?above:clamp((window.innerHeight-cardHeight)/2,12,window.innerHeight-cardHeight-12)}
  const n=steps.slice(0,index+1).filter(s=>document.querySelector(s.target)).length,total=steps.filter(s=>document.querySelector(s.target)).length,last=find(index+1,1)<0
  return <div className="fixed inset-0 z-[10000]">{safe?<><div className="fixed left-0 right-0 top-0 bg-slate-950/80" style={{height:safe.top}}/><div className="fixed left-0 bg-slate-950/80" style={{top:safe.top,width:safe.left,height:h}}/><div className="fixed right-0 bg-slate-950/80" style={{top:safe.top,left:safe.right,height:h}}/><div className="fixed bottom-0 left-0 right-0 bg-slate-950/80" style={{top:safe.bottom}}/><div className="fixed rounded-[26px] border-[3px] border-cyan-300 shadow-[0_0_0_7px_rgba(34,211,238,.16),0_0_48px_rgba(34,211,238,.42)]" style={{left:safe.left,top:safe.top,width:w,height:h}}/></>:<div className="fixed inset-0 bg-slate-950/80"/>}<section role="dialog" aria-modal="true" className="fixed z-[10002] rounded-[26px] border border-cyan-100 bg-white p-5 shadow-[0_28px_90px_rgba(2,8,23,.34)]" style={{width:cardWidth,left:(window.innerWidth-cardWidth)/2,top}}><div className="flex items-center justify-between gap-3"><span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[.12em] text-cyan-700">{firstTeam?'Primer Team':'Recorrido Team'}</span><span className="text-[11px] font-bold text-slate-400">{n}/{total}</span></div><h2 className="mt-3 text-xl font-black tracking-[-.03em]">{step.title}</h2><p className="mt-2 text-sm font-medium leading-6 text-slate-600">{step.text}</p><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-cyan-500" style={{width:`${Math.max(8,(n/Math.max(total,1))*100)}%`}}/></div><div className="mt-5 flex items-center justify-between gap-2"><button type="button" onClick={disableAuto} className="rounded-xl px-2 py-2 text-xs font-black text-slate-500">Ya entendí · no mostrar solo</button><div className="flex gap-2">{find(index-1,-1)>=0&&<button type="button" onClick={()=>go(-1)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600">Atrás</button>}<button type="button" onClick={()=>last?complete():go(1)} className="rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white">{last?'Completado':'Continuar'}</button></div></div></section></div>
}
