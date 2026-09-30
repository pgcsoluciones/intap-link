import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { apiDelete, apiGet, apiPost, apiPut } from '../../lib/api'

type Props={apiBase:string;query?:string;onBack?:()=>void;title?:string}
type Availability={id?:string;weekday:number;start_time:string;end_time:string;enabled:boolean;sort_order?:number}
type Reason={id?:string;label:string;enabled:boolean;sort_order?:number}
type Block={id:string;block_date:string;start_time?:string|null;end_time?:string|null;note?:string|null}
type RequestItem={
  id:string;customer_name:string;customer_phone:string;customer_email?:string|null
  appointment_date:string;start_time:string;end_time:string;timezone:string
  reason_label:string;details?:string|null;status:string;created_at?:string|null
}

const DAY_NAMES=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']

function path(base:string,suffix:string,query:string){
  const q=query?query.replace(/^\?/,''):''
  return base+suffix+(q?'?'+q:'')
}
function waPhone(value:string){return String(value||'').replace(/\D/g,'')}
function humanDate(value:string){
  const parts=value.split('-').map(Number),y=parts[0],m=parts[1],d=parts[2]
  if(!y||!m||!d)return value
  try{return new Intl.DateTimeFormat('es-DO',{timeZone:'UTC',weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(Date.UTC(y,m-1,d,12)))}
  catch{return value}
}
function humanTime(value:string){
  const parts=value.split(':').map(Number),h=parts[0],m=parts[1]
  if(!Number.isFinite(h)||!Number.isFinite(m))return value
  try{return new Intl.DateTimeFormat('es-DO',{timeZone:'UTC',hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(Date.UTC(2000,0,1,h,m)))}
  catch{return value}
}
function whatsappUrl(item:RequestItem,message:string){
  return 'https://wa.me/'+waPhone(item.customer_phone)+'?text='+encodeURIComponent(message)
}
function whatsappConfirmation(item:RequestItem){
  return whatsappUrl(item,[
    'Hola '+item.customer_name+'.',
    'Tu solicitud de agenda ha sido confirmada.',
    '',
    'Fecha: '+humanDate(item.appointment_date),
    'Hora: '+humanTime(item.start_time),
    'Motivo: '+item.reason_label,
    '',
    'Te esperamos. Por favor, sé puntual.',
    'Si necesitas reprogramar, avísanos con tiempo para poder reorganizar la agenda.',
  ].join('\n'))
}
function whatsappRejection(item:RequestItem){
  return whatsappUrl(item,[
    'Hola '+item.customer_name+'.',
    'Gracias por tu solicitud de agenda.',
    '',
    'En esta ocasión no podremos confirmar la cita solicitada.',
    'Fecha solicitada: '+humanDate(item.appointment_date),
    'Hora solicitada: '+humanTime(item.start_time),
    'Motivo: '+item.reason_label,
    '',
    'Puedes seleccionar otro horario disponible o escribirnos para coordinar una alternativa.',
  ].join('\n'))
}
function whatsappOccupied(item:RequestItem){
  return whatsappUrl(item,[
    'Hola '+item.customer_name+'.',
    'El horario que solicitaste ya no está disponible.',
    '',
    'Fecha solicitada: '+humanDate(item.appointment_date),
    'Hora solicitada: '+humanTime(item.start_time),
    'Motivo: '+item.reason_label,
    '',
    'Por favor, selecciona otro horario disponible. Si deseas, podemos ayudarte a coordinar otra opción.',
  ].join('\n'))
}

export default function AppointmentManager({apiBase,query='',onBack,title='Agenda'}:Props){
  const[data,setData]=useState<any>(null)
  const[loading,setLoading]=useState(true)
  const[saving,setSaving]=useState(false)
  const[message,setMessage]=useState('')
  const[error,setError]=useState('')
  const[settings,setSettings]=useState<any>({enabled:false,slot_minutes:30,min_notice_minutes:120,horizon_days:30,timezone:'America/Santo_Domingo',reason_mode:'default'})
  const[availability,setAvailability]=useState<Availability[]>([])
  const[reasons,setReasons]=useState<Reason[]>([])
  const[block,setBlock]=useState({block_date:'',start_time:'',end_time:'',note:''})
  const[availabilityOpen,setAvailabilityOpen]=useState(false)
  const[openDays,setOpenDays]=useState<number[]>([])
  const[highlightRow,setHighlightRow]=useState<number|null>(null)
  const[occupiedId,setOccupiedId]=useState<string|null>(null)

  async function load(){
    setLoading(true);setError('')
    try{
      const json:any=await apiGet(path(apiBase,'',query))
      if(!json?.ok)throw new Error(json?.error||'No pudimos cargar la agenda.')
      setData(json.data)
      setSettings(json.data.settings)
      setAvailability((json.data.availability||[]).map((item:any)=>({...item,enabled:Number(item.enabled??1)===1||item.enabled===true})))
      setReasons((json.data.reasons||[]).map((item:any)=>({...item,enabled:item.enabled!==false&&Number(item.enabled??1)!==0})))
    }catch(e){setError(e instanceof Error?e.message:'No pudimos cargar la agenda.')}
    finally{setLoading(false)}
  }
  useEffect(()=>{void load()},[apiBase,query])

  const pending=useMemo(()=>((data?.requests||[]) as RequestItem[]).filter(item=>item.status==='pending'),[data])
  const confirmed=useMemo(()=>((data?.requests||[]) as RequestItem[]).filter(item=>item.status==='confirmed'),[data])
  const history=useMemo(()=>((data?.requests||[]) as RequestItem[]).filter(item=>!['pending','confirmed'].includes(item.status)),[data])
  const availabilityGroups=useMemo(()=>DAY_NAMES.map((name,weekday)=>({
    name,weekday,items:availability.map((row,index)=>({row,index})).filter(item=>item.row.weekday===weekday),
  })).filter(group=>group.items.length>0),[availability])

  function notice(text:string){
    setMessage(text)
    window.setTimeout(()=>setMessage(current=>current===text?'':current),2800)
  }
  function openDay(weekday:number){
    setAvailabilityOpen(true)
    setOpenDays(current=>current.includes(weekday)?current:[...current,weekday])
  }
  function markAvailability(index:number){
    setHighlightRow(index)
    window.setTimeout(()=>setHighlightRow(current=>current===index?null:current),1400)
  }
  function updateAvailability(index:number,key:keyof Availability,value:any){
    setAvailability(current=>current.map((row,i)=>i===index?{...row,[key]:value}:row))
  }
  function addAvailability(){
    const weekday=1,index=availability.length
    setAvailability(current=>[...current,{weekday,start_time:'09:00',end_time:'17:00',enabled:true,sort_order:current.length}])
    openDay(weekday);markAvailability(index);notice('Nueva franja agregada. Ajusta el día u horario y guarda los cambios.')
  }
  function duplicateAvailability(index:number){
    const source=availability[index]
    if(!source)return
    const duplicate:Availability={weekday:source.weekday,start_time:source.start_time,end_time:source.end_time,enabled:source.enabled,sort_order:index+1}
    setAvailability(current=>[...current.slice(0,index+1),duplicate,...current.slice(index+1)])
    openDay(source.weekday);markAvailability(index+1);notice('Franja duplicada. Modifica el horario y guarda los cambios.')
  }
  function removeAvailability(index:number){
    setAvailability(current=>current.filter((_,i)=>i!==index))
    notice('Franja quitada. Guarda la agenda para aplicar el cambio.')
  }
  function updateReason(index:number,key:keyof Reason,value:any){setReasons(current=>current.map((row,i)=>i===index?{...row,[key]:value}:row))}
  function addReason(){setReasons(current=>[...current,{label:'',enabled:true,sort_order:current.length}])}
  function removeReason(index:number){setReasons(current=>current.filter((_,i)=>i!==index))}

  async function save(){
    setSaving(true);setMessage('');setError('')
    try{
      const payload={...settings,availability,reasons}
      const json:any=await apiPut(path(apiBase,'/settings',query),payload)
      if(!json?.ok)throw new Error(json?.error||'No pudimos guardar la agenda.')
      notice('Agenda guardada.')
      await load()
    }catch(e){setError(e instanceof Error?e.message:'No pudimos guardar la agenda.')}
    finally{setSaving(false)}
  }

  async function createBlock(){
    setMessage('');setError('')
    if(Boolean(block.start_time)!==Boolean(block.end_time)){
      setError('Para bloquear una franja completa Desde y Hasta, o deja ambos vacíos para bloquear el día completo.')
      return
    }
    try{
      const json:any=await apiPost(path(apiBase,'/blocks',query),block)
      if(!json?.ok)throw new Error(json?.error||'No pudimos bloquear el horario.')
      setBlock({block_date:'',start_time:'',end_time:'',note:''})
      notice(block.start_time?'Horario bloqueado. Ya no se ofrecerá en la agenda pública.':'Día bloqueado. Ya no se ofrecerán horarios en esa fecha.')
      await load()
    }catch(e){setError(e instanceof Error?e.message:'No pudimos bloquear el horario.')}
  }
  async function removeBlock(id:string){
    setMessage('');setError('')
    try{
      const json:any=await apiDelete(path(apiBase,'/blocks/'+encodeURIComponent(id),query))
      if(!json?.ok)throw new Error(json?.error||'No pudimos quitar el bloqueo.')
      notice('Bloqueo quitado. El horario vuelve a estar disponible.')
      await load()
    }catch(e){setError(e instanceof Error?e.message:'No pudimos quitar el bloqueo.')}
  }
  async function act(item:RequestItem,action:'confirm'|'reject'|'release'){
    setMessage('');setError('')
    try{
      const json:any=await apiPost(apiBase+'/requests/'+encodeURIComponent(item.id)+'/'+action,{})
      if(!json?.ok){
        const detail=String(json?.error||'No pudimos actualizar la solicitud.')
        if(action==='confirm'&&/ocupad|bloquead/i.test(detail))setOccupiedId(item.id)
        throw new Error(detail)
      }
      setOccupiedId(current=>current===item.id?null:current)
      notice(action==='confirm'?'Cita confirmada. El horario dejó de estar disponible.':action==='release'?'Horario liberado nuevamente.':'Solicitud rechazada. Puedes enviar el aviso por WhatsApp desde Historial.')
      await load()
    }catch(e){
      const detail=e instanceof Error?e.message:'No pudimos actualizar la solicitud.'
      if(action==='confirm'&&/ocupad|bloquead/i.test(detail))setOccupiedId(item.id)
      setError(detail)
    }
  }

  if(loading)return <main className="min-h-screen bg-slate-50 px-5 py-10 font-['Inter']"><div className="mx-auto max-w-3xl text-sm font-bold text-slate-500">Cargando agenda…</div></main>

  return <main className="min-h-screen bg-slate-50 px-4 pb-16 pt-5 font-['Inter'] text-slate-950">
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">{onBack&&<button type="button" onClick={onBack} className="mb-2 text-sm font-black text-slate-500">← Volver</button>}<h1 className="text-3xl font-black tracking-[-.04em]">{title}</h1><p className="mt-1 text-sm text-slate-500">{data?.profile?.business_name||'Configura cuándo pueden solicitarte una cita.'}</p></div>
        <span className={'shrink-0 rounded-full px-3 py-2 text-xs font-black '+(settings.enabled?'bg-emerald-100 text-emerald-700':'bg-slate-200 text-slate-600')}>{settings.enabled?'Activa':'Inactiva'}</span>
      </header>

      {(message||error)&&<div className={'rounded-2xl px-4 py-3 text-sm font-bold '+(error?'bg-rose-100 text-rose-700':'bg-emerald-100 text-emerald-700')}>{error||message}</div>}

      <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4"><div><h2 className="text-xl font-black">Configuración</h2><p className="mt-1 text-sm text-slate-500">La cita se confirma manualmente. Una solicitud pendiente no bloquea el horario.</p></div><label className="flex items-center gap-2 text-sm font-black"><input type="checkbox" checked={Boolean(settings.enabled)} onChange={e=>setSettings({...settings,enabled:e.target.checked})} className="h-5 w-5"/>Agenda activa</label></div>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <label className="text-xs font-black text-slate-600">Duración<select value={settings.slot_minutes} onChange={e=>setSettings({...settings,slot_minutes:Number(e.target.value)})} className={field}><option value={15}>15 min</option><option value={30}>30 min</option><option value={45}>45 min</option><option value={60}>60 min</option></select></label>
          <label className="text-xs font-black text-slate-600">Anticipación<select value={settings.min_notice_minutes} onChange={e=>setSettings({...settings,min_notice_minutes:Number(e.target.value)})} className={field}><option value={0}>Sin mínimo</option><option value={60}>1 hora</option><option value={120}>2 horas</option><option value={240}>4 horas</option><option value={1440}>1 día</option></select></label>
          <label className="text-xs font-black text-slate-600">Reservar hasta<select value={settings.horizon_days} onChange={e=>setSettings({...settings,horizon_days:Number(e.target.value)})} className={field}><option value={7}>7 días</option><option value={14}>14 días</option><option value={30}>30 días</option><option value={60}>60 días</option><option value={90}>90 días</option></select></label>
        </div>
      </section>

      <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <button type="button" aria-expanded={availabilityOpen} onClick={()=>setAvailabilityOpen(open=>!open)} className="min-w-0 flex-1 rounded-2xl px-1 py-1 text-left transition-all duration-200 hover:bg-slate-50 active:scale-[.995]">
            <div className="flex items-center justify-between gap-3"><div className="min-w-0"><h2 className="text-xl font-black">Horarios disponibles</h2><p className="mt-1 text-sm text-slate-500">{availability.length} {availability.length===1?'franja':'franjas'} en {availabilityGroups.length} {availabilityGroups.length===1?'día':'días'} · toca para {availabilityOpen?'recoger':'ver'}</p></div><span className={'shrink-0 text-lg text-slate-400 transition-transform duration-200 '+(availabilityOpen?'rotate-180':'')}>⌄</span></div>
          </button>
          <button type="button" onClick={addAvailability} className={smallBtn}>+ Horario</button>
        </div>
        {availabilityOpen&&<div className="mt-4 space-y-2">
          {availabilityGroups.map(group=>{
            const dayOpen=openDays.includes(group.weekday)
            const summary=group.items.map(item=>humanTime(item.row.start_time)+'–'+humanTime(item.row.end_time)).join(' · ')
            return <div key={group.weekday} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              <button type="button" aria-expanded={dayOpen} onClick={()=>setOpenDays(current=>current.includes(group.weekday)?current.filter(day=>day!==group.weekday):[...current,group.weekday])} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-all duration-200 hover:bg-slate-100 active:scale-[.995]">
                <div className="min-w-0"><strong className="text-sm font-black text-slate-800">{group.name}</strong><p className="mt-0.5 truncate text-xs text-slate-500">{group.items.length} {group.items.length===1?'franja':'franjas'} · {summary}</p></div><span className={'shrink-0 text-base text-slate-400 transition-transform duration-200 '+(dayOpen?'rotate-180':'')}>⌄</span>
              </button>
              {dayOpen&&<div className="space-y-2 border-t border-slate-200 p-3">
                {group.items.map(({row,index})=><div key={row.id||index} className={'grid gap-2 rounded-2xl bg-white p-3 transition-all duration-300 sm:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end '+(highlightRow===index?'ring-2 ring-cyan-300 shadow-md':'')}>
                  <label className="text-[11px] font-black text-slate-500">Día<select className={field} value={row.weekday} onChange={e=>{const weekday=Number(e.target.value);updateAvailability(index,'weekday',weekday);openDay(weekday)}}>{DAY_NAMES.map((name,day)=><option key={day} value={day}>{name}</option>)}</select></label>
                  <label className="text-[11px] font-black text-slate-500">Desde<input className={field} type="time" value={row.start_time} onChange={e=>updateAvailability(index,'start_time',e.target.value)}/></label>
                  <label className="text-[11px] font-black text-slate-500">Hasta<input className={field} type="time" value={row.end_time} onChange={e=>updateAvailability(index,'end_time',e.target.value)}/></label>
                  <div className="mb-0.5 flex gap-2">
                    <button type="button" onClick={()=>duplicateAvailability(index)} className={'flex-1 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-3 text-xs font-black text-cyan-800 '+actionFx}>Duplicar</button>
                    <button type="button" onClick={()=>removeAvailability(index)} className={'flex-1 rounded-xl border border-rose-200 bg-white px-3 py-3 text-xs font-black text-rose-600 '+actionFx}>Quitar</button>
                  </div>
                </div>)}
              </div>}
            </div>
          })}
          {!availabilityGroups.length&&<p className="rounded-2xl bg-slate-50 px-3 py-4 text-sm text-slate-500">No hay horarios configurados.</p>}
        </div>}
      </section>

      <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-black">Motivos de agenda</h2><p className="mt-1 text-sm text-slate-500">Usa los motivos de KawLink o crea los tuyos.</p></div><select value={settings.reason_mode} onChange={e=>{const mode=e.target.value;setSettings({...settings,reason_mode:mode});if(mode==='custom')setReasons((data?.custom_reasons||[]).length?data.custom_reasons:(data?.default_reasons||[]).map((item:any)=>({label:item.label,enabled:true})));else setReasons(data?.default_reasons||[])}} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black"><option value="default">Predeterminados</option><option value="custom">Personalizados</option></select></div>
        {settings.reason_mode==='default'?<div className="mt-4 flex flex-wrap gap-2">{reasons.map((reason,index)=><span key={reason.id||index} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700">{reason.label}</span>)}</div>:<>
          <div className="mt-4 space-y-2">{reasons.map((reason,index)=><div key={reason.id||index} className="flex items-center gap-2"><input className={field} value={reason.label} onChange={e=>updateReason(index,'label',e.target.value)} placeholder="Motivo"/><label className="flex shrink-0 items-center gap-1 text-xs font-bold"><input type="checkbox" checked={reason.enabled} onChange={e=>updateReason(index,'enabled',e.target.checked)}/>Activo</label><button type="button" onClick={()=>removeReason(index)} className={'rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-black text-rose-600 '+actionFx}>Quitar</button></div>)}</div>
          <button type="button" onClick={addReason} className={'mt-3 '+smallBtn}>+ Motivo</button>
        </>}
      </section>

      <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-black">Bloquear días u horas</h2><p className="mt-1 text-sm text-slate-500">Deja Desde y Hasta vacíos para bloquear el día completo.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <input className={field} type="date" value={block.block_date} onChange={e=>setBlock({...block,block_date:e.target.value})}/>
          <input className={field} type="time" value={block.start_time} onChange={e=>setBlock({...block,start_time:e.target.value})}/>
          <input className={field} type="time" value={block.end_time} onChange={e=>setBlock({...block,end_time:e.target.value})}/>
          <button type="button" onClick={()=>void createBlock()} disabled={!block.block_date} className={'rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-35 '+actionFx}>Bloquear</button>
        </div>
        <input className={field} value={block.note} onChange={e=>setBlock({...block,note:e.target.value})} placeholder="Nota opcional: feriado, almuerzo, fuera de oficina…"/>
        <div className="mt-4 space-y-2">{((data?.blocks||[]) as Block[]).map(item=><div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl bg-amber-50 px-3 py-3"><div><strong className="text-sm">{item.block_date}</strong><p className="mt-0.5 text-xs text-slate-600">{item.start_time&&item.end_time?humanTime(item.start_time)+' – '+humanTime(item.end_time):'Día completo'}{item.note?' · '+item.note:''}</p></div><button type="button" onClick={()=>void removeBlock(item.id)} className={'rounded-xl bg-white px-3 py-2 text-xs font-black text-amber-800 '+actionFx}>Habilitar</button></div>)}</div>
      </section>

      <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-black">Solicitudes pendientes <span className="text-slate-400">({pending.length})</span></h2>
        <div className="mt-4 space-y-3">{pending.map(item=><RequestCard key={item.id} item={item}><button type="button" onClick={()=>void act(item,'confirm')} className={'rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white '+actionFx}>Confirmar</button><button type="button" onClick={()=>void act(item,'reject')} className={'rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 '+actionFx}>Rechazar</button>{occupiedId===item.id&&<a href={whatsappOccupied(item)} target="_blank" rel="noreferrer" className={'rounded-xl bg-amber-100 px-3 py-2 text-xs font-black text-amber-800 '+actionFx}>Avisar horario ocupado</a>}</RequestCard>)}{!pending.length&&<p className="text-sm text-slate-500">No hay solicitudes pendientes.</p>}</div>
      </section>

      <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-black">Citas confirmadas <span className="text-slate-400">({confirmed.length})</span></h2>
        <div className="mt-4 space-y-3">{confirmed.map(item=><RequestCard key={item.id} item={item}><a href={whatsappConfirmation(item)} target="_blank" rel="noreferrer" className={'rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 '+actionFx}>Responder por WhatsApp</a><button type="button" onClick={()=>void act(item,'release')} className={'rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-black text-amber-700 '+actionFx}>Liberar horario</button></RequestCard>)}{!confirmed.length&&<p className="text-sm text-slate-500">Aún no tienes citas confirmadas.</p>}</div>
      </section>

      {history.length>0&&<section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-xl font-black">Historial</h2><div className="mt-4 space-y-2">{history.slice(0,25).map(item=><RequestCard key={item.id} item={item}>{item.status==='rejected'&&<a href={whatsappRejection(item)} target="_blank" rel="noreferrer" className={'rounded-xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 '+actionFx}>Avisar rechazo por WhatsApp</a>}</RequestCard>)}</div></section>}

      <button type="button" onClick={()=>void save()} disabled={saving} className={'sticky bottom-4 w-full rounded-2xl bg-cyan-700 px-5 py-4 text-sm font-black text-white shadow-xl disabled:opacity-50 '+actionFx}>{saving?'Guardando…':'Guardar configuración de agenda'}</button>
    </div>
  </main>
}

function RequestCard({item,children}:{item:RequestItem;children?:ReactNode}){
  return <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><strong className="block truncate text-sm font-black">{item.customer_name}</strong><p className="mt-1 text-xs font-bold text-slate-500">{item.appointment_date} · {item.start_time} · {item.reason_label}</p><p className="mt-1 text-xs text-slate-500">{item.customer_phone}{item.customer_email?' · '+item.customer_email:''}</p>{item.details&&<p className="mt-2 text-sm leading-5 text-slate-700">{item.details}</p>}</div><span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-black uppercase text-slate-500">{item.status}</span></div>{children&&<div className="mt-3 flex flex-wrap gap-2">{children}</div>}</article>
}

const field='mt-1 w-full min-w-0 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold outline-none transition-colors focus:border-cyan-400'
const actionFx='transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[.98]'
const smallBtn='rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 '+actionFx
