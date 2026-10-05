import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { apiGet } from '../../lib/api'
import { activeFreeDemoDelegationId, clearFreeDemoDelegation } from '../../lib/freeDemoDelegation'

export default function FreeDemoDelegationBanner(){
  const location=useLocation()
  const demoId=activeFreeDemoDelegationId()
  const[info,setInfo]=useState<any>(null)

  useEffect(()=>{
    if(!demoId)return
    let alive=true
    apiGet('/superadmin/free-demo-v2/'+encodeURIComponent(demoId)+'/editor').then((j:any)=>{
      if(!alive)return
      if(j?.ok)setInfo(j.data)
      else{
        clearFreeDemoDelegation()
        window.location.replace('/superadmin/free-demos')
      }
    }).catch(()=>undefined)
    return()=>{alive=false}
  },[demoId,location.pathname])

  if(!demoId||!location.pathname.startsWith('/admin/free'))return null

  const slug=String(info?.profile?.slug||'')
  const web=(import.meta.env.VITE_WEB_URL??'https://intaprd.com').replace(/\/$/,'')
  const leave=()=>{clearFreeDemoDelegation();window.location.assign('/superadmin/free-demos')}

  return <div style={{position:'sticky',top:0,zIndex:9999,display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,padding:'9px 14px',background:'#071f5f',color:'#fff',fontFamily:'Inter,system-ui,sans-serif',boxShadow:'0 5px 20px rgba(15,23,42,.18)'}}>
    <div style={{minWidth:0}}>
      <strong style={{display:'block',fontSize:12,letterSpacing:.4}}>ADMINISTRACIÓN DEMO · SUPERADMIN</strong>
      <span style={{display:'block',marginTop:2,fontSize:11,opacity:.85,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{String(info?.profile?.name||'Perfil Free')}{slug?' · /'+slug:''} · panel Free real</span>
    </div>
    <div style={{display:'flex',gap:7,flexShrink:0}}>
      {slug&&Number(info?.profile?.is_published||0)===1&&<a href={web+'/'+slug} target="_blank" rel="noreferrer" style={{border:'1px solid rgba(255,255,255,.4)',borderRadius:10,padding:'7px 10px',color:'#fff',fontSize:11,fontWeight:900,textDecoration:'none'}}>Ver perfil</a>}
      <button type="button" onClick={leave} style={{border:0,borderRadius:10,padding:'7px 10px',background:'#fff',color:'#071f5f',fontSize:11,fontWeight:900,cursor:'pointer'}}>Volver a Demos Free</button>
    </div>
  </div>
}
