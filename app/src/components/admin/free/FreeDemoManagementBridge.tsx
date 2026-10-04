import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../../../lib/api'

export default function FreeDemoManagementBridge(){
  const[ctx,setCtx]=useState<any>(null)
  const[busy,setBusy]=useState(false)

  useEffect(()=>{
    let alive=true
    apiGet('/me/free-demo-management/context').then((j:any)=>{if(alive&&j?.ok&&j?.active)setCtx(j.data)}).catch(()=>undefined)
    return()=>{alive=false}
  },[])

  if(!ctx)return null

  const back=async()=>{
    setBusy(true)
    try{
      const j:any=await apiPost('/me/free-demo-management/return',{})
      if(j?.ok)window.location.assign(j.data?.next_url||'/admin/free/demos')
    }finally{setBusy(false)}
  }

  return <div className="fixed left-0 right-0 top-0 z-[1000] border-b border-cyan-200 bg-cyan-50/95 px-4 py-2 shadow-sm backdrop-blur">
    <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
      <div className="min-w-0">
        <strong className="block truncate text-sm text-slate-950">Editando Demo: {ctx.name||ctx.slug}</strong>
        <span className="block truncate text-xs font-semibold text-cyan-800">/{ctx.slug} · Panel Free real · cuenta gestora protegida</span>
      </div>
      <button disabled={busy} onClick={()=>void back()} className="shrink-0 rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white disabled:opacity-50">{busy?'Saliendo…':'Volver a Mis Demos'}</button>
    </div>
  </div>
}
