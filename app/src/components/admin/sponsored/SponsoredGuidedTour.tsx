import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const EVENT='kawvo:sponsored-tour:start'
const SEEN_KEY='kawvo_sponsored_guided_tour_seen_v2'

type Step={title:string;description:string;labels:string[]}
const STEPS:Step[]=[
  {title:'Tu presentación',description:'Aquí ves el estado general de tu presentación patrocinada y puedes entrar a cada sección para mantenerla actualizada.',labels:['Mi presentación']},
  {title:'Identidad',description:'Agrega tu nombre o negocio, especialización, una breve descripción de lo que haces y, si deseas, tu foto de avatar.',labels:['Presentación']},
  {title:'Contáctanos',description:'Configura WhatsApp, teléfono, Instagram y ubicación para que tus clientes puedan comunicarse contigo fácilmente.',labels:['Contáctanos']},
  {title:'Nuestro horario',description:'Indica tus días y horarios de atención. Puedes agregar o quitar líneas según tu forma de trabajar.',labels:['Nuestro horario']},
  {title:'Catálogo o galería',description:'Sube hasta 10 imágenes y elige el nombre de esta sección, por ejemplo Catálogo, Portafolio, Proyectos o Mis trabajos.',labels:['Galería']},
  {title:'Apariencia',description:'Selecciona la combinación de colores que mejor represente tu presentación manteniendo el diseño aprobado.',labels:['Apariencia']},
  {title:'Guardar y publicar',description:'Guarda tus cambios, publica tu presentación y luego podrás verla, compartirla, copiar su enlace o descargar su QR.',labels:['Guardar cambios','Publicar presentación']},
  {title:'Ayuda y crecimiento',description:'Desde aquí puedes solicitar soporte técnico o conocer cómo convertirte también en patrocinador.',labels:['Soporte técnico','Quiero ser patrocinador']},
]

function findElement(labels:string[]){
  const all=Array.from(document.querySelectorAll<HTMLElement>('h1,h2,h3,button,a'))
  for(const label of labels){
    const hit=all.find(el=>String(el.textContent||'').trim().includes(label))
    if(hit)return hit.closest<HTMLElement>('section,header')||hit.parentElement||hit
  }
  return null
}
function ready(){return Boolean(document.querySelector('[data-sponsored-tour-ready="1"]'))}
function clamp(value:number,min:number,max:number){return Math.max(min,Math.min(max,value))}

