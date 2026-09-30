import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { FaCalendarAlt, FaClock, FaFileInvoiceDollar, FaWhatsapp } from 'react-icons/fa'
import AppointmentRequestModal from '../appointments/AppointmentRequestModal'
import QuoteMediaAttachments from '../sponsored/QuoteMediaAttachments'
import type { FreeProfileAppearanceColors, FreeProfileData } from './IntapLinkGratis.types'

type Props={profile:FreeProfileData;colors:FreeProfileAppearanceColors}

function normalizeWhatsapp(value:string){
  let digits=String(value||'').replace(/\D/g,'')
  if(digits.startsWith('00'))digits=digits.slice(2)
  if(digits.length===10&&/^(809|829|849)/.test(digits))digits='1'+digits
  return digits
}
function palette(colors:FreeProfileAppearanceColors){return{accent:colors.button||colors.accent||colors.primary,accentSoft:colors.surface||'#ffffff',text:colors.text||'#111827'}}
async function optimizeQuoteImage(file:File){
  if(!String(file.type||'').startsWith('image/'))return file
  if(typeof createImageBitmap!=='function')return file
  const bitmap=await createImageBitmap(file)
  const max=1600,scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height))
  const width=Math.max(1,Math.round(bitmap.width*scale)),height=Math.max(1,Math.round(bitmap.height*scale))
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height
  const ctx=canvas.getContext('2d');if(!ctx){bitmap.close();return file}
  ctx.drawImage(bitmap,0,0,width,height);bitmap.close()
  const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/webp',.82))
  if(!blob)return file
  const name=(String(file.name||'media').replace(/\.[^.]+$/,'')||'media')+'.webp'
  return new File([blob],name,{type:'image/webp',lastModified:Date.now()})
}
function quoteMediaClientId(){
  const key='kawvo:quote-media-client-v1'
  try{
    const existing=window.localStorage.getItem(key)
    if(existing)return existing
    const created=typeof crypto.randomUUID==='function'?crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)+'-'+Math.random().toString(36).slice(2)
    window.localStorage.setItem(key,created)
    return created
  }catch{return ''}
}
function fieldStyle():CSSProperties{return{width:'100%',boxSizing:'border-box',border:'1px solid #dbe4ef',borderRadius:14,padding:'12px 13px',fontSize:14,outline:'none',background:'#fff',color:'#0f172a'}}
const labelStyle:CSSProperties={display:'grid',gap:7,fontSize:12.5,fontWeight:850,color:'#334155'}

