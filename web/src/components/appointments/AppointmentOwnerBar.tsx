import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { FaBars, FaBell, FaCalendarAlt, FaTimes } from 'react-icons/fa'

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
  allow_direct_actions?:boolean
  is_guest_editor?:boolean
  sponsor_banner_url?:string
  enabled:boolean
  pending_count:number
  pending:Pending[]
  manage_url:string
  settings_url?:string
  is_master?:boolean
  action_scope?:'sponsor_master'|'master'
  resource_url?:string
  resource_label?:string
  contact_url?:string
  contact_label?:string
}
type Props={
  username:string
  ownerApiBase:string
  manageOrigin:string
  settingsPath:string
  settingsLabel?:string
  palette:Palette
  mobileMenu?:boolean
  onToast:(message:string)=>void
}

export default function AppointmentOwnerBar({username,ownerApiBase,manageOrigin,settingsPath,settingsLabel='Configuración',palette,onToast,mobileMenu=false}:Props){
  const[context,setContext]=useState<Context|null>(null)
  const[open,setOpen]=useState(false)
  const[menuOpen,setMenuOpen]=useState(false)
  const[actionId,setActionId]=useState('')
  const popoverRef=useRef<HTMLDivElement|null>(null)
  const menuRef=useRef<HTMLDivElement|null>(null)

  async function load(){
    try{
      const res=await fetch(ownerApiBase+'/public-context?username='+encodeURIComponent(username),{credentials:'include',cache:'no-store'})
      if(!res.ok){setContext(null);return}
      const json:any=await res.json().catch(()=>null)
      if(json?.ok&&json.data?.is_owner)setContext(json.data)
      else setContext(null)
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

  useEffect(()=>{
    if(!menuOpen)return
    const close=(event:MouseEvent|TouchEvent)=>{
      if(event.target instanceof Node && menuRef.current?.contains(event.target))return
      setMenuOpen(false)
    }
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setMenuOpen(false)}
    document.addEventListener('mousedown',close)
    document.addEventListener('touchstart',close,{passive:true})
    document.addEventListener('keydown',escape)
    return()=>{
      document.removeEventListener('mousedown',close)
      document.removeEventListener('touchstart',close)
      document.removeEventListener('keydown',escape)
    }
  },[menuOpen])

  async function act(id:string,action:'confirm'|'reject'){
    if(actionId)return
    setActionId(id)
    try{
      const target=ownerApiBase+'/requests/'+encodeURIComponent(id)+'/'+action+(context?.action_scope?'?scope='+encodeURIComponent(context.action_scope):'')
      const res=await fetch(target,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:'{}'})
      const json:any=await res.json().catch(()=>null)
      if(!res.ok||!json?.ok)throw new Error(json?.error||'No pudimos actualizar la solicitud.')
      onToast(action==='confirm'?'Cita confirmada. Ese horario ya no está disponible.':'Solicitud rechazada.')
      await load()
    }catch(error){onToast(error instanceof Error?error.message:'No pudimos actualizar la solicitud.')}
    finally{setActionId('')}
  }

  if(!context)return null
  const origin=manageOrigin.replace(/\/$/,'')
  const manageUrl=origin+String(context.manage_url||'/admin/sponsored/agenda')
  const settingsUrl=origin+String(context.settings_url||settingsPath)
  const resourceUrl=String(context.resource_url||'').trim()
  const resourceLabel=String(context.resource_label||'Ver recurso').trim()||'Ver recurso'
  const contactUrl=String(context.contact_url||'').trim()
  const contactLabel=String(context.contact_label||'Contacto').trim()||'Contacto'
  return <div className={mobileMenu?'kawmed-owner-header':''} style={{position:'sticky',top:0,zIndex:58,background:'rgba(255,255,255,.96)',backdropFilter:'blur(12px)',borderBottom:'1px solid #e2e8f0',fontFamily:'Inter,system-ui,sans-serif'}}>
    {context.sponsor_banner_url&&<div style={{maxWidth:650,margin:'0 auto',padding:'10px 12px 4px'}}>
      <p style={{margin:'0 0 6px',fontSize:10,fontWeight:900,letterSpacing:'.1em',color:'#475569'}}>PATROCINIO PRIVADO · VISTA DEL MÉDICO</p>
      <img src={context.sponsor_banner_url} alt="Patrocinio profesional privado" style={{display:'block',width:'100%',height:'auto',maxHeight:210,objectFit:'contain',borderRadius:10}}/>
    </div>}
    {context.is_guest_editor&&<p style={{maxWidth:520,margin:'0 auto',padding:'7px 12px 0',fontSize:11,fontWeight:850,color:'#0e7490'}}>ADMINISTRADOR INVITADO · ACCESO TEMPORAL</p>}
    <div className="kawmed-owner-header__row" style={{width:'100%',maxWidth:520,margin:'0 auto',padding:'9px 12px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,boxSizing:'border-box'}}>
      <div className="kawmed-owner-header__desktop-links" style={{display:'flex',alignItems:'center',gap:10,minWidth:0}}>
        <button type="button" onClick={()=>window.location.assign(settingsUrl)} style={{border:0,background:'transparent',padding:'6px 4px',fontSize:12.5,fontWeight:900,color:palette.text,whiteSpace:'nowrap',cursor:'pointer'}}>{settingsLabel}</button>
        {contactUrl&&<a href={contactUrl} target="_blank" rel="noopener noreferrer" style={{fontSize:12,fontWeight:850,color:palette.accent,textDecoration:'underline',textUnderlineOffset:3,whiteSpace:'nowrap'}}>{contactLabel}</a>}
        {resourceUrl&&<a href={resourceUrl} target="_blank" rel="noopener noreferrer" style={{fontSize:12,fontWeight:850,color:palette.accent,textDecoration:'underline',textUnderlineOffset:3,whiteSpace:'nowrap'}}>{resourceLabel}</a>}
      </div>
      {mobileMenu&&<div className="kawmed-owner-header__mobile-menu" ref={menuRef}>
        <button type="button" className="kawmed-owner-header__menu-button" aria-label="Abrir menú del perfil" aria-expanded={menuOpen} aria-controls="kawmed-owner-links" onClick={()=>setMenuOpen(value=>!value)}><FaBars /><span>Menú</span></button>
        {menuOpen&&<nav className="kawmed-owner-header__dropdown" id="kawmed-owner-links" aria-label="Opciones de mi perfil">
          <a href={settingsUrl} onClick={()=>setMenuOpen(false)}>{settingsLabel}</a>
          {contactUrl&&<a href={contactUrl} target="_blank" rel="noopener noreferrer" onClick={()=>setMenuOpen(false)}>{contactLabel}</a>}
          {resourceUrl&&<a href={resourceUrl} target="_blank" rel="noopener noreferrer" onClick={()=>setMenuOpen(false)}>{resourceLabel}</a>}
        </nav>}
      </div>}
      <div style={{display:'flex',alignItems:'center',gap:7}}>
        <div id="free-preview-edit-slot" style={{display:'flex',alignItems:'center'}} />
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
                {context.allow_direct_actions!==false?<div style={{display:'flex',gap:7,marginTop:9}}><button type="button" disabled={Boolean(actionId)} onClick={()=>void act(item.id,'confirm')} style={{...actionBtn,background:'#16a34a',color:'#fff'}}>Confirmar</button><button type="button" disabled={Boolean(actionId)} onClick={()=>void act(item.id,'reject')} style={{...actionBtn,background:'#fff',color:'#64748b',border:'1px solid #dbe4ef'}}>Rechazar</button></div>:<p style={{margin:'8px 0 0',fontSize:11,color:'#475569'}}>Para responder, abre la agenda de la cuenta activa.</p>}
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
