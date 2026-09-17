import { useEffect, useState } from 'react'
import { SPONSORED_TOUR_EVENT } from './SponsoredGuidedTour'

type InstallPromptEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>}

function isStandalone(){return window.matchMedia?.('(display-mode: standalone)').matches||Boolean((navigator as any).standalone)}
function isIos(){return /iphone|ipad|ipod/i.test(navigator.userAgent)}

export default function SponsoredExperienceTools(){
  const[promptEvent,setPromptEvent]=useState<InstallPromptEvent|null>(null);const[installed,setInstalled]=useState(false);const[help,setHelp]=useState(false)
  useEffect(()=>{
    setInstalled(isStandalone())
    const before=(event:Event)=>{event.preventDefault();setPromptEvent(event as InstallPromptEvent)}
    const done=()=>{setInstalled(true);setPromptEvent(null);setHelp(false)}
    window.addEventListener('beforeinstallprompt',before);window.addEventListener('appinstalled',done)
    return()=>{window.removeEventListener('beforeinstallprompt',before);window.removeEventListener('appinstalled',done)}
  },[])
  async function install(){
    if(installed)return
    if(promptEvent){await promptEvent.prompt();const choice=await promptEvent.userChoice;if(choice.outcome==='accepted')setInstalled(true);setPromptEvent(null);return}
    setHelp(true)
  }
  return <>
    <div className="fixed bottom-5 left-5 z-40 flex max-w-[calc(100vw-2.5rem)] gap-2 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-xl backdrop-blur">
      <button type="button" onClick={()=>window.dispatchEvent(new Event(SPONSORED_TOUR_EVENT))} className="rounded-xl px-3 py-2 text-xs font-black text-slate-700">Ver recorrido</button>
      <button type="button" disabled={installed} onClick={()=>void install()} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white disabled:bg-emerald-600">{installed?'Aplicación instalada':'Descargar aplicación'}</button>
    </div>
    {help&&<div className="fixed inset-0 z-[95] grid place-items-center bg-slate-950/55 p-4" onClick={()=>setHelp(false)}><div className="w-full max-w-[430px] rounded-[26px] bg-white p-5" onClick={e=>e.stopPropagation()}><h2 className="text-xl font-black text-slate-950">Instalar KawLink</h2><p className="mt-2 text-sm leading-6 text-slate-600">{isIos()?'En iPhone o iPad, toca Compartir en Safari y luego “Agregar a pantalla de inicio”.':'Abre el menú de tu navegador y selecciona “Instalar aplicación” o “Agregar a pantalla principal”.'}</p><p className="mt-2 text-xs leading-5 text-slate-400">Quedará como acceso directo a tu panel KawLink, sin necesidad de buscarlo cada vez en el navegador.</p><button type="button" onClick={()=>setHelp(false)} className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white">Entendido</button></div></div>}
  </>
}
