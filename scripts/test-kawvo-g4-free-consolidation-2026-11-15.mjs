import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=p=>readFileSync(p,'utf8')
const free=read('app/src/components/admin/free/FreeDashboard.tsx')
const shell=read('app/src/components/admin/free/KawvoFreeShellPreview.tsx')
const publication=read('app/src/components/admin/free/FreePublicationActions.tsx')
const helper=read('app/src/components/admin/free/KawvoShellReturn.ts')
const bell=read('app/src/components/admin/free/FreeNotificationBell.tsx')
const app=read('app/src/App.tsx')
const api=read('api/src/index.ts')
const runner=read('scripts/run-kawvo-g4-free-consolidation-2026-11-15.sh')
const checks=[
 [app,'<Route path="/admin/free" element={<AdminGuard planScope="free"><FreeDashboard/></AdminGuard>','Canonical entry remains authenticated and Free-scoped'],
 [free,"isKawvoShellPreviewHost()&&!isFreeDemoDelegationActive()&&new URLSearchParams(location.search).get('legacy')!=='1'",'Preview-only default; preserve demo and explicit recovery'],
 [free,'<Navigate to={KAWVO_SHELL_PREVIEW_ROUTE} replace state={location.state}/>','Forward only navigation state, no account switch'],
 [free,'return <FreeDashboardLegacy/>','Legacy still fully available'],
 [helper,"'/admin/free?legacy=1'",'Explicit legacy recovery'],
 [helper,"import.meta.env.MODE === 'preview'",'Production build excluded'],
 [helper,"window.location.hostname === 'app.preview.intaprd.com'",'Production hostname excluded'],
 [shell,'navigate(KAWVO_FREE_LEGACY_ROUTE)','Recovery does not loop through canonical entry'],
 [shell,'Abrir panel anterior','Visible fallback under More'],
 [shell,"allowAccountSwitch=!teamMember&&!delegatedDemo&&home?.kind==='multiaccount'",'No unauthorized account-switch affordance'],
 [shell,'String(current.id)!==String(p.data.profile_id)','Exact verified active identity'],
 [shell,'item.requiresIdentity&&!baseReady&&!teamMember?','Owner identity prerequisite with Team-specific behavior'],
 [shell,'const publicationBaseReady=delegatedDemo||(teamMember?teamPublicationReady:baseReady)','Existing Team and owner readiness'],
 [shell,'const readyToPublish=!published&&completion?.ready===true&&publicationBaseReady','Server and existing client requirements'],
 [shell,'{!delegatedDemo&&<FreePublicationActions','No new demo publication surface'],
 [shell,'key={accountIdentity}','Publication component scoped to profile'],
 [shell,"String(current.profile_id||current.slug||'')===accountIdentity?{...current,is_published:next?1:0}:current",'Update only original profile after success'],
 [shell,"String(current.profile_id||current.slug||'')===accountIdentity?{...current,freeReadiness:readiness}:current",'Rejected publication updates only original readiness'],
 [free,'await submitFreePublication(next === 1)','Original UI shares same implementation'],
 [publication,"apiPut('/me/profile',{is_published:next})",'Existing authenticated endpoint only'],
 [publication,"if(result?.ok&&next)void apiPost('/me/notifications/profile-published',{}).catch(()=>undefined)",'Notification only after confirmed publish'],
 [publication,'if(pending.current||(!published&&!canPublish))return','Prevent duplicate or unready publication'],
 [publication,'if(result?.ok)onSaved(next)','No optimistic publication state'],
 [publication,"else if(result?.error==='profile_incomplete')",'Respect API readiness error'],
 [publication,'if(result.readiness)onIncomplete(result.readiness)','Refresh readiness from server rejection'],
 [publication,'if(!published&&!canPublish&&!error&&!busy)return null','Retain error even if readiness becomes false'],
 [publication,'onClick={()=>void change()}','Explicit action only'],
 [api,"if (is_published === 1 && String((profile as any).plan_id || 'free') === 'free')",'Server keeps Free publish gate'],
 [shell,'<FreeNotificationBell returnState={shellReturnState}/>','Existing unread indicator and return'],
 [bell,"navigate('/admin/free/notifications',returnState?{state:returnState}:undefined)",'Notification click retains shell origin'],
 [runner,'scripts/test-kawvo-g3-free-multiaccount-entry-2026-11-15.mjs','G3.2 regression retained']
]
for(const id of ['contact','quick','location','links','portfolio','services','bank','design','ai']){
 const line=shell.split('\n').find(l=>l.includes("{id:'"+id+"'"))
 checks.push([line||'','requiresIdentity:true','Existing owner prerequisite for '+id])
}
let failures=0
for(const [src,needle,label] of checks)if(!src.includes(needle)){console.error('FAIL: '+label);failures++}
assert.doesNotMatch(shell,/apiPost\(|apiPut\(|apiPatch\(|apiDelete\(|apiUpload\(|fetch\(/)
assert.equal((publication.match(/apiPut\(/g)||[]).length,1)
assert.equal((publication.match(/apiPost\(/g)||[]).length,1)
assert.doesNotMatch(publication,/useEffect\(|apiDelete\(|apiUpload\(|apiPatch\(/)
assert.doesNotMatch(free,/apiPut\(|apiPost\(/,'No duplicated original publication request')
assert.equal(failures,0,'G4 consolidation contracts')
console.log('PASS G4: default Free Preview entry, explicit recovery, shared publish/hide, readiness, scoped account switch and notifications')
