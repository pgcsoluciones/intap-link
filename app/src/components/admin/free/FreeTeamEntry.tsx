import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet } from '../../../lib/api'
import FreeTeamCorporate from './FreeTeamCorporate'

export default function FreeTeamEntry(){
  const navigate=useNavigate()
  const [ready,setReady]=useState(false)
  const [error,setError]=useState('')

  useEffect(()=>{
    let active=true
    const prepare=async()=>{
      const context:any=await apiGet('/me/team/admin-context').catch(()=>({ok:false}))
      if(!active)return
      if(!context?.ok){setError('No pudimos verificar tu acceso a Team.');return}
      const role=String(context.data?.role||'none')
      if(role==='member'){
        navigate('/admin/free/team/member',{replace:true})
        return
      }
      if(role==='none'){
        const created:any=await apiGet('/me/team').catch(()=>({ok:false}))
        if(!active)return
        if(!created?.ok){setError(created?.error||'No pudimos crear tu Team.');return}
      }
      if(active)setReady(true)
    }
    void prepare()
    return()=>{active=false}
  },[navigate])

  if(error)return <main className="min-h-screen bg-[#f7f9fc] font-['Inter'] text-slate-950"><div className="mx-auto w-full max-w-[760px] px-5 py-8"><div className="rounded-[24px] border border-rose-200 bg-rose-50 p-5 text-sm font-bold text-rose-700">{error}</div></div></main>
  if(!ready)return <main className="min-h-screen bg-[#f7f9fc] flex items-center justify-center"><div className="loading-spinner" /></main>
  return <FreeTeamCorporate/>
}
