import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { apiGet } from '../../../lib/api'
import { canUseKawMedShell } from './kawmed-shell-navigation'
import { getKawMedShellReturn } from './KawMedShellReturn'
import {getKawMedMasterReturn,isKawMedMasterShellRequest,isKawMedMasterIdentity} from './kawmed-master-shell-navigation'
import {getKawMedGuestReturn,isKawMedGuestShellRequest,kawMedGuestRoute,canUseKawMedDelegateShell} from './kawmed-guest-shell-navigation'

/** A URL is never proof of identity. Recheck the existing authorized doctor profile.
 * Requests/Agenda also compare their own response identity before rendering data. */
export default function useKawMedShellReturn(delegatedProfileId='') {
  const location = useLocation(),guestRoute=kawMedGuestRoute(location.pathname)
  const guestEligible=isKawMedGuestShellRequest({mode:import.meta.env.MODE,hostname:window.location.hostname,pathname:location.pathname,search:location.search})
  const masterAttempt=import.meta.env.MODE==='preview'&&window.location.hostname==='app.preview.intaprd.com'&&new URLSearchParams(location.search).get('med_role')==='master'
  const masterCandidate=masterAttempt&&isKawMedMasterShellRequest({mode:import.meta.env.MODE,hostname:window.location.hostname,pathname:location.pathname,search:location.search})?getKawMedMasterReturn(location.search,location.pathname):null
  const candidate=masterCandidate|| (guestRoute?(guestEligible?getKawMedGuestReturn(location.search,location.pathname,'delegate'):null):getKawMedShellReturn(location.search, location.pathname))
  const [attempt, setAttempt] = useState(0)
  const [verified, setVerified] = useState('')
  const [finished, setFinished] = useState('')
  const key = candidate ? candidate.account + ':' + location.search : ''
  useEffect(() => {
    let active = true
    setVerified('');setFinished('')
    if(masterCandidate){
      Promise.all([apiGet('/me/medical-profile?scope=sponsor_master'),apiGet('/sponsor/kawmed/overview'),apiGet('/me/intapcard/active-account').catch(()=>({ok:false}))]).then(([medical,overview,selection]:any[])=>{
        const sponsor=overview?.data?.sponsor,profile=medical?.data
        if(active&&medical?.ok&&overview?.ok&&!profile?.guest_editor&&profile?.id===masterCandidate.account&&sponsor?.id===masterCandidate.sponsor&&isKawMedMasterIdentity({sponsorId:sponsor.id,currentSponsorId:sponsor.id,role:sponsor.role,active:selection?.ok?selection.data?.active:null}))setVerified(profile.id)
      }).catch(()=>{}).finally(()=>{if(active)setFinished(key)})
    }else if (candidate) apiGet('/me/medical-profile').then((response: any) => {
      const profile = response?.data
      if (active && response?.ok && profile?.id === candidate.account && (guestRoute?profile.guest_editor===true&&canUseKawMedDelegateShell({mode:import.meta.env.MODE,hostname:window.location.hostname,pathname:location.pathname,search:location.search,scope:'doctor',assignedId:delegatedProfileId,verifiedId:profile.id,profileId:profile.id}):canUseKawMedShell({
        mode: import.meta.env.MODE, hostname: window.location.hostname, pathname: '/admin/medical', search: location.search,
        scope: 'doctor', delegated: Boolean(profile.guest_editor), profileId: profile.id, guestEditor: profile.guest_editor,
      }))) setVerified(candidate.account)
    }).catch(() => { /* Existing module/guard reports API errors; no contextual privilege on failure. */ }).finally(() => { if (active) setFinished(key) })
    return () => { active = false }
  }, [candidate?.account, location.search, attempt,delegatedProfileId])
  return { context: candidate?.account === verified && (!masterCandidate||finished===key) ? candidate : null, checking: Boolean(candidate && finished !== key), rejected: Boolean(masterAttempt&&!masterCandidate || guestEligible && delegatedProfileId && !candidate || candidate && finished === key && candidate.account !== verified), retry: () => setAttempt(value => value + 1) }
}
