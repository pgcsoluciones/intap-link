import { useEffect, useRef, useState } from 'react'
import { API_BASE, apiGet, apiPatch } from '../../lib/api'
import { optimizeImageBlobForUpload } from '../../lib/imageUploadOptimization'
import ImageCropModal from './ImageCropModal'
import SuperAdminLayout from './SuperAdminLayout'

type Sponsor={id:string;name:string;logo_url?:string;banner_title?:string;banner_image_url?:string;banner_cta_label?:string;banner_cta_type?:string;banner_cta_value?:string;whatsapp_message_template?:string;contact_whatsapp?:string;website_url?:string}
type PendingImage={file:File;kind:'logo'|'banner'}|null
const input='mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100'
const label='block text-[11px] font-black uppercase tracking-[.08em] text-slate-500'
const card='rounded-[24px] border border-slate-200 bg-white p-5'

export default function SuperAdminSponsorBrand(){
  const logoRef=useRef<HTMLInputElement>(null),bannerRef=useRef<HTMLInputElement>(null)
  const[items,setItems]=useState<Sponsor[]>([]),[selectedId,setSelectedId]=useState('')
  const[form,setForm]=useState<any>({logo_url:'',banner_title:'Impulsado por',banner_image_url:'',banner_cta_label:'Conocer más',banner_cta_type:'beneficiary_whatsapp',banner_cta_value:'',whatsapp_message_template:''})
  const[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[uploading,setUploading]=useState(''),[pending,setPending]=useState<PendingImage>(null),[message,setMessage]=useState(''),[error,setError]=useState('')
  async function load(){setLoading(true);setError('');try{const json:any=await apiGet('/superadmin/sponsors');if(!json?.ok)throw new Error(json?.error||'No se pudieron cargar los patrocinadores.');const rows=Array.isArray(json.data)?json.data:[];setItems(rows);if(!selectedId&&rows[0])setSelectedId(rows[0].id)}catch(e){setError(e instanceof Error?e.message:'No se pudieron cargar los patrocinadores.')}finally{setLoading(false)}}
  useEffect(()=>{void load()},[])
  useEffect(()=>{const s=items.find(i=>i.id===selectedId);if(!s)return;setForm({logo_url:s.logo_url||'',banner_title:s.banner_title||'Impulsado por',banner_image_url:s.banner_image_url||'',banner_cta_label:s.banner_cta_label||'Conocer más',banner_cta_type:s.banner_cta_type||'beneficiary_whatsapp',banner_cta_value:s.banner_cta_value||'',whatsapp_message_template:s.whatsapp_message_template||''})},[selectedId,items])
  function choose(file:File|undefined,kind:'logo'|'banner'){if(!file)return;if(file.size>12*1024*1024){setError('La imagen original supera 12 MB. Elige una más liviana.');return}setError('');setMessage('');setPending({file,kind})}
  async function uploadBlob(blob:Blob,kind:'logo'|'banner'){
    if(!selectedId)return
    setUploading(kind);setError('');setMessage('')
    try{
      const optimized=await optimizeImageBlobForUpload(blob,{maxDimension:kind==='logo'?1024:1600,quality:.82,baseName:kind})
      const fd=new FormData();fd.append('file',optimized,optimized.name)
      const res=await fetch(`${API_BASE}/superadmin/sponsors/${selectedId}/media?kind=${kind}`,{method:'POST',credentials:'include',body:fd})
      const json:any=await res.json().catch(()=>null)
      if(!res.ok||!json?.ok)throw new Error(json?.error||'No se pudo subir la imagen.')
      const key=kind==='logo'?'logo_url':'banner_image_url'
      const nextForm={...form,[key]:json.url}
      setForm(nextForm)
      const applied:any=await apiPatch(`/superadmin/sponsors/${selectedId}/brand`,nextForm)
      if(!applied?.ok)throw new Error(applied?.error||'La imagen se subió, pero no se pudo aplicar al patrocinio.')
      setMessage(kind==='logo'?'Logo actualizado en todo el patrocinio.':'Banner actualizado en todo el patrocinio.')
      await load()
    }catch(e){setError(e instanceof Error?e.message:'No se pudo actualizar la imagen.')}finally{setUploading('')}
  }
  async function save(){if(!selectedId)return;setSaving(true);setError('');setMessage('');try{const json:any=await apiPatch(`/superadmin/sponsors/${selectedId}/brand`,form);if(!json?.ok)throw new Error(json?.error||'No se pudo guardar la marca.');setMessage('Marca del patrocinador actualizada. El cambio se refleja en el Master y en todos los perfiles patrocinados vinculados.');await load()}catch(e){setError(e instanceof Error?e.message:'No se pudo guardar la marca.')}finally{setSaving(false)}}
  const selected=items.find(i=>i.id===selectedId)
  return <SuperAdminLayout currentSection={'sponsorBrand' as any}><div className="space-y-5 font-['Inter'] text-slate-950">
    <div><p className="text-[11px] font-black uppercase tracking-[.18em] text-cyan-600">PERFIL PATROCINADO</p><h1 className="mt-2 text-3xl font-black tracking-[-.04em]">Marca del patrocinador</h1><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">La identidad del patrocinador es central. Al cambiar logo o banner aquí, el cambio se aplica al Master y a todos los perfiles patrocinados vinculados; no se guarda una copia independiente por cliente.</p></div>
    {message&&<p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</p>}{error&&<p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">{error}</p>}
    <section className={card}><label className={label}>Patrocinador<select className={input} value={selectedId} onChange={e=>setSelectedId(e.target.value)} disabled={loading}><option value="">Selecciona un patrocinador</option>{items.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label></section>
    {selected&&<>
      <section className={card}><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-black">Identidad visual</h2><p className="mt-1 text-sm text-slate-500">Selecciona, ajusta y confirma. Al terminar el recorte, la nueva imagen queda aplicada automáticamente en todo el patrocinio.</p></div><span className="rounded-full bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-800">{selected.name}</span></div><div className="mt-5 grid gap-5 md:grid-cols-2">
        <div><p className={label}>Logo</p><button type="button" onClick={()=>logoRef.current?.click()} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold">{form.logo_url?'Cambiar logo':'Subir logo'}</button><input ref={logoRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e=>{const f=e.target.files?.[0];e.target.value='';choose(f,'logo')}}/>{form.logo_url&&<div className="mt-3 flex h-32 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-4"><img src={form.logo_url} alt="Logo" className="max-h-full max-w-full object-contain"/></div>}</div>
        <div><p className={label}>Banner promocional</p><button type="button" onClick={()=>bannerRef.current?.click()} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold">{form.banner_image_url?'Cambiar banner':'Subir banner'}</button><input ref={bannerRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e=>{const f=e.target.files?.[0];e.target.value='';choose(f,'banner')}}/>{form.banner_image_url&&<img src={form.banner_image_url} alt="Banner" className="mt-3 h-32 w-full rounded-2xl object-cover"/>}</div>
      </div></section>
      <section className={card}><h2 className="text-xl font-black">Cintillo y CTA</h2><p className="mt-1 text-sm leading-6 text-slate-500">Esta parte solo la controla Super Admin. Guardar estos datos también actualiza centralmente todos los perfiles vinculados.</p><div className="mt-5 grid gap-4 md:grid-cols-2"><label className={label}>Título del cintillo<input className={input} value={form.banner_title} onChange={e=>setForm({...form,banner_title:e.target.value})}/></label><label className={label}>Texto CTA<input className={input} value={form.banner_cta_label} onChange={e=>setForm({...form,banner_cta_label:e.target.value})}/></label><label className={label}>Tipo de destino<select className={input} value={form.banner_cta_type} onChange={e=>setForm({...form,banner_cta_type:e.target.value})}><option value="beneficiary_whatsapp">WhatsApp del beneficiario</option><option value="sponsor_whatsapp">WhatsApp del patrocinador</option><option value="sponsor_url">Enlace del patrocinador</option><option value="none">Sin CTA</option></select></label><label className={label}>Destino / valor<input className={input} value={form.banner_cta_value} onChange={e=>setForm({...form,banner_cta_value:e.target.value})}/></label><label className={`${label} md:col-span-2`}>Mensaje precargado<textarea className={`${input} min-h-24`} maxLength={240} value={form.whatsapp_message_template} onChange={e=>setForm({...form,whatsapp_message_template:e.target.value})}/></label></div><button onClick={()=>void save()} disabled={saving||Boolean(uploading)} className="mt-5 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-40">{saving?'Guardando…':'Guardar marca y CTA'}</button></section>
      <section className={card}><h2 className="text-xl font-black">Vista de permisos</h2><div className="mt-4 grid gap-3 md:grid-cols-2"><div className="rounded-2xl bg-emerald-50 p-4"><p className="text-sm font-black text-emerald-900">Patrocinador puede modificar</p><p className="mt-2 text-sm leading-6 text-emerald-800">Logo e imagen del banner.</p></div><div className="rounded-2xl bg-slate-100 p-4"><p className="text-sm font-black text-slate-900">Protegido por Super Admin</p><p className="mt-2 text-sm leading-6 text-slate-600">Título del cintillo, CTA, tipo de destino, destino y mensaje comercial.</p></div></div></section>
    </>}
    {pending&&<ImageCropModal file={pending.file} aspectRatio={pending.kind==='logo'?1:3.2} outputWidth={pending.kind==='logo'?1024:1600} onSave={async(blob)=>{const kind=pending.kind;setPending(null);await uploadBlob(blob,kind)}} onCancel={()=>setPending(null)}/>}
  </div></SuperAdminLayout>
}
