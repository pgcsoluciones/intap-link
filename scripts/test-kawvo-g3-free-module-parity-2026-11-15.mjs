import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read=p=>readFileSync(p,'utf8')
const shell=read('app/src/components/admin/free/KawvoFreeShellPreview.tsx')
const app=read('app/src/App.tsx')
const old=read('app/src/components/admin/free/FreeDashboard.tsx')
const editor=read('app/src/components/admin/free/FreeVisualEditor.tsx')
const bank=read('app/src/components/admin/free/FreeBankAccounts.tsx')
const services=read('app/src/components/admin/free/FreeServices.tsx')
const runner=read('scripts/run-kawvo-g3-free-module-parity-2026-11-15.sh')
const checks=[
 [shell,"path:'/admin/free/services',permission:'services',excludeDemo:true",'Services reuses route; excludes demos'],
 [shell,"path:'/admin/free/bank-accounts',ownerOnly:true,requiresIdentity:true",'Bank owner-only, retains identity prerequisite'],
 [shell,"if(item.id==='services'&&!permissions.has('design'))return false",'Team Services retains former editor access restriction'],
 [shell,"if(item.id==='identity')return ['name','role','photo'].some(key=>permissions.has(key))",'Identity matches dashboard permissions'],
 [shell,".filter(item=>!item.excludeDemo||!delegatedDemo)",'Demo restrictions'],
 [shell,"path:'/admin/free/credentials',ownerOnly:true,excludeDemo:true",'No demo credentials'],
 [shell,"path:'/admin/free/ai-profile',ownerOnly:true,permission:'ai',excludeDemo:true,requiresIdentity:true",'No demo AI, existing prerequisite'],
 [shell,"profile.templateData?.free_identity_confirmed===true",'Identity confirmed'],
 [shell,"profile.freeReadiness?.steps?.identifier",'Server identifier readiness'],
 [shell,"isRealAsset(profile.avatar_url)&&isRealAsset(profile.hero_url)",'Identity excludes starter media'],
 [shell,"item.requiresIdentity&&!baseReady&&!teamMember?{...item,disabled:true",'Missing identity disables access'],
 [shell,"modules.filter(item=>!item.disabled).map(item=>[item.id,item.path])",'Disabled routes cannot be opened by menu handler'],
 [shell,"if(routeById.has('identity'))navigate('/admin/free/onboarding/identity?from=panel',{state:shellReturnState})",'Draft CTA respects identity permission'],
 [app,'<Route path="/admin/free/services" element={<FreeOwnerOnly><AdminGuard planScope="free"><TeamPermissionGuard permission="services">','Existing service guards'],
 [app,'<Route path="/admin/free/bank-accounts" element={<AdminGuard planScope="free"><TeamPermissionGuard permission="bank_accounts">','Existing bank guards'],
 [old,"disabled={(!delegatedDemo && !baseReady) || isTeamMember}",'Legacy bank prerequisite'],
 [editor,"delegatedDemo&&item.to==='/admin/free/services'",'Existing demo service restriction'],
 [bank,"if (!access.allowed)",'Bank plan availability determined inside existing screen'],
 [bank,"<FreeBackButton onClick={() => navigate('/admin/free')} />",'Bank returns with existing shell context'],
 [services,"<FreeBackButton onClick={() => navigate('/admin/free')} />",'Services returns with existing shell context'],
 [runner,'scripts/audit-kawvo-g2-4-all-contracts-2026-11-15.mjs','All previous contracts'],
 [runner,'scripts/test-kawvo-g2-free-session-exit-contract-2026-11-15.mjs','Preserve G2.5'],
 [runner,'KAWVO_G3_PREFLIGHT_ONLY','Read-only mode']
]
let failures=0
for(const [source,needle,label] of checks){
 if(!source.includes(needle)){console.error('FAIL: '+label);failures++}
}
try{assert.doesNotMatch(shell,/apiPost\(|apiPut\(|apiPatch\(|apiDelete\(|apiUpload\(|fetch\(/)}catch{failures++;console.error('FAIL: shell must not write')}
try{assert.doesNotMatch(runner,/wrangler pages deploy web\/dist|wrangler deploy\s/)}catch{failures++;console.error('FAIL: runner scope')}
assert.equal(failures,0,'G3.1 module parity contracts')
console.log('PASS G3.1: existing Services and Bank routes, Team/demo/identity gates, no new writes')
