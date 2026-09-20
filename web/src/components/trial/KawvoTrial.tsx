import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { FaBars, FaBell, FaCamera, FaCheck, FaCopy, FaDownload, FaEllipsisH, FaPalette, FaPlus, FaQrcode, FaShareAlt, FaTimes, FaUniversity } from 'react-icons/fa'
import IntapLinkGratisProfile from '../free-profile/IntapLinkGratisProfile'
import TrialImageCrop from './TrialImageCrop'
import { TrialBanks, TrialBanksEditor, TrialLocationButton, TrialLocationPanel, TrialPalettePanel, type TrialBank } from './TrialPanels'
import type { FreeProfileAppearanceColors, FreeProfileData, FreeProfileLayoutId } from '../free-profile/IntapLinkGratis.types'
import './KawvoTrial.css'

type Snapshot={layout:FreeProfileLayoutId;colors:FreeProfileAppearanceColors;profile:FreeProfileData;modules?:{banks?:{enabled:boolean;items:TrialBank[]}}}
type Prospect={contact_name:string;phone:string;whatsapp:string;email:string;instagram:string;company_name:string;company_type:string;source:string;source_detail:string;notes:string}
type Trial={id:string;slug:string|null;name:string|null;status:'draft'|'active'|'inactive'|'expired';profile:Snapshot;duration_hours:number;prospect?:Prospect;started_at?:string|null;activated_at:string|null;expires_at:string|null}
type Mode='master'|'editor'|'owner'|'public'
type TrialNotification={id:string;title:string;body:string;cta_label?:string|null;cta_url?:string|null;read_at?:string|null;created_at:string}

const FALLBACK:Snapshot={
  layout:'impacto',
  colors:{primary:'#0C4A6E',secondary:'#0284C7',accent:'#0891B2',button:'#0284C7',background:'#F0F9FF',surface:'#FFFFFF',text:'#0F172A',heroGradient:'#0C4A6E'},
  profile:{id:'trial-master',slug:'trial',name:'Laura Gómez',role:'Profesional independiente',personalBadge:'Trial Kawvo Link',aboutTitle:'Sobre mí',portfolioTitle:'Mis trabajos',servicesTitle:'Mis servicios',servicesDescription:'Una muestra de lo que puedo hacer por ti.',bio:'Ayudo a mis clientes con soluciones prácticas, atención personalizada y un servicio pensado para sus necesidades.',phone:'18090000000',whatsapp:'18090000000',email:'',whatsappGreetingName:'Laura',whatsappCtaLabel:'Hablar por WhatsApp',instagram:'kawvolink',location:'Parque Duarte, Samaná',portrait:'/assets/free-starter/servicios-profesionales/servicios-profesionales-01.webp',hero:'/assets/free-starter/servicios-profesionales/servicios-profesionales-01.webp',heroPositionX:50,heroPositionY:50,heroZoom:1,category:'Trial',vcardFileName:'kawvo-trial.vcf',quickActions:[{type:'call',label:'Llamar',url:'tel:+18090000000'},{type:'instagram',label:'Instagram',url:'https://instagram.com/kawvolink'},{type:'location',label:'Ubicación',url:'https://www.google.com/maps/search/?api=1&query=Parque+Duarte+Samana'}],services:[],portfolio:[],customLinks:[]}
}

function adminOrigin(){
  const host=window.location.hostname.toLowerCase()
  if(host==='preview.intaprd.com'||host.includes('preview')||host.endsWith('.pages.dev'))return 'https://app.preview.intaprd.com'
  return 'https://app.intaprd.com'
}
function protectedPath(path:string){return path.startsWith('/api/v1/superadmin/')||path.startsWith('/api/v1/me/trials/online')?adminOrigin()+path:path}

async function api(path:string,init?:RequestInit){
  const response=await fetch(protectedPath(path),{credentials:'include',...init,headers:{...(init?.body instanceof FormData?{}:{'Content-Type':'application/json'}),...(init?.headers||{})}})
  const body=await response.json().catch(()=>({ok:false,error:'Respuesta inválida'}))
  if(!response.ok)throw new Error(body.error||'No se pudo completar la operación.')
  return body
}
function cleanPhone(v:string){return v.replace(/\D/g,'').slice(0,15)}
function cleanInstagram(v:string){return v.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i,'').replace(/^@/,'').replace(/\/$/,'').slice(0,40)}
function suggestedSlug(v:string){return v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60)}
function isoDisplay(v:string|null){if(!v)return '—';const d=new Date(v.includes('T')?v:v.replace(' ','T')+'Z');return Number.isNaN(d.getTime())?'—':d.toLocaleString('es-DO',{dateStyle:'medium',timeStyle:'short'})}

