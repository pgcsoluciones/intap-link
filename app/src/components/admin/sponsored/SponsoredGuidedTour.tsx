import { useEffect, useMemo, useState } from 'react'

const EVENT='kawvo:sponsored-tour:start'
const SEEN_KEY='kawvo_sponsored_guided_tour_seen_v1'

type Step={title:string;description:string;labels:string[]}
const STEPS:Step[]=[
  {title:'Tu presentación',description:'Aquí ves el estado general de tu presentación patrocinada y puedes entrar a cada sección para mantenerla actualizada.',labels:['Mi presentación']},
  {title:'Identidad',description:'Agrega tu nombre o negocio, especialización, una breve descripción de lo que haces y, si deseas, tu foto de avatar.',labels:['Presentación']},
  {title:'Contáctanos',description:'Configura WhatsApp, teléfono, Instagram y ubicación para que tus clientes puedan comunicarse contigo fácilmente.',labels:['Contáctanos']},
  {title:'Nuestro horario',description:'Indica tus días y horarios de atención. Puedes agregar o quitar líneas según tu forma de trabajar.',labels:['Nuestro horario']},
  {title:'Catálogo o galería',description:'Sube hasta 10 imágenes y elige el nombre de esta sección, por ejemplo Catálogo, Portafolio, Proyectos o Mis trabajos.',labels:['Galería']},
  {title:'Apariencia',description:'Selecciona la combinación de colores que mejor represente tu presentación manteniendo el diseño aprobado.',labels:['Apariencia']},
  {title:'Cuentas bancarias',description:'Si esta función está incluida en tu patrocinio, desde Configurar cuentas podrás administrar hasta 3 cuentas activas.',labels:['Configurar cuentas']},
  {title:'Guardar y publicar',description:'Guarda tus cambios, publica tu presentación y luego podrás verla, compartirla, copiar su enlace o descargar su QR.',labels:['Guardar cambios','Publicar presentación']},
  {title:'Ayuda y crecimiento',description:'Desde aquí puedes solicitar soporte técnico o conocer cómo convertirte también en patrocinador.',labels:['Soporte técnico','Quiero ser patrocinador']},
]

function findElement(labels:string[]){
  const all=Array.from(document.querySelectorAll<HTMLElement>('h1,h2,h3,button,a'))
  for(const label of labels){
    const hit=all.find(el=>String(el.textContent||'').trim().includes(label))
    if(hit)return hit.closest<HTMLElement>('section')||hit
  }
  return null
}
function ready(){return Boolean(document.querySelector('[data-sponsored-tour-ready="1"]'))}

export default function SponsoredGuidedTour(){
  const[open,setOpen]=useState(false);const[index,setIndex]=useState(0)
  const available=useMemo(()=>STEPS.filter(step=>Boolean(findElement(step.labels))),[open])
  useEffect(()=>{
    const start=()=>{if(!ready())return;setIndex(0);setOpen(true)}
    window.addEventListener(EVENT,start as EventListener)
    const timer=window.setTimeout(()=>{if(localStorage.getItem(SEEN_KEY)!=='1'&&ready())start()},700)
    return()=>{window.clearTimeout(timer);window.removeEventListener(EVENT,start as EventListener)}
  },[])
  useEffect(()=>{if(!open||!available[index])return;const target=findElement(available[index].labels);target?.scrollIntoView({behavior:'smooth',block:'center'})},[open,index,available])
  if(!open||available.length===0)return null
  const step=available[Math.min(index,available.length-1)]
  function close(){localStorage.setItem(SEEN_KEY,'1');setOpen(false)}
  return <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/45 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Recorrido de tu presentación">
    <div className="w-full max-w-[430px] rounded-[26px] bg-white p-5 shadow-2xl"><div className="flex items-center justify-between gap-4"><span className="rounded-full bg-cyan-50 px-3 py-1 text-[11px] font-black uppercase tracking-[.1em] text-cyan-700">Recorrido {index+1} de {available.length}</span><button type="button" onClick={close} className="text-xs font-black text-slate-400">Omitir</button></div><h2 className="mt-4 text-2xl font-black tracking-[-.03em] text-slate-950">{step.title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p><div className="mt-5 flex gap-2"><button type="button" disabled={index===0} onClick={()=>setIndex(v=>Math.max(0,v-1))} className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-600 disabled:opacity-30">Anterior</button>{index>=available.length-1?<button type="button" onClick={close} className="flex-1 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white">Finalizar</button>:<button type="button" onClick={()=>setIndex(v=>Math.min(available.length-1,v+1))} className="flex-1 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white">Siguiente</button>}</div></div>
  </div>
}

export { EVENT as SPONSORED_TOUR_EVENT }
