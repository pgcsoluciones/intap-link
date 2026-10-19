import AppointmentManager from '../../appointments/AppointmentManager'

export default function MedicalAppointments(){
  return <AppointmentManager
    apiBase="/me/medical-profile/appointments"
    title="Agenda médica"
    onBack={()=>window.history.back()}
  />
}
