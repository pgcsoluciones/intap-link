import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { apiGet } from '../../../lib/api'
import KawvoPagedList, { type KawvoListItem } from '../shared/KawvoPagedList'

type Tab='home'|'profile'|'agenda'|'more'
type Profile={name?:string|null;slug?:string|null;is_published?:number;avatar_url?:string|null;freeReadiness?:{ready?:boolean;missing?:string[]}}
type Home={route?:string;public_route?:string|null;agenda_route?:string|null}
type Team={role?:'none'|'master'|'member';member?:{permissions?:string[]}}
const allModules:(KawvoListItem&{path:string;permission?:string;ownerOnly?:boolean})[]=[
  {id:'identity',title:'Identidad y presentación',detail:'Nombre, cargo, foto y portada',group:'Perfil',path:'/admin/free/onboarding/identity?from=panel'},
  {id:'contact',title:'Contacto',detail:'WhatsApp, teléfono y correo',group:'Perfil',path:'/admin/free/onboarding/contact',permission:'contact'},
  {id:'quick',title:'Botones de contacto',detail:'Tus acciones principales',group:'Perfil',path:'/admin/free/quick-actions',permission:'quick_actions'},
  {id:'location',title:'Ubicación',detail:'Dirección y mapa',group:'Perfil',path:'/admin/free/location',permission:'location'},
  {id:'links',title:'Enlaces',detail:'Tus enlaces importantes',group:'Contenido',path:'/admin/free/links',permission:'links'},
  {id:'portfolio',title:'Portafolio',detail:'Trabajos y fotografías',group:'Contenido',path:'/admin/free/portfolio',permission:'portfolio'},
  {id:'design',title:'Diseño',detail:'Plantilla, portada y colores',group:'Apariencia',path:'/admin/free/editor',permission:'design'},
  {id:'account',title:'Mi cuenta',detail:'Configuración de cuenta y acceso',group:'Cuenta',path:'/admin/free/account'},
  {id:'credentials',title:'Credenciales',detail:'Administrar mi acceso',group:'Cuenta',path:'/admin/free/credentials',ownerOnly:true},
  {id:'notifications',title:'Notificaciones',detail:'Avisos relacionados con tu perfil',group:'Cuenta',path:'/admin/free/notifications'},
  {id:'ai',title:'Optimizar con IA',detail:'Asistencia cuando esté habilitada',group:'Herramientas',path:'/admin/free/ai-profile',ownerOnly:true,permission:'ai'}
]

