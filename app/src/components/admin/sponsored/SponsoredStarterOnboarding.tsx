import { useMemo, useState } from 'react'
import { apiPost } from '../../../lib/api'
import { FREE_PROFILE_CATEGORIES } from '../../../../../shared/free-profile-starter-content'

function normalize(value:string){return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}

export default function SponsoredStarterOnboarding({onComplete,mode='beneficiary',profileId}:{onComplete:()=>void|Promise<void>;mode?:'beneficiary'|'master';profileId?:string}){
  const isMaster=mode==='master'
  const[category,setCategory]=useState('')
  const[username,setUsername]=useState('')
  const[query,setQuery]=useState('')
  const[saving,setSaving]=useState(false)
  const[error,setError]=useState('')
  const filtered=useMemo(()=>{const q=normalize(query.trim());if(!q)return FREE_PROFILE_CATEGORIES;return FREE_PROFILE_CATEGORIES.filter(item=>normalize(item).includes(q))},[query])

  async function continueStarter(){
    if((!isMaster&&!category)||!username||saving)return
    setSaving(true);setError('')
    try{
      const route=isMaster?'/me/sponsored-profile/starter?scope=master':profileId?`/me/sponsored-profile/starter?profile_id=${encodeURIComponent(profileId)}`:'/me/sponsored-profile/starter';const json:any=await apiPost(route,{category,username})
      if(!json?.ok)throw new Error(json?.error||'No pudimos preparar tu presentación.')
      await Promise.resolve(onComplete())
    }catch(e){setError(e instanceof Error?e.message:'No pudimos preparar tu presentación.')}finally{setSaving(false)}
  }

  return <section className="mx-auto w-full max-w-[760px] rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_55px_rgba(15,23,42,.07)] sm:p-6">
    <p className="text-[11px] font-black uppercase tracking-[.14em] text-cyan-700">Empecemos con lo esencial</p>
    <h2 className="mt-2 text-2xl font-black tracking-[-.03em] text-slate-950">{isMaster?'Tu presentación ya tiene una base':'¿A qué te dedicas?'}</h2>
    <p className="mt-2 text-sm leading-6 text-slate-600">{isMaster?'Tomamos el nombre, contacto e identidad disponibles del patrocinador. Elige tu nombre de usuario y luego podrás completar o reemplazar cada dato antes de publicar.':'Con tu actividad y tu nombre de usuario prepararemos un borrador base con contenido e imágenes de ejemplo. Después solo tendrás que reemplazarlo por tus datos reales.'}</p>

    <div className={`mt-6 grid gap-5 ${isMaster?'':'md:grid-cols-2'}`}>
      {!isMaster&&<div>
        <label className="text-sm font-black text-slate-800">Actividad</label>
        {category?<div className="mt-2 rounded-2xl border border-cyan-100 bg-cyan-50 p-4"><div className="flex items-center justify-between gap-3"><strong className="text-sm text-slate-900">✓ {category}</strong><button type="button" onClick={()=>{setCategory('');setQuery('')}} className="text-xs font-black text-cyan-700">Cambiar</button></div></div>:<><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Busca tu actividad" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold outline-none focus:border-cyan-400"/><div className="mt-2 max-h-56 overflow-y-auto rounded-2xl border border-slate-100 bg-white p-1">{filtered.map(item=><button key={item} type="button" onClick={()=>{setCategory(item);setQuery('');setError('')}} className="flex min-h-11 w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-bold text-slate-700 transition hover:bg-slate-50"><span>{item}</span><span className="text-slate-300">›</span></button>)}</div></>}
      </div>}

      <label className="block text-sm font-black text-slate-800">Nombre de usuario
        <div className="mt-2 flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 focus-within:border-cyan-400"><span className="text-sm font-bold text-slate-400">/p/</span><input value={username} onChange={e=>setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,'').slice(0,30))} placeholder="tuusuario" className="min-w-0 flex-1 bg-transparent px-1 py-3.5 text-base font-semibold outline-none"/></div>
        <span className="mt-2 block text-xs font-medium leading-5 text-slate-500">Este será el enlace permanente de tu presentación.</span>
      </label>
    </div>

    <div className="mt-6">
      <button type="button" onClick={()=>void continueStarter()} disabled={(!isMaster&&!category)||username.length<3||saving} className="w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-black text-white transition hover:bg-slate-800 disabled:opacity-35">{saving?'Preparando tu borrador…':isMaster?'Continuar con mi borrador':'Crear mi borrador base'}</button>
      {error&&<p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p>}
    </div>
  </section>
}
