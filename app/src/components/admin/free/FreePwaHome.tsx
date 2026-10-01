import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPost } from '../../../lib/api'
import { AGENDA_SOUND_KEY, playAgendaNotificationCue, syncServiceWorkerPreference, unlockAgendaNotificationAudio } from '../../notifications/PwaNotificationBridge'

type MeData = {
  name?: string | null
  email?: string | null
  slug?: string | null
  avatar_url?: string | null
}
type HomeRouteData={
  kind?:string
  route?:string
  public_route?:string|null
  agenda_route?:string|null
  multiple_profiles?:boolean
}
type NotificationItem={
  id:string
  type:string
  title:string
  message:string
  action_url?:string|null
  read_at?:string|null
}

function isIosDevice(){return /iphone|ipad|ipod/i.test(navigator.userAgent)}
function isStandalonePwa(){return window.matchMedia?.('(display-mode: standalone)').matches||Boolean((navigator as any).standalone)}
function initialNotificationState(){
  if(typeof Notification!=='undefined')return Notification.permission
  if(isIosDevice()&&!isStandalonePwa())return 'install-required'
  return 'unsupported'
}

const SOUND_OPTIONS=[
  {value:'agenda',label:'Agenda ascendente',detail:'Tres tonos breves y claros'},
  {value:'soft',label:'Campana suave',detail:'Dos tonos discretos'},
  {value:'pulse',label:'Pulso corto',detail:'Doble aviso rápido'},
  {value:'silent',label:'Sin sonido',detail:'Usa vibración cuando el dispositivo lo permite'},
]

