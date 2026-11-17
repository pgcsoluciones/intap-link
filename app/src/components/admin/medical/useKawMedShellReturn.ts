import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { apiGet } from '../../../lib/api'
import { canUseKawMedShell } from './kawmed-shell-navigation'
import { getKawMedShellReturn } from './KawMedShellReturn'

/** A URL is never proof of identity. Recheck the existing authorized doctor profile.
 * Requests/Agenda also compare their own response identity before rendering data. */
export default function useKawMedShellReturn() {
  const location = useLocation(), candidate = getKawMedShellReturn(location.search, location.pathname)
  const [attempt, setAttempt] = useState(0)
  const [verified, setVerified] = useState('')
  const [finished, setFinished] = useState('')
  const key = candidate ? candidate.account + ':' + location.search : ''
  useEffect(() => {
    let active = true
    setVerified('');setFinished('')
    if (candidate) apiGet('/me/medical-profile').then((response: any) => {
      const profile = response?.data
      if (active && response?.ok && profile?.id === candidate.account && canUseKawMedShell({
        mode: import.meta.env.MODE, hostname: window.location.hostname, pathname: '/admin/medical', search: location.search,
        scope: 'doctor', delegated: Boolean(profile.guest_editor), profileId: profile.id, guestEditor: profile.guest_editor,
      })) setVerified(candidate.account)
    }).catch(() => { /* Existing module/guard reports API errors; no contextual privilege on failure. */ }).finally(() => { if (active) setFinished(key) })
    return () => { active = false }
  }, [candidate?.account, location.search, attempt])
  return { context: candidate?.account === verified ? candidate : null, checking: Boolean(candidate && finished !== key), rejected: Boolean(candidate && finished === key && candidate.account !== verified), retry: () => setAttempt(value => value + 1) }
}
