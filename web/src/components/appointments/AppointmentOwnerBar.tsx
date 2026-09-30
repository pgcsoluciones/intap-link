import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { FaBell, FaCalendarAlt, FaTimes } from 'react-icons/fa'

type Palette={accent:string;accentSoft:string;text:string}
type Pending={
  id:string
  customer_name:string
  customer_phone:string
  appointment_date:string
  start_time:string
  reason_label:string
  details?:string|null
}
type Context={
  is_owner:boolean
  enabled:boolean
  pending_count:number
  pending:Pending[]
  manage_url:string
}
type Props={
  username:string
  ownerApiBase:string
  manageOrigin:string
  palette:Palette
  onToast:(message:string)=>void
}

export default function AppointmentOwnerBar({username,ownerApiBase,manageOrigin,palette,onToast}:Props){
  const[context,setContext]=useState<Context|null>(null)
  const[open,setOpen]=useState(false)
  const[actionId,setActionId]=useState('')
  const popoverRef=useRef<HTMLDivElement|null>(null)

  async function load(){
    try{
      const res=await fetch(ownerApiBase+'/public-context?username='+encodeURIComponent(username),{credentials:'include',cache:'no-store'})
      if(!res.ok){if(res.status===401||res.status===403)setContext(null);return}
      const json:any=await res.json().catch(()=>null)
      if(json?.ok&&json.data?.is_owner)setContext(json.data)
    }catch{/* visitor profile remains unaffected */}
  }
  useEffect(()=>{
    void load()
    const timer=window.setInterval(()=>void load(),30000)
    const focus=()=>void load()
    window.addEventListener('focus',focus)
    return()=>{window.clearInterval(timer);window.removeEventListener('focus',focus)}
  },[username,ownerApiBase])

  useEffect(()=>{
    if(!open)return
    const close=(event:MouseEvent|TouchEvent)=>{
      const target=event.target as Node|null
      if(target&&popoverRef.current?.contains(target))return
      setOpen(false)
    }
    document.addEventListener('mousedown',close)
    document.addEventListener('touchstart',close,{passive:true})
    return()=>{document.removeEventListener('mousedown',close);document.removeEventListener('touchstart',close)}
  },[open])

  async function act(id:string,action:'confirm'|'reject'){
    if(actionId)return
    setActionId(id)
    try{
      const res=await fetch(ownerApiBase+'/requests/'+encodeURIComponent(id)+'/'+action,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:'{}'})
      const json:any=await res.json().catch(()=>null)
      if(!res.ok||!json?.ok)throw new Error(json?.error||'No pudimos actualizar la solicitud.')
      onToast(action==='confirm'?'Cita confirmada. Ese horario ya no está disponible.':'Solicitud rechazada.')
      await load()
    }catch(error){onToast(error instanceof Error?error.message:'No pudimos actualizar la solicitud.')}
    finally{setActionId('')}
  }

  if(!context)return null
  const manageUrl=manageOrigin.replace(/\/$/,'')+String(context.manage_url||'/admin/sponsored/agenda')
  return <div style={{position:'sticky',top:0,zIndex:58,background:'rgba(255,255,255,.96)',backdropFilter:'blur(12px)',borderBottom:'1px solid #e2e8f0',fontFamily:'Inter,system-ui,sans-serif'}}>
    <div style={{width:'100%',maxWidth:520,margin:'0 auto',padding:'9px 12px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,boxSizing:'border-box'}}>
      <strong style={{fontSize:12.5,color:palette.text,whiteSpace:'nowrap'}}>Mi presentación</strong>
      <div style={{display:'flex',alignItems:'center',gap:7}}>
        <button type="button" onClick={()=>window.location.assign(manageUrl)} style={{...pill,borderColor:palette.accent+'44',background:palette.accentSoft,color:palette.text}}><FaCalendarAlt/>Agenda</button>
        <div ref={popoverRef} style={{position:'relative'}}>
          <button type="button" aria-label="Solicitudes de agenda" onClick={()=>setOpen(value=>!value)} style={{...pill,position:'relative',background:context.pending_count?'#fee2e2':'#f8fafc',color:context.pending_count?'#b91c1c':'#475569',borderColor:context.pending_count?'#fecaca':'#e2e8f0'}}><FaBell/>{context.pending_count>0&&<b style={{minWidth:18,height:18,borderRadius:99,display:'grid',placeItems:'center',background:'#dc2626',color:'#fff',fontSize:10}}>{context.pending_count}</b>}</button>
          {open&&<div style={popover}>
            <header style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,padding:'12px 13px',borderBottom:'1px solid #e2e8f0'}}><div><strong style={{fontSize:14,color:'#0f172a'}}>Solicitudes de agenda</strong><span style={{display:'block',marginTop:2,fontSize:11,color:'#64748b'}}>{context.enabled?'Agenda activa':'Agenda inactiva'}</span></div><button type="button" onClick={()=>setOpen(false)} aria-label="Cerrar" style={closeBtn}><FaTimes/></button></header>
            <div style={{maxHeight:'min(420px,65vh)',overflowY:'auto',padding:10}}>
              {context.pending.map(item=><article key={item.id} style={{padding:'11px 10px',borderRadius:14,background:'#f8fafc',marginBottom:8}}>
                <strong style={{display:'block',fontSize:13,color:'#0f172a'}}>{item.customer_name}</strong>
                <span style={{display:'block',marginTop:3,fontSize:11.5,fontWeight:750,color:'#64748b'}}>{item.appointment_date} · {item.start_time} · {item.reason_label}</span>
                {item.details&&<p style={{margin:'7px 0 0',fontSize:11.5,lineHeight:1.45,color:'#475569'}}>{item.details}</p>}
                <div style={{display:'flex',gap:7,marginTop:9}}><button type="button" disabled={Boolean(actionId)} onClick={()=>void act(item.id,'confirm')} style={{...actionBtn,background:'#16a34a',color:'#fff'}}>Confirmar</button><button type="button" disabled={Boolean(actionId)} onClick={()=>void act(item.id,'reject')} style={{...actionBtn,background:'#fff',color:'#64748b',border:'1px solid #dbe4ef'}}>Rechazar</button></div>
              </article>)}
              {!context.pending.length&&<p style={{margin:0,padding:'16px 10px',textAlign:'center',fontSize:12,color:'#64748b'}}>No tienes solicitudes pendientes.</p>}
            </div>
            <button type="button" onClick={()=>window.location.assign(manageUrl)} style={{width:'calc(100% - 20px)',margin:'0 10px 10px',border:0,borderRadius:12,padding:'11px 12px',background:palette.accent,color:'#fff',fontSize:12,fontWeight:900,cursor:'pointer'}}>Gestionar agenda</button>
          </div>}
        </div>
      </div>
    </div>
  </div>
}

const pill:CSSProperties={border:'1px solid #e2e8f0',borderRadius:999,padding:'8px 10px',display:'flex',alignItems:'center',gap:6,fontSize:11.5,fontWeight:900,cursor:'pointer'}
const popover:CSSProperties={position:'absolute',right:0,top:'calc(100% + 9px)',width:'min(360px,calc(100vw - 24px))',background:'#fff',border:'1px solid #dbe4ef',borderRadius:18,boxShadow:'0 20px 60px rgba(15,23,42,.18)',overflow:'hidden',zIndex:75}
const closeBtn:CSSProperties={border:0,background:'#f1f5f9',width:32,height:32,borderRadius:'50%',display:'grid',placeItems:'center',cursor:'pointer',color:'#475569'}
const actionBtn:CSSProperties={border:0,borderRadius:10,padding:'8px 10px',fontSize:11,fontWeight:900,cursor:'pointer'}
