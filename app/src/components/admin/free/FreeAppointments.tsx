import { useLocation, useNavigate } from 'react-router-dom'
import AppointmentManager from '../../appointments/AppointmentManager'

export default function FreeAppointments(){
  const navigate=useNavigate()
  const location=useLocation()
  const returnToShell=import.meta.env.MODE==='preview'
    && window.location.hostname==='app.preview.intaprd.com'
    && (location.state as {kawvoShellReturn?:boolean}|null)?.kawvoShellReturn===true
  return <AppointmentManager
    apiBase="/me/free/appointments"
    title="Horario y agenda"
    onBack={()=>navigate(returnToShell?'/admin/free/shell-preview?kawvo_shell=1':'/admin/free/account',returnToShell?{state:location.state}:undefined)}
  />
}
