import { useEffect, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { apiGet } from '../../../lib/api'
import KawvoPagedList, { type KawvoListItem } from '../shared/KawvoPagedList'
import { isFreeDemoDelegationActive } from '../../../lib/freeDemoDelegation'
import FreeShellSessionExit from './FreeShellSessionExit'
import FreePublicationActions from './FreePublicationActions'
import FreeNotificationBell from './FreeNotificationBell'
import FreeAgendaSummary from './FreeAgendaSummary'
import KawvoProfileIdentity from '../shared/KawvoProfileIdentity'
import KawvoReadyToPublish from '../shared/KawvoReadyToPublish'
import { KAWVO_FREE_LEGACY_ROUTE, isKawvoShellPreviewHost, getKawvoShellReturn, type KawvoShellListState, type KawvoShellReturn, type KawvoShellTab } from './KawvoShellReturn'

type Tab=KawvoShellTab
type Profile={profile_id?:string|number|null;name?:string|null;slug?:string|null;is_published?:number;avatar_url?:string|null;hero_url?:string|null;templateData?:Record<string,unknown>;freeReadiness?:{ready?:boolean;missing?:string[];steps?:{identifier?:boolean}}}
type Home={kind?:string;route?:string;public_route?:string|null;agenda_route?:string|null;multiple_profiles?:boolean}
type Team={role?:'none'|'master'|'member';member?:{permissions?:string[]}}
const allModules:(KawvoListItem&{path:string;permission?:string;ownerOnly?:boolean;excludeDemo?:boolean;requiresIdentity?:boolean})[]=[
  {id:'identity',title:'Identidad y presentación',detail:'Nombre, cargo, foto y portada',group:'Perfil',path:'/admin/free/onboarding/identity?from=panel'},
  {id:'contact',title:'Contacto',detail:'WhatsApp, teléfono y correo',group:'Perfil',path:'/admin/free/onboarding/contact',permission:'contact',requiresIdentity:true},
  {id:'quick',title:'Botones de contacto',detail:'Tus acciones principales',group:'Perfil',path:'/admin/free/quick-actions',permission:'quick_actions',requiresIdentity:true},
  {id:'location',title:'Ubicación',detail:'Dirección y mapa',group:'Perfil',path:'/admin/free/location',permission:'location',requiresIdentity:true},
  {id:'links',title:'Enlaces',detail:'Tus enlaces importantes',group:'Contenido',path:'/admin/free/links',permission:'links',requiresIdentity:true},
  {id:'portfolio',title:'Portafolio',detail:'Trabajos y fotografías',group:'Contenido',path:'/admin/free/portfolio',permission:'portfolio',requiresIdentity:true},
  {id:'services',title:'Servicios',detail:'Servicios, descripciones e imágenes',group:'Contenido',path:'/admin/free/services',permission:'services',excludeDemo:true,requiresIdentity:true},
  {id:'bank',title:'Cuentas bancarias',detail:'Gestiona tus cuentas o consulta la disponibilidad según tu plan',group:'Perfil',path:'/admin/free/bank-accounts',ownerOnly:true,requiresIdentity:true},
  {id:'design',title:'Diseño',detail:'Plantilla, portada y colores',group:'Apariencia',path:'/admin/free/editor',permission:'design',requiresIdentity:true},
  {id:'account',title:'Mi cuenta',detail:'Configuración de cuenta y acceso',group:'Cuenta',path:'/admin/free/account'},
  {id:'credentials',title:'Credenciales',detail:'Administrar mi acceso',group:'Cuenta',path:'/admin/free/credentials',ownerOnly:true,excludeDemo:true},
  {id:'notifications',title:'Notificaciones',detail:'Avisos relacionados con tu perfil',group:'Cuenta',path:'/admin/free/notifications'},
  {id:'ai',title:'Optimizar con IA',detail:'Asistencia cuando esté habilitada',group:'Herramientas',path:'/admin/free/ai-profile',ownerOnly:true,permission:'ai',excludeDemo:true,requiresIdentity:true}
]

/** Free shell on the exact supported App host/build pairs. Navigation grants no permissions. */
export default function KawvoFreeShellPreview(){
  const navigate=useNavigate()
  const location=useLocation()
  const incomingReturn=getKawvoShellReturn(location.state)
  const [tab,setTab]=useState<Tab>('home')
  const [profile,setProfile]=useState<Profile|null>(null)
  const [home,setHome]=useState<Home|null>(null)
  const [team,setTeam]=useState<Team|null>(null)
  const [busy,setBusy]=useState(true)
  const [error,setError]=useState('')
  const [shareMessage,setShareMessage]=useState('')
  const [superAdminProfileId,setSuperAdminProfileId]=useState('')
  const publicationControlsRef=useRef<HTMLDivElement>(null)
  // The guarded canonical Free entry supplies the marker; other hosts stay legacy.
  const enabled=isKawvoShellPreviewHost()&&new URLSearchParams(window.location.search).get('kawvo_shell')==='1'
  useEffect(()=>{
    if(!enabled)return
    let active=true
    Promise.all([apiGet('/me'),apiGet('/me/home-route').catch(()=>({ok:false})),apiGet('/me/team/context').catch(()=>({ok:false}))])
      .then(async ([p,h,t]:any[])=>{
        if(!active)return
        if(!p?.ok){setError('No pudimos comprobar este perfil. Vuelve al panel actual.');return}
        let resolvedHome:Home|null=h?.ok?h.data||null:null
        // The operator's generic home is always the directory, even after
        // selection. Use its verified active-account context, not another
        // profile or a navigation hint, for the selected Free account's Agenda.
        if(h?.ok&&h.data?.kind==='multiaccount'){
          const selected:any=await apiGet('/me/intapcard/active-account').catch(()=>({ok:false}))
          if(!active)return
          const current=selected?.data?.active
          if(!selected?.ok||selected.data?.tab_session_valid!==true||current?.kind!=='free'||current?.route!=='/admin/free'||!p.data?.profile_id||String(current.id)!==String(p.data.profile_id)){
            setError('No pudimos verificar la cuenta Free seleccionada. Vuelve a Multicuenta.')
            return
          }
          resolvedHome={route:'/admin/free',agenda_route:'/admin/free/agenda',kind:'multiaccount'}
        }
        setProfile(p.data||null)
        setHome(resolvedHome)
        setTeam(t?.ok?t.data||{role:'none'}:null)
      }).catch(()=>{if(active)setError('No pudimos cargar los datos. El panel actual sigue disponible.')})
      .finally(()=>{if(active)setBusy(false)})
    return()=>{active=false}
  },[enabled])
  // Reuse the original SuperAdmin authorization check. Failure hides the
  // shortcut without delaying the ordinary Free panel. A demo is never probed.
  const verifiedProfileId=String(profile?.profile_id||'')
  useEffect(()=>{
    setSuperAdminProfileId('')
    if(!enabled||!verifiedProfileId||isFreeDemoDelegationActive())return
    let active=true
    apiGet<{ok?:boolean}>('/superadmin/metrics/overview')
      .then(result=>{if(active&&result?.ok===true)setSuperAdminProfileId(verifiedProfileId)})
      .catch(()=>undefined)
    return()=>{active=false}
  },[enabled,verifiedProfileId])
  // Apply a return hint once per navigation and verified account, not whenever
  // profile data changes (publish/hide, readiness, etc.). Wait until the initial
  // account/Agenda resolution has completed. A new module return still restores
  // its own tab and validated account.
  const navigationAccount=String(profile?.profile_id||profile?.slug||'')
  const navigationSlug=String(profile?.slug||'')
  const restoredNavigation=useRef<{key:string;account:string}|null>(null)
  useEffect(()=>{
    if(!enabled||busy||!navigationAccount)return
    const previous=restoredNavigation.current
    if(previous?.key===location.key&&previous.account===navigationAccount)return
    restoredNavigation.current={key:location.key,account:navigationAccount}
    const hint=getKawvoShellReturn(location.state)
    if(hint){
      if(hint.kawvoShellAccount!==navigationAccount)return
      const agendaAvailable=typeof home?.agenda_route==='string'&&home.agenda_route.startsWith('/admin/free/agenda')
      setTab(hint.kawvoShellTab==='agenda'&&!agendaAvailable?'home':hint.kawvoShellTab)
      return
    }
    // Public Web Preview hint stays account-bound and does not select an account.
    const resume=new URLSearchParams(location.search)
    if(resume.get('resume')==='profile'&&resume.get('slug')===navigationSlug)setTab('profile')
  },[enabled,busy,navigationAccount,navigationSlug,home?.agenda_route,location.key,location.search,location.state])
  if(!enabled)return <Navigate to="/admin/free" replace/>
  if(busy)return <main role="status" className="min-h-screen bg-slate-50 p-8 text-center text-sm">Cargando espacio Kawvo…</main>
  if(error||!profile||!team)return <main className="min-h-screen bg-slate-50 p-5"><div role="alert" className="mx-auto max-w-md rounded-2xl bg-white p-5"><h1 className="text-xl font-bold">No se pudo abrir esta vista</h1><p className="mt-3 text-sm">{error||'No se verificaron los permisos de la cuenta.'}</p><button onClick={()=>navigate(KAWVO_FREE_LEGACY_ROUTE)} className="mt-4 min-h-11 rounded-xl bg-slate-900 px-4 text-sm text-white">Volver al panel actual</button></div></main>
  const teamMember=team.role==='member'
  const delegatedDemo=isFreeDemoDelegationActive()
  const hasSuperAdminAccess=!delegatedDemo&&Boolean(verifiedProfileId)&&superAdminProfileId===verifiedProfileId
  const accountName=String(profile.name||'').trim()||'Mi presentación Free'
  const accountSlug=String(profile.slug||'').trim()
  const allowAccountSwitch=!teamMember&&!delegatedDemo&&home?.kind==='multiaccount'
  const permissions=new Set(team.member?.permissions||[])
  // Preserve the original owner identity prerequisite; Team permissions remain independent and plan entitlement stays in the modules.
  const identityConfirmed=profile.templateData?.free_identity_confirmed===true
  const name=String(profile.name||'').trim()
  const isRealAsset=(value:unknown)=>Boolean(value)&&!String(value).includes('/assets/free-starter/')
  const baseReady=delegatedDemo||Boolean(identityConfirmed&&name&&name.toLowerCase()!=='tu nombre o negocio'&&String(profile.templateData?.role||'').trim()&&profile.freeReadiness?.steps?.identifier&&isRealAsset(profile.avatar_url)&&isRealAsset(profile.hero_url))
  // This shell is a navigation aid, never the source of authorization. Exact existing route guards still apply.
  const modules=allModules.filter(item=>!item.ownerOnly||!teamMember).filter(item=>!item.excludeDemo||!delegatedDemo).filter(item=>{
    if(!teamMember)return true
    if(item.id==='identity')return ['name','role','photo'].some(key=>permissions.has(key))
    // Services previously lived inside the guarded visual editor; preserve both permissions for Team.
    if(item.id==='services'&&!permissions.has('design'))return false
    if(!item.permission)return true
    return item.permission==='contact' ? ['phone','email','whatsapp'].some(key=>permissions.has(key)) : permissions.has(item.permission)
  }).map(item=>item.requiresIdentity&&!baseReady&&!teamMember?{...item,disabled:true,detail:'Completa primero los datos esenciales de tu presentación.'}:item)
  const routeById=new Map(modules.filter(item=>!item.disabled).map(item=>[item.id,item.path]))
  const agendaRoute=typeof home?.agenda_route==='string'&&home.agenda_route.startsWith('/admin/free/agenda')?home.agenda_route:''
  const completion=profile.freeReadiness
  const missing=Array.isArray(completion?.missing)?completion.missing.filter(item=>typeof item==='string'&&item.trim().length>0):[]
  const published=Number(profile.is_published)===1
  // Only the server readiness result can say "ready"; never derive a percentage from incomplete fields.
  const teamPublicationReady=identityConfirmed&&Boolean(name&&name.toLowerCase()!=='tu nombre o negocio'&&String(profile.templateData?.role||'').trim())
  const publicationBaseReady=delegatedDemo||(teamMember?teamPublicationReady:baseReady)
  const readyToPublish=!published&&completion?.ready===true&&publicationBaseReady
  const publicationLabel=published?'Publicado':readyToPublish?'Listo para publicar':'Borrador'
  const publicationStyle=published?'bg-emerald-50 text-emerald-800':readyToPublish?'bg-cyan-50 text-cyan-900':'bg-amber-50 text-amber-900'
  const nextActionLabel=published?'Administrar mi presentación':readyToPublish?'Revisar y publicar':'Continuar configuración'
  const webUrl=String(import.meta.env.VITE_WEB_URL||(import.meta.env.MODE==='production'?'https://intaprd.com':'https://preview.intaprd.com')).replace(/\/$/,'')
  const publicRoute=typeof home?.public_route==='string'&&home.public_route.startsWith('/')&&!home.public_route.startsWith('//')?home.public_route:''
  // Match the existing FreeDashboard public-link fallback when home-route is temporarily unavailable.
  const publicUrl=publicRoute?webUrl+publicRoute:accountSlug?`${webUrl}/${encodeURIComponent(accountSlug)}`:''
  const button='min-h-12 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-bold text-slate-800'
  const accountIdentity=String(profile.profile_id||profile.slug||'')
  const verifiedReturn=incomingReturn?.kawvoShellAccount===accountIdentity?incomingReturn:null
  const shellReturnState:KawvoShellReturn={kawvoShellReturn:true,kawvoShellTab:tab,kawvoShellAccount:accountIdentity}
  const go=(id:string,listState?:KawvoShellListState)=>{
    const path=routeById.get(id)
    if(path)navigate(path,{state:{...shellReturnState,kawvoShellList:listState,kawvoShellItem:id}})
  }
  const openAgenda=()=>{if(agendaRoute)navigate(agendaRoute,{state:shellReturnState})}
  const nextAction=()=>{
    if(published){setTab('profile');return}
    // Delegated demo management retains its original workflow.
    if(readyToPublish&&delegatedDemo){navigate(KAWVO_FREE_LEGACY_ROUTE);return}
    if(routeById.has('identity'))navigate('/admin/free/onboarding/identity?from=panel',{state:shellReturnState})
    else setTab('profile')
  }
  const previewHref=accountSlug?(isFreeDemoDelegationActive()&&publicUrl?publicUrl:`/api/v1/me/free/profile-preview/${encodeURIComponent(accountSlug)}?full=1#kawvo_shell=1&tab=profile&slug=${encodeURIComponent(accountSlug)}`):''
  const sharePublicUrl=async()=>{
    if(!published||!publicUrl)return
    setShareMessage('')
    try{
      if(navigator.share){await navigator.share({title:accountName,url:publicUrl});setShareMessage('Perfil listo para compartir.');return}
      await navigator.clipboard.writeText(publicUrl)
      setShareMessage('Enlace copiado para compartir.')
    }catch(error:unknown){
      if((error as {name?:string}|null)?.name!=='AbortError')setShareMessage('No pudimos abrir el menú para compartir.')
    }
  }
  const menu:[Tab,string,string][]=[['home','⌂','Inicio'],['profile','◉','Perfil'],['agenda','▦','Agenda'],['more','☷','Más']].filter(([key])=>key!=='agenda'||Boolean(agendaRoute)) as [Tab,string,string][]
  return <main className="min-h-[100dvh] bg-[#f1f5f7] pb-[calc(94px+env(safe-area-inset-bottom))] font-['Inter',sans-serif] text-slate-950 md:pl-[244px] md:pb-0 [&_button]:min-h-11 [&_button]:min-w-11">
    {/* Desktop navigation follows the approved demo; mobile retains the bottom navigation. */}
    <aside aria-label="Menú lateral Kawvo" className="fixed inset-y-0 left-0 hidden w-[244px] flex-col bg-[#f1f5f7] px-4 py-4 md:flex">
      <div className="flex h-full flex-col overflow-y-auto rounded-[24px] border border-slate-200 bg-white p-4">
        <div className="mb-8 flex items-center gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#123241] text-lg font-black text-white">K</div><div className="min-w-0"><strong className="block text-base">Kawvo</strong><span className="text-xs text-slate-500">Una experiencia</span></div></div>
        <nav aria-label="Secciones de Kawvo" className="flex flex-col gap-2">
          {menu.map(([key,icon,label])=><button type="button" key={key} aria-current={tab===key?'page':undefined} onClick={()=>setTab(key)} className={'flex min-h-12 w-full items-center gap-3 rounded-xl px-4 text-left text-sm font-bold '+(tab===key?'bg-[#e8f4f6] text-[#08758b]':'text-slate-600 hover:bg-slate-50')}><span aria-hidden="true" className="w-5 text-lg">{icon}</span>{label}</button>)}
        </nav>
        <div className="mt-auto pt-6">{tab!=='home'&&<FreeShellSessionExit/>}</div>
        <p className="pt-3 text-xs leading-5 text-slate-500">Tu presentación digital.</p>
      </div>
    </aside>
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3">
      <div className="mx-auto flex max-w-3xl items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-xl font-black text-white">K</div><div className="min-w-0 flex-1"><strong className="block text-base">Kawvo Link</strong><span className="text-xs text-slate-500">Mi espacio · Free</span></div>{hasSuperAdminAccess&&<button type="button" onClick={()=>navigate('/superadmin')} className="min-h-11 shrink-0 whitespace-nowrap rounded-xl bg-slate-950 px-3 text-xs font-bold text-white">Super Admin</button>}<FreeNotificationBell returnState={shellReturnState}/></div>
    </header>
    <section className="mx-auto w-full max-w-3xl space-y-4 px-4 pt-5">
      <div aria-label="Presentación que estás administrando" className="rounded-2xl border border-slate-200 bg-white px-4 py-3"><div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Cuenta activa · Kawlink Free</p><p className="mt-1 truncate text-sm font-black text-slate-900">{accountName}</p>{accountSlug&&<p className="mt-1 truncate text-xs text-slate-500">{accountSlug}</p>}</div>{allowAccountSwitch&&<button type="button" onClick={()=>navigate('/admin/accounts')} className="min-h-11 rounded-xl border border-cyan-200 bg-cyan-50 px-3 text-sm font-bold text-cyan-900">Cambiar cuenta</button>}</div></div>
      {!delegatedDemo&&<KawvoReadyToPublish identity={accountIdentity?'free:'+(team.role||'none')+':'+accountIdentity:''} ready={readyToPublish} title="Tu presentación está lista para publicar" onReview={()=>{setTab('home');window.requestAnimationFrame(()=>publicationControlsRef.current?.querySelector('button')?.focus())}}/>}
      {tab==='home'&&<>
        <div><h1 className="text-2xl font-black">Mi espacio Kawvo</h1><p className="mt-1 text-sm text-slate-600">Todo organizado para trabajar desde tu celular.</p></div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <KawvoProfileIdentity name={accountName} detail="Mi presentación digital · Free" avatar={profile.avatar_url?<img src={profile.avatar_url} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover"/>:<div aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-slate-100 text-2xl">◉</div>} utilities={<><button type="button" onClick={()=>go('account')} className="min-h-11 min-w-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-700">Instalar app Kawvo</button><FreeShellSessionExit/></>}/>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4"><h3 className="text-sm font-bold">Estado de mi presentación</h3><span className={'rounded-full px-3 py-1 text-xs font-bold '+publicationStyle}>{publicationLabel}</span></div>
          {published?<p className="mt-3 text-sm text-slate-600">Tu presentación está publicada. Puedes seguir editándola desde los módulos habituales.</p>
          :readyToPublish?<p className="mt-3 rounded-xl bg-cyan-50 px-3 py-3 text-sm text-cyan-950">Tu perfil cumple los requisitos indicados por el sistema. Revisa tu presentación y confirma la publicación cuando esté lista.</p>
          :missing.length>0?<div className="mt-3 rounded-xl bg-amber-50 px-3 py-3"><p className="text-sm font-bold text-amber-950">Siguiente paso: completar tu presentación</p><ul className="mt-2 list-inside list-disc space-y-1 text-sm text-amber-950">{missing.slice(0,3).map((item,i)=><li key={i}>{item}</li>)}</ul>{missing.length>3&&<p className="mt-2 text-xs text-amber-900">Y {missing.length-3} requisito(s) más en tu panel.</p>}</div>
          :<p className="mt-3 rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-700">Revisa los requisitos en tu panel antes de publicar. El avance no se calcula con datos incompletos.</p>}
          {(!readyToPublish||delegatedDemo)&&<button type="button" onClick={nextAction} className="mt-4 min-h-12 w-full rounded-xl bg-slate-900 px-4 text-sm font-bold text-white">{nextActionLabel}</button>}
          <div ref={publicationControlsRef} aria-label="Publicación de mi presentación">{!delegatedDemo&&<FreePublicationActions
            key={accountIdentity}
            published={published}
            canPublish={readyToPublish}
            onSaved={next=>setProfile(current=>current&&String(current.profile_id||current.slug||'')===accountIdentity?{...current,is_published:next?1:0}:current)}
            onIncomplete={readiness=>setProfile(current=>current&&String(current.profile_id||current.slug||'')===accountIdentity?{...current,freeReadiness:readiness}:current)}
          />}</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={()=>setTab('profile')} className={button}><span className="mb-2 block text-xl">✎</span>Editar perfil<span className="mt-1 block text-xs font-normal text-slate-500">Información y contenido</span></button>
          {previewHref?<a href={previewHref} target="_blank" rel="noopener noreferrer" className={button}><span className="mb-2 block text-xl">◉</span>Vista previa<span className="mt-1 block text-xs font-normal text-slate-500">Abrir la vista previa de tu presentación</span></a>:<button type="button" disabled className={button+" opacity-50"}><span className="mb-2 block text-xl">◉</span>Vista previa<span className="mt-1 block text-xs font-normal text-slate-500">Completa tu usuario primero</span></button>}
          {agendaRoute&&<button type="button" onClick={()=>setTab('agenda')} className={button}><span className="mb-2 block text-xl">▦</span>Agenda<span className="mt-1 block text-xs font-normal text-slate-500">Solicitudes y disponibilidad</span></button>}
          {routeById.has('account')&&<button type="button" onClick={()=>go('account')} className={button}><span className="mb-2 block text-xl">⚙</span>Mi cuenta<span className="mt-1 block text-xs font-normal text-slate-500">Configuración</span></button>}
          <button type="button" disabled={!published||!publicUrl} onClick={()=>void sharePublicUrl()} className={button+" disabled:opacity-50"}><span className="mb-2 block text-xl">↗</span>Compartir<span className="mt-1 block text-xs font-normal text-slate-500">{published&&publicUrl?'Compartir enlace público':'Disponible al publicar tu perfil'}</span></button>
        </div>
        {shareMessage&&<p role="status" aria-live="polite" className="rounded-xl bg-cyan-50 px-3 py-2 text-xs text-cyan-950">{shareMessage}</p>}
      </>}
      {tab==='profile'&&<><h1 className="text-2xl font-black">Mi perfil</h1><p className="text-sm text-slate-600">Encuentra un módulo sin recorrer toda la pantalla.</p><KawvoPagedList items={modules.filter(item=>!['Cuenta','Herramientas'].includes(item.group||''))} onOpen={go} paginated={false} initialState={verifiedReturn?.kawvoShellTab==='profile'?verifiedReturn.kawvoShellList:undefined} focusItemId={verifiedReturn?.kawvoShellTab==='profile'?verifiedReturn.kawvoShellItem:undefined} title="Secciones del perfil"/></>}
      {tab==='agenda'&&<><h1 className="text-2xl font-black">Agenda</h1>{agendaRoute?<><button type="button" onClick={openAgenda} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border border-cyan-200 bg-white px-4 py-3 text-left text-sm font-bold text-cyan-900"><span>Configurar agenda<span className="mt-1 block text-xs font-normal text-slate-600">Horarios, disponibilidad y motivos</span></span><span aria-hidden="true">›</span></button><FreeAgendaSummary key={verifiedProfileId||accountIdentity} profileId={verifiedProfileId} onViewAll={()=>navigate('/admin/free/agenda?section=requests',{state:shellReturnState})}/></>:<p className="rounded-2xl border bg-white p-4 text-sm text-slate-600">La Agenda no está habilitada para esta cuenta.</p>}</>}
      {tab==='more'&&<><h1 className="text-2xl font-black">Más opciones</h1><KawvoPagedList items={modules.filter(item=>['Cuenta','Herramientas'].includes(item.group||''))} onOpen={go} pageSize={5} initialState={verifiedReturn?.kawvoShellTab==='more'?verifiedReturn.kawvoShellList:undefined} focusItemId={verifiedReturn?.kawvoShellTab==='more'?verifiedReturn.kawvoShellItem:undefined} title="Cuenta y herramientas"/><div className="md:hidden"><FreeShellSessionExit/></div></>}
      {tab==='more'&&<button type="button" onClick={()=>navigate(KAWVO_FREE_LEGACY_ROUTE)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600">Abrir panel anterior</button>}
    </section>
    <nav aria-label="Navegación Kawvo" className={"fixed inset-x-0 bottom-0 z-20 grid gap-1 border-t border-slate-200 bg-white px-2 pb-[calc(7px+env(safe-area-inset-bottom))] pt-2 md:hidden "+(agendaRoute?"grid-cols-4":"grid-cols-3")}>
      {menu.map(([key,icon,label])=><button type="button" key={key} aria-current={tab===key?'page':undefined} onClick={()=>setTab(key)} className={'flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold '+(tab===key?'bg-cyan-50 text-cyan-900':'text-slate-600')}><span aria-hidden="true" className="text-lg">{icon}</span>{label}</button>)}
    </nav>
  </main>
}
