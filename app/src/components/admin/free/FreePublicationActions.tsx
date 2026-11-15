import { useRef, useState } from 'react'
import { apiPost, apiPut } from '../../../lib/api'
import type { FreePublicationReadiness } from './FreeFirstRunGuide'

/** One existing publication mutation shared by the original and unified panel. */
export async function submitFreePublication(next:boolean){
  const result:any=await apiPut('/me/profile',{is_published:next})
  if(result?.ok&&next)void apiPost('/me/notifications/profile-published',{}).catch(()=>undefined)
  return result
}

type Props={
  published:boolean
  canPublish:boolean
  onSaved:(next:boolean)=>void
  onIncomplete:(readiness:FreePublicationReadiness)=>void
}
export default function FreePublicationActions({published,canPublish,onSaved,onIncomplete}:Props){
  const pending=useRef(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const change=async()=>{
    if(pending.current||(!published&&!canPublish))return
    const next=!published
    pending.current=true
    setBusy(true)
    setError('')
    try{
      const result=await submitFreePublication(next)
      if(result?.ok)onSaved(next)
      else if(result?.error==='profile_incomplete'){
        if(result.readiness)onIncomplete(result.readiness)
        setError(result.message||'Completa los datos mínimos antes de publicar.')
      }else setError(result?.error||'No pudimos cambiar el estado de publicación.')
    }catch{setError('No pudimos confirmar el cambio. Inténtalo de nuevo.')}
    finally{pending.current=false;setBusy(false)}
  }
  if(!published&&!canPublish&&!error&&!busy)return null
  return <div className="mt-3">
    <button type="button" disabled={busy||(!published&&!canPublish)} onClick={()=>void change()} className={'min-h-12 w-full rounded-xl px-4 text-sm font-bold disabled:opacity-50 '+(published?'border border-slate-200 bg-white text-slate-700':'bg-cyan-700 text-white')}>
      {busy?'Guardando…':published?'Ocultar presentación':'Publicar presentación'}
    </button>
    {error&&<p role="alert" className="mt-2 break-words text-sm text-rose-700">{error}</p>}
  </div>
}