export default function FreePwaHome() {
  const navigate = useNavigate()
  const [me, setMe] = useState<MeData | null>(null)
  const [home, setHome] = useState<HomeRouteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  const [sound, setSound] = useState(()=>localStorage.getItem(AGENDA_SOUND_KEY)||'agenda')
  const [permission, setPermission] = useState(()=>initialNotificationState())

  const loadNotifications=async()=>{
    try{
      const json:any=await apiGet('/me/notifications?limit=30')
      if(json?.ok){
        setNotifications(Array.isArray(json.data?.items)?json.data.items:[])
        setUnread(Number(json.data?.unread_count||0))
      }
    }catch{/* no-op */}
  }

  useEffect(() => {
    Promise.all([
      apiGet('/me').catch(()=>null),
      apiGet('/me/home-route').catch(()=>null),
    ]).then(([meJson,routeJson]:any[])=>{
      if(meJson?.ok)setMe(meJson.data||null)
      if(routeJson?.ok)setHome(routeJson.data||null)
    }).finally(()=>setLoading(false))
    void loadNotifications()
    const onChanged=(event:Event)=>{
      const detail=(event as CustomEvent)?.detail
      if(detail){
        if(Array.isArray(detail.items))setNotifications(detail.items)
        if(Number.isFinite(Number(detail.unread)))setUnread(Number(detail.unread))
      }else void loadNotifications()
    }
    window.addEventListener('kawvo:pwa-notifications',onChanged)
    window.addEventListener('kawvo:notifications-changed',onChanged)
    return()=>{window.removeEventListener('kawvo:pwa-notifications',onChanged);window.removeEventListener('kawvo:notifications-changed',onChanged)}
  }, [])

  const logout = async () => {
    try { await apiPost('/auth/logout', {}) } catch { /* ignore */ }
    window.location.replace('/admin/login')
  }

  const webUrl = (import.meta.env.VITE_WEB_URL ?? 'https://intaprd.com').replace(/\/$/,'')
  const publicUrl = home?.public_route ? `${webUrl}${home.public_route}` : me?.slug ? `${webUrl}/${encodeURIComponent(me.slug)}` : ''
  const manageRoute=home?.route||'/admin/free'
  const agendaRoute=home?.agenda_route||''
  const displayName = String(me?.name || '').trim() || String(me?.email || '').trim() || 'Kawvo'
  const agendaUnread=useMemo(()=>notifications.filter(item=>['sponsored_appointment_request','free_appointment_request'].includes(item.type)&&!item.read_at).length,[notifications])
  const agendaNotifications=useMemo(()=>notifications.filter(item=>['sponsored_appointment_request','free_appointment_request'].includes(item.type)&&!item.read_at).slice(0,3),[notifications])

  async function requestNotificationPermission(){
    if(typeof Notification==='undefined'){
      setPermission(isIosDevice()&&!isStandalonePwa()?'install-required':'unsupported')
      return
    }
    try{
      await unlockAgendaNotificationAudio()
      const result=await Notification.requestPermission()
      setPermission(result)
      if(result==='granted'){playAgendaNotificationCue(sound);syncServiceWorkerPreference(sound);window.dispatchEvent(new Event('kawvo:push-permission-changed'))}
    }catch{/* browser decides */}
  }
  function changeSound(value:string){
    void unlockAgendaNotificationAudio()
    localStorage.setItem(AGENDA_SOUND_KEY,value)
    setSound(value)
    syncServiceWorkerPreference(value)
    playAgendaNotificationCue(value)
  }

  if (loading) return <div className="min-h-screen bg-[#f7f9fc] flex items-center justify-center"><div className="loading-spinner" /></div>

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 font-['Inter'] text-slate-950">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[430px] flex-col justify-center">
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-[20px] border border-cyan-100 bg-cyan-50">
              {me?.avatar_url ? <img src={me.avatar_url} alt="" className="h-full w-full object-cover" /> : <img src="/kawvo-icon-192.png" alt="Kawvo" className="h-full w-full object-contain" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-black uppercase tracking-[0.16em] text-cyan-700">KAWVO</p>
              <h1 className="mt-1 text-2xl font-black tracking-[-0.04em]">Hola, {displayName} 👋</h1>
            </div>
            {unread>0&&<span className="grid min-w-8 h-8 place-items-center rounded-full bg-red-600 px-2 text-xs font-black text-white">{unread}</span>}
          </div>

          <p className="mt-5 text-base font-semibold leading-7 text-slate-600">¿Qué quieres hacer?</p>

          <div className="mt-5 space-y-3">
            <button type="button" onClick={() => navigate(manageRoute)} className="w-full rounded-[22px] border border-cyan-200 bg-cyan-50 p-4 text-left transition active:scale-[0.99]">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan-700 text-xl text-white">⚙</span>
                <div><p className="text-base font-black text-slate-950">Administrar mi perfil</p><p className="mt-1 text-sm font-medium leading-5 text-slate-600">Edita tu información, imágenes, horario y configuración.</p></div>
              </div>
            </button>

            <button type="button" disabled={!publicUrl} onClick={() => publicUrl && window.location.assign(publicUrl)} className="w-full rounded-[22px] border border-slate-200 bg-white p-4 text-left transition active:scale-[0.99] disabled:opacity-45">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-950 text-xl text-white">👁</span>
                <div><p className="text-base font-black text-slate-950">Ver mi perfil</p><p className="mt-1 text-sm font-medium leading-5 text-slate-600">Mira tu presentación como la ven tus clientes.</p></div>
              </div>
            </button>

            {agendaRoute&&<>
              <button type="button" onClick={()=>navigate(agendaRoute)} className="relative w-full rounded-[22px] border border-emerald-200 bg-emerald-50 p-4 text-left transition active:scale-[0.99]">
                {agendaUnread>0&&<span className="absolute right-3 top-3 grid min-w-7 h-7 place-items-center rounded-full bg-red-600 px-2 text-[11px] font-black text-white">{agendaUnread}</span>}
                <div className="flex items-center gap-3 pr-8">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-600 text-xl text-white">📅</span>
                  <div><p className="text-base font-black text-slate-950">Agenda</p><p className="mt-1 text-sm font-medium leading-5 text-slate-600">{agendaUnread>0?`Tienes ${agendaUnread} solicitud${agendaUnread===1?'':'es'} pendiente${agendaUnread===1?'':'s'}.`:'Gestiona citas, horarios, bloqueos y solicitudes.'}</p></div>
                </div>
              </button>
              {agendaNotifications.length>0&&<div className="overflow-hidden rounded-[20px] border border-rose-100 bg-rose-50/60">
                <div className="border-b border-rose-100 px-4 py-2 text-[11px] font-black uppercase tracking-[.12em] text-rose-700">Nuevas solicitudes</div>
                {agendaNotifications.map(item=><button key={item.id} type="button" onClick={()=>window.location.assign(item.action_url||agendaRoute)} className="flex w-full items-start gap-3 border-b border-rose-100 px-4 py-3 text-left last:border-b-0">
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-red-600"/>
                  <span className="min-w-0 flex-1"><strong className="block truncate text-sm text-slate-900">{item.title}</strong><span className="mt-1 line-clamp-2 block text-xs leading-5 text-slate-600">{item.message}</span></span><span className="text-lg text-slate-400">›</span>
                </button>)}
              </div>}
            </>}
          </div>

          {agendaRoute&&<section className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-black text-slate-950">Avisos de agenda</p><p className="mt-1 text-xs leading-5 text-slate-500">Elige el sonido que distinguirá una nueva solicitud mientras Kawvo esté activa.</p></div><span className={'rounded-full px-2 py-1 text-[10px] font-black '+(permission==='granted'?'bg-emerald-100 text-emerald-700':permission==='install-required'?'bg-amber-100 text-amber-800':'bg-slate-200 text-slate-600')}>{permission==='granted'?'Avisos activos':permission==='denied'?'Bloqueados':permission==='install-required'?'Instala Kawvo':permission==='unsupported'?'No compatible':'Sin permiso'}</span></div>
            {permission==='install-required'&&<div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] font-semibold leading-5 text-amber-950">
              <strong className="block text-sm">En iPhone, los avisos funcionan desde Kawvo instalada.</strong>
              <span className="mt-1 block">Toca Compartir en Safari → <strong>Agregar a pantalla de inicio</strong>. Luego abre Kawvo desde el icono instalado y vuelve aquí para activar los avisos.</span>
            </div>}
            <select value={sound} onChange={e=>changeSound(e.target.value)} className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold">
              {SOUND_OPTIONS.map(option=><option key={option.value} value={option.value}>{option.label} · {option.detail}</option>)}
            </select>
            {permission!=='granted'&&permission!=='unsupported'&&permission!=='install-required'&&<button type="button" onClick={()=>void requestNotificationPermission()} className="mt-3 w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white">Activar avisos del dispositivo</button>}
            <p className="mt-3 text-[11px] leading-5 text-slate-500">Con sonido desactivado, Kawvo intenta vibrar cuando el dispositivo y el navegador lo permiten.</p>
          </section>}

          {!publicUrl && <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold leading-5 text-amber-900">{home?.multiple_profiles?'Selecciona primero el perfil que quieres administrar.':'Completa tu usuario para habilitar el acceso directo a tu perfil público.'}</p>}

          <button type="button" onClick={() => void logout()} className="mt-5 w-full rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-600">Cerrar sesión</button>
        </div>
      </section>
    </main>
  )
}
