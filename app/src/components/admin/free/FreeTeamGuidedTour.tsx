import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type Step={id:string;target:string;title:string;text:string}
type Props={storageId:string;firstTeam?:boolean}
type TourState={completed?:boolean;snoozeUntil?:number}
const SNOOZE_MS=24*60*60*1000

const FIRST:Step[]=[
  {id:'intro',target:'[data-team-tour="header"]',title:'Crea tu primer Team',text:'Team conecta varios perfiles bajo una misma administración. El Master configura la base común una sola vez para evitar preparar cada perfil desde cero.'},
  {id:'team-name',target:'[data-team-tour="team-name"]',title:'Identifica tu Team',text:'Ponle un nombre interno que te ayude a organizar el grupo, por ejemplo Equipo Comercial o Visitadores Santo Domingo.'},
  {id:'company',target:'[data-team-tour="company"]',title:'Define la empresa principal',text:'Este nombre representa la empresa o marca que se utilizará como referencia común en los perfiles vinculados.'},
  {id:'variable-data',target:'[data-team-tour="permissions"]',title:'Define la data variable',text:'Como Administrador Master tú decides qué campos serán diferentes en cada miembro, por ejemplo nombre, cargo, foto, teléfono, WhatsApp o correo. La información corporativa compartida permanece bajo control de administración.'},
  {id:'codes',target:'[data-team-tour="codes"]',title:'Prepara accesos para el equipo',text:'Genera los códigos que usarás para vincular productos o perfiles al Team. Cada nuevo miembro aprovechará la estructura ya configurada.'},
  {id:'assignments',target:'[data-team-tour="assignments"]',title:'Controla las asignaciones',text:'Aquí puedes revisar qué códigos están disponibles, cuáles ya se utilizaron y a qué miembro quedó vinculado cada producto.'},
  {id:'members',target:'[data-team-tour="members"]',title:'Administra tus miembros',text:'Desde aquí controlas los perfiles del grupo, sus roles y su estado. Los cambios comunes se administran desde el Team, sin entrar perfil por perfil.'},
]
const NORMAL:Step[]=[
  {id:'header',target:'[data-team-tour="header"]',title:'Tu centro de administración Team',text:'Desde aquí administras el grupo conectado a tu perfil principal y mantienes una estructura común para todos los miembros.'},
  {id:'role',target:'[data-team-tour="role"]',title:'Tu función dentro del Team',text:'Aquí ves tu nivel de administración y el alcance de las funciones disponibles para tu cuenta.'},
  {id:'team-name',target:'[data-team-tour="team-name"]',title:'Nombre interno del Team',text:'Sirve para organizar e identificar el grupo dentro de Kawvo.'},
  {id:'company',target:'[data-team-tour="company"]',title:'Identidad compartida',text:'Este dato representa la empresa o marca común que utilizarán los perfiles vinculados.'},
  {id:'variable-data',target:'[data-team-tour="permissions"]',title:'Data variable administrada',text:'El Administrador Master define qué campos cambian de un miembro a otro. El resto de la información compartida permanece centralizada y bajo control de administración.'},
  {id:'codes',target:'[data-team-tour="codes"]',title:'Códigos para nuevos miembros',text:'Genera códigos para vincular productos o perfiles al Team usando la configuración ya definida.'},
  {id:'members',target:'[data-team-tour="members"]',title:'Miembros del Team',text:'Gestiona miembros, roles y estado desde un solo lugar, sin configurar cada perfil desde cero.'},
]

function clamp(v:number,min:number,max:number){return Math.max(min,Math.min(max,v))}
function read(k:string):TourState{try{return JSON.parse(localStorage.getItem(k)||'{}')}catch{return {}}}
function write(k:string,v:TourState){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}

