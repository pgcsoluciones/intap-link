import { useNavigate,Navigate } from 'react-router-dom'
import AppointmentManager from '../../appointments/AppointmentManager'
import { sponsoredAgendaReturn,isSponsoredShellRequest,sponsoredShellUrl,sponsoredSurface } from './sponsored-shell-gate'

export default function SponsoredAppointments(){
  const navigate=useNavigate()
  const params=new URLSearchParams(window.location.search)
  const profileId=String(params.get('profile_id')||'').trim()
  const scope=String(params.get('scope')||'').trim()==='master'?'master':''
  const query=new URLSearchParams()
  if(profileId)query.set('profile_id',profileId)
  if(scope)query.set('scope',scope)
  if(isSponsoredShellRequest(import.meta.env.MODE,window.location.hostname,window.location.search)){
    const surface=sponsoredSurface(window.location.search)
    const request=params.get('request')||undefined
    const section=(request?'requests':params.get('section')) as typeof surface.section
    return <Navigate replace to={sponsoredShellUrl(profileId,{...surface,tab:'agenda',section:section||surface.section,request})}/>
  }
  return <AppointmentManager
    apiBase="/me/sponsored-profile/appointments"
    query={query.toString()}
    title="Agenda"
    onBack={()=>navigate(sponsoredAgendaReturn(window.location.search,import.meta.env.MODE,window.location.hostname))}
  />
}
