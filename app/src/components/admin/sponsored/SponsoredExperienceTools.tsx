import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../../../lib/api'
import FreeCredentials from '../free/FreeCredentials'
import { SPONSORED_TOUR_EVENT } from './SponsoredGuidedTour'

type InstallPromptEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>}
type AccountTab='credentials'|'device'

function isStandalone(){return window.matchMedia?.('(display-mode: standalone)').matches||Boolean((navigator as any).standalone)}
function isIos(){return /iphone|ipad|ipod/i.test(navigator.userAgent)}

export default function SponsoredExperienceTools(){
  const[promptEvent,setPromptEvent]=useState<InstallPromptEvent|null>(null);const[installed,setInstalled]=useState(false);const[help,setHelp]=useState(false)
  const[accountOpen,setAccountOpen]=useState(false);const[accountTab,setAccountTab]=useState<AccountTab>('credentials');const[accountEmail,setAccountEmail]=useState('');const[phrase,setPhrase]=useState('');const[emailConfirm,setEmailConfirm]=useState('');const[ack,setAck]=useState(false);const[unlinking,setUnlinking]=useState(false);const[unlinkError,setUnlinkError]=useState('')
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
  async function openAccount(){
    setAccountOpen(true);setAccountTab('credentials');setUnlinkError('')
    const json:any=await apiGet('/me/sponsored-profile/account').catch(()=>({ok:false}))
    if(json?.ok)setAccountEmail(String(json.data?.email||''))
  }
  async function unlink(){
    if(unlinking||!ack||phrase.trim().toUpperCase()!=='DESVINCULAR'||!emailConfirm.trim())return
    setUnlinking(true);setUnlinkError('')
    try{
      const json:any=await apiPost('/me/sponsored-profile/unlink',{confirm_phrase:phrase,confirm_email:emailConfirm.trim()})
      if(!json?.ok){setUnlinkError(json?.error||'No pudimos desvincular el dispositivo.');return}
      try{await apiPost('/auth/logout',{})}catch{}
      sessionStorage.removeItem('kawvo_sponsored_public_code');localStorage.removeItem('kawvo_sponsored_public_code')
      window.location.replace('/admin/login')
    }catch{setUnlinkError('No pudimos completar la desvinculación. Intenta nuevamente.')}finally{setUnlinking(false)}
  }
  const readyToUnlink=ack&&phrase.trim().toUpperCase()==='DESVINCULAR'&&Boolean(emailConfirm.trim())
  return <>
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[820px] items-center justify-between gap-3">
        <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.18em] text-cyan-600">KAWVO LINK</p><p className="truncate text-sm font-black text-slate-900">Mi panel patrocinado</p></div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <button type="button" onClick={()=>window.dispatchEvent(new Event(SPONSORED_TOUR_EVENT))} className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-700 shadow-sm">Recorrido</button>
          <button type="button" onClick={()=>void openAccount()} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm">Mi cuenta</button>
          <button type="button" disabled={installed} onClick={()=>void install()} className="rounded-full bg-slate-950 px-3 py-2 text-xs font-black text-white disabled:bg-emerald-600">{installed?'Instalada':'Descargar app'}</button>
        </div>
      </div>
    </header>
    {accountOpen&&<div className="fixed inset-0 z-[115] overflow-y-auto bg-white" role="dialog" aria-modal="true" aria-label="Mi cuenta patrocinada">
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur"><div className="mx-auto flex max-w-[430px] gap-2"><button type="button" onClick={()=>setAccountTab('credentials')} className={`flex-1 rounded-xl px-3 py-2.5 text-xs font-black ${accountTab==='credentials'?'bg-slate-950 text-white':'bg-slate-100 text-slate-600'}`}>Credenciales</button><button type="button" onClick={()=>setAccountTab('device')} className={`flex-1 rounded-xl px-3 py-2.5 text-xs font-black ${accountTab==='device'?'bg-slate-950 text-white':'bg-slate-100 text-slate-600'}`}>Dispositivo</button></div></div>
      {accountTab==='credentials'?<FreeCredentials embedded onBack={()=>setAccountOpen(false)}/>:<main className="min-h-screen bg-white px-5 pb-16 pt-6 font-['Inter'] text-slate-900"><section className="mx-auto w-full max-w-[430px]"><div className="flex items-center gap-3 pb-5"><button type="button" onClick={()=>setAccountOpen(false)} className="text-[34px] font-light text-slate-500">←</button><div><h1 className="text-[30px] font-black tracking-[-.04em]">Dispositivo</h1><p className="text-sm text-slate-500">Administra el vínculo de este perfil patrocinado.</p></div></div><div className="rounded-[24px] border border-rose-200 bg-rose-50/60 p-5"><p className="text-[11px] font-black uppercase tracking-[.14em] text-rose-600">Zona de seguridad</p><h2 className="mt-2 text-xl font-black">Desvincular dispositivo</h2><p className="mt-2 text-sm leading-6 text-slate-600">Esto elimina este perfil patrocinado y libera el dispositivo para que pueda activarse de nuevo. Tu cuenta Kawvo y sus credenciales no se eliminan.</p><p className="mt-3 rounded-2xl bg-white px-4 py-3 text-xs leading-5 text-slate-600">Correo actual: <strong>{accountEmail||'Cargando…'}</strong></p><label className="mt-4 block text-xs font-black text-slate-700">Confirma tu correo<input type="email" value={emailConfirm} onChange={e=>setEmailConfirm(e.target.value)} placeholder={accountEmail||'tu-correo@ejemplo.com'} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-rose-300"/></label><label className="mt-4 block text-xs font-black text-slate-700">Escribe <span className="font-mono text-rose-700">DESVINCULAR</span><input value={phrase} onChange={e=>setPhrase(e.target.value)} autoComplete="off" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-rose-300"/></label><label className="mt-4 flex items-start gap-3 rounded-2xl bg-white p-3 text-xs leading-5 text-slate-600"><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0"/><span>Entiendo que se eliminará el perfil patrocinado actual y que el dispositivo quedará disponible para una nueva activación.</span></label>{unlinkError&&<p className="mt-4 rounded-xl bg-rose-100 px-3 py-3 text-sm font-semibold text-rose-700">{unlinkError}</p>}<button type="button" onClick={()=>void unlink()} disabled={!readyToUnlink||unlinking} className="mt-5 w-full rounded-2xl bg-rose-600 px-4 py-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-35">{unlinking?'Desvinculando…':'Desvincular dispositivo'}</button></div></section></main>}
    </div>}
    {help&&<div className="fixed inset-0 z-[95] grid place-items-center bg-slate-950/55 p-4" onClick={()=>setHelp(false)}><div className="w-full max-w-[430px] rounded-[26px] bg-white p-5" onClick={e=>e.stopPropagation()}><h2 className="text-xl font-black text-slate-950">Instalar KawLink</h2><p className="mt-2 text-sm leading-6 text-slate-600">{isIos()?'En iPhone o iPad, toca Compartir en Safari y luego “Agregar a pantalla de inicio”.':'Abre el menú de tu navegador y selecciona “Instalar aplicación” o “Agregar a pantalla principal”.'}</p><p className="mt-2 text-xs leading-5 text-slate-400">Quedará como acceso directo a tu panel KawLink, sin necesidad de buscarlo cada vez en el navegador.</p><button type="button" onClick={()=>setHelp(false)} className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white">Entendido</button></div></div>}
  </>
}
