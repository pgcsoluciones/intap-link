import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { FaCalendarAlt, FaClock, FaWhatsapp } from 'react-icons/fa'

type Palette={accent:string;accentSoft:string;text:string}
type Reason={id:string;label:string}
type Slot={time:string;end_time:string}
type Config={
  enabled:boolean
  business_name?:string
  min_date:string
  max_date:string
  reasons:Reason[]
  has_whatsapp?:boolean
}
type Props={
  apiBase:string
  palette:Palette
  onClose:()=>void
  onToast:(message:string)=>void
}

function humanSlot(value:string){
  const parts=value.split(':').map(Number),h=parts[0],m=parts[1]
  if(!Number.isFinite(h)||!Number.isFinite(m))return value
  return new Intl.DateTimeFormat('es-DO',{hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(2000,0,1,h,m))
}

export default function AppointmentRequestModal({apiBase,palette,onClose,onToast}:Props){
  const[config,setConfig]=useState<Config|null>(null)
  const[configLoading,setConfigLoading]=useState(true)
  const[slots,setSlots]=useState<Slot[]>([])
  const[slotsLoading,setSlotsLoading]=useState(false)
  const[sending,setSending]=useState(false)
  const[form,setForm]=useState({name:'',phone:'',email:'',date:'',time:'',reason_id:'',details:''})

  useEffect(()=>{
    let alive=true
    ;(async()=>{
      setConfigLoading(true)
      try{
        const res=await fetch(apiBase,{credentials:'include',cache:'no-store'})
        const json:any=await res.json().catch(()=>null)
        if(!alive)return
        if(!res.ok||!json?.ok){onToast(json?.error||'No pudimos cargar la agenda.');return}
        setConfig(json.data)
      }catch{if(alive)onToast('No pudimos cargar la agenda.')}
      finally{if(alive)setConfigLoading(false)}
    })()
    return()=>{alive=false}
  },[apiBase])

  useEffect(()=>{
    if(!form.date){setSlots([]);setForm(current=>({...current,time:''}));return}
    let alive=true
    ;(async()=>{
      setSlotsLoading(true);setForm(current=>({...current,time:''}))
      try{
        const res=await fetch(apiBase+'/availability?date='+encodeURIComponent(form.date),{cache:'no-store'})
        const json:any=await res.json().catch(()=>null)
        if(!alive)return
        setSlots(res.ok&&json?.ok&&Array.isArray(json.data?.slots)?json.data.slots:[])
      }catch{if(alive)setSlots([])}
      finally{if(alive)setSlotsLoading(false)}
    })()
    return()=>{alive=false}
  },[apiBase,form.date])

  const ready=useMemo(()=>Boolean(
    config?.enabled&&form.name.trim()&&form.phone.trim()&&form.date&&form.time&&form.reason_id&&!sending
  ),[config?.enabled,form,sending])

  async function send(){
    if(!ready)return
    setSending(true)
    try{
      const res=await fetch(apiBase,{
        method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',
        body:JSON.stringify(form),
      })
      const json:any=await res.json().catch(()=>null)
      if(!res.ok||!json?.ok)throw new Error(json?.error||'No pudimos registrar la solicitud.')
      const url=String(json.data?.whatsapp_url||'')
      if(!url)throw new Error('No pudimos preparar WhatsApp.')
      onClose()
      window.location.href=url
    }catch(error){onToast(error instanceof Error?error.message:'No pudimos registrar la solicitud.')}
    finally{setSending(false)}
  }

  return <div role="dialog" aria-modal="true" aria-label="Agendar" onClick={onClose} style={overlay}>
    <div onClick={event=>event.stopPropagation()} style={modal}>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:16,minWidth:0}}>
        <div style={{minWidth:0}}>
          <h3 style={{margin:0,fontSize:22,color:palette.text}}>Agendar</h3>
          <p style={{margin:'7px 0 0',fontSize:13.5,lineHeight:1.5,color:'#64748b'}}>Selecciona entre los horarios disponibles. La cita queda pendiente hasta que el negocio la confirme.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Cerrar" style={closeBtn}>×</button>
      </div>

      {configLoading?<div style={loadingBox}>Cargando disponibilidad…</div>:!config?.enabled?<div style={warningBox}>La agenda de este perfil no está disponible en este momento.</div>:<>
        <div style={{display:'grid',gap:14,marginTop:18}}>
          <label style={label}>Nombre *<input style={field} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} autoComplete="name" placeholder="Tu nombre"/></label>
          <label style={label}>Teléfono *<input style={field} value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} inputMode="tel" autoComplete="tel" placeholder="809-000-0000"/></label>
          <label style={label}>Correo <span style={optional}>(opcional)</span><input style={field} type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} autoComplete="email" placeholder="correo@ejemplo.com"/></label>

          <label style={label}><span style={fieldTitle}><FaCalendarAlt/>Fecha *</span><input style={field} type="date" min={config.min_date} max={config.max_date} value={form.date} onChange={e=>setForm({...form,date:e.target.value,time:''})}/></label>

          <label style={label}><span style={fieldTitle}><FaClock/>Hora disponible *</span>
            <select style={field} disabled={!form.date||slotsLoading} value={form.time} onChange={e=>setForm({...form,time:e.target.value})}>
              <option value="">{!form.date?'Selecciona primero la fecha':slotsLoading?'Buscando horarios…':slots.length?'Seleccionar hora':'No hay horarios disponibles'}</option>
              {slots.map(slot=><option key={slot.time} value={slot.time}>{humanSlot(slot.time)}</option>)}
            </select>
          </label>

          <label style={label}>Motivo de la agenda *
            <select style={field} value={form.reason_id} onChange={e=>setForm({...form,reason_id:e.target.value})}>
              <option value="">Seleccionar</option>
              {(config.reasons||[]).map(reason=><option key={reason.id} value={reason.id}>{reason.label}</option>)}
            </select>
          </label>

          <label style={label}>Detalles <span style={optional}>(opcional)</span>
            <textarea style={{...field,minHeight:112,resize:'vertical'}} maxLength={900} value={form.details} onChange={e=>setForm({...form,details:e.target.value})} placeholder="Ej.: Me interesa llevar mi vehículo para una evaluación antes de decidir el servicio."/>
          </label>
        </div>

        <button type="button" disabled={!ready} onClick={()=>void send()} style={{display:'flex',width:'100%',alignItems:'center',justifyContent:'center',gap:9,marginTop:18,border:0,borderRadius:16,padding:'14px 18px',background:palette.accent,color:'#fff',fontSize:15,fontWeight:900,cursor:ready?'pointer':'not-allowed',opacity:ready?1:.55}}>
          <FaWhatsapp/>{sending?'Registrando solicitud…':'Enviar agenda por WhatsApp'}
        </button>
      </>}
    </div>
  </div>
}

