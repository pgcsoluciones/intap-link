import { useEffect, useState } from 'react'
import { apiGet, apiPatch, apiPost } from '../../../lib/api'

type CatalogItem={key:string;label:string;hint:string;category:string}
type DemoRow={
  id:string;status:string;rubric?:string;created_from?:string;slug:string;name?:string;bio?:string;
  category?:string;subcategory?:string;is_published?:number;avatar_url?:string;hero_url?:string;public_code?:string|null
}

export default function FreeDemoManager(){
  const[catalog,setCatalog]=useState<CatalogItem[]>([])
  const[rows,setRows]=useState<DemoRow[]>([])
  const[message,setMessage]=useState('')
  const[busy,setBusy]=useState(false)
  const[newDemo,setNewDemo]=useState({preset_key:'hardware',name:'',slug:''})
  const[applyPreset,setApplyPreset]=useState<Record<string,string>>({})

  const load=async()=>{
    const[c,d]=await Promise.all([apiGet('/me/free-demos/catalog'),apiGet('/me/free-demos')])
    if(c?.ok)setCatalog(c.data||[])
    if(d?.ok)setRows(d.data||[])
    else setMessage(d?.error||'No tienes acceso a este módulo.')
  }
  useEffect(()=>{void load()},[])

  const createDemo=async(e:React.FormEvent)=>{
    e.preventDefault();setMessage('');setBusy(true)
    try{
      const j:any=await apiPost('/me/free-demos',newDemo)
      if(j?.ok){setMessage('Demo creada en borrador. Ya puedes entrar al panel Free y personalizarla.');setNewDemo({...newDemo,name:'',slug:''});await load()}
      else setMessage(j?.error||'No se pudo crear la Demo.')
    }finally{setBusy(false)}
  }

  const applyTemplate=async(row:DemoRow)=>{
    const key=applyPreset[row.id]||''
    if(!key)return
    setBusy(true);setMessage('')
    try{
      const j:any=await apiPost('/me/free-demos/'+encodeURIComponent(row.id)+'/apply-preset',{preset_key:key,name:row.name,slug:row.slug})
      if(j?.ok){setMessage('Plantilla precargada aplicada. La Demo volvió a borrador para que puedas revisarla.');await load()}
      else setMessage(j?.error||'No se pudo aplicar la plantilla.')
    }finally{setBusy(false)}
  }

  const openPanel=async(row:DemoRow)=>{
    setBusy(true);setMessage('')
    try{
      const j:any=await apiPost('/me/free-demos/'+encodeURIComponent(row.id)+'/open',{})
      if(j?.ok)window.location.assign(j.data?.next_url||'/admin/free')
      else setMessage(j?.error||'No se pudo abrir el panel Free de esta Demo.')
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
        <h1 className="mt-2 text-3xl font-black">Mis perfiles Demo Free</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Crea una presentación desde una plantilla precargada del rubro y luego entra al panel Free real para cambiar nombre, slug, imágenes, portafolio, horario, cotización, agenda y los demás módulos Free realmente disponibles.
        </p>
      </header>

      {message&&<div className="mb-5 rounded-2xl bg-cyan-50 p-4 text-sm font-bold text-cyan-800">{message}</div>}

      <form onSubmit={createDemo} className="mb-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[.15em] text-cyan-700">Nueva Demo</p>
            <h2 className="mt-1 text-xl font-black">Crear desde plantilla precargada</h2>
            <p className="mt-1 text-sm text-slate-500">Las imágenes y textos iniciales vienen del banco Free aprobado para ese rubro y respetan exactamente los mismos módulos y límites del perfil Free.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <select className="rounded-2xl border border-slate-300 bg-white p-3" value={newDemo.preset_key} onChange={e=>setNewDemo({...newDemo,preset_key:e.target.value})}>
            {catalog.map(x=><option key={x.key} value={x.key}>{x.label}</option>)}
          </select>
          <input className="rounded-2xl border border-slate-300 p-3" placeholder="Nombre del negocio / profesional" value={newDemo.name} onChange={e=>setNewDemo({...newDemo,name:e.target.value})}/>
          <input className="rounded-2xl border border-slate-300 p-3" placeholder="slug-ejemplo" value={newDemo.slug} onChange={e=>setNewDemo({...newDemo,slug:e.target.value})}/>
        </div>
        <div className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
          {catalog.find(x=>x.key===newDemo.preset_key)?.hint||'Selecciona el rubro que más se parezca al negocio.'}
        </div>
        <button disabled={busy||!newDemo.name.trim()||!newDemo.slug.trim()} className="mt-4 rounded-2xl bg-slate-950 px-5 py-3 font-black text-white disabled:opacity-40">Crear Demo</button>
      </form>

      <div className="space-y-4">
        {rows.map(row=><article key={row.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="grid md:grid-cols-[180px_1fr]">
            <div className="min-h-[160px] bg-slate-100">
              {row.hero_url?<img src={row.hero_url} alt="" className="h-full w-full object-cover"/>:<div className="flex h-full items-center justify-center text-xs font-bold text-slate-400">Sin portada</div>}
            </div>
            <div className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black">{row.name||row.slug}</h2>
                  <p className="mt-1 text-sm text-slate-500">/{row.slug} · {row.rubric||row.subcategory||row.category||'Demo'} · {row.status}</p>
                  {row.public_code&&<p className="mt-1 text-xs font-bold text-slate-400">Artículo: {row.public_code}</p>}
                </div>
                <span className={"rounded-full px-3 py-1.5 text-xs font-black "+(row.is_published?'bg-emerald-50 text-emerald-700':'bg-amber-50 text-amber-700')}>{row.is_published?'Publicado':'Borrador'}</span>
              </div>

              <div className="mt-5 grid gap-2 lg:grid-cols-[1fr_auto_auto]">
                <select className="rounded-xl border border-slate-300 p-3 text-sm" value={applyPreset[row.id]||''} onChange={e=>setApplyPreset({...applyPreset,[row.id]:e.target.value})}>
                  <option value="">Cambiar plantilla del rubro…</option>
                  {catalog.map(x=><option key={x.key} value={x.key}>{x.label}</option>)}
                </select>
                <button disabled={busy||!applyPreset[row.id]} onClick={()=>void applyTemplate(row)} className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-black text-cyan-800 disabled:opacity-40">Aplicar plantilla</button>
                <button disabled={busy} onClick={()=>void openPanel(row)} className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-40">Entrar al panel Free</button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <a href={web+'/'+row.slug} target="_blank" rel="noreferrer" className="rounded-xl border px-3 py-2 text-sm font-bold">Ver perfil</a>
                <button disabled={busy} onClick={()=>void setPublished(row,!row.is_published)} className="rounded-xl border px-3 py-2 text-sm font-bold">{row.is_published?'Volver a borrador':'Publicar'}</button>
              </div>
            </div>
          </div>
        </article>)}
        {!rows.length&&<div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">Todavía no has creado perfiles Demo Free.</div>}
      </div>
    </section>
  </main>
}