export default function SponsoredGuidedTour(){
  const[open,setOpen]=useState(false);const[index,setIndex]=useState(0);const[rect,setRect]=useState<DOMRect|null>(null);const[cardHeight,setCardHeight]=useState(250)
  const cardRef=useRef<HTMLElement|null>(null)
  const available=useMemo(()=>STEPS.filter(step=>Boolean(findElement(step.labels))),[open])
  const position=useCallback((stepIndex:number)=>{
    const target=available[stepIndex]?findElement(available[stepIndex].labels):null
    if(!target)return
    target.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center',inline:'nearest'})
    window.setTimeout(()=>setRect(target.getBoundingClientRect()),260)
  },[available])
  useEffect(()=>{
    const start=()=>{if(!ready())return;setIndex(0);setRect(null);setOpen(true)}
    window.addEventListener(EVENT,start as EventListener)
    const timer=window.setTimeout(()=>{if(localStorage.getItem(SEEN_KEY)!=='1'&&ready())start()},700)
    return()=>{window.clearTimeout(timer);window.removeEventListener(EVENT,start as EventListener)}
  },[])
  useEffect(()=>{if(!open||!available[index])return;position(index)},[open,index,available,position])
  useEffect(()=>{
    if(!open)return
    const update=()=>{const target=available[index]?findElement(available[index].labels):null;if(target)setRect(target.getBoundingClientRect());if(cardRef.current)setCardHeight(cardRef.current.getBoundingClientRect().height||250)}
    const observer=typeof ResizeObserver!=='undefined'&&cardRef.current?new ResizeObserver(update):null
    if(observer&&cardRef.current)observer.observe(cardRef.current)
    window.addEventListener('resize',update);window.addEventListener('scroll',update,true);window.requestAnimationFrame(update)
    return()=>{observer?.disconnect();window.removeEventListener('resize',update);window.removeEventListener('scroll',update,true)}
  },[open,index,available])
  if(!open||available.length===0)return null
  const safeIndex=Math.min(index,available.length-1);const step=available[safeIndex]
  function close(){localStorage.setItem(SEEN_KEY,'1');setOpen(false)}
  function go(next:number){const value=clamp(next,0,available.length-1);setRect(null);setIndex(value)}

  const pad=14
  const safeRect=rect?{left:clamp(rect.left-pad,8,window.innerWidth-16),top:clamp(rect.top-pad,8,window.innerHeight-16),right:clamp(rect.right+pad,8,window.innerWidth-8),bottom:clamp(rect.bottom+pad,8,window.innerHeight-8)}:null
  const holeWidth=safeRect?Math.max(0,safeRect.right-safeRect.left):0;const holeHeight=safeRect?Math.max(0,safeRect.bottom-safeRect.top):0
  const cardWidth=Math.min(390,window.innerWidth-32);const gap=16;const margin=16
  const cardLeft=safeRect?clamp(safeRect.left+holeWidth/2-cardWidth/2,16,window.innerWidth-cardWidth-16):(window.innerWidth-cardWidth)/2
  const spaceBelow=safeRect?window.innerHeight-safeRect.bottom:0;const spaceAbove=safeRect?safeRect.top:0
  let cardTop=window.innerHeight-cardHeight-margin
  if(safeRect){cardTop=spaceBelow>=cardHeight+gap+margin||spaceBelow>=spaceAbove?safeRect.bottom+gap:safeRect.top-cardHeight-gap}
  cardTop=clamp(cardTop,margin,Math.max(margin,window.innerHeight-cardHeight-margin))

  return <div className="fixed inset-0 z-[10000]" role="dialog" aria-modal="true" aria-label="Recorrido de tu presentación">
    {safeRect?<>
      <div className="fixed left-0 right-0 top-0 bg-slate-950/80 backdrop-blur-[1px]" style={{height:safeRect.top}}/>
      <div className="fixed left-0 bg-slate-950/80 backdrop-blur-[1px]" style={{top:safeRect.top,width:safeRect.left,height:holeHeight}}/>
      <div className="fixed right-0 bg-slate-950/80 backdrop-blur-[1px]" style={{top:safeRect.top,left:safeRect.right,height:holeHeight}}/>
      <div className="fixed bottom-0 left-0 right-0 bg-slate-950/80 backdrop-blur-[1px]" style={{top:safeRect.bottom}}/>
      <div className="pointer-events-none fixed rounded-[26px] border-[3px] border-cyan-300 shadow-[0_0_0_5px_rgba(34,211,238,0.16),0_0_46px_rgba(34,211,238,0.42)]" style={{left:safeRect.left,top:safeRect.top,width:holeWidth,height:holeHeight}}/>
    </>:<div className="fixed inset-0 bg-slate-950/80 backdrop-blur-[1px]"/>}
    <section ref={cardRef} className="fixed z-[10002] rounded-[26px] border border-cyan-100 bg-white p-5 shadow-[0_28px_90px_rgba(2,8,23,.34)]" style={{width:cardWidth,left:cardLeft,top:cardTop}}>
      <div className="flex items-center justify-between gap-4"><span className="rounded-full bg-cyan-50 px-3 py-1 text-[11px] font-black uppercase tracking-[.1em] text-cyan-700">Recorrido {safeIndex+1} de {available.length}</span><button type="button" onClick={close} className="text-xs font-black text-slate-400">Omitir</button></div>
      <h2 className="mt-4 text-2xl font-black tracking-[-.03em] text-slate-950">{step.title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p>
      <div className="mt-5 flex gap-2"><button type="button" disabled={safeIndex===0} onClick={()=>go(safeIndex-1)} className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-600 disabled:opacity-30">Anterior</button>{safeIndex>=available.length-1?<button type="button" onClick={close} className="flex-1 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white">Finalizar</button>:<button type="button" onClick={()=>go(safeIndex+1)} className="flex-1 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white">Siguiente</button>}</div>
    </section>
  </div>
}

export { EVENT as SPONSORED_TOUR_EVENT }
