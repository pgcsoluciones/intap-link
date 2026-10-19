import { useEffect, useState } from 'react'
import { apiGet } from '../../../lib/api'

function publicOrigin(){
  const host=window.location.hostname.toLowerCase()
  return host==='app.preview.intaprd.com'||host.endsWith('.pages.dev')?'https://preview.intaprd.com':'https://intaprd.com'
}

export default function MedicalDashboard(){
  const [profile,setProfile]=useState<any>(null)
  const [unread,setUnread]=useState(0)
  const [sponsor,setSponsor]=useState<any>(null)

  useEffect(()=>{
    Promise.all([
      apiGet('/me/medical-profile/appointments').catch(()=>({ok:false})),
      apiGet('/me/notifications?limit=1').catch(()=>({ok:false})),
      apiGet('/me/medical-profile/sponsor-context').catch(()=>({ok:false})),
    ]).then(([agenda,notifications,sponsorJson]:any[])=>{
      if(agenda?.ok)setProfile(agenda.data?.profile||null)
      if(notifications?.ok)setUnread(Number(notifications.data?.unread_count||0))
      if(sponsorJson?.ok)setSponsor(sponsorJson.data||null)
    })
  },[])

  const slug=String(profile?.username||'')
  return <main className="min-h-screen bg-slate-50 px-4 py-6 font-['Inter'] text-slate-950">
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <header>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">KawMed</p>
            <h1 className="mt-1 text-3xl font-black tracking-[-.04em]">Configuración médica</h1>
            <p className="mt-2 text-sm text-slate-500">{profile?.business_name||'Administra tu perfil médico y sus herramientas.'}</p>
          </div>
          {sponsor?.vademecum_url&&<a href={sponsor.vademecum_url} target="_blank" rel="noopener noreferrer" className="rounded-full border border-cyan-200 bg-white px-4 py-2 text-xs font-black text-cyan-700 shadow-sm">{sponsor.vademecum_label||'Ver vademécum'}</a>}
        </div>
      </header>

      {sponsor&&<section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
        {sponsor.banner_image_url?<img src={sponsor.banner_image_url} alt={sponsor.name||'Patrocinador'} className="block max-h-[190px] w-full object-contain bg-white"/>:<div className="flex items-center gap-4 p-5">{sponsor.logo_url?<img src={sponsor.logo_url} alt={sponsor.name||'Patrocinador'} className="h-14 w-14 shrink-0 object-contain"/>:<div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-slate-100 text-lg font-black text-slate-500">{String(sponsor.name||'P').slice(0,1)}</div>}<div className="min-w-0"><p className="text-[11px] font-black uppercase tracking-[.14em] text-slate-400">Patrocinio profesional</p><h2 className="mt-1 truncate text-lg font-black text-slate-900">{sponsor.name}</h2>{sponsor.banner_title&&<p className="mt-1 text-sm text-slate-500">{sponsor.banner_title}</p>}</div></div>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-4">
          <div><p className="text-xs leading-5 text-slate-500">Contenido visible únicamente en tu panel profesional. No aparece en tu perfil público para pacientes.</p>{sponsor.representative&&<p className="mt-1 text-xs font-bold text-slate-700">Visitador asignado: {sponsor.representative.name}{sponsor.representative.zone?' · '+sponsor.representative.zone:''}</p>}</div>
          <div className="flex flex-wrap gap-2">
            {sponsor.vademecum_url&&<a href={sponsor.vademecum_url} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-700">{sponsor.vademecum_label||'Ver vademécum'}</a>}
            {sponsor.cta_url&&<a href={sponsor.cta_url} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white">{sponsor.cta_label||'Conocer más'}</a>}
          </div>
        </div>
      </section>}

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
