import { useEffect, useMemo, useState } from 'react'
import { API_BASE, apiGet, apiPatch, apiPost } from '../../../lib/api'

const palettes=[['blue','Azul profesional'],['teal','Verde azulado'],['slate','Gris elegante'],['burgundy','Borgoña'],['gold','Dorado']]
const emptySchedule=[{day:'Lunes a Viernes',hours:'8:00 AM - 6:00 PM'},{day:'Sábados',hours:'9:00 AM - 1:00 PM'}]
const SUPPORT_URL='https://nfc.kawvoia.com/respuesta?origen=perfil-patrocinado&tema=soporte'
const SPONSOR_URL='https://nfc.kawvoia.com/respuesta?origen=perfil-patrocinado&interes=patrocinador'

function publicOrigin(){
  const host=window.location.hostname.toLowerCase()
  if(host==='app.preview.intaprd.com') return 'https://preview.intaprd.com'
  if(host==='app.intaprd.com') return 'https://intaprd.com'
  const configured=String(import.meta.env.VITE_WEB_URL||'').replace(/\/$/,'')
  return configured||'https://intaprd.com'
}

export default function SponsoredDashboard(){
  const [data,setData]=useState<any>(null)
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [uploading,setUploading]=useState('')
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')
  const [form,setForm]=useState<any>({username:'',business_name:'',specialization:'',what_we_do:'',avatar_url:'',show_avatar:true,phone:'',whatsapp:'',instagram:'',address:'',schedule:emptySchedule,gallery:[],gallery_title:'Catálogo',palette_id:'blue'})

  async function load(){
    setLoading(true);setError('')
    try{
      const json:any=await apiGet('/me/sponsored-profile')
      if(!json?.ok) throw new Error(json?.error||'No pudimos cargar tu perfil.')
      setData(json.data)
      if(json.data)setForm((current:any)=>({...current,...json.data,schedule:Array.isArray(json.data.schedule)&&json.data.schedule.length?json.data.schedule:emptySchedule,gallery:Array.isArray(json.data.gallery)?json.data.gallery:[]}))
    }catch(e){setError(e instanceof Error?e.message:'No pudimos cargar tu perfil.')}
    finally{setLoading(false)}
  }
  useEffect(()=>{void load()},[])

  const publicUrl=useMemo(()=>form.username?`${publicOrigin()}/p/${form.username}`:'',[form.username])
  const hasUsername=Boolean(data?.username)

  async function uploadImage(file:File,kind:'avatar'|'gallery'){
    setUploading(kind);setError('');setMessage('')
    try{
      const fd=new FormData();fd.append('file',file)
      const res=await fetch(`${API_BASE}/me/sponsored-profile/media?kind=${kind}`,{method:'POST',credentials:'include',body:fd})
      const json:any=await res.json().catch(()=>null)
      if(!res.ok||!json?.ok)throw new Error(json?.error||'No pudimos subir la imagen.')
      return String(json.url||'')
    }catch(e){setError(e instanceof Error?e.message:'No pudimos subir la imagen.');return ''}
    finally{setUploading('')}
  }

  async function onAvatar(file?:File){if(!file)return;const url=await uploadImage(file,'avatar');if(url)setForm((v:any)=>({...v,avatar_url:url}))}
  async function onGallery(file?:File){if(!file||form.gallery.length>=10)return;const url=await uploadImage(file,'gallery');if(url)setForm((v:any)=>({...v,gallery:[...v.gallery,{url,title:''}].slice(0,10)}))}

  async function saveUsername(){
    setSaving(true);setError('');setMessage('')
    try{const json:any=await apiPatch('/me/sponsored-profile',{username:String(form.username||'').trim().toLowerCase()});if(!json?.ok)throw new Error(json?.error||'No pudimos guardar el usuario.');setMessage('Usuario guardado. Ya puedes personalizar tu presentación.');await load()}
    catch(e){setError(e instanceof Error?e.message:'No pudimos guardar el usuario.')}
    finally{setSaving(false)}
  }

  async function saveAll(){
    setSaving(true);setError('');setMessage('')
    try{
      const payload={business_name:form.business_name,specialization:form.specialization,what_we_do:form.what_we_do,avatar_url:form.avatar_url,show_avatar:form.show_avatar,phone:form.phone,whatsapp:form.whatsapp,instagram:form.instagram,address:form.address,schedule:form.schedule,gallery:form.gallery,gallery_title:form.gallery_title,palette_id:form.palette_id}
      const json:any=await apiPatch('/me/sponsored-profile',payload)
      if(!json?.ok)throw new Error(json?.error||'No pudimos guardar los cambios.')
      setMessage('Cambios guardados.');await load()
    }catch(e){setError(e instanceof Error?e.message:'No pudimos guardar los cambios.')}
    finally{setSaving(false)}
  }

  async function togglePublish(){
    setSaving(true);setError('');setMessage('')
    try{
      const route=data?.status==='published'?'/me/sponsored-profile/unpublish':'/me/sponsored-profile/publish'
      const json:any=await apiPost(route,{})
      if(!json?.ok)throw new Error(json?.error||(Array.isArray(json?.missing)?`Falta: ${json.missing.join(', ')}`:'No pudimos actualizar el estado.'))
      setMessage(data?.status==='published'?'Perfil pasado a borrador.':'Perfil publicado.');await load()
    }catch(e){setError(e instanceof Error?e.message:'No pudimos actualizar el estado.')}
    finally{setSaving(false)}
  }

  async function copy(){if(!publicUrl)return;await navigator.clipboard.writeText(publicUrl);setMessage('Enlace copiado.')}
  async function downloadQr(){if(!publicUrl)return;try{const QRCode=await import('qrcode');const dataUrl=await QRCode.toDataURL(publicUrl,{width:1400,margin:3,errorCorrectionLevel:'H'});const a=document.createElement('a');a.href=dataUrl;a.download=`${form.username}-qr.png`;a.click()}catch{setError('No pudimos generar el QR.')}}

  if(loading)return <main className="min-h-screen bg-[#f7f9fc]"/>
  if(!data)return <main className="min-h-screen bg-[#f7f9fc] px-5 py-10 font-['Inter']"><div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-6"><h1 className="text-2xl font-black">Perfil patrocinado</h1><p className="mt-2 text-slate-500">{error||'No tienes un perfil patrocinado activo.'}</p></div></main>

  const input='mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100'
  const label='block text-xs font-black uppercase tracking-[.08em] text-slate-500'
  const section='rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_14px_45px_rgba(15,23,42,.05)]'

  return <main className="min-h-screen bg-[#f7f9fc] px-4 py-7 font-['Inter'] text-slate-950"><div className="mx-auto max-w-[820px] space-y-5">
    <header className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[11px] font-black uppercase tracking-[.18em] text-cyan-600">KAWLINK PATROCINADO</p><h1 className="mt-2 text-3xl font-black tracking-[-.04em]">Mi presentación</h1><p className="mt-1 text-sm text-slate-500">{data.sponsor?.name?`Impulsado por ${data.sponsor.name}`:'Perfil patrocinado permanente'}</p></div><span className={`w-fit rounded-full px-3 py-2 text-xs font-black ${data.status==='published'?'bg-emerald-50 text-emerald-700':'bg-amber-50 text-amber-700'}`}>{data.status==='published'?'Publicado':'Borrador'}</span></header>
    {message&&<p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</p>}{error&&<p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">{error}</p>}

    {!hasUsername&&<section className={section}><p className="text-[11px] font-black uppercase tracking-[.12em] text-cyan-700">Primer paso obligatorio</p><h2 className="mt-2 text-2xl font-black">Elige tu usuario</h2><p className="mt-2 text-sm leading-6 text-slate-500">Este será tu enlace permanente. Debes definirlo antes de editar cualquier otra sección.</p><label className={`${label} mt-5`}>Tu enlace<div className="mt-2 flex items-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"><span className="px-3 text-sm font-bold text-slate-400">intaprd.com/p/</span><input value={form.username} onChange={(e)=>setForm({...form,username:e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,'')})} className="min-w-0 flex-1 bg-transparent px-1 py-4 text-sm font-black outline-none" placeholder="tuusuario"/></div></label><button onClick={()=>void saveUsername()} disabled={saving||!form.username} className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-black text-white disabled:opacity-40">Guardar mi usuario</button></section>}

    {hasUsername&&<>
      <section className={section}><h2 className="text-xl font-black">Identidad</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className={label}>Nombre / negocio<input className={input} value={form.business_name||''} onChange={(e)=>setForm({...form,business_name:e.target.value})}/></label><label className={label}>Especialización o cargo<input className={input} value={form.specialization||''} onChange={(e)=>setForm({...form,specialization:e.target.value})}/></label></div><label className={`${label} mt-4`}>Qué hacemos<textarea className={`${input} min-h-24 resize-y`} maxLength={240} value={form.what_we_do||''} onChange={(e)=>setForm({...form,what_we_do:e.target.value})}/></label><div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto]"><label className={label}>Foto de avatar<input type="file" accept="image/jpeg,image/png,image/webp" className={input} onChange={(e)=>void onAvatar(e.target.files?.[0])}/><span className="mt-2 block text-[11px] normal-case tracking-normal text-slate-400">{uploading==='avatar'?'Subiendo…':form.avatar_url?'Foto cargada':'JPG, PNG o WEBP · máximo 8 MB'}</span></label><label className="flex items-end gap-2 pb-3 text-sm font-bold text-slate-600"><input type="checkbox" checked={form.show_avatar!==false} onChange={(e)=>setForm({...form,show_avatar:e.target.checked})}/> Mostrar avatar</label></div></section>

      <section className={section}><h2 className="text-xl font-black">Contáctame</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className={label}>WhatsApp<input className={input} value={form.whatsapp||''} onChange={(e)=>setForm({...form,whatsapp:e.target.value})}/></label><label className={label}>Teléfono<input className={input} value={form.phone||''} onChange={(e)=>setForm({...form,phone:e.target.value})}/></label><label className={label}>Instagram<input className={input} value={form.instagram||''} onChange={(e)=>setForm({...form,instagram:e.target.value})}/></label><label className={label}>Ubicación<input className={input} value={form.address||''} onChange={(e)=>setForm({...form,address:e.target.value})}/></label></div></section>

      <section className={section}><h2 className="text-xl font-black">Nuestro horario</h2><p className="mt-1 text-sm text-slate-500">Una sección sencilla para mostrar cuándo atiendes.</p><div className="mt-4 space-y-3">{(form.schedule||[]).map((item:any,index:number)=><div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><input className={input} value={item.day||''} onChange={(e)=>{const s=[...form.schedule];s[index]={...s[index],day:e.target.value};setForm({...form,schedule:s})}} placeholder="Lunes a Viernes"/><input className={input} value={item.hours||''} onChange={(e)=>{const s=[...form.schedule];s[index]={...s[index],hours:e.target.value};setForm({...form,schedule:s})}} placeholder="8:00 AM - 6:00 PM"/><button type="button" onClick={()=>setForm({...form,schedule:form.schedule.filter((_:any,i:number)=>i!==index)})} className="self-end rounded-xl border border-slate-200 px-3 py-3 text-xs font-black text-slate-500">Quitar</button></div>)}</div><button type="button" disabled={(form.schedule||[]).length>=7} onClick={()=>setForm({...form,schedule:[...(form.schedule||[]),{day:'',hours:''}].slice(0,7)})} className="mt-4 rounded-xl border border-slate-200 px-4 py-2 text-xs font-black disabled:opacity-40">Agregar horario</button></section>

      <section className={section}><div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-black">Galería</h2><p className="mt-1 text-sm text-slate-500">Hasta 10 imágenes. En público pasan automáticamente y abren en modal.</p></div><span className="text-xs font-black text-slate-400">{form.gallery.length}/10</span></div><label className={`${label} mt-4`}>Título editable<input className={input} value={form.gallery_title||'Catálogo'} onChange={(e)=>setForm({...form,gallery_title:e.target.value})} placeholder="Catálogo"/></label><label className={`${label} mt-4`}>Agregar imagen<input type="file" accept="image/jpeg,image/png,image/webp" className={input} disabled={form.gallery.length>=10||uploading==='gallery'} onChange={(e)=>void onGallery(e.target.files?.[0])}/><span className="mt-2 block text-[11px] normal-case tracking-normal text-slate-400">{uploading==='gallery'?'Subiendo…':'JPG, PNG o WEBP · máximo 8 MB'}</span></label><div className="mt-4 grid gap-3 sm:grid-cols-2">{form.gallery.map((item:any,index:number)=><div key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-3"><img src={item.url} alt="" className="h-32 w-full rounded-xl object-cover"/><input className={input} value={item.title||''} onChange={(e)=>{const g=[...form.gallery];g[index]={...g[index],title:e.target.value};setForm({...form,gallery:g})}} placeholder="Título de la imagen"/><button type="button" onClick={()=>setForm({...form,gallery:form.gallery.filter((_:any,i:number)=>i!==index)})} className="mt-2 rounded-xl border border-rose-200 px-3 py-2 text-xs font-black text-rose-600">Quitar</button></div>)}</div></section>

      <section className={section}><h2 className="text-xl font-black">Apariencia</h2><p className="mt-1 text-sm text-slate-500">La portada es estándar. Elige una combinación de color para tu presentación.</p><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">{palettes.map(([id,name])=><button type="button" key={id} onClick={()=>setForm({...form,palette_id:id})} className={`rounded-2xl border px-3 py-3 text-xs font-black ${form.palette_id===id?'border-cyan-400 bg-cyan-50 text-cyan-800':'border-slate-200 bg-white text-slate-600'}`}>{name}</button>)}</div></section>

      <section className={section}><div className="grid gap-3 sm:grid-cols-2"><button onClick={()=>void saveAll()} disabled={saving} className="rounded-2xl bg-slate-950 px-4 py-4 text-sm font-black text-white disabled:opacity-40">{saving?'Guardando…':'Guardar cambios'}</button><button onClick={()=>void togglePublish()} disabled={saving} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-black text-slate-800">{data.status==='published'?'Volver a borrador':'Publicar presentación'}</button></div>{publicUrl&&<div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><button onClick={()=>window.open(publicUrl,'_blank')} className="rounded-xl bg-slate-100 px-3 py-3 text-xs font-black">Ver perfil</button><button onClick={()=>void copy()} className="rounded-xl bg-slate-100 px-3 py-3 text-xs font-black">Copiar enlace</button><button onClick={()=>void downloadQr()} className="rounded-xl bg-slate-100 px-3 py-3 text-xs font-black">Descargar QR</button><button onClick={()=>navigator.share?.({url:publicUrl,title:form.business_name||'KawLink'}).catch(()=>undefined)} className="rounded-xl bg-slate-100 px-3 py-3 text-xs font-black">Compartir</button></div>}</section>

      <section className="grid gap-3 pb-8 sm:grid-cols-2"><a href={SUPPORT_URL} target="_blank" rel="noreferrer" className="rounded-2xl border border-slate-200 bg-white p-4 text-center text-sm font-black text-slate-700 no-underline">Soporte técnico</a><a href={SPONSOR_URL} target="_blank" rel="noreferrer" className="rounded-2xl border border-slate-200 bg-white p-4 text-center text-sm font-black text-slate-700 no-underline">Convertirme en patrocinador</a></section>
    </>}
  </div></main>
}
