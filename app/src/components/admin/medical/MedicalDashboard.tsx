import { useEffect, useMemo, useRef, useState } from 'react'
import { activeIntapTabHeaders, kawmedGuestHeaders, API_BASE, apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../../../lib/api'
import { optimizeImageBlobForUpload } from '../../../lib/imageUploadOptimization'
import ImageCropModal from '../ImageCropModal'
import MedicalCenterLocationPicker from './MedicalCenterLocationPicker'

type Tab='profile'|'centers'|'schedule'|'insurance'|'appearance'|'public'
type MedicalDashboardProps={scope?:'doctor'|'sponsor_master';embedded?:boolean;onOpenAgenda?:()=>void}
type PendingImage={file:File;kind:'avatar'|'cover'}|null
const MEDICAL_SPECIALTIES=["Medicina general","Medicina familiar","Medicina interna","Pediatría","Neonatología","Medicina del adolescente","Ginecología","Obstetricia","Ginecología y obstetricia","Medicina materno-fetal","Endocrinología reproductiva e infertilidad","Oncología ginecológica","Oftalmología","Oftalmología pediátrica","Retinología","Glaucomatología","Ortopedia y traumatología","Ortopedia pediátrica","Cirugía de columna","Cirugía de mano","Medicina deportiva","Cirugía general","Cirugía pediátrica","Cirugía plástica y reconstructiva","Cirugía cardiovascular","Cirugía torácica","Cirugía vascular","Neurocirugía","Cirugía maxilofacial","Coloproctología","Cardiología","Cardiología pediátrica","Cardiología intervencionista","Electrofisiología cardíaca","Dermatología","Dermatología pediátrica","Endocrinología","Endocrinología pediátrica","Diabetología","Gastroenterología","Gastroenterología pediátrica","Hepatología","Neumología","Neumología pediátrica","Neurología","Neurología pediátrica","Neurofisiología clínica","Nefrología","Nefrología pediátrica","Urología","Urología pediátrica","Otorrinolaringología","Otorrinolaringología pediátrica","Psiquiatría","Psiquiatría infantil y adolescente","Oncología médica","Oncología pediátrica","Radioterapia oncológica","Hematología","Hematología pediátrica","Infectología","Infectología pediátrica","Reumatología","Reumatología pediátrica","Geriatría","Anestesiología","Anestesiología pediátrica","Medicina del dolor","Radiología diagnóstica","Radiología intervencionista","Neurorradiología","Medicina nuclear","Medicina de emergencias","Medicina crítica y cuidados intensivos","Medicina física y rehabilitación","Fisiatría","Alergología e inmunología clínica","Genética médica","Anatomía patológica","Patología clínica","Medicina forense","Medicina ocupacional","Medicina preventiva y salud pública","Epidemiología","Medicina paliativa","Medicina del sueño","Toxicología médica","Medicina hiperbárica","Nutriología clínica","Odontología","Ortodoncia","Endodoncia","Periodoncia","Odontopediatría","Cirugía bucal y maxilofacial"]
const MEDICAL_INSURERS=['ARS Humano','ARS Universal','MAPFRE Salud','ARS Primera','ARS Palic','ARS Monumental','ARS Futuro','ARS CMD','ARS SEMMA','SENASA','ARS Reservas','ARS Yunen']
function selectedInsurer(text:string,name:string){return text.split('\n').some(v=>v.trim().toLocaleLowerCase('es')===name.toLocaleLowerCase('es'))}
function toggleInsurer(text:string,name:string,checked:boolean){const rows=text.split('\n').map(x=>x.trim()).filter(Boolean).filter(x=>x.toLocaleLowerCase('es')!==name.toLocaleLowerCase('es'));return [...rows,...(checked?[name]:[])].join('\n')}
function normalizeMedicalPhone(value:unknown){const digits=String(value||'').replace(/\D/g,'');const local=digits.length===11&&digits.startsWith('1')?digits.slice(1):digits;if(local.length===10&&/^(809|829|849)/.test(local))return local.slice(0,3)+'-'+local.slice(3,6)+'-'+local.slice(6);return String(value||'').trim()}
function validMedicalPhone(value:unknown){const s=String(value||'').trim();return !s||/^\+?[\d\s()-]{8,22}$/.test(s)}
function validMedicalEmail(value:unknown){const s=String(value||'').trim();return !s||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)}
const DAYS=[['1','Lunes'],['2','Martes'],['3','Miércoles'],['4','Jueves'],['5','Viernes'],['6','Sábado'],['7','Domingo']]
const input='mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-base sm:text-sm font-semibold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100'
const label='block text-sm sm:text-[11px] font-black uppercase tracking-[.08em] text-slate-500'
const card='rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm'
const headerActionMotion='transition-[background-color,transform,box-shadow] duration-200 ease-out hover:shadow-md active:scale-[.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700 motion-reduce:transition-none disabled:active:scale-100 disabled:hover:shadow-none'

function publicOrigin(){
  const host=window.location.hostname.toLowerCase()
  return host==='app.preview.intaprd.com'||host.endsWith('.pages.dev')?'https://preview.intaprd.com':'https://intaprd.com'
}

