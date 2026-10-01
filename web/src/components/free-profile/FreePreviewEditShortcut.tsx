import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export default function FreePreviewEditShortcut() {
  const [slot,setSlot]=useState<HTMLElement|null|undefined>(undefined)

  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  if (params.get('preview') !== '1') return null
  if (params.get('embedded') === '1') return null

  const appUrl = (import.meta.env.VITE_APP_URL || 'https://app.intaprd.com').replace(/\/$/, '')

  useEffect(()=>{
    const find=()=>setSlot(document.getElementById('free-preview-edit-slot'))
    find()
    const observer=new MutationObserver(find)
    observer.observe(document.body,{childList:true,subtree:true})
    return()=>observer.disconnect()
  },[])

  const link=(
    <a
      href={`${appUrl}/admin/free`}
      aria-label="Volver a editar mi perfil"
      style={{ display:'inline-flex',alignItems:'center',gap:6,minHeight:34,padding:'7px 10px',borderRadius:999,background:'#07111f',color:'#fff',fontFamily:'Inter, system-ui, sans-serif',fontSize:11.5,fontWeight:900,textDecoration:'none',boxShadow:'0 8px 18px rgba(15,23,42,.18)',border:'1px solid rgba(255,255,255,.18)',whiteSpace:'nowrap' }}
    >
      <span aria-hidden="true">←</span>
      <span>Volver a edición</span>
    </a>
  )

  if(slot===undefined)return null
  if(slot)return createPortal(link,slot)

  return (
    <div style={{ position:'fixed',top:14,left:12,right:12,zIndex:2147483000,display:'flex',justifyContent:'center',pointerEvents:'none' }}>
      <span style={{pointerEvents:'auto'}}>{link}</span>
    </div>
  )
}
