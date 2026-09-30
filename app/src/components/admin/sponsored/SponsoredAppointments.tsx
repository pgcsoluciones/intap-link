import { useNavigate } from 'react-router-dom'
import AppointmentManager from '../../appointments/AppointmentManager'

export default function SponsoredAppointments(){
  const navigate=useNavigate()
  const params=new URLSearchParams(window.location.search)
  const profileId=String(params.get('profile_id')||'').trim()
  const scope=String(params.get('scope')||'').trim()==='master'?'master':''
  const query=new URLSearchParams()
  if(profileId)query.set('profile_id',profileId)
  if(scope)query.set('scope',scope)
  return <AppointmentManager
    apiBase="/me/sponsored-profile/appointments"
    query={query.toString()}
    title="Agenda"
    onBack={()=>navigate(profileId?'/admin/sponsored?profile_id='+encodeURIComponent(profileId):scope?'/admin/sponsor':'/admin/sponsored')}
  />
}
