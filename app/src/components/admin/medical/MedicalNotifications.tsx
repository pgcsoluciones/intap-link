import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet } from '../../../lib/api'

type Request = {id:string;customer_name?:string;appointment_date?:string;start_time?:string;reason_label?:string;status?:string}
export default function MedicalNotifications(){
  const[items,setItems]=useState<Request[]>([])
  const[loading,setLoading]=useState(true)
  const[error,setError]=useState('')
  useEffect(()=>{
    let active=true
    apiGet('/me/medical-profile/appointments').then((response:any)=>{
      if(!active)return
      if(!response?.ok)throw new Error(response?.error||'No se pudieron consultar las solicitudes médicas.')
      setItems(Array.isArray(response.data?.requests)?response.data.requests:[])
    }).catch(err=>{if(active)setError(err instanceof Error?err.message:'No se pudieron consultar las solicitudes.')}).finally(()=>{if(active)setLoading(false)})
    return()=>{active=false}
  },[])
  return <main className="min-h-screen bg-slate-50 px-4 py-8 font-['Inter'] text-slate-900"><section className="mx-auto max-w-2xl">
    <Link to="/admin/medical" className="text-sm font-bold text-cyan-800">← Volver a mi perfil médico</Link>
    <h1 className="mt-5 text-3xl font-black">Solicitudes médicas</h1>
    <p className="mt-2 text-sm text-slate-600">Solo aparecen las solicitudes vinculadas a tu perfil médico, sin mezclar notificaciones de otras presentaciones.</p>
    <Link to="/admin/medical/agenda" className="mt-4 inline-block rounded-xl bg-cyan-700 px-4 py-3 text-sm font-bold text-white">Abrir agenda médica</Link>
    {loading&&<p className="mt-6 text-sm text-slate-500">Cargando solicitudes…</p>}
    {error&&<p role="alert" className="mt-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
    {!loading&&!error&&<div className="mt-6 space-y-3">{items.length?items.map(item=><article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><strong>{item.customer_name||'Paciente'}</strong><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{item.status||'Pendiente'}</span></div>
      <p className="mt-2 text-sm text-slate-600">{item.reason_label||'Solicitud de cita'} · {item.appointment_date||''} {item.start_time||''}</p>
      <Link to="/admin/medical/agenda" className="mt-2 inline-block text-xs font-bold text-cyan-800">Gestionar en Agenda →</Link>
    </article>):<p className="rounded-xl bg-white p-5 text-sm text-slate-500">Todavía no hay solicitudes médicas registradas.</p>}</div>}
  </section></main>
}
