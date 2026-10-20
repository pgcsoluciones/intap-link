import { useEffect, useMemo, useRef, useState } from 'react'
import { API_BASE, apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../../../lib/api'
import { optimizeImageBlobForUpload } from '../../../lib/imageUploadOptimization'
import ImageCropModal from '../ImageCropModal'
import MedicalCenterLocationPicker from './MedicalCenterLocationPicker'

type Tab='profile'|'centers'|'schedule'|'insurance'
type MedicalDashboardProps={scope?:'doctor'|'sponsor_master';embedded?:boolean;onOpenAgenda?:()=>void}
type PendingImage={file:File;kind:'avatar'|'cover'}|null
const MEDICAL_SPECIALTIES=['Alergología e Inmunología','Anatomía patológica','Anestesiología','Angiología y cirugía vascular','Cardiología','Cardiología pediátrica','Cirugía cardiovascular','Cirugía de cabeza y cuello','Cirugía general','Cirugía maxilofacial','Cirugía oncológica','Cirugía pediátrica','Cirugía plástica reconstructiva y estética','Cirugía torácica','Coloproctología','Cuidados intensivos','Dermatología','Diabetología','Endocrinología','Endocrinología pediátrica','Emergenciología','Epidemiología','Fisiatría','Gastroenterología','Gastroenterología pediátrica','Geriatría','Ginecología y obstetricia','Hematología','Hematología pediátrica','Infectología','Medicina crítica','Medicina del deporte','Medicina familiar','Medicina física y rehabilitación','Medicina forense','Medicina general','Medicina interna','Medicina materno fetal','Medicina nuclear','Medicina ocupacional','Medicina preventiva','Nefrología','Nefrología pediátrica','Neonatología','Neumología','Neumología pediátrica','Neurocirugía','Neurología','Neurología pediátrica','Nutrición clínica','Odontología','Oftalmología','Oncología médica','Oncología radioterápica','Ortopedia y traumatología','Otorrinolaringología','Patología clínica','Pediatría','Perinatología','Psiquiatría','Psiquiatría infantil','Radiología','Radiología intervencionista','Reumatología','Salud pública','Sexología médica','Sonografía','Urología']
const MEDICAL_INSURERS=['ARS Humano','ARS Universal','MAPFRE Salud','ARS Primera','ARS Palic','ARS Monumental','ARS Futuro','ARS CMD','ARS SEMMA','SENASA','ARS Reservas','ARS Yunen']
function selectedInsurer(text:string,name:string){return text.split('\n').some(v=>v.trim().toLocaleLowerCase('es')===name.toLocaleLowerCase('es'))}
function toggleInsurer(text:string,name:string,checked:boolean){const rows=text.split('\n').map(x=>x.trim()).filter(Boolean).filter(x=>x.toLocaleLowerCase('es')!==name.toLocaleLowerCase('es'));return [...rows,...(checked?[name]:[])].join('\n')}
function normalizeMedicalPhone(value:unknown){const digits=String(value||'').replace(/\D/g,'');const local=digits.length===11&&digits.startsWith('1')?digits.slice(1):digits;if(local.length===10&&/^(809|829|849)/.test(local))return local.slice(0,3)+'-'+local.slice(3,6)+'-'+local.slice(6);return String(value||'').trim()}
function validMedicalPhone(value:unknown){const s=String(value||'').trim();return !s||/^\+?[\d\s()-]{8,22}$/.test(s)}
function validMedicalEmail(value:unknown){const s=String(value||'').trim();return !s||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)}
const DAYS=[['1','Lunes'],['2','Martes'],['3','Miércoles'],['4','Jueves'],['5','Viernes'],['6','Sábado'],['7','Domingo']]
const input='mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100'
const label='block text-[11px] font-black uppercase tracking-[.08em] text-slate-500'
const card='rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm'

function publicOrigin(){
  const host=window.location.hostname.toLowerCase()
  return host==='app.preview.intaprd.com'||host.endsWith('.pages.dev')?'https://preview.intaprd.com':'https://intaprd.com'
}

