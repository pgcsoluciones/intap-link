import { useLocation, useNavigate } from 'react-router-dom'
import AppointmentManager from '../../appointments/AppointmentManager'
import { getKawvoShellReturn, isKawvoShellPreviewHost, KAWVO_SHELL_PREVIEW_ROUTE } from './KawvoShellReturn'

export default function FreeAppointments(){
  const navigate=useNavigate()
  const location=useLocation()
  const returnContext=isKawvoShellPreviewHost()?getKawvoShellReturn(location.state):null
  return <AppointmentManager
    apiBase="/me/free/appointments"
    title="Horario y agenda"
    onBack={()=>navigate(returnContext?KAWVO_SHELL_PREVIEW_ROUTE:'/admin/free/account',returnContext?{state:returnContext}:undefined)}
  />
}
