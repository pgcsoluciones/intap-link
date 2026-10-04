import { useEffect, useState } from 'react'
import { apiGet, apiPatch, apiPost } from '../../lib/api'
import SuperAdminLayout from './SuperAdminLayout'

const PRESETS=[['professional','Profesional / Servicios'],['wellness','Belleza, Salud y Bienestar'],['food','Comida y Restaurantes'],['retail','Tiendas y Ventas'],['creative','Creativos / Manualidades'],['business','Empresa / Negocio'],['hardware','Ferretería']]

export default function SuperAdminFreeDemos(){
  const[templates,setTemplates]=useState<any[]>([]),[demos,setDemos]=useState<any[]>([])
  const[form,setForm]=useState({name:'',rubric:'',template_email:'',preset_key:'professional',is_default:false})
  const[generate,setGenerate]=useState<Record<string,{slug:string,name:string}>>({})
  const[message,setMessage]=useState(''),[claim,setClaim]=useState<any>(null)
  const load=async()=>{const[t,d]=await Promise.all([apiGet('/superadmin/free-demo/templates'),apiGet('/superadmin/free-demo/profiles')]);if(t?.ok)setTemplates(t.data||[]);if(d?.ok)setDemos(d.data||[])}
  useEffect(()=>{void load()},[])
  const createTemplate=async(e:React.FormEvent)=>{e.preventDefault();setMessage('');const j:any=await apiPost('/superadmin/free-demo/templates',form);if(j?.ok){setForm({name:'',rubric:'',template_email:'',preset_key:'professional',is_default:false});setMessage('Plantilla creada.');await load()}else setMessage(j?.error||'No se pudo crear la plantilla.')}
  const generateDemo=async(id:string)=>{const data=generate[id]||{slug:'',name:''};const j:any=await apiPost('/superadmin/free-demo/templates/'+encodeURIComponent(id)+'/generate',data);if(j?.ok){setMessage('Demo creada en borrador: /'+j.data.slug);await load()}else setMessage(j?.error||'No se pudo generar la Demo.')}
  const makeDefault=async(id:string)=>{await apiPatch('/superadmin/free-demo/templates/'+encodeURIComponent(id),{is_default:true});await load()}
  const setPublished=async(row:any,published:boolean)=>{const j:any=await apiPatch('/superadmin/free-demo/profiles/'+encodeURIComponent(row.id),{is_published:published});if(j?.ok){setMessage(published?'Demo publicada.':'Demo devuelta a borrador.');await load()}else setMessage(j?.error||'No se pudo actualizar la Demo.')}
  const createClaim=async(id:string)=>{const j:any=await apiPost('/superadmin/free-demo/profiles/'+encodeURIComponent(id)+'/claim-code',{});if(j?.ok)setClaim(j.data);else setMessage(j?.error||'No se pudo generar el código de reclamo.')}
  return <SuperAdminLayout currentSection="freeDemos">
    <div className="mx-auto max-w-6xl space-y-8 text-slate-900">
      <header><p className="text-xs font-black uppercase tracking-[.2em] text-cyan-700">KAWVO LINK</p><h1 className="mt-2 text-3xl font-black">Plantillas Demo Free</h1><p className="mt-2 max-w-3xl text-sm text-slate-600">Plantillas por rubro que generan perfiles Free reales en borrador, con la interfaz vigente, horario, cotización y agenda. No usa Trial ni modifica los límites normales de Free.</p></header>
      {message&&<div className="rounded-2xl bg-cyan-50 p-4 text-sm font-bold text-cyan-800">{message}</div>}
      {claim&&<div className="rounded-3xl border border-emerald-300 bg-emerald-50 p-5"><h2 className="font-black">Código de reclamo generado</h2><p className="mt-2 text-sm">Correo especial: <strong>{claim.special_email}</strong></p><p className="text-sm">Slug: <strong>{claim.slug}</strong></p><p className="mt-3 font-mono text-2xl font-black tracking-widest">{claim.claim_code}</p><p className="mt-2 text-xs text-slate-600">Se muestra ahora para entrega. Es de un solo uso y expira en 30 días.</p></div>}
      <form onSubmit={createTemplate} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-black">Crear plantilla por rubro</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input className="rounded-2xl border p-3" placeholder="Nombre de plantilla" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
          <input className="rounded-2xl border p-3" placeholder="Rubro, ej. Ferretería" value={form.rubric} onChange={e=>setForm({...form,rubric:e.target.value})}/>
          <input className="rounded-2xl border p-3" type="email" placeholder="Correo de plantilla" value={form.template_email} onChange={e=>setForm({...form,template_email:e.target.value})}/>
          <select className="rounded-2xl border p-3" value={form.preset_key} onChange={e=>setForm({...form,preset_key:e.target.value})}>{PRESETS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={form.is_default} onChange={e=>setForm({...form,is_default:e.target.checked})}/>Usar como plantilla predeterminada para nuevas activaciones Free de intapcard@gmail.com</label>
        <button className="mt-5 rounded-2xl bg-slate-950 px-5 py-3 font-black text-white">Crear plantilla</button>
      </form>

      <section className="space-y-4"><h2 className="text-xl font-black">Plantillas</h2>{templates.map(t=><article key={t.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-black">{t.name}</h3><p className="text-sm text-slate-500">{t.rubric} · {t.template_email} · {t.demo_count||0} demos</p></div><button onClick={()=>makeDefault(t.id)} className={"rounded-full px-3 py-2 text-xs font-black "+(t.is_default?'bg-emerald-100 text-emerald-700':'bg-slate-100')}>{t.is_default?'Predeterminada':'Hacer predeterminada'}</button></div>
        <div className="mt-4 grid gap-2 md:grid-cols-[1fr_1fr_auto]"><input className="rounded-xl border p-3" placeholder="slug-demo" value={generate[t.id]?.slug||''} onChange={e=>setGenerate({...generate,[t.id]:{...(generate[t.id]||{name:''}),slug:e.target.value}})}/><input className="rounded-xl border p-3" placeholder="Nombre del negocio (opcional)" value={generate[t.id]?.name||''} onChange={e=>setGenerate({...generate,[t.id]:{...(generate[t.id]||{slug:''}),name:e.target.value}})}/><button onClick={()=>generateDemo(t.id)} className="rounded-xl bg-cyan-700 px-4 py-3 font-black text-white">Generar Demo</button></div>
      </article>)}</section>

      <section className="space-y-4"><h2 className="text-xl font-black">Demos generadas</h2>{demos.map(d=><article key={d.id} className="rounded-3xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-black">{d.name||d.slug}</h3><p className="text-sm text-slate-500">/{d.slug} · {d.rubric||'Sin rubro'} · {d.status} · {d.created_from}</p></div><div className="flex flex-wrap gap-2"><a className="rounded-xl border px-3 py-2 text-sm font-bold" href={(import.meta.env.VITE_WEB_URL||'https://intaprd.com').replace(/\/$/,'')+'/'+d.slug} target="_blank" rel="noreferrer">Ver perfil</a>{d.status!=='claimed'&&<button onClick={()=>setPublished(d,!d.is_published)} className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-black text-cyan-800">{d.is_published?'Volver a borrador':'Publicar'}</button>}{d.status!=='claimed'&&<button onClick={()=>createClaim(d.id)} className="rounded-xl bg-emerald-700 px-3 py-2 text-sm font-black text-white">Generar código de reclamo</button>}</div></div></article>)}</section>
    </div>
  </SuperAdminLayout>
}
