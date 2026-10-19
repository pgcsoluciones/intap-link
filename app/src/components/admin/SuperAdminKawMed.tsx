import { useEffect, useMemo, useState } from 'react'
import { apiGet, apiPatch, apiPost } from '../../lib/api'
import SuperAdminLayout from './SuperAdminLayout'

type Sponsor={id:string;name:string;logo_url?:string}
type Program={id:string;sponsor_id:string;sponsor_name:string;name:string;private_banner_image_url?:string;private_cta_label?:string;private_cta_url?:string;vademecum_url?:string;vademecum_label?:string;notes?:string;enabled?:number;codes_total?:number;codes_claimed?:number}
type Code={id:string;code:string;status:string;batch_name?:string;program_name?:string;sponsor_name?:string;claimed_email?:string;medical_name?:string;medical_slug?:string;created_at?:string;claimed_at?:string}
type Profile={id:string;slug:string;name:string;professional_prefix?:string;specialty?:string;status:string;email?:string;code?:string;program_name?:string;sponsor_name?:string;claimed_at?:string}
type Generated={code:string;claim_url:string}

const card='rounded-[24px] border border-slate-200 bg-white p-5'
const label='block text-[11px] font-black uppercase tracking-[.08em] text-slate-500'
const input='mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100'

export default function SuperAdminKawMed(){
  const[sponsors,setSponsors]=useState<Sponsor[]>([])
  const[programs,setPrograms]=useState<Program[]>([])
  const[codes,setCodes]=useState<Code[]>([])
  const[profiles,setProfiles]=useState<Profile[]>([])
  const[selected,setSelected]=useState<Program|null>(null)
  const[busy,setBusy]=useState(false)
  const[message,setMessage]=useState('')
  const[error,setError]=useState('')
  const[generated,setGenerated]=useState<Generated[]>([])
  const[query,setQuery]=useState('')
  const[status,setStatus]=useState('all')
  const[create,setCreate]=useState({sponsor_id:'',name:'',private_banner_image_url:'',private_cta_label:'Conocer más',private_cta_url:'',vademecum_url:'',vademecum_label:'Ver vademécum',notes:''})
  const[batch,setBatch]=useState({program_id:'',name:'',quantity:10,notes:''})

  const load=async()=>{
    const[s,p,c,m]=await Promise.all([
      apiGet('/superadmin/sponsors'),
      apiGet('/superadmin/kawmed/programs'),
      apiGet('/superadmin/kawmed/codes'),
      apiGet('/superadmin/kawmed/profiles'),
    ])
    if(s?.ok)setSponsors(Array.isArray(s.data)?s.data:[])
    if(p?.ok)setPrograms(Array.isArray(p.data)?p.data:[])
    if(c?.ok)setCodes(Array.isArray(c.data)?c.data:[])
    if(m?.ok)setProfiles(Array.isArray(m.data)?m.data:[])
  }
  useEffect(()=>{void load()},[])

  const totals=useMemo(()=>({
    programs:programs.length,
    codes:codes.length,
    available:codes.filter(c=>c.status==='available').length,
    claimed:codes.filter(c=>c.status==='claimed').length,
  }),[programs,codes])

  const filtered=useMemo(()=>codes.filter(row=>{
    const q=query.trim().toLowerCase()
    if(status!=='all'&&row.status!==status)return false
    if(!q)return true
    return [row.code,row.batch_name,row.program_name,row.sponsor_name,row.claimed_email,row.medical_name,row.medical_slug].some(v=>String(v||'').toLowerCase().includes(q))
  }),[codes,query,status])

  const notify=(ok:string,fail='')=>{setMessage(ok);setError(fail)}
  async function createProgram(){
    setBusy(true);notify('')
    try{
      const j:any=await apiPost('/superadmin/kawmed/programs',create)
      if(!j?.ok)throw new Error(j?.error||'No se pudo crear el programa.')
      setCreate({sponsor_id:'',name:'',private_banner_image_url:'',private_cta_label:'Conocer más',private_cta_url:'',vademecum_url:'',vademecum_label:'Ver vademécum',notes:''})
      notify('Programa KawMed creado. Ya puedes generar lotes patrocinados.')
      await load()
    }catch(e){notify('',e instanceof Error?e.message:'No se pudo crear.')}finally{setBusy(false)}
  }
  async function saveProgram(){
    if(!selected)return
    setBusy(true);notify('')
    try{
      const j:any=await apiPatch('/superadmin/kawmed/programs/'+encodeURIComponent(selected.id),selected)
      if(!j?.ok)throw new Error(j?.error||'No se pudo guardar.')
      notify('Programa médico actualizado.')
      await load()
    }catch(e){notify('',e instanceof Error?e.message:'No se pudo guardar.')}finally{setBusy(false)}
  }
  async function generateBatch(){
    setBusy(true);setGenerated([]);notify('')
    try{
      const j:any=await apiPost('/superadmin/kawmed/batches',batch)
      if(!j?.ok)throw new Error(j?.error||'No se pudo generar el lote.')
      const rows=Array.isArray(j.data?.codes)?j.data.codes:[]
      setGenerated(rows)
      notify(rows.length+' códigos MED generados. '+(batch.program_id?'El lote quedó vinculado al programa patrocinado.':'El lote es KawMed independiente.'))
      await load()
    }catch(e){notify('',e instanceof Error?e.message:'No se pudo generar el lote.')}finally{setBusy(false)}
  }
  async function toggleCode(row:Code){
    if(row.status==='claimed')return
    setBusy(true);notify('')
    try{
      const next=row.status==='inactive'?'available':'inactive'
      const j:any=await apiPatch('/superadmin/kawmed/codes/'+encodeURIComponent(row.code)+'/status',{status:next})
      if(!j?.ok)throw new Error(j?.error||'No se pudo actualizar el código.')
      notify('Código '+row.code+' '+(next==='inactive'?'desactivado.':'reactivado.'))
      await load()
    }catch(e){notify('',e instanceof Error?e.message:'No se pudo actualizar.')}finally{setBusy(false)}
  }
  async function copyGenerated(){
    if(!generated.length)return
    await navigator.clipboard.writeText(generated.map(r=>r.code+'\t'+r.claim_url).join('\n'))
    notify('Listado MED copiado.')
  }

  return <SuperAdminLayout currentSection={'kawmed' as any}>
    <div className="mx-auto grid max-w-[1280px] gap-5 font-['Inter'] text-slate-950">
      <header><p className="text-[11px] font-black uppercase tracking-[.18em] text-cyan-700">KAWMED</p><h1 className="mt-2 text-3xl font-black tracking-[-.04em]">Perfiles, programas y códigos MED</h1><p className="mt-2 max-w-4xl text-sm leading-6 text-slate-500">Los códigos <strong>MED-XXX-XXX</strong> son exclusivos de KawMed. Pueden ser independientes o pertenecer a un lote patrocinado. El patrocinio médico es privado: cintillo, CTA y vademécum solo aparecen al médico autenticado y nunca al paciente.</p></header>

      {message&&<div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</div>}
      {error&&<div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Programas',totals.programs],['Códigos MED',totals.codes],['Disponibles',totals.available],['Activados',totals.claimed]].map(([l,v])=><div key={String(l)} className={card}><p className="text-xs font-black uppercase tracking-[.07em] text-slate-400">{l}</p><p className="mt-2 text-3xl font-black">{v}</p></div>)}</section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className={card}><h2 className="text-xl font-black">Crear programa médico patrocinado</h2><p className="mt-1 text-sm leading-6 text-slate-500">Usa un patrocinador ya registrado, pero define aquí la campaña médica privada. Esta configuración no altera su patrocinio público normal.</p><div className="mt-4 grid gap-3">
          <label className={label}>Patrocinador<select className={input} value={create.sponsor_id} onChange={e=>setCreate({...create,sponsor_id:e.target.value})}><option value="">Seleccionar</option>{sponsors.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label className={label}>Nombre interno del programa<input className={input} value={create.name} onChange={e=>setCreate({...create,name:e.target.value})} placeholder="Ej. Cardiología 2026"/></label>
          <label className={label}>Cintillo privado · URL de imagen<input className={input} value={create.private_banner_image_url} onChange={e=>setCreate({...create,private_banner_image_url:e.target.value})} placeholder="https://..."/></label>
          <div className="grid gap-3 md:grid-cols-2"><label className={label}>CTA privado<input className={input} value={create.private_cta_label} onChange={e=>setCreate({...create,private_cta_label:e.target.value})}/></label><label className={label}>URL del CTA<input className={input} value={create.private_cta_url} onChange={e=>setCreate({...create,private_cta_url:e.target.value})}/></label></div>
          <div className="grid gap-3 md:grid-cols-2"><label className={label}>Vademécum / catálogo<input className={input} value={create.vademecum_url} onChange={e=>setCreate({...create,vademecum_url:e.target.value})} placeholder="https://..."/></label><label className={label}>Texto del enlace<input className={input} value={create.vademecum_label} onChange={e=>setCreate({...create,vademecum_label:e.target.value})}/></label></div>
          <label className={label}>Notas internas<textarea className={input} value={create.notes} onChange={e=>setCreate({...create,notes:e.target.value})}/></label>
        </div><button onClick={()=>void createProgram()} disabled={busy||!create.sponsor_id||!create.name} className="mt-4 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-40">Crear programa KawMed</button></div>

        <div className={card}><h2 className="text-xl font-black">Generar lote de códigos MED</h2><p className="mt-1 text-sm leading-6 text-slate-500">Deja “KawMed independiente” para accesos sin patrocinador, o selecciona un programa para entregar un lote patrocinado completo.</p><div className="mt-4 grid gap-3">
          <label className={label}>Tipo de lote<select className={input} value={batch.program_id} onChange={e=>setBatch({...batch,program_id:e.target.value})}><option value="">KawMed independiente</option>{programs.filter(p=>p.enabled!==0).map(p=><option key={p.id} value={p.id}>{p.sponsor_name} · {p.name}</option>)}</select></label>
          <label className={label}>Nombre del lote<input className={input} value={batch.name} onChange={e=>setBatch({...batch,name:e.target.value})} placeholder="Ej. Lote 100 médicos · Congreso 2026"/></label>
          <label className={label}>Cantidad<input className={input} type="number" min={1} max={500} value={batch.quantity} onChange={e=>setBatch({...batch,quantity:Math.max(1,Math.min(500,Number(e.target.value)||1))})}/></label>
          <label className={label}>Notas<textarea className={input} value={batch.notes} onChange={e=>setBatch({...batch,notes:e.target.value})}/></label>
        </div><button onClick={()=>void generateBatch()} disabled={busy||batch.quantity<1} className="mt-4 rounded-xl bg-cyan-700 px-5 py-3 text-sm font-black text-white disabled:opacity-40">Generar {batch.quantity} código{batch.quantity===1?'':'s'} MED</button>
        {generated.length>0&&<div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><div className="flex items-center justify-between gap-3"><div><p className="font-black text-emerald-900">Lote listo</p><p className="text-xs text-emerald-700">Cada código es único y de un solo uso.</p></div><button onClick={()=>void copyGenerated()} className="rounded-xl bg-white px-3 py-2 text-xs font-black text-emerald-800">Copiar listado</button></div><div className="mt-3 max-h-64 overflow-auto rounded-xl bg-white">{generated.map(r=><div key={r.code} className="border-b border-slate-100 p-3 last:border-0"><strong className="font-mono text-base">{r.code}</strong><div className="mt-1 break-all text-xs text-slate-500">{r.claim_url}</div></div>)}</div></div>}</div>
      </section>

      <section className={card}><h2 className="text-xl font-black">Programas patrocinados KawMed</h2><div className="mt-4 grid gap-3 lg:grid-cols-2">{programs.map(p=><button key={p.id} onClick={()=>setSelected({...p})} className={'rounded-2xl border p-4 text-left '+(selected?.id===p.id?'border-cyan-400 bg-cyan-50':'border-slate-200 bg-white')}><div className="flex items-start justify-between gap-3"><div><p className="font-black">{p.name}</p><p className="mt-1 text-xs text-slate-500">{p.sponsor_name}</p></div><span className={'rounded-full px-2 py-1 text-[11px] font-black '+(p.enabled!==0?'bg-emerald-50 text-emerald-700':'bg-slate-100 text-slate-500')}>{p.enabled!==0?'Activo':'Inactivo'}</span></div><p className="mt-3 text-xs text-slate-500">{Number(p.codes_claimed||0)} activados de {Number(p.codes_total||0)} códigos</p></button>)}</div>
      {selected&&<div className="mt-5 grid gap-3 border-t border-slate-100 pt-5 md:grid-cols-2"><label className={label}>Nombre<input className={input} value={selected.name||''} onChange={e=>setSelected({...selected,name:e.target.value})}/></label><label className={label}>Cintillo privado<input className={input} value={selected.private_banner_image_url||''} onChange={e=>setSelected({...selected,private_banner_image_url:e.target.value})}/></label><label className={label}>CTA<input className={input} value={selected.private_cta_label||''} onChange={e=>setSelected({...selected,private_cta_label:e.target.value})}/></label><label className={label}>URL CTA<input className={input} value={selected.private_cta_url||''} onChange={e=>setSelected({...selected,private_cta_url:e.target.value})}/></label><label className={label}>Vademécum<input className={input} value={selected.vademecum_url||''} onChange={e=>setSelected({...selected,vademecum_url:e.target.value})}/></label><label className={label}>Texto vademécum<input className={input} value={selected.vademecum_label||''} onChange={e=>setSelected({...selected,vademecum_label:e.target.value})}/></label><label className="flex items-center gap-2 text-sm font-bold md:col-span-2"><input type="checkbox" checked={selected.enabled!==0} onChange={e=>setSelected({...selected,enabled:e.target.checked?1:0})}/> Programa activo</label><div className="md:col-span-2"><button onClick={()=>void saveProgram()} disabled={busy} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white">Guardar programa</button></div></div>}</section>

      <section className={card}><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-black">Códigos MED</h2><p className="mt-1 text-sm text-slate-500">No comparten namespace ni flujo con productos, Demos Free, Trials o Perfil patrocinado.</p></div><div className="grid grid-cols-[1fr_150px] gap-2"><input className={input} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar código, médico, lote…"/><select className={input} value={status} onChange={e=>setStatus(e.target.value)}><option value="all">Todos</option><option value="available">Disponibles</option><option value="claimed">Activados</option><option value="inactive">Inactivos</option></select></div></div><div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200"><table className="w-full min-w-[980px] text-left text-xs"><thead className="bg-slate-50 text-slate-400"><tr><th className="p-3">Código</th><th className="p-3">Estado</th><th className="p-3">Lote</th><th className="p-3">Programa / patrocinador</th><th className="p-3">Médico</th><th className="p-3">Cuenta</th><th className="p-3">Control</th></tr></thead><tbody>{filtered.map(row=><tr key={row.code} className="border-t border-slate-100"><td className="p-3 font-mono font-black">{row.code}</td><td className="p-3"><span className={'rounded-full px-2 py-1 font-black '+(row.status==='claimed'?'bg-emerald-50 text-emerald-700':row.status==='inactive'?'bg-rose-50 text-rose-700':'bg-amber-50 text-amber-700')}>{row.status==='claimed'?'Activado':row.status==='inactive'?'Inactivo':'Disponible'}</span></td><td className="p-3">{row.batch_name||'—'}</td><td className="p-3"><div className="font-bold">{row.program_name||'Independiente'}</div><div className="mt-1 text-slate-400">{row.sponsor_name||'Sin patrocinador'}</div></td><td className="p-3">{row.medical_name?<><div className="font-bold">{row.medical_name}</div><div className="mt-1 text-slate-400">/m/{row.medical_slug}</div></>:'—'}</td><td className="p-3">{row.claimed_email||'—'}</td><td className="p-3">{row.status!=='claimed'?<button disabled={busy} onClick={()=>void toggleCode(row)} className="rounded-lg border border-slate-200 px-3 py-2 font-black">{row.status==='inactive'?'Reactivar':'Desactivar'}</button>:<span className="text-slate-400">Uso consumido</span>}</td></tr>)}{!filtered.length&&<tr><td colSpan={7} className="p-6 text-center text-slate-400">No hay códigos que coincidan.</td></tr>}</tbody></table></div></section>

      <section className={card}><h2 className="text-xl font-black">Perfiles médicos</h2><div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200"><table className="w-full min-w-[900px] text-left text-xs"><thead className="bg-slate-50 text-slate-400"><tr><th className="p-3">Médico</th><th className="p-3">Especialidad</th><th className="p-3">Estado</th><th className="p-3">Código MED</th><th className="p-3">Programa</th><th className="p-3">Cuenta</th></tr></thead><tbody>{profiles.map(row=><tr key={row.id} className="border-t border-slate-100"><td className="p-3"><div className="font-bold">{[row.professional_prefix,row.name].filter(Boolean).join(' ')}</div><div className="mt-1 text-slate-400">/m/{row.slug}</div></td><td className="p-3">{row.specialty||'—'}</td><td className="p-3">{row.status}</td><td className="p-3 font-mono font-bold">{row.code||'—'}</td><td className="p-3"><div>{row.program_name||'Independiente'}</div><div className="mt-1 text-slate-400">{row.sponsor_name||''}</div></td><td className="p-3">{row.email||'—'}</td></tr>)}</tbody></table></div></section>
    </div>
  </SuperAdminLayout>
}
