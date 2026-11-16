import { useEffect, useState } from 'react'
import { apiGet } from '../../../lib/api'
import { newestPendingAgenda, type AgendaSummaryItem } from './freeAgendaSummaryData'

type State={status:'loading'|'error'|'ready';items:AgendaSummaryItem[]}

/** Navigation-only summary, mounted only on the eligible Agenda tab. */
export default function FreeAgendaSummary({profileId,onViewAll}:{profileId:string;onViewAll:()=>void}){
  const [state,setState]=useState<State>({status:'loading',items:[]})
  const [attempt,setAttempt]=useState(0)
  useEffect(()=>{
    let active=true
    setState({status:'loading',items:[]})
    if(!profileId){setState({status:'error',items:[]});return}
    apiGet('/me/free/appointments')
      .then(result=>{if(active)setState({status:'ready',items:newestPendingAgenda(result,profileId)})})
      .catch(()=>{if(active)setState({status:'error',items:[]})})
    return()=>{active=false}
  },[profileId,attempt])
  return <section className="rounded-2xl border border-slate-200 bg-white p-4" aria-label="Resumen de Agenda">
    <h2 className="text-base font-black">Solicitudes pendientes</h2>
    <p className="mt-1 text-sm text-slate-600">Las últimas 5 solicitudes pendientes.</p>
    {state.status==='loading'&&<p role="status" className="my-4 text-sm text-slate-500">Cargando solicitudes…</p>}
    {state.status==='error'&&<div role="alert" className="my-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-700"><p>No pudimos verificar las solicitudes de esta cuenta.</p><button type="button" onClick={()=>setAttempt(a=>a+1)} className="mt-2 min-h-11 rounded-xl border border-slate-200 bg-white px-3 font-bold">Reintentar</button></div>}
    {state.status==='ready'&&(state.items.length?<ul className="mt-3 divide-y divide-slate-200">{state.items.map(item=><li key={item.id} className="flex min-w-0 items-start gap-3 py-3">
      <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-50 text-lg text-cyan-900">▦</span>
      <div className="min-w-0 flex-1"><p className="break-words text-sm font-bold text-slate-900">{item.customer_name}</p><p className="mt-1 break-words text-sm text-slate-600">{item.reason_label}</p>{item.appointment_date&&<p className="mt-1 text-xs text-slate-500">{item.appointment_date}{item.start_time?' · '+item.start_time.slice(0,5):''}</p>}</div>
      <span className="shrink-0 rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-900">Pendiente</span>
    </li>)}</ul>:<p role="status" className="my-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">No tienes solicitudes pendientes.</p>)}
    <button type="button" onClick={onViewAll} className="mt-3 min-h-12 w-full rounded-xl bg-slate-900 px-4 text-sm font-bold text-white">Ver todas</button>
  </section>
}
