import { useEffect, useState } from 'react'
import { apiGet } from '../../../lib/api'

function publicOrigin(){
  const host=window.location.hostname.toLowerCase()
  return host==='app.preview.intaprd.com'||host.endsWith('.pages.dev')?'https://preview.intaprd.com':'https://intaprd.com'
}

export default function MedicalDashboard(){
  const [profile,setProfile]=useState<any>(null)
  const [unread,setUnread]=useState(0)

  useEffect(()=>{
    Promise.all([
      apiGet('/me/medical-profile/appointments').catch(()=>({ok:false})),
      apiGet('/me/notifications?limit=1').catch(()=>({ok:false})),
    ]).then(([agenda,notifications]:any[])=>{
      if(agenda?.ok)setProfile(agenda.data?.profile||null)
      if(notifications?.ok)setUnread(Number(notifications.data?.unread_count||0))
    })
  },[])

  const slug=String(profile?.username||'')
  return <main className="min-h-screen bg-slate-50 px-4 py-6 font-['Inter'] text-slate-950">
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <header>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">KawMed</p>
        <h1 className="mt-1 text-3xl font-black tracking-[-.04em]">Configuración médica</h1>
        <p className="mt-2 text-sm text-slate-500">{profile?.business_name||'Administra tu perfil médico y sus herramientas.'}</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={()=>window.location.assign('/admin/medical/agenda')} className="rounded-[24px] border border-slate-200 bg-white p-5 text-left shadow-sm">
          <p className="text-xs font-black uppercase tracking-[.14em] text-cyan-700">Agenda</p>
          <h2 className="mt-2 text-xl font-black">Gestionar agenda</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Horarios disponibles, bloqueos, motivos y solicitudes de cita.</p>
        </button>

        <button type="button" onClick={()=>window.location.assign('/admin/medical/notifications')} className="rounded-[24px] border border-slate-200 bg-white p-5 text-left shadow-sm">
          <div className="flex items-center justify-between gap-3"><p className="text-xs font-black uppercase tracking-[.14em] text-cyan-700">Notificaciones</p>{unread>0&&<span className="rounded-full bg-rose-500 px-2.5 py-1 text-[11px] font-black text-white">{unread}</span>}</div>
          <h2 className="mt-2 text-xl font-black">Centro de notificaciones</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Revisa solicitudes y avisos de tu cuenta KawMed.</p>
        </button>

        {slug&&<button type="button" onClick={()=>window.open(publicOrigin()+'/m/'+encodeURIComponent(slug),'_blank','noopener,noreferrer')} className="rounded-[24px] border border-slate-200 bg-white p-5 text-left shadow-sm sm:col-span-2">
          <p className="text-xs font-black uppercase tracking-[.14em] text-cyan-700">Perfil público</p>
          <h2 className="mt-2 text-xl font-black">Ver mi perfil médico</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Abre la presentación pública para revisar cómo la ven tus pacientes.</p>
        </button>}
      </section>
    </div>
  </main>
}
