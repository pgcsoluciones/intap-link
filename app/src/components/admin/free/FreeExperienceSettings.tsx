import { useEffect, useState } from 'react'
import { apiGet, apiPatch } from '../../../lib/api'

type Experience={
  quote_button_visible:boolean
  appointment_enabled:boolean
  portfolio_title:string
  schedule?:Array<{day:string;hours:string}>
}

export default function FreeExperienceSettings(){
  const[data,setData]=useState<Experience|null>(null)
  const[loading,setLoading]=useState(true)
  const[saving,setSaving]=useState(false)
  const[message,setMessage]=useState('')
  const[error,setError]=useState('')

  async function load(){
    setLoading(true)
    try{
      const json:any=await apiGet('/me/free/experience')
      if(json?.ok)setData(json.data)
      else setError(json?.error||'No pudimos cargar estas opciones.')
    }catch{setError('No pudimos cargar estas opciones.')}
    finally{setLoading(false)}
  }
  useEffect(()=>{void load()},[])

  async function patch(next:Partial<Experience>){
    if(!data||saving)return
    setSaving(true);setMessage('');setError('')
    try{
      const json:any=await apiPatch('/me/free/experience',next)
      if(!json?.ok){setError(json?.error||'No pudimos guardar el cambio.');return}
      setData(current=>current?{...current,...json.data}:current)
      setMessage('Cambios guardados.')
      window.setTimeout(()=>setMessage(''),2200)
    }catch{setError('No pudimos guardar el cambio.')}
    finally{setSaving(false)}
  }

  if(loading)return <section className="mt-6 rounded-[22px] bg-slate-50 p-4 text-sm font-semibold text-slate-500">Cargando horario, cotización y agenda…</section>
  if(!data)return <section className="mt-6 rounded-[22px] bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error||'No pudimos cargar estas opciones.'}</section>

  return <section className="mt-6">
    <p className="mb-3 px-1 text-[13px] font-semibold uppercase tracking-[0.08em] text-slate-400">PRESENTACIÓN Y CONTACTO</p>
    <div className="overflow-hidden rounded-[22px] bg-[#f5f5f5]">
      <div className="border-b border-slate-200 px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0"><p className="text-[17px] font-medium text-slate-800">Cotizar / información</p><p className="mt-1 text-[13px] leading-5 text-slate-500">Viene activo por defecto y aparece debajo de tu horario.</p></div>
          <button type="button" disabled={saving} onClick={()=>void patch({quote_button_visible:!data.quote_button_visible})} className={'relative h-7 w-12 shrink-0 rounded-full transition '+(data.quote_button_visible?'bg-cyan-600':'bg-slate-300')} aria-pressed={data.quote_button_visible}><span className={'absolute top-1 h-5 w-5 rounded-full bg-white shadow transition '+(data.quote_button_visible?'left-6':'left-1')}/></button>
        </div>
      </div>
      <div className="border-b border-slate-200 px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0"><p className="text-[17px] font-medium text-slate-800">Agenda</p><p className="mt-1 text-[13px] leading-5 text-slate-500">{data.appointment_enabled?'Activa · tus clientes pueden solicitar horarios.':'Inactiva · actívala cuando quieras recibir solicitudes.'}</p></div>
          <button type="button" disabled={saving} onClick={()=>void patch({appointment_enabled:!data.appointment_enabled})} className={'relative h-7 w-12 shrink-0 rounded-full transition '+(data.appointment_enabled?'bg-emerald-600':'bg-slate-300')} aria-pressed={data.appointment_enabled}><span className={'absolute top-1 h-5 w-5 rounded-full bg-white shadow transition '+(data.appointment_enabled?'left-6':'left-1')}/></button>
        </div>
        <button type="button" onClick={()=>window.location.assign('/admin/free/agenda')} className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-black text-slate-700 transition hover:-translate-y-0.5 hover:shadow-sm">Configurar horario y agenda ›</button>
      </div>
      <div className="px-4 py-4">
        <label className="block text-[13px] font-black text-slate-600">Nombre de Catálogo / Portafolio
          <div className="mt-2 flex gap-2">
            <input value={data.portfolio_title} maxLength={40} onChange={e=>setData({...data,portfolio_title:e.target.value})} className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-cyan-300" placeholder="Portafolio"/>
            <button type="button" disabled={saving||!data.portfolio_title.trim()} onClick={()=>void patch({portfolio_title:data.portfolio_title})} className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-40">Guardar</button>
          </div>
        </label>
      </div>
    </div>
    {error&&<p className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}
    {message&&<p className="mt-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</p>}
  </section>
}
