import { useRef, useState } from 'react'
import { apiPost } from '../../../lib/api'
import { clearFreeDemoDelegation, isFreeDemoDelegationActive } from '../../../lib/freeDemoDelegation'

/** Explicit user action only. Reuse the existing Free Account logout endpoint and demo exit. */
export default function FreeShellSessionExit(){
  const pending=useRef(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const delegatedDemo=isFreeDemoDelegationActive()
  const handleExit=async()=>{
    if(pending.current)return
    pending.current=true
    setBusy(true)
    setError('')
    try{
      if(isFreeDemoDelegationActive()){
        clearFreeDemoDelegation()
        window.location.assign('/superadmin/free-demos')
        return
      }
      const result=await apiPost<{ok?:boolean}>('/auth/logout',{})
      if(result?.ok!==true)throw new Error('logout_not_confirmed')
      window.location.replace('/admin/login')
    }catch{
      pending.current=false
      setBusy(false)
      setError('No pudimos confirmar la salida. Inténtalo de nuevo.')
    }
  }
  return <div className="min-w-0">
    <button type="button" disabled={busy} onClick={()=>void handleExit()} className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-700 disabled:opacity-60">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0"><path d="M10 4H5v16h5M13 8l4 4-4 4M8 12h9"/></svg>
      <span>{busy?'Saliendo…':delegatedDemo?'Volver a Demos Free':'Cerrar sesión'}</span>
    </button>
    {error&&<p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
  </div>
}
