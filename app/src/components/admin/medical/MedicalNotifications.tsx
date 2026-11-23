import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { apiGet } from '../../../lib/api'
import { kawMedContextUrl, kawMedLegacyReturn, kawMedReturnTarget, type KawMedShellReturn } from './KawMedShellReturn'
import useKawMedShellReturn from './useKawMedShellReturn'

type Request = {id:string;customer_name?:string;appointment_date?:string;start_time?:string;reason_label?:string;status?:string}
export default function MedicalNotifications(){
  const location=useLocation(),navigate=useNavigate(),{context,checking,rejected,retry}=useKawMedShellReturn()
  const[items,setItems]=useState<Request[]>([])
  const[loading,setLoading]=useState(true)
  const[error,setError]=useState('')
  const[attempt,setAttempt]=useState(0)
  const rawFilter=new URLSearchParams(location.search).get('med_filter')||'pending'
  const filter:NonNullable<KawMedShellReturn['filter']>=rawFilter==='confirmed'||rawFilter==='history'?rawFilter:'pending'
  useEffect(()=>{
    if(checking)return
    if(rejected){setItems([]);setLoading(false);setError('No se pudo verificar la cuenta médica de origen. Comprueba tu acceso y la cuenta activa.');return}
    let active=true
    setLoading(true);setError('');setItems([])
    apiGet('/me/medical-profile/appointments').then((response:any)=>{
      if(!active)return
      if(!response?.ok)throw new Error(response?.error||'No se pudieron consultar las solicitudes de citas médicas.')
      if(context&&String(response.data?.profile?.id||'')!==context.account)throw new Error('Las solicitudes no corresponden a la cuenta médica de origen.')
      setItems(Array.isArray(response.data?.requests)?response.data.requests:[])
    }).catch(err=>{if(active)setError(err instanceof Error?err.message:'No se pudieron consultar las solicitudes de citas médicas.')}).finally(()=>{if(active)setLoading(false)})
    return()=>{active=false}
  },[context?.account,checking,rejected,attempt])
  const visible=items.filter(item=>filter==='history'?!['pending','confirmed'].includes(item.status||''):item.status===filter)
  const target=(request?:string)=>context?kawMedContextUrl('/admin/medical/agenda',{...context,viaRequests:true,filter},{section:filter==='confirmed'?'confirmed':'requests',request}):'/admin/medical/agenda'+(request?'?request='+encodeURIComponent(request):'')
  const back=context?kawMedReturnTarget({...context,viaRequests:false}):kawMedLegacyReturn(location.pathname,location.search)
  const backLabel=context?(context.tab==='more'?'Volver a Más opciones':context.tab==='agenda'?'Volver a Agenda':context.tab==='home'?'Volver a Inicio':'Volver al perfil médico'):'Volver a mi perfil médico'
  return <main className="min-h-screen bg-slate-50 px-4 py-8 font-['Inter'] text-slate-900"><section className="mx-auto max-w-2xl">
    <Link to={back} className="inline-flex min-h-11 min-w-11 items-center rounded-xl px-2 text-sm font-bold text-cyan-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-700">← {backLabel}</Link>
    <h1 className="mt-5 break-words text-3xl font-black">Solicitudes de citas médicas</h1>
    <p className="mt-2 text-sm text-slate-600">Las solicitudes pendientes todavía no son citas confirmadas. Solo aparecen datos del perfil médico autorizado.</p>
    <Link to={target()} className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-cyan-700 px-4 py-3 text-sm font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700">Abrir Agenda médica</Link>
    <div role="group" aria-label="Filtrar solicitudes de citas médicas" className="mt-4 flex flex-wrap gap-2">{(['pending','confirmed','history'] as const).map(value=><button key={value} type="button" aria-pressed={filter===value} onClick={()=>navigate(context?kawMedContextUrl('/admin/medical/notifications',{...context,filter:value}):'/admin/medical/notifications?med_filter='+value,{replace:true})} className={'min-h-11 min-w-11 rounded-xl border px-4 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-700 '+(filter===value?'border-cyan-700 bg-cyan-50 text-cyan-900':'border-slate-200 bg-white')}>{value==='pending'?'Pendientes':value==='confirmed'?'Citas confirmadas':'Historial'}</button>)}</div>
    {(loading||checking)&&<p role="status" className="mt-6 text-sm text-slate-500">Cargando solicitudes de citas médicas…</p>}
    {error&&<div role="alert" className="mt-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-800"><p>{error}</p><button type="button" onClick={()=>rejected?retry():setAttempt(value=>value+1)} className="mt-2 min-h-11 min-w-11 rounded-xl border px-4 font-bold">Reintentar</button></div>}
    {!loading&&!checking&&!error&&<div className="mt-6 space-y-3">{visible.length?visible.map(item=><article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><strong className="break-words">{item.customer_name||'Paciente'}</strong><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{item.status==='pending'?'Pendiente':item.status==='confirmed'?'Cita confirmada':item.status==='rejected'?'Rechazada':'Historial'}</span></div>
      <p className="mt-2 break-words text-sm text-slate-600">{item.reason_label||'Solicitud de cita'} · {item.appointment_date||''} {item.start_time||''}</p>
      <Link to={target(item.id)} className="mt-2 inline-flex min-h-11 min-w-11 items-center rounded-xl px-2 text-sm font-bold text-cyan-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-700">Gestionar en Agenda →</Link>
    </article>):<p role="status" className="rounded-xl bg-white p-5 text-sm text-slate-500">{filter==='pending'?'No tienes solicitudes de citas médicas pendientes.':filter==='confirmed'?'No tienes citas confirmadas.':'No hay solicitudes de citas médicas en el historial.'}</p>}</div>}
  </section></main>
}
