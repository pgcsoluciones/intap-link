import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

type Slots={desktop:HTMLElement|null;mobile:HTMLElement|null}

export default function FreePreviewEditShortcut() {
  const [slots,setSlots]=useState<Slots>({desktop:null,mobile:null})
  const params=typeof window==='undefined'?new URLSearchParams():new URLSearchParams(window.location.search)
  const isPreview=params.get('preview')==='1'&&params.get('embedded')!=='1'
  const appUrl=(import.meta.env.VITE_APP_URL||'https://app.intaprd.com').replace(/\/$/,'')

  useEffect(()=>{
    if(!isPreview)return
    const find=()=>{
      const desktop=document.getElementById('free-preview-edit-slot')
      const mobile=document.getElementById('free-preview-edit-mobile-slot')
      setSlots(previous=>previous.desktop===desktop&&previous.mobile===mobile?previous:{desktop,mobile})
    }
    find()
    const observer=new MutationObserver(find)
    observer.observe(document.body,{childList:true,subtree:true})
    return()=>observer.disconnect()
  },[isPreview])

  if(!isPreview)return null

  const link=(
    <a
      href={`${appUrl}/admin/free`}
      aria-label="Volver a edición del perfil"
      style={{display:'inline-flex',alignItems:'center',gap:6,minHeight:34,padding:'7px 10px',borderRadius:999,background:'#07111f',color:'#fff',fontFamily:'Inter, system-ui, sans-serif',fontSize:11.5,fontWeight:900,textDecoration:'none',whiteSpace:'nowrap'}}
    >
      <span aria-hidden="true">←</span>
      <span>Volver a edición</span>
    </a>
  )

  // Only render inside the shared owner bar. Never place a fixed overlay above it.
  return <>
    {slots.desktop&&createPortal(link,slots.desktop,'free-preview-desktop')}
    {slots.mobile&&createPortal(link,slots.mobile,'free-preview-mobile')}
  </>
}
