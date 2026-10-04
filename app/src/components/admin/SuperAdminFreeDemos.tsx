import { useEffect, useState } from 'react'
import { apiGet, apiPatch, apiPost } from '../../lib/api'
import SuperAdminLayout from './SuperAdminLayout'

type CatalogItem={key:string;label:string;hint:string;category:string}

export default function SuperAdminFreeDemos(){
  const[catalog,setCatalog]=useState<CatalogItem[]>([])
  const[demos,setDemos]=useState<any[]>([])
  const[message,setMessage]=useState('')
  const[claim,setClaim]=useState<any>(null)

  const load=async()=>{
    const[c,d]=await Promise.all([apiGet('/superadmin/free-demo/catalog'),apiGet('/superadmin/free-demo/profiles')])
    if(c?.ok)setCatalog(c.data||[])
    if(d?.ok)setDemos(d.data||[])
  }
  useEffect(()=>{void load()},[])

  const setPublished=async(row:any,published:boolean)=>{
    setMessage('')
    const j:any=await apiPatch('/superadmin/free-demo/profiles/'+encodeURIComponent(row.id),{is_published:published})
    if(j?.ok){setMessage(published?'Demo publicada.':'Demo devuelta a borrador.');await load()}
    else setMessage(j?.error||'No se pudo actualizar la Demo.')
  }

  const createClaim=async(id:string)=>{
    setMessage('');setClaim(null)
    const j:any=await apiPost('/superadmin/free-demo/profiles/'+encodeURIComponent(id)+'/claim-code',{})
    if(j?.ok)setClaim(j.data)
    else setMessage(j?.error||'No se pudo generar el código de reclamo.')
  }

  const web=(import.meta.env.VITE_WEB_URL||'https://intaprd.com').replace(/\/$/,'')

  return <SuperAdminLayout currentSection="freeDemos">
    <div className="mx-auto max-w-6xl space-y-8 text-slate-900">
      <header>
        <p className="text-xs font-black uppercase tracking-[.2em] text-cyan-700">KAWVO LINK</p>
        <h1 className="mt-2 text-3xl font-black">Demos Free</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Catálogo precargado de rubros y control administrativo de los perfiles Demo creados por la cuenta especial. Las Demos usan el perfil Free vigente; no usan Trial.
        </p>
      </header>

      {message&&<div className="rounded-2xl bg-cyan-50 p-4 text-sm font-bold text-cyan-800">{message}</div>}
      {claim&&<div className="rounded-3xl border border-emerald-300 bg-emerald-50 p-5">
        <h2 className="font-black">Código de reclamo listo para entregar</h2>
        <p className="mt-2 text-sm">Correo: <strong>{claim.special_email}</strong></p>
        <p className="text-sm">Perfil: <strong>/{claim.slug}</strong></p>
        <p className="mt-3 font-mono text-2xl font-black tracking-widest">{claim.claim_code}</p>
        <p className="mt-2 text-xs text-slate-600">Un solo uso · expira en 30 días.</p>
      </div>}

      <section>
        <div className="mb-4"><h2 className="text-xl font-black">Plantillas precargadas</h2><p className="mt-1 text-sm text-slate-500">Estas son las bases aprobadas disponibles para crear una Demo desde intapcard@gmail.com.</p></div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {catalog.map(x=><article key={x.key} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-black">{x.label}</h3>
            <p className="mt-1 text-sm leading-5 text-slate-500">{x.hint}</p>
            <p className="mt-3 text-[11px] font-black uppercase tracking-wide text-cyan-700">{x.category}</p>
          </article>)}
        </div>
      </section>

      <section className="space-y-4">
        <div><h2 className="text-xl font-black">Demos generadas</h2><p className="mt-1 text-sm text-slate-500">Desde aquí controlas publicación y reclamo. La edición completa se realiza entrando al panel Free desde la cuenta especial.</p></div>
        {demos.map(d=><article key={d.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-black">{d.name||d.slug}</h3>
              <p className="text-sm text-slate-500">/{d.slug} · {d.rubric||'Sin rubro'} · {d.status} · {d.created_from}</p>
              {d.public_code&&<p className="mt-1 text-xs font-bold text-slate-400">Artículo: {d.public_code}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <a className="rounded-xl border px-3 py-2 text-sm font-bold" href={web+'/'+d.slug} target="_blank" rel="noreferrer">Ver perfil</a>
              {d.status!=='claimed'&&<button onClick={()=>void setPublished(d,!d.is_published)} className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-black text-cyan-800">{d.is_published?'Volver a borrador':'Publicar'}</button>}
              {d.status!=='claimed'&&<button onClick={()=>void createClaim(d.id)} className="rounded-xl bg-emerald-700 px-3 py-2 text-sm font-black text-white">Generar código de reclamo</button>}
            </div>
          </div>
        </article>)}
        {!demos.length&&<div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">Aún no hay Demos Free creadas.</div>}
      </section>
    </div>
  </SuperAdminLayout>
}
