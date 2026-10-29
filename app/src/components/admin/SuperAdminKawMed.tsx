import { useEffect, useMemo, useRef, useState } from 'react'
import { API_BASE, apiGet, apiPatch, apiPost } from '../../lib/api'
import { optimizeImageBlobForUpload } from '../../lib/imageUploadOptimization'
import ImageCropModal from './ImageCropModal'
import SuperAdminLayout from './SuperAdminLayout'

type Sponsor={id:string;name:string;logo_url?:string}
type Program={id:string;sponsor_id:string;sponsor_name:string;name:string;private_banner_image_url?:string;private_cta_label?:string;private_cta_url?:string;vademecum_url?:string;vademecum_label?:string;representative_cta_label?:string;representative_message_template?:string;notes?:string;enabled?:number;codes_total?:number;codes_claimed?:number}
type Code={id:string;code:string;display_code?:string|null;status:string;program_id?:string|null;station_number?:number;batch_name?:string;program_name?:string;sponsor_name?:string;claimed_email?:string;medical_name?:string;medical_slug?:string;medical_specialty?:string;medical_phone?:string;medical_email?:string;representative_name?:string;representative_zone?:string;created_at?:string;claimed_at?:string}
type Profile={id:string;slug:string;name:string;professional_prefix?:string;specialty?:string;status:string;email?:string;code?:string;program_name?:string;sponsor_name?:string;claimed_at?:string}
type Generated={code:string;claim_url:string}
type MedicalMaster={master_code:string;status:string;claim_url:string;claimed_email?:string;claimed_at?:string;already_exists?:boolean}
type PendingImageKind='sponsor-logo'|'program-banner-create'|'program-banner-edit'
type PendingImage={file:File;kind:PendingImageKind}|null

const card='rounded-[24px] border border-slate-200 bg-white p-5'
const label='block text-[11px] font-black uppercase tracking-[.08em] text-slate-500'
const input='mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100'

const MED_PAGE_SIZE=7
type MedGroup='sponsored'|'independent'

function MedPagination({page,total,onChange,label:pageLabel}:{page:number;total:number;onChange:(value:number)=>void;label:string}){
  const pageCount=Math.max(1,Math.ceil(total/MED_PAGE_SIZE))
  const current=Math.min(Math.max(1,page),pageCount)
  const first=total===0?0:(current-1)*MED_PAGE_SIZE+1
  const last=Math.min(current*MED_PAGE_SIZE,total)
  return <nav aria-label={'Paginación de '+pageLabel} className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-slate-600">
    <span>{first}–{last} de {total} códigos · Página {current} de {pageCount}</span>
    <div className="flex items-center gap-2">
      <button type="button" disabled={current===1} onClick={()=>onChange(current-1)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-bold disabled:cursor-not-allowed disabled:opacity-40">Anterior</button>
      <button type="button" disabled={current===pageCount} onClick={()=>onChange(current+1)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-bold disabled:cursor-not-allowed disabled:opacity-40">Siguiente</button>
    </div>
  </nav>
}

function MedCodesAccordion({group,title,rows,page,onPageChange,expanded,onToggle,busy,toggleCode,copyCodeClaimUrl,medicalClaimUrl}:{
  group:MedGroup;title:string;rows:Code[];page:number;onPageChange:(value:number)=>void;expanded:boolean;onToggle:()=>void;busy:boolean;
  toggleCode:(row:Code)=>Promise<void>;copyCodeClaimUrl:(row:Code)=>Promise<void>;medicalClaimUrl:(code:string)=>string
}){
  const pageCount=Math.max(1,Math.ceil(rows.length/MED_PAGE_SIZE))
  const current=Math.min(Math.max(1,page),pageCount)
  const visible=rows.slice((current-1)*MED_PAGE_SIZE,current*MED_PAGE_SIZE)
  const panelId='kawmed-codes-'+group
  return <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
    <button type="button" aria-expanded={expanded} aria-controls={panelId} onClick={onToggle} className="flex w-full items-center justify-between gap-3 bg-slate-50 px-4 py-4 text-left hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-600">
      <span className="flex flex-wrap items-center gap-3"><span className="font-black text-slate-900">{title}</span><span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-black text-cyan-800">{rows.length}</span></span>
      <span aria-hidden="true" className="text-lg text-slate-500">{expanded?'▴':'▾'}</span>
    </button>
    {expanded&&<div id={panelId} className="border-t border-slate-200 p-3">
      <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200"><table className="w-full min-w-[980px] text-left text-xs"><thead className="bg-slate-50 text-slate-400"><tr><th className="p-3">Est.</th><th className="p-3">ID físico</th><th className="p-3">Código</th><th className="p-3">Estado</th><th className="p-3">Lote</th><th className="p-3">Programa / patrocinador</th><th className="p-3">Médico</th><th className="p-3">Cuenta</th><th className="p-3">Enlace</th><th className="p-3">Control</th></tr></thead><tbody>{visible.map(row=><tr key={row.code} className="border-t border-slate-100"><td className="p-3 text-base font-black">{row.station_number?String(row.station_number).padStart(3,'0'):'—'}</td><td className="p-3 font-mono font-black">{row.display_code||'—'}</td><td className="p-3 font-mono font-black">{row.code}</td><td className="p-3"><span className={'rounded-full px-2 py-1 font-black '+(row.status==='claimed'?'bg-emerald-50 text-emerald-700':row.status==='inactive'?'bg-rose-50 text-rose-700':'bg-amber-50 text-amber-700')}>{row.status==='claimed'?'Activado':row.status==='inactive'?'Inactivo':'Disponible'}</span></td><td className="p-3">{row.batch_name||'—'}</td><td className="p-3"><div className="font-bold">{row.program_name||'Independiente'}</div><div className="mt-1 text-slate-400">{row.sponsor_name||'Sin patrocinador'}</div></td><td className="p-3">{row.medical_name?<><div className="font-bold">{row.medical_name}</div><div className="mt-1 text-slate-400">{row.medical_specialty||'—'} · /m/{row.medical_slug}</div><div className="mt-1 text-slate-400">{row.medical_phone||'—'}</div></>:'—'}</td><td className="p-3">{row.medical_email||row.claimed_email||'—'}</td><td className="p-3">{row.status==='available'?<div className="flex flex-col items-start gap-2"><button type="button" onClick={()=>void copyCodeClaimUrl(row)} className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 font-black text-cyan-800">Copiar enlace</button><a href={medicalClaimUrl(row.code)} target="_blank" rel="noopener noreferrer" className="font-semibold text-cyan-700 underline">Abrir activación</a></div>:row.status==='claimed'&&row.medical_slug?<a href={window.location.origin.replace('app.preview.','preview.').replace('app.','')+'/m/'+encodeURIComponent(row.medical_slug)} target="_blank" rel="noopener noreferrer" className="font-semibold text-cyan-700 underline">Ver perfil</a>:<span className="text-slate-400">{row.status==='inactive'?'Código inactivo':'—'}</span>}</td><td className="p-3">{row.status!=='claimed'?<button disabled={busy} onClick={()=>void toggleCode(row)} className="rounded-lg border border-slate-200 px-3 py-2 font-black">{row.status==='inactive'?'Reactivar':'Desactivar'}</button>:<span className="text-slate-400">Uso consumido</span>}</td></tr>)}{!rows.length&&<tr><td colSpan={10} className="p-6 text-center text-slate-400">No hay códigos que coincidan.</td></tr>}</tbody></table></div>
      <MedPagination page={current} total={rows.length} label={title} onChange={onPageChange}/>
    </div>}
  </div>
}


