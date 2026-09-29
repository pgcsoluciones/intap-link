import { useMemo, useState, type CSSProperties } from 'react'
import { FaCalendarAlt, FaClock, FaWhatsapp } from 'react-icons/fa'

type Palette={accent:string;accentSoft:string;text:string}
type Props={
  whatsapp:string
  palette:Palette
  onClose:()=>void
  onToast:(message:string)=>void
}

const MOTIVES=[
  ['visit','Visita'],
  ['call','Llamada'],
  ['meeting','Reunión / cita'],
  ['check','Evaluación / chequeo'],
  ['purchase','Compra / retiro'],
  ['service','Servicio / atención'],
  ['other','Otro'],
] as const

function localToday(){
  const now=new Date()
  const local=new Date(now.getTime()-now.getTimezoneOffset()*60000)
  return local.toISOString().slice(0,10)
}
function humanDate(value:string){
  if(!value)return''
  const [year,month,day]=value.split('-').map(Number)
  if(!year||!month||!day)return value
  try{
    return new Intl.DateTimeFormat('es-DO',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(year,month-1,day))
  }catch{return value}
}
function humanTime(value:string){
  if(!value)return''
  const [hour,minute]=value.split(':').map(Number)
  if(!Number.isFinite(hour)||!Number.isFinite(minute))return value
  try{
    return new Intl.DateTimeFormat('es-DO',{hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(2000,0,1,hour,minute))
  }catch{return value}
}
function motiveSentence(value:string){
  if(value==='visit')return'Estoy interesado/a en agendar una visita.'
  if(value==='call')return'Estoy interesado/a en agendar una llamada.'
  if(value==='meeting')return'Estoy interesado/a en agendar una reunión / cita.'
  if(value==='check')return'Estoy interesado/a en agendar una evaluación / chequeo.'
  if(value==='purchase')return'Estoy interesado/a en agendar una compra / retiro.'
  if(value==='service')return'Estoy interesado/a en agendar un servicio / atención.'
  return'Estoy interesado/a en agendar una cita.'
}

export default function SponsoredAppointmentModal({whatsapp,palette,onClose,onToast}:Props){
  const[form,setForm]=useState({name:'',phone:'',email:'',date:'',time:'',motive:'',details:''})
  const minDate=useMemo(localToday,[])
  const ready=Boolean(form.name.trim()&&form.phone.trim()&&form.date&&form.time&&form.motive&&whatsapp)

  function send(){
    const name=form.name.trim(),phone=form.phone.trim(),email=form.email.trim(),details=form.details.trim()
    if(!name||!phone||!form.date||!form.time||!form.motive){
      onToast('Completa nombre, teléfono, fecha, hora y motivo')
      return
    }
    const requestedAt=new Date(`${form.date}T${form.time}:00`)
    if(!Number.isFinite(requestedAt.getTime())||requestedAt.getTime()<=Date.now()){
      onToast('Selecciona una fecha y hora futuras')
      return
    }
    if(!whatsapp){
      onToast('Este perfil no tiene WhatsApp disponible para agendar')
      return
    }
    const lines=[
      `Hola, mi nombre es ${name}.`,
      `Mi teléfono es ${phone}.`,
      ...(email?[`Mi correo es ${email}.`]:[]),
      '',
      motiveSentence(form.motive),
      '',
      `Fecha solicitada: ${humanDate(form.date)}.`,
      `Hora solicitada: ${humanTime(form.time)}.`,
      ...(details?['','Detalles:',details]:[]),
      '',
      'Quedo atento/a a la confirmación de disponibilidad.'
    ]
    const href=`https://wa.me/${whatsapp.replace(/^\+/,'')}?text=${encodeURIComponent(lines.join('\n'))}`
    onClose()
    window.location.href=href
  }

  return <div role="dialog" aria-modal="true" aria-label="Agendar" onClick={onClose} style={overlay}>
    <div onClick={event=>event.stopPropagation()} style={modal}>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:16,minWidth:0}}>
        <div style={{minWidth:0}}>
          <h3 style={{margin:0,fontSize:22,color:palette.text}}>Agendar</h3>
          <p style={{margin:'7px 0 0',fontSize:13.5,lineHeight:1.5,color:'#64748b'}}>Selecciona la fecha y hora que prefieres. La disponibilidad se confirma por WhatsApp.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Cerrar" style={closeBtn}>×</button>
      </div>

      <div style={{display:'grid',gap:14,marginTop:18}}>
        <label style={label}>Nombre *<input style={field} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} autoComplete="name" placeholder="Tu nombre"/></label>
        <label style={label}>Teléfono *<input style={field} value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} inputMode="tel" autoComplete="tel" placeholder="809-000-0000"/></label>
        <label style={label}>Correo <span style={optional}>(opcional)</span><input style={field} type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} autoComplete="email" placeholder="correo@ejemplo.com"/></label>

        <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)',gap:10}}>
          <label style={label}><span style={fieldTitle}><FaCalendarAlt/>Fecha *</span><input style={field} type="date" min={minDate} value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label>
          <label style={label}><span style={fieldTitle}><FaClock/>Hora *</span><input style={field} type="time" value={form.time} onChange={e=>setForm({...form,time:e.target.value})}/></label>
        </div>

        <label style={label}>Motivo de la agenda *
          <select style={field} value={form.motive} onChange={e=>setForm({...form,motive:e.target.value})}>
            <option value="">Seleccionar</option>
            {MOTIVES.map(([value,text])=><option key={value} value={value}>{text}</option>)}
          </select>
        </label>

        <label style={label}>Detalles <span style={optional}>(opcional)</span>
          <textarea style={{...field,minHeight:112,resize:'vertical'}} maxLength={900} value={form.details} onChange={e=>setForm({...form,details:e.target.value})} placeholder="Ej.: Me interesa llevar mi vehículo para una evaluación antes de decidir el servicio."/>
        </label>
      </div>

      {!whatsapp&&<div style={{marginTop:16,borderRadius:14,padding:'11px 13px',background:'#fff7ed',color:'#9a3412',fontSize:12.5,fontWeight:750}}>Este negocio todavía no tiene WhatsApp configurado para recibir solicitudes de agenda.</div>}

      <button type="button" disabled={!ready} onClick={send} style={{display:'flex',width:'100%',alignItems:'center',justifyContent:'center',gap:9,marginTop:18,border:0,borderRadius:16,padding:'14px 18px',background:palette.accent,color:'#fff',fontSize:15,fontWeight:900,cursor:ready?'pointer':'not-allowed',opacity:ready?1:.55}}>
        <FaWhatsapp/>Enviar agenda por WhatsApp
      </button>
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
