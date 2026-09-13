import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type Step={id:string;target:string;title:string;text:string}
type Props={storageId:string}
type TourState={completed?:boolean;snoozeUntil?:number}

const VERSION='free-account-v1'
const SNOOZE_MS=24*60*60*1000
const STEPS:Step[]=[
  {id:'identity',target:'[data-account-tour="identity"]',title:'Tu cuenta Kawvo',text:'Aquí identificas tu cuenta, tu perfil y el plan que tienes activo. Desde tu foto también puedes actualizar tu imagen.'},
  {id:'plan',target:'[data-account-tour="plan"]',title:'Opciones de tu plan',text:'Desde aquí puedes conocer funciones adicionales disponibles para ampliar tu cuenta cuando las necesites.'},
  {id:'notifications-ai',target:'[data-account-tour="notifications-ai"]',title:'Avisos y uso de IA',text:'Consulta tus notificaciones y revisa cuántos usos de IA tienes disponibles.'},
  {id:'products',target:'[data-account-tour="products"]',title:'Tus productos Kawvo',text:'Aquí administras los dispositivos NFC o QR vinculados a tu cuenta y puedes instalar Kawvo como acceso rápido en tu dispositivo.'},
  {id:'team',target:'[data-account-tour="team"]',title:'Administra un grupo con Team',text:'Team conecta varios perfiles bajo una misma administración. El Master configura la información común una sola vez y define qué campos serán data variable para cada miembro, evitando configurar perfil por perfil.'},
  {id:'sharing',target:'[data-account-tour="sharing"]',title:'Comparte tu perfil y facilita pagos',text:'Desde aquí puedes descargar el QR de tu perfil y, cuando tengas cuentas bancarias disponibles, compartir un enlace preparado para facilitar transferencias sin exponer innecesariamente datos sensibles.'},
  {id:'help',target:'[data-account-tour="help"]',title:'Ayuda y recursos',text:'Aquí encontrarás recursos de apoyo y acceso al centro de ayuda cuando necesites asistencia.'},
  {id:'security',target:'[data-account-tour="security"]',title:'Cuenta y seguridad',text:'En esta área están las opciones relacionadas con el acceso y la seguridad de tu cuenta.'},
]

function keyOf(id:string){return `kawvo:${VERSION}:${id||'anonymous'}`}
function read(key:string):TourState{try{return JSON.parse(localStorage.getItem(key)||'{}')}catch{return {}}}
function write(key:string,value:TourState){try{localStorage.setItem(key,JSON.stringify(value))}catch{}}
function clamp(v:number,min:number,max:number){return Math.max(min,Math.min(max,v))}

