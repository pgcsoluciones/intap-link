import { useEffect, useState, type CSSProperties } from 'react'
import { useParams } from 'react-router-dom'
import { FaDownload, FaTimes } from 'react-icons/fa'

type MediaMeta={
  code:string
  kind:'image'|'document'|'audio'
  content_type:string
  name:string
  size_bytes:number
  expires_at:string
  file_url:string
  download_url:string
}

function formatSize(bytes:number){
  if(!Number.isFinite(bytes)||bytes<=0)return''
  if(bytes<1024*1024)return String(Math.max(1,Math.round(bytes/1024)))+' KB'
  return (bytes/1024/1024).toFixed(1)+' MB'
}

export default function SponsoredQuoteMediaViewer(){
  const{code=''}=useParams()
  const[data,setData]=useState<MediaMeta|null>(null)
  const[loading,setLoading]=useState(true)
  const[error,setError]=useState('')

  useEffect(()=>{
    let alive=true
    ;(async()=>{
      setLoading(true);setError('')
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

  const fileUrl=data.file_url
  const label=data.kind==='audio'?'Audio':data.kind==='image'?'Imagen':'Archivo'
  return <main style={{minHeight:'100vh',background:'#111827',fontFamily:'Inter,system-ui,sans-serif',color:'#fff'}}>
    <div style={{position:'sticky',top:0,zIndex:10,display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,padding:'12px 14px',background:'rgba(17,24,39,.94)',backdropFilter:'blur(12px)',borderBottom:'1px solid rgba(255,255,255,.08)'}}>
      <div style={{minWidth:0}}>
        <strong style={{display:'block',fontSize:14,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{data.name||'Media adjunto'}</strong>
        <span style={{display:'block',marginTop:2,fontSize:11.5,color:'#cbd5e1'}}>{label}{data.size_bytes?' · '+formatSize(data.size_bytes):''} · disponible por 3 días</span>
      </div>
      <div style={{display:'flex',gap:8,flexShrink:0}}>
        <a href={data.download_url} download style={{...iconButton,textDecoration:'none'}} aria-label="Descargar"><FaDownload/></a>
        <button type="button" onClick={closeViewer} style={iconButton} aria-label="Cerrar"><FaTimes/></button>
      </div>
    </div>

    <div style={{minHeight:'calc(100vh - 70px)',display:'grid',placeItems:'center',padding:18}}>
      {data.kind==='image'&&<img src={fileUrl} alt={data.name||'Imagen adjunta'} style={{display:'block',maxWidth:'100%',maxHeight:'calc(100vh - 110px)',objectFit:'contain',borderRadius:10}}/>}
      {data.kind==='audio'&&<div style={{width:'min(680px,100%)',background:'#1f2937',border:'1px solid rgba(255,255,255,.08)',borderRadius:22,padding:22}}><div style={{display:'grid',placeItems:'center',height:180,fontSize:48}}>🎙️</div><audio controls src={fileUrl} style={{width:'100%'}}/></div>}
      {data.kind==='document'&&<iframe title={data.name||'Archivo adjunto'} src={fileUrl} style={{width:'100%',height:'calc(100vh - 110px)',border:0,borderRadius:10,background:'#fff'}}/>}
    </div>

    <div style={{position:'fixed',left:0,right:0,bottom:0,display:'flex',justifyContent:'center',padding:'10px 14px calc(10px + env(safe-area-inset-bottom))',pointerEvents:'none'}}>
      <a href={data.download_url} download style={{...buttonStyle,textDecoration:'none',pointerEvents:'auto',display:'inline-flex',alignItems:'center',gap:8}}><FaDownload/>Descargar</a>
    </div>
  </main>
}

const iconButton:CSSProperties={width:42,height:42,borderRadius:'50%',border:'1px solid rgba(255,255,255,.16)',background:'#1f2937',color:'#fff',display:'grid',placeItems:'center',cursor:'pointer',fontSize:16}
const buttonStyle:CSSProperties={border:0,borderRadius:14,padding:'12px 18px',background:'#2563eb',color:'#fff',fontWeight:800,cursor:'pointer',fontSize:14}
