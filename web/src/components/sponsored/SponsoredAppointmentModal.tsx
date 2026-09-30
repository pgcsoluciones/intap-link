import AppointmentRequestModal from '../appointments/AppointmentRequestModal'

type Palette={accent:string;accentSoft:string;text:string}
type Props={
  username:string
  palette:Palette
  onClose:()=>void
  onToast:(message:string)=>void
}

export default function SponsoredAppointmentModal({username,palette,onClose,onToast}:Props){
  return <AppointmentRequestModal
    apiBase={'/api/v1/public/sponsored/'+encodeURIComponent(username)+'/appointments'}
    palette={palette}
    onClose={onClose}
    onToast={onToast}
  />
}
