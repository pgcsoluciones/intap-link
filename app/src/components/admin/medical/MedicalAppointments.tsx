import AppointmentManager from '../../appointments/AppointmentManager'

export default function MedicalAppointments(){
  const scope=String(new URLSearchParams(window.location.search).get('scope')||'').trim()
  const query=scope==='sponsor_master'?'scope=sponsor_master':''
  return <AppointmentManager
    apiBase="/me/medical-profile/appointments"
    query={query}
    title={scope==='sponsor_master'?'Agenda · presentación Master':'Agenda médica'}
    onBack={()=>window.history.back()}
  />
}
