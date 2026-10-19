import FreeNotifications from '../free/FreeNotifications'

export default function MedicalNotifications(){
  return <FreeNotifications
    backPathOverride="/admin/medical"
    backLabelOverride="Regresar a KawMed"
    contextLabel="KawMed"
  />
}