export default function MedicalDashboard({scope='doctor',embedded=false,onOpenAgenda}:MedicalDashboardProps={}){
  const scopeQuery=scope==='sponsor_master'?'scope=sponsor_master':''
  const scoped=(path:string)=>path+(scopeQuery?(path.includes('?')?'&':'?')+scopeQuery:'')
  const openAgenda=()=>onOpenAgenda?onOpenAgenda():window.location.assign('/admin/medical/agenda'+(scopeQuery?'?'+scopeQuery:''))
  const avatarRef=useRef<HTMLInputElement>(null),coverRef=useRef<HTMLInputElement>(null)
  const[tab,setTab]=useState<Tab>('profile')
  const[profile,setProfile]=useState<any>(null)
  const[form,setForm]=useState<any>({})
  const[sponsor,setSponsor]=useState<any>(null)
  const[unread,setUnread]=useState(0)
  const[loading,setLoading]=useState(true)
  const[busy,setBusy]=useState(false)
  const[error,setError]=useState('')
  const[message,setMessage]=useState('')
  const[feedback,setFeedback]=useState<{area:Tab;text:string}|null>(null)
  const showSaved=(area:Tab,text:string)=>{setFeedback({area,text});setMessage('')}
  const[pending,setPending]=useState<PendingImage>(null)
  const[newCenter,setNewCenter]=useState({name:'',address:'',city:'',province:'',phone:'',map_url:''})
  const[editingCenter,setEditingCenter]=useState<any>(null)
  const[newSchedule,setNewSchedule]=useState({center_id:'',day_of_week:1,shift:'',start_time:'08:00',end_time:'12:00',notes:''})
  const[editingSchedule,setEditingSchedule]=useState<any>(null)
  const[acceptedText,setAcceptedText]=useState('')
  const[excludedText,setExcludedText]=useState('')

  async function load(silent=false){
    if(!silent)setLoading(true)
    setError('')
    try{
      const[p,notifications,sponsorJson]:any[]=await Promise.all([
        apiGet(scoped('/me/medical-profile')),
        scope==='doctor'?apiGet('/me/notifications?limit=1').catch(()=>({ok:false})):Promise.resolve({ok:false}),
        scope==='doctor'?apiGet('/me/medical-profile/sponsor-context').catch(()=>({ok:false})):Promise.resolve({ok:false}),
      ])
      if(!p?.ok)throw new Error(p?.error||'No pudimos abrir tu perfil médico.')
      setProfile(p.data);setForm(p.data)
      setAcceptedText((p.data?.insurance_policy?.accepted||[]).map((x:any)=>x.insurance_name||x).join('\n'))
      setExcludedText((p.data?.insurance_policy?.excluded||[]).map((x:any)=>x.insurance_name||x).join('\n'))
      if(notifications?.ok)setUnread(Number(notifications.data?.unread_count||0))
      if(sponsorJson?.ok)setSponsor(sponsorJson.data||null)
    }catch(e){setError(e instanceof Error?e.message:'No pudimos abrir KawMed.')}finally{if(!silent)setLoading(false)}
  }
  useEffect(()=>{void load()},[])

  const slug=String(profile?.slug||'')
  const centers=profile?.centers||[],schedules=profile?.schedules||[]
  const centerById=useMemo(()=>new Map<string,any>(centers.map((c:any)=>[String(c.id),c] as [string,any])),[centers])
  const completeness=useMemo(()=>{
    const checks=[Boolean(profile?.name),Boolean(profile?.specialty),Boolean(profile?.cover_url||profile?.avatar_url),centers.length>0,schedules.length>0]
    return{done:checks.filter(Boolean).length,total:checks.length}
  },[profile,centers.length,schedules.length])

  async function saveProfile(){
    if(!validMedicalPhone(form.phone)||!validMedicalPhone(form.whatsapp)){setError('Introduce un teléfono o WhatsApp válido.');return}
    if(!validMedicalEmail(form.email)){setError('Introduce un correo electrónico válido.');return}
    setBusy(true);setError('');setMessage('')
    try{
      const j:any=await apiPatch(scoped('/me/medical-profile'),{
        slug:form.slug,name:form.name,professional_prefix:form.professional_prefix,specialty:form.specialty,subspecialty:form.subspecialty,
        bio:form.bio,phone:normalizeMedicalPhone(form.phone),whatsapp:normalizeMedicalPhone(form.whatsapp),email:String(form.email||'').trim().toLowerCase(),city:form.city,province:form.province,country:form.country,
        organization:form.organization,status:form.status,
      })
      if(!j?.ok)throw new Error(j?.error||'No pudimos guardar el perfil.')
      setProfile(j.data);setForm(j.data);showSaved('profile','Perfil médico guardado.')
    }catch(e){setError(e instanceof Error?e.message:'No pudimos guardar.')}finally{setBusy(false)}
  }

  function chooseImage(file:File|undefined,kind:'avatar'|'cover'){
    if(!file)return
    if(file.size>12*1024*1024){setError('La imagen original supera 12 MB.');return}
    setPending({file,kind});setError('')
  }
  async function saveImage(blob:Blob,kind:'avatar'|'cover'){
    setBusy(true);setError('');setMessage('')
    try{
      const optimized=await optimizeImageBlobForUpload(blob,{maxDimension:kind==='avatar'?1024:1600,quality:.82,baseName:'kawmed-'+kind})
      const fd=new FormData();fd.append('file',optimized,optimized.name)
      const res=await fetch(`${API_BASE}/me/medical-profile/media?kind=${kind}${scopeQuery?'&'+scopeQuery:''}`,{method:'POST',credentials:'include',body:fd})
      const j:any=await res.json().catch(()=>null)
      if(!res.ok||!j?.ok||!j.url)throw new Error(j?.error||'No pudimos subir la imagen.')
      setProfile((p:any)=>({...p,[kind==='avatar'?'avatar_url':'cover_url']:j.url}))
      setForm((p:any)=>({...p,[kind==='avatar'?'avatar_url':'cover_url']:j.url}))
      setMessage(kind==='avatar'?'Foto actualizada.':'Portada actualizada.')
    }catch(e){setError(e instanceof Error?e.message:'No pudimos subir la imagen.')}finally{setBusy(false)}
  }

  async function addCenter(){
    if(!newCenter.name.trim())return
    setBusy(true);setError('');setMessage('')
    try{
      const j:any=await apiPost(scoped('/me/medical-profile/centers'),newCenter)
      if(!j?.ok)throw new Error(j?.error||'No pudimos agregar el centro.')
      setNewCenter({name:'',address:'',city:'',province:'',phone:'',map_url:''});showSaved('centers','Centro agregado.');await load(true)
    }catch(e){setError(e instanceof Error?e.message:'No pudimos agregar el centro.')}finally{setBusy(false)}
  }
  async function removeCenter(id:string){
    if(!window.confirm('¿Eliminar este centro y sus horarios relacionados?'))return
    setBusy(true)
    try{const j:any=await apiDelete(scoped('/me/medical-profile/centers/'+encodeURIComponent(id)));if(!j?.ok)throw new Error(j?.error||'No pudimos eliminar.');await load()}
    catch(e){setError(e instanceof Error?e.message:'No pudimos eliminar.')}finally{setBusy(false)}
  }
  async function updateCenter(){
    if(!editingCenter?.id||!String(editingCenter.name||'').trim())return
    setBusy(true);setError('');setMessage('')
    try{const j:any=await apiPatch(scoped('/me/medical-profile/centers/'+encodeURIComponent(editingCenter.id)),editingCenter);if(!j?.ok)throw new Error(j?.error||'No pudimos actualizar el centro.');setEditingCenter(null);showSaved('centers','Centro actualizado.');await load(true)}
    catch(e){setError(e instanceof Error?e.message:'No pudimos actualizar el centro.')}finally{setBusy(false)}
  }

  async function addSchedule(){
    if(!newSchedule.center_id)return
    setBusy(true);setError('');setMessage('')
    try{
      const j:any=await apiPost(scoped('/me/medical-profile/schedules'),newSchedule)
      if(!j?.ok)throw new Error(j?.error||'No pudimos agregar el horario.')
      setNewSchedule({center_id:'',day_of_week:1,shift:'',start_time:'08:00',end_time:'12:00',notes:''});showSaved('schedule','Horario agregado.');await load(true)
    }catch(e){setError(e instanceof Error?e.message:'No pudimos agregar el horario.')}finally{setBusy(false)}
  }
  async function removeSchedule(id:string){
    setBusy(true)
    try{const j:any=await apiDelete(scoped('/me/medical-profile/schedules/'+encodeURIComponent(id)));if(!j?.ok)throw new Error(j?.error||'No pudimos eliminar.');await load()}
    catch(e){setError(e instanceof Error?e.message:'No pudimos eliminar.')}finally{setBusy(false)}
  }
  async function updateSchedule(){
    if(!editingSchedule?.id||!editingSchedule?.center_id)return
    setBusy(true);setError('');setMessage('')
    try{const j:any=await apiPatch(scoped('/me/medical-profile/schedules/'+encodeURIComponent(editingSchedule.id)),editingSchedule);if(!j?.ok)throw new Error(j?.error||'No pudimos actualizar el horario.');setEditingSchedule(null);showSaved('schedule','Horario actualizado.');await load(true)}
    catch(e){setError(e instanceof Error?e.message:'No pudimos actualizar el horario.')}finally{setBusy(false)}
  }

  async function saveInsurance(){
    const accepted=acceptedText.split(/\n|,/).map(x=>x.trim()).filter(Boolean)
    const excluded=excludedText.split(/\n|,/).map(x=>x.trim()).filter(Boolean)
    setBusy(true);setError('');setMessage('')
    try{const j:any=await apiPut(scoped('/me/medical-profile/insurances'),{accepted,excluded});if(!j?.ok)throw new Error(j?.error||'No pudimos guardar seguros.');showSaved('insurance','Seguros y excepciones guardados.');await load(true)}
    catch(e){setError(e instanceof Error?e.message:'No pudimos guardar seguros.')}finally{setBusy(false)}
  }

  if(loading)return embedded?<div className="min-h-[320px] rounded-[24px] border border-slate-200 bg-white"/>:<main className="min-h-screen bg-slate-50"/>
  if(!profile)return embedded?<div className="rounded-[24px] border border-slate-200 bg-white p-6"><h2 className="text-xl font-black">Perfil KawMed no disponible</h2><p className="mt-2 text-sm text-slate-500">{error}</p></div>:<main className="min-h-screen bg-slate-50 p-6 font-['Inter']"><div className="mx-auto max-w-xl rounded-3xl bg-white p-6"><h1 className="text-2xl font-black">KawMed no disponible</h1><p className="mt-2 text-sm text-slate-500">{error}</p></div></main>

  const Shell:any=embedded?'div':'main'
  return <Shell className={embedded?"font-['Inter'] text-slate-950":"min-h-screen bg-slate-50 px-4 py-6 font-['Inter'] text-slate-950"}><div className={embedded?"w-full space-y-5":"mx-auto w-full max-w-5xl space-y-5"}>
    <header className={card}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[11px] font-black uppercase tracking-[.18em] text-cyan-700">{scope==='sponsor_master'?'KAWMED · PRESENTACIÓN MASTER':'KAWMED · PERFIL MÉDICO'}</p><h1 className="mt-2 text-3xl font-black tracking-[-.04em]">{[profile.professional_prefix,profile.name].filter(Boolean).join(' ')}</h1><p className="mt-1 text-sm font-bold text-cyan-800">{profile.specialty}</p><p className="mt-2 text-sm text-slate-500">{scope==='sponsor_master'?'Configura tu presentación pública de ejemplo con la misma experiencia KawMed que reciben los médicos asociados.':'Configura exactamente la información que verán tus pacientes: perfil profesional, centros, horarios, agenda y seguros.'}</p></div><div className="flex flex-wrap gap-2">{scope==='doctor'&&<button onClick={()=>window.location.assign('/admin/medical/notifications')} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-black">Notificaciones{unread>0?' · '+unread:''}</button>}{slug&&<button onClick={()=>window.open(publicOrigin()+'/m/'+encodeURIComponent(slug),'_blank','noopener,noreferrer')} className="rounded-xl bg-slate-950 px-4 py-3 text-xs font-black text-white">Ver perfil público</button>}</div></div><div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500"><span className="rounded-full bg-emerald-50 px-3 py-2 text-emerald-700">{completeness.done}/{completeness.total} base configurada</span><span className="rounded-full bg-slate-100 px-3 py-2">{profile.status==='active'?'Publicado':profile.status==='inactive'?'Inactivo':'Borrador'}</span></div></header>

    {sponsor&&<section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">{sponsor.banner_image_url?(sponsor.cta_url?<a href={sponsor.cta_url} target="_blank" rel="noopener noreferrer"><img src={sponsor.banner_image_url} alt={sponsor.name||'Patrocinador'} className="block h-auto w-full object-contain bg-white"/></a>:<img src={sponsor.banner_image_url} alt={sponsor.name||'Patrocinador'} className="block h-auto w-full object-contain bg-white"/>):<div className="flex items-center gap-4 p-5">{sponsor.logo_url&&<img src={sponsor.logo_url} alt={sponsor.name||'Patrocinador'} className="h-14 w-14 object-contain"/>}<div><p className="text-[11px] font-black uppercase tracking-[.14em] text-slate-400">Patrocinio profesional privado</p><h2 className="mt-1 text-lg font-black">{sponsor.name}</h2></div></div>}<div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-4"><div><p className="text-xs leading-5 text-slate-500">Solo tú ves esta relación comercial. No aparece en tu perfil público para pacientes.</p>{sponsor.representative&&<p className="mt-1 text-xs font-bold text-slate-700">Visitador: {sponsor.representative.name}{sponsor.representative.zone?' · '+sponsor.representative.zone:''}</p>}</div><div className="flex flex-wrap gap-2">{sponsor.representative?.url&&<a href={sponsor.representative.url} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-cyan-100 px-4 py-3 text-xs font-black text-cyan-900 ring-1 ring-cyan-300 transition-colors hover:bg-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700">Contactar mi visitador</a>}{sponsor.vademecum_url&&<a href={sponsor.vademecum_url} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-700">{sponsor.vademecum_label||'Ver vademécum'}</a>}</div></div></section>}

    {message&&<div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</div>}
    {error&&<div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>}

    <nav className="grid grid-cols-2 gap-2 rounded-[22px] border border-slate-200 bg-white p-2 sm:grid-cols-4">{([['profile','Perfil'],['centers','Centros'],['schedule','Horarios'],['insurance','Seguros']] as [Tab,string][]).map(([key,title])=><button key={key} onClick={()=>setTab(key)} className={'rounded-2xl px-3 py-3 text-sm font-black '+(tab===key?'bg-slate-950 text-white':'text-slate-500 hover:bg-slate-50')}>{title}</button>)}</nav>

    {tab==='profile'&&<section className={card}><div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-black">Perfil profesional</h2><p className="mt-1 text-sm text-slate-500">Estos datos forman la cabecera y presentación pública de tu perfil médico.</p></div><button onClick={openAgenda} className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-xs font-black text-cyan-700">Configurar Agenda</button></div><div className="mt-5 grid gap-4 md:grid-cols-2"><div className="md:col-span-2"><p className={label}>Fotografía principal</p><p className="mt-1 text-xs normal-case text-slate-500">Es la imagen destacada del perfil. El degradado inferior se aplica automáticamente y no cubre los botones.</p><button onClick={()=>coverRef.current?.click()} className="mt-2 w-full rounded-2xl border border-slate-200 p-3 text-sm font-bold">Subir / cambiar fotografía</button><input ref={coverRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e=>{const file=e.target.files?.[0];e.target.value='';chooseImage(file,'cover')}}/>{(profile.cover_url||profile.avatar_url)&&<img src={profile.cover_url||profile.avatar_url} alt="Fotografía principal actual" className="mx-auto mt-3 aspect-[4/4.25] max-h-80 w-full max-w-sm rounded-2xl object-cover"/>}</div><label className={label}>Prefijo<input className={input} value={form.professional_prefix||''} onChange={e=>setForm({...form,professional_prefix:e.target.value})} placeholder="Dra. / Dr."/></label><label className={label}>Nombre<input className={input} value={form.name||''} onChange={e=>setForm({...form,name:e.target.value})}/></label><div><label className={label}>Especialidad principal<input className={input} list="kawmed-medical-specialties" value={String(form.specialty||'').split(' | ')[0]} onChange={e=>{const more=String(form.specialty||'').split(' | ').slice(1);setForm({...form,specialty:[e.target.value,...more].filter(Boolean).join(' | ')})}} placeholder="Selecciona o escribe la especialidad"/></label><datalist id="kawmed-medical-specialties">{MEDICAL_SPECIALTIES.map(x=><option key={x} value={x}/>)}</datalist><details className="mt-2 rounded-xl border border-slate-200 p-3"><summary className="cursor-pointer text-xs font-bold text-cyan-800">+ Agregar otra especialidad</summary><p className="mt-2 text-xs text-slate-500">Puedes seleccionar una sugerencia o escribir otra especialidad.</p><input className={input} list="kawmed-medical-specialties" placeholder="Otra especialidad" onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();const value=e.currentTarget.value.trim();if(value){setForm((prev:any)=>({...prev,specialty:[...String(prev.specialty||'').split(' | ').filter(Boolean),value].join(' | ')}));e.currentTarget.value=''}}}}/><button type="button" onClick={e=>{const el=e.currentTarget.previousElementSibling as HTMLInputElement|null;const value=el?.value.trim();if(value){setForm((prev:any)=>({...prev,specialty:[...String(prev.specialty||'').split(' | ').filter(Boolean),value].join(' | ')}));if(el)el.value=''}}} className="mt-2 rounded-lg bg-cyan-50 px-3 py-2 text-xs font-bold text-cyan-800">Añadir especialidad</button><div className="mt-2 flex flex-wrap gap-2">{String(form.specialty||'').split(' | ').slice(1).filter(Boolean).map((name:string,i:number)=><button type="button" key={i} onClick={()=>setForm((prev:any)=>({...prev,specialty:String(prev.specialty||'').split(' | ').filter((_:string,j:number)=>j!==i+1).join(' | ')}))} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">{name} ×</button>)}</div></details></div><label className={label}>Subespecialidad<input className={input} value={form.subspecialty||''} onChange={e=>setForm({...form,subspecialty:e.target.value})}/></label><label className={label+' md:col-span-2'}>Presentación<textarea className={input} rows={4} value={form.bio||''} onChange={e=>setForm({...form,bio:e.target.value})}/></label><label className={label}>WhatsApp<input type="tel" inputMode="tel" autoComplete="tel" className={input} value={form.whatsapp||''} onChange={e=>setForm({...form,whatsapp:e.target.value})}/></label><label className={label}>Teléfono<input type="tel" inputMode="tel" autoComplete="tel" className={input} value={form.phone||''} onChange={e=>setForm({...form,phone:e.target.value})}/></label><label className={label}>Correo<input type="email" autoComplete="email" className={input} value={form.email||''} onChange={e=>setForm({...form,email:e.target.value})}/></label><label className={label}>Enlace público<input className={input} value={form.slug||''} onChange={e=>setForm({...form,slug:e.target.value})}/></label><label className={label}>Ciudad<input className={input} value={form.city||''} onChange={e=>setForm({...form,city:e.target.value})}/></label><label className={label}>Provincia<input className={input} value={form.province||''} onChange={e=>setForm({...form,province:e.target.value})}/></label><label className={label}>Estado<select className={input} value={form.status||'draft'} onChange={e=>setForm({...form,status:e.target.value})}><option value="draft">Borrador</option><option value="active">Publicado</option><option value="inactive">Inactivo</option></select></label></div><button onClick={()=>void saveProfile()} disabled={busy} className="mt-5 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-40">Guardar perfil médico</button>{feedback?.area==='profile'&&<p role="status" className="mt-2 text-sm font-semibold text-emerald-700">{feedback.text}</p>}</section>}

    {tab==='centers'&&<section className={card}><h2 className="text-xl font-black">Centros de atención</h2><p className="mt-1 text-sm text-slate-500">Los pacientes verán estos centros con ubicación y teléfono cuando estén disponibles.</p><div className="mt-4 grid gap-3">{centers.map((c:any)=><article key={c.id} className="rounded-2xl border border-slate-200 p-4">{editingCenter?.id===c.id?<><div className="grid gap-3 md:grid-cols-2"><label className={label}>Nombre<input className={input} value={editingCenter.name||''} onChange={e=>setEditingCenter({...editingCenter,name:e.target.value})}/></label><label className={label}>Teléfono<input type="tel" inputMode="tel" className={input} value={editingCenter.phone||''} onChange={e=>setEditingCenter({...editingCenter,phone:e.target.value})}/></label><label className={label+' md:col-span-2'}>Dirección<input className={input} value={editingCenter.address||''} onChange={e=>setEditingCenter({...editingCenter,address:e.target.value})}/></label><label className={label}>Ciudad<input className={input} value={editingCenter.city||''} onChange={e=>setEditingCenter({...editingCenter,city:e.target.value})}/></label><label className={label}>Provincia<input className={input} value={editingCenter.province||''} onChange={e=>setEditingCenter({...editingCenter,province:e.target.value})}/></label><div className="md:col-span-2"><MedicalCenterLocationPicker address={editingCenter.address||''} mapUrl={editingCenter.map_url||''} onChange={values=>setEditingCenter((previous:any)=>({...previous,...values}))}/></div></div><div className="mt-3 flex gap-2"><button onClick={()=>void updateCenter()} disabled={busy} className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white">Guardar</button><button onClick={()=>setEditingCenter(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black">Cancelar</button></div></>:<div className="flex items-start justify-between gap-3"><div><p className="font-black">{c.name}</p><p className="mt-1 text-sm text-slate-500">{[c.address,c.city,c.province].filter(Boolean).join(' · ')||'Sin dirección'}</p>{c.phone&&<p className="mt-1 text-xs font-bold text-slate-600">{c.phone}</p>}</div><div className="flex gap-3"><button onClick={()=>setEditingCenter({...c})} className="text-xs font-black text-cyan-700">Editar</button><button onClick={()=>void removeCenter(c.id)} disabled={busy} className="text-xs font-black text-rose-600">Eliminar</button></div></div>}</article>)}</div><div className="mt-5 border-t border-slate-100 pt-5"><h3 className="font-black">Agregar centro</h3><div className="mt-3 grid gap-3 md:grid-cols-2"><label className={label}>Nombre<input className={input} value={newCenter.name} onChange={e=>setNewCenter({...newCenter,name:e.target.value})}/></label><label className={label}>Teléfono<input type="tel" inputMode="tel" className={input} value={newCenter.phone} onChange={e=>setNewCenter({...newCenter,phone:e.target.value})}/></label><label className={label+' md:col-span-2'}>Dirección<input className={input} value={newCenter.address} onChange={e=>setNewCenter({...newCenter,address:e.target.value})}/></label><label className={label}>Ciudad<input className={input} value={newCenter.city} onChange={e=>setNewCenter({...newCenter,city:e.target.value})}/></label><label className={label}>Provincia<input className={input} value={newCenter.province} onChange={e=>setNewCenter({...newCenter,province:e.target.value})}/></label><div className="md:col-span-2"><MedicalCenterLocationPicker address={newCenter.address} mapUrl={newCenter.map_url} onChange={values=>setNewCenter(previous=>({...previous,...values}))}/></div></div><button onClick={()=>void addCenter()} disabled={busy||!newCenter.name.trim()} className="mt-4 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-40">Agregar centro</button>{feedback?.area==='centers'&&<p role="status" className="mt-2 text-sm font-semibold text-emerald-700">{feedback.text}</p>}</div></section>}

    {tab==='schedule'&&<section className={card}><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-black">Horarios de consulta</h2><p className="mt-1 text-sm text-slate-500">Cada horario está asociado a uno de tus centros de atención.</p></div><button onClick={openAgenda} className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-xs font-black text-cyan-700">Disponibilidad de Agenda</button></div><div className="mt-4 grid gap-3">{schedules.map((row:any)=><article key={row.id} className="rounded-2xl border border-slate-200 p-4">{editingSchedule?.id===row.id?<><div className="grid gap-3 md:grid-cols-2"><label className={label}>Centro<select className={input} value={editingSchedule.center_id||''} onChange={e=>setEditingSchedule({...editingSchedule,center_id:e.target.value})}>{centers.map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className={label}>Día<select className={input} value={editingSchedule.day_of_week||1} onChange={e=>setEditingSchedule({...editingSchedule,day_of_week:Number(e.target.value)})}>{DAYS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label className={label}>Desde<input type="time" className={input} value={editingSchedule.start_time||''} onChange={e=>setEditingSchedule({...editingSchedule,start_time:e.target.value})}/></label><label className={label}>Hasta<input type="time" className={input} value={editingSchedule.end_time||''} onChange={e=>setEditingSchedule({...editingSchedule,end_time:e.target.value})}/></label><label className={label}>Tanda<input className={input} value={editingSchedule.shift||''} onChange={e=>setEditingSchedule({...editingSchedule,shift:e.target.value})}/></label></div><div className="mt-3 flex gap-2"><button onClick={()=>void updateSchedule()} disabled={busy} className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white">Guardar</button><button onClick={()=>setEditingSchedule(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black">Cancelar</button></div></>:<div className="flex items-start justify-between gap-3"><div><p className="font-black">{DAYS.find(d=>Number(d[0])===Number(row.day_of_week))?.[1]||row.day_of_week} · {row.start_time}–{row.end_time}</p><p className="mt-1 text-sm text-slate-500">{centerById.get(String(row.center_id))?.name||'Centro'}{row.shift?' · '+row.shift:''}</p></div><div className="flex gap-3"><button onClick={()=>setEditingSchedule({...row})} className="text-xs font-black text-cyan-700">Editar</button><button onClick={()=>void removeSchedule(row.id)} disabled={busy} className="text-xs font-black text-rose-600">Eliminar</button></div></div>}</article>)}</div><div className="mt-5 border-t border-slate-100 pt-5"><h3 className="font-black">Agregar horario</h3><div className="mt-3 grid gap-3 md:grid-cols-2"><label className={label}>Centro<select className={input} value={newSchedule.center_id} onChange={e=>setNewSchedule({...newSchedule,center_id:e.target.value})}><option value="">Seleccionar</option>{centers.map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className={label}>Día<select className={input} value={newSchedule.day_of_week} onChange={e=>setNewSchedule({...newSchedule,day_of_week:Number(e.target.value)})}>{DAYS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label className={label}>Desde<input type="time" className={input} value={newSchedule.start_time} onChange={e=>setNewSchedule({...newSchedule,start_time:e.target.value})}/></label><label className={label}>Hasta<input type="time" className={input} value={newSchedule.end_time} onChange={e=>setNewSchedule({...newSchedule,end_time:e.target.value})}/></label><label className={label}>Tanda / nota corta<input className={input} value={newSchedule.shift} onChange={e=>setNewSchedule({...newSchedule,shift:e.target.value})} placeholder="Mañana / Tarde"/></label></div><button onClick={()=>void addSchedule()} disabled={busy||!newSchedule.center_id} className="mt-4 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-40">Agregar horario</button>{feedback?.area==='schedule'&&<p role="status" className="mt-2 text-sm font-semibold text-emerald-700">{feedback.text}</p>}</div></section>}

    {tab==='insurance'&&<section className={card}><h2 className="text-xl font-black">Seguros médicos</h2><p className="mt-1 text-sm text-slate-500">Publica los seguros que aceptas y, por separado, los planes o coberturas que son excepción.</p><div className="mt-4 grid gap-4 md:grid-cols-2"><div><details className="mb-3 rounded-2xl border border-cyan-100 bg-cyan-50/50 p-3"><summary className="cursor-pointer text-sm font-bold text-cyan-900">Seleccionar seguros de la lista</summary><div className="mt-3 grid gap-2 sm:grid-cols-2">{MEDICAL_INSURERS.map(name=><label key={name} className="flex items-center gap-2 text-xs font-semibold text-slate-700"><input type="checkbox" checked={selectedInsurer(acceptedText,name)} onChange={e=>setAcceptedText(current=>toggleInsurer(current,name,e.target.checked))}/>{name}</label>)}</div><p className="mt-3 text-xs text-slate-500">¿No está en la lista? Agrégala manualmente abajo.</p></details><label className={label}>Seguros aceptados<textarea className={input} rows={8} value={acceptedText} onChange={e=>setAcceptedText(e.target.value)} placeholder={'ARS Humano\nARS Universal\nMAPFRE Salud'}/><span className="mt-1 block text-xs normal-case tracking-normal text-slate-400">También puedes escribir otros seguros aquí, uno por línea.</span></label></div><label className={label}>Excepciones / no aceptados<textarea className={input} rows={8} value={excludedText} onChange={e=>setExcludedText(e.target.value)} placeholder={'Plan específico X\nSeguro Y'}/><span className="mt-1 block text-xs normal-case tracking-normal text-slate-400">Uno por línea. Solo agrega excepciones reales.</span></label></div><button onClick={()=>void saveInsurance()} disabled={busy} className="mt-4 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-40">Guardar seguros</button>{feedback?.area==='insurance'&&<p role="status" className="mt-2 text-sm font-semibold text-emerald-700">{feedback.text}</p>}</section>}

    {pending&&<ImageCropModal file={pending.file} aspectRatio={pending.kind==='avatar'?1:4/4.25} outputWidth={pending.kind==='avatar'?1024:1200} onSave={async(blob)=>{const kind=pending.kind;setPending(null);await saveImage(blob,kind)}} onCancel={()=>setPending(null)}/>}
  </div></Shell>
}
