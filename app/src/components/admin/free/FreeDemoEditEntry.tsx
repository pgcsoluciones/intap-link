import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiPost } from '../../../lib/api'

const openingDemoIds=new Set<string>()

export default function FreeDemoEditEntry(){
  const { id='' }=useParams()
  const navigate=useNavigate()
  const[error,setError]=useState('')

  useEffect(()=>{
    if(!id||openingDemoIds.has(id))return
    openingDemoIds.add(id)
    ;(async()=>{
      const j:any=await apiPost('/me/free-demos/'+encodeURIComponent(id)+'/open',{})
      if(j?.ok){
        window.location.replace(j.data?.next_url||'/admin/free')
        return
      }
      openingDemoIds.delete(id)
      setError(j?.error||'No se pudo abrir el borrador Demo.')
    })().catch(()=>{
      openingDemoIds.delete(id)
      setError('No se pudo abrir el borrador Demo.')
    })
  },[id])

  return <main className="min-h-screen bg-[#f7f9fc] p-5 text-slate-950">
    <section className="mx-auto mt-24 max-w-lg rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-sm">
      {!error?<><div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-cyan-600"/><h1 className="mt-4 text-xl font-black">Abriendo borrador Demo…</h1><p className="mt-2 text-sm text-slate-500">Preparando el panel Free real para esta copia independiente.</p></>:<>
        <h1 className="text-xl font-black">No pudimos abrir esta Demo</h1>
        <p className="mt-2 text-sm text-slate-500">{error}</p>
        <button onClick={()=>navigate('/admin/free/demos',{replace:true})} className="mt-5 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white">Volver a Mis Demos</button>
      </>}
    </section>
  </main>
}
