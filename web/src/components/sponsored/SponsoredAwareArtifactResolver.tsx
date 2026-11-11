import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import ArtifactLinkResolver from '../ArtifactLinkResolver'

function appOrigin(){
  const host=window.location.hostname.toLowerCase()
  if(host==='preview.intaprd.com')return 'https://app.preview.intaprd.com'
  if(host==='intaprd.com'||host==='www.intaprd.com'||host==='link.intaprd.com')return 'https://app.intaprd.com'
  const configured=String(import.meta.env.VITE_APP_URL||'').replace(/\/$/,'')
  return configured||'https://app.intaprd.com'
}

type Status='loading'|'normal'|'sponsored'

export default function SponsoredAwareArtifactResolver(){
  const {publicCode=''}=useParams();const code=publicCode.trim().toUpperCase()
  const [status,setStatus]=useState<Status>('loading');const [payload,setPayload]=useState<any>(null);const [error,setError]=useState('')

  useEffect(()=>{let alive=true;(async()=>{if(!code){setError('Producto no válido.');setStatus('sponsored');return}try{const response=await fetch(`${appOrigin()}/api/v1/public/artifacts/scan/status`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({public_code:code})});const json:any=await response.json().catch(()=>({ok:false}));if(!alive)return;if(!response.ok||!json?.ok){setError(json?.error||'No pudimos comprobar este producto.');setStatus('sponsored');return}const state=String(json.state||'');if(!state.startsWith('sponsored_')){setStatus('normal');return}setPayload(json);setStatus('sponsored')}catch{if(alive){setError('No pudimos conectar con Kawvo.');setStatus('sponsored')}}})();return()=>{alive=false}},[code])

  useEffect(()=>{
    if(status!=='sponsored'||!payload)return
    if(payload.state==='sponsored_master_public'&&payload.next_url){window.location.replace(payload.next_url);return}
    if(payload.state==='sponsored_draft_owner'&&payload.next_url){/* owner chooses button below */}
  },[status,payload])

  if(status==='loading'||(status==='sponsored'&&payload?.state==='sponsored_master_public'))return <main style={{minHeight:'100vh',background:'#fff'}}/>
  if(status==='normal')return <ArtifactLinkResolver/>

  const sponsor=payload?.sponsor||{}
  // La identidad física se recibe del escaneo; no sustituye el código NFC permanente.
  const artifact=payload?.artifact||{}
  const physicalId=String(artifact.display_code||'').trim()
  const activationCode=String(artifact.public_code||code).trim()
  const typeLabels:Record<string,string>={keychain:'Llavero',card:'Tarjeta',stand:'Estación de contacto',bracelet:'Pulsera',ping:'Pin NFC',qr:'QR',other:'Producto'}
  const productLabel=typeLabels[String(artifact.product_type||'')]||String(artifact.label||'Producto')
  const card:React.CSSProperties={width:'100%',maxWidth:430,background:'#fff',border:'1px solid #e2e8f0',borderRadius:28,padding:28,textAlign:'center',boxShadow:'0 18px 55px rgba(15,23,42,.08)'}
  const primary:React.CSSProperties={width:'100%',border:0,borderRadius:16,padding:'15px 18px',background:'#0f172a',color:'#fff',fontSize:14,fontWeight:800,cursor:'pointer'}
  const secondary:React.CSSProperties={...primary,marginTop:10,background:'#fff',color:'#475569',border:'1px solid #e2e8f0'}

  const go=(url?:string)=>{if(url)window.location.assign(url)}
  return <main style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:24,background:'#f7f9fc',fontFamily:'Inter,system-ui,sans-serif'}}><section style={card}>
    {sponsor.logo_url?<img src={sponsor.logo_url} alt={sponsor.name||'Patrocinador'} style={{display:'block',maxWidth:180,maxHeight:70,objectFit:'contain',margin:'0 auto 18px'}}/>:<div style={{fontSize:12,fontWeight:900,letterSpacing:2,color:'#0891b2'}}>KAWVO LINK</div>}
    {error?<><h1 style={{fontSize:25,margin:'14px 0 8px'}}>No pudimos continuar</h1><p style={{color:'#64748b',lineHeight:1.6}}>{error}</p></>:
    payload?.state==='sponsored_pending_activation'?<>
      <h1 style={{fontSize:26,lineHeight:1.24,margin:'6px 0 10px'}}>Activa tu presentación digital</h1>
      <p style={{fontSize:14,color:'#64748b',lineHeight:1.55,margin:'0 0 20px'}}>Personaliza tu perfil profesional en pocos pasos.</p>
      <div aria-label="Identificación de estación patrocinada" style={{margin:'0 0 22px',padding:'16px 18px',border:'1px solid #bae6fd',borderRadius:18,background:'#f0f9ff',textAlign:'left',minWidth:0}}>
        <span style={{display:'block',fontSize:11,fontWeight:850,color:'#0369a1',textTransform:'uppercase',letterSpacing:.7}}>Identificación de estación · Kawvo Link</span>
        <strong style={{display:'block',marginTop:10,fontSize:22,color:'#0f172a',overflowWrap:'anywhere'}}>Estación {physicalId||'sin ID físico'}</strong>
        <div style={{marginTop:12,padding:'11px 12px',borderRadius:12,background:'#fff'}}>
          <span style={{display:'block',fontSize:11,fontWeight:800,color:'#64748b'}}>Código NFC/QR</span>
          <strong style={{display:'block',marginTop:5,fontSize:15,fontFamily:'monospace',color:'#0f172a',overflowWrap:'anywhere'}}>{activationCode}</strong>
        </div>
        <span style={{display:'block',marginTop:12,fontSize:12,fontWeight:850,color:'#0369a1',textTransform:'uppercase'}}>Producto patrocinado · {productLabel}</span>
        <span style={{display:'block',marginTop:8,fontSize:13,color:'#475569'}}>Lista para activar</span>
        <span style={{display:'block',marginTop:8,fontSize:12,color:'#475569'}}>Programa patrocinado: <strong>{sponsor.name||'Patrocinador'}</strong></span>
      </div>
      <button type="button" onClick={()=>go(payload.next_url)} style={primary}>Activar ahora</button>
      <button type="button" onClick={()=>window.location.assign('/')} style={secondary}>Activar después</button>
      <p style={{margin:'13px 0 0',fontSize:12,lineHeight:1.5,color:'#64748b'}}>Puedes activarlo más adelante volviendo a escanearlo.</p>
    </>:
    payload?.state==='sponsored_sponsor_inspection'?<>
      <h1 style={{fontSize:25,margin:'8px 0 10px'}}>Identificación del dispositivo</h1>
      <p style={{color:'#64748b',lineHeight:1.5,margin:'0 0 20px',fontSize:14}}>Producto de tu patrocinio · {payload.inspection_status==='activated'?'Activado':payload.inspection_status==='inactive'?'Inactivo':'Pendiente de activación'}</p>
      <div aria-label="Identificación privada de estación" style={{margin:'0 0 20px',padding:18,borderRadius:16,background:'#f0f9ff',border:'1px solid #bae6fd',textAlign:'left'}}>
        <span style={{display:'block',fontSize:12,fontWeight:800,color:'#0369a1'}}>Identificador físico</span>
        <strong style={{display:'block',marginTop:6,fontSize:24,color:'#0f172a'}}>{physicalId||'Sin ID físico'}</strong>
        <span style={{display:'block',marginTop:10,fontSize:14,fontWeight:700,color:'#334155'}}>{productLabel}</span>
        <span style={{display:'block',marginTop:6,fontSize:12,color:'#475569'}}>Código NFC/QR: <strong style={{fontFamily:'monospace'}}>{activationCode}</strong></span>
      </div>
      <button type="button" onClick={()=>go(payload.manage_url)} style={primary}>Administrar en mi panel</button>
      <button type="button" onClick={()=>window.location.assign('/')} style={secondary}>Salir</button>
      <p style={{margin:'12px 0 0',fontSize:12,color:'#64748b'}}>Esta inspección no activa ni reclama el dispositivo.</p>
    </>:
    payload?.state==='sponsored_master'?<><h1 style={{fontSize:26,margin:'8px 0'}}>Llavero Master</h1><p style={{color:'#64748b',lineHeight:1.6}}>{payload.message}</p><div style={{margin:'16px 0',padding:14,borderRadius:16,background:'#f8fafc',fontWeight:900}}>Código {code}</div><button type="button" onClick={()=>go(payload.manage_url)} style={primary}>Abrir panel de patrocinio</button></>:
    payload?.state==='sponsored_master_login'?<><h1 style={{fontSize:26,margin:'8px 0'}}>Llavero Master</h1><p style={{color:'#64748b',lineHeight:1.6}}>{payload.message}</p><div style={{margin:'16px 0',padding:14,borderRadius:16,background:'#f8fafc',fontWeight:900}}>Código {code}</div><button type="button" onClick={()=>go(payload.login_url)} style={primary}>Iniciar sesión como patrocinador</button></>:
    payload?.state==='sponsored_draft_owner'?<><h1 style={{fontSize:26,margin:'8px 0'}}>Tu presentación está en construcción</h1><p style={{color:'#64748b',lineHeight:1.6}}>Personaliza tu presentación y coloca tus datos reales antes de publicarla.</p><button type="button" onClick={()=>go(payload.next_url)} style={primary}>Seguir configurando</button></>:
    payload?.state==='sponsored_draft'?<><h1 style={{fontSize:26,margin:'8px 0'}}>Presentación en construcción</h1><p style={{color:'#64748b',lineHeight:1.6}}>Este perfil todavía no está publicado.</p><button type="button" onClick={()=>go(payload.login_url)} style={primary}>Soy dueño de este perfil</button></>:
    <><h1 style={{fontSize:25,margin:'8px 0'}}>Producto patrocinado</h1><p style={{color:'#64748b',lineHeight:1.6}}>{payload?.message||'Este producto no está disponible en este momento.'}</p>{payload?.login_url&&<button type="button" onClick={()=>go(payload.login_url)} style={secondary}>Iniciar sesión</button>}</>}
    <div style={{marginTop:24,fontSize:11,color:'#94a3b8'}}>Desarrollado por <strong style={{color:'#0891b2'}}>KawLink</strong></div>
  </section></main>
}
