import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPost, apiPut } from '../../../lib/api'
import { FreeBackButton } from './FreePanelUi'

const PERMISSIONS = [
  ['name', 'Nombre'], ['role', 'Cargo'], ['photo', 'Foto'], ['phone', 'Teléfono'], ['email', 'Correo'], ['whatsapp', 'WhatsApp'],
  ['portfolio', 'Portafolio'], ['services', 'Servicios'], ['links', 'Enlaces'], ['quick_actions', 'Botones directos'], ['location', 'Ubicación'], ['design', 'Diseño'],
] as const
const GENERATED_PAGE_SIZE = 5

type CodeRow = { id:string; code:string; status:string; assignment_status?:string; permissions?:string[]; expires_at?:string; used_at?:string|null; created_at?:string; member_name?:string|null; used_by_email?:string|null; product_code?:string|null }
type MemberRow = { id:string; status:string; admin_role?:'member'|'editor'|'subadmin'; permissions?:string[]; joined_at?:string; name?:string|null; role?:string|null; email?:string|null; product_code?:string|null; slug?:string|null }
type Pagination = { page:number; page_size:number; total:number; pages:number }
type BasicPayload = { team:{ id:string; name:string; name_confirmed?:boolean; master_profile_id:string }; codes:CodeRow[]; pagination:Pagination; member_count:number }
type ManagePayload = {
  team?: { id:string; name:string; master_profile_id:string }
  access:{ role:'master'|'editor'|'subadmin'; can_generate_codes:boolean; can_manage_roles:boolean; can_toggle_members:boolean; can_edit_members:boolean }
  members:MemberRow[]
  member_count?:number
  member_pagination?:Pagination
}
type RoleCredential = { memberName:string; role:string; password:string }

function formatDate(value?:string|null){
  if(!value)return '—'
  const date=new Date(value.includes('T')?value:`${value.replace(' ','T')}Z`)
  return Number.isNaN(date.getTime())?value:date.toLocaleString('es-DO',{dateStyle:'medium',timeStyle:'short'})
}
function codeStatus(row:CodeRow){
  if(row.status==='used'||row.status==='assigned'||row.used_at)return 'Asignado'
  if(row.status==='expired')return 'Caducado'
  if(row.status==='disabled')return 'Desactivado'
  return 'Creado · Sin asignar'
}
function roleLabel(role?:string){return role==='editor'?'Editor':role==='subadmin'?'Subadministrador':role==='master'?'Administrador Master':'Miembro'}
function roleDescription(role?:string){
  if(role==='master')return 'Tienes el control completo del Team: configuración, códigos, perfiles, roles y estado de los miembros.'
  if(role==='editor')return 'Puedes editar los perfiles del equipo dentro de los campos que el Administrador Master haya habilitado. No puedes generar códigos, cambiar roles ni activar o desactivar miembros.'
  if(role==='subadmin')return 'Puedes editar perfiles y activar o desactivar miembros. No puedes generar códigos ni cambiar los roles del equipo.'
  return 'Tu acceso no incluye funciones de administración del Team.'
}