/** Opt-in Preview-only route. Existing FreeDashboard, its readiness and publication actions stay authoritative. */
export default function KawvoFreeShellPreview(){
  const navigate=useNavigate()
  const [tab,setTab]=useState<Tab>('home')
  const [profile,setProfile]=useState<Profile|null>(null)
  const [home,setHome]=useState<Home|null>(null)
  const [team,setTeam]=useState<Team|null>(null)
  const [busy,setBusy]=useState(true)
  const [error,setError]=useState('')
  // Explicit opt-in; never available on production hostname or production build.
  const enabled=import.meta.env.MODE==='preview'&&window.location.hostname==='app.preview.intaprd.com'&&new URLSearchParams(window.location.search).get('kawvo_shell')==='1'
  useEffect(()=>{
    if(!enabled)return
    let active=true
    Promise.all([apiGet('/me'),apiGet('/me/home-route').catch(()=>({ok:false})),apiGet('/me/team/context').catch(()=>({ok:false}))])
      .then(([p,h,t]:any[])=>{
        if(!active)return
        if(!p?.ok){setError('No pudimos comprobar este perfil. Vuelve al panel actual.');return}
        setProfile(p.data||null)
        setHome(h?.ok?h.data||null:null)
        setTeam(t?.ok?t.data||{role:'none'}:null)
      }).catch(()=>{if(active)setError('No pudimos cargar los datos. El panel actual sigue disponible.')})
      .finally(()=>{if(active)setBusy(false)})
    return()=>{active=false}
  },[enabled])
  if(!enabled)return <Navigate to="/admin/free" replace/>
  if(busy)return <main role="status" className="min-h-screen bg-slate-50 p-8 text-center text-sm">Cargando espacio Kawvo…</main>
  if(error||!profile||!team)return <main className="min-h-screen bg-slate-50 p-5"><div role="alert" className="mx-auto max-w-md rounded-2xl bg-white p-5"><h1 className="text-xl font-bold">No se pudo abrir esta vista</h1><p className="mt-3 text-sm">{error||'No se verificaron los permisos de la cuenta.'}</p><button onClick={()=>navigate('/admin/free')} className="mt-4 min-h-11 rounded-xl bg-slate-900 px-4 text-sm text-white">Volver al panel actual</button></div></main>
  const teamMember=team.role==='member'
  const permissions=new Set(team.member?.permissions||[])
  // This shell is a navigation aid, never the source of authorization. Exact existing route guards still apply.
  const modules=allModules.filter(item=>!item.ownerOnly||!teamMember).filter(item=>{
    if(!teamMember||!item.permission)return true
    return item.permission==='contact' ? ['phone','email','whatsapp'].some(key=>permissions.has(key)) : permissions.has(item.permission)
  })
  const routeById=new Map(modules.map(item=>[item.id,item.path]))
  const agendaRoute=typeof home?.agenda_route==='string'&&home.agenda_route.startsWith('/admin/free/agenda')?home.agenda_route:''
  const completion=profile.freeReadiness
  const missing=Array.isArray(completion?.missing)?completion?.missing:[]
  const published=Number(profile.is_published)===1
  const button='min-h-12 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-bold text-slate-800'
  const go=(id:string)=>{const path=routeById.get(id);if(path)navigate(path)}
  const menu:[Tab,string,string][]=[['home','⌂','Inicio'],['profile','◉','Perfil'],['agenda','▦','Agenda'],['more','☷','Más']]
  return <main className="min-h-[100dvh] bg-[#f7f9fc] pb-[calc(94px+env(safe-area-inset-bottom))] font-['Inter'] text-slate-950">
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3">
      <div className="mx-auto flex max-w-3xl items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-xl font-black text-white">K</div><div className="min-w-0 flex-1"><strong className="block text-base">Kawvo Link</strong><span className="text-xs text-slate-500">Mi espacio · Free</span></div><button type="button" onClick={()=>navigate('/admin/free')} className="min-h-11 rounded-xl border border-slate-200 px-3 text-xs font-bold">Panel actual</button></div>
    </header>
    <section className="mx-auto w-full max-w-3xl space-y-4 px-4 pt-5">
      <p className="rounded-xl bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-900">Prueba visual de navegación · datos reales de tu propia cuenta, sin modificar la publicación. Las acciones llevan a los módulos actuales.</p>
      {tab==='home'&&<>
        <div><h1 className="text-2xl font-black">Mi espacio Kawvo</h1><p className="mt-1 text-sm text-slate-600">Todo organizado para trabajar desde tu celular.</p></div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">{profile.avatar_url?<img src={profile.avatar_url} alt="" className="h-14 w-14 rounded-xl object-cover"/>:<div className="grid h-14 w-14 place-items-center rounded-xl bg-slate-100 text-2xl">◉</div>}<div className="min-w-0 flex-1"><h2 className="truncate text-lg font-bold">{profile.name||'Mi presentación'}</h2><p className="mt-1 text-xs text-slate-600">{published?'Perfil publicado':'Borrador'}</p></div></div>
          {!published&&<p className="mt-4 rounded-xl bg-amber-50 px-3 py-3 text-sm text-amber-900">{missing.length?'Requisitos pendientes: '+missing.join(', '):'Continúa en el panel actual para comprobar si puedes publicar.'}</p>}
          <button type="button" onClick={()=>navigate('/admin/free')} className="mt-4 min-h-12 w-full rounded-xl bg-slate-900 px-4 text-sm font-bold text-white">{published?'Administrar mi presentación':'Continuar configuración y publicación'}</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={()=>setTab('profile')} className={button}><span className="mb-2 block text-xl">✎</span>Editar perfil<span className="mt-1 block text-xs font-normal text-slate-500">Información y contenido</span></button>
          <button onClick={()=>navigate('/admin/free')} className={button}><span className="mb-2 block text-xl">◉</span>Vista previa<span className="mt-1 block text-xs font-normal text-slate-500">Desde el panel actual</span></button>
          {agendaRoute?<button onClick={()=>navigate(agendaRoute)} className={button}><span className="mb-2 block text-xl">▦</span>Agenda<span className="mt-1 block text-xs font-normal text-slate-500">Solicitudes y disponibilidad</span></button>:<button onClick={()=>setTab('more')} className={button}><span className="mb-2 block text-xl">⚙</span>Mi cuenta<span className="mt-1 block text-xs font-normal text-slate-500">Configuración</span></button>}
          <button onClick={()=>navigate('/admin/free')} className={button}><span className="mb-2 block text-xl">↗</span>Compartir<span className="mt-1 block text-xs font-normal text-slate-500">Usar herramientas existentes</span></button>
        </div>
      </>}
      {tab==='profile'&&<><h1 className="text-2xl font-black">Mi perfil</h1><p className="text-sm text-slate-600">Encuentra un módulo sin recorrer toda la pantalla.</p><KawvoPagedList items={modules.filter(item=>!['Cuenta','Herramientas'].includes(item.group||''))} onOpen={go} pageSize={5} title="Secciones del perfil"/></>}
      {tab==='agenda'&&<><h1 className="text-2xl font-black">Agenda</h1>{agendaRoute?<div className="rounded-2xl border bg-white p-4"><p className="text-sm text-slate-600">Tu calendario y solicitudes conservan las reglas actuales.</p><button onClick={()=>navigate(agendaRoute)} className="mt-3 min-h-12 w-full rounded-xl bg-slate-900 text-sm font-bold text-white">Abrir Agenda</button></div>:<p className="rounded-2xl border bg-white p-4 text-sm text-slate-600">La Agenda no está habilitada para esta cuenta.</p>}</>}
      {tab==='more'&&<><h1 className="text-2xl font-black">Más opciones</h1><KawvoPagedList items={modules.filter(item=>['Cuenta','Herramientas'].includes(item.group||''))} onOpen={go} pageSize={5} title="Cuenta y herramientas"/></>}
      <p className="pt-3 text-center text-xs text-slate-500">Versión experimental · los flujos reales se mantienen en sus rutas originales.</p>
    </section>
    <nav aria-label="Navegación Kawvo" className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 gap-1 border-t border-slate-200 bg-white px-2 pb-[calc(7px+env(safe-area-inset-bottom))] pt-2 md:mx-auto md:max-w-3xl">
      {menu.map(([key,icon,label])=><button type="button" key={key} aria-current={tab===key?'page':undefined} onClick={()=>setTab(key)} className={'flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold '+(tab===key?'bg-cyan-50 text-cyan-900':'text-slate-600')}><span aria-hidden="true" className="text-lg">{icon}</span>{label}</button>)}
    </nav>
  </main>
}
