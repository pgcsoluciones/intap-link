import { useNavigate } from 'react-router-dom'
import AppointmentManager from '../../appointments/AppointmentManager'

export default function FreeAppointments(){
  const navigate=useNavigate()
  return <AppointmentManager
    apiBase="/me/free/appointments"
    title="Horario y agenda"
    onBack={()=>navigate('/admin/free/account')}
  />
}