export default function MedicalDashboard({scope='doctor',embedded=false,onOpenAgenda}:MedicalDashboardProps={}){
  const scopeQuery=scope==='sponsor_master'?'scope=sponsor_master':''
  const isLiveGuest=/^\/admin\/medical\/demo\//.test(window.location.pathname)
  const scoped=(path:string)=>path+(scopeQuery?(path.includes('?')?'&':'?')+scopeQuery:'')
  const openAgenda=()=>onOpenAgenda?onOpenAgenda():window.location.assign('/admin/medical/agenda'+(scopeQuery?'?'+scopeQuery:''))
  const[pwaInstalled,setPwaInstalled]=useState(()=>window.matchMedia('(display-mode: standalone)').matches||Boolean((window.navigator as any).standalone))
  const[showPwaHelp,setShowPwaHelp]=useState(false)
  const[signingOut,setSigningOut]=useState(false)
  const installPwa=async()=>{
    if(pwaInstalled)return
    const prompt=(window as any).__kawvoInstallPrompt
    if(!prompt){setShowPwaHelp(true);return}
    try{
      await prompt.prompt()
      const choice=await prompt.userChoice
      ;(window as any).__kawvoInstallPrompt=null
      if(choice?.outcome==='accepted'){localStorage.setItem('kawvo_pwa_installed','1');setPwaInstalled(true)}
    }catch{setShowPwaHelp(true)}
  }
  const logoutKawMed=async()=>{
    if(signingOut)return
    setSigningOut(true)
    try{await apiPost('/auth/logout',{})}catch{/* La pantalla de login vuelve a validar la sesión. */}
    window.location.replace('/admin/login')
  }

  const avatarRef=useRef<HTMLInputElement>(null),coverRef=useRef<HTMLInputElement>(null)
  const[tab,setTab]=useState<Tab>('profile')
  const[publicationConfirm,setPublicationConfirm]=useState<'publish'|'unpublish'|null>(null)
  const[publicationPending,setPublicationPending]=useState<'publish'|'unpublish'|null>(null)
  const[publicationNotice,setPublicationNotice]=useState<{kind:'success'|'error';text:string}|null>(null)
  const publicationConfirmRef=useRef<HTMLButtonElement>(null)
  const publicationPublishTriggerRef=useRef<HTMLButtonElement>(null)
  const publicationUnpublishTriggerRef=useRef<HTMLButtonElement>(null)
  const[previewOpen,setPreviewOpen]=useState(false)
  const[lifecycleBusy,setLifecycleBusy]=useState(false)
  const[showDeletion,setShowDeletion]=useState(false)
  const[deleteEmail,setDeleteEmail]=useState('')
  const[deleteSlug,setDeleteSlug]=useState('')
  const[deletePhrase,setDeletePhrase]=useState('')
  const[lifecycleConfirm,setLifecycleConfirm]=useState<'suspend'|'reactivate'|null>(null)
  const[profile,setProfile]=useState<any>(null)
  const[form,setForm]=useState<any>({})
  const[secondaryDraft,setSecondaryDraft]=useState('')
  const secondarySavingRef=useRef(false)
  const secondaryAttemptedRef=useRef('')
  const[sponsor,setSponsor]=useState<any>(null)
  const[unread,setUnread]=useState(0)
  const[loading,setLoading]=useState(true)
  const[busy,setBusy]=useState(false)
  const[error,setError]=useState('')
  const[message,setMessage]=useState('')
  const[feedback,setFeedback]=useState<{area:Tab;text:string}|null>(null)
  const showSaved=(area:Tab,text:string)=>{setFeedback({area,text});setMessage('')}
  const openPublicationConfirm=(action:'publish'|'unpublish')=>{
    if(busy)return
    setPublicationNotice(null)
    setPublicationConfirm(action)
  }
  const cancelPublicationConfirm=()=>{
    if(publicationPending)return
    const action=publicationConfirm
    setPublicationConfirm(null)
    if(action==='publish')publicationPublishTriggerRef.current?.focus()
    if(action==='unpublish')publicationUnpublishTriggerRef.current?.focus()
  }
  useEffect(()=>{if(publicationConfirm&&!publicationPending)publicationConfirmRef.current?.focus()},[publicationConfirm])
  const[pending,setPending]=useState<PendingImage>(null)
  const[newCenter,setNewCenter]=useState({name:'',address:'',city:'',province:'',phone:'',map_url:''})
  const[editingCenter,setEditingCenter]=useState<any>(null)
  const[newSchedule,setNewSchedule]=useState({center_id:'',day_of_week:1,shift:'',start_time:'08:00',end_time:'12:00',notes:''})
  const[editingSchedule,setEditingSchedule]=useState<any>(null)
  const[selectedDays,setSelectedDays]=useState<number[]>([1,2,3,4,5])
  const[acceptedText,setAcceptedText]=useState('')
  const[excludedText,setExcludedText]=useState('')

  async function load(silent=false){
    if(!silent)setLoading(true)
    setError('')
    try{
      const[p,notifications,sponsorJson]:any[]=await Promise.all([
        apiGet(scoped('/me/medical-profile')),
        scope==='doctor'?apiGet('/me/medical-profile/appointments').catch(()=>({ok:false})):Promise.resolve({ok:false}),
        scope==='doctor'?apiGet('/me/medical-profile/sponsor-context').catch(()=>({ok:false})):Promise.resolve({ok:false}),
      ])
      if(!p?.ok)throw new Error(p?.error||'No pudimos abrir tu perfil médico.')
      setProfile(p.data);setForm(p.data)
      setAcceptedText((p.data?.insurance_policy?.accepted||[]).map((x:any)=>x.insurance_name||x).join('\n'))
      setExcludedText((p.data?.insurance_policy?.excluded||[]).map((x:any)=>x.insurance_name||x).join('\n'))
      if(notifications?.ok)setUnread(Array.isArray(notifications.data?.requests)?notifications.data.requests.filter((r:any)=>r.status==='pending').length:0)
      if(sponsorJson?.ok)setSponsor(sponsorJson.data||null)
    }catch(e){setError(e instanceof Error?e.message:'No pudimos abrir KawMed.')}finally{if(!silent)setLoading(false)}
  }
  useEffect(()=>{void load()},[])

  const slug=String(profile?.slug||'')
  const centers=profile?.centers||[],schedules=profile?.schedules||[]
  const centerById=useMemo(()=>new Map<string,any>(centers.map((c:any)=>[String(c.id),c] as [string,any])),[centers])
  const completeness=useMemo(()=>{
    const checks=[
      {label:'Nombre',ready:Boolean(profile?.name)},
      {label:'Especialidad',ready:Boolean(profile?.specialty)},
      {label:'Fotografía o portada',ready:Boolean(profile?.cover_url||profile?.avatar_url)},
      {label:'Centro de atención',ready:centers.length>0},
      {label:'Horario de atención',ready:schedules.length>0},
    ]
    return{done:checks.filter(item=>item.ready).length,total:checks.length,missing:checks.filter(item=>!item.ready).map(item=>item.label)}
  },[profile,centers.length,schedules.length])

  // Estos tres requisitos deben coincidir con la validación real de /publication.
  // El progreso 5/5 es una recomendación de presentación y NO bloquea la publicación.
  const publicationReadiness=useMemo(()=>{
    const mandatory=[
      {label:'Nombre profesional',ready:Boolean(String(profile?.name||'').trim()),tab:'profile' as Tab},
      {label:'Especialidad médica',ready:Boolean(String(profile?.specialty||'').trim()),tab:'profile' as Tab},
      {label:'Enlace público (usuario)',ready:Boolean(String(profile?.slug||'').trim()),tab:'profile' as Tab},
    ]
    const recommended=[
      {label:'Fotografía o portada',ready:Boolean(profile?.cover_url||profile?.avatar_url),tab:'profile' as Tab},
      {label:'Centro de atención',ready:centers.length>0,tab:'centers' as Tab},
      {label:'Horario de atención',ready:schedules.length>0,tab:'schedule' as Tab},
    ]
    const savedChangesPending=['name','specialty','slug'].some(key=>String(form?.[key]??'').trim()!==String(profile?.[key]??'').trim())
    const missing=mandatory.filter(item=>!item.ready)
    return {mandatory,recommended,missing,savedChangesPending,canPublish:missing.length===0&&!savedChangesPending}
  },[profile,form?.name,form?.specialty,form?.slug,centers.length,schedules.length])

  async function changePublication(action:'publish'|'unpublish'){
    if(busy)return
    if(action==='publish'&&!publicationReadiness.canPublish){
      setError(publicationReadiness.missing.length>0
        ?'Para publicar, completa y guarda: '+publicationReadiness.missing.map(item=>item.label).join(', ')+'.'
        :'Guarda los cambios de nombre, especialidad o enlace público antes de publicar.')
      setPublicationConfirm(null)
      return
    }
    setBusy(true);setPublicationPending(action);setPublicationNotice(null);setError('');setMessage('')
    try{
      const result:any=await apiPost(scoped('/me/medical-profile/publication'),{action,confirm:true})
      if(!result?.ok)throw new Error(result?.error||'No se pudo actualizar la publicación.')
      setProfile((current:any)=>({...current,status:result.data.status}))
      setForm((current:any)=>({...current,status:result.data.status}))
      const confirmedMessage=action==='publish'?'Perfil publicado correctamente. Ya está disponible en su enlace público.':'Perfil despublicado correctamente. Ya no está disponible públicamente.'
      setPublicationNotice({kind:'success',text:confirmedMessage})
      setPublicationConfirm(null)
    }catch(e){
      const text=e instanceof Error?e.message:'No se pudo modificar la publicación.'
      setPublicationNotice({kind:'error',text})
    }finally{setPublicationPending(null);setBusy(false)}
  }

  async function saveProfile(specialtyOverride?:string){
    if(!validMedicalPhone(form.phone)||!validMedicalPhone(form.whatsapp)){setError('Introduce un teléfono o WhatsApp válido.');return}
    if(!validMedicalEmail(form.email)){setError('Introduce un correo electrónico válido.');return}
    setBusy(true);setError('');setMessage('')
    try{
      const j:any=await apiPatch(scoped('/me/medical-profile'),{
        slug:form.slug,name:form.name,professional_prefix:form.professional_prefix,specialty:specialtyOverride??form.specialty,subspecialty:form.subspecialty,
        bio:form.bio,phone:normalizeMedicalPhone(form.phone),whatsapp:normalizeMedicalPhone(form.whatsapp),email:String(form.email||'').trim().toLowerCase(),city:form.city,province:form.province,country:form.country,
        organization:form.organization,status:form.status,
      })
      if(!j?.ok)throw new Error(j?.error||'No pudimos guardar el perfil.')
      setProfile(j.data);setForm(j.data);showSaved('profile','Perfil médico guardado.');return true
    }catch(e){setError(e instanceof Error?e.message:'No pudimos guardar.');return false}finally{setBusy(false)}
  }

  async function addSecondarySpecialty(){
    const value=secondaryDraft.trim()
    if(!value||secondarySavingRef.current||secondaryAttemptedRef.current===value)return
    secondaryAttemptedRef.current=value
    const existing=String(form.specialty||'').split(' | ').map(x=>x.trim()).filter(Boolean)
    if(existing.some(x=>x.toLocaleLowerCase('es')===value.toLocaleLowerCase('es'))){setError('Esta especialidad ya está agregada.');return}
    secondarySavingRef.current=true
    setBusy(true);setError('');setFeedback(null)
    try{
      const result:any=await apiPost(scoped('/me/medical-profile/specialties'),{specialty:value})
      if(!result?.ok)throw new Error(result?.error||'No se pudo guardar la especialidad.')
      // Confirm the server actually wrote the medical profile currently shown in this editor.
      if(String(result.data?.profile_id||'')!==String(profile?.id||'')||String(result.data?.slug||'')!==String(profile?.slug||''))
        throw new Error('La API guardó una especialidad en otro perfil médico. Esperado: '+String(profile?.slug||'')+'; recibido: '+String(result.data?.slug||'')+'. No se confirmó este perfil.')
      // Server has performed a direct D1 readback, not merely echoed local form state.
      const persisted=String(result.data?.specialty||'')
      if(!persisted.split(' | ').some((item:string)=>item.trim().toLocaleLowerCase('es')===value.toLocaleLowerCase('es')))
        throw new Error('La especialidad no quedó registrada. No se ha confirmado el guardado.')
      setProfile((previous:any)=>({...previous,specialty:persisted}))
      setForm((previous:any)=>({...previous,specialty:persisted}))
      setSecondaryDraft('')
      showSaved('profile','Especialidad guardada y verificada: '+value)
    }catch(e){setError(e instanceof Error?e.message:'No se pudo confirmar el guardado.')}
    finally{secondarySavingRef.current=false;setBusy(false)}
  }

  // Save automatically after typing stops, including custom specialties and datalist choices.
  useEffect(()=>{
    if(!secondaryDraft.trim()||loading||busy)return
    const timer=window.setTimeout(()=>{void addSecondarySpecialty()},1600)
    return()=>window.clearTimeout(timer)
  },[secondaryDraft,loading,busy])

  async function removeSecondarySpecialty(name:string){
    if(busy)return
    setBusy(true);setError('');setFeedback(null)
    try{
      const result:any=await apiDelete(scoped('/me/medical-profile/specialties'),{specialty:name})
      if(!result?.ok)throw new Error(result?.error||'No se pudo quitar la especialidad.')
      const persisted=String(result.data?.specialty||'')
      setProfile((previous:any)=>({...previous,specialty:persisted}))
      setForm((previous:any)=>({...previous,specialty:persisted}))
      showSaved('profile','Especialidad eliminada y verificada.')
    }catch(e){setError(e instanceof Error?e.message:'No se pudo eliminar la especialidad.')}
    finally{setBusy(false)}
  }

  async function saveAppearance(template:string,palette:string){
    if(busy)return
    setBusy(true);setError('');setFeedback(null)
    try{
      const r:any=await apiPut(scoped('/me/medical-profile/appearance'),{template,palette})
      if(!r?.ok)throw new Error(r?.error||'No pudimos guardar la apariencia.')
      setProfile((p:any)=>({...p,template:r.data.template,palette:r.data.palette}))
      setForm((p:any)=>({...p,template:r.data.template,palette:r.data.palette}))
      showSaved('appearance','Apariencia guardada. La plantilla pública puede tardar unos minutos en actualizarse.')
    }catch(e){setError(e instanceof Error?e.message:'No pudimos guardar la apariencia.')}
    finally{setBusy(false)}
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
      const res=await fetch(`${API_BASE}/me/medical-profile/media?kind=${kind}${scopeQuery?'&'+scopeQuery:''}`,{method:'POST',credentials:'include',headers:{...activeIntapTabHeaders(),...kawmedGuestHeaders('/me/medical-profile/media')},body:fd})
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
    if(!newSchedule.center_id||!selectedDays.length)return
    setBusy(true);setError('');setMessage('')
    let completed=0
    try{
      for(const day of [...selectedDays].sort((a,b)=>a-b)){
        const j:any=await apiPost(scoped('/me/medical-profile/schedules'),{...newSchedule,day_of_week:day})
        if(!j?.ok)throw new Error(j?.error||'No pudimos agregar el horario.')
        completed++
      }
      setNewSchedule({center_id:'',day_of_week:1,shift:'',start_time:'08:00',end_time:'12:00',notes:''})
      showSaved('schedule',completed+' horario(s) agregado(s).');await load(true)
    }catch(e){setError((e instanceof Error?e.message:'Error guardando horarios.')+(completed?' Se guardaron '+completed+' de '+selectedDays.length+' días.':''));await load(true)}
    finally{setBusy(false)}
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

  async function deleteMedicalAccount(){
    if(deleteEmail.trim().toLowerCase()!==String(profile?.account_email||'').trim().toLowerCase()||deleteSlug!==String(profile?.slug||'')||deletePhrase.trim().toUpperCase()!=='ELIMINAR KAWMED'){
      setError('Confirma el correo, el enlace público y la frase ELIMINAR KAWMED.');return
    }
    setLifecycleBusy(true);setError('')
    try{
      const j:any=await apiPost('/me/medical-profile/delete-account',{confirm_email:deleteEmail,confirm_slug:deleteSlug,confirm_phrase:deletePhrase})
      if(!j?.ok)throw new Error(j?.error||'No se pudo eliminar la cuenta.')
      window.location.replace('/admin/login?account_deleted=kawmed')
    }catch(e){setError(e instanceof Error?e.message:'No se pudo eliminar la cuenta.')}finally{setLifecycleBusy(false)}
  }

  async function changeLifecycle(action:'suspend'|'reactivate'){
    setLifecycleBusy(true);setError('');setMessage('')
    try{
      const j:any=await apiPost('/me/medical-profile/'+action,{confirm:true})
      if(!j?.ok)throw new Error(j?.error||'No pudimos actualizar el estado.')
      setMessage(action==='suspend'?'Perfil suspendido. Tu correo permanece vinculado y puedes reactivarlo.':'Perfil reactivado como borrador. Revisa el contenido antes de publicarlo.')
      setLifecycleConfirm(null)
      await load(true)
    }catch(e){setError(e instanceof Error?e.message:'No pudimos actualizar el estado.')}finally{setLifecycleBusy(false)}
  }

  if(loading)return embedded?<div className="min-h-[320px] rounded-[24px] border border-slate-200 bg-white"/>:<main className="min-h-screen bg-slate-50"/>
  if(!profile)return embedded?<div className="rounded-[24px] border border-slate-200 bg-white p-6"><h2 className="text-xl font-black">Perfil KawMed no disponible</h2><p className="mt-2 text-base sm:text-sm text-slate-500">{error}</p></div>:<main className="min-h-screen bg-slate-50 p-6 font-['Inter']"><div className="mx-auto max-w-xl rounded-3xl bg-white p-6"><h1 className="text-2xl font-black">KawMed no disponible</h1><p className="mt-2 text-base sm:text-sm text-slate-500">{error}</p></div></main>

  const Shell:any=embedded?'div':'main'
  return <Shell className={embedded?"font-['Inter'] text-slate-950":"min-h-screen bg-slate-50 px-4 py-6 font-['Inter'] text-slate-950"}><div className={embedded?"w-full space-y-5":"mx-auto w-full max-w-5xl space-y-5"}>
    <header className={card}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm sm:text-[11px] font-black uppercase tracking-[.18em] text-cyan-700">{scope==='sponsor_master'?'KAWMED · PRESENTACIÓN MASTER':'KAWMED · PERFIL MÉDICO'}</p><h1 className="mt-2 text-3xl font-black tracking-[-.04em]">{[profile.professional_prefix,profile.name].filter(Boolean).join(' ')}</h1><p className="mt-1 text-base sm:text-sm font-bold text-cyan-800">{profile.specialty}</p><p className="mt-2 text-base sm:text-sm text-slate-500">{scope==='sponsor_master'?'Configura tu presentación pública de ejemplo con la misma experiencia KawMed que reciben los médicos asociados.':'Configura exactamente la información que verán tus pacientes: perfil profesional, centros, horarios, agenda y seguros.'}</p></div><div className="flex flex-wrap gap-2">{scope==='doctor'&&String(profile.account_email||'').trim().toLowerCase()==='intapcard@gmail.com'&&<a href="/admin/accounts" className={'rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm sm:text-xs font-black hover:bg-slate-50 '+headerActionMotion}>Cambiar cuenta</a>}{scope==='doctor'&&<button type="button" onClick={()=>setPreviewOpen(true)} className={'rounded-xl border border-cyan-200 bg-white px-4 py-3 text-sm sm:text-xs font-black text-cyan-800 hover:bg-cyan-50 '+headerActionMotion}>Vista previa</button>}
      <button ref={publicationPublishTriggerRef} type="button" disabled={busy||profile.status==='active'||!publicationReadiness.canPublish} aria-describedby="kawmed-publication-guidance" aria-expanded={publicationConfirm==='publish'} aria-controls="kawmed-publication-confirmation" onClick={()=>openPublicationConfirm('publish')} className="rounded-xl bg-emerald-700 px-4 py-3 text-sm sm:text-xs font-black text-white shadow-sm transition-[background-color,transform,box-shadow] duration-200 ease-out hover:bg-emerald-800 hover:shadow-md active:scale-[.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-emerald-700 disabled:hover:shadow-sm disabled:active:scale-100">{publicationPending==='publish'?'Publicando…':profile.status==='active'?'Publicado':'Publicar'}</button>
      <button ref={publicationUnpublishTriggerRef} type="button" disabled={busy||profile.status!=='active'} aria-expanded={publicationConfirm==='unpublish'} aria-controls="kawmed-publication-confirmation" onClick={()=>openPublicationConfirm('unpublish')} className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm sm:text-xs font-black text-amber-900 shadow-sm transition-[background-color,transform,box-shadow] duration-200 ease-out hover:bg-amber-100 hover:shadow-md active:scale-[.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-amber-50 disabled:hover:shadow-sm disabled:active:scale-100">{publicationPending==='unpublish'?'Despublicando…':'Despublicar'}</button>
      {scope==='doctor'&&<button onClick={()=>window.location.assign('/admin/medical/notifications')} className={'rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm sm:text-xs font-black hover:bg-slate-50 '+headerActionMotion}>Notificaciones{unread>0?' · '+unread:''}</button>}{slug&&<button type="button" disabled={profile.status!=='active'} title={profile.status==='active'?'Abrir perfil médico público':'El perfil está en borrador. Publícalo antes de abrir su enlace público.'} onClick={()=>window.open(publicOrigin()+'/m/'+encodeURIComponent(slug),'_blank','noopener,noreferrer')} className={'rounded-xl bg-slate-950 px-4 py-3 text-sm sm:text-xs font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 '+headerActionMotion}>{profile.status==='active'?'Ver perfil público':'Perfil público disponible al publicar'}</button>}
      <button type="button" onClick={()=>void installPwa()} disabled={pwaInstalled} className="rounded-xl border border-cyan-200 bg-white px-4 py-3 text-sm sm:text-xs font-black text-cyan-800 disabled:opacity-60">{pwaInstalled?'App instalada':'Instalar app Kawvo'}</button>
      <button type="button" onClick={()=>void logoutKawMed()} disabled={signingOut} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm sm:text-xs font-black text-slate-700 disabled:opacity-60">{signingOut?'Saliendo…':'Cerrar sesión'}</button>
      </div></div>
      {showPwaHelp&&<div className="fixed inset-0 z-[140] flex items-end justify-center bg-slate-950/55 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Cómo instalar Kawvo" onMouseDown={event=>{if(event.target===event.currentTarget)setShowPwaHelp(false)}}>
        <article className="w-full max-w-[390px] rounded-[26px] bg-white p-5 shadow-2xl">
          <div className="flex items-center justify-between"><h2 className="text-lg font-black">Instalar app Kawvo</h2><button type="button" onClick={()=>setShowPwaHelp(false)} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">Cerrar</button></div>
          <p className="mt-4 text-sm leading-6 text-slate-600">Abre esta dirección en el dispositivo donde quieres instalar Kawvo:</p>
          <a href={window.location.origin+'/admin/medical'} className="mt-2 block break-all rounded-xl bg-slate-50 px-3 py-3 text-sm font-bold text-cyan-700 underline">{window.location.origin+'/admin/medical'}</a>
          <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600"><p><strong>iPhone o iPad · Safari</strong></p><p>1. Abre el enlace en Safari.</p><p>2. Pulsa Compartir y selecciona <strong>Agregar a pantalla de inicio</strong>.</p><p>3. Confirma con Agregar.</p></div>
          <div className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600"><p><strong>Android · Chrome</strong></p><p>1. Abre el enlace en Chrome.</p><p>2. En el menú de tres puntos selecciona <strong>Instalar aplicación</strong> o <strong>Agregar a pantalla principal</strong>.</p><p>3. Confirma la instalación.</p></div>
        </article>
      </div>}
      {publicationConfirm&&<div className="mt-4 flex justify-end">
        <div id="kawmed-publication-confirmation" role="group" aria-label={publicationConfirm==='publish'?'Confirmar publicación de perfil':'Confirmar despublicación de perfil'} onKeyDown={event=>{if(event.key==='Escape'&&!publicationPending){cancelPublicationConfirm()}}} className="w-full max-w-lg rounded-2xl border border-cyan-200 bg-cyan-50 p-4 shadow-md motion-safe:animate-[fade-in_180ms_ease-out_both]">
          <p className="text-base font-black text-slate-950">{publicationConfirm==='publish'?'¿Publicar este perfil médico?':'¿Despublicar este perfil médico?'}</p>
          <p className="mt-1 text-sm leading-6 text-slate-700">{publicationConfirm==='publish'?'Tus pacientes podrán consultar este perfil mediante su enlace público.':'El perfil dejará de mostrarse a tus pacientes, pero se conservarán sus datos.'}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button ref={publicationConfirmRef} type="button" disabled={busy} onClick={()=>void changePublication(publicationConfirm)} className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition-[background-color,transform,box-shadow] duration-200 hover:bg-slate-800 hover:shadow-md active:scale-[.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700 motion-reduce:transition-none disabled:cursor-wait disabled:opacity-60" aria-busy={Boolean(publicationPending)}>
              <span className="inline-flex items-center gap-2">
                {publicationPending&&<span aria-hidden="true" className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none"/>}
                {publicationPending?(publicationPending==='publish'?'Publicando…':'Despublicando…'):(publicationConfirm==='publish'?'Sí, publicar':'Sí, despublicar')}
              </span>
            </button>
            <button type="button" disabled={busy} onClick={cancelPublicationConfirm} className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black transition-[background-color,transform] duration-200 hover:bg-slate-100 active:scale-[.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700 motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50">Cancelar</button>
          </div>
          {publicationNotice?.kind==='error'&&<p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">{publicationNotice.text}</p>}
        </div>
      </div>}
      {publicationNotice?.kind==='success'&&<p role="status" aria-live="polite" className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900">{publicationNotice.text}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm sm:text-xs font-bold text-slate-500"><span className="rounded-full bg-emerald-50 px-3 py-2 text-emerald-700">{completeness.done}/{completeness.total} presentación configurada</span>{completeness.missing.length>0&&<span className="rounded-full bg-slate-100 px-3 py-2 text-slate-600">Por mejorar: {completeness.missing.join(', ')}</span>}<span className="rounded-full bg-slate-100 px-3 py-2">{profile.status==='active'?'Publicado':profile.status==='inactive'?'Inactivo':'Borrador'}</span></div></header>

    <section id="kawmed-publication-guidance" aria-labelledby="kawmed-publication-title" className={card}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="kawmed-publication-title" className="text-xl font-black">Requisitos para publicar</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">La plataforma exige tres datos guardados para publicar. Los demás elementos enriquecen la presentación, pero no impiden publicarla.</p>
        </div>
        <span className={'rounded-full px-3 py-2 text-xs font-black '+(publicationReadiness.canPublish?'bg-emerald-50 text-emerald-800':'bg-amber-50 text-amber-900')}>
          {profile.status==='active'?'Perfil publicado':publicationReadiness.canPublish?'Listo para publicar':'Publicación pendiente'}
        </span>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 p-4">
          <h3 className="font-black">Obligatorios para publicar</h3>
          <p className="mt-1 text-xs text-slate-500">{publicationReadiness.mandatory.filter(item=>item.ready).length} de {publicationReadiness.mandatory.length} completados</p>
          <ul className="mt-3 space-y-2">
            {publicationReadiness.mandatory.map(item=><li key={item.label} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2"><span aria-hidden="true" className={item.ready?'text-emerald-700':'text-amber-800'}>{item.ready?'✓':'○'}</span><span>{item.label}</span></span>
              <span className={item.ready?'font-bold text-emerald-800':'font-bold text-amber-900'}>{item.ready?'Listo':'Falta'}</span>
            </li>)}
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <h3 className="font-black">Recomendados para un perfil completo</h3>
          <p className="mt-1 text-xs text-slate-500">No bloquean la publicación.</p>
          <ul className="mt-3 space-y-2">
            {publicationReadiness.recommended.map(item=><li key={item.label} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2"><span aria-hidden="true" className={item.ready?'text-emerald-700':'text-slate-500'}>{item.ready?'✓':'○'}</span>{item.label}</span>
              {item.ready?<span className="font-bold text-emerald-800">Listo</span>:<button type="button" onClick={()=>setTab(item.tab)} className="font-bold text-cyan-800 underline underline-offset-2">Completar</button>}
            </li>)}
          </ul>
        </div>
      </div>
      {profile.status!=='active'&&<div role="status" className={'mt-4 rounded-xl px-4 py-3 text-sm leading-6 '+(publicationReadiness.canPublish?'bg-emerald-50 text-emerald-900':'bg-amber-50 text-amber-900')}>
        {publicationReadiness.missing.length>0?<p><strong>Aún no puedes publicar.</strong> Falta completar y guardar: {publicationReadiness.missing.map(item=>item.label).join(', ')}.</p>:<p><strong>Los tres requisitos obligatorios están completos.</strong> {publicationReadiness.savedChangesPending?'Guarda tus cambios recientes antes de publicar.':'Puedes utilizar el botón «Publicar» situado en el encabezado superior.'}</p>}
        {publicationReadiness.savedChangesPending&&publicationReadiness.missing.length>0&&<p className="mt-1">Si ya completaste esos datos en el formulario, primero pulsa «Guardar perfil médico».</p>}
        {(!publicationReadiness.canPublish)&&<button type="button" onClick={()=>setTab('profile')} className="mt-2 font-black text-cyan-900 underline underline-offset-2">Ir a los datos del perfil</button>}
      </div>}
    </section>

    {sponsor&&<section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">{sponsor.banner_image_url?(sponsor.cta_url?<a href={sponsor.cta_url} target="_blank" rel="noopener noreferrer"><img src={sponsor.banner_image_url} alt={sponsor.name||'Patrocinador'} className="block h-auto w-full object-contain bg-white"/></a>:<img src={sponsor.banner_image_url} alt={sponsor.name||'Patrocinador'} className="block h-auto w-full object-contain bg-white"/>):<div className="flex items-center gap-4 p-5">{sponsor.logo_url&&<img src={sponsor.logo_url} alt={sponsor.name||'Patrocinador'} className="h-14 w-14 object-contain"/>}<div><p className="text-sm sm:text-[11px] font-black uppercase tracking-[.14em] text-slate-400">Patrocinio profesional privado</p><h2 className="mt-1 text-lg font-black">{sponsor.name}</h2></div></div>}<div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-4"><div><p className="text-sm sm:text-xs leading-5 text-slate-500">Solo tú ves esta relación comercial. No aparece en tu perfil público para pacientes.</p>{sponsor.representative&&<p className="mt-1 text-sm sm:text-xs font-bold text-slate-700">Visitador: {sponsor.representative.name}{sponsor.representative.zone?' · '+sponsor.representative.zone:''}</p>}</div><div className="flex flex-wrap gap-2">{sponsor.representative?.url&&<a href={sponsor.representative.url} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-cyan-100 px-4 py-3 text-sm sm:text-xs font-black text-cyan-900 ring-1 ring-cyan-300 transition-colors hover:bg-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700">Contactar mi visitador</a>}{sponsor.vademecum_url&&<a href={sponsor.vademecum_url} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm sm:text-xs font-black text-cyan-700">{sponsor.vademecum_label||'Ver vademécum'}</a>}</div></div></section>}



    {message&&<div className="rounded-2xl bg-emerald-50 px-4 py-3 text-base sm:text-sm font-bold text-emerald-700">{message}</div>}
    {error&&<div className="rounded-2xl bg-rose-50 px-4 py-3 text-base sm:text-sm font-bold text-rose-700">{error}</div>}

    <nav className="grid grid-cols-2 gap-2 rounded-[22px] border border-slate-200 bg-white p-2 sm:grid-cols-6">{(([...([['profile','Perfil'],['centers','Centros'],['schedule','Horarios'],['insurance','Seguros'],['appearance','Apariencia'],['agenda','Agenda']] as [Tab|'agenda',string][]),...(isLiveGuest?[['public','Vista publicada'] as [Tab,string]]:[])])).map(([key,title])=><button key={key} onClick={()=>key==='agenda'?openAgenda():setTab(key)} className={'rounded-2xl px-3 py-3 text-base sm:text-sm font-black '+(tab===key?'bg-slate-950 text-white':'text-slate-500 hover:bg-slate-50')}>{title}</button>)}</nav>

    {tab==='public'&&isLiveGuest&&<section className={card}>
      <h2 className="text-xl font-black">Vista publicada · modo administrador</h2>
      <p className="mt-2 text-sm text-slate-600">Esta es la presentación que ven los pacientes. La sección de patrocinio mostrada arriba pertenece únicamente a tu administración privada. Cambia cualquier dato desde las pestañas del mismo panel.</p>
      {slug&&profile.status==='active'?<>
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <iframe title="Perfil KawMed publicado" src={publicOrigin()+'/m/'+encodeURIComponent(slug)} className="h-[720px] w-full border-0" loading="lazy"/>
        </div>
        <a href={publicOrigin()+'/m/'+encodeURIComponent(slug)} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block rounded-xl border border-cyan-200 px-4 py-3 text-sm font-black text-cyan-800">Abrir presentación pública en otra pestaña</a>
      </>:<p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Este perfil todavía no está publicado.</p>}
    </section>}

    {tab==='appearance'&&<section className={card}>
      <h2 className="text-xl font-black">Apariencia del perfil</h2>
      <p className="mt-2 text-base sm:text-sm text-slate-500">Las dos plantillas comparten la misma información y las mismas acciones. Cambiar de plantilla no modifica tus datos médicos.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">{([['classic','Clásica','Presentación original KawMed'],['pastel','Modern','Fotografía y especialidades sobre el encabezado; tarjetas suaves debajo']] as const).map(([value,title,description])=><button type="button" disabled={busy} key={value} onClick={()=>void saveAppearance(value,String(profile.palette||'aqua'))} className={'rounded-2xl border-2 p-5 text-left transition '+((profile.template||'classic')===value?'border-cyan-600 bg-cyan-50':'border-slate-200 bg-white hover:border-cyan-300')}><span aria-hidden="true" className={'mb-3 block overflow-hidden rounded-2xl border border-slate-200 '+(value==='pastel'?'bg-cyan-50':'bg-slate-50')}>
  <span className={'relative block h-36 p-3 '+(value==='pastel'?'bg-gradient-to-br from-cyan-100 via-white to-indigo-100':'bg-gradient-to-b from-slate-200 to-white')}>
    <span className={'absolute right-3 top-2 h-20 w-16 rounded-t-full '+(value==='pastel'?'bg-teal-200':'bg-slate-300')}/>
    <span className="relative mt-8 block w-[70%] text-base sm:text-sm font-black text-slate-900">Dr. Nombre Apellido</span>
    <span className="relative mt-1 block w-[75%] rounded bg-white/80 px-1 text-[9px] font-semibold text-slate-600">Especialidad médica</span>
    <span className="absolute bottom-3 left-3 right-3 flex gap-1">{[1,2,3].map(x=><span key={x} className={'h-5 flex-1 rounded-lg '+(value==='pastel'?'bg-white':'bg-blue-50')}/>)}</span>
  </span>
</span><strong className="block text-lg">{title}</strong><span className="mt-2 block text-base sm:text-sm text-slate-600">{description}</span><span className="mt-3 block text-sm sm:text-xs font-bold text-cyan-800">{(profile.template||'classic')===value?'Plantilla seleccionada':'Seleccionar esta plantilla'}</span></button>)}</div>
      <h3 className="mt-6 font-black">Paleta de colores pastel</h3>
      <p className="mt-1 text-base sm:text-sm text-slate-500">Personaliza los acentos; la información del perfil no cambia.</p>
      <div className="mt-3 flex flex-wrap gap-3">{([['aqua','Aqua','#139da7'],['lavender','Lavanda','#9686c9'],['mint','Menta','#4a9c87'],['peach','Durazno','#cf8c77'],['sky','Cielo','#568fbf']] as const).map(([key,title,color])=><button key={key} type="button" disabled={busy} onClick={()=>void saveAppearance(String(profile.template||'classic'),key)} aria-pressed={(profile.palette||'aqua')===key} className={'flex items-center gap-2 rounded-full border-2 px-4 py-2 text-base sm:text-sm font-bold '+((profile.palette||'aqua')===key?'border-slate-900':'border-slate-200')}><span className="h-5 w-5 rounded-full" style={{backgroundColor:color}}/>{title}</button>)}</div>
      {feedback?.area==='appearance'&&<p role="status" className="mt-4 text-base sm:text-sm font-bold text-emerald-700">{feedback.text}</p>}
      {slug&&<div className="mt-5">{profile.status==='active'?<a target="_blank" rel="noopener noreferrer" className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-cyan-700 px-5 py-4 text-center text-base font-black text-white shadow-sm hover:bg-cyan-800" href={publicOrigin()+'/m/'+encodeURIComponent(slug)+'?kawmed_preview='+encodeURIComponent(String(profile.template||'classic'))+'&kawmed_palette='+encodeURIComponent(String(profile.palette||'aqua'))}>Ver vista previa de la plantilla seleccionada ↗</a>:<div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-center text-sm font-bold text-amber-900">Este perfil está en borrador. La vista pública y la vista previa completa estarán disponibles cuando publiques el perfil.</div>}<p className="mt-2 text-center text-sm text-slate-500">La elección de plantilla no modifica la publicación de tu perfil.</p></div>}
    </section>}

    {tab==='profile'&&<section className={card}><div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-black">Perfil profesional</h2><p className="mt-1 text-base sm:text-sm text-slate-500">Estos datos forman la cabecera y presentación pública de tu perfil médico.</p></div></div><div className="mt-5 grid gap-4 md:grid-cols-2"><div className="md:col-span-2"><p className={label}>Fotografía principal</p><p className="mt-1 text-sm sm:text-xs normal-case text-slate-500">Es la imagen destacada del perfil. El degradado inferior se aplica automáticamente y no cubre los botones.</p><button onClick={()=>coverRef.current?.click()} className="mt-2 w-full rounded-2xl border border-slate-200 p-3 text-base sm:text-sm font-bold">Subir / cambiar fotografía</button><input ref={coverRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e=>{const file=e.target.files?.[0];e.target.value='';chooseImage(file,'cover')}}/>{(profile.cover_url||profile.avatar_url)&&<img src={profile.cover_url||profile.avatar_url} alt="Fotografía principal actual" className="mx-auto mt-3 aspect-[4/4.25] max-h-80 w-full max-w-sm rounded-2xl object-cover"/>}</div><label className={label}>Prefijo<input className={input} value={form.professional_prefix||''} onChange={e=>setForm({...form,professional_prefix:e.target.value})} placeholder="Dra. / Dr."/></label><label className={label}>Nombre<input className={input} value={form.name||''} onChange={e=>setForm({...form,name:e.target.value})}/></label><div><div><label className={label}>Especialidad principal<select className={input} value={MEDICAL_SPECIALTIES.includes(String(form.specialty||'').split(' | ')[0])?String(form.specialty||'').split(' | ')[0]:'other'} onChange={e=>{const more=String(form.specialty||'').split(' | ').slice(1);setForm({...form,specialty:[e.target.value==='other'?'':e.target.value,...more].filter(Boolean).join(' | ')})}}><option value="other">Otra / Escribir especialidad</option>{MEDICAL_SPECIALTIES.map(name=><option key={name} value={name}>{name}</option>)}</select></label><label className="mt-2 block text-sm sm:text-xs font-semibold text-slate-600">O escribe una especialidad personalizada<input className={input} value={MEDICAL_SPECIALTIES.includes(String(form.specialty||'').split(' | ')[0])?'':String(form.specialty||'').split(' | ')[0]} onChange={e=>{const more=String(form.specialty||'').split(' | ').slice(1);setForm({...form,specialty:[e.target.value,...more].filter(Boolean).join(' | ')})}} placeholder="Especialidad no incluida en el listado"/></label></div><datalist id="kawmed-medical-specialties">{MEDICAL_SPECIALTIES.map(x=><option key={x} value={x}/>)}</datalist></div><div><label className={label}>Subespecialidad<input className={input} value={form.subspecialty||''} onChange={e=>setForm({...form,subspecialty:e.target.value})}/></label><details className="mt-2 rounded-xl border border-slate-200 p-3"><summary className="cursor-pointer text-sm sm:text-xs font-bold text-cyan-800">+ Agregar otra especialidad</summary><p className="mt-2 text-sm sm:text-xs text-slate-500">Puedes seleccionar una sugerencia o escribir otra especialidad.</p><input className={input} list="kawmed-medical-specialties" value={secondaryDraft} onChange={e=>{secondaryAttemptedRef.current='';setSecondaryDraft(e.target.value)}} placeholder="Otra especialidad" onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void addSecondarySpecialty()}}}/><p role="status" className="mt-2 text-sm sm:text-xs font-semibold text-cyan-800">{busy?'Guardando especialidad…':secondaryDraft.trim()?'Guardado automático al terminar de escribir…':'Escribe o selecciona una especialidad; se guardará automáticamente.'}</p>{String(form.specialty||'').split(' | ').slice(1).filter(Boolean).length>0&&<p className="mt-2 text-sm sm:text-xs font-semibold text-emerald-800">Adicionales registradas: {String(form.specialty||'').split(' | ').slice(1).filter(Boolean).join(' · ')}</p>}<div className="mt-2 flex flex-wrap gap-2">{String(form.specialty||'').split(' | ').slice(1).filter(Boolean).map((name:string,i:number)=><button type="button" key={i} disabled={busy} onClick={()=>void removeSecondarySpecialty(name)} className="rounded-full bg-slate-100 px-3 py-1 text-sm sm:text-xs text-slate-700">{name} ×</button>)}</div></details></div><label className={label+' md:col-span-2'}>Presentación (Sobre mí)<textarea className={input} rows={4} value={form.bio||''} onChange={e=>setForm({...form,bio:e.target.value})} placeholder="Cuéntales a tus pacientes quién eres, tu experiencia profesional y cómo puedes ayudarles."/></label><label className={label}>WhatsApp<input type="tel" inputMode="tel" autoComplete="tel" className={input} value={form.whatsapp||''} onChange={e=>setForm({...form,whatsapp:e.target.value})}/></label><label className={label}>Teléfono<input type="tel" inputMode="tel" autoComplete="tel" className={input} value={form.phone||''} onChange={e=>setForm({...form,phone:e.target.value})}/></label><label className={label}>Correo<input type="email" autoComplete="email" className={input} value={form.email||''} onChange={e=>setForm({...form,email:e.target.value})}/></label><label className={label}>Usuario<input className={input} value={form.slug||''} onChange={e=>setForm({...form,slug:e.target.value.replace(/^@+/, '')})} placeholder="@usuario" autoCapitalize="none" autoCorrect="off" spellCheck={false}/><span className="mt-1 block text-sm sm:text-xs font-normal normal-case tracking-normal text-slate-500">Ej.: @usuario. Es el identificador de tu enlace público; el símbolo @ no forma parte de la dirección.</span></label><label className={label}>Ciudad<input className={input} value={form.city||''} onChange={e=>setForm({...form,city:e.target.value})}/></label><label className={label}>Provincia<input className={input} value={form.province||''} onChange={e=>setForm({...form,province:e.target.value})}/></label><div><p className={label}>Estado de publicación</p><p className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-bold text-slate-600">{profile.status==='active'?'Publicado':profile.status==='inactive'?'Inactivo':'Borrador'} · Controlar desde los botones superiores</p></div></div><button onClick={()=>void saveProfile()} disabled={busy} className="mt-5 rounded-xl bg-slate-950 px-5 py-3 text-base sm:text-sm font-black text-white disabled:opacity-40">Guardar perfil médico</button>{feedback?.area==='profile'&&<p role="status" className="mt-2 text-base sm:text-sm font-semibold text-emerald-700">{feedback.text}</p>}</section>}

    {tab==='centers'&&<section className={card}><h2 className="text-xl font-black">Centros de atención</h2><p className="mt-1 text-base sm:text-sm text-slate-500">Los pacientes verán estos centros con ubicación y teléfono cuando estén disponibles.</p><div className="mt-4 grid gap-3">{centers.map((c:any)=><article key={c.id} className="rounded-2xl border border-slate-200 p-4">{editingCenter?.id===c.id?<><div className="grid gap-3 md:grid-cols-2"><label className={label}>Nombre<input className={input} value={editingCenter.name||''} onChange={e=>setEditingCenter({...editingCenter,name:e.target.value})}/></label><label className={label}>Teléfono<input type="tel" inputMode="tel" className={input} value={editingCenter.phone||''} onChange={e=>setEditingCenter({...editingCenter,phone:e.target.value})}/></label><label className={label+' md:col-span-2'}>Dirección<input className={input} value={editingCenter.address||''} onChange={e=>setEditingCenter({...editingCenter,address:e.target.value})}/></label><label className={label}>Ciudad<input className={input} value={editingCenter.city||''} onChange={e=>setEditingCenter({...editingCenter,city:e.target.value})}/></label><label className={label}>Provincia<input className={input} value={editingCenter.province||''} onChange={e=>setEditingCenter({...editingCenter,province:e.target.value})}/></label><div className="md:col-span-2"><MedicalCenterLocationPicker address={editingCenter.address||''} mapUrl={editingCenter.map_url||''} onChange={values=>setEditingCenter((previous:any)=>({...previous,...values}))}/></div></div><div className="mt-3 flex gap-2"><button onClick={()=>void updateCenter()} disabled={busy} className="rounded-xl bg-slate-950 px-4 py-2 text-sm sm:text-xs font-black text-white">Guardar</button><button onClick={()=>setEditingCenter(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm sm:text-xs font-black">Cancelar</button></div></>:<div className="flex items-start justify-between gap-3"><div><p className="font-black">{c.name}</p><p className="mt-1 text-base sm:text-sm text-slate-500">{[c.address,c.city,c.province].filter(Boolean).join(' · ')||'Sin dirección'}</p>{c.phone&&<p className="mt-1 text-sm sm:text-xs font-bold text-slate-600">{c.phone}</p>}</div><div className="flex gap-3"><button onClick={()=>setEditingCenter({...c})} className="text-sm sm:text-xs font-black text-cyan-700">Editar</button><button onClick={()=>void removeCenter(c.id)} disabled={busy} className="text-sm sm:text-xs font-black text-rose-600">Eliminar</button></div></div>}</article>)}</div><div className="mt-5 border-t border-slate-100 pt-5"><h3 className="font-black">Agregar centro</h3><div className="mt-3 grid gap-3 md:grid-cols-2"><label className={label}>Nombre<input className={input} value={newCenter.name} onChange={e=>setNewCenter({...newCenter,name:e.target.value})}/></label><label className={label}>Teléfono<input type="tel" inputMode="tel" className={input} value={newCenter.phone} onChange={e=>setNewCenter({...newCenter,phone:e.target.value})}/></label><label className={label+' md:col-span-2'}>Dirección<input className={input} value={newCenter.address} onChange={e=>setNewCenter({...newCenter,address:e.target.value})}/></label><label className={label}>Ciudad<input className={input} value={newCenter.city} onChange={e=>setNewCenter({...newCenter,city:e.target.value})}/></label><label className={label}>Provincia<input className={input} value={newCenter.province} onChange={e=>setNewCenter({...newCenter,province:e.target.value})}/></label><div className="md:col-span-2"><MedicalCenterLocationPicker address={newCenter.address} mapUrl={newCenter.map_url} onChange={values=>setNewCenter(previous=>({...previous,...values}))}/></div></div><button onClick={()=>void addCenter()} disabled={busy||!newCenter.name.trim()} className="mt-4 rounded-xl bg-slate-950 px-5 py-3 text-base sm:text-sm font-black text-white disabled:opacity-40">Agregar centro</button>{feedback?.area==='centers'&&<p role="status" className="mt-2 text-base sm:text-sm font-semibold text-emerald-700">{feedback.text}</p>}</div></section>}

    {tab==='schedule'&&<section className={card}><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-black">Horarios de consulta</h2><p className="mt-1 text-base sm:text-sm text-slate-500">Cada horario está asociado a uno de tus centros de atención.</p></div><button onClick={openAgenda} className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm sm:text-xs font-black text-cyan-700">Disponibilidad de Agenda</button></div><details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/40 p-3"><summary className="cursor-pointer text-base sm:text-sm font-black text-slate-800">Horarios registrados ({schedules.length}) · Mostrar / ocultar</summary><div className="mt-3 grid gap-3">{schedules.map((row:any)=><article key={row.id} className="rounded-2xl border border-slate-200 p-4">{editingSchedule?.id===row.id?<><div className="grid gap-3 md:grid-cols-2"><label className={label}>Centro<select className={input} value={editingSchedule.center_id||''} onChange={e=>setEditingSchedule({...editingSchedule,center_id:e.target.value})}>{centers.map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className={label}>Día<select className={input} value={editingSchedule.day_of_week||1} onChange={e=>setEditingSchedule({...editingSchedule,day_of_week:Number(e.target.value)})}>{DAYS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label className={label}>Desde<input type="time" className={input} value={editingSchedule.start_time||''} onChange={e=>setEditingSchedule({...editingSchedule,start_time:e.target.value})}/></label><label className={label}>Hasta<input type="time" className={input} value={editingSchedule.end_time||''} onChange={e=>setEditingSchedule({...editingSchedule,end_time:e.target.value})}/></label><label className={label}>Tanda<input className={input} value={editingSchedule.shift||''} onChange={e=>setEditingSchedule({...editingSchedule,shift:e.target.value})}/></label></div><div className="mt-3 flex gap-2"><button onClick={()=>void updateSchedule()} disabled={busy} className="rounded-xl bg-slate-950 px-4 py-2 text-sm sm:text-xs font-black text-white">Guardar</button><button onClick={()=>setEditingSchedule(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm sm:text-xs font-black">Cancelar</button></div></>:<div className="flex items-start justify-between gap-3"><div><p className="font-black">{DAYS.find(d=>Number(d[0])===Number(row.day_of_week))?.[1]||row.day_of_week} · {row.start_time}–{row.end_time}</p><p className="mt-1 text-base sm:text-sm text-slate-500">{centerById.get(String(row.center_id))?.name||'Centro'}{row.shift?' · '+row.shift:''}</p></div><div className="flex gap-3"><button onClick={()=>setEditingSchedule({...row})} className="text-sm sm:text-xs font-black text-cyan-700">Editar</button><button onClick={()=>void removeSchedule(row.id)} disabled={busy} className="text-sm sm:text-xs font-black text-rose-600">Eliminar</button></div></div>}</article>)}</div></details><div className="mt-5 border-t border-slate-100 pt-5"><h3 className="font-black">Agregar horario</h3><div className="mt-3 grid gap-3 md:grid-cols-2"><label className={label}>Centro<select className={input} value={newSchedule.center_id} onChange={e=>setNewSchedule({...newSchedule,center_id:e.target.value})}><option value="">Seleccionar</option>{centers.map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><div><p className={label}>Días de atención</p><div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={()=>setSelectedDays([1,2,3,4,5])} className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm sm:text-xs font-bold">Lunes a viernes</button><button type="button" onClick={()=>setSelectedDays([1,2,3,4,5,6,7])} className="rounded-lg border border-slate-200 px-3 py-2 text-sm sm:text-xs font-bold">Toda la semana</button><button type="button" onClick={()=>setSelectedDays([])} className="rounded-lg border border-slate-200 px-3 py-2 text-sm sm:text-xs font-bold">Limpiar</button></div><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{DAYS.map(([v,l])=><label key={v} className="flex items-center gap-2 text-sm sm:text-xs font-semibold"><input type="checkbox" checked={selectedDays.includes(Number(v))} onChange={e=>setSelectedDays(current=>e.target.checked?[...current,Number(v)]:current.filter(x=>x!==Number(v)))}/>{l}</label>)}</div></div><label className={label}>Desde<input type="time" className={input} value={newSchedule.start_time} onChange={e=>setNewSchedule({...newSchedule,start_time:e.target.value})}/></label><label className={label}>Hasta<input type="time" className={input} value={newSchedule.end_time} onChange={e=>setNewSchedule({...newSchedule,end_time:e.target.value})}/></label><label className={label}>Tanda / nota corta<input className={input} value={newSchedule.shift} onChange={e=>setNewSchedule({...newSchedule,shift:e.target.value})} placeholder="Mañana / Tarde"/></label></div><button onClick={()=>void addSchedule()} disabled={busy||!newSchedule.center_id||!selectedDays.length} className="mt-4 rounded-xl bg-slate-950 px-5 py-3 text-base sm:text-sm font-black text-white disabled:opacity-40">Agregar horario</button>{feedback?.area==='schedule'&&<p role="status" className="mt-2 text-base sm:text-sm font-semibold text-emerald-700">{feedback.text}</p>}</div></section>}

    {tab==='insurance'&&<section className={card}><h2 className="text-xl font-black">Seguros médicos</h2><p className="mt-1 text-base sm:text-sm text-slate-500">Publica los seguros que aceptas y, por separado, los planes o coberturas que son excepción.</p><div className="mt-4 grid gap-4 md:grid-cols-2"><div><details className="mb-3 rounded-2xl border border-cyan-100 bg-cyan-50/50 p-3"><summary className="cursor-pointer text-base sm:text-sm font-bold text-cyan-900">Seleccionar seguros de la lista</summary><div className="mt-3 grid gap-2 sm:grid-cols-2"><label className="col-span-full flex items-center gap-2 rounded-lg bg-white p-2 text-sm sm:text-xs font-black"><input type="checkbox" checked={selectedInsurer(acceptedText,'Todos los seguros')} onChange={e=>setAcceptedText(current=>e.target.checked?'Todos los seguros':current.split('\n').filter(name=>name.trim()!=='Todos los seguros').join('\n'))}/>Todos los seguros</label>{MEDICAL_INSURERS.map(name=><label key={name} className="flex items-center gap-2 text-sm sm:text-xs font-semibold text-slate-700"><input type="checkbox" checked={selectedInsurer(acceptedText,name)} disabled={selectedInsurer(acceptedText,'Todos los seguros')} onChange={e=>setAcceptedText(current=>toggleInsurer(current,name,e.target.checked))}/>{name}</label>)}</div><p className="mt-3 text-sm sm:text-xs text-slate-500">«Todos los seguros» publica una sola opción; indica las excepciones a la derecha. También puedes elegir ARS específicas o escribir otras debajo.</p></details><label className={label}>Seguros aceptados<textarea className={input} rows={8} value={acceptedText} onChange={e=>setAcceptedText(e.target.value)} placeholder={'ARS Humano\nARS Universal\nMAPFRE Salud'}/><span className="mt-1 block text-sm sm:text-xs normal-case tracking-normal text-slate-400">También puedes escribir otros seguros aquí, uno por línea.</span></label></div><label className={label}>Excepciones / no aceptados<textarea className={input} rows={8} value={excludedText} onChange={e=>setExcludedText(e.target.value)} placeholder={'Plan específico X\nSeguro Y'}/><span className="mt-1 block text-sm sm:text-xs normal-case tracking-normal text-slate-400">Uno por línea. Solo agrega excepciones reales.</span></label></div><button onClick={()=>void saveInsurance()} disabled={busy} className="mt-4 rounded-xl bg-slate-950 px-5 py-3 text-base sm:text-sm font-black text-white disabled:opacity-40">Guardar seguros</button>{feedback?.area==='insurance'&&<p role="status" className="mt-2 text-base sm:text-sm font-semibold text-emerald-700">{feedback.text}</p>}</section>}

    {scope==='doctor'&&!isLiveGuest&&<section className={card}>
      <h2 className="text-xl font-black">Estado y administración de la cuenta</h2>
      <p className="mt-2 text-sm text-slate-600">Suspender oculta el perfil médico público, pero conserva la información, las citas y el correo asociado. La eliminación definitiva será una operación distinta: requerirá una confirmación reforzada y la comprobación de que el correo no pertenece a otra cuenta Link.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        {profile.status!=='inactive'?<button type="button" disabled={lifecycleBusy} onClick={()=>setLifecycleConfirm('suspend')} className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">Suspender perfil</button>:<button type="button" disabled={lifecycleBusy} onClick={()=>setLifecycleConfirm('reactivate')} className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white">Reactivar perfil</button>}
      </div>
      <div className="mt-5 border-t border-rose-100 pt-4">
        <button type="button" onClick={()=>setShowDeletion(v=>!v)} className="rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm font-bold text-rose-700">{showDeletion?'Ocultar eliminación':'Eliminar cuenta KawMed definitivamente'}</button>
        {showDeletion&&<div className="mt-4 rounded-xl border border-rose-300 bg-rose-50 p-4">
          <h3 className="font-black text-rose-900">Eliminación irreversible y liberación del correo</h3>
          <p className="mt-2 text-sm text-rose-800">Se elimina el perfil médico, centros, horarios y solicitudes de cita, y se intenta eliminar la identidad de acceso para liberar su correo. Un código MED ya utilizado no vuelve a estar disponible. Si esta cuenta tiene otros perfiles Link, permisos de patrocinio o registros vinculados, se bloqueará la eliminación para protegerlos.</p>
          <label className="mt-3 block text-sm font-bold">Confirma tu correo<input value={deleteEmail} onChange={e=>setDeleteEmail(e.target.value)} placeholder={String(profile.account_email||'')} autoComplete="off" className={input}/></label>
          <label className="mt-3 block text-sm font-bold">Confirma tu enlace público<input value={deleteSlug} onChange={e=>setDeleteSlug(e.target.value)} placeholder={String(profile.slug||'')} className={input}/></label>
          <label className="mt-3 block text-sm font-bold">Escribe ELIMINAR KAWMED<input value={deletePhrase} onChange={e=>setDeletePhrase(e.target.value)} className={input}/></label>
          <button type="button" disabled={lifecycleBusy||deleteEmail.trim().toLowerCase()!==String(profile.account_email||'').trim().toLowerCase()||deleteSlug!==String(profile.slug||'')||deletePhrase.trim().toUpperCase()!=='ELIMINAR KAWMED'} onClick={()=>void deleteMedicalAccount()} className="mt-4 rounded-xl bg-rose-800 px-4 py-3 text-sm font-black text-white disabled:opacity-40">Confirmar eliminación definitiva</button>
        </div>}
      </div>
      {lifecycleConfirm&&<div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm"><p className="font-bold">{lifecycleConfirm==='suspend'?'¿Confirmas que deseas suspender tu perfil médico?':'¿Confirmas que deseas reactivar tu perfil como borrador?'}</p><div className="mt-3 flex gap-3"><button type="button" disabled={lifecycleBusy} onClick={()=>void changeLifecycle(lifecycleConfirm)} className="rounded-xl bg-slate-950 px-4 py-2 font-bold text-white">Sí, confirmar</button><button type="button" disabled={lifecycleBusy} onClick={()=>setLifecycleConfirm(null)} className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-bold">Cancelar</button></div></div>}
    </section>}

    {previewOpen&&<div role="dialog" aria-modal="true" aria-label="Vista previa de perfil médico" className="rounded-[24px] border border-cyan-200 bg-white p-5 shadow-lg">
      <div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-black">Vista previa del perfil</h2><p className="mt-1 text-sm text-slate-500">Vista privada de los datos guardados. No publica el perfil.</p></div><button type="button" onClick={()=>setPreviewOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold">Cerrar</button></div>
      <div className="mx-auto mt-4 max-w-md overflow-hidden rounded-2xl border border-slate-200">
        {(profile.cover_url||profile.avatar_url)&&<img src={profile.cover_url||profile.avatar_url} alt="Fotografía del perfil" className="aspect-[4/3] w-full object-cover"/>}
        <div className="p-5"><h3 className="text-2xl font-black">{[profile.professional_prefix,profile.name].filter(Boolean).join(' ')}</h3><p className="mt-1 font-bold text-cyan-700">{profile.specialty}</p>{profile.bio&&<p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{profile.bio}</p>}<p className="mt-3 text-sm text-slate-500">{[profile.city,profile.province].filter(Boolean).join(' · ')}</p><p className="mt-2 text-xs text-slate-400">Enlace previsto: /m/{profile.slug}</p></div>
      </div>
      {profile.status==='active'&&<button type="button" onClick={()=>window.open(publicOrigin()+'/m/'+encodeURIComponent(profile.slug),'_blank','noopener,noreferrer')} className="mt-4 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white">Abrir versión pública</button>}
    </div>}

    {pending&&<ImageCropModal file={pending.file} aspectRatio={pending.kind==='avatar'?1:4/4.25} outputWidth={pending.kind==='avatar'?1024:1200} onSave={async(blob)=>{const kind=pending.kind;setPending(null);await saveImage(blob,kind)}} onCancel={()=>setPending(null)}/>}
  </div></Shell>
}
