import { useParams } from 'react-router-dom'
import ScanActivationEntry from './ScanActivationEntry'
import TeamActivationAuthorityGate from './TeamActivationAuthorityGate'

const TEAM_CODE_KEY = 'kawvo_team_join_code'
const SCAN_PUBLIC_CODE_KEY = 'kawvo_scan_public_code'

function stored(key: string) {
  return String(sessionStorage.getItem(key) || localStorage.getItem(key) || '').trim().toUpperCase()
}

/**
 * Single authority gate for physical-product activation.
 * A validated Team context must never fall through to independent scan-to-claim.
 */
export default function ActivationAuthorityEntry() {
  const { publicCode = '' } = useParams()
  const routeCode = publicCode.trim().toUpperCase()
  const storedProduct = stored(SCAN_PUBLIC_CODE_KEY)
  const teamCode = stored(TEAM_CODE_KEY)
  const productCode = /^[A-Z2-9]{8,24}$/.test(routeCode) ? routeCode : storedProduct
  const hasTeamContext = /^[A-Z2-9]{8,24}$/.test(productCode) && /^TEAM-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(teamCode)

  if (hasTeamContext) {
    return <TeamActivationAuthorityGate publicCode={productCode} teamCode={teamCode} />
  }
  return <ScanActivationEntry />
}
