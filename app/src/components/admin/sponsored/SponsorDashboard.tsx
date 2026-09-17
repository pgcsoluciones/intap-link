import { useEffect, useMemo, useState } from 'react'
import { API_BASE, apiGet, apiPatch } from '../../../lib/api'

export default function SponsorDashboard(){
  const[tenant,setTenant]=useState<any>(null)
  const[items,setItems]=useState<any[]>([])
  const[loading,setLoading]=useState(true)
  const[saving,setSaving]=useState(false)
  const[uploading,setUploading]=useState('')
  const[message,setMessage]=useState('')
  const[error,setError]=useState('')
  const[form,setForm]=useState<any>({logo_url:'',banner_image_url:''})

  async function load(){
    setLoading(true);setError('')
    try{
      const[me,list]:any[]=await Promise.all([apiGet('/sponsor/me'),apiGet('/sponsor/artifacts')])
      if(!me?.ok)throw new Error(me?.error||'No pudimos abrir el patrocinador.')
      setTenant(me.data)
      if(me.data)setForm({logo_url:me.data.logo_url||'',banner_image_url:me.data.banner_image_url||''})
      if(list?.ok)setItems(Array.isArray(list.data)?list.data:[])
    }catch(e){setError(e instanceof Error?e.message:'No pudimos abrir el patrocinador.')}
    finally{setLoading(false)}
  }
  useEffect(()=>{void load()},[])

  const stats=useMemo(()=>({
    total:items.filter(i=>i.artifact_role!=='master').length,
    active:items.filter(i=>i.artifact_role!=='master'&&i.status==='activated').length,
    pending:items.filter(i=>i.artifact_role!=='master'&&i.status==='available').length,
    published:items.filter(i=>i.profile_status==='published').length,
  }),[items])

  async function upload(file:File|undefined,kind:'logo'|'banner'){
    if(!file)return
    setUploading(kind);setError('');setMessage('')
    try{
      const fd=new FormData();fd.append('file',file)
      const res=await fetch(`${API_BASE}/sponsor/media?kind=${kind}`,{method:'POST',credentials:'include',body:fd})
      const json:any=await res.json().catch(()=>null)
      if(!res.ok||!json?.ok)throw new Error(json?.error||'No pudimos subir la imagen.')
      setForm((v:any)=>({...v,[kind==='logo'?'logo_url':'banner_image_url']:json.url}))
    }catch(e){setError(e instanceof Error?e.message:'No pudimos subir la imagen.')}
    finally{setUploading('')}
  }

  async function save(){
    setSaving(true);setMessage('');setError('')
    try{
      const json:any=await apiPatch('/sponsor/settings',{logo_url:form.logo_url,banner_image_url:form.banner_image_url})
      if(!json?.ok)throw new Error(json?.error||'No pudimos guardar la imagen del patrocinio.')
      setMessage('Imagen del patrocinio actualizada. Los enlaces y CTA permanecen protegidos.')
      await load()
    }catch(e){setError(e instanceof Error?e.message:'No pudimos guardar.')}
    finally{setSaving(false)}
  }

  if(loading)return<main className="min-h-screen bg-[#f7f9fc]"/>
  if(!tenant)return<main className="min-h-screen bg-[#f7f9fc] px-5 py-10 font-['Inter']"><div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-6"><h1 className="text-2xl font-black">Panel patrocinador</h1><p className="mt-2 text-slate-500">{error||'Tu cuenta no tiene un módulo de patrocinio activo.'}</p></div></main>

  const input='mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100'
  const label='block text-xs font-black uppercase tracking-[.08em] text-slate-500'

  return<main className="min-h-screen bg-[#f7f9fc] px-4 py-7 font-['Inter'] text-slate-950"><div className="mx-auto max-w-[1000px] space-y-5">
    <header className="rounded-[28px] border border-slate-200 bg-white p-6"><p className="text-[11px] font-black uppercase tracking-[.18em] text-cyan-600">MÓDULO PATROCINIO</p><h1 className="mt-2 text-3xl font-black tracking-[-.04em]">{tenant.name}</h1><p className="mt-1 text-sm text-slate-500">Gestiona tus imágenes de marca y consulta los productos vinculados a tu patrocinio.</p></header>

    {message&&<p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</p>}
    {error&&<p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">{error}</p>}

    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[['Comprados',stats.total],['Activos',stats.active],['Pendientes',stats.pending],['Publicados',stats.published]].map(([labelText,value])=><div key={String(labelText)} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-black uppercase tracking-[.08em] text-slate-400">{labelText}</p><p className="mt-2 text-3xl font-black">{value}</p></div>)}</section>

    <section className="rounded-[26px] border border-slate-200 bg-white p-5"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-xl font-black">Identidad de patrocinio</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Puedes actualizar únicamente el logo y la imagen del banner. El llamado a la acción, su destino y el mensaje comercial son administrados por KawLink para proteger la experiencia y la promesa presentada a tus clientes.</p></div><span className="w-fit rounded-full bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-800">Control visual</span></div>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <label className={label}>Logo<input type="file" accept="image/jpeg,image/png,image/webp" className={input} onChange={e=>void upload(e.target.files?.[0],'logo')}/><span className="mt-2 block text-[11px] normal-case tracking-normal text-slate-400">{uploading==='logo'?'Subiendo…':form.logo_url?'Logo cargado':'JPG, PNG o WEBP · máximo 8 MB'}</span>{form.logo_url&&<div className="mt-3 flex h-28 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-3"><img src={form.logo_url} alt="Vista previa del logo" className="max-h-full max-w-full object-contain"/></div>}</label>
        <label className={label}>Banner<input type="file" accept="image/jpeg,image/png,image/webp" className={input} onChange={e=>void upload(e.target.files?.[0],'banner')}/><span className="mt-2 block text-[11px] normal-case tracking-normal text-slate-400">{uploading==='banner'?'Subiendo…':form.banner_image_url?'Banner cargado':'JPG, PNG o WEBP · máximo 8 MB'}</span>{form.banner_image_url&&<img src={form.banner_image_url} alt="Vista previa del banner" className="mt-3 h-32 w-full rounded-2xl object-cover"/>}</label>
      </div>
      <div className="mt-5 grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2"><div><p className="text-[11px] font-black uppercase tracking-[.08em] text-slate-400">CTA administrado</p><p className="mt-1 text-sm font-bold text-slate-700">{tenant.banner_cta_label||'Conocer más'}</p></div><div><p className="text-[11px] font-black uppercase tracking-[.08em] text-slate-400">Destino</p><p className="mt-1 text-sm font-bold text-slate-700">Configurado por KawLink</p></div></div>
      <button onClick={()=>void save()} disabled={saving||Boolean(uploading)} className="mt-5 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-40">{saving?'Guardando…':'Guardar imagen de patrocinio'}</button>
    </section>

    <section className="rounded-[26px] border border-slate-200 bg-white p-5"><h2 className="text-xl font-black">Mis códigos</h2><p className="mt-1 text-sm text-slate-500">Productos comprados, estado de activación y cliente asociado. El código Master aparece identificado por separado.</p><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] border-collapse text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase tracking-[.08em] text-slate-400"><th className="py-3 pr-3">Código</th><th className="py-3 pr-3">Producto</th><th className="py-3 pr-3">Estado</th><th className="py-3 pr-3">Cliente</th><th className="py-3 pr-3">Perfil</th><th className="py-3">Lote / zona</th></tr></thead><tbody>{items.map(item=><tr key={item.public_code} className="border-b border-slate-100"><td className="py-3 pr-3 font-black">{item.public_code}</td><td className="py-3 pr-3">{item.artifact_role==='master'?'Llavero Master':item.product_type}</td><td className="py-3 pr-3">{item.status}</td><td className="py-3 pr-3">{item.business_name||'—'}</td><td className="py-3 pr-3">{item.username?`/p/${item.username}`:item.profile_status||'—'}</td><td className="py-3">{[item.batch_name,item.city,item.zone].filter(Boolean).join(' · ')||'—'}</td></tr>)}</tbody></table></div></section>
  </div></main>
}
