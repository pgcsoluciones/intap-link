import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPatch, apiPost } from '../../../lib/api'

type DemoRow={
  id:string;status:string;rubric?:string;created_from?:string;slug:string;name?:string;bio?:string;
  category?:string;subcategory?:string;is_published?:number;published_at?:string|null;avatar_url?:string;hero_url?:string;public_code?:string|null
}

export default function FreeDemoManager(){
  const navigate=useNavigate()
  const[rows,setRows]=useState<DemoRow[]>([])
  const[message,setMessage]=useState('')
  const[busy,setBusy]=useState(false)
  const[demoCode,setDemoCode]=useState('')
  const[finalize,setFinalize]=useState<{id:string;name:string;slug:string}|null>(null)

  const load=async()=>{
    const d=await apiGet('/me/free-demos')
    if(d?.ok)setRows(d.data||[])
    else setMessage(d?.error||'No tienes acceso a este módulo.')
  }
  useEffect(()=>{void load()},[])

  const redeem=async(e:React.FormEvent)=>{
    e.preventDefault()
    if(!demoCode.trim())return
    setBusy(true);setMessage('')
    try{
      const j:any=await apiPost('/me/free-demos/redeem-code',{code:demoCode.trim()})
      if(!j?.ok){setMessage(j?.error||'No se pudo activar el código Demo.');return}
      setDemoCode('')
      navigate('/admin/free/demos/edit/'+encodeURIComponent(j.data.demo_id))
    }finally{setBusy(false)}
  }

  const publish=async()=>{
    if(!finalize)return
    setBusy(true);setMessage('')
    try{
      const j:any=await apiPost('/me/free-demos/'+encodeURIComponent(finalize.id)+'/publish',{name:finalize.name,slug:finalize.slug})
      if(j?.ok){setFinalize(null);setMessage('Presentación publicada correctamente.');await load()}
      else setMessage(j?.error||'No se pudo publicar la presentación.')
    }finally{setBusy(false)}
  }

  const setPublished=async(row:DemoRow,published:boolean)=>{
    setBusy(true);setMessage('')
    try{
      const j:any=await apiPatch('/me/free-demos/'+encodeURIComponent(row.id),{is_published:published})
      if(j?.ok){setMessage(published?'Demo publicada.':'Demo devuelta a borrador.');await load()}
      else setMessage(j?.error||'No se pudo actualizar.')
    }finally{setBusy(false)}
  }

  const web=(import.meta.env.VITE_WEB_URL||'https://intaprd.com').replace(/\/$/,'')

  return <main className="min-h-screen bg-[#f7f9fc] p-5 text-slate-950">
    <section className="mx-auto max-w-6xl">
      <header className="mb-6">
        <p className="text-xs font-black uppercase tracking-[.2em] text-cyan-700">KAWVO LINK</p>
        <h1 className="mt-2 text-3xl font-black">Mis Demos Free</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          El flujo replica el concepto aprobado del Trial: un código Demo clona una plantilla base en un borrador independiente. Editas ese borrador en el panel Free real y al finalizar defines nombre y slug para publicarlo.
        </p>
      </header>

      {message&&<div className="mb-5 rounded-2xl bg-cyan-50 p-4 text-sm font-bold text-cyan-800">{message}</div>}

      <form onSubmit={redeem} className="mb-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[.15em] text-cyan-700">Crear borrador desde plantilla</p>
        <h2 className="mt-1 text-xl font-black">Usar código Demo</h2>
        <p className="mt-1 text-sm text-slate-500">El código ya viene asociado al rubro elegido en SuperAdmin. No tienes que escoger plantilla, nombre ni slug todavía.</p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <input className="min-w-0 flex-1 rounded-2xl border border-slate-300 p-3 font-mono uppercase tracking-wider" placeholder="DMO-XXXX-XXXX-XXXX" value={demoCode} onChange={e=>setDemoCode(e.target.value.toUpperCase())}/>
          <button disabled={busy||!demoCode.trim()} className="rounded-2xl bg-slate-950 px-5 py-3 font-black text-white disabled:opacity-40">Crear borrador y editar</button>
        </div>
      </form>

      <div className="mb-4">
        <h2 className="text-xl font-black">Borradores y presentaciones</h2>
        <p className="mt-1 text-sm text-slate-500">Cada borrador es una copia independiente de la plantilla MASTER correspondiente.</p>
      </div>

      <div className="space-y-4">
        {rows.map(row=><article key={row.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="grid md:grid-cols-[180px_1fr]">
            <div className="min-h-[160px] bg-slate-100">
              {row.hero_url?<img src={row.hero_url} alt="" className="h-full w-full object-cover"/>:<div className="flex h-full items-center justify-center text-xs font-bold text-slate-400">Sin portada</div>}
            </div>
            <div className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black">{row.name||'Borrador Demo'}</h3>
                  <p className="mt-1 text-sm text-slate-500">{row.rubric||row.subcategory||row.category||'Demo'} · {row.status}</p>
                  {Boolean(row.is_published)&&<p className="mt-1 text-sm font-bold text-cyan-700">/{row.slug}</p>}
                </div>
                <span className={"rounded-full px-3 py-1.5 text-xs font-black "+(row.is_published?'bg-emerald-50 text-emerald-700':'bg-amber-50 text-amber-700')}>{row.is_published?'Publicado':'Borrador'}</span>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {row.status!=='claimed'&&<button disabled={busy} onClick={()=>navigate('/admin/free/demos/edit/'+encodeURIComponent(row.id))} className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-40">Editar borrador</button>}
                {!row.published_at&&<button disabled={busy} onClick={()=>setFinalize({id:row.id,name:row.name&& !row.name.startsWith('Demo ')?row.name:'',slug:''})} className="rounded-xl bg-cyan-700 px-4 py-3 text-sm font-black text-white disabled:opacity-40">Finalizar y publicar</button>}
                {Boolean(row.published_at)&&!row.is_published&&<button disabled={busy} onClick={()=>void setPublished(row,true)} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800">Volver a publicar</button>}
                {Boolean(row.is_published)&&<button disabled={busy} onClick={()=>void setPublished(row,false)} className="rounded-xl border px-4 py-3 text-sm font-bold">Volver a borrador</button>}
                {Boolean(row.is_published)&&<a href={web+'/'+row.slug} target="_blank" rel="noreferrer" className="rounded-xl border px-4 py-3 text-sm font-bold">Ver presentación</a>}
              </div>
            </div>
          </div>
        </article>)}
        {!rows.length&&<div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">Todavía no hay borradores Demo. Usa un código Demo para crear el primero.</div>}
      </div>
    </section>

    {finalize&&<div className="fixed inset-0 z-[1200] grid place-items-center bg-slate-950/50 p-4" onMouseDown={e=>{if(e.target===e.currentTarget)setFinalize(null)}}>
      <section className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
        <p className="text-xs font-black uppercase tracking-[.15em] text-cyan-700">Finalizar Demo</p>
        <h2 className="mt-1 text-2xl font-black">Publicar presentación</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">Igual que en Trial, el borrador se personaliza primero. El nombre y el slug definitivos se fijan al publicar por primera vez.</p>
        <label className="mt-5 block text-sm font-black">Nombre final
          <input className="mt-2 w-full rounded-2xl border border-slate-300 p-3 font-medium" value={finalize.name} onChange={e=>setFinalize({...finalize,name:e.target.value})} placeholder="Ej. Serigrafía Moreno"/>
        </label>
        <label className="mt-4 block text-sm font-black">Slug definitivo
          <div className="mt-2 flex items-center rounded-2xl border border-slate-300 bg-white px-3">
            <span className="text-sm text-slate-400">intaprd.com/</span>
            <input className="min-w-0 flex-1 p-3 outline-none" value={finalize.slug} onChange={e=>setFinalize({...finalize,slug:e.target.value})} placeholder="serigrafia-moreno"/>
          </div>
        </label>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={()=>setFinalize(null)} className="rounded-xl border px-4 py-2.5 text-sm font-black">Cancelar</button>
          <button disabled={busy||!finalize.name.trim()||!finalize.slug.trim()} onClick={()=>void publish()} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white disabled:opacity-40">Publicar presentación</button>
        </div>
      </section>
    </div>}
  </main>
}