export default function FreeTeamGuidedTour({storageId,firstTeam=false}:Props){
  const steps=firstTeam?FIRST:NORMAL
  const key=useMemo(()=>`kawvo:team-tour-${firstTeam?'first':'standard'}-v1:${storageId||'anonymous'}`,[firstTeam,storageId])
  const [open,setOpen]=useState(false),[index,setIndex]=useState(0),[rect,setRect]=useState<DOMRect|null>(null)
  const started=useRef(false)
  const find=useCallback((start:number,dir:1|-1=1)=>{let i=start;while(i>=0&&i<steps.length){if(document.querySelector(steps[i].target))return i;i+=dir}return -1},[steps])
  const position=useCallback((i=index)=>{const el=document.querySelector(steps[i]?.target) as HTMLElement|null;if(!el)return;el.scrollIntoView({block:'center',inline:'nearest',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});window.setTimeout(()=>setRect(el.getBoundingClientRect()),220)},[index,steps])
  const start=useCallback((force=false)=>{if(!force){const s=read(key);if(s.completed||Number(s.snoozeUntil||0)>Date.now())return}const first=find(0);if(first<0)return;setIndex(first);setOpen(true);window.setTimeout(()=>position(first),40)},[find,key,position])
  useEffect(()=>{if(started.current||!storageId)return;started.current=true;if(firstTeam){const t=window.setTimeout(()=>start(false),900);return()=>window.clearTimeout(t)}},[firstTeam,start,storageId])
  useEffect(()=>{const fn=()=>start(true);window.addEventListener('kawvo:team-tour:start',fn);return()=>window.removeEventListener('kawvo:team-tour:start',fn)},[start])
  useEffect(()=>{if(!open)return;const update=()=>{const el=document.querySelector(steps[index]?.target) as HTMLElement|null;if(el)setRect(el.getBoundingClientRect())};window.addEventListener('resize',update);window.addEventListener('scroll',update,true);update();return()=>{window.removeEventListener('resize',update);window.removeEventListener('scroll',update,true)}},[index,open,steps])
  const later=()=>{write(key,{snoozeUntil:Date.now()+SNOOZE_MS});setOpen(false)}
  const complete=()=>{write(key,{completed:true});setOpen(false)}
  const go=(dir:1|-1)=>{const next=find(index+dir,dir);if(next<0){if(dir===1)complete();return}setIndex(next);setRect(null);window.setTimeout(()=>position(next),30)}
  if(!open)return null
  const step=steps[index];if(!step)return null
  const pad=14
  const safe=rect?{left:clamp(rect.left-pad,8,window.innerWidth-16),top:clamp(rect.top-pad,8,window.innerHeight-16),right:clamp(rect.right+pad,8,window.innerWidth-8),bottom:clamp(rect.bottom+pad,8,window.innerHeight-8)}:null
  const w=safe?Math.max(0,safe.right-safe.left):0,h=safe?Math.max(0,safe.bottom-safe.top):0,cardWidth=Math.min(370,window.innerWidth-32),cardHeight=270,gap=14
  let top=16;if(safe){const below=safe.bottom+gap,above=safe.top-gap-cardHeight;top=below+cardHeight<=window.innerHeight-12?below:above>=12?above:clamp((window.innerHeight-cardHeight)/2,12,window.innerHeight-cardHeight-12)}
  const n=steps.slice(0,index+1).filter(s=>document.querySelector(s.target)).length,total=steps.filter(s=>document.querySelector(s.target)).length,last=find(index+1,1)<0
  return <div className="fixed inset-0 z-[10000]">{safe?<><div className="fixed left-0 right-0 top-0 bg-slate-950/80" style={{height:safe.top}}/><div className="fixed left-0 bg-slate-950/80" style={{top:safe.top,width:safe.left,height:h}}/><div className="fixed right-0 bg-slate-950/80" style={{top:safe.top,left:safe.right,height:h}}/><div className="fixed bottom-0 left-0 right-0 bg-slate-950/80" style={{top:safe.bottom}}/><div className="fixed rounded-[26px] border-[3px] border-cyan-300 shadow-[0_0_0_7px_rgba(34,211,238,.16),0_0_48px_rgba(34,211,238,.42)]" style={{left:safe.left,top:safe.top,width:w,height:h}}/></>:<div className="fixed inset-0 bg-slate-950/80"/>}<section role="dialog" aria-modal="true" className="fixed z-[10002] rounded-[26px] border border-cyan-100 bg-white p-5 shadow-[0_28px_90px_rgba(2,8,23,.34)]" style={{width:cardWidth,left:(window.innerWidth-cardWidth)/2,top}}><div className="flex items-center justify-between gap-3"><span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[.12em] text-cyan-700">{firstTeam?'Primer Team':'Recorrido Team'}</span><span className="text-[11px] font-bold text-slate-400">{n}/{total}</span></div><h2 className="mt-3 text-xl font-black tracking-[-.03em]">{step.title}</h2><p className="mt-2 text-sm font-medium leading-6 text-slate-600">{step.text}</p><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-cyan-500" style={{width:`${Math.max(8,(n/Math.max(total,1))*100)}%`}}/></div><div className="mt-5 flex items-center justify-between gap-2"><button type="button" onClick={later} className="rounded-xl px-2 py-2 text-xs font-black text-slate-500">Ver más tarde</button><div className="flex gap-2">{find(index-1,-1)>=0&&<button type="button" onClick={()=>go(-1)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600">Atrás</button>}<button type="button" onClick={()=>last?complete():go(1)} className="rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white">{last?'Completado':'Continuar'}</button></div></div></section></div>
}