const overlay:CSSProperties={position:'fixed',inset:0,zIndex:65,background:'rgba(15,23,42,.82)',display:'grid',placeItems:'center',padding:12,boxSizing:'border-box',overflow:'hidden'}
const modal:CSSProperties={width:'100%',maxWidth:520,maxHeight:'calc(100dvh - 24px)',overflowY:'auto',overflowX:'hidden',overscrollBehavior:'contain',boxSizing:'border-box',background:'#fff',borderRadius:24,padding:22,boxShadow:'0 24px 70px rgba(15,23,42,.28)'}
const label:CSSProperties={display:'grid',gap:7,fontSize:12,fontWeight:850,color:'#334155'}
const optional:CSSProperties={fontWeight:600,color:'#94a3b8'}
const fieldTitle:CSSProperties={display:'flex',alignItems:'center',gap:7}
const field:CSSProperties={width:'100%',boxSizing:'border-box',border:'1px solid #dbe4ef',borderRadius:14,background:'#f8fafc',padding:'12px 13px',font:'inherit',fontSize:14,color:'#0f172a',outline:'none',minWidth:0}
const closeBtn:CSSProperties={border:0,background:'#f1f5f9',width:36,height:36,borderRadius:'50%',fontSize:20,cursor:'pointer',flex:'0 0 auto'}
const loadingBox:CSSProperties={marginTop:18,borderRadius:16,padding:'18px 14px',background:'#f8fafc',color:'#64748b',fontSize:13,fontWeight:750,textAlign:'center'}
const warningBox:CSSProperties={marginTop:18,borderRadius:16,padding:'14px',background:'#fff7ed',color:'#9a3412',fontSize:13,fontWeight:750,lineHeight:1.5}