export default function KawvoTrial({mode}:{mode:Mode}){
  const {id='',slug=''}=useParams(); const navigate=useNavigate()
  const [snapshot,setSnapshot]=useState<Snapshot>(FALLBACK)
  const [trial,setTrial]=useState<Trial|null>(null)
  const [admin,setAdmin]=useState(false)
  const [loading,setLoading]=useState(mode!=='master')
  const [error,setError]=useState('')
  const [panel,setPanel]=useState(false)
  const [section,setSection]=useState<'identity'|'contact'|'about'|'portfolio'|'services'|'links'|'location'|'appearance'|'banks'|null>(null)
  const [createConfig,setCreateConfig]=useState(false)
  const [createBanks,setCreateBanks]=useState(false)
  const [createDuration,setCreateDuration]=useState(72)
  const [createProspect,setCreateProspect]=useState<Prospect>({contact_name:'',phone:'',whatsapp:'',email:'',instagram:'',company_name:'',company_type:'',source:'fair_event',source_detail:'',notes:''})
  const [prospectOpen,setProspectOpen]=useState(false)
  const [prospectDraft,setProspectDraft]=useState<Prospect|null>(null)
  const [locationQuery,setLocationQuery]=useState('')
  const [locationPreview,setLocationPreview]=useState('')
  const [crop,setCrop]=useState<{kind:'avatar'|'hero'|'gallery';file:File}|null>(null)
  const [cropIndex,setCropIndex]=useState<number|null>(null)
  const [serviceCropIndex,setServiceCropIndex]=useState<number|null>(null)
  const [saving,setSaving]=useState<'idle'|'saving'|'saved'|'error'>('idle')
  const [toolsOpen,setToolsOpen]=useState(false)
  const [extrasOpen,setExtrasOpen]=useState(false)
  const [finish,setFinish]=useState(false)
  const [trialName,setTrialName]=useState('')
  const [trialSlug,setTrialSlug]=useState('')
  const [slugState,setSlugState]=useState('')
  const [published,setPublished]=useState<any>(null)
  const [qr,setQr]=useState('')
  const saveTimer=useRef<number|undefined>()
  const toolbarRef=useRef<HTMLDivElement|null>(null)
  const notificationRef=useRef<HTMLDivElement|null>(null)
  const anonymousVisitorRef=useRef(crypto.randomUUID())
  const anonymousSessionRef=useRef(crypto.randomUUID())
  const [privacyChoice,setPrivacyChoice]=useState<'accepted'|'essential'|null>(null)
  const [privacyManage,setPrivacyManage]=useState(false)
  const [notifications,setNotifications]=useState<TrialNotification[]>([])
  const [notificationsOpen,setNotificationsOpen]=useState(false)
  const [conversionRequested,setConversionRequested]=useState(false)
  const [publicOwner,setPublicOwner]=useState(false)
  const [copiedMessage,setCopiedMessage]=useState('')
  const [copiedTarget,setCopiedTarget]=useState<'success-link'|'other'|''>('')

  useEffect(()=>{api('/api/v1/superadmin/trials/context').then(()=>setAdmin(true)).catch(()=>setAdmin(false))},[])
  useEffect(()=>{if(mode!=='public')return;const saved=localStorage.getItem('kawvo_trial_privacy_v1');setPrivacyChoice(saved==='accepted'||saved==='essential'?saved:null)},[mode])
  useEffect(()=>{
    if(mode==='master'){
      api('/api/v1/public/trials/master').then(r=>setSnapshot(r.data)).catch(()=>setSnapshot(FALLBACK))
      if(new URLSearchParams(window.location.search).get('new')==='1'){
        setCreateConfig(true)
        window.history.replaceState(null,'','/trial')
      }
      return
    }
    const path=mode==='editor'?'/api/v1/superadmin/trials/'+encodeURIComponent(id):mode==='owner'?'/api/v1/me/trials/online/'+encodeURIComponent(id):'/api/v1/public/trials/'+encodeURIComponent(slug)
    api(path).then(r=>{setTrial(r.data);setSnapshot(r.data.profile);setTrialName(r.data.name||r.data.profile?.profile?.name||'');setTrialSlug(r.data.slug||suggestedSlug(r.data.profile?.profile?.name||''))}).catch(e=>setError(e.message)).finally(()=>setLoading(false))
  },[mode,id,slug])

  useEffect(()=>()=>{if(saveTimer.current)window.clearTimeout(saveTimer.current)},[])
  function closeToolbarOverlays(){
    setToolsOpen(false)
    setExtrasOpen(false)
    setNotificationsOpen(false)
  }
  useEffect(()=>{
    function onPointerDown(event:MouseEvent|TouchEvent){
      const target=event.target as Node|null
      if(target&&toolbarRef.current?.contains(target))return
      if(target&&notificationRef.current?.contains(target))return
      closeToolbarOverlays()
    }
    document.addEventListener('mousedown',onPointerDown)
    document.addEventListener('touchstart',onPointerDown,{passive:true})
    return ()=>{document.removeEventListener('mousedown',onPointerDown);document.removeEventListener('touchstart',onPointerDown)}
  },[])
  async function loadOwnerNotifications(){
    if(mode!=='owner'||!id)return
    try{const r=await api('/api/v1/me/trials/online/'+encodeURIComponent(id)+'/notifications');setNotifications(r.data||[])}catch{/* owner editor remains usable */}
  }
  useEffect(()=>{void loadOwnerNotifications()},[mode,id])
  async function detectPublicOwner(){
    if(mode!=='public'||!trial?.id)return
    try{
      const r=await api('/api/v1/me/trials/online')
      const mine=r?.data
      if(mine?.id&&String(mine.id)===String(trial.id)){
        setPublicOwner(true)
        const notices=await api('/api/v1/me/trials/online/'+encodeURIComponent(trial.id)+'/notifications').catch(()=>({data:[]}))
        setNotifications(notices?.data||[])
      }else setPublicOwner(false)
    }catch{setPublicOwner(false)}
  }
  useEffect(()=>{void detectPublicOwner()},[mode,trial?.id])

  function analyticsIds(){
    if(privacyChoice!=='accepted')return {visitorId:anonymousVisitorRef.current,sessionId:anonymousSessionRef.current}
    let visitorId=localStorage.getItem('kawvo_trial_visitor_id')||''
    if(!visitorId){visitorId=crypto.randomUUID();localStorage.setItem('kawvo_trial_visitor_id',visitorId)}
    let sessionId=sessionStorage.getItem('kawvo_trial_session_id')||''
    if(!sessionId){sessionId=crypto.randomUUID();sessionStorage.setItem('kawvo_trial_session_id',sessionId)}
    return {visitorId,sessionId}
  }
  function choosePrivacy(choice:'accepted'|'essential'){
    localStorage.setItem('kawvo_trial_privacy_v1',choice)
    if(choice==='essential'){
      localStorage.removeItem('kawvo_trial_visitor_id')
      sessionStorage.removeItem('kawvo_trial_session_id')
    }
    setPrivacyChoice(choice)
  }
  function trackTrialEvent(eventType:string,eventLabel=''){
    if(mode!=='public'||!trial?.slug||trial.status!=='active')return
    const {visitorId,sessionId}=analyticsIds()
    const params=new URLSearchParams(window.location.search)
    fetch('/api/v1/public/trials/'+encodeURIComponent(trial.slug)+'/events',{
      method:'POST',headers:{'Content-Type':'application/json'},keepalive:true,
      body:JSON.stringify({
        event_type:eventType,event_label:eventLabel,visitor_id:visitorId,session_id:sessionId,
        referrer:document.referrer||'',utm_source:params.get('utm_source')||'',utm_medium:params.get('utm_medium')||'',utm_campaign:params.get('utm_campaign')||''
      })
    }).catch(()=>undefined)
  }
  useEffect(()=>{if(mode==='public'&&trial?.slug&&trial.status==='active'&&privacyChoice!==null)trackTrialEvent('visit','Perfil abierto')},[mode,trial?.id,privacyChoice])

  function rebuildContacts(profile:FreeProfileData){
    const phone=cleanPhone(profile.phone||'');const whatsapp=cleanPhone(profile.whatsapp||'');const instagram=cleanInstagram(profile.instagram||'');const email=String(profile.email||'').trim()
    const selected=(profile.quickActions||[]).slice(0,3).map(action=>{
      if(action.type==='call')return {...action,label:'Llamar',url:phone?`tel:+${phone}`:''}
      if(action.type==='instagram')return {...action,label:'Instagram',url:instagram?`https://instagram.com/${instagram}`:''}
      if(action.type==='email')return {...action,label:'Email',url:email?`mailto:${email}`:''}
      if(action.type==='location')return {...action,label:'Ubicación',url:profile.location?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(profile.location)}`:''}
      return action
    }).filter(action=>Boolean(action.url))
    return {...profile,phone,whatsapp,instagram,quickActions:selected,whatsappGreetingName:profile.name.split(' ')[0]||'Hola'}
  }
  function change<K extends keyof FreeProfileData>(key:K,value:FreeProfileData[K]){
    setSnapshot(current=>{const next={...current,profile:rebuildContacts({...current.profile,[key]:value})};queueSave(next);return next})
  }
  function toggleQuickAction(type:'call'|'instagram'|'location'|'email'|'tiktok'){
    setSnapshot(current=>{const items=current.profile.quickActions||[];const exists=items.some(a=>a.type===type);if(!exists&&items.length>=3){setError('Máximo alcanzado: el Perfil Free permite 3 botones de contacto.');return current}
      const labels:any={call:'Llamar',instagram:'Instagram',location:'Ubicación',email:'Email',tiktok:'TikTok'}
      const defaults:any={call:current.profile.phone?`tel:+${cleanPhone(current.profile.phone)}`:'',instagram:current.profile.instagram?`https://instagram.com/${cleanInstagram(current.profile.instagram)}`:'',location:current.profile.location?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(current.profile.location)}`:'',email:current.profile.email?`mailto:${current.profile.email}`:'',tiktok:'https://tiktok.com/@'}
      const quickActions=exists?items.filter(a=>a.type!==type):[...items,{type,label:labels[type],url:defaults[type]}].slice(0,3)
      const next={...current,profile:{...current.profile,quickActions}};queueSave(next);return next})
  }
  function setQuickActionUrl(type:'tiktok',url:string){setSnapshot(current=>{const next={...current,profile:{...current.profile,quickActions:current.profile.quickActions.map(a=>a.type===type?{...a,url}:a)}};queueSave(next);return next})}
  function queueSave(next:Snapshot){
    if((mode!=='editor'&&mode!=='owner')||!id)return
    setSaving('saving');if(saveTimer.current)window.clearTimeout(saveTimer.current)
    const endpoint=mode==='owner'?'/api/v1/me/trials/online/'+encodeURIComponent(id):'/api/v1/superadmin/trials/'+encodeURIComponent(id)
    saveTimer.current=window.setTimeout(()=>api(endpoint,{method:'PATCH',body:JSON.stringify({profile:next})}).then(()=>setSaving('saved')).catch(()=>setSaving('error')),450)
  }
  async function createTrial(){
    try{const r=await api('/api/v1/superadmin/trials',{method:'POST',body:JSON.stringify({modules:{banks:createBanks},duration_hours:createDuration,prospect:createProspect})});setCreateConfig(false);navigate('/trial/edit/'+r.data.id)}catch(e:any){setError(e.message)}
  }
  async function openProspect(){
    if(!trial?.id)return
    try{const r=await api('/api/v1/superadmin/trials/'+encodeURIComponent(trial.id));setProspectDraft(r.data.prospect);setProspectOpen(true)}catch(e:any){setError(e.message)}
  }
  async function saveProspect(){
    if(!trial?.id||!prospectDraft)return
    try{await api('/api/v1/superadmin/trials/'+encodeURIComponent(trial.id),{method:'PATCH',body:JSON.stringify({prospect:prospectDraft})});setProspectOpen(false)}catch(e:any){setError(e.message)}
  }
  function openSection(next:typeof section){setSection(next);setPanel(true)}
  function choosePalette(colors:FreeProfileAppearanceColors){setSnapshot(current=>{const next={...current,colors};queueSave(next);return next})}
  function confirmLocation(){if(!locationPreview)return;change('location',locationQuery.trim()||locationPreview);setPanel(false)}
  function toggleBanks(enabled:boolean){setSnapshot(current=>{const next={...current,modules:{...current.modules,banks:{enabled,items:current.modules?.banks?.items||[]}}};queueSave(next);return next})}
  function updateBank(index:number,patch:Partial<TrialBank>){setSnapshot(current=>{const bank=current.modules?.banks||{enabled:true,items:[]};const next={...current,modules:{...current.modules,banks:{...bank,items:bank.items.map((item,i)=>i===index?{...item,...patch}:item)}}};queueSave(next);return next})}
  function addBank(){setSnapshot(current=>{const bank=current.modules?.banks||{enabled:true,items:[]};if(bank.items.length>=3)return current;const item:TrialBank={id:crypto.randomUUID(),bank_code:'popular',bank_name:'Banco Popular Dominicano',account_number:'',account_type:'savings',currency:'DOP',holder_name:current.profile.name,holder_id_type:'cedula',holder_id_number:'',display_mode:'masked'};const next={...current,modules:{...current.modules,banks:{enabled:true,items:[...bank.items,item]}}};queueSave(next);return next})}
  function removeBank(index:number){setSnapshot(current=>{const bank=current.modules?.banks||{enabled:true,items:[]};const next={...current,modules:{...current.modules,banks:{...bank,items:bank.items.filter((_,i)=>i!==index)}}};queueSave(next);return next})}
  function chooseImage(kind:'avatar'|'hero'|'gallery',file?:File){if(file)setCrop({kind,file})}
  async function upload(kind:'avatar'|'hero'|'gallery',file?:File){
    if(!file||(mode!=='editor'&&mode!=='owner'))return
    const fd=new FormData();fd.append('file',file)
    try{setSaving('saving');const mediaEndpoint=mode==='owner'?`/api/v1/me/trials/online/${encodeURIComponent(id)}/media?kind=${kind}`:`/api/v1/superadmin/trials/${encodeURIComponent(id)}/media?kind=${kind}`;const r=await api(mediaEndpoint,{method:'POST',body:fd})
      if(kind==='avatar')change('portrait',r.url)
      else if(kind==='hero')change('hero',r.url)
      else {if(serviceCropIndex!==null){change('services',snapshot.profile.services.map((p,i)=>i===serviceCropIndex?{...p,image:r.url}:p));setServiceCropIndex(null)}else if(cropIndex!==null){change('portfolio',snapshot.profile.portfolio.map((p,i)=>i===cropIndex?{...p,image:r.url}:p));setCropIndex(null)}else if(snapshot.profile.portfolio.length<5){const item={id:crypto.randomUUID(),title:'Nuevo trabajo',description:'',image:r.url};change('portfolio',[...snapshot.profile.portfolio,item])}}
    }catch(e:any){setError(e.message);setSaving('error');throw e}
  }
  function removePortfolio(itemId:string){change('portfolio',snapshot.profile.portfolio.filter(x=>x.id!==itemId))}
  async function checkSlug(value:string){
    const next=suggestedSlug(value);setTrialSlug(next);if(next.length<2){setSlugState('Slug no válido');return}
    try{const endpoint=mode==='owner'?'/api/v1/me/trials/online/slug/'+encodeURIComponent(next):'/api/v1/superadmin/trials/slug/'+encodeURIComponent(next)+(id?'?trial_id='+encodeURIComponent(id):'');const r=await api(endpoint);setSlugState(r.available?'Disponible':'No disponible')}catch(e:any){setSlugState(e.message)}
  }
  async function publish(){
    if(saveTimer.current){window.clearTimeout(saveTimer.current);saveTimer.current=undefined}
    try{
      setSaving('saving');const saveEndpoint=mode==='owner'?'/api/v1/me/trials/online/'+encodeURIComponent(id):'/api/v1/superadmin/trials/'+encodeURIComponent(id);const publishEndpoint=mode==='owner'?'/api/v1/me/trials/online/'+encodeURIComponent(id)+'/publish':'/api/v1/superadmin/trials/'+encodeURIComponent(id)+'/publish';await api(saveEndpoint,{method:'PATCH',body:JSON.stringify({profile:snapshot})})
      const r=await api(publishEndpoint,{method:'POST',body:JSON.stringify({name:trialName,slug:trialSlug})})
      setPublished(r.data);setSaving('saved');setFinish(false)
      const QRCode=await import('qrcode');setQr(await QRCode.toDataURL(window.location.origin+r.data.url,{width:900,margin:3,errorCorrectionLevel:'H'}))
    }catch(e:any){setError(e.message);setSaving('error')}
  }
  async function requestConversion(){
    if(mode!=='owner'||!id||conversionRequested)return
    try{await api('/api/v1/me/trials/online/'+encodeURIComponent(id)+'/conversion-request',{method:'POST',body:'{}'});setConversionRequested(true)}catch(e:any){setError(e.message)}
  }
  async function readNotification(item:TrialNotification){
    const ownerTrialId=mode==='owner'?id:publicOwner&&trial?.id?trial.id:''
    if(!ownerTrialId||item.read_at)return
    try{await api('/api/v1/me/trials/online/'+encodeURIComponent(ownerTrialId)+'/notifications/'+encodeURIComponent(item.id)+'/read',{method:'POST',body:'{}'});setNotifications(current=>current.map(n=>n.id===item.id?{...n,read_at:new Date().toISOString()}:n))}catch{/* non blocking */}
  }
  function flashMessage(message:string,target:'success-link'|'other'='other'){setCopiedMessage(message);setCopiedTarget(target);window.setTimeout(()=>{setCopiedMessage('');setCopiedTarget('')},1800)}
  async function copy(text:string,message='Enlace copiado',target:'success-link'|'other'='other'){await navigator.clipboard.writeText(text);flashMessage(message,target)}
  async function share(url:string){
    if(navigator.share)await navigator.share({title:snapshot.profile.name||'Presentación KawLink',text:'Te comparto mi presentación digital en KawLink.',url})
    else await copy(url,'Enlace copiado para compartir')
  }
  function shareableUrl(path:string){
    const clean=path.split('?')[0]
    return `${window.location.origin}${clean}?share=perfil&card=3`
  }
  async function inviteFriend(){
    const inviteUrl=`${window.location.origin}/trial/login`
    const text='He configurado mi presentación digital en KawLink. Te invito a probar y crear la tuya gratis.'
    if(navigator.share)await navigator.share({title:'Prueba KawLink gratis',text,url:inviteUrl})
    else await copy(`${text}\n${inviteUrl}`,'Invitación copiada')
  }
  function downloadQr(){
    if(!qr)return
    const a=document.createElement('a');a.href=qr;a.download=`kawlink-${published?.slug||trialSlug||'presentacion'}-qr.png`;document.body.appendChild(a);a.click();a.remove();flashMessage('QR descargado')
  }
  function closePublished(){
    const url=published?.url
    setPublished(null)
    setQr('')
    window.location.assign(url||((mode==='owner'&&id)?'/trial/mi/'+encodeURIComponent(id):'/trial'))
  }
  function continueEditing(){
    setPublished(null)
    setQr('')
    if(mode==='owner'&&id){window.location.assign('/trial/mi/'+encodeURIComponent(id));return}
    if(mode==='editor'&&id){window.location.assign('/trial/edit/'+encodeURIComponent(id));return}
  }

  const trialShareUrl=trial?.slug?`${window.location.origin}/trial/${encodeURIComponent(trial.slug)}?share=perfil&card=3`:window.location.href
  const isPresentationOwner=mode==='owner'||(mode==='public'&&publicOwner)
  const trialInterestMessage=isPresentationOwner
    ? `Hola, ya configuré mi presentación digital en KawLink y quiero activarla definitivamente. ¿Cómo continúo?\n${trialShareUrl}`
    : `Hola, vi esta presentación digital creada con KawLink y me interesa conocer cómo obtener la mía.\n${trialShareUrl}`
  const trialInterestUrl='https://wa.me/18097059802?text='+encodeURIComponent(trialInterestMessage)
  const trialInterestLabel=isPresentationOwner?'Activar mi presentación':'Me interesa KawLink'
  const requiredPresentationFields=[
    {key:'name',label:'Tu nombre',ok:Boolean(snapshot.profile.name?.trim())&&snapshot.profile.name.trim().toLowerCase()!=='laura gómez'},
    {key:'role',label:'Cargo o especialidad',ok:Boolean(snapshot.profile.role?.trim())},
    {key:'phone',label:'Teléfono o WhatsApp',ok:Boolean(cleanPhone(snapshot.profile.phone||snapshot.profile.whatsapp||''))&&cleanPhone(snapshot.profile.phone||snapshot.profile.whatsapp||'')!=='18090000000'},
    {key:'slug',label:'Tu usuario',ok:Boolean(trialSlug&&trialSlug.length>=2&&slugState!=='No disponible'&&slugState!=='Slug no válido')},
  ]
  const recommendedPresentationFields=[
    {key:'instagram',label:'Instagram',ok:Boolean(cleanInstagram(snapshot.profile.instagram||''))&&cleanInstagram(snapshot.profile.instagram||'')!=='kawvolink'},
    {key:'about',label:'Sobre mí / Qué hago',ok:Boolean(snapshot.profile.bio?.trim())},
  ]
  const missingRequired=requiredPresentationFields.filter(item=>!item.ok)
  const sourceOptions=[['fair_event','Feria / Evento'],['commercial_visit','Visita comercial'],['street_direct','Calle / contacto directo'],['whatsapp','WhatsApp'],['instagram','Instagram'],['web','Web'],['referral','Referido'],['call','Llamada'],['point_of_sale','Punto de venta'],['other','Otro']] as const
  const companyTypes=['Servicios profesionales','Automotriz / Taller','Belleza / Estética','Construcción / Ferretería','Salud','Gastronomía','Tecnología','Comercio / Retail','Educación','Inmobiliaria']
  const unreadNotifications=notifications.filter(n=>!n.read_at).length
  const editorTop=(mode==='editor'||mode==='owner')?<div className="trial-adminbar" ref={toolbarRef}><div className="trial-adminbar-main"><strong>{mode==='owner'?'Editando presentación':'TRIAL · Editando'}</strong><button className="trial-tools-menu" aria-label="Opciones de edición" aria-expanded={toolsOpen} onClick={()=>{setToolsOpen(v=>!v);setExtrasOpen(false);setNotificationsOpen(false)}}><FaBars/><span>Opciones</span></button><div className={`trial-tools ${toolsOpen?'open':''}`}><button className="trial-tool" onClick={()=>{openSection("appearance");setToolsOpen(false);setExtrasOpen(false)}}><FaPalette/> Colores</button><div className="trial-extras-wrap"><button className="trial-tool trial-extras-trigger" onClick={()=>{setExtrasOpen(v=>!v);setNotificationsOpen(false)}}><FaEllipsisH/> Extras</button>{extrasOpen&&<div className="trial-extras-menu"><button onClick={()=>{openSection("links");setExtrasOpen(false);setToolsOpen(false)}}><FaPlus/> Mis enlaces</button><button onClick={()=>{openSection("banks");setExtrasOpen(false);setToolsOpen(false)}}><FaUniversity/> Cuentas bancarias</button></div>}</div>{mode==='editor'&&<button className="trial-tool" onClick={()=>{void openProspect();setToolsOpen(false);setExtrasOpen(false)}}><FaPlus/> Prospecto</button>}</div>{mode==='owner'&&<div className="trial-owner-actions"><button className="trial-owner-bell" aria-label="Notificaciones" onClick={()=>{setNotificationsOpen(v=>!v);setToolsOpen(false);setExtrasOpen(false)}}><FaBell/>{unreadNotifications>0&&<b>{unreadNotifications}</b>}</button></div>}<button className="trial-primary trial-finish-btn" onClick={()=>{setTrialName(snapshot.profile.name);setTrialSlug(trial?.slug||suggestedSlug(snapshot.profile.name));setFinish(true);setExtrasOpen(false)}}><FaCheck/><span>Finalizar</span></button><span className={`trial-save ${saving}`}>{saving==='saving'?'Guardando…':saving==='error'?'Error':'Guardado'}</span></div></div>:undefined

  if(mode==='owner'&&trial?.status==='expired')return <div className="trial-expired"><div><span>KAWVO LINK</span><h1>Tu prueba gratuita ha finalizado.</h1><p>Tu presentación y su información permanecen guardadas. Puedes solicitar la activación definitiva para continuar utilizándola.</p><button className="trial-primary" onClick={()=>void requestConversion()} disabled={conversionRequested}>{conversionRequested?'Solicitud enviada':'Quiero esta presentación'}</button></div></div>
  if(loading)return <div className="trial-state">Cargando Trial…</div>
  if(error && !trial && mode!=='master')return <div className="trial-state"><h1>No pudimos abrir este Trial</h1><p>{error}</p></div>
  if(mode==='public'&&trial?.status==='expired')return <div className="trial-expired"><div><span>KAWVO LINK</span><h1>Esta presentación no está disponible temporalmente.</h1></div></div>
  if(mode==='public'&&trial?.status==='inactive')return <div className="trial-expired"><div><span>KAWVO LINK</span><h1>Esta demostración está desactivada.</h1><p>El perfil Trial fue pausado por el administrador y conserva su enlace para una posible reactivación.</p><a href="https://wa.me/18095368224" target="_blank" rel="noreferrer">Contactar a Kawvo Link</a></div></div>

  return <>
    {mode==='public'&&publicOwner&&trial&&<div className="trial-public-ownerbar"><strong>Mi presentación</strong><button onClick={()=>navigate('/trial/mi/'+trial.id)}>Editar</button><button className="trial-owner-bell" aria-label="Notificaciones" onClick={()=>{setNotificationsOpen(v=>!v);setToolsOpen(false);setExtrasOpen(false)}}><FaBell/>{unreadNotifications>0&&<b>{unreadNotifications}</b>}</button></div>}
    {(mode==='owner'||(mode==='public'&&publicOwner))&&notificationsOpen&&<div className="trial-notification-popover" ref={notificationRef}><header><strong>Notificaciones</strong><button onClick={()=>setNotificationsOpen(false)} aria-label="Cerrar"><FaTimes/></button></header><div>{notifications.map(n=><article key={n.id} className={n.read_at?'read':''} onClick={()=>void readNotification(n)}><strong>{n.title}</strong><p>{n.body}</p>{n.cta_label&&n.cta_url&&<a href={n.cta_url} target="_blank" rel="noreferrer">{n.cta_label}</a>}</article>)}{!notifications.length&&<p className="trial-empty-notifications">No tienes notificaciones nuevas.</p>}</div></div>}
    <IntapLinkGratisProfile profile={snapshot.profile} layout={snapshot.layout} colors={snapshot.colors} topContent={editorTop} footerSecondaryLabel={trialInterestLabel} footerSecondaryHref={trialInterestUrl} beforeShareContent={snapshot.modules?.banks?.enabled?<TrialBanks banks={snapshot.modules.banks.items} editMode={mode==='editor'||mode==='owner'} onEdit={()=>openSection("banks")} publicSlug={mode==='public'?(trial?.slug||slug):undefined}/>:undefined} editMode={mode==='editor'||mode==='owner'} onTrackEvent={mode==='public'?trackTrialEvent:undefined} onEditSection={(s)=>{if(s==='hero'||s==='avatar'){document.getElementById('trial-'+s+'-input')?.click()}else{openSection(s)}}}/>
    {(mode==='editor'||mode==='owner')&&<><input id="trial-hero-input" hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>chooseImage('hero',e.target.files?.[0])}/><input id="trial-avatar-input" hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>chooseImage('avatar',e.target.files?.[0])}/></>}
    {mode==='master'&&admin&&<button className="trial-create" onClick={()=>setCreateConfig(true)}>+ Crear Trial</button>}
    {mode==='public'&&admin&&trial&&<div className="trial-public-admin"><strong>⚙️ Trial</strong><span>Vence: {isoDisplay(trial.expires_at)}</span><button onClick={()=>navigate('/trial')}>Volver a Trial</button><button onClick={()=>void openProspect()}>Ficha prospecto</button><button onClick={()=>window.location.href=adminOrigin()+'/superadmin/trials'}>Gestionar</button><button onClick={()=>navigate('/trial/edit/'+trial.id)}>Editar en vivo</button><button onClick={()=>copy(window.location.href)}>Copiar enlace</button></div>}

    {panel&&section&&<div className="trial-sheet-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setPanel(false)}}><section className="trial-sheet trial-context-sheet">
      <header><div><strong>{section==='identity'?'Nombre y especialidad':section==='contact'?'Datos de contacto':section==='about'?'Quién soy / Qué hago':section==='portfolio'?'Portafolio':section==='services'?'Servicios':section==='links'?'Mis enlaces':section==='location'?'Ubicación':section==='appearance'?'Colores':'Cuentas bancarias'}</strong><small>Ves el cambio inmediatamente en el perfil.</small></div><button onClick={()=>setPanel(false)} aria-label="Cerrar"><FaTimes/></button></header>
      {section==='identity'&&<><label>Nombre<input autoFocus value={snapshot.profile.name} onChange={e=>change('name',e.target.value)}/></label><label>Cargo / especialidad<input value={snapshot.profile.role} onChange={e=>change('role',e.target.value)}/></label></>}
      {section==='about'&&<><label>Título<input maxLength={60} value={snapshot.profile.aboutTitle} onChange={e=>change('aboutTitle',e.target.value)}/></label><label>Quién soy / Qué hago<textarea autoFocus rows={4} value={snapshot.profile.bio} onChange={e=>change('bio',e.target.value)}/></label></>}
      {section==='contact'&&<><div className="trial-grid"><label>Teléfono<input inputMode="tel" value={snapshot.profile.phone} onChange={e=>change('phone',e.target.value)}/></label><label>WhatsApp<input inputMode="tel" value={snapshot.profile.whatsapp} onChange={e=>change('whatsapp',e.target.value)}/></label></div><label>Correo<input type="email" value={snapshot.profile.email} onChange={e=>change('email',e.target.value)}/></label><label>Instagram<input value={snapshot.profile.instagram} onChange={e=>change('instagram',e.target.value)}/></label><TrialLocationButton onClick={()=>{setLocationQuery(snapshot.profile.location);setLocationPreview("");openSection("location")}}/><div className="trial-quick-editor"><div className="trial-gallery-head"><div><strong>Botones de contacto</strong><small>{snapshot.profile.quickActions.length}/3 · Plan Free</small></div></div>{snapshot.profile.quickActions.length>=3&&<p className="trial-limit">✓ Máximo alcanzado · 3 accesos rápidos. Quita uno para sustituirlo.</p>}{(['call','instagram','location','email','tiktok'] as const).map(type=>{const active=snapshot.profile.quickActions.some(a=>a.type===type);const labels:any={call:'Llamar',instagram:'Instagram',location:'Ubicación',email:'Email',tiktok:'TikTok'};return <div className="trial-quick-option" key={type}><button className={active?'active':''} onClick={()=>toggleQuickAction(type)}>{active?'✓':''}</button><strong>{labels[type]}</strong>{type==='tiktok'&&active&&<input value={snapshot.profile.quickActions.find(a=>a.type==='tiktok')?.url||''} onChange={e=>setQuickActionUrl('tiktok',e.target.value)} placeholder="https://tiktok.com/@usuario"/>}</div>})}</div></>}
      {section==='services'&&<><div className="trial-section-fields"><label>Título de la sección<input maxLength={60} value={snapshot.profile.servicesTitle} onChange={e=>change('servicesTitle',e.target.value)}/></label><label>Descripción general<textarea maxLength={240} rows={3} value={snapshot.profile.servicesDescription} onChange={e=>change('servicesDescription',e.target.value)}/></label></div><div className="trial-gallery-head"><div><strong>Servicios</strong><small>{snapshot.profile.services.length}/3 · Plan Free</small></div><button disabled={snapshot.profile.services.length>=3} onClick={()=>change('services',[...snapshot.profile.services,{id:crypto.randomUUID(),title:'Nuevo servicio',description:'Descripción breve del servicio.',image:'',iconKey:'handshake'}])}><FaPlus/> {snapshot.profile.services.length>=3?'Máximo alcanzado':'Agregar'}</button></div>{snapshot.profile.services.length>=3&&<p className="trial-limit">✓ Máximo alcanzado · 3 servicios. Puedes editar, reemplazar imagen o eliminar cualquiera.</p>}{snapshot.profile.services.map((item,index)=><div className="trial-service-card" key={item.id}><div className="trial-service-media"><img src={item.image||snapshot.profile.portrait} alt=""/><label>Reemplazar<input type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(!f)return;setServiceCropIndex(index);setCrop({kind:'gallery',file:f})}}/></label></div><div className="trial-service-fields"><input maxLength={60} value={item.title} onChange={e=>change('services',snapshot.profile.services.map((z,i)=>i===index?{...z,title:e.target.value}:z))}/><textarea maxLength={180} rows={2} value={item.description} onChange={e=>change('services',snapshot.profile.services.map((z,i)=>i===index?{...z,description:e.target.value}:z))}/><small>{item.description.length}/180</small><div className="trial-service-actions"><label>{item.image?'Cambiar imagen':'Agregar imagen'}<input type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(!f)return;setServiceCropIndex(index);setCrop({kind:'gallery',file:f})}}/></label>{item.image&&<button onClick={()=>change('services',snapshot.profile.services.map((z,i)=>i===index?{...z,image:''}:z))}>Quitar imagen</button>}<button className="danger" onClick={()=>change('services',snapshot.profile.services.filter((_,i)=>i!==index))}>Eliminar</button></div></div></div>)}</>}
      {section==='links'&&<><div className="trial-gallery-head"><div><strong>Mis enlaces</strong><small>{snapshot.profile.customLinks.length}/3 · Plan Free</small></div><button disabled={snapshot.profile.customLinks.length>=3} onClick={()=>change('customLinks',[...snapshot.profile.customLinks,{id:crypto.randomUUID(),label:'Nuevo enlace',url:'https://'}])}><FaPlus/> {snapshot.profile.customLinks.length>=3?'Máximo alcanzado':'Agregar'}</button></div>{snapshot.profile.customLinks.length>=3&&<p className="trial-limit">✓ Máximo alcanzado · 3 enlaces. Puedes editar o eliminar cualquiera.</p>}{snapshot.profile.customLinks.map((item,index)=><div className="trial-link-edit" key={item.id}><input maxLength={80} value={item.label} onChange={e=>change('customLinks',snapshot.profile.customLinks.map((z,i)=>i===index?{...z,label:e.target.value}:z))}/><input inputMode="url" value={item.url} onChange={e=>change('customLinks',snapshot.profile.customLinks.map((z,i)=>i===index?{...z,url:e.target.value}:z))}/><button className="trial-delete" onClick={()=>change('customLinks',snapshot.profile.customLinks.filter((_,i)=>i!==index))}>Eliminar</button></div>)}</>}
      {section==='location'&&<TrialLocationPanel query={locationQuery} setQuery={setLocationQuery} preview={locationPreview} setPreview={setLocationPreview} onConfirm={confirmLocation}/>}
      {section==='appearance'&&<TrialPalettePanel onChoose={choosePalette}/>}
      {section==='banks'&&<TrialBanksEditor data={snapshot.modules?.banks||{enabled:false,items:[]}} toggle={toggleBanks} add={addBank} update={updateBank} remove={removeBank}/>}
      {section==='portfolio'&&<><div className="trial-section-fields"><label>Título de la sección<input maxLength={60} value={snapshot.profile.portfolioTitle} onChange={e=>change('portfolioTitle',e.target.value)}/></label></div><div className="trial-gallery-head"><div><strong>Imágenes</strong><small>{snapshot.profile.portfolio.length}/5 · Plan Free</small></div>{snapshot.profile.portfolio.length<5?<span className="trial-upload"><FaCamera/> Agregar<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e=>chooseImage('gallery',e.target.files?.[0])}/></span>:<button disabled><FaCamera/> Máximo alcanzado</button>}</div>{snapshot.profile.portfolio.length>=5&&<p className="trial-limit">✓ Máximo alcanzado · 5 imágenes. Puedes editar, reemplazar o eliminar cualquiera.</p>}{snapshot.profile.portfolio.map((item,index)=><div className="trial-work" key={item.id}><div className="trial-replace-wrap"><img src={item.image} alt=""/><label className="trial-replace">Reemplazar<input type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(!f)return;setCrop({kind:'gallery',file:f});setCropIndex(index)}}/></label></div><div><input value={item.title} onChange={e=>change('portfolio',snapshot.profile.portfolio.map((z,i)=>i===index?{...z,title:e.target.value}:z))}/><textarea rows={2} value={item.description} onChange={e=>change('portfolio',snapshot.profile.portfolio.map((z,i)=>i===index?{...z,description:e.target.value}:z))}/></div><button onClick={()=>removePortfolio(item.id)}>Eliminar</button></div>)}</>}
    </section></div>}
    {createConfig&&<div className="trial-sheet-backdrop"><section className="trial-sheet trial-create-sheet"><header><div><strong>Crear Trial</strong><small>Registra el prospecto y define la duración antes de editar.</small></div><button onClick={()=>setCreateConfig(false)}><FaTimes/></button></header><div className="trial-grid"><label>Nombre de contacto<input value={createProspect.contact_name} onChange={e=>setCreateProspect({...createProspect,contact_name:e.target.value})}/></label><label>WhatsApp<input inputMode="tel" value={createProspect.whatsapp} onChange={e=>setCreateProspect({...createProspect,whatsapp:e.target.value})}/></label><label>Teléfono<input inputMode="tel" value={createProspect.phone} onChange={e=>setCreateProspect({...createProspect,phone:e.target.value})}/></label><label>Correo<input type="email" value={createProspect.email} onChange={e=>setCreateProspect({...createProspect,email:e.target.value})}/></label><label>Instagram<input value={createProspect.instagram} onChange={e=>setCreateProspect({...createProspect,instagram:e.target.value})}/></label><label>Empresa<input value={createProspect.company_name} onChange={e=>setCreateProspect({...createProspect,company_name:e.target.value})}/></label><label>Tipo de empresa / actividad<input list="trial-company-types-create" value={createProspect.company_type} onChange={e=>setCreateProspect({...createProspect,company_type:e.target.value})}/><datalist id="trial-company-types-create">{companyTypes.map(x=><option key={x} value={x}/>)}</datalist></label><label>Origen<select value={createProspect.source} onChange={e=>setCreateProspect({...createProspect,source:e.target.value})}>{sourceOptions.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label></div><label>Detalle del origen<input placeholder="Ej. Expo Cibao Santiago 2026" value={createProspect.source_detail} onChange={e=>setCreateProspect({...createProspect,source_detail:e.target.value})}/></label><label>Duración<select value={createDuration} onChange={e=>setCreateDuration(Number(e.target.value))}><option value={24}>1 día</option><option value={48}>2 días</option><option value={72}>3 días</option><option value={96}>4 días</option><option value={120}>5 días</option><option value={144}>6 días</option><option value={168}>7 días</option></select></label><label className="trial-module-option"><span><FaUniversity/><b>Cuentas bancarias</b><small>Mismo bloque de transferencias disponible en Free.</small></span><input type="checkbox" checked={createBanks} onChange={e=>setCreateBanks(e.target.checked)}/></label><button className="trial-publish" onClick={createTrial}>Crear y editar en vivo</button></section></div>}
    {crop&&<TrialImageCrop file={crop.file} aspectRatio={crop.kind==='hero'?16/7:crop.kind==='avatar'||serviceCropIndex!==null?1:4/3} outputWidth={crop.kind==='hero'?1280:crop.kind==='avatar'?640:960} onCancel={()=>{setCrop(null);setCropIndex(null);setServiceCropIndex(null)}} onSave={async file=>{await upload(crop.kind,file);setCrop(null)}}/>}
    {finish&&<div className="trial-sheet-backdrop"><section className="trial-sheet trial-finish"><header><strong>{trial?.activated_at?'Actualizar presentación':'Publicar presentación'}</strong><button onClick={()=>setFinish(false)}><FaTimes/></button></header><p>{trial?.activated_at?'Puedes seguir editando durante tu período de prueba. Al actualizar, tu enlace y fecha de vencimiento se conservan.':'Antes de publicar, revisa tus datos básicos. Tu prueba Full es de 4 días desde la activación.'}</p><div className="trial-completion-list"><strong>Datos necesarios para publicar</strong>{requiredPresentationFields.map(item=><button key={item.key} className={item.ok?'ok':'pending'} onClick={()=>{if(item.key==='name'||item.key==='role')openSection('identity');else if(item.key==='phone')openSection('contact')}}><span>{item.ok?'✓':'!'}</span>{item.label}</button>)}<strong className="trial-recommended-title">También te recomendamos personalizar</strong>{recommendedPresentationFields.map(item=><button key={item.key} className={item.ok?'ok':'recommended'} onClick={()=>openSection(item.key==='instagram'?'contact':'about')}><span>{item.ok?'✓':'•'}</span>{item.label}</button>)}</div><label>Tu nombre<input value={snapshot.profile.name} onChange={e=>{change('name',e.target.value);setTrialName(e.target.value);if(!trial?.activated_at)checkSlug(e.target.value)}}/></label><label>Tu usuario<div className="trial-slug-row"><span>intaprd.com/trial/</span><input disabled={Boolean(trial?.activated_at)} value={trialSlug} onChange={e=>checkSlug(e.target.value)}/></div><small>{trial?.activated_at?'Tu usuario queda permanente después de publicar.':slugState||'Puedes usar el sugerido o escribir otro disponible.'}</small></label><button className="trial-publish" disabled={missingRequired.length>0} onClick={publish}>{trial?.activated_at?'Actualizar presentación':'Publicar presentación · 4 días'}</button>{missingRequired.length>0&&<small className="trial-finish-warning">{trial?.activated_at?'Completa los datos marcados antes de actualizar.':'Completa los datos marcados antes de publicar.'}</small>}</section></div>}

    {published&&<div className="trial-sheet-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)closePublished()}}><section className="trial-sheet trial-success" onMouseDown={e=>e.stopPropagation()}><button className="trial-success-close" type="button" onClick={closePublished} aria-label="Cerrar"><FaTimes/></button><FaCheck className="trial-success-icon"/><h2>Presentación creada</h2><p>Tu presentación está activa hasta {isoDisplay(published.expires_at)}.</p>{qr&&<img src={qr} alt="Código QR de tu presentación"/>}<strong>{window.location.origin}{published.url}</strong><div className="trial-success-actions"><button onClick={()=>copy(shareableUrl(published.url),'¡Enlace copiado!','success-link')}><FaCopy/> {copiedMessage&&copiedTarget==='success-link'?'¡Enlace copiado!':'Copiar enlace'}</button><button onClick={()=>share(shareableUrl(published.url))}><FaShareAlt/> Compartir</button><button onClick={downloadQr}><FaDownload/> Descargar QR</button></div><button className="trial-publish" onClick={()=>navigate(published.url)}>Ver presentación publicada</button>{mode==='owner'&&<button className="trial-success-invite" type="button" onClick={()=>void inviteFriend()}><FaShareAlt/> Invitar a un amigo</button>}<button className="trial-success-dismiss" type="button" onClick={continueEditing}>Seguir editando</button></section></div>}
    {prospectOpen&&prospectDraft&&<div className="trial-sheet-backdrop"><section className="trial-sheet trial-create-sheet"><header><div><strong>Ficha de prospecto</strong><small>Información comercial privada. No aparece en el perfil público.</small></div><button onClick={()=>setProspectOpen(false)}><FaTimes/></button></header><div className="trial-grid"><label>Nombre<input value={prospectDraft.contact_name} onChange={e=>setProspectDraft({...prospectDraft,contact_name:e.target.value})}/></label><label>WhatsApp<input value={prospectDraft.whatsapp} onChange={e=>setProspectDraft({...prospectDraft,whatsapp:e.target.value})}/></label><label>Teléfono<input value={prospectDraft.phone} onChange={e=>setProspectDraft({...prospectDraft,phone:e.target.value})}/></label><label>Correo<input value={prospectDraft.email} onChange={e=>setProspectDraft({...prospectDraft,email:e.target.value})}/></label><label>Instagram<input value={prospectDraft.instagram} onChange={e=>setProspectDraft({...prospectDraft,instagram:e.target.value})}/></label><label>Empresa<input value={prospectDraft.company_name} onChange={e=>setProspectDraft({...prospectDraft,company_name:e.target.value})}/></label><label>Tipo de empresa / actividad<input list="trial-company-types-prospect" value={prospectDraft.company_type} onChange={e=>setProspectDraft({...prospectDraft,company_type:e.target.value})}/><datalist id="trial-company-types-prospect">{companyTypes.map(x=><option key={x} value={x}/>)}</datalist></label><label>Origen<select value={prospectDraft.source} onChange={e=>setProspectDraft({...prospectDraft,source:e.target.value})}>{sourceOptions.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label></div><label>Detalle del origen<input value={prospectDraft.source_detail} onChange={e=>setProspectDraft({...prospectDraft,source_detail:e.target.value})}/></label><label>Notas<textarea rows={3} value={prospectDraft.notes} onChange={e=>setProspectDraft({...prospectDraft,notes:e.target.value})}/></label><button className="trial-publish" onClick={()=>void saveProspect()}>Guardar ficha</button></section></div>}
    {mode==='public'&&privacyChoice===null&&<div className="trial-privacy-banner" role="dialog" aria-label="Privacidad y medición"><div className="trial-privacy-summary"><strong>Privacidad y medición</strong><p>Usamos medición propia para conocer visitas y acciones del perfil. No compartimos estos datos con terceros.</p></div><div className="trial-privacy-actions"><button className="secondary" onClick={()=>setPrivacyManage(true)}>Gestionar</button><button onClick={()=>choosePrivacy('accepted')}>Aceptar</button></div></div>}
    {mode==='public'&&privacyChoice===null&&privacyManage&&<div className="trial-privacy-manage-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setPrivacyManage(false)}}><section className="trial-privacy-manage" role="dialog" aria-modal="true" aria-label="Gestionar privacidad"><header><div><strong>Privacidad y medición</strong><small>Elige cómo quieres continuar.</small></div><button type="button" onClick={()=>setPrivacyManage(false)} aria-label="Cerrar"><FaTimes/></button></header><p>Usamos medición propia para conocer cuántas personas visitan el perfil, qué acciones realizan y desde qué zona aproximada lo abren.</p><p>Si aceptas, guardamos un identificador local en este navegador para reconocer visitas repetidas con mayor precisión. No vendemos ni compartimos estos datos con terceros.</p><p>Si eliges continuar sin cookies, el perfil seguirá funcionando y seguiremos contando visitas y acciones de forma general, pero sin guardar un identificador persistente en tu navegador.</p><small>Si en el futuro se activan herramientas publicitarias de Meta, Google u otros terceros, se solicitará autorización específica antes de enviarles información.</small><div className="trial-privacy-manage-actions"><button className="secondary" onClick={()=>{choosePrivacy('essential');setPrivacyManage(false)}}>Rechazar cookies</button><button onClick={()=>{choosePrivacy('accepted');setPrivacyManage(false)}}>Aceptar</button></div></section></div>}
    {copiedMessage&&copiedTarget==='other'&&<div className="trial-copy-toast">{copiedMessage}</div>}
    {error&&<div className="trial-toast" onClick={()=>setError('')}>{error}</div>}
  </>
}
