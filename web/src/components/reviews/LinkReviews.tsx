import {useEffect,useRef,useState} from 'react'
import GoogleReviewSection from './GoogleReviewSection'
import {reviewSectionLinks} from './review-section-links'
import {FiShare2,FiDownload} from 'react-icons/fi'

/** Link adapter. No account credentials are used by this public component. */
export default function LinkReviews({slug,accent,preview=false}:{slug:string;accent?:string;preview?:boolean}){
  const [config,setConfig]=useState<{slug:string;url:string}|null>(null)
  const [message,setMessage]=useState('')
  const [downloading,setDownloading]=useState(false)
  const visit=useRef('')
  const sent=useRef(new Set<string>())
  const base=(import.meta.env.VITE_API_URL||'').replace(/\/$/,'')+'/api/v1/public/profiles/'+encodeURIComponent(slug)+'/reviews'
  useEffect(()=>{
    let live=true
    setConfig(null);setMessage('');visit.current=crypto.randomUUID();sent.current.clear()
    fetch(base,{cache:'no-store',credentials:'omit'}).then(r=>r.json()).then(r=>{
      if(live&&r?.ok&&typeof r.data?.googleReviewUrl==='string'){
        setConfig({slug,url:r.data.googleReviewUrl})
        if(new URLSearchParams(window.location.search).get('src')==='reviews-qr')track('review_qr')
      }
    }).catch(()=>undefined)
    return()=>{live=false}
  },[base,slug])
  const track=(eventType:string)=>{
    if(preview||!visit.current||sent.current.has(eventType))return
    sent.current.add(eventType)
    fetch(base+'/track',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({eventType,visitId:visit.current}),keepalive:true,credentials:'omit'}).catch(()=>undefined)
  }
  if(!config||config.slug!==slug)return null
  const origin=import.meta.env.MODE==='preview'?'https://preview.intaprd.com':import.meta.env.PROD?'https://intaprd.com':window.location.origin
  const {shareUrl,qrUrl}=reviewSectionLinks(origin,slug)
  const share=()=>{
    // Match the bank section's WhatsApp distribution pattern.
    window.open('https://wa.me/?text='+encodeURIComponent('Te comparto la sección de reseñas: '+shareUrl),'_blank','noopener,noreferrer')
  }
  const download=async()=>{
    if(downloading)return
    setDownloading(true);setMessage('')
    try{
      const QRCode=await import('qrcode')
      const png=await QRCode.toDataURL(qrUrl,{width:1400,margin:3,errorCorrectionLevel:'H',color:{dark:'#111111',light:'#FFFFFF'}})
      const a=document.createElement('a');a.href=png;a.download='kawvo-resenas.png'
      document.body.appendChild(a);a.click();a.remove()
    }catch{setMessage('No pudimos generar el QR. Intenta nuevamente.')}finally{setDownloading(false)}
  }
  return <GoogleReviewSection url={config.url} accent={accent} onImpression={()=>track('review_view')} onClick={()=>track('review_click')} sectionActions={<>
    <div style={{display:'flex',flexWrap:'wrap',justifyContent:'center',gap:'4px 20px',color:accent||'var(--ilx-primary, #1d4ed8)'}}>
      <button type="button" onClick={share} style={{display:'inline-flex',alignItems:'center',gap:7,minHeight:44,padding:'8px 0',fontSize:14,fontWeight:700,textDecoration:'underline',textUnderlineOffset:4,background:'transparent',border:0,color:'inherit',cursor:'pointer'}}><FiShare2 aria-hidden="true"/>Compartir reseña</button>
      <button type="button" onClick={()=>void download()} disabled={downloading} style={{display:'inline-flex',alignItems:'center',gap:7,minHeight:44,padding:'8px 0',fontSize:14,fontWeight:700,textDecoration:'underline',textUnderlineOffset:4,background:'transparent',border:0,color:'inherit',cursor:'pointer'}}><FiDownload aria-hidden="true"/>{downloading?'Generando QR…':'Descargar QR'}</button>
    </div>
    {message&&<p role="status" style={{fontSize:13,textAlign:'center',color:'var(--ilx-muted,#475569)'}}>{message}</p>}
  </>}/>
}
