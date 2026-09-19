import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { FaCamera, FaCheck, FaCopy, FaPalette, FaPlus, FaQrcode, FaShareAlt, FaTimes, FaUniversity } from 'react-icons/fa'
import IntapLinkGratisProfile from '../free-profile/IntapLinkGratisProfile'
import TrialImageCrop from './TrialImageCrop'
import { TrialBanks, TrialBanksEditor, TrialLocationButton, TrialLocationPanel, TrialPalettePanel, type TrialBank } from './TrialPanels'
import type { FreeProfileAppearanceColors, FreeProfileData, FreeProfileLayoutId } from '../free-profile/IntapLinkGratis.types'
import './KawvoTrial.css'

type Snapshot={layout:FreeProfileLayoutId;colors:FreeProfileAppearanceColors;profile:FreeProfileData;modules?:{banks?:{enabled:boolean;items:TrialBank[]}}}
type Trial={id:string;slug:string|null;name:string|null;status:'draft'|'active'|'expired';profile:Snapshot;activated_at:string|null;expires_at:string|null}
type Mode='master'|'editor'|'public'

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
function protectedPath(path:string){return path.startsWith('/api/v1/superadmin/')?adminOrigin()+path:path}

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
  const [section,setSection]=useState<'identity'|'contact'|'about'|'portfolio'|'services'|'location'|'appearance'|'banks'|null>(null)
  const [createConfig,setCreateConfig]=useState(false)
  const [createBanks,setCreateBanks]=useState(false)
  const [locationQuery,setLocationQuery]=useState('')
  const [locationPreview,setLocationPreview]=useState('')
  const [crop,setCrop]=useState<{kind:'avatar'|'hero'|'gallery';file:File}|null>(null)
  const [saving,setSaving]=useState<'idle'|'saving'|'saved'|'error'>('idle')
  const [finish,setFinish]=useState(false)
  const [trialName,setTrialName]=useState('')
  const [trialSlug,setTrialSlug]=useState('')
  const [slugState,setSlugState]=useState('')
  const [published,setPublished]=useState<any>(null)
  const [qr,setQr]=useState('')
  const saveTimer=useRef<number|undefined>()

  useEffect(()=>{api('/api/v1/superadmin/trials/context').then(()=>setAdmin(true)).catch(()=>setAdmin(false))},[])
  useEffect(()=>{
    if(mode==='master'){api('/api/v1/public/trials/master').then(r=>setSnapshot(r.data)).catch(()=>setSnapshot(FALLBACK));return}
    const path=mode==='editor'?'/api/v1/superadmin/trials/'+encodeURIComponent(id):'/api/v1/public/trials/'+encodeURIComponent(slug)
    api(path).then(r=>{setTrial(r.data);setSnapshot(r.data.profile);setTrialName(r.data.name||r.data.profile?.profile?.name||'');setTrialSlug(r.data.slug||suggestedSlug(r.data.profile?.profile?.name||''))}).catch(e=>setError(e.message)).finally(()=>setLoading(false))
  },[mode,id,slug])

  useEffect(()=>()=>{if(saveTimer.current)window.clearTimeout(saveTimer.current)},[])

  function rebuildContacts(profile:FreeProfileData){
    const phone=cleanPhone(profile.phone||'');const whatsapp=cleanPhone(profile.whatsapp||'');const instagram=cleanInstagram(profile.instagram||'');const email=String(profile.email||'').trim()
    const actions:any[]=[]
    if(phone)actions.push({type:'call',label:'Llamar',url:`tel:+${phone}`})
    if(instagram)actions.push({type:'instagram',label:'Instagram',url:`https://instagram.com/${instagram}`})
    if(email)actions.push({type:'email',label:'Correo',url:`mailto:${email}`})
    if(profile.location)actions.push({type:'location',label:'Ubicación',url:`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(profile.location)}`})
    return {...profile,phone,whatsapp,instagram,quickActions:actions.slice(0,3),whatsappGreetingName:profile.name.split(' ')[0]||'Hola'}
  }
  function change<K extends keyof FreeProfileData>(key:K,value:FreeProfileData[K]){
    setSnapshot(current=>{const next={...current,profile:rebuildContacts({...current.profile,[key]:value})};queueSave(next);return next})
  }
  function queueSave(next:Snapshot){
    if(mode!=='editor'||!id)return
    setSaving('saving');if(saveTimer.current)window.clearTimeout(saveTimer.current)
    saveTimer.current=window.setTimeout(()=>api('/api/v1/superadmin/trials/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify({profile:next})}).then(()=>setSaving('saved')).catch(()=>setSaving('error')),450)
  }
  async function createTrial(){
    try{const r=await api('/api/v1/superadmin/trials',{method:'POST',body:JSON.stringify({modules:{banks:createBanks}})});setCreateConfig(false);navigate('/trial/edit/'+r.data.id)}catch(e:any){setError(e.message)}
  }
  function openSection(next:typeof section){setSection(next);setPanel(true)}
  function choosePalette(colors:FreeProfileAppearanceColors){setSnapshot(current=>{const next={...current,colors};queueSave(next);return next})}
  function confirmLocation(){if(!locationPreview)return;change('location',locationQuery.trim()||locationPreview);setPanel(false)}
  function toggleBanks(enabled:boolean){setSnapshot(current=>{const next={...current,modules:{...current.modules,banks:{enabled,items:current.modules?.banks?.items||[]}}};queueSave(next);return next})}
  function updateBank(index:number,patch:Partial<TrialBank>){setSnapshot(current=>{const bank=current.modules?.banks||{enabled:true,items:[]};const next={...current,modules:{...current.modules,banks:{...bank,items:bank.items.map((item,i)=>i===index?{...item,...patch}:item)}}};queueSave(next);return next})}
  function addBank(){setSnapshot(current=>{const bank=current.modules?.banks||{enabled:true,items:[]};if(bank.items.length>=3)return current;const item:TrialBank={id:crypto.randomUUID(),bank_name:'Banco Popular Dominicano',account_number:'',account_type:'savings',currency:'DOP',holder_name:current.profile.name,display_mode:'masked'};const next={...current,modules:{...current.modules,banks:{enabled:true,items:[...bank.items,item]}}};queueSave(next);return next})}
  function chooseImage(kind:'avatar'|'hero'|'gallery',file?:File){if(file)setCrop({kind,file})}
  async function upload(kind:'avatar'|'hero'|'gallery',file?:File){
    if(!file||mode!=='editor')return
    const fd=new FormData();fd.append('file',file)
    try{setSaving('saving');const r=await api(`/api/v1/superadmin/trials/${encodeURIComponent(id)}/media?kind=${kind}`,{method:'POST',body:fd})
      if(kind==='avatar')change('portrait',r.url)
      else if(kind==='hero')change('hero',r.url)
      else {const item={id:crypto.randomUUID(),title:'Nuevo trabajo',description:'',image:r.url};change('portfolio',[...snapshot.profile.portfolio,item].slice(0,5))}
    }catch(e:any){setError(e.message);setSaving('error');throw e}
  }
  function removePortfolio(itemId:string){change('portfolio',snapshot.profile.portfolio.filter(x=>x.id!==itemId))}
  async function checkSlug(value:string){
    const next=suggestedSlug(value);setTrialSlug(next);if(next.length<2){setSlugState('Slug no válido');return}
    try{const r=await api('/api/v1/superadmin/trials/slug/'+encodeURIComponent(next));setSlugState(r.available?'Disponible':'No disponible')}catch(e:any){setSlugState(e.message)}
  }
  async function publish(){
    if(saveTimer.current){window.clearTimeout(saveTimer.current);saveTimer.current=undefined}
    try{
      setSaving('saving');await api('/api/v1/superadmin/trials/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify({profile:snapshot})})
      const r=await api('/api/v1/superadmin/trials/'+encodeURIComponent(id)+'/publish',{method:'POST',body:JSON.stringify({name:trialName,slug:trialSlug})})
      setPublished(r.data);setSaving('saved');setFinish(false)
      const QRCode=await import('qrcode');setQr(await QRCode.toDataURL(window.location.origin+r.data.url,{width:900,margin:3,errorCorrectionLevel:'H'}))
    }catch(e:any){setError(e.message);setSaving('error')}
  }
  async function copy(text:string){await navigator.clipboard.writeText(text)}
  async function share(url:string){if(navigator.share)await navigator.share({title:trialName||'Trial Kawvo Link',url});else await copy(url)}

  const editorTop=mode==='editor'?<div className="trial-adminbar"><strong>TRIAL · Editando</strong><button className="trial-tool" onClick={()=>openSection("appearance")}><FaPalette/> Colores</button><button className="trial-tool" onClick={()=>openSection("banks")}><FaPlus/> Módulos</button><span className={`trial-save ${saving}`}>{saving==='saving'?'Guardando…':saving==='error'?'Error al guardar':'Guardado'}</span><button className="trial-primary" onClick={()=>{setTrialName(snapshot.profile.name);setTrialSlug(trial?.slug||suggestedSlug(snapshot.profile.name));setFinish(true)}}><FaCheck/> Finalizar Trial</button></div>:undefined

  if(loading)return <div className="trial-state">Cargando Trial…</div>
  if(error && !trial && mode!=='master')return <div className="trial-state"><h1>No pudimos abrir este Trial</h1><p>{error}</p></div>
  if(mode==='public'&&trial?.status==='expired')return <div className="trial-expired"><div><span>KAWVO LINK</span><h1>Esta demostración ha finalizado.</h1><p>El período de prueba de 72 horas terminó. El enlace se mantiene para informarte que esta presentación era una demostración de Kawvo Link.</p><a href="https://wa.me/18095368224" target="_blank" rel="noreferrer">Contactar a Kawvo Link</a><a className="secondary" href="https://nfc.kawvoia.com" target="_blank" rel="noreferrer">Conocer Kawvo Link</a></div></div>

  return <>
    <IntapLinkGratisProfile profile={snapshot.profile} layout={snapshot.layout} colors={snapshot.colors} topContent={editorTop} beforeShareContent={snapshot.modules?.banks?.enabled?<TrialBanks banks={snapshot.modules.banks.items} editMode={mode==='editor'} onEdit={()=>openSection("banks")}/>:undefined} editMode={mode==='editor'} onEditSection={(s)=>{if(s==='hero'||s==='avatar'){document.getElementById('trial-'+s+'-input')?.click()}else{openSection(s)}}}/>
    {mode==='editor'&&<><input id="trial-hero-input" hidden type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e=>chooseImage('hero',e.target.files?.[0])}/><input id="trial-avatar-input" hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>chooseImage('avatar',e.target.files?.[0])}/></>}
    {mode==='master'&&admin&&<button className="trial-create" onClick={()=>setCreateConfig(true)}>+ Crear Trial</button>}
    {mode==='public'&&admin&&trial&&<div className="trial-public-admin"><strong>⚙️ Trial</strong><span>Vence: {isoDisplay(trial.expires_at)}</span><button onClick={()=>navigate('/trial/edit/'+trial.id)}>Editar en vivo</button><button onClick={()=>copy(window.location.href)}>Copiar enlace</button></div>}

    {panel&&section&&<div className="trial-sheet-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setPanel(false)}}><section className="trial-sheet trial-context-sheet">
      <header><div><strong>{section==='identity'?'Nombre y especialidad':section==='contact'?'Datos de contacto':section==='about'?'Quién soy / Qué hago':'Portafolio'}</strong><small>Ves el cambio inmediatamente en el perfil.</small></div><button onClick={()=>setPanel(false)} aria-label="Cerrar"><FaTimes/></button></header>
      {section==='identity'&&<><label>Nombre<input autoFocus value={snapshot.profile.name} onChange={e=>change('name',e.target.value)}/></label><label>Cargo / especialidad<input value={snapshot.profile.role} onChange={e=>change('role',e.target.value)}/></label></>}
      {section==='about'&&<label>Quién soy / Qué hago<textarea autoFocus rows={4} value={snapshot.profile.bio} onChange={e=>change('bio',e.target.value)}/></label>}
      {section==='contact'&&<><div className="trial-grid"><label>Teléfono<input inputMode="tel" value={snapshot.profile.phone} onChange={e=>change('phone',e.target.value)}/></label><label>WhatsApp<input inputMode="tel" value={snapshot.profile.whatsapp} onChange={e=>change('whatsapp',e.target.value)}/></label></div><label>Correo<input type="email" value={snapshot.profile.email} onChange={e=>change('email',e.target.value)}/></label><label>Instagram<input value={snapshot.profile.instagram} onChange={e=>change('instagram',e.target.value)}/></label><TrialLocationButton onClick={()=>{setLocationQuery(snapshot.profile.location);setLocationPreview("");openSection("location")}}/></>}
      {section==='services'&&<>{snapshot.profile.services.map((item,index)=><div className="trial-service-edit" key={item.id}><img src={item.image||snapshot.profile.portrait} alt=""/><div><input value={item.title} onChange={e=>change('services',snapshot.profile.services.map((z,i)=>i===index?{...z,title:e.target.value}:z))}/><textarea rows={2} value={item.description} onChange={e=>change('services',snapshot.profile.services.map((z,i)=>i===index?{...z,description:e.target.value}:z))}/></div></div>)}</>}
      {section==='location'&&<TrialLocationPanel query={locationQuery} setQuery={setLocationQuery} preview={locationPreview} setPreview={setLocationPreview} onConfirm={confirmLocation}/>}
      {section==='appearance'&&<TrialPalettePanel onChoose={choosePalette}/>}
      {section==='banks'&&<TrialBanksEditor data={snapshot.modules?.banks||{enabled:false,items:[]}} toggle={toggleBanks} add={addBank} update={updateBank}/>}
      {section==='portfolio'&&<><div className="trial-gallery-head"><strong>Imágenes</strong><span className="trial-upload"><FaCamera/> Agregar<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e=>chooseImage('gallery',e.target.files?.[0])}/></span></div>{snapshot.profile.portfolio.map((item,index)=><div className="trial-work" key={item.id}><img src={item.image} alt=""/><div><input value={item.title} onChange={e=>change('portfolio',snapshot.profile.portfolio.map((z,i)=>i===index?{...z,title:e.target.value}:z))}/><textarea rows={2} value={item.description} onChange={e=>change('portfolio',snapshot.profile.portfolio.map((z,i)=>i===index?{...z,description:e.target.value}:z))}/></div><button onClick={()=>removePortfolio(item.id)}>Eliminar</button></div>)}</>}
    </section></div>}
    {createConfig&&<div className="trial-sheet-backdrop"><section className="trial-sheet trial-create-sheet"><header><div><strong>Crear Trial</strong><small>Selecciona módulos opcionales. Podrás cambiarlos después.</small></div><button onClick={()=>setCreateConfig(false)}><FaTimes/></button></header><label className="trial-module-option"><span><FaUniversity/><b>Cuentas bancarias</b><small>Mismo bloque de transferencias disponible en Free.</small></span><input type="checkbox" checked={createBanks} onChange={e=>setCreateBanks(e.target.checked)}/></label><button className="trial-publish" onClick={createTrial}>Crear y editar en vivo</button></section></div>}
    {crop&&<TrialImageCrop file={crop.file} aspectRatio={crop.kind==='hero'?16/7:crop.kind==='avatar'?1:4/3} outputWidth={crop.kind==='hero'?1280:crop.kind==='avatar'?640:960} onCancel={()=>setCrop(null)} onSave={async file=>{await upload(crop.kind,file);setCrop(null)}}/>}
    {finish&&<div className="trial-sheet-backdrop"><section className="trial-sheet trial-finish"><header><strong>Finalizar Trial</strong><button onClick={()=>setFinish(false)}><FaTimes/></button></header><p>Las 72 horas comienzan únicamente al publicar.</p><label>Nombre del Trial<input value={trialName} onChange={e=>{setTrialName(e.target.value);checkSlug(e.target.value)}}/></label><label>Enlace<div className="trial-slug-row"><span>intaprd.com/trial/</span><input value={trialSlug} onChange={e=>checkSlug(e.target.value)}/></div><small>{slugState}</small></label><button className="trial-publish" onClick={publish}>Publicar Trial · 72 horas</button></section></div>}

    {published&&<div className="trial-sheet-backdrop"><section className="trial-sheet trial-success"><FaCheck className="trial-success-icon"/><h2>Trial creado</h2><p>Activo durante 72 horas desde este momento.</p>{qr&&<img src={qr} alt="Código QR del Trial"/>}<strong>{window.location.origin}{published.url}</strong><div className="trial-success-actions"><button onClick={()=>copy(window.location.origin+published.url)}><FaCopy/> Copiar enlace</button><button onClick={()=>share(window.location.origin+published.url)}><FaShareAlt/> Compartir</button><button onClick={()=>window.open(published.url,'_blank')}><FaQrcode/> Abrir perfil</button></div><button className="trial-publish" onClick={()=>navigate(published.url)}>Ver Trial publicado</button></section></div>}
    {error&&<div className="trial-toast" onClick={()=>setError('')}>{error}</div>}
  </>
}
