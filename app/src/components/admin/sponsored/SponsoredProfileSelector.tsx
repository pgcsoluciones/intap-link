import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet } from '../../../lib/api'

type SponsoredProfileItem={
  id:string
  sponsor_id:string
  artifact_id?:string|null
  username?:string|null
  business_name?:string|null
  status?:string|null
  sponsor_name?:string|null
  public_code?:string|null
  product_type?:string|null
}

export default function SponsoredProfileSelector(){
  const navigate=useNavigate()
  const[items,setItems]=useState<SponsoredProfileItem[]>([])
  const[loading,setLoading]=useState(true)
  const[error,setError]=useState('')

  useEffect(()=>{let alive=true;(async()=>{
    try{
      const json:any=await apiGet('/me/sponsored-profiles')
      if(!alive)return
      if(!json?.ok)throw new Error(json?.error||'No pudimos cargar tus perfiles.')
      const profiles=Array.isArray(json.data?.profiles)?json.data.profiles:[]
      if(profiles.length===1){
        navigate(`/admin/sponsored?profile_id=${encodeURIComponent(String(profiles[0].id))}`,{replace:true})
        return
      }
      setItems(profiles)
    }catch(e){
      if(alive)setError(e instanceof Error?e.message:'No pudimos cargar tus perfiles.')
    }finally{
      if(alive)setLoading(false)
    }
  })();return()=>{alive=false}},[navigate])

  return <main className="min-h-screen bg-[#f7f9fc] px-4 py-8 font-['Inter'] text-slate-950">
    <section className="mx-auto w-full max-w-[820px]">
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_rgba(15,23,42,.06)]">
        <p className="text-[11px] font-black uppercase tracking-[.14em] text-cyan-700">Perfiles patrocinados</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-.04em]">Selecciona el perfil que deseas administrar</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Cada perfil conserva su patrocinador, código, enlace público y configuración de forma independiente.</p>
      </div>

      {loading&&<div className="mt-5 rounded-[24px] border border-slate-200 bg-white p-6 text-sm font-semibold text-slate-500">Cargando perfiles…</div>}
      {error&&<div className="mt-5 rounded-[24px] border border-rose-200 bg-rose-50 p-5 text-sm font-bold text-rose-700">{error}</div>}
      {!loading&&!error&&items.length===0&&<div className="mt-5 rounded-[24px] border border-slate-200 bg-white p-6 text-sm text-slate-500">No encontramos perfiles patrocinados asociados a esta cuenta.</div>}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {items.map(item=>{
          const title=String(item.business_name||item.username||'Perfil patrocinado')
          const username=String(item.username||'')
          const status=String(item.status||'draft')
          return <article key={item.id} className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,.04)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-xl font-black">{title}</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">{item.sponsor_name||'Patrocinador'}</p>
              </div>
              <span className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-black ${status==='published'?'bg-emerald-50 text-emerald-700':'bg-amber-50 text-amber-700'}`}>{status==='published'?'Publicado':'Borrador'}</span>
            </div>
            <div className="mt-4 space-y-2 rounded-2xl bg-slate-50 p-4 text-xs">
              {username&&<p><span className="font-bold text-slate-400">Usuario:</span> <strong>/p/{username}</strong></p>}
              {item.public_code&&<p><span className="font-bold text-slate-400">Código:</span> <strong>{item.public_code}</strong></p>}
            </div>
            <button type="button" onClick={()=>navigate(`/admin/sponsored?profile_id=${encodeURIComponent(item.id)}`)} className="mt-4 w-full rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-black text-white">Administrar perfil</button>
          </article>
        })}
      </div>
    </section>
  </main>
}
