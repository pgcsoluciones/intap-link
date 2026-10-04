import { useEffect, useState } from 'react'
import { apiGet, apiPatch, apiPost } from '../../lib/api'
import SuperAdminLayout from './SuperAdminLayout'

type CatalogItem={key:string;label:string;hint:string;category:string}
type TemplateCode={id:string;preset_key:string;status:string;created_at?:string;expires_at?:string;used_at?:string;demo_id?:string|null;slug?:string|null;name?:string|null}

export default function SuperAdminFreeDemos(){
  const[catalog,setCatalog]=useState<CatalogItem[]>([])
  const[codes,setCodes]=useState<TemplateCode[]>([])
  const[demos,setDemos]=useState<any[]>([])
  const[message,setMessage]=useState('')
  const[generated,setGenerated]=useState<any>(null)
  const[claim,setClaim]=useState<any>(null)

  const load=async()=>{
    const[c,tc,d]=await Promise.all([
      apiGet('/superadmin/free-demo/catalog'),
      apiGet('/superadmin/free-demo/template-codes'),
      apiGet('/superadmin/free-demo/profiles'),
    ])
    if(c?.ok)setCatalog(c.data||[])
    if(tc?.ok)setCodes(tc.data||[])
    if(d?.ok)setDemos(d.data||[])
  }
  useEffect(()=>{void load()},[])

  const generateTemplateCode=async(item:CatalogItem)=>{
    setMessage('');setGenerated(null)
    const j:any=await apiPost('/superadmin/free-demo/catalog/'+encodeURIComponent(item.key)+'/code',{})
    if(j?.ok){setGenerated(j.data);await load()}
    else setMessage(j?.error||'No se pudo generar el código Demo.')
  }

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
          Mismo concepto de creación del Trial: eliges una plantilla base, generas un código Demo y ese código crea una copia independiente en borrador. Luego se edita y finalmente se publica con nombre y slug definitivos.
        </p>
      </header>

      {message&&<div className="rounded-2xl bg-cyan-50 p-4 text-sm font-bold text-cyan-800">{message}</div>}

      {generated&&<div className="rounded-3xl border border-cyan-300 bg-cyan-50 p-5">
        <p className="text-xs font-black uppercase tracking-[.12em] text-cyan-700">Código Demo generado</p>
        <h2 className="mt-1 text-xl font-black">{generated.preset_label}</h2>
        <p className="mt-3 font-mono text-2xl font-black tracking-wider">{generated.demo_code}</p>
        <p className="mt-2 text-sm text-slate-600">Úsalo con <strong>intapcard@gmail.com</strong>. Es de un solo uso y crea una copia borrador de esta plantilla.</p>
      </div>}

      {claim&&<div className="rounded-3xl border border-emerald-300 bg-emerald-50 p-5">
        <p className="text-xs font-black uppercase tracking-[.12em] text-emerald-700">Código de reclamo final</p>
        <h2 className="mt-1 font-black">Para entregar al propietario definitivo</h2>
        <p className="mt-2 text-sm">Correo: <strong>{claim.special_email}</strong></p>
        <p className="text-sm">Perfil: <strong>/{claim.slug}</strong></p>
        <p className="mt-3 font-mono text-2xl font-black tracking-widest">{claim.claim_code}</p>
        <p className="mt-2 text-xs text-slate-600">Es distinto al código Demo de creación. Es de un solo uso y expira en 30 días.</p>
      </div>}

      <section>
        <div className="mb-4">
          <h2 className="text-xl font-black">Plantillas base</h2>
          <p className="mt-1 text-sm text-slate-500">Funcionan como MASTER. No se editan directamente: cada código Demo genera una copia independiente en borrador.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {catalog.map(x=><article key={x.key} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-black">{x.label}</h3>
            <p className="mt-1 text-sm leading-5 text-slate-500">{x.hint}</p>
            <p className="mt-3 text-[11px] font-black uppercase tracking-wide text-cyan-700">{x.category}</p>
            <button onClick={()=>void generateTemplateCode(x)} className="mt-4 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white">Generar código Demo</button>
          </article>)}
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-xl font-black">Códigos Demo</h2>
          <p className="mt-1 text-sm text-slate-500">Trazabilidad de códigos creados desde las plantillas base.</p>
        </div>
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
          <div className="divide-y divide-slate-100">
            {codes.slice(0,20).map(code=>{
              const label=catalog.find(x=>x.key===code.preset_key)?.label||code.preset_key
              return <div key={code.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div><strong>{label}</strong><p className="mt-1 text-xs text-slate-500">{code.status}{code.name?' · '+code.name:''}{code.slug?' · /'+code.slug:''}</p></div>
                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">{code.status}</span>
              </div>
            })}
            {!codes.length&&<p className="p-6 text-sm text-slate-400">Aún no has generado códigos Demo.</p>}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div><h2 className="text-xl font-black">Borradores y Demos publicadas</h2><p className="mt-1 text-sm text-slate-500">El código Demo crea el borrador. La publicación define el nombre y slug definitivos.</p></div>
        {demos.map(d=><article key={d.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-black">{d.name||'Borrador Demo'}</h3>
              <p className="text-sm text-slate-500">{d.is_published?'/'+d.slug+' · ':''}{d.rubric||'Sin rubro'} · {d.status}</p>
              {d.public_code&&<p className="mt-1 text-xs font-bold text-slate-400">Artículo: {d.public_code}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              {Boolean(d.is_published)&&<a className="rounded-xl border px-3 py-2 text-sm font-bold" href={web+'/'+d.slug} target="_blank" rel="noreferrer">Ver perfil</a>}
              {d.status!=='claimed'&&Boolean(d.is_published)&&<button onClick={()=>void setPublished(d,false)} className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-black text-cyan-800">Volver a borrador</button>}
              {d.status!=='claimed'&&Boolean(d.is_published)&&<button onClick={()=>void createClaim(d.id)} className="rounded-xl bg-emerald-700 px-3 py-2 text-sm font-black text-white">Generar código de reclamo</button>}
            </div>
          </div>
        </article>)}
        {!demos.length&&<div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">Aún no existen borradores Demo.</div>}
      </section>
    </div>
  </SuperAdminLayout>
}
