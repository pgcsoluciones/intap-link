import { useLocation, useNavigate } from 'react-router-dom'
import AppointmentManager from '../../appointments/AppointmentManager'
import { KAWMED_AGENDA_SECTIONS, kawMedLegacyReturn, kawMedReturnTarget, type KawMedAgendaSection } from './KawMedShellReturn'
import {kawMedGuestRoute,kawMedGuestContextUrl} from './kawmed-guest-shell-navigation'
import useKawMedShellReturn from './useKawMedShellReturn'

export default function MedicalAppointments({delegatedProfileId=''}:{delegatedProfileId?:string}={}){
  const location=useLocation(),navigate=useNavigate(),{context,checking,rejected,retry}=useKawMedShellReturn(delegatedProfileId)
  const guestRoute=kawMedGuestRoute(location.pathname)
  const legacyTarget=guestRoute?guestRoute.base+(new URLSearchParams(location.search).get('legacy')==='1'?'?legacy=1':''):kawMedLegacyReturn(location.pathname,location.search)
  const params=new URLSearchParams(location.search)
  const scope=String(params.get('scope')||'').trim()
  const query=scope==='sponsor_master'?'scope=sponsor_master':''
  const section=params.get('section') as KawMedAgendaSection
  if(checking)return <main role="status" className="min-h-screen bg-slate-50 p-5 text-sm">Verificando la cuenta médica de origen…</main>
  if(rejected)return <main className="min-h-screen bg-slate-50 p-5"><p role="alert">No se pudo verificar la cuenta médica de origen. Comprueba tu acceso y la cuenta activa.</p><button type="button" onClick={retry} className="mt-4 mr-2 min-h-11 min-w-11 rounded-xl border bg-white px-4 font-bold">Reintentar</button><button type="button" onClick={()=>navigate(guestRoute?guestRoute.base:'/admin/medical?kawvo_med_shell=1')} className="mt-4 min-h-11 min-w-11 rounded-xl border bg-white px-4 font-bold">Volver al perfil médico</button></main>
  return <AppointmentManager
    apiBase="/me/medical-profile/appointments"
    query={query}
    title={scope==='sponsor_master'?'Agenda · presentación Master':'Agenda médica'}
    initialSection={context&&KAWMED_AGENDA_SECTIONS.includes(section)?section:undefined}
    expectedProfileId={context?.account}
    protectDrafts={Boolean(context)}
    backLabel={context?(context.viaRequests?'Volver a solicitudes de citas médicas':context.tab==='profile'?'Volver al perfil médico':context.tab==='more'?'Volver a Más opciones':context.tab==='home'?'Volver a Inicio':'Volver a Agenda'):undefined}
    onBack={()=>navigate(context?(guestRoute?kawMedGuestContextUrl(guestRoute.base,{...context,role:'delegate'}):kawMedReturnTarget(context)):legacyTarget)}
  />
}