export default function SuperAdminKawMed(){
  const sponsorLogoRef=useRef<HTMLInputElement>(null)
  const createBannerRef=useRef<HTMLInputElement>(null)
  const editBannerRef=useRef<HTMLInputElement>(null)
  const[sponsors,setSponsors]=useState<Sponsor[]>([])
  const[programs,setPrograms]=useState<Program[]>([])
  const[codes,setCodes]=useState<Code[]>([])
  const[profiles,setProfiles]=useState<Profile[]>([])
  const[demoInvitations,setDemoInvitations]=useState<any[]>([])
  const[demoProfileId,setDemoProfileId]=useState('')
  const[demoEmail,setDemoEmail]=useState('')
  const[demoHours,setDemoHours]=useState(72)
  const[demoLink,setDemoLink]=useState('')
  const[selected,setSelected]=useState<Program|null>(null)
  const[busy,setBusy]=useState(false)
  const[message,setMessage]=useState('')
  const[error,setError]=useState('')
  const[generated,setGenerated]=useState<Generated[]>([])
  const[query,setQuery]=useState('')
  const[status,setStatus]=useState('all')
  const[medOpen,setMedOpen]=useState<Record<MedGroup,boolean>>({sponsored:true,independent:false})
  const[medPages,setMedPages]=useState<Record<MedGroup,number>>({sponsored:1,independent:1})
  const[generatedExpanded,setGeneratedExpanded]=useState(true)
  const[generatedPage,setGeneratedPage]=useState(1)
  const[create,setCreate]=useState({sponsor_id:'',name:'',private_banner_image_url:'',private_cta_label:'Conocer más',private_cta_url:'',vademecum_url:'',vademecum_label:'Ver vademécum',representative_cta_label:'Mi visitador',representative_message_template:'Hola {visitador}, soy {medico}. Te contacto desde mi panel KawMed y necesito información de {patrocinador}.',notes:''})
  const[batch,setBatch]=useState({program_id:'',name:'',quantity:10,notes:''})
  const[masterSponsorId,setMasterSponsorId]=useState('')
  const[medicalMaster,setMedicalMaster]=useState<MedicalMaster|null>(null)
  const[newSponsor,setNewSponsor]=useState({name:'',contact_email:'',website_url:'',logo_url:''})
  const[pending,setPending]=useState<PendingImage>(null)
  const[sponsorLogoFile,setSponsorLogoFile]=useState<File|null>(null)
  const[sponsorLogoPreview,setSponsorLogoPreview]=useState('')

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
    if(m?.ok){
      const rows:Profile[]=Array.isArray(m.data)?m.data:[]
      setProfiles(rows)
      setDemoProfileId(current=>rows.some(row=>row.id===current&&String(row.email||'').trim().toLowerCase()==='intapcard@gmail.com')?current:'')
    }
  }
  useEffect(()=>{void load()},[])
  useEffect(()=>()=>{if(sponsorLogoPreview.startsWith('blob:'))URL.revokeObjectURL(sponsorLogoPreview)},[sponsorLogoPreview])
  useEffect(()=>{if(!masterSponsorId){setMedicalMaster(null);return}apiGet('/superadmin/kawmed/masters/'+encodeURIComponent(masterSponsorId)).then((j:any)=>{if(j?.ok)setMedicalMaster(j.data||null)}).catch(()=>setMedicalMaster(null))},[masterSponsorId])

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
  const sponsoredCodes=useMemo(()=>filtered.filter(row=>Boolean(row.program_id)),[filtered])
  const independentCodes=useMemo(()=>filtered.filter(row=>!row.program_id),[filtered])
  // El correo proviene de users.email (propietario del perfil), no del correo público del médico.
  // El backend mantiene además la misma restricción al crear cada invitación.
  const demoEligibleProfiles=useMemo(()=>profiles.filter(row=>String(row.email||'').trim().toLowerCase()==='intapcard@gmail.com'),[profiles])

  const notify=(ok:string,fail='')=>{setMessage(ok);setError(fail)}
  function chooseImage(file:File|undefined,kind:PendingImageKind){
    if(!file)return
    if(file.size>12*1024*1024){notify('','La imagen original supera 12 MB. Elige una más liviana.');return}
    notify('')
    setPending({file,kind} as PendingImage)
  }
  async function uploadSponsorAsset(sponsorId:string,file:File,kind:'logo'|'banner'){
    const fd=new FormData();fd.append('file',file,file.name)
    const res=await fetch(`${API_BASE}/superadmin/sponsors/${encodeURIComponent(sponsorId)}/media?kind=${kind}`,{method:'POST',credentials:'include',body:fd})
    const json:any=await res.json().catch(()=>null)
    if(!res.ok||!json?.ok||!json.url)throw new Error(json?.error||'No se pudo subir la imagen.')
    return String(json.url)
  }
  async function createSponsorBase(){
    setBusy(true);notify('')
    try{
      const j:any=await apiPost('/superadmin/sponsors',{...newSponsor,logo_url:'',sponsor_type:'brand'})
      if(!j?.ok)throw new Error(j?.error||'No se pudo registrar la empresa.')
      const sponsorId=String(j.data?.id||'')
      if(sponsorId&&sponsorLogoFile){
        const logoUrl=await uploadSponsorAsset(sponsorId,sponsorLogoFile,'logo')
        const applied:any=await apiPatch('/superadmin/sponsors/'+encodeURIComponent(sponsorId)+'/brand',{logo_url:logoUrl,banner_title:'Impulsado por',banner_image_url:'',banner_cta_label:'Conocer más',banner_cta_type:'none',banner_cta_value:'',whatsapp_message_template:''})
        if(!applied?.ok)throw new Error(applied?.error||'La empresa se creó, pero no se pudo aplicar el logo.')
      }
      if(sponsorLogoPreview.startsWith('blob:'))URL.revokeObjectURL(sponsorLogoPreview)
      setSponsorLogoPreview('');setSponsorLogoFile(null)
      setNewSponsor({name:'',contact_email:'',website_url:'',logo_url:''})
      notify('Empresa patrocinadora registrada. Ya puedes crear su programa KawMed.')
      await load()
      if(sponsorId){setCreate(current=>({...current,sponsor_id:sponsorId}));setMasterSponsorId(sponsorId)}
    }catch(e){notify('',e instanceof Error?e.message:'No se pudo registrar.')}finally{setBusy(false)}
  }
  async function saveCroppedImage(blob:Blob,kind:'sponsor-logo'|'program-banner-create'|'program-banner-edit'){
    const optimized=await optimizeImageBlobForUpload(blob,{maxDimension:kind==='sponsor-logo'?1024:1600,quality:.82,baseName:kind==='sponsor-logo'?'logo':'kawmed-banner'})
    if(kind==='sponsor-logo'){
      if(sponsorLogoPreview.startsWith('blob:'))URL.revokeObjectURL(sponsorLogoPreview)
      setSponsorLogoFile(optimized);setSponsorLogoPreview(URL.createObjectURL(optimized))
      notify('Logo preparado. Se cargará al registrar el patrocinador.')
      return
    }
    const sponsorId=kind==='program-banner-create'?create.sponsor_id:selected?.sponsor_id
    if(!sponsorId){notify('','Selecciona primero el patrocinador.');return}
    setBusy(true);notify('')
    try{
      const url=await uploadSponsorAsset(String(sponsorId),optimized,'banner')
      if(kind==='program-banner-create')setCreate(current=>({...current,private_banner_image_url:url}))
      else setSelected(current=>current?({...current,private_banner_image_url:url}):current)
      notify('Cintillo ajustado y cargado con el gestor de imagen de KawLink.')
    }catch(e){notify('',e instanceof Error?e.message:'No se pudo subir el cintillo.')}finally{setBusy(false)}
  }

  async function generateMedicalMaster(){
    if(!masterSponsorId)return
    setBusy(true);notify('')
    try{
      const j:any=await apiPost('/superadmin/kawmed/masters/'+encodeURIComponent(masterSponsorId),{})
      if(!j?.ok)throw new Error(j?.error||'No se pudo generar el Master KawMed.')
      setMedicalMaster(j.data||null)
      notify(j.data?.already_exists?'Este patrocinador ya tenía un Master KawMed; mostramos el acceso existente.':'Master KawMed generado y vinculado al patrocinador.')
    }catch(e){notify('',e instanceof Error?e.message:'No se pudo generar el Master KawMed.')}finally{setBusy(false)}
  }
  async function copyMedicalMaster(){
    if(!medicalMaster?.claim_url)return
    await navigator.clipboard.writeText(medicalMaster.claim_url)
    notify('URL del Master KawMed copiada.')
  }

  async function createProgram(){
    setBusy(true);notify('')
    try{
      const j:any=await apiPost('/superadmin/kawmed/programs',create)
      if(!j?.ok)throw new Error(j?.error||'No se pudo crear el programa.')
      setCreate({sponsor_id:'',name:'',private_banner_image_url:'',private_cta_label:'Conocer más',private_cta_url:'',vademecum_url:'',vademecum_label:'Ver vademécum',representative_cta_label:'Mi visitador',representative_message_template:'Hola {visitador}, soy {medico}. Te contacto desde mi panel KawMed y necesito información de {patrocinador}.',notes:''})
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
    setBusy(true);setGenerated([]);setGeneratedPage(1);setGeneratedExpanded(true);notify('')
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
  function medicalClaimUrl(code:string){
    return window.location.origin+'/claim/kawmed?code='+encodeURIComponent(code)
  }
  async function copyCodeClaimUrl(row:Code){
    try{
      await navigator.clipboard.writeText(medicalClaimUrl(row.code))
      notify('Enlace de activación de '+row.code+' copiado.')
    }catch{notify('','No se pudo copiar el enlace. Revisa los permisos del navegador.')}
  }
  async function copyGenerated(){
    if(!generated.length)return
    await navigator.clipboard.writeText(generated.map(r=>r.code+'\t'+r.claim_url).join('\n'))
    notify('Listado MED copiado.')
  }

  async function refreshDemoInvitations(){try{const j:any=await apiGet('/superadmin/kawmed/demo-invitations');if(j?.ok)setDemoInvitations(j.data||[])}catch{/* La gestión médica principal sigue disponible. */}}
  async function revokeDemoInvitation(id:string){if(!window.confirm('¿Revocar esta invitación? El invitado perderá acceso inmediatamente.'))return;const j:any=await apiPost('/superadmin/kawmed/demo-invitations/'+encodeURIComponent(id)+'/revoke',{});if(j?.ok)await refreshDemoInvitations();else setError(j?.error||'No se pudo revocar la invitación.')}
  async function deleteDemoInvitation(id:string){
    if(!window.confirm('¿Eliminar definitivamente esta invitación del historial? No se podrá restaurar.'))return
    const result:any=await apiPost('/superadmin/kawmed/demo-invitations/'+encodeURIComponent(id)+'/delete',{})
    if(result?.ok){await refreshDemoInvitations();setMessage('Invitación eliminada.')}
    else setError(result?.error||'No se pudo eliminar la invitación.')
  }
  async function createDemoInvitation(){
    setBusy(true);setError('');setDemoLink('')
    try{
      const result:any=await apiPost('/superadmin/kawmed/demo-invitations',{medical_profile_id:demoProfileId,email:demoEmail,hours:demoHours,live_access:true})
      if(!result?.ok)throw new Error(result?.error||'No fue posible generar la invitación.')
      setDemoLink(String(result.data?.url||''))
      await refreshDemoInvitations()
      setMessage('Invitación única creada. Las invitaciones anteriores de este correo quedaron inhabilitadas. Comparte solamente el nuevo enlace.')
    }catch(e){setError(e instanceof Error?e.message:'No se creó la invitación.')}finally{setBusy(false)}
  }

  return <SuperAdminLayout currentSection={'kawmed' as any}>
    <div className="mx-auto grid max-w-[1280px] gap-5 font-['Inter'] text-slate-950">
      <header><p className="text-[11px] font-black uppercase tracking-[.18em] text-cyan-700">KAWMED</p><h1 className="mt-2 text-3xl font-black tracking-[-.04em]">Perfiles, programas y códigos MED</h1><p className="mt-2 max-w-4xl text-sm leading-6 text-slate-500">Los códigos <strong>MED-XXX-XXX</strong> son exclusivos de KawMed. Pueden ser independientes o pertenecer a un lote patrocinado. El patrocinio médico es privado: cintillo, CTA y vademécum solo aparecen al médico autenticado y nunca al paciente.</p></header>

      {message&&<div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</div>}
      {error&&<div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>}

      <section className={card}>
        <h2 className="text-xl font-black">Invitación de administrador KawMed</h2>
        <p className="mt-2 text-sm text-slate-600">Invita temporalmente a otro administrador a editar el perfil médico original de Intapcard. Al crear una nueva invitación para ese correo, se suspenden las anteriores automáticamente. Verá el mismo panel, podrá cambiar datos, imágenes, plantillas, centros, seguros, agenda y publicación en tiempo real. No podrá cambiar credenciales, propiedad ni eliminar la cuenta. La simulación y el reclamo de cuentas permanecen independientes.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className={label}>Perfil de demostración<select className={input} value={demoProfileId} onChange={e=>setDemoProfileId(e.target.value)} disabled={!demoEligibleProfiles.length}><option value="">{demoEligibleProfiles.length?'Selecciona un perfil':'No hay perfiles de Intapcard disponibles'}</option>{demoEligibleProfiles.map(row=><option key={row.id} value={row.id}>{row.name} · {row.slug}</option>)}</select><span className="mt-1 block text-xs normal-case font-medium tracking-normal text-slate-500">Solo perfiles médicos cuyo propietario es intapcard@gmail.com (independientes o patrocinados).</span></label>
          <label className={label}>Correo del invitado<input className={input} type="email" value={demoEmail} onChange={e=>setDemoEmail(e.target.value)}/></label>
          <label className={label}>Vigencia<select className={input} value={demoHours} onChange={e=>setDemoHours(Number(e.target.value))}><option value={24}>24 horas</option><option value={72}>72 horas</option><option value={168}>7 días</option></select></label>
        </div>
        <button type="button" disabled={busy||!demoProfileId||!demoEmail.includes('@')} onClick={()=>void createDemoInvitation()} className="mt-4 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-40">Generar invitación privada</button>
        <button type="button" onClick={()=>void refreshDemoInvitations()} className="mt-4 ml-3 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold">Ver invitaciones</button>
        {demoInvitations.length>0&&<div className="mt-4 space-y-2">{demoInvitations.map(row=><div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-sm"><div><strong>{row.invited_email}</strong><p className="text-xs text-slate-500">{row.profile_name} · {row.status} · Vence: {new Date(row.expires_at).toLocaleString('es-DO')}</p></div><div className="flex gap-2">{row.status!=='revoked'&&<button type="button" onClick={()=>void revokeDemoInvitation(row.id)} className="rounded-lg border border-amber-200 px-3 py-2 font-bold text-amber-800">Suspender acceso</button>}<button type="button" onClick={()=>void deleteDemoInvitation(row.id)} className="rounded-lg border border-rose-200 px-3 py-2 font-bold text-rose-700">Eliminar</button></div></div>)}</div>}
        {demoLink&&<div className="mt-4 break-all rounded-xl border border-cyan-200 bg-cyan-50 p-4"><p className="mb-2 text-sm font-bold">Enlace único para el destinatario</p><a href={demoLink} className="text-sm text-cyan-800 underline" target="_blank" rel="noreferrer">{demoLink}</a><button type="button" className="ml-3 rounded-lg bg-white p-2 text-sm font-bold" onClick={()=>navigator.clipboard.writeText(demoLink)}>Copiar enlace</button></div>}
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Programas',totals.programs],['Códigos MED',totals.codes],['Disponibles',totals.available],['Activados',totals.claimed]].map(([l,v])=><div key={String(l)} className={card}><p className="text-xs font-black uppercase tracking-[.07em] text-slate-400">{l}</p><p className="mt-2 text-3xl font-black">{v}</p></div>)}</section>

      <section className={card}><h2 className="text-xl font-black">Registrar empresa / laboratorio</h2><p className="mt-1 text-sm leading-6 text-slate-500">Reutiliza la identidad central de patrocinadores de Kawvo, pero no crea un perfil patrocinado público. Después podrás crear uno o varios programas KawMed privados para esta empresa.</p><div className="mt-4 grid gap-3 md:grid-cols-2"><label className={label}>Nombre<input className={input} value={newSponsor.name} onChange={e=>setNewSponsor({...newSponsor,name:e.target.value})}/></label><label className={label}>Correo propietario<input className={input} type="email" value={newSponsor.contact_email} onChange={e=>setNewSponsor({...newSponsor,contact_email:e.target.value})}/></label><label className={label}>Sitio web · opcional<input className={input} value={newSponsor.website_url} onChange={e=>setNewSponsor({...newSponsor,website_url:e.target.value})}/></label><div><p className={label}>Logo</p><button type="button" onClick={()=>sponsorLogoRef.current?.click()} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold">{sponsorLogoFile?'Cambiar logo':'Subir logo'}</button><input ref={sponsorLogoRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e=>{const file=e.target.files?.[0];e.target.value='';chooseImage(file,'sponsor-logo')}}/>{sponsorLogoPreview&&<div className="mt-3 flex h-28 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-3"><img src={sponsorLogoPreview} alt="Vista previa del logo" className="max-h-full max-w-full object-contain"/></div>}</div></div><button onClick={()=>void createSponsorBase()} disabled={busy||!newSponsor.name||!newSponsor.contact_email} className="mt-4 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-40">Registrar patrocinador médico</button></section>

      <section className={card}><div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between"><div><h2 className="text-xl font-black">Acceso Master KawMed</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">Genera un Master exclusivo para que el propietario del patrocinador active y acceda a su Panel Master KawMed. No utiliza el Master del patrocinio público ni sus productos.</p></div><span className="w-fit rounded-full bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-800">MEDM-XXX-XXX</span></div><div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-end"><label className={label}>Patrocinador<select className={input} value={masterSponsorId} onChange={e=>setMasterSponsorId(e.target.value)}><option value="">Seleccionar</option>{sponsors.map(sp=><option key={sp.id} value={sp.id}>{sp.name}</option>)}</select></label><button type="button" onClick={()=>void generateMedicalMaster()} disabled={busy||!masterSponsorId} className="rounded-xl bg-cyan-700 px-5 py-3 text-sm font-black text-white disabled:opacity-40">{medicalMaster?'Ver / recuperar Master':'Generar Master KawMed'}</button></div>{medicalMaster&&<div className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50/60 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[11px] font-black uppercase tracking-[.08em] text-cyan-700">Master KawMed</p><p className="mt-1 font-mono text-xl font-black">{medicalMaster.master_code}</p><p className="mt-2 break-all text-xs font-semibold text-slate-600">{medicalMaster.claim_url}</p><p className="mt-2 text-xs text-slate-500">Estado: {medicalMaster.status==='claimed'?'Activado':medicalMaster.status==='inactive'?'Inactivo':'Disponible'}{medicalMaster.claimed_email?' · '+medicalMaster.claimed_email:''}</p></div><button type="button" onClick={()=>void copyMedicalMaster()} className="rounded-xl border border-cyan-200 bg-white px-4 py-3 text-xs font-black text-cyan-800">Copiar URL Master</button></div></div>}</section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className={card}><h2 className="text-xl font-black">Crear programa médico patrocinado</h2><p className="mt-1 text-sm leading-6 text-slate-500">Usa un patrocinador ya registrado, pero define aquí la campaña médica privada. Esta configuración no altera su patrocinio público normal.</p><div className="mt-4 grid gap-3">
          <label className={label}>Patrocinador<select className={input} value={create.sponsor_id} onChange={e=>setCreate({...create,sponsor_id:e.target.value})}><option value="">Seleccionar</option>{sponsors.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label className={label}>Nombre interno del programa<input className={input} value={create.name} onChange={e=>setCreate({...create,name:e.target.value})} placeholder="Ej. Cardiología 2026"/></label>
          <div><p className={label}>Cintillo privado</p><button type="button" onClick={()=>createBannerRef.current?.click()} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold">{create.private_banner_image_url?'Cambiar cintillo':'Subir cintillo'}</button><input ref={createBannerRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e=>{const file=e.target.files?.[0];e.target.value='';chooseImage(file,'program-banner-create')}}/>{create.private_banner_image_url&&<img src={create.private_banner_image_url} alt="Cintillo privado" className="mt-3 h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 object-cover"/>}<details className="mt-2"><summary className="cursor-pointer text-xs font-bold text-slate-500">Usar URL manual</summary><input className={input} value={create.private_banner_image_url} onChange={e=>setCreate({...create,private_banner_image_url:e.target.value})} placeholder="https://..."/></details></div>
          <div className="grid gap-3 md:grid-cols-2"><label className={label}>CTA privado<input className={input} value={create.private_cta_label} onChange={e=>setCreate({...create,private_cta_label:e.target.value})}/></label><label className={label}>URL del CTA<input className={input} value={create.private_cta_url} onChange={e=>setCreate({...create,private_cta_url:e.target.value})}/></label></div>
          <div className="grid gap-3 md:grid-cols-2"><label className={label}>Vademécum / catálogo<input className={input} value={create.vademecum_url} onChange={e=>setCreate({...create,vademecum_url:e.target.value})} placeholder="https://..."/></label><label className={label}>Texto del enlace<input className={input} value={create.vademecum_label} onChange={e=>setCreate({...create,vademecum_label:e.target.value})}/></label></div>
          <div className="grid gap-3 md:grid-cols-2"><label className={label}>CTA del visitador<input className={input} value={create.representative_cta_label} onChange={e=>setCreate({...create,representative_cta_label:e.target.value})} placeholder="Mi visitador"/></label><label className={label}>Mensaje WhatsApp<textarea className={input} value={create.representative_message_template} onChange={e=>setCreate({...create,representative_message_template:e.target.value})}/><span className="mt-1 block text-xs normal-case tracking-normal text-slate-500">Variables: {'{visitador}'} · {'{medico}'} · {'{patrocinador}'}</span></label></div>
          <label className={label}>Notas internas<textarea className={input} value={create.notes} onChange={e=>setCreate({...create,notes:e.target.value})}/></label>
        </div><button onClick={()=>void createProgram()} disabled={busy||!create.sponsor_id||!create.name} className="mt-4 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-40">Crear programa KawMed</button></div>

        <div className={card}><h2 className="text-xl font-black">Generar lote de códigos MED</h2><p className="mt-1 text-sm leading-6 text-slate-500">Deja “KawMed independiente” para accesos sin patrocinador, o selecciona un programa para entregar un lote patrocinado completo.</p><div className="mt-4 grid gap-3">
          <label className={label}>Tipo de lote<select className={input} value={batch.program_id} onChange={e=>setBatch({...batch,program_id:e.target.value})}><option value="">KawMed independiente</option>{programs.filter(p=>p.enabled!==0).map(p=><option key={p.id} value={p.id}>{p.sponsor_name} · {p.name}</option>)}</select></label>
          <label className={label}>Nombre del lote<input className={input} value={batch.name} onChange={e=>setBatch({...batch,name:e.target.value})} placeholder="Ej. Lote 100 médicos · Congreso 2026"/></label>
          <label className={label}>Cantidad<input className={input} type="number" min={1} max={500} value={batch.quantity} onChange={e=>setBatch({...batch,quantity:Math.max(1,Math.min(500,Number(e.target.value)||1))})}/></label>
          <label className={label}>Notas<textarea className={input} value={batch.notes} onChange={e=>setBatch({...batch,notes:e.target.value})}/></label>
        </div><button onClick={()=>void generateBatch()} disabled={busy||batch.quantity<1} className="mt-4 rounded-xl bg-cyan-700 px-5 py-3 text-sm font-black text-white disabled:opacity-40">Generar {batch.quantity} código{batch.quantity===1?'':'s'} MED</button>
        {generated.length>0&&<div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" aria-expanded={generatedExpanded} aria-controls="kawmed-created-codes" onClick={()=>setGeneratedExpanded(value=>!value)} className="flex flex-1 items-center justify-between gap-3 rounded-lg text-left">
              <span><span className="font-black text-emerald-900">Códigos creados ({generated.length})</span><span className="mt-1 block text-xs text-emerald-700">Lote listo · Cada código es único y de un solo uso.</span></span>
              <span aria-hidden="true" className="text-lg text-emerald-800">{generatedExpanded?'▴':'▾'}</span>
            </button>
            <button type="button" onClick={()=>void copyGenerated()} className="rounded-xl bg-white px-3 py-2 text-xs font-black text-emerald-800">Copiar listado completo</button>
          </div>
          {generatedExpanded&&<div id="kawmed-created-codes">
            <div className="mt-3 overflow-hidden rounded-xl bg-white">{generated.slice((Math.min(generatedPage,Math.max(1,Math.ceil(generated.length/MED_PAGE_SIZE)))-1)*MED_PAGE_SIZE,Math.min(generatedPage,Math.max(1,Math.ceil(generated.length/MED_PAGE_SIZE)))*MED_PAGE_SIZE).map(r=><div key={r.code} className="border-b border-slate-100 p-3 last:border-0"><strong className="font-mono text-base">{r.code}</strong><div className="mt-1 break-all text-xs text-slate-500">{r.claim_url}</div></div>)}</div>
            <MedPagination page={generatedPage} total={generated.length} label="códigos creados" onChange={setGeneratedPage}/>
          </div>}
        </div>}
        </div>
      </section>

      <section className={card}><h2 className="text-xl font-black">Programas patrocinados KawMed</h2><div className="mt-4 grid gap-3 lg:grid-cols-2">{programs.map(p=><button key={p.id} onClick={()=>setSelected({...p})} className={'rounded-2xl border p-4 text-left '+(selected?.id===p.id?'border-cyan-400 bg-cyan-50':'border-slate-200 bg-white')}><div className="flex items-start justify-between gap-3"><div><p className="font-black">{p.name}</p><p className="mt-1 text-xs text-slate-500">{p.sponsor_name}</p></div><span className={'rounded-full px-2 py-1 text-[11px] font-black '+(p.enabled!==0?'bg-emerald-50 text-emerald-700':'bg-slate-100 text-slate-500')}>{p.enabled!==0?'Activo':'Inactivo'}</span></div><p className="mt-3 text-xs text-slate-500">{Number(p.codes_claimed||0)} activados de {Number(p.codes_total||0)} códigos</p></button>)}</div>
      {selected&&<div className="mt-5 grid gap-3 border-t border-slate-100 pt-5 md:grid-cols-2"><label className={label}>Nombre<input className={input} value={selected.name||''} onChange={e=>setSelected({...selected,name:e.target.value})}/></label><div><p className={label}>Cintillo privado</p><button type="button" onClick={()=>editBannerRef.current?.click()} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold">{selected.private_banner_image_url?'Cambiar cintillo':'Subir cintillo'}</button><input ref={editBannerRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e=>{const file=e.target.files?.[0];e.target.value='';chooseImage(file,'program-banner-edit')}}/>{selected.private_banner_image_url&&<img src={selected.private_banner_image_url} alt="Cintillo privado" className="mt-3 h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 object-cover"/>}<details className="mt-2"><summary className="cursor-pointer text-xs font-bold text-slate-500">Usar URL manual</summary><input className={input} value={selected.private_banner_image_url||''} onChange={e=>setSelected({...selected,private_banner_image_url:e.target.value})}/></details></div><label className={label}>CTA<input className={input} value={selected.private_cta_label||''} onChange={e=>setSelected({...selected,private_cta_label:e.target.value})}/></label><label className={label}>URL CTA<input className={input} value={selected.private_cta_url||''} onChange={e=>setSelected({...selected,private_cta_url:e.target.value})}/></label><label className={label}>Vademécum<input className={input} value={selected.vademecum_url||''} onChange={e=>setSelected({...selected,vademecum_url:e.target.value})}/></label><label className={label}>Texto vademécum<input className={input} value={selected.vademecum_label||''} onChange={e=>setSelected({...selected,vademecum_label:e.target.value})}/></label><label className={label}>CTA visitador<input className={input} value={selected.representative_cta_label||'Mi visitador'} onChange={e=>setSelected({...selected,representative_cta_label:e.target.value})}/></label><label className={label}>Mensaje WhatsApp<textarea className={input} value={selected.representative_message_template||''} onChange={e=>setSelected({...selected,representative_message_template:e.target.value})}/><span className="mt-1 block text-xs normal-case tracking-normal text-slate-500">Variables: {'{visitador}'} · {'{medico}'} · {'{patrocinador}'}</span></label><label className="flex items-center gap-2 text-sm font-bold md:col-span-2"><input type="checkbox" checked={selected.enabled!==0} onChange={e=>setSelected({...selected,enabled:e.target.checked?1:0})}/> Programa activo</label><div className="md:col-span-2"><button onClick={()=>void saveProgram()} disabled={busy} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white">Guardar programa</button></div></div>}</section>

      <section className={card}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h2 className="text-xl font-black">Códigos MED</h2><p className="mt-1 text-sm text-slate-500">No comparten namespace ni flujo con productos, Demos Free, Trials o Perfil patrocinado.</p></div>
          <div className="grid grid-cols-[1fr_150px] gap-2">
            <input className={input} value={query} onChange={e=>{setQuery(e.target.value);setMedPages({sponsored:1,independent:1})}} placeholder="Buscar código, médico, lote…"/>
            <select className={input} value={status} onChange={e=>{setStatus(e.target.value);setMedPages({sponsored:1,independent:1})}}><option value="all">Todos</option><option value="available">Disponibles</option><option value="claimed">Activados</option><option value="inactive">Inactivos</option></select>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          <MedCodesAccordion group="sponsored" title="Códigos patrocinados" rows={sponsoredCodes} page={medPages.sponsored} onPageChange={value=>setMedPages(p=>({...p,sponsored:value}))} expanded={medOpen.sponsored} onToggle={()=>setMedOpen(p=>({...p,sponsored:!p.sponsored}))} busy={busy} toggleCode={toggleCode} copyCodeClaimUrl={copyCodeClaimUrl} medicalClaimUrl={medicalClaimUrl}/>
          <MedCodesAccordion group="independent" title="Códigos independientes" rows={independentCodes} page={medPages.independent} onPageChange={value=>setMedPages(p=>({...p,independent:value}))} expanded={medOpen.independent} onToggle={()=>setMedOpen(p=>({...p,independent:!p.independent}))} busy={busy} toggleCode={toggleCode} copyCodeClaimUrl={copyCodeClaimUrl} medicalClaimUrl={medicalClaimUrl}/>
        </div>
      </section>

      <section className={card}><h2 className="text-xl font-black">Perfiles médicos</h2><div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200"><table className="w-full min-w-[900px] text-left text-xs"><thead className="bg-slate-50 text-slate-400"><tr><th className="p-3">Médico</th><th className="p-3">Especialidad</th><th className="p-3">Estado</th><th className="p-3">Código MED</th><th className="p-3">Programa</th><th className="p-3">Cuenta</th></tr></thead><tbody>{profiles.map(row=><tr key={row.id} className="border-t border-slate-100"><td className="p-3"><div className="font-bold">{[row.professional_prefix,row.name].filter(Boolean).join(' ')}</div><div className="mt-1 text-slate-400">/m/{row.slug}</div></td><td className="p-3">{row.specialty||'—'}</td><td className="p-3">{row.status}</td><td className="p-3 font-mono font-bold">{row.code||'—'}</td><td className="p-3"><div>{row.program_name||'Independiente'}</div><div className="mt-1 text-slate-400">{row.sponsor_name||''}</div></td><td className="p-3">{row.email||'—'}</td></tr>)}</tbody></table></div></section>
      {pending&&<ImageCropModal file={pending.file} aspectRatio={pending.kind==='sponsor-logo'?1:3.2} outputWidth={pending.kind==='sponsor-logo'?1024:1600} onSave={async(blob)=>{const kind=pending.kind;setPending(null);await saveCroppedImage(blob,kind)}} onCancel={()=>setPending(null)}/>}
    </div>
  </SuperAdminLayout>
}
