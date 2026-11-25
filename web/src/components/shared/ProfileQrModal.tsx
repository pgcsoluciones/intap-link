import {useEffect,useId,useState,type CSSProperties} from 'react'
import {FaAddressCard,FaQrcode,FaTimes,FaWhatsapp} from 'react-icons/fa'
import '../free-profile/IntapLinkGratisRebuilt.css'

type Props={targetUrl:string;shareText:string;profileName:string;filename:string;subtitle?:string;kicker?:string;accent?:string;onClose:()=>void;onTrack?:(event:string,label:string)=>void}
export default function ProfileQrModal({targetUrl,shareText,profileName,filename,subtitle='Escanea para abrir este perfil.',kicker='KAWVO LINK',accent,onClose,onTrack}:Props){
 const [png,setPng]=useState(''),[error,setError]=useState('')
 const title=useId()
 useEffect(()=>{
  let live=true
  setPng('');setError('')
  import('qrcode').then(q=>q.toDataURL(targetUrl,{width:1200,margin:3,errorCorrectionLevel:'H',color:{dark:'#111111',light:'#FFFFFF'}})).then(value=>{if(live)setPng(value)}).catch(()=>{if(live)setError('No pudimos generar el código QR.')})
  return()=>{live=false}
 },[targetUrl])
 useEffect(()=>{
  const previous=document.body.style.overflow
  document.body.style.overflow='hidden'
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()}
  window.addEventListener('keydown',key)
  return()=>{document.body.style.overflow=previous;window.removeEventListener('keydown',key)}
 },[onClose])
 function download(){
  if(!png)return
  onTrack?.('qr_download','Descargar QR PNG')
  const a=document.createElement('a');a.href=png;a.download=filename;document.body.appendChild(a);a.click();a.remove()
 }
 async function photos(){
  if(!png)return
  onTrack?.('qr_save_photo','Guardar QR en fotos')
  try{
   const blob=await (await fetch(png)).blob()
   const file=new File([blob],filename,{type:'image/png'})
   if(navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:'Código QR de '+profileName});return}
  }catch(e){if(e instanceof Error&&e.name==='AbortError')return}
  const a=document.createElement('a');a.href=png;a.download=filename;a.target='_blank';a.rel='noopener noreferrer';document.body.appendChild(a);a.click();a.remove()
 }
 const whatsapp=()=>window.open('https://wa.me/?text='+encodeURIComponent(shareText),'_blank','noopener,noreferrer')
 const palette=accent?{'--ilx-surface':'#fff','--ilx-text':'#0f172a','--ilx-muted':'#64748b','--ilx-border':'#dbe4ee','--ilx-accent':accent,'--ilx-primary':accent,'--ilx-action':accent,'--ilx-on-action':'#fff'} as CSSProperties:undefined
 return <div className="ilx-modal-backdrop" role="presentation" style={palette} onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
  <article className="ilx-qr-modal" role="dialog" aria-modal="true" aria-labelledby={title} style={{maxHeight:'calc(100dvh - 36px)',overflowY:'auto'}}>
   <button type="button" className="ilx-modal-close" onClick={onClose} aria-label="Cerrar"><FaTimes/></button>
   <div className="ilx-qr-modal-body"><span className="ilx-qr-kicker">{kicker}</span><h2 id={title}>Código QR</h2><p>{subtitle}</p>
    {png?<div className="ilx-qr-image"><img src={png} alt={'Código QR de '+profileName}/></div>:<p role="status">{error||'Generando QR…'}</p>}
    <strong className="ilx-qr-profile-name">{profileName}</strong>
    <div className="ilx-qr-actions"><button type="button" disabled={!png} onClick={download}><FaQrcode/><span>Descargar PNG</span></button><button type="button" disabled={!png} onClick={()=>void photos()}><FaAddressCard/><span>Guardar en Fotos</span></button><button type="button" className="ilx-qr-whatsapp" onClick={whatsapp}><FaWhatsapp/><span>Compartir por WhatsApp</span></button></div>
   </div>
  </article>
 </div>
}