export default function FreeTeamCorporate(){
  const navigate=useNavigate()
  const publicPreviewOrigin=(window.location.hostname.includes('preview')||window.location.hostname.endsWith('.pages.dev'))?'https://preview.intaprd.com':'https://intaprd.com'
  const [basic,setBasic]=useState<BasicPayload|null>(null)
  const [manage,setManage]=useState<ManagePayload|null>(null)
  const [loading,setLoading]=useState(true)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [message,setMessage]=useState('')
  const [roleCredential,setRoleCredential]=useState<RoleCredential|null>(null)
  const [teamName,setTeamName]=useState('')
  const [savedName,setSavedName]=useState('')
  const [nameConfirmed,setNameConfirmed]=useState(false)
  const [companyName,setCompanyName]=useState('')
  const [savedCompanyName,setSavedCompanyName]=useState('')
  const [showBankAccounts,setShowBankAccounts]=useState(true)
  const [count,setCount]=useState(1)
  const [permissions,setPermissions]=useState<string[]>(['name','role','photo','phone','email','whatsapp'])
  const [query,setQuery]=useState('')
  const [page,setPage]=useState(1)
  const [memberPage,setMemberPage]=useState(1)
  const [generated,setGenerated]=useState<string[]>([])
  const [generatedPage,setGeneratedPage]=useState(1)

  const load=async(nextPage=page,q=query,nextMemberPage=memberPage)=>{
    setLoading(true);setError('')

    const context:any=await apiGet('/me/team/admin-context').catch(()=>({ok:false}))
    if(!context?.ok){setError('No pudimos verificar tu acceso al Team.');setLoading(false);return}
    const role=String(context.data?.role||'none')
    if(!['master','editor','subadmin'].includes(role)){
      setManage(null);setBasic(null);setError('Tu cuenta no tiene un rol administrativo activo en este Team.');setLoading(false);return
    }

    const admin:any=await apiGet(`/me/team/manage?page=${nextPage}&member_page=${nextMemberPage}&q=${encodeURIComponent(q)}`).catch(()=>({ok:false}))
    if(!admin?.ok){setError(admin?.error||'No pudimos cargar los perfiles del equipo.');setLoading(false);return}
    setManage(admin.data)
    setMemberPage(admin.data?.member_pagination?.page||nextMemberPage)

    if(role==='master'){
      const base:any=await apiGet(`/me/team?page=${nextPage}&q=${encodeURIComponent(q)}`).catch(()=>({ok:false}))
      if(!base?.ok){setError(base?.error||'No pudimos cargar la configuración del Team.');setLoading(false);return}
      setBasic(base.data);setPage(base.data?.pagination?.page||nextPage)
      const current=String(base.data?.team?.name||'').trim();setTeamName(current);setSavedName(current);setNameConfirmed(Boolean(base.data?.team?.name_confirmed))
      const settings:any=await apiGet('/me/team/settings').catch(()=>({ok:false}))
      if(settings?.ok){
        const company=String(settings.data?.company_name||'').trim()
        setCompanyName(company);setSavedCompanyName(company)
        setShowBankAccounts(settings.data?.show_bank_accounts!==false)
      }
    }else{
      setBasic(null)
      setTeamName(String(admin.data?.team?.name||'').trim())
      setSavedName(String(admin.data?.team?.name||'').trim())
    }
    setLoading(false)
  }
  useEffect(()=>{void load(1,'',1)},[])

  const currentRole=manage?.access?.role
  const isMaster=currentRole==='master'
  const canToggle=Boolean(manage?.access?.can_toggle_members)
  const canEdit=Boolean(manage?.access?.can_edit_members)
  const memberCount=basic?.member_count??manage?.member_count??0
  const selectedLabels=useMemo(()=>PERMISSIONS.filter(([key])=>permissions.includes(key)).map(([,label])=>label),[permissions])
  const nameChanged=teamName.trim()!==savedName.trim()
  const companyChanged=companyName.trim()!==savedCompanyName.trim()
  const companyReady=savedCompanyName.trim().length>=2&&!companyChanged
  const canGenerate=Boolean(isMaster&&nameConfirmed&&savedName.trim().length>=2&&!nameChanged&&companyReady)
  const generatedPages=Math.max(1,Math.ceil(generated.length/GENERATED_PAGE_SIZE))
  const visibleGenerated=generated.slice((generatedPage-1)*GENERATED_PAGE_SIZE,generatedPage*GENERATED_PAGE_SIZE)

  const saveName=async()=>{
    if(!isMaster||busy)return
    const name=teamName.trim().replace(/\s+/g,' ')
    if(name.length<2){setError('Escribe y guarda un nombre para tu Team.');return}
    setBusy(true);setError('');setMessage('')
    const json:any=await apiPut('/me/team/name',{name}).catch(()=>({ok:false}))
    setBusy(false)
    if(!json?.ok){setError(json?.error||'No pudimos guardar el nombre.');return}
    setSavedName(json.data?.name||name);setTeamName(json.data?.name||name);setNameConfirmed(true);setMessage('Nombre del Team guardado.')
  }
  const saveCompanyName=async()=>{
    if(!isMaster||busy)return
    const name=companyName.trim().replace(/\s+/g,' ')
    if(name.length<2){setError('Escribe el nombre de la empresa que aparecerá en los perfiles corporativos.');return}
    setBusy(true);setError('');setMessage('')
    const json:any=await apiPut('/me/team/settings',{company_name:name}).catch(()=>({ok:false}))
    setBusy(false)
    if(!json?.ok){setError(json?.error||'No pudimos guardar el nombre de la empresa.');return}
    const saved=String(json.data?.company_name||name).trim();setCompanyName(saved);setSavedCompanyName(saved)
    setMessage('Nombre de empresa guardado y aplicado a los perfiles del Team.')
  }
  const saveBankVisibility=async(next:boolean)=>{
    if(!isMaster||busy)return
    setBusy(true);setError('');setMessage('')
    const json:any=await apiPut('/me/team/settings',{show_bank_accounts:next}).catch(()=>({ok:false}))
    setBusy(false)
    if(!json?.ok){setError(json?.error||'No pudimos actualizar la visibilidad de las cuentas bancarias.');return}
    setShowBankAccounts(next)
    setMessage(next?'Las cuentas bancarias se mostrarán en los perfiles vinculados.':'Las cuentas bancarias quedaron ocultas en los perfiles vinculados.')
  }
  const togglePermission=(key:string)=>{
    if(!isMaster||key==='name'||key==='role')return
    setPermissions((current)=>current.includes(key)?current.filter((item)=>item!==key):[...current,key])
  }
  const createCodes=async()=>{
    if(!canGenerate||busy)return
    setBusy(true);setError('');setMessage('');setGenerated([]);setGeneratedPage(1)
    const json:any=await apiPost('/me/team/codes',{count,permissions}).catch(()=>({ok:false}))
    setBusy(false)
    if(!json?.ok){setError(json?.error||'No pudimos generar los códigos.');return}
    const codes=(json.data||[]).map((item:any)=>String(item.code||''));setGenerated(codes);setGeneratedPage(1);setMessage(`${codes.length} código(s) creado(s).`);await load(1,query,memberPage)
  }
  const codeAction=async(row:CodeRow,type:'deactivate'|'reactivate')=>{
    if(!isMaster||busy||row.status==='used'||row.status==='assigned'||Boolean(row.used_at))return
    setBusy(true);setError('');setMessage('')
    const json:any=await apiPost(`/me/team/codes/${row.id}/${type}`,{}).catch(()=>({ok:false}))
    setBusy(false)
    if(!json?.ok){setError(json?.error||'No pudimos actualizar el código.');return}
    setMessage(type==='reactivate'?'Código reactivado por 24 horas.':'Código desactivado.');await load(page,query,memberPage)
  }
  const setMemberRole=async(member:MemberRow,role:'member'|'editor'|'subadmin')=>{
    if(!isMaster||busy)return
    setBusy(true);setError('');setMessage('');setRoleCredential(null)
    const json:any=await apiPost(`/me/team/members/${member.id}/role`,{role}).catch(()=>({ok:false}))
    setBusy(false)
    if(!json?.ok){setError(json?.error||'No pudimos cambiar el rol.');return}
    const temporaryPassword=String(json.data?.temporary_password||'').trim()
    if(temporaryPassword){
      setRoleCredential({memberName:member.name||member.email||'Miembro Team',role:roleLabel(role),password:temporaryPassword})
      setMessage(`Rol actualizado a ${roleLabel(role)}. Entrega la contraseña temporal al colaborador.`)
    }else setMessage(`Rol actualizado a ${roleLabel(role)}.`)
    await load(page,query,memberPage)
  }
  const toggleMember=async(member:MemberRow)=>{
    if(!canToggle||busy)return
    const active=member.status!=='active';setBusy(true);setError('');setMessage('')
    const json:any=await apiPost(`/me/team/members/${member.id}/status`,{active}).catch(()=>({ok:false}))
    setBusy(false)
    if(!json?.ok){setError(json?.error||'No pudimos actualizar el miembro.');return}
    setMessage(active?'Miembro activado.':'Miembro desactivado.');await load(page,query,memberPage)
  }
  const openPreview=(member:MemberRow)=>{
    const slug=String(member.slug||'').trim()
    if(!slug){setError('Este miembro todavía no tiene un perfil disponible para vista previa.');return}
    window.open(`${publicPreviewOrigin}/${encodeURIComponent(slug)}`,'_blank','noopener,noreferrer')
  }
  const copy=async(value:string)=>{try{await navigator.clipboard.writeText(value);setMessage(`Código ${value} copiado.`)}catch{setMessage('No pudimos copiar el código.')}}
  const copyPassword=async()=>{if(!roleCredential)return;try{await navigator.clipboard.writeText(roleCredential.password);setMessage('Contraseña temporal copiada.')}catch{setMessage('No pudimos copiar la contraseña temporal.')}}

  if(loading)return <main className="min-h-screen bg-[#f7f9fc] flex items-center justify-center"><div className="loading-spinner" /></main>

  return <main className="min-h-screen bg-[#f7f9fc] font-['Inter'] text-slate-950"><div className="mx-auto w-full max-w-[980px] px-5 pb-24 pt-5">
    <FreeBackButton onClick={()=>navigate('/admin/free/account')} />
    <div className="mt-3 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-600">KAWVO LINK · TEAM</p><h1 className="mt-1 text-3xl font-black">Equipo de trabajo</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Administra los perfiles de las personas vinculadas a tu equipo.</p></div>{manage&&<div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-right"><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Miembros</p><p className="text-2xl font-black">{memberCount}</p></div>}</div>

    {manage&&<section className="mt-5 rounded-[24px] border border-cyan-200 bg-cyan-50 p-4"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-700">Tu función en este Team</p><div className="mt-1 flex flex-wrap items-center gap-2"><h2 className="text-lg font-black">{roleLabel(currentRole)}</h2>{manage.team?.name&&<span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">{manage.team.name}</span>}</div><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{roleDescription(currentRole)}</p></section>}

    {error&&<p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p>}{message&&<p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</p>}
    {roleCredential&&<section className="mt-4 rounded-[24px] border border-amber-300 bg-amber-50 p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-700">Acceso al Team</p><h2 className="mt-1 text-lg font-black text-amber-950">Contraseña temporal</h2><p className="mt-1 text-sm text-amber-900"><strong>{roleCredential.memberName}</strong> · {roleCredential.role}</p></div><button type="button" onClick={()=>setRoleCredential(null)} className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-black text-amber-800">Cerrar</button></div><div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center"><code className="min-w-0 flex-1 rounded-2xl border border-amber-200 bg-white px-4 py-3 text-center text-base font-black tracking-[0.08em] text-slate-950">{roleCredential.password}</code><button type="button" onClick={()=>void copyPassword()} className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white">Copiar contraseña</button></div><p className="mt-3 text-xs font-bold leading-5 text-amber-800">Cópiala antes de cerrar este aviso. El colaborador deberá cambiarla en su primer acceso.</p></section>}

    {isMaster&&<section className="mt-6 rounded-[28px] border border-cyan-200 bg-white p-5 shadow-sm"><p className="text-[11px] font-black uppercase tracking-[0.15em] text-cyan-700">Organización</p><h2 className="mt-1 text-xl font-black">Nombre del Team</h2><p className="mt-2 text-sm leading-6 text-slate-500">Este nombre sirve para identificar y organizar internamente el equipo.</p><div className="mt-4 flex flex-col gap-2 sm:flex-row"><input value={teamName} onChange={(e)=>{setTeamName(e.target.value.slice(0,80));if(e.target.value.trim()!==savedName.trim())setNameConfirmed(false)}} placeholder="Ej. Equipo de ventas Santo Domingo" className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-bold"/><button type="button" onClick={()=>void saveName()} disabled={busy||teamName.trim().length<2||(!nameChanged&&nameConfirmed)} className="rounded-2xl bg-slate-950 px-5 py-3.5 text-sm font-black text-white disabled:opacity-35">{busy?'Guardando…':nameConfirmed&&!nameChanged?'Guardado':'Guardar Team'}</button></div>{nameConfirmed&&!nameChanged&&<p className="mt-3 text-xs font-bold text-emerald-700">✓ {savedName}</p>}</section>}

    {isMaster&&<section className="mt-6 rounded-[28px] border border-violet-200 bg-white p-5 shadow-sm"><p className="text-[11px] font-black uppercase tracking-[0.15em] text-violet-700">Identidad pública</p><h2 className="mt-1 text-xl font-black">Nombre de la empresa</h2><p className="mt-2 text-sm leading-6 text-slate-500">Es el nombre que se mostrará en los perfiles corporativos de los miembros.</p><div className="mt-4 flex flex-col gap-2 sm:flex-row"><input value={companyName} onChange={(e)=>setCompanyName(e.target.value.slice(0,120))} placeholder="Ej. Ferretería y Maderas Beato" className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-bold"/><button type="button" onClick={()=>void saveCompanyName()} disabled={busy||companyName.trim().length<2||!companyChanged} className="rounded-2xl bg-violet-700 px-5 py-3.5 text-sm font-black text-white disabled:opacity-35">{busy?'Guardando…':companyReady?'Guardado':'Guardar empresa'}</button></div>{companyReady&&<p className="mt-3 text-xs font-bold text-emerald-700">✓ {savedCompanyName}</p>}</section>}

    {isMaster&&<section className="mt-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-black uppercase tracking-[0.15em] text-cyan-700">Datos bancarios</p><h2 className="mt-1 text-xl font-black">Mostrar en perfiles de miembros</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Elige si los miembros del Team mostrarán las cuentas bancarias definidas por el Administrador Master.</p></div><button type="button" role="switch" aria-checked={showBankAccounts} disabled={busy} onClick={()=>void saveBankVisibility(!showBankAccounts)} className={`relative mt-1 h-8 w-14 shrink-0 rounded-full transition ${showBankAccounts?'bg-emerald-500':'bg-slate-300'} disabled:opacity-50`}><span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${showBankAccounts?'left-7':'left-1'}`} /></button></div><p className={`mt-3 text-xs font-black ${showBankAccounts?'text-emerald-700':'text-slate-500'}`}>{showBankAccounts?'Visible':'Oculto'}</p></section>}

    {isMaster&&<section className="mt-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-black">Generar códigos</h2><p className="mt-1 text-xs leading-5 text-slate-500">Cada código vincula un nuevo producto al Team y solo puede utilizarse una vez.</p></div><label className="text-xs font-black text-slate-600">Cantidad<input type="number" min={1} max={50} value={count} onChange={(e)=>setCount(Math.min(50,Math.max(1,Number(e.target.value)||1)))} className="ml-2 w-20 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"/></label></div><div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{PERMISSIONS.map(([key,label])=>{const selected=permissions.includes(key);const essential=key==='name'||key==='role';return <button key={key} type="button" onClick={()=>togglePermission(key)} className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-black ${selected?'border-amber-300 bg-amber-50 text-amber-900':'border-slate-200 bg-slate-100 text-slate-400'} ${essential?'cursor-default':''}`}><span>{label}</span><span>{selected?'✓':'—'}</span></button>})}</div><p className="mt-3 text-xs text-slate-400">Campos que podrán personalizarse: {selectedLabels.join(' · ')}</p>{!canGenerate&&<p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">Guarda primero el nombre del Team y el nombre de la empresa.</p>}<button type="button" onClick={()=>void createCodes()} disabled={busy||!canGenerate} className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-4 text-sm font-black text-white disabled:opacity-40">{busy?'Generando…':`Generar ${count} código${count===1?'':'s'}`}</button>{generated.length>0&&<div className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-cyan-700">Códigos creados</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{visibleGenerated.map((code)=><button key={code} type="button" onClick={()=>void copy(code)} className="rounded-xl bg-white px-3 py-3 font-mono text-sm font-black">{code} · Copiar</button>)}</div>{generatedPages>1&&<div className="mt-4 flex items-center justify-between"><button type="button" disabled={generatedPage<=1} onClick={()=>setGeneratedPage((current)=>Math.max(1,current-1))} className="rounded-xl border border-cyan-200 bg-white px-3 py-2 text-xs font-black disabled:opacity-30">Anterior</button><span className="text-xs font-bold text-cyan-800">Página {generatedPage} de {generatedPages}</span><button type="button" disabled={generatedPage>=generatedPages} onClick={()=>setGeneratedPage((current)=>Math.min(generatedPages,current+1))} className="rounded-xl border border-cyan-200 bg-white px-3 py-2 text-xs font-black disabled:opacity-30">Siguiente</button></div>}</div>}</section>}

    {isMaster&&<section className="mt-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-xl font-black">Códigos y asignaciones</h2><p className="mt-1 text-xs text-slate-500">Consulta los códigos creados y a quién fue asignado cada producto.</p></div><form onSubmit={(e)=>{e.preventDefault();setMemberPage(1);void load(1,query,1)}} className="flex gap-2"><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Buscar…" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"/><button className="rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white">Buscar</button></form></div><div className="mt-5 grid gap-3">{(basic?.codes||[]).map((row)=>{const assigned=row.status==='used'||row.status==='assigned'||Boolean(row.used_at);return <article key={row.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><button type="button" onClick={()=>void copy(row.code)} className="font-mono text-base font-black">{row.code}</button><p className="mt-1 text-xs text-slate-500">Creado: {formatDate(row.created_at)} · Vence: {formatDate(row.expires_at)}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${assigned?'bg-cyan-100 text-cyan-700':row.status==='active'||row.status==='created'?'bg-slate-200 text-slate-700':row.status==='disabled'?'bg-amber-100 text-amber-800':'bg-rose-100 text-rose-700'}`}>{codeStatus(row)}</span></div>{assigned&&<div className="mt-3 rounded-xl bg-white p-3 text-xs leading-5 text-slate-600"><strong>{row.member_name||row.used_by_email||'Miembro asignado'}</strong><br/>Producto: {row.product_code||'—'} · Asignado: {formatDate(row.used_at)}</div>}<p className="mt-3 text-[11px] text-slate-500">Campos habilitados: {(row.permissions||[]).map((key)=>PERMISSIONS.find(([id])=>id===key)?.[1]||key).join(' · ')}</p>{!assigned&&<div className="mt-3 flex gap-2">{row.status==='disabled'||row.status==='expired'?<button type="button" disabled={busy} onClick={()=>void codeAction(row,'reactivate')} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white">Reactivar</button>:<button type="button" disabled={busy} onClick={()=>void codeAction(row,'deactivate')} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-800">Desactivar</button>}</div>}</article>})}{basic?.codes?.length===0&&<p className="py-8 text-center text-sm text-slate-400">Todavía no hay códigos.</p>}</div>{basic&&basic.pagination.pages>1&&<div className="mt-5 flex items-center justify-between"><button type="button" disabled={page<=1||loading} onClick={()=>void load(page-1,query,memberPage)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black disabled:opacity-30">Anterior</button><span className="text-xs font-bold text-slate-500">Página {page} de {basic.pagination.pages}</span><button type="button" disabled={page>=basic.pagination.pages||loading} onClick={()=>void load(page+1,query,memberPage)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black disabled:opacity-30">Siguiente</button></div>}</section>}

    {manage&&<section className="mt-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm"><div><h2 className="text-xl font-black">Perfiles del equipo</h2><p className="mt-1 text-xs text-slate-500">Consulta y administra los perfiles según las funciones permitidas por tu rol.</p></div><div className="mt-5 grid gap-3">{(manage.members||[]).map((member)=><article key={member.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-black">{member.name||'Miembro Team'}</p><p className="mt-1 text-xs text-slate-500">{member.role||'Cargo pendiente'} · {member.email||'Sin correo de contacto'}</p><p className="mt-1 text-xs text-slate-400">Producto: {member.product_code||'—'} · Desde {formatDate(member.joined_at)}</p>{member.slug&&<p className="mt-1 font-mono text-[11px] font-bold text-cyan-700">/{member.slug}</p>}</div><div className="flex gap-2"><span className="rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-black uppercase text-violet-700">{roleLabel(member.admin_role)}</span><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${member.status==='active'?'bg-emerald-100 text-emerald-700':'bg-slate-200 text-slate-600'}`}>{member.status==='active'?'Activo':'Desactivado'}</span></div></div><div className="mt-3 flex flex-wrap gap-2">{member.slug&&<button type="button" onClick={()=>openPreview(member)} className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-800">Vista previa</button>}{canEdit&&<button type="button" onClick={()=>navigate(`/admin/free/team/member-edit?id=${encodeURIComponent(member.id)}`)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black">Editar perfil</button>}{canToggle&&<button type="button" disabled={busy} onClick={()=>void toggleMember(member)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black">{member.status==='active'?'Desactivar':'Activar'}</button>}{isMaster&&<select value={member.admin_role||'member'} onChange={(e)=>void setMemberRole(member,e.target.value as 'member'|'editor'|'subadmin')} disabled={busy} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black"><option value="member">Miembro</option><option value="editor">Editor</option><option value="subadmin">Subadministrador</option></select>}</div></article>)}{manage.members.length===0&&<p className="py-8 text-center text-sm text-slate-400">Todavía no hay perfiles vinculados a este Team.</p>}</div>{manage.member_pagination&&manage.member_pagination.pages>1&&<div className="mt-5 flex items-center justify-between"><button type="button" disabled={memberPage<=1||loading} onClick={()=>void load(page,query,memberPage-1)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black disabled:opacity-30">Anterior</button><span className="text-xs font-bold text-slate-500">Página {memberPage} de {manage.member_pagination.pages}</span><button type="button" disabled={memberPage>=manage.member_pagination.pages||loading} onClick={()=>void load(page,query,memberPage+1)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black disabled:opacity-30">Siguiente</button></div>}</section>}
  </div></main>
}
