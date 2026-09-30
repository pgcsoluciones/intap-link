import { useEffect, useMemo, useState } from 'react'
import { FaCalendarAlt, FaClock, FaFileInvoiceDollar, FaWhatsapp } from 'react-icons/fa'
import AppointmentRequestModal from '../appointments/AppointmentRequestModal'
import type { FreeProfileAppearanceColors, FreeProfileData } from './IntapLinkGratis.types'

type Experience={schedule:Array<{day:string;hours:string}>;quote_button_visible:boolean;appointment_enabled:boolean;portfolio_title:string;quote_email?:string;has_whatsapp?:boolean}
type Props={profile:FreeProfileData;colors:FreeProfileAppearanceColors}

function normalizeWhatsapp(value:string){
  let digits=String(value||'').replace(/\\D/g,'')
  if(digits.startsWith('00'))digits=digits.slice(2)
  if(digits.length===10&&/^(809|829|849)/.test(digits))digits='1'+digits
  return digits
}
function palette(colors:FreeProfileAppearanceColors){return{accent:colors.button||colors.accent||colors.primary,accentSoft:colors.surface||'#ffffff',text:colors.text||'#111827'}}
function fieldStyle():React.CSSProperties{return{width:'100%',boxSizing:'border-box',border:'1px solid #dbe4ef',borderRadius:14,padding:'12px 13px',fontSize:14,outline:'none',background:'#fff',color:'#0f172a'}}
const labelStyle:React.CSSProperties={display:'grid',gap:7,fontSize:12.5,fontWeight:850,color:'#334155'}

