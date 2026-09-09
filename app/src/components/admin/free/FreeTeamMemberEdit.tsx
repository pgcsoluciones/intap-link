import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPost, apiPut, apiUpload } from '../../../lib/api'
import { FreeBackButton } from './FreePanelUi'

type Member = {
  id:string
  name:string
  role:string
  phone:string
  email:string
  whatsapp:string
  avatar_url:string
  slug:string
  is_published:boolean
  product_code:string
  admin_role:string
  access_role:'master'|'editor'|'subadmin'
  permissions:string[]
  editable_fields:string[]
}

const FIELD_LABELS:Record<string,string>={name:'Nombre',role:'Cargo',photo:'Foto',phone:'Teléfono',whatsapp:'WhatsApp',email:'Correo de contacto'}

export default function FreeTeamMemberEdit(){
  const navigate=useNavigate();const id=new URLSearchParams(window.location.search).get('id')||''
  const inputRef=useRef<HTMLInputElement>(null)
  const [member,setMember]=useState<Member|null>(null);const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);const [uploading,setUploading]=useState(false);const [revoking,setRevoking]=useState(false);const [error,setError]=useState('');const [message,setMessage]=useState('')
  const [name,setName]=useState('');const [role,setRole]=useState('');const [phone,setPhone]=useState('');const [email,setEmail]=useState('');const [whatsapp,setWhatsapp]=useState('')
  const load=async()=>{if(!id){setError('Miembro no identificado.');setLoading(false);return}const json:any=await apiGet(`/me/team/members/${encodeURIComponent(id)}/basic`).catch(()=>({ok:false}));if(!json?.ok){setError(json?.error||'No pudimos abrir el miembro.');setLoading(false);return}const m=json.data as Member;setMember(m);setName(m.name||'');setRole(m.role||'');setPhone(m.phone||'');setEmail(m.email||'');setWhatsapp(m.whatsapp||'');setLoading(false)}
  useEffect(()=>{void load()},[id])

  const canEdit=(field:string)=>Boolean(member?.editable_fields?.includes(field))
  const visibleFields=(member?.editable_fields||[]).filter((field)=>FIELD_LABELS[field])
  const hasAdministrativeAccess=Boolean(member&&member.admin_role!=='member')

  const save=async()=>{
    if(saving||!member)return
    if(canEdit('name')&&!name.trim()){setError('El nombre es obligatorio.');return}
    if(canEdit('role')&&!role.trim()){setError('El cargo es obligatorio.');return}
    const payload:Record<string,string>={}
    if(canEdit('name'))payload.name=name.trim()
    if(canEdit('role'))payload.role=role.trim()
    if(canEdit('phone'))payload.phone=phone.trim()
    if(canEdit('email'))payload.email=email.trim()
    if(canEdit('whatsapp'))payload.whatsapp=whatsapp.trim()
    setSaving(true);setError('');setMessage('')
    const json:any=await apiPut(`/me/team/members/${member.id}/basic`,payload).catch(()=>({ok:false}))
    setSaving(false)
    if(!json?.ok){setError(json?.error||'No pudimos guardar los cambios.');return}
    setMessage('Perfil del miembro actualizado.');await load()
  }
  const upload=async(event:React.ChangeEvent<HTMLInputElement>)=>{const file=event.target.files?.[0];if(inputRef.current)inputRef.current.value='';if(!file||!member||uploading||!canEdit('photo'))return;setUploading(true);setError('');setMessage('');const form=new FormData();form.append('file',file);const json:any=await apiUpload(`/me/team/members/${member.id}/avatar`,form).catch(()=>({ok:false}));setUploading(false);if(!json?.ok){setError(json?.error||'No pudimos actualizar la foto.');return}setMember({...member,avatar_url:json.avatar_url});setMessage('Foto del miembro actualizada.')}
  const revokeAccess=async()=>{
    if(!member||member.access_role!=='master'||!hasAdministrativeAccess||revoking)return
    const confirmed=window.confirm('Se eliminará la contraseña de acceso y se cerrarán las sesiones activas de este colaborador. El perfil permanecerá en el Team como Miembro. ¿Deseas continuar?')
    if(!confirmed)return
    setRevoking(true);setError('');setMessage('')
    const json:any=await apiPost(`/me/team/members/${member.id}/role`,{role:'member'}).catch(()=>({ok:false}))
    setRevoking(false)
    if(!json?.ok){setError(json?.error||'No pudimos revocar el acceso al Team.');return}
    setMessage('Acceso revocado. La contraseña dejó de ser válida y las sesiones activas fueron cerradas.');await load()
  }
  if(loading)return <main className="min-h-screen bg-[#f7f9fc] flex items-center justify-center"><div className="loading-spinner"/></main>
  return <main className="min-h-screen bg-[#f7f9fc] font-['Inter'] text-slate-950"><div className="mx-auto w-full max-w-[620px] px-5 pb-24 pt-5"><FreeBackButton onClick={()=>navigate('/admin/free/team')}/><p className="mt-3 text-[11px] font-black uppercase tracking-[0.18em] text-cyan-700">KAWVO LINK · TEAM</p><h1 className="mt-1 text-3xl font-black">Editar perfil</h1>{error&&<p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p>}{message&&<p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</p>}{member&&<>
  <section className="mt-5 rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-4">{canEdit('photo')?<button type="button" onClick={()=>inputRef.current?.click()} disabled={uploading} className="h-20 w-20 overflow-hidden rounded-full border border-slate-200 bg-slate-100">{member.avatar_url?<img src={member.avatar_url} alt="" className="h-full w-full object-cover"/>:<span className="grid h-full w-full place-items-center text-2xl text-slate-400">👤</span>}</button>:<div className="h-20 w-20 overflow-hidden rounded-full border border-slate-200 bg-slate-100">{member.avatar_url?<img src={member.avatar_url} alt="" className="h-full w-full object-cover"/>:<span className="grid h-full w-full place-items-center text-2xl text-slate-400">👤</span>}</div>}<div><p className="text-lg font-black">{name||'Miembro Team'}</p><p className="mt-1 text-xs text-slate-500">Producto {member.product_code}</p>{canEdit('photo')&&<button type="button" onClick={()=>inputRef.current?.click()} className="mt-2 text-xs font-black text-cyan-700">{uploading?'Subiendo…':'Cambiar foto'}</button>}</div><input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={upload}/></div></section>
  <section className="mt-5 rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-black">Datos editables</h2><p className="mt-1 text-xs leading-5 text-slate-500">{member.access_role==='master'?'Como Administrador Master puedes actualizar los datos variables del colaborador.':`Puedes modificar únicamente los campos habilitados para este perfil: ${visibleFields.map((field)=>FIELD_LABELS[field]).join(' · ') || 'ninguno'}.`}</p><div className="mt-4 grid gap-3">{canEdit('name')&&<label className="text-xs font-black text-slate-600">Nombre *<input value={name} onChange={e=>setName(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm"/></label>}{canEdit('role')&&<label className="text-xs font-black text-slate-600">Cargo *<input value={role} onChange={e=>setRole(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm"/></label>}{canEdit('phone')&&<label className="text-xs font-black text-slate-600">Teléfono<input value={phone} onChange={e=>setPhone(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm"/></label>}{canEdit('whatsapp')&&<label className="text-xs font-black text-slate-600">WhatsApp<input value={whatsapp} onChange={e=>setWhatsapp(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm"/></label>}{canEdit('email')&&<label className="text-xs font-black text-slate-600">Correo de contacto<input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm"/></label>}</div><button type="button" onClick={()=>void save()} disabled={saving||visibleFields.filter((field)=>field!=='photo').length===0} className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-black text-white disabled:opacity-40">{saving?'Guardando…':'Guardar cambios'}</button></section>
  {member.access_role==='master'&&<section className="mt-5 rounded-[26px] border border-rose-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-black">Acceso al Team</h2>{hasAdministrativeAccess?<><p className="mt-1 text-xs leading-5 text-slate-500">Este colaborador tiene acceso administrativo como <strong>{member.admin_role==='editor'?'Editor':'Subadministrador'}</strong>. Puedes revocar inmediatamente su contraseña y cerrar cualquier sesión activa.</p><button type="button" onClick={()=>void revokeAccess()} disabled={revoking} className="mt-4 w-full rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-sm font-black text-rose-700 disabled:opacity-40">{revoking?'Revocando acceso…':'Revocar acceso al Team'}</button><p className="mt-3 text-[11px] leading-5 text-slate-400">El perfil seguirá perteneciendo al Team como Miembro. Si también deseas retirarlo de la operación, desactívalo desde Perfiles del equipo.</p></>:<p className="mt-1 text-xs leading-5 text-slate-500">Este colaborador no tiene contraseña ni acceso administrativo al panel Team.</p>}</section>}
  <section className="mt-5 rounded-[26px] border border-slate-200 bg-white p-5"><div className="flex items-center justify-between"><span><span className="block text-sm font-black">Estado público</span><span className="mt-1 block text-xs text-slate-500">{member.is_published?'Perfil publicado':'Perfil pendiente'}</span></span><span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${member.is_published?'bg-emerald-100 text-emerald-700':'bg-amber-100 text-amber-800'}`}>{member.is_published?'Publicado':'Pendiente'}</span></div>{member.slug&&member.is_published&&<a href={`${(import.meta.env.VITE_WEB_URL??'https://intaprd.com').replace(/\/$/,'')}/${member.slug}`} target="_blank" rel="noreferrer" className="mt-4 flex w-full justify-center rounded-xl border border-cyan-200 px-4 py-3 text-sm font-black text-cyan-700">Ver perfil público</a>}</section>
</>}</div></main>
}
