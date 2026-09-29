import { useEffect, useState, type CSSProperties } from 'react'
import { useParams } from 'react-router-dom'
import { FaChevronLeft, FaChevronRight, FaDownload, FaTimes } from 'react-icons/fa'

type MediaItem={
  id:string
  kind:'image'|'document'|'audio'
  content_type:string
  name:string
  size_bytes:number
  file_url:string
  download_url:string
}
type MediaMeta={
  code:string
  kind:'image'|'document'|'audio'
  content_type:string
  name:string
  size_bytes:number
  expires_at:string
  file_url:string
  download_url:string
  download_batch_url?:string
  items?:MediaItem[]
}

function formatSize(bytes:number){
  if(!Number.isFinite(bytes)||bytes<=0)return''
  if(bytes<1024*1024)return String(Math.max(1,Math.round(bytes/1024)))+' KB'
  return (bytes/1024/1024).toFixed(1)+' MB'
}

export default function SponsoredQuoteMediaViewer(){
  const params=useParams();const code=String(params.code||params.slug||'')
  const[data,setData]=useState<MediaMeta|null>(null)
  const[loading,setLoading]=useState(true)
  const[error,setError]=useState('')
  const[index,setIndex]=useState(0)

  useEffect(()=>{
    let alive=true
    ;(async()=>{
      setLoading(true);setError('');setIndex(0)
      try{
        const res=await fetch('/api/v1/public/sponsored/quote-media/'+encodeURIComponent(code)+'/meta',{cache:'no-store'})
        const json:any=await res.json().catch(()=>null)
        if(!alive)return
        if(!res.ok||!json?.ok){setError(json?.error||'Este media no está disponible o ya venció.');return}
        setData(json.data)
      }catch{if(alive)setError('No pudimos abrir este media.')}
      finally{if(alive)setLoading(false)}
    })()
    return()=>{alive=false}
  },[code])

  function closeViewer(){
    if(window.history.length>1){window.history.back();return}
    window.close()
    window.location.replace('/')
  }

  if(loading)return<main style={{minHeight:'100vh',display:'grid',placeItems:'center',background:'#0f172a',color:'#fff',fontFamily:'Inter,system-ui,sans-serif'}}>Cargando…</main>

  if(error||!data)return<main style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:24,background:'#0f172a',fontFamily:'Inter,system-ui,sans-serif'}}><div style={{width:'min(460px,100%)',background:'#fff',borderRadius:22,padding:24,textAlign:'center'}}><h1 style={{margin:0,fontSize:22,color:'#0f172a'}}>Media no disponible</h1><p style={{margin:'10px 0 18px',color:'#64748b',lineHeight:1.5}}>{error||'Este enlace ya venció.'}</p><button type="button" onClick={closeViewer} style={buttonStyle}>Cerrar</button></div></main>

  const items=(Array.isArray(data.items)&&data.items.length?data.items:[{
    id:data.code,kind:data.kind,content_type:data.content_type,name:data.name,size_bytes:data.size_bytes,
    file_url:data.file_url,download_url:data.download_url,
  }]) as MediaItem[]
  const current=items[Math.min(index,items.length-1)]
  const isGallery=current.kind==='image'&&items.length>1
  const label=current.kind==='audio'?'Audio':current.kind==='image'?'Imagen':'Archivo'
  const prev=()=>setIndex(value=>(value-1+items.length)%items.length)
  const next=()=>setIndex(value=>(value+1)%items.length)
  const batchDownload=items.length>1&&data.download_batch_url?data.download_batch_url:current.download_url

  return <main style={{minHeight:'100vh',background:'#111827',fontFamily:'Inter,system-ui,sans-serif',color:'#fff',overflowX:'hidden'}}>
    <div style={{position:'sticky',top:0,zIndex:10,display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,padding:'12px 14px',background:'rgba(17,24,39,.94)',backdropFilter:'blur(12px)',borderBottom:'1px solid rgba(255,255,255,.08)'}}>
      <div style={{minWidth:0}}>
        <strong style={{display:'block',fontSize:14,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{isGallery?'Galería adjunta · '+String(index+1)+' de '+String(items.length):(current.name||'Media adjunto')}</strong>
        <span style={{display:'block',marginTop:2,fontSize:11.5,color:'#cbd5e1'}}>{label}{current.size_bytes?' · '+formatSize(current.size_bytes):''} · disponible por 3 días</span>
      </div>
      <div style={{display:'flex',gap:8,flexShrink:0}}>
        <a href={batchDownload} download style={{...iconButton,textDecoration:'none'}} aria-label={items.length>1?'Descargar paquete':'Descargar'} title={items.length>1?'Descargar paquete':'Descargar'}><FaDownload/></a>
        <button type="button" onClick={closeViewer} style={iconButton} aria-label="Cerrar"><FaTimes/></button>
      </div>
    </div>

    <div style={{minHeight:'calc(100vh - 70px)',display:'grid',placeItems:'center',padding:'18px 18px 92px',position:'relative'}}>
      {current.kind==='image'&&<img src={current.file_url} alt={current.name||'Imagen adjunta'} style={{display:'block',maxWidth:'100%',maxHeight:'calc(100vh - 125px)',objectFit:'contain',borderRadius:10}}/>}
      {current.kind==='audio'&&<div style={{width:'min(680px,100%)',background:'#1f2937',border:'1px solid rgba(255,255,255,.08)',borderRadius:22,padding:22}}><div style={{display:'grid',placeItems:'center',height:180,fontSize:48}}>🎙️</div><audio controls src={current.file_url} style={{width:'100%'}}/></div>}
      {current.kind==='document'&&<iframe title={current.name||'Archivo adjunto'} src={current.file_url} style={{width:'100%',height:'calc(100vh - 125px)',border:0,borderRadius:10,background:'#fff'}}/>}
      {isGallery&&<>
        <button type="button" onClick={prev} aria-label="Imagen anterior" style={{...galleryArrow,left:12}}><FaChevronLeft/></button>
        <button type="button" onClick={next} aria-label="Imagen siguiente" style={{...galleryArrow,right:12}}><FaChevronRight/></button>
        <div style={{position:'fixed',bottom:72,left:'50%',transform:'translateX(-50%)',display:'flex',gap:6,zIndex:5}}>
          {items.map((_,i)=><button key={i} type="button" aria-label={'Ir a imagen '+String(i+1)} onClick={()=>setIndex(i)} style={{border:0,padding:0,width:i===index?22:7,height:7,borderRadius:99,background:i===index?'#fff':'#64748b',cursor:'pointer'}}/>)}
        </div>
      </>}
    </div>

    <div style={{position:'fixed',left:0,right:0,bottom:0,display:'flex',justifyContent:'center',padding:'10px 14px calc(10px + env(safe-area-inset-bottom))',pointerEvents:'none'}}>
      <a href={batchDownload} download style={{...buttonStyle,textDecoration:'none',pointerEvents:'auto',display:'inline-flex',alignItems:'center',gap:8}}><FaDownload/>{items.length>1?'Descargar paquete':'Descargar'}</a>
    </div>
  </main>
}

const iconButton:CSSProperties={width:42,height:42,borderRadius:'50%',border:'1px solid rgba(255,255,255,.16)',background:'#1f2937',color:'#fff',display:'grid',placeItems:'center',cursor:'pointer',fontSize:16}
const buttonStyle:CSSProperties={border:0,borderRadius:14,padding:'12px 18px',background:'#2563eb',color:'#fff',fontWeight:800,cursor:'pointer',fontSize:14}
const galleryArrow:CSSProperties={position:'fixed',top:'50%',transform:'translateY(-50%)',width:44,height:44,borderRadius:'50%',border:'1px solid rgba(255,255,255,.2)',background:'rgba(15,23,42,.72)',color:'#fff',display:'grid',placeItems:'center',cursor:'pointer',zIndex:6}