export default function FreeContactActions({profile,colors}:Props){
  const[data,setData]=useState<Experience|null>(null)
  const[quoteOpen,setQuoteOpen]=useState(false)
  const[appointmentOpen,setAppointmentOpen]=useState(false)
  const[toast,setToast]=useState('')
  const[quoteChannel,setQuoteChannel]=useState<'whatsapp'|'email'|''>('')
  const[quote,setQuote]=useState({name:'',phone:'',email:'',request:'',delivery:'',sector:'',payment:''})
  const p=useMemo(()=>palette(colors),[colors])
  const apiBase='/api/v1/public/profiles/'+encodeURIComponent(profile.slug)
  const publicBase=typeof window!=='undefined'?window.location.origin+window.location.pathname:''

  useEffect(()=>{let alive=true;fetch(apiBase+'/free-experience',{cache:'no-store'}).then(r=>r.json()).then((json:any)=>{if(alive&&json?.ok)setData(json.data)}).catch(()=>undefined);return()=>{alive=false}},[profile.slug])
  useEffect(()=>{if(!data)return;const params=new URLSearchParams(window.location.search);if(params.get('cotizar')==='1'&&data.quote_button_visible)setQuoteOpen(true);if(params.get('agendar')==='1'&&data.appointment_enabled)setAppointmentOpen(true)},[data])
  useEffect(()=>{if(!quoteOpen&&!appointmentOpen)return;const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous}},[quoteOpen,appointmentOpen])
  useEffect(()=>{if(!toast)return;const id=window.setTimeout(()=>setToast(''),1800);return()=>window.clearTimeout(id)},[toast])

  if(!data)return null
  const whatsapp=normalizeWhatsapp(profile.whatsapp||profile.phone)
  const email=String(data.quote_email||profile.email||'').trim()
  const canWhatsapp=Boolean(whatsapp)
  const canEmail=/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)
  const effectiveChannel=quoteChannel||(canWhatsapp?'whatsapp':canEmail?'email':'')
  const quoteReady=Boolean(quote.name.trim()&&quote.phone.trim()&&quote.request.trim())

  function share(kind:'quote'|'agenda'){
    const target=publicBase+(kind==='quote'?'?cotizar=1':'?agendar=1')
    const message=kind==='quote'?'Te comparto mi formulario de cotización / información: '+target:'Te comparto el enlace para agendar: '+target
    window.open('https://wa.me/?text='+encodeURIComponent(message),'_blank','noopener,noreferrer')
  }
  function resetQuote(){setQuote({name:'',phone:'',email:'',request:'',delivery:'',sector:'',payment:''});setQuoteChannel('')}
  function sendQuote(){
    if(!quoteReady)return
    const lines=[
      'Hola, mi nombre es '+quote.name.trim()+'.',
      'Mi teléfono es '+quote.phone.trim()+'.',
      ...(quote.email.trim()?['Mi correo es '+quote.email.trim()+'.']:[]),
      '',
      'Quisiera cotizar / solicitar información:',
      quote.request.trim(),
      '',
      ...(quote.delivery?[quote.delivery==='Enviar'?(quote.sector.trim()?'Sería para enviar a '+quote.sector.trim()+'.':'Sería para enviar.'):'Sería para pasar a retirar.']:[]),
      ...(quote.payment?['Forma de pago: '+quote.payment+'.']:[]),
      '',
      'Quedo atento/a a su respuesta.',
    ]
    if(effectiveChannel==='whatsapp'&&canWhatsapp){const url='https://wa.me/'+whatsapp+'?text='+encodeURIComponent(lines.join('\\n'));setQuoteOpen(false);resetQuote();window.open(url,'_blank','noopener,noreferrer');return}
    if(canEmail){const subject='Solicitud de cotización – '+quote.name.trim();setQuoteOpen(false);resetQuote();window.location.href='mailto:'+encodeURIComponent(email)+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(lines.join('\\n'));return}
    setToast('Este perfil no tiene un canal disponible para cotizaciones.')
  }

  return <>
    {data.schedule.length>0&&<section className="ilx-section" aria-labelledby="free-schedule-title"><div style={{border:'1px solid var(--ilx-border)',borderRadius:24,background:'var(--ilx-surface)',padding:'18px 18px 16px'}}><div style={{display:'flex',alignItems:'center',gap:10,marginBottom:15}}><span style={{width:42,height:42,borderRadius:'50%',display:'grid',placeItems:'center',background:'var(--ilx-soft-primary)',color:'var(--ilx-primary)',fontSize:20}}><FaClock/></span><h2 id="free-schedule-title" style={{margin:0,fontSize:21,fontWeight:900,color:'var(--ilx-text)'}}>Nuestro horario</h2></div><div style={{display:'grid',gap:10}}>{data.schedule.map((item,index)=><div key={item.day+index} style={{display:'grid',gridTemplateColumns:'44px minmax(0,1fr)',alignItems:'center',gap:12,padding:'11px 13px',borderRadius:18,background:index%2===0?'var(--ilx-soft-primary)':'var(--ilx-surface)',border:'1px solid var(--ilx-border)'}}><span style={{width:38,height:38,borderRadius:12,display:'grid',placeItems:'center',background:'var(--ilx-surface)',color:'var(--ilx-primary)',fontSize:18,border:'1px solid var(--ilx-border)'}}><FaCalendarAlt/></span><span style={{minWidth:0}}><strong style={{display:'block',color:'var(--ilx-text)',fontSize:15,lineHeight:1.2,fontWeight:850}}>{item.day}</strong><span style={{display:'block',marginTop:4,color:'var(--ilx-muted)',fontSize:12.5,lineHeight:1.35}}>{item.hours}</span></span></div>)}</div><p style={{margin:'13px 0 0',textAlign:'center',fontSize:11.5,color:'var(--ilx-muted)'}}>En días especiales puede variar.</p></div></section>}

    {(data.quote_button_visible||data.appointment_enabled)&&<section className="ilx-section" style={{paddingTop:0}}><div style={{display:'grid',gridTemplateColumns:data.quote_button_visible&&data.appointment_enabled?'minmax(0,1fr) minmax(0,1fr)':'1fr',gap:10}}>{data.quote_button_visible&&<div style={{minWidth:0}}><button type="button" onClick={()=>setQuoteOpen(true)} style={{display:'flex',width:'100%',minWidth:0,minHeight:66,alignItems:'center',justifyContent:'center',gap:2,border:0,borderRadius:18,padding:'14px 10px',background:'var(--ilx-action)',color:'var(--ilx-on-action)',fontSize:13.5,lineHeight:1.25,fontWeight:900,cursor:'pointer',boxShadow:'0 10px 24px rgba(15,23,42,.10)'}}><FaFileInvoiceDollar style={{fontSize:18,flex:'0 0 auto'}}/><span style={{display:'inline-block',textAlign:'center'}}>Cotizar /<br/>información</span></button><button type="button" onClick={()=>share('quote')} style={{display:'block',margin:'7px auto 0',border:0,background:'transparent',padding:'3px 6px',color:'var(--ilx-primary)',fontSize:11.5,fontWeight:800,textDecoration:'underline',textUnderlineOffset:3,cursor:'pointer'}}>Compartir formulario</button></div>}{data.appointment_enabled&&<div style={{minWidth:0}}><button type="button" onClick={()=>setAppointmentOpen(true)} style={{display:'flex',width:'100%',minWidth:0,minHeight:66,alignItems:'center',justifyContent:'center',gap:7,border:'1.5px solid var(--ilx-action)',borderRadius:18,padding:'14px 10px',background:'var(--ilx-surface)',color:'var(--ilx-text)',fontSize:13.5,lineHeight:1.25,fontWeight:900,cursor:'pointer'}}><FaCalendarAlt style={{fontSize:18,flex:'0 0 auto'}}/>Agendar</button><button type="button" onClick={()=>share('agenda')} style={{display:'block',margin:'7px auto 0',border:0,background:'transparent',padding:'3px 6px',color:'var(--ilx-primary)',fontSize:11.5,fontWeight:800,textDecoration:'underline',textUnderlineOffset:3,cursor:'pointer'}}>Compartir agendar</button></div>}</div></section>}

    {quoteOpen&&<div role="dialog" aria-modal="true" aria-label="Solicitar cotización / información" onClick={()=>setQuoteOpen(false)} style={{position:'fixed',inset:0,zIndex:90,background:'rgba(15,23,42,.82)',display:'grid',placeItems:'center',padding:12,boxSizing:'border-box'}}><div onClick={e=>e.stopPropagation()} style={{width:'100%',maxWidth:520,maxHeight:'calc(100dvh - 24px)',overflowY:'auto',overflowX:'hidden',background:'#fff',borderRadius:24,padding:22,boxSizing:'border-box',boxShadow:'0 24px 70px rgba(15,23,42,.28)'}}><div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:16}}><div><h3 style={{margin:0,fontSize:22,color:p.text}}>Solicitar cotización / información</h3><p style={{margin:'7px 0 0',fontSize:13.5,lineHeight:1.5,color:'#64748b'}}>Describe el producto o servicio que necesitas. Los campos marcados con * son obligatorios.</p></div><button type="button" onClick={()=>setQuoteOpen(false)} aria-label="Cerrar" style={{border:0,background:'#f1f5f9',width:36,height:36,borderRadius:'50%',fontSize:20,cursor:'pointer',flex:'0 0 auto'}}>×</button></div><div style={{display:'grid',gap:14,marginTop:18}}><label style={labelStyle}>Nombre *<input style={fieldStyle()} value={quote.name} onChange={e=>setQuote({...quote,name:e.target.value})} autoComplete="name" placeholder="Tu nombre"/></label><label style={labelStyle}>Teléfono *<input style={fieldStyle()} value={quote.phone} onChange={e=>setQuote({...quote,phone:e.target.value})} inputMode="tel" autoComplete="tel" placeholder="809-000-0000"/></label><label style={labelStyle}>Correo <span style={{fontWeight:600,color:'#94a3b8'}}>(opcional)</span><input style={fieldStyle()} type="email" value={quote.email} onChange={e=>setQuote({...quote,email:e.target.value})} autoComplete="email" placeholder="correo@ejemplo.com"/></label><label style={labelStyle}>Cotización / información *<textarea style={{...fieldStyle(),minHeight:112,resize:'vertical'}} maxLength={1200} value={quote.request} onChange={e=>setQuote({...quote,request:e.target.value})} placeholder="Ej.: Me interesa conocer precio, disponibilidad o detalles de..."/></label><label style={labelStyle}>Tipo de entrega <span style={{fontWeight:600,color:'#94a3b8'}}>(opcional)</span><select style={fieldStyle()} value={quote.delivery} onChange={e=>setQuote({...quote,delivery:e.target.value})}><option value="">Seleccionar</option><option value="Pasar a retirar">Pasar a retirar</option><option value="Enviar">Solicitar envío</option></select></label><label style={labelStyle}>Sector o zona <span style={{fontWeight:600,color:'#94a3b8'}}>(opcional)</span><input style={fieldStyle()} value={quote.sector} onChange={e=>setQuote({...quote,sector:e.target.value})} placeholder="Sector o zona"/></label><label style={labelStyle}>Forma de pago <span style={{fontWeight:600,color:'#94a3b8'}}>(opcional)</span><select style={fieldStyle()} value={quote.payment} onChange={e=>setQuote({...quote,payment:e.target.value})}><option value="">Seleccionar</option><option value="Efectivo">Efectivo</option><option value="Transferencia">Transferencia</option><option value="Tarjeta">Tarjeta</option></select></label></div>{quoteReady&&canWhatsapp&&canEmail&&<div style={{marginTop:16,display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}><button type="button" onClick={()=>setQuoteChannel('whatsapp')} style={{border:'1px solid '+(effectiveChannel==='whatsapp'?p.accent:'#dbe4ef'),borderRadius:14,padding:'11px 12px',background:effectiveChannel==='whatsapp'?colors.surface:'#fff',fontWeight:850}}><FaWhatsapp/> WhatsApp</button><button type="button" onClick={()=>setQuoteChannel('email')} style={{border:'1px solid '+(effectiveChannel==='email'?p.accent:'#dbe4ef'),borderRadius:14,padding:'11px 12px',background:effectiveChannel==='email'?colors.surface:'#fff',fontWeight:850}}>✉ Correo</button></div>}{quoteReady&&(canWhatsapp||canEmail)&&<button type="button" onClick={sendQuote} style={{display:'flex',width:'100%',alignItems:'center',justifyContent:'center',gap:9,marginTop:16,border:0,borderRadius:16,padding:'14px 18px',background:p.accent,color:'#fff',fontSize:15,fontWeight:900,cursor:'pointer'}}>{effectiveChannel==='email'?'✉ Enviar solicitud por correo':<><FaWhatsapp/>Enviar solicitud por WhatsApp</>}</button>}</div></div>}
    {appointmentOpen&&<AppointmentRequestModal apiBase={apiBase+'/appointments'} palette={p} onClose={()=>setAppointmentOpen(false)} onToast={setToast}/>}
    {toast&&<div style={{position:'fixed',left:'50%',bottom:24,transform:'translateX(-50%)',background:'#0f172a',color:'#fff',padding:'10px 14px',borderRadius:999,fontSize:13,zIndex:110}}>{toast}</div>}
  </>
}