export default function FreeContactActions({profile,colors}:Props){
  const[quoteOpen,setQuoteOpen]=useState(false)
  const[appointmentOpen,setAppointmentOpen]=useState(false)
  const[toast,setToast]=useState('')
  const[quoteChannel,setQuoteChannel]=useState<'whatsapp'|'email'|''>('')
  const[quote,setQuote]=useState({name:'',phone:'',email:'',request:'',delivery:'',sector:'',payment:''})
  const[quoteMedia,setQuoteMedia]=useState<File[]>([])
  const[quoteSending,setQuoteSending]=useState(false)
  const p=useMemo(()=>palette(colors),[colors])
  const experience=profile.experience??{schedule:[],quoteButtonVisible:false,appointmentEnabled:false}
  const apiBase='/api/v1/public/profiles/'+encodeURIComponent(profile.slug)
  const publicBase=typeof window!=='undefined'?window.location.origin+window.location.pathname:''

  useEffect(()=>{const params=new URLSearchParams(window.location.search);if(params.get('cotizar')==='1'&&experience.quoteButtonVisible)setQuoteOpen(true);if(params.get('agendar')==='1'&&experience.appointmentEnabled)setAppointmentOpen(true)},[experience.quoteButtonVisible,experience.appointmentEnabled])
  useEffect(()=>{if(!quoteOpen&&!appointmentOpen)return;const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous}},[quoteOpen,appointmentOpen])
  useEffect(()=>{if(!toast)return;const id=window.setTimeout(()=>setToast(''),1800);return()=>window.clearTimeout(id)},[toast])

  const whatsapp=normalizeWhatsapp(profile.whatsapp||profile.phone)
  const email=String(profile.email||'').trim()
  const canWhatsapp=Boolean(whatsapp)
  const canEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const effectiveChannel=quoteChannel||(canWhatsapp?'whatsapp':canEmail?'email':'')
  const quoteReady=Boolean(quote.name.trim()&&quote.phone.trim()&&(quote.request.trim()||quoteMedia.length))

  function share(kind:'quote'|'agenda'){
    const target=publicBase+(kind==='quote'?'?cotizar=1':'?agendar=1')
    const message=kind==='quote'?'Te comparto mi formulario de cotización / información: '+target:'Te comparto el enlace para agendar: '+target
    window.open('https://wa.me/?text='+encodeURIComponent(message),'_blank','noopener,noreferrer')
  }
  function quoteMessageLines(media:Array<{url:string;kind:string}>){
    const name=quote.name.trim(),phone=quote.phone.trim(),request=quote.request.trim()
    const delivery=quote.delivery==='Pasar a retirar'
      ? 'Sería para pasar a retirar.'
      : quote.delivery==='Enviar'
        ? (quote.sector.trim()?'Sería para enviar a '+quote.sector.trim()+'.':'Sería para enviar.')
        : (quote.sector.trim()?'La ubicación o zona sería '+quote.sector.trim()+'.':'')
    const payment=quote.payment?'Pagaría '+(quote.payment.toLowerCase()==='tarjeta'?'con tarjeta':quote.payment.toLowerCase()==='transferencia'?'por transferencia':'en efectivo')+'.':''
    const detailLines:string[]=[]
    if(request)detailLines.push(request)
    if(media.length){
      if(request)detailLines.push('')
      const kind=media[0]?.kind||'document'
      const label=kind==='audio'?'Audio adjunto':kind==='image'?(media.length===1?'Imagen adjunta':'Galería de imágenes adjunta'):(media.length===1?'Archivo adjunto':'Archivos adjuntos')
      detailLines.push(label+' (disponible'+(media.length>1?'s':'')+' por 3 días):')
      if(kind==='image'&&media.length>1)detailLines.push(media[0].url)
      else media.forEach((item,index)=>detailLines.push(media.length>1?(String(index+1)+'. '+item.url):item.url))
    }
    return[
      'Hola, mi nombre es '+name+'.',
      'Mi teléfono es '+phone+'.',
      ...(quote.email.trim()?['Mi correo es '+quote.email.trim()+'.']:[]),
      'Quisiera cotizar / solicitar información:',
      '',
      ...detailLines,
      '',
      ...(delivery?[delivery]:[]),
      ...(payment?[payment]:[]),
      ...((delivery||payment)?['']:[]),
      'Quedo atento/a a su respuesta. Entiendo que las solicitudes se responden según el orden de trabajo en cola.'
    ]
  }
  function resetQuote(){
    setQuote({name:'',phone:'',email:'',request:'',delivery:'',sector:'',payment:''})
    setQuoteMedia([])
    setQuoteChannel('')
  }
  function finishQuoteFlow(){
    setQuoteOpen(false)
    resetQuote()
    const clean=window.location.pathname
    window.history.replaceState({},'',clean)
  }
  async function uploadQuoteMedia(){
    if(!quoteMedia.length)return[]
    const files=await Promise.all(quoteMedia.map(async file=>{
      if(!String(file.type||'').startsWith('image/'))return file
      try{return await optimizeQuoteImage(file)}catch{return file}
    }))
    for(const file of files)if(file.size>10*1024*1024)throw new Error('Cada archivo debe pesar 10 MB o menos después de optimizarse.')
    const fd=new FormData()
    const clientId=quoteMediaClientId();if(clientId)fd.append('client_id',clientId)
    files.forEach(file=>fd.append('file',file,file.name))
    const res=await fetch(apiBase+'/quote-media',{method:'POST',body:fd})
    const json:any=await res.json().catch(()=>null)
    if(!res.ok||!json?.ok)throw new Error(json?.error||'No pudimos adjuntar el media.')
    return Array.isArray(json.data?.items)?json.data.items.map((item:any)=>({url:String(item?.url||''),kind:String(item?.kind||'document')})).filter((item:any)=>item.url):[]
  }
  async function sendQuoteRequest(){
    const name=quote.name.trim(),phone=quote.phone.trim(),request=quote.request.trim()
    if(!name||!phone||(!request&&!quoteMedia.length)){setToast('Completa nombre, teléfono y una solicitud o adjunta media');return}
    const channel=quoteChannel||(canWhatsapp?'whatsapp':canEmail?'email':'')
    if(!channel){setToast('Selecciona cómo deseas enviar la solicitud');return}
    const popup=channel==='whatsapp'?window.open('about:blank','_blank'):null
    if(popup)popup.opener=null
    setQuoteSending(true)
    try{
      const media=await uploadQuoteMedia()
      const lines=quoteMessageLines(media)
      if(channel==='whatsapp'){
        if(!canWhatsapp){popup?.close();setToast('Este perfil no tiene WhatsApp disponible');return}
        const url='https://wa.me/'+whatsapp.replace(/^\+/,'')+'?text='+encodeURIComponent(lines.join('\n'))
        finishQuoteFlow()
        if(popup)popup.location.href=url
        else window.location.href=url
        return
      }
      if(!canEmail){popup?.close();setToast('Este perfil no tiene correo comercial disponible');return}
      const subject='Solicitud de cotización – '+quote.name.trim()
      finishQuoteFlow()
      window.location.href='mailto:'+encodeURIComponent(email)+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(lines.join('\n'))
    }catch(error){
      popup?.close()
      setToast(error instanceof Error?error.message:'No pudimos adjuntar el media.')
    }finally{setQuoteSending(false)}
  }

  return <>
    {experience.schedule.length>0&&<section className="ilx-section" aria-labelledby="free-schedule-title"><div style={{border:'1px solid var(--ilx-border)',borderRadius:24,background:'var(--ilx-surface)',padding:'18px 18px 16px'}}><div style={{display:'flex',alignItems:'center',gap:10,marginBottom:15}}><span style={{width:42,height:42,borderRadius:'50%',display:'grid',placeItems:'center',background:'var(--ilx-soft-primary)',color:'var(--ilx-primary)',fontSize:20}}><FaClock/></span><h2 id="free-schedule-title" style={{margin:0,fontSize:21,fontWeight:900,color:'var(--ilx-text)'}}>Nuestro horario</h2></div><div style={{display:'grid',gap:10}}>{experience.schedule.map((item,index)=><div key={item.day+index} style={{display:'grid',gridTemplateColumns:'44px minmax(0,1fr) auto',alignItems:'center',gap:12,padding:'11px 13px',borderRadius:18,background:index%2===0?'var(--ilx-soft-primary)':'var(--ilx-surface)',border:'1px solid var(--ilx-border)'}}><span style={{width:38,height:38,borderRadius:12,display:'grid',placeItems:'center',background:'var(--ilx-surface)',color:'var(--ilx-primary)',fontSize:18,border:'1px solid var(--ilx-border)'}}><FaCalendarAlt/></span><strong style={{color:'var(--ilx-text)',fontSize:15,lineHeight:1.2,fontWeight:850}}>{item.day}</strong><span style={{justifySelf:'end',borderRadius:999,background:'var(--ilx-action)',color:'var(--ilx-on-action)',padding:'7px 12px',fontSize:12.8,fontWeight:850,whiteSpace:'nowrap'}}>{item.hours}</span></div>)}</div><p style={{margin:'13px 0 0',textAlign:'center',fontSize:11.5,color:'var(--ilx-muted)'}}>En días especiales puede variar.</p></div></section>}

    {(experience.quoteButtonVisible||experience.appointmentEnabled)&&<section className="ilx-section" style={{paddingTop:0}}><div style={{display:'grid',gridTemplateColumns:experience.quoteButtonVisible&&experience.appointmentEnabled?'minmax(0,1fr) minmax(0,1fr)':'1fr',gap:10}}>{experience.quoteButtonVisible&&<div style={{minWidth:0}}><button type="button" onClick={()=>setQuoteOpen(true)} style={{display:'flex',width:'100%',minWidth:0,minHeight:66,alignItems:'center',justifyContent:'center',gap:6,border:0,borderRadius:18,padding:'14px 10px',background:'var(--ilx-action)',color:'var(--ilx-on-action)',fontSize:13.5,lineHeight:1.25,fontWeight:900,cursor:'pointer',boxShadow:'0 10px 24px rgba(15,23,42,.10)'}}><FaFileInvoiceDollar style={{fontSize:20,flex:'0 0 auto'}}/><span style={{display:'inline-block',textAlign:'center'}}>{experience.appointmentEnabled?<>Cotizar /<br/>información</>:<>Cotizar / información</>}</span></button><button type="button" onClick={()=>share('quote')} style={{display:'block',margin:'7px auto 0',border:0,background:'transparent',padding:'3px 6px',color:'var(--ilx-primary)',fontSize:11.5,fontWeight:800,textDecoration:'underline',textUnderlineOffset:3,cursor:'pointer'}}>Compartir formulario</button></div>}{experience.appointmentEnabled&&<div style={{minWidth:0}}><button type="button" onClick={()=>setAppointmentOpen(true)} style={{display:'flex',width:'100%',minWidth:0,minHeight:66,alignItems:'center',justifyContent:'center',gap:7,border:'1.5px solid var(--ilx-action)',borderRadius:18,padding:'14px 10px',background:'var(--ilx-surface)',color:'var(--ilx-text)',fontSize:13.5,lineHeight:1.25,fontWeight:900,cursor:'pointer'}}><FaCalendarAlt style={{fontSize:18,flex:'0 0 auto'}}/>Agendar</button><button type="button" onClick={()=>share('agenda')} style={{display:'block',margin:'7px auto 0',border:0,background:'transparent',padding:'3px 6px',color:'var(--ilx-primary)',fontSize:11.5,fontWeight:800,textDecoration:'underline',textUnderlineOffset:3,cursor:'pointer'}}>Compartir agendar</button></div>}</div></section>}

    {quoteOpen&&<div role="dialog" aria-modal="true" aria-label="Solicitar cotización / información" onClick={()=>setQuoteOpen(false)} style={{position:'fixed',inset:0,zIndex:90,background:'rgba(15,23,42,.82)',display:'grid',placeItems:'center',padding:12,boxSizing:'border-box'}}><div onClick={e=>e.stopPropagation()} style={{width:'100%',maxWidth:520,maxHeight:'calc(100dvh - 24px)',overflowY:'auto',overflowX:'hidden',overscrollBehavior:'contain',background:'#fff',borderRadius:24,padding:22,boxSizing:'border-box',boxShadow:'0 24px 70px rgba(15,23,42,.28)'}}><div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:16,minWidth:0}}><div style={{minWidth:0}}><h3 style={{margin:0,fontSize:22,color:p.text}}>Solicitar cotización / información</h3><p style={{margin:'7px 0 0',fontSize:13.5,lineHeight:1.5,color:'#64748b'}}>Describe el producto o servicio y la cantidad que necesitas. Los campos marcados con * son obligatorios.</p></div><button type="button" onClick={()=>setQuoteOpen(false)} aria-label="Cerrar" style={{border:0,background:'#f1f5f9',width:36,height:36,borderRadius:'50%',fontSize:20,cursor:'pointer',flex:'0 0 auto'}}>×</button></div><div style={{display:'grid',gap:14,marginTop:18}}><label style={labelStyle}>Nombre *<input style={fieldStyle()} value={quote.name} onChange={e=>setQuote({...quote,name:e.target.value})} autoComplete="name" placeholder="Tu nombre"/></label><label style={labelStyle}>Teléfono *<input style={fieldStyle()} value={quote.phone} onChange={e=>setQuote({...quote,phone:e.target.value})} inputMode="tel" autoComplete="tel" placeholder="809-000-0000"/></label><label style={labelStyle}>Correo <span style={{fontWeight:600,color:'#94a3b8'}}>(opcional)</span><input style={fieldStyle()} type="email" value={quote.email} onChange={e=>setQuote({...quote,email:e.target.value})} autoComplete="email" placeholder="correo@ejemplo.com"/></label><label style={labelStyle}>Cotización / información <span style={{fontWeight:600,color:'#94a3b8'}}>(opcional si adjuntas media)</span><textarea style={{...fieldStyle(),minHeight:112,resize:'vertical'}} maxLength={1200} value={quote.request} onChange={e=>setQuote({...quote,request:e.target.value})} placeholder="Ej.: 10 unidades de..., 2 sacos de..., servicio de..."/></label><p style={{margin:'-6px 0 0',fontSize:12,color:'#64748b'}}>Puedes escribir la solicitud, adjuntar media o usar ambas opciones.</p><QuoteMediaAttachments files={quoteMedia} onChange={setQuoteMedia} onError={setToast}/><label style={labelStyle}>Tipo de entrega <span style={{fontWeight:600,color:'#94a3b8'}}>(opcional)</span><select style={fieldStyle()} value={quote.delivery} onChange={e=>setQuote({...quote,delivery:e.target.value})}><option value="">Seleccionar</option><option value="Pasar a retirar">Pasar a retirar</option><option value="Enviar">Solicitar envío</option></select></label><label style={labelStyle}>Sector o zona <span style={{fontWeight:600,color:'#94a3b8'}}>(opcional)</span><input style={fieldStyle()} value={quote.sector} onChange={e=>setQuote({...quote,sector:e.target.value})} placeholder="Sector o zona de entrega"/></label><label style={labelStyle}>Forma de pago <span style={{fontWeight:600,color:'#94a3b8'}}>(opcional)</span><select style={fieldStyle()} value={quote.payment} onChange={e=>setQuote({...quote,payment:e.target.value})}><option value="">Seleccionar</option><option value="Efectivo">Efectivo</option><option value="Transferencia">Transferencia</option><option value="Tarjeta">Tarjeta</option></select></label></div>{quoteReady&&<div style={{marginTop:16}}><div style={{fontSize:12,fontWeight:900,color:'#334155',marginBottom:8}}>¿Cómo deseas enviar esta solicitud?</div>{canWhatsapp&&canEmail?<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}><button type="button" onClick={()=>setQuoteChannel('whatsapp')} aria-pressed={effectiveChannel==='whatsapp'} style={{border:'1px solid '+(effectiveChannel==='whatsapp'?p.accent:'#dbe4ef'),borderRadius:14,padding:'11px 12px',background:effectiveChannel==='whatsapp'?p.accentSoft:'#fff',color:effectiveChannel==='whatsapp'?p.text:'#475569',fontWeight:850}}><FaWhatsapp/> WhatsApp</button><button type="button" onClick={()=>setQuoteChannel('email')} aria-pressed={effectiveChannel==='email'} style={{border:'1px solid '+(effectiveChannel==='email'?p.accent:'#dbe4ef'),borderRadius:14,padding:'11px 12px',background:effectiveChannel==='email'?p.accentSoft:'#fff',color:effectiveChannel==='email'?p.text:'#475569',fontWeight:850}}>✉ Correo</button></div>:<div style={{borderRadius:14,padding:'11px 13px',background:p.accentSoft,color:p.text,fontSize:12.5,fontWeight:800}}>{canWhatsapp?'Se enviará por WhatsApp.':canEmail?'Se enviará por correo.':'Este perfil todavía no ha configurado un canal para recibir cotizaciones.'}</div>}</div>}<div style={{marginTop:16,borderRadius:16,padding:'12px 14px',background:p.accentSoft,color:p.text,fontSize:12.5,lineHeight:1.5}}>Tu solicitud será respondida según el orden de trabajo en cola.</div>{quoteReady&&(canWhatsapp||canEmail)&&<button type="button" disabled={quoteSending} onClick={()=>void sendQuoteRequest()} style={{display:'flex',width:'100%',alignItems:'center',justifyContent:'center',gap:9,marginTop:16,border:0,borderRadius:16,padding:'14px 18px',background:p.accent,color:'#fff',fontSize:15,fontWeight:900,cursor:quoteSending?'wait':'pointer',opacity:quoteSending?0.72:1}}>{quoteSending?'Preparando solicitud…':(effectiveChannel==='email'||(!canWhatsapp&&canEmail))?'✉ Enviar solicitud por correo':<><FaWhatsapp/>Enviar solicitud por WhatsApp</>}</button>}</div></div>}
    {appointmentOpen&&<AppointmentRequestModal apiBase={apiBase+'/appointments'} palette={p} onClose={()=>setAppointmentOpen(false)} onToast={setToast}/>}
    {toast&&<div style={{position:'fixed',left:'50%',bottom:24,transform:'translateX(-50%)',background:'#0f172a',color:'#fff',padding:'10px 14px',borderRadius:999,fontSize:13,zIndex:110}}>{toast}</div>}
  </>
}
