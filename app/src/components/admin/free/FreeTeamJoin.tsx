import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const TEAM_CODE_KEY = 'kawvo_team_join_code'
const SCAN_PUBLIC_CODE_KEY = 'kawvo_scan_public_code'

function readProductCode() {
  const value = sessionStorage.getItem(SCAN_PUBLIC_CODE_KEY) || localStorage.getItem(SCAN_PUBLIC_CODE_KEY) || ''
  const code = value.trim().toUpperCase()
  return /^[A-Z2-9]{8,24}$/.test(code) ? code : ''
}

function readTeamCode() {
  const value = sessionStorage.getItem(TEAM_CODE_KEY) || localStorage.getItem(TEAM_CODE_KEY) || ''
  const code = value.trim().toUpperCase()
  return /^TEAM-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code) ? code : ''
}

/**
 * Compatibility route only.
 *
 * The old self-join flow allowed a normal Free account to consume a Team
 * product and could overwrite an independent draft. The approved corporate
 * model has a single source of truth: only the Team Master prepares a new
 * Team device. Old bookmarks/callbacks are funneled into that same flow.
 */
export default function FreeTeamJoin() {
  const navigate = useNavigate()

  useEffect(() => {
    const publicCode = readProductCode()
    const teamCode = readTeamCode()
    if (publicCode && teamCode) {
      navigate(`/admin/free/team/assign?public_code=${encodeURIComponent(publicCode)}&team_code=${encodeURIComponent(teamCode)}`, { replace: true })
      return
    }
    navigate('/admin/free/team', { replace: true })
  }, [navigate])

  return <main className="min-h-screen bg-[#f7f9fc] flex items-center justify-center"><div className="loading-spinner" /></main>
}