export default function FreeAccountGuidedTour({storageId}:Props){
  const key=useMemo(()=>keyOf(storageId),[storageId])
  const [open,setOpen]=useState(false)
  const [index,setIndex]=useState(0)
  const [rect,setRect]=useState<DOMRect|null>(null)
  const started=useRef(false)
  const find=useCallback((start:number,dir:1|-1=1)=>{let i=start;while(i>=0&&i<STEPS.length){if(document.querySelector(STEPS[i].target))return i;i+=dir}return -1},[])
  const position=useCallback((i=index)=>{const step=STEPS[i];const el=step?document.querySelector(step.target) as HTMLElement|null:null;if(!el)return;el.scrollIntoView({block:'center',inline:'nearest',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});window.setTimeout(()=>setRect(el.getBoundingClientRect()),220)},[index])
  const start=useCallback((force=false)=>{if(!force){const s=read(key);if(s.completed||Number(s.snoozeUntil||0)>Date.now())return}const first=find(0);if(first<0)return;setIndex(first);setOpen(true);window.setTimeout(()=>position(first),40)},[find,key,position])
  useEffect(()=>{if(started.current||!storageId)return;started.current=true;const t=window.setTimeout(()=>start(false),900);return()=>window.clearTimeout(t)},[start,storageId])
  useEffect(()=>{const fn=()=>start(true);window.addEventListener('kawvo:account-tour:start',fn);return()=>window.removeEventListener('kawvo:account-tour:start',fn)},[start])
  useEffect(()=>{if(!open)return;const update=()=>{const el=document.querySelector(STEPS[index]?.target) as HTMLElement|null;if(el)setRect(el.getBoundingClientRect())};window.addEventListener('resize',update);window.addEventListener('scroll',update,true);update();return()=>{window.removeEventListener('resize',update);window.removeEventListener('scroll',update,true)}},[open,index])
  const later=()=>{write(key,{snoozeUntil:Date.now()+SNOOZE_MS});setOpen(false)}
  const complete=()=>{write(key,{completed:true});setOpen(false)}
  const go=(dir:1|-1)=>{const next=find(index+dir,dir);if(next<0){if(dir===1)complete();return}setIndex(next);setRect(null);window.setTimeout(()=>position(next),30)}
  if(!open)return null
  const step=STEPS[index];if(!step)return null
  const pad=14
  const safe=rect?{left:clamp(rect.left-pad,8,window.innerWidth-16),top:clamp(rect.top-pad,8,window.innerHeight-16),right:clamp(rect.right+pad,8,window.innerWidth-8),bottom:clamp(rect.bottom+pad,8,window.innerHeight-8)}:null
  const w=safe?Math.max(0,safe.right-safe.left):0,h=safe?Math.max(0,safe.bottom-safe.top):0
  const cardWidth=Math.min(360,window.innerWidth-32),gap=14,cardHeight=260
  let cardTop=16
  if(safe){const below=safe.bottom+gap,above=safe.top-gap-cardHeight;cardTop=below+cardHeight<=window.innerHeight-12?below:above>=12?above:clamp((window.innerHeight-cardHeight)/2,12,window.innerHeight-cardHeight-12)}
  const cardLeft=(window.innerWidth-cardWidth)/2
  const n=STEPS.slice(0,index+1).filter(s=>document.querySelector(s.target)).length,total=STEPS.filter(s=>document.querySelector(s.target)).length
  const last=find(index+1,1)<0
  return <div className="fixed inset-0 z-[10000]" aria-live="polite">{safe?<><div className="fixed left-0 right-0 top-0 bg-slate-950/80" style={{height:safe.top}}/><div className="fixed left-0 bg-slate-950/80" style={{top:safe.top,width:safe.left,height:h}}/><div className="fixed right-0 bg-slate-950/80" style={{top:safe.top,left:safe.right,height:h}}/><div className="fixed bottom-0 left-0 right-0 bg-slate-950/80" style={{top:safe.bottom}}/><div className="fixed rounded-[26px] border-[3px] border-cyan-300 shadow-[0_0_0_7px_rgba(34,211,238,.16),0_0_48px_rgba(34,211,238,.42)]" style={{left:safe.left,top:safe.top,width:w,height:h}}/></>:<div className="fixed inset-0 bg-slate-950/80"/>}<section role="dialog" aria-modal="true" className="fixed z-[10002] rounded-[26px] border border-cyan-100 bg-white p-5 shadow-[0_28px_90px_rgba(2,8,23,.34)]" style={{width:cardWidth,left:cardLeft,top:cardTop}}><div className="flex items-center justify-between gap-3"><span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[.12em] text-cyan-700">Recorrido Kawvo</span><span className="text-[11px] font-bold text-slate-400">{n}/{total}</span></div><h2 className="mt-3 text-xl font-black tracking-[-.03em]">{step.title}</h2><p className="mt-2 text-sm font-medium leading-6 text-slate-600">{step.text}</p><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-cyan-500" style={{width:`${Math.max(8,(n/Math.max(total,1))*100)}%`}}/></div><div className="mt-5 flex items-center justify-between gap-2"><button type="button" onClick={later} className="rounded-xl px-2 py-2 text-xs font-black text-slate-500">Ver más tarde</button><div className="flex gap-2">{find(index-1,-1)>=0&&<button type="button" onClick={()=>go(-1)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600">Atrás</button>}<button type="button" onClick={()=>last?complete():go(1)} className="rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white">{last?'Completado':'Continuar'}</button></div></div></section></div>
}
