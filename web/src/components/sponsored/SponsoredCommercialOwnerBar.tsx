import { useEffect, useState, type CSSProperties } from 'react'

type Links={contact_url:string;contact_label:string;resource_url:string;resource_label:string}
type Props={username:string;apiOrigin:string}

function allowedLink(value:unknown):string{
 try{
  const url=new URL(String(value||'').trim())
  return url.protocol==='https:'&&!url.username&&!url.password?url.href:''
 }catch{return ''}
}

/** Private commercial tools, never part of the anonymous sponsored presentation. */
export default function SponsoredCommercialOwnerBar({username,apiOrigin}:Props){
 const[links,setLinks]=useState<Links|null>(null)
 useEffect(()=>{
  let mounted=true
  async function load(){
   try{
    const res=await fetch(apiOrigin.replace(/\/$/,'')+'/api/v1/me/sponsored-commercial-public-context?username='+encodeURIComponent(username),{credentials:'include',cache:'no-store'})
    const json:any=res.ok?await res.json():null
    const received=json?.ok?json.data:null
    if(mounted)setLinks(received?{
     contact_url:allowedLink(received.contact_url),
     contact_label:String(received.contact_label||'Mi representante'),
     resource_url:allowedLink(received.resource_url),
     resource_label:String(received.resource_label||'Catálogo')
    }:null)
   }catch{if(mounted)setLinks(null)}
  }
  setLinks(null)
  void load()
  const interval=window.setInterval(()=>void load(),30000)
  window.addEventListener('focus',load)
  return()=>{mounted=false;window.clearInterval(interval);window.removeEventListener('focus',load)}
 },[username,apiOrigin])
 if(!links||( !links.contact_url && !links.resource_url))return null
 return <nav aria-label="Herramientas comerciales privadas del patrocinador" style={{width:'100%',maxWidth:520,margin:'0 auto',boxSizing:'border-box',display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',padding:'10px 12px',background:'#ecfeff',borderBottom:'1px solid #a5f3fc',fontFamily:'Inter,system-ui,sans-serif'}}>
  <span style={{fontSize:11,fontWeight:800,color:'#155e75',flexBasis:'100%'}}>Mi patrocinador · Acceso privado</span>
  {links.contact_url&&<a href={links.contact_url} target="_blank" rel="noopener noreferrer" style={linkStyle}>{links.contact_label}</a>}
  {links.resource_url&&<a href={links.resource_url} target="_blank" rel="noopener noreferrer" style={linkStyle}>{links.resource_label}</a>}
 </nav>
}

const linkStyle:CSSProperties={display:'inline-flex',alignItems:'center',justifyContent:'center',borderRadius:999,padding:'9px 15px',background:'#fff',border:'1px solid #67e8f9',fontSize:12,fontWeight:800,color:'#155e75',textDecoration:'none',maxWidth:'100%'}
