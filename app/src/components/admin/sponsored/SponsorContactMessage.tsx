import {useEffect,useState} from 'react'
import {apiGet,apiPatch} from '../../../lib/api'
import {DEFAULT_SPONSOR_MESSAGE,SPONSOR_MESSAGE_LIMIT,SPONSOR_MESSAGE_VARIABLES,validSponsorMessage,renderSponsorMessage} from '../../../../../shared/sponsor-commercial-message'

export default function SponsorContactMessage({tenantId,tenantName,visitor,onPendingChange}:{tenantId:string;tenantName:string;visitor:boolean;onPendingChange:(dirty:boolean,busy:boolean)=>void}){
 const [value,setValue]=useState(DEFAULT_SPONSOR_MESSAGE),[baseline,setBaseline]=useState(''),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[retry,setRetry]=useState(0)
 const dirty=ready&&value!==baseline
 useEffect(()=>{let live=true;setReady(false);setError('');setMessage('')
  apiGet('/sponsor/commercial/contact-message').then((r:any)=>{
   if(!r?.ok||r.data?.sponsor_id!==tenantId||!validSponsorMessage(r.data?.message_template))throw Error('No se pudo verificar la plantilla de esta empresa.')
   if(live){setValue(r.data.message_template);setBaseline(r.data.message_template);setReady(true)}
  }).catch(e=>{if(live)setError(e instanceof Error?e.message:'No se pudo leer la plantilla.')})
  return()=>{live=false}
 },[tenantId,retry])
 useEffect(()=>{onPendingChange(dirty,busy)},[dirty,busy,onPendingChange])
 useEffect(()=>()=>onPendingChange(false,false),[onPendingChange])
 async function save(){
  if(!ready||busy||!dirty||!validSponsorMessage(value))return
  const submitted=value.trim();setBusy(true);setError('');setMessage('')
  try{
   const r:any=await apiPatch('/sponsor/commercial/contact-message',{sponsor_id:tenantId,message_template:submitted})
   if(!r?.ok||r.data?.sponsor_id!==tenantId||r.data?.message_template!==submitted)throw Error(r?.error||'No se pudo confirmar el guardado.')
   setBaseline(submitted);setValue(submitted);setMessage('Mensaje de WhatsApp guardado.')
  }catch(e){setError(e instanceof Error?e.message:'No se pudo guardar el mensaje.')}
  finally{setBusy(false)}
 }
 const example=renderSponsorMessage(value,{representative:'Carlos Pérez',beneficiary:'Mi Negocio',sponsor:tenantName})
 return <div className="mt-5 min-w-0 space-y-3 border-t border-slate-200 pt-5">
  <h3 className="text-base font-black">Mensaje de WhatsApp al {visitor?'visitador':'vendedor'}</h3>
  <p className="text-sm leading-6 text-slate-600">Se precarga al contactar al representante asignado desde la barra privada o el panel del patrocinado. No modifica el cintillo público.</p>
  {error&&<p role="alert" className="break-words text-sm text-rose-700">{error}</p>}
  {!ready?<div>{error?<button type="button" onClick={()=>setRetry(n=>n+1)} className="min-h-11 rounded-xl border px-4 text-sm font-bold">Reintentar</button>:<p role="status" className="text-sm text-slate-500">Cargando mensaje…</p>}</div>:<>
   <label className="block text-sm font-bold">Mensaje WhatsApp<textarea rows={5} maxLength={SPONSOR_MESSAGE_LIMIT} disabled={busy} value={value} onChange={e=>{setValue(e.target.value);setMessage('')}} className="mt-2 block w-full min-w-0 resize-y rounded-xl border border-slate-300 bg-slate-50 p-3 text-base font-normal leading-6 text-slate-900" /></label>
   <p className="break-words text-xs leading-5 text-slate-600">Variables: {SPONSOR_MESSAGE_VARIABLES.map(v=>'{'+v+'}').join(' · ')}. {value.length}/{SPONSOR_MESSAGE_LIMIT}</p>
   {!validSponsorMessage(value)&&<p role="alert" className="text-sm text-rose-700">Completa el mensaje y usa solo las variables indicadas.</p>}
   <div className="min-w-0 rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-600">Vista previa (datos de ejemplo)</p><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{example}</p></div>
   <div className="flex flex-col gap-2 sm:flex-row"><button type="button" onClick={()=>void save()} disabled={busy||!dirty||!validSponsorMessage(value)} className="min-h-11 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-40 sm:w-auto">{busy?'Guardando…':'Guardar mensaje'}</button><button type="button" disabled={busy} onClick={()=>{setValue(DEFAULT_SPONSOR_MESSAGE);setMessage('')}} className="min-h-11 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold sm:w-auto">Restablecer mensaje</button></div>
   {message&&<p role="status" className="text-sm font-bold text-emerald-700">{message}</p>}
  </>}
 </div>
}
