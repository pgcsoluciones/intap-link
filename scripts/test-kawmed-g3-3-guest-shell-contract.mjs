import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {build} from 'esbuild'
const require=createRequire(import.meta.url),ts=require('typescript')
const base='27a4a003d2cc96afb0edd609dd53ba204aa9b2c6',dir='app/src/components/admin/medical/'
const read=p=>readFileSync(p,'utf8'),prior=p=>execFileSync('git',['show',base+':'+p],{encoding:'utf8'})
const allowed=['app/src/App.tsx',...['KawMedDemoGuest.tsx','MedicalDashboard.tsx','KawMedUnifiedShellFrame.tsx','kawmed-guest-shell-navigation.ts','MedicalAppointments.tsx','useKawMedShellReturn.ts'].map(x=>dir+x),'scripts/test-kawmed-g3-3-guest-shell-contract.mjs','scripts/lib/kawmed-g3-3-browser.mjs','docs/architecture/KAWVO_KAWMED_G3_LOT_3.md',...['demo-home-320','demo-profile-390','demo-agenda-1280','delegate-home-320','delegate-profile-390','delegate-agenda-1280'].map(x=>'docs/qa/KAWMED_G3_3/'+x+'.png')].sort()
const delta=[...new Set([...execFileSync('git',['diff','--name-only',base],{encoding:'utf8'}).trim().split('\n'),...execFileSync('git',['ls-files','--others','--exclude-standard'],{encoding:'utf8'}).trim().split('\n')].filter(Boolean))].sort()
assert.ok(delta.every(p=>allowed.includes(p)),'Only G3.3 declared UI/tests/docs/captures; no operations or infrastructure')
if(process.argv.includes('--scope'))assert.deepEqual(delta,allowed)
for(const p of ['app/src/lib/api.ts','app/src/components/admin/AdminGuard.tsx',dir+'kawmed-shell-navigation.ts',dir+'KawMedShellReturn.ts',dir+'KawMedAgendaOverview.tsx','app/src/components/appointments/AppointmentManager.tsx','app/src/components/admin/free/FreeDashboard.tsx','app/src/components/admin/shared/KawvoReadyToPublish.tsx','app/src/components/admin/shared/KawvoPagedList.tsx','scripts/lib/kawmed-g3-2-browser.mjs','scripts/lib/kawvo-g3-1-1-browser.mjs','api/src/kawmed-live-guest.ts','api/src/kawmed-demo-invitations.ts','api/src/medical-profile-owner.ts','api/src/medical-appointments.ts','api/src/sponsored-multiprofile-access.ts','web/src/components/appointments/AppointmentOwnerBar.tsx','web/src/components/medical-profile/KawMedProfile.tsx'])assert.equal(read(p),prior(p),'Unchanged authority, cumulative UI or suite: '+p)
assert.equal(read('app/src/App.tsx'),prior('app/src/App.tsx').replace('path="/admin/medical/demo/:token/agenda" element={<MedicalAppointments/>}','path="/admin/medical/demo/:token/agenda" element={<KawMedDemoGuest/>}'),'Only compose original guest route; no new routes/guards')
function functions(source){const f=ts.createSourceFile('source.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),m=new Map();function visit(n){if(ts.isFunctionDeclaration(n)&&n.name)m.set(n.name.text,n.getText(f));if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&n.initializer&&ts.isArrowFunction(n.initializer))m.set(n.name.text,n.initializer.getText(f));ts.forEachChild(n,visit)}visit(f);return m}
const old=functions(prior(dir+'MedicalDashboard.tsx')),now=functions(read(dir+'MedicalDashboard.tsx'))
const ui=new Set(['MedicalDashboard','load','shellReturn','selectShellTab','openShellModule','backToProfileSections','openShellAgenda','openShellRequests'])
for(const [n,body]of old)if(!ui.has(n))assert.equal(now.get(n),body,'Original validation/mutation unchanged: '+n)
const oldSave=functions(prior(dir+'KawMedDemoGuest.tsx')).get('save'),newSave=functions(read(dir+'KawMedDemoGuest.tsx')).get('save')
assert.equal(newSave.replace('if(!canEditDemo)return;','').replace('savedCopy.current=JSON.stringify(j.data.profile);',''),oldSave,'Exact demo payload and explicit mutation retained')
const compiled=await build({entryPoints:[dir+'kawmed-guest-shell-navigation.ts'],bundle:true,write:false,platform:'node',format:'esm',define:{'import.meta.env':JSON.stringify({MODE:'preview'})}})
const nav=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'))
const path='/admin/medical/demo/i-11111111-1111-4111-8111-111111111111',ctx={mode:'preview',hostname:'app.preview.intaprd.com',pathname:path,search:'',scope:'doctor',assignedId:'assigned-a',verifiedId:'assigned-a',profileId:'assigned-a'}
assert.equal(nav.canUseKawMedDelegateShell(ctx),true)
for(const bad of [{mode:'production'},{hostname:'stage.pages.dev'},{hostname:'app.intaprd.com'},{pathname:'/admin/medical'},{pathname:path+'/credentials'},{scope:'sponsor_master'},{assignedId:''},{verifiedId:'owner'},{profileId:'other'},{search:'?legacy=1'},{search:'?scope=doctor'},{search:'?kawvo_med_shell=0'}])assert.equal(nav.canUseKawMedDelegateShell({...ctx,...bad}),false,JSON.stringify(bad))
assert.ok(nav.kawMedGuestRoute('/admin/medical/demo/'+'a'.repeat(64)))
assert.equal(nav.kawMedGuestRoute('/admin/medical/demo/i-fixture'),null)
const context={account:'assigned-a',role:'delegate',tab:'profile',module:'schedule',query:'Horarios',group:'Perfil médico',focus:'schedule',filter:'confirmed'}
const url=nav.kawMedGuestContextUrl(path,context,{section:'availability'}),parsed=nav.getKawMedGuestReturn(new URL('https://fixture'+url).search,path+'/agenda','delegate')
assert.deepEqual(parsed,{...context,viaRequests:false})
for(const [key,value]of [['med_role','demo'],['med_account','../owner'],['med_module','credentials'],['med_tab','old'],['scope','doctor'],['med_q','x'.repeat(161)]]){const q=new URLSearchParams(url.split('?')[1]);q.set(key,value);assert.equal(nav.getKawMedGuestReturn('?'+q,path+'/agenda','delegate'),null)}
assert.throws(()=>nav.kawMedGuestContextUrl('https://evil.example',context))
assert.equal(nav.kawMedGuestTab('?med_tab=agenda',false),'profile')
assert.equal(nav.kawMedGuestAgendaEntry(path+'/agenda',''),path+'?kawvo_med_shell=1&med_tab=agenda')
assert.equal(nav.kawMedGuestAgendaEntry(path+'/agenda','?section=credentials&request=../evil'),path+'?kawvo_med_shell=1&med_tab=agenda')
assert.equal(nav.kawMedGuestAgendaEntry(path+'/agenda','?med_role=delegate'),null)
console.log('PASS G3.3 static/pure: exact scope, immutable authority/mutations/Free/doctor, bounded context and role/profile gate')
if(process.argv.includes('--browser')){const {runG33Browser}=await import('./lib/kawmed-g3-3-browser.mjs');await runG33Browser();if(!process.env.KAWMED_G33_CASE){const {runG32Browser}=await import('./lib/kawmed-g3-2-browser.mjs');await runG32Browser()}}
