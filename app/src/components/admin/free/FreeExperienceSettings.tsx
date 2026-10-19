import { useEffect, useState } from 'react'
import { apiGet, apiPatch } from '../../../lib/api'

type Experience={
  quote_button_visible:boolean
  appointment_enabled:boolean
  schedule_visible:boolean
  portfolio_title:string
  schedule:Array<{day:string;hours:string}>
}

const DAY_OPTIONS=['Lunes a Viernes','Lunes','Martes','Miércoles','Jueves','Viernes','Sábados','Domingos','Todos los días']

function to24(value:string){
  const raw=String(value||'').trim()
  const direct=raw.match(/^(\d{1,2}):(\d{2})$/)
  if(direct)return `${String(Math.min(23,Number(direct[1]))).padStart(2,'0')}:${direct[2]}`
  const match=raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i)
  if(!match)return''
  let hour=Number(match[1])%12
  if(match[3].toUpperCase()==='PM')hour+=12
  return `${String(hour).padStart(2,'0')}:${match[2]||'00'}`
}
function to12(value:string){
  const match=String(value||'').match(/^(\d{1,2}):(\d{2})$/)
  if(!match)return value
  const hour=Number(match[1]),minute=match[2],period=hour>=12?'PM':'AM',display=hour%12||12
  return `${display}:${minute} ${period}`
}
function splitHours(value:string){
  const parts=String(value||'').split(/\s+-\s+/)
  return{start:to24(parts[0]||'')||'08:00',end:to24(parts[1]||'')||'18:00'}
}
function joinHours(start:string,end:string){return `${to12(start)} - ${to12(end)}`}

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
        <div className="flex items-center justify-between gap-4"><div className="min-w-0"><p className="text-[17px] font-medium text-slate-800">Nuestro horario</p><p className="mt-1 text-[13px] leading-5 text-slate-500">{data.schedule_visible?'Visible públicamente en tu presentación.':'Oculto en tu presentación; puedes seguir editándolo aquí.'}</p></div><div className="flex shrink-0 items-center gap-2"><span className={'text-[12px] font-bold '+(data.schedule_visible?'text-cyan-700':'text-slate-400')}>{data.schedule_visible?'Ocultar':'Mostrar'}</span><button type="button" disabled={saving} onClick={()=>void patch({schedule_visible:!data.schedule_visible})} className={'relative h-7 w-12 shrink-0 rounded-full transition '+(data.schedule_visible?'bg-cyan-600':'bg-slate-300')} aria-pressed={data.schedule_visible} aria-label={data.schedule_visible?'Ocultar horario público':'Mostrar horario público'}><span className={'absolute top-1 h-5 w-5 rounded-full bg-white shadow transition '+(data.schedule_visible?'left-6':'left-1')}/></button></div></div>
        <div className="mt-4 space-y-3">{data.schedule.map((item,index)=>{const range=splitHours(item.hours);const options=DAY_OPTIONS.includes(item.day)?DAY_OPTIONS:[item.day,...DAY_OPTIONS];return <div key={index} className="rounded-2xl border border-slate-200 bg-white p-3">
          <div className="flex items-center gap-2">
            <select value={item.day} onChange={e=>{const schedule=[...data.schedule];schedule[index]={...schedule[index],day:e.target.value};setData({...data,schedule})}} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-cyan-300">{options.filter(Boolean).map(day=><option key={day} value={day}>{day}</option>)}</select>
            <button type="button" onClick={()=>setData({...data,schedule:data.schedule.filter((_,i)=>i!==index)})} className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-black text-slate-500">Quitar</button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="text-[11px] font-black uppercase tracking-wide text-slate-400">Desde<input type="time" value={range.start} onChange={e=>{const schedule=[...data.schedule];schedule[index]={...schedule[index],hours:joinHours(e.target.value,range.end)};setData({...data,schedule})}} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-cyan-300"/></label>
            <label className="text-[11px] font-black uppercase tracking-wide text-slate-400">Hasta<input type="time" value={range.end} onChange={e=>{const schedule=[...data.schedule];schedule[index]={...schedule[index],hours:joinHours(range.start,e.target.value)};setData({...data,schedule})}} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-cyan-300"/></label>
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-500">{item.day}: {joinHours(range.start,range.end)}</p>
        </div>})}</div>
        <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={data.schedule.length>=7} onClick={()=>setData({...data,schedule:[...data.schedule,{day:'Lunes a Viernes',hours:'8:00 AM - 6:00 PM'}].slice(0,7)})} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 disabled:opacity-40">Agregar horario</button><button type="button" disabled={saving} onClick={()=>void patch({schedule:data.schedule})} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white disabled:opacity-40">Guardar horario</button></div>
      </div>
      <div className="border-b border-slate-200 px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0"><p className="text-[17px] font-medium text-slate-800">Cotizar / información</p><p className="mt-1 text-[13px] leading-5 text-slate-500">Viene activo por defecto y aparece debajo de tu horario.</p></div>
          <div className="flex shrink-0 items-center gap-2"><span className={'text-[12px] font-bold '+(data.quote_button_visible?'text-cyan-700':'text-slate-400')}>{data.quote_button_visible?'Ocultar':'Mostrar'}</span><button type="button" disabled={saving} onClick={()=>void patch({quote_button_visible:!data.quote_button_visible})} className={'relative h-7 w-12 shrink-0 rounded-full transition '+(data.quote_button_visible?'bg-cyan-600':'bg-slate-300')} aria-pressed={data.quote_button_visible} aria-label={data.quote_button_visible?'Ocultar cotización':'Mostrar cotización'}><span className={'absolute top-1 h-5 w-5 rounded-full bg-white shadow transition '+(data.quote_button_visible?'left-6':'left-1')}/></button></div>
        </div>
      </div>
      <div className="border-b border-slate-200 px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0"><p className="text-[17px] font-medium text-slate-800">Agenda</p><p className="mt-1 text-[13px] leading-5 text-slate-500">{data.appointment_enabled?'Activa · tus clientes pueden solicitar horarios.':'Inactiva · actívala cuando quieras recibir solicitudes.'}</p></div>
          <div className="flex shrink-0 items-center gap-2"><span className={'text-[12px] font-bold '+(data.appointment_enabled?'text-emerald-700':'text-slate-400')}>{data.appointment_enabled?'Ocultar':'Mostrar'}</span><button type="button" disabled={saving} onClick={()=>void patch({appointment_enabled:!data.appointment_enabled})} className={'relative h-7 w-12 shrink-0 rounded-full transition '+(data.appointment_enabled?'bg-emerald-600':'bg-slate-300')} aria-pressed={data.appointment_enabled} aria-label={data.appointment_enabled?'Ocultar agenda':'Mostrar agenda'}><span className={'absolute top-1 h-5 w-5 rounded-full bg-white shadow transition '+(data.appointment_enabled?'left-6':'left-1')}/></button></div>
        </div>
        <button type="button" onClick={()=>window.location.assign('/admin/free/agenda')} className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-black text-slate-700 transition hover:-translate-y-0.5 hover:shadow-sm">Configurar disponibilidad de Agenda ›</button>
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
