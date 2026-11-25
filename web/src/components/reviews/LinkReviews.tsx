import {useEffect,useRef,useState} from 'react'
import GoogleReviewSection from './GoogleReviewSection'

/** Link adapter. No account credentials are used by this public component. */
export default function LinkReviews({slug,accent,preview=false}:{slug:string;accent?:string;preview?:boolean}){
  const [config,setConfig]=useState<{slug:string;url:string}|null>(null)
  const visit=useRef('')
  const sent=useRef(new Set<string>())
  const base=(import.meta.env.VITE_API_URL||'').replace(/\/$/,'')+'/api/v1/public/profiles/'+encodeURIComponent(slug)+'/reviews'
  useEffect(()=>{
    let live=true
    setConfig(null);visit.current=crypto.randomUUID();sent.current.clear()
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
  return <GoogleReviewSection url={config.url} accent={accent} onImpression={()=>track('review_view')} onClick={()=>track('review_click')}/>
}
