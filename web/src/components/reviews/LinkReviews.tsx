import {useEffect,useRef,useState} from 'react'
import GoogleReviewSection from './GoogleReviewSection'
import {reviewSectionLinks,feedbackSectionLinks} from './review-section-links'
import ProfileQrModal from '../shared/ProfileQrModal'
import {FiShare2,FiDownload} from 'react-icons/fi'

/** Link adapter. No account credentials are used by this public component. */
export default function LinkReviews({slug,profileName,accent,preview=false,sponsored=false}:{slug:string;profileName:string;accent?:string;preview?:boolean;sponsored?:boolean}){
  const [config,setConfig]=useState<{slug:string;url:string}|null>(null)
  const [qrOpen,setQrOpen]=useState(false)
  const visit=useRef('')
  const sent=useRef(new Set<string>())
  const base=(import.meta.env.VITE_API_URL||'').replace(/\/$/,'')+(sponsored?'/api/v1/public/sponsored/':'/api/v1/public/profiles/')+encodeURIComponent(slug)+'/reviews'
  useEffect(()=>{
    let live=true
    setConfig(null);setQrOpen(false);visit.current=crypto.randomUUID();sent.current.clear()
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
  const {qrUrl,shareText}=sponsored?feedbackSectionLinks(origin,slug,'sponsored'):reviewSectionLinks(origin,slug)
  const share=()=>window.open('https://wa.me/?text='+encodeURIComponent(shareText),'_blank','noopener,noreferrer')
  return <GoogleReviewSection url={config.url} accent={accent} onImpression={()=>track('review_view')} onClick={()=>track('review_click')} sectionActions={<>
    <div style={{display:'flex',flexWrap:'wrap',justifyContent:'center',gap:'4px 20px',color:accent||'var(--ilx-primary, #1d4ed8)'}}>
      <button type="button" onClick={share} style={{display:'inline-flex',alignItems:'center',gap:7,minHeight:44,padding:'8px 0',fontSize:14,fontWeight:700,textDecoration:'underline',textUnderlineOffset:4,background:'transparent',border:0,color:'inherit',cursor:'pointer'}}><FiShare2 aria-hidden="true"/>Compartir reseña</button>
      <button type="button" onClick={()=>setQrOpen(true)} style={{display:'inline-flex',alignItems:'center',gap:7,minHeight:44,padding:'8px 0',fontSize:14,fontWeight:700,textDecoration:'underline',textUnderlineOffset:4,background:'transparent',border:0,color:'inherit',cursor:'pointer'}}><FiDownload aria-hidden="true"/>Descargar QR</button>
    </div>
    {qrOpen&&<ProfileQrModal targetUrl={qrUrl} shareText={shareText} profileName={profileName} filename={slug+'-resenas-qr.png'} subtitle="Escanea para abrir la sección de reseñas." accent={accent||'#0085c7'} onClose={()=>setQrOpen(false)}/>}
  </>}/>
}
