import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=p=>readFileSync(p,'utf8')
const shell=read('app/src/components/admin/free/KawvoFreeShellPreview.tsx')
const legacy=read('app/src/components/admin/free/FreeDashboard.tsx')
const guard=read('app/src/components/admin/SuperAdminGuard.tsx')
const app=read('app/src/App.tsx')
const checks=[
 [shell,"const [superAdminProfileId,setSuperAdminProfileId]=useState('')",'Hidden by default'],
 [shell,"const verifiedProfileId=String(profile?.profile_id||'')",'Bound to verified profile'],
 [shell,"setSuperAdminProfileId('')",'Clear before authorizing'],
 [shell,"if(!enabled||!verifiedProfileId||isFreeDemoDelegationActive())return",'No probe outside enabled authenticated non-demo context'],
 [shell,"apiGet<{ok?:boolean}>('/superadmin/metrics/overview')",'Existing server authorization'],
 [shell,"if(active&&result?.ok===true)setSuperAdminProfileId(verifiedProfileId)",'Confirmed success only'],
 [shell,".catch(()=>undefined)",'Probe failure does not block Free'],
 [shell,"return()=>{active=false}",'Ignore stale requests'],
 [shell,"},[enabled,verifiedProfileId])",'Recheck when identity changes'],
 [shell,"const hasSuperAdminAccess=!delegatedDemo&&Boolean(verifiedProfileId)&&superAdminProfileId===verifiedProfileId",'No demo or stale account shortcut'],
 [shell,"{hasSuperAdminAccess&&<button type=\"button\" onClick={()=>navigate('/superadmin')}",'Explicit authorized navigation only'],
 [legacy,"apiGet('/superadmin/metrics/overview')",'Same original check'],
 [guard,"apiGet('/superadmin/metrics/overview')",'Destination checks again'],
 [app,'<Route path="/superadmin" element={<SuperAdminGuard><SuperAdminDashboard/></SuperAdminGuard>','Destination remains guarded']
]
for(const [src,needle,label] of checks)assert.ok(src.includes(needle),label)
assert.equal((shell.match(/navigate\('\/superadmin'\)/g)||[]).length,1)
assert.doesNotMatch(shell,/apiPost\(|apiPut\(|apiPatch\(|apiDelete\(|apiUpload\(|fetch\(/)
console.log('PASS G4.1: Super Admin shortcut only after server authorization, no delegated demo or new writes')
