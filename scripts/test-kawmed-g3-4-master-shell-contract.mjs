import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {build} from 'esbuild'
const require=createRequire(import.meta.url),ts=require('typescript'),base='2e5bfcc5d732d5d3bba3b970ce165a3ea5f7e5a8',dir='app/src/components/admin/medical/'
const read=p=>readFileSync(p,'utf8'),prior=p=>execFileSync('git',['show',base+':'+p],{encoding:'utf8'})
const allowed=['app/src/components/admin/sponsored/SponsorKawMed.tsx',...['MedicalDashboard.tsx','KawMedUnifiedShellFrame.tsx','kawmed-master-shell-navigation.ts','useKawMedShellReturn.ts','MedicalAppointments.tsx','KawMedAgendaOverview.tsx'].map(x=>dir+x),'app/src/components/admin/IntapcardAccountSelector.tsx','scripts/test-kawmed-g3-4-master-shell-contract.mjs','scripts/lib/kawmed-g3-4-browser.mjs','docs/architecture/KAWVO_KAWMED_G3_LOT_4.md',...['home-320','profile-390','sponsorship-390','identity-390','agenda-1280','home-1280'].map(x=>'docs/qa/KAWMED_G3_4/'+x+'.png')].sort()
const delta=[...new Set([...execFileSync('git',['diff','--name-only',base],{encoding:'utf8'}).trim().split('\n'),...execFileSync('git',['ls-files','--others','--exclude-standard'],{encoding:'utf8'}).trim().split('\n')].filter(Boolean))].sort()
assert.ok(delta.every(p=>allowed.includes(p)),'Declared App UI/tests/docs only; no infrastructure, dependencies, permissions or runners')
if(process.argv.includes('--scope'))assert.deepEqual(delta,allowed)
for(const p of ['app/src/App.tsx','app/src/lib/api.ts','app/src/components/admin/AdminGuard.tsx',dir+'kawmed-shell-navigation.ts',dir+'kawmed-guest-shell-navigation.ts',dir+'KawMedShellReturn.ts',dir+'KawMedDemoGuest.tsx','app/src/components/admin/free/FreeCredentials.tsx','app/src/components/appointments/AppointmentManager.tsx','app/src/components/admin/shared/KawvoReadyToPublish.tsx','app/src/components/admin/shared/KawvoPagedList.tsx','scripts/lib/kawmed-g3-3-browser.mjs','scripts/lib/kawmed-g3-2-browser.mjs','scripts/lib/kawvo-g3-1-1-browser.mjs','api/src/kawmed-live-guest.ts','api/src/medical-profile-owner.ts','api/src/medical-appointments.ts','api/src/medical-access-codes.ts'])assert.equal(read(p),prior(p),'Existing guard/operation/cumulative assertion unchanged: '+p)
function functions(source){const f=ts.createSourceFile('source.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),m=new Map();function visit(n){if(ts.isFunctionDeclaration(n)&&n.name)m.set(n.name.text,n.getText(f));if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&n.initializer&&ts.isArrowFunction(n.initializer))m.set(n.name.text,n.initializer.getText(f));ts.forEachChild(n,visit)}visit(f);return m}
for(const p of [dir+'MedicalDashboard.tsx','app/src/components/admin/sponsored/SponsorKawMed.tsx']){
 const before=functions(prior(p)),after=functions(read(p)),ui=new Set(['MedicalDashboard','SponsorKawMed','load','selectShellTab','openShellAgenda','openShellRequests','contextUrl','requestLogout','shellHasPendingEdits'])
 for(const [name,body]of before)if(!ui.has(name))assert.equal(after.get(name),body,'Existing validation/mutation preserved: '+p+' '+name)
}
for(const name of ['beginActivation','signOut'])assert.equal(functions(read('app/src/components/admin/IntapcardAccountSelector.tsx')).get(name),functions(prior('app/src/components/admin/IntapcardAccountSelector.tsx')).get(name))
const compiled=await build({entryPoints:[dir+'kawmed-master-shell-navigation.ts'],bundle:true,write:false,platform:'node',format:'esm',define:{'import.meta.env':JSON.stringify({MODE:'preview'})}})
const nav=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'))
const host={mode:'preview',hostname:'app.preview.intaprd.com',pathname:'/admin/sponsor/kawmed',search:''},identity={sponsorId:'tenant-a',currentSponsorId:'tenant-a',role:'owner',active:{kind:'medical_master',id:'tenant-a'}}
assert.equal(nav.isKawMedMasterShellRequest(host),true);assert.equal(nav.isKawMedMasterIdentity(identity),true)
for(const bad of [{mode:'production'},{hostname:'app.intaprd.com'},{hostname:'stage.pages.dev'},{pathname:'/admin/medical'},{pathname:'/admin/medical/demo/i-fixture'},{search:'?legacy=1'},{search:'?scope=doctor'},{search:'?kawvo_med_shell=0'}])assert.equal(nav.isKawMedMasterShellRequest({...host,...bad}),false)
for(const bad of [{sponsorId:''},{currentSponsorId:'other'},{role:'visitor'},{role:'doctor'},{active:{kind:'medical',id:'tenant-a'}},{active:{kind:'medical_master',id:'other'}}])assert.equal(nav.isKawMedMasterIdentity({...identity,...bad}),false)
const context={account:'master-profile-a',sponsor:'tenant-a',tab:'profile',module:'insurance',query:'Seguros',group:'Perfil médico',focus:'insurance',filter:'pending',codeQuery:'Estación',codeStatus:'claimed',codeRep:'rep-a'}
const url=nav.kawMedMasterContextUrl('/admin/medical/agenda',context,{section:'requests',request:'request-a'}),parsed=nav.getKawMedMasterReturn(new URL('https://fixture'+url).search,'/admin/medical/agenda')
assert.deepEqual(parsed,{...context,viaRequests:false})
for(const [key,value]of [['med_role','delegate'],['med_sponsor','../owner'],['med_account','../owner'],['scope','doctor'],['med_module','credentials'],['med_q','x'.repeat(161)],['master_q','x'.repeat(161)],['master_status','invented'],['master_rep','https://evil.example']]){const p=new URLSearchParams(url.split('?')[1]);p.set(key,value);assert.equal(nav.getKawMedMasterReturn('?'+p,'/admin/medical/agenda'),null)}
assert.equal(nav.getKawMedMasterReturn(url.split('?')[1],'/admin/free'),null)
assert.throws(()=>nav.kawMedMasterContextUrl('https://evil.example',context),'No arbitrary return destinations')
assert.equal(nav.kawMedMasterInitialSurface('?tab=profile').tab,'profile');assert.equal(nav.kawMedMasterInitialSurface('?tab=codes').section,'codes')
assert.equal(nav.kawMedMasterAgendaEntry('/admin/medical/agenda','?scope=sponsor_master&kawvo_med_shell=1'),'/admin/sponsor/kawmed?kawvo_med_shell=1&tab=agenda')
assert.equal(nav.kawMedMasterAgendaEntry('/admin/medical/agenda','?scope=doctor'),null)
assert.equal(nav.kawMedMasterAgendaEntry('/admin/medical/agenda','?scope=sponsor_master'),null,'Bare Master Agenda keeps the original legacy module')
assert.equal(nav.isKawMedMasterShellRequest({...host,pathname:'/admin/medical/agenda',search:'?scope=sponsor_master'}),false)
console.log('PASS G3.4 pure/static: explicit scope, unchanged business operations/guards/credentials/cumulative suites, tenant/profile context, canonical entries and legacy gates')
if(process.argv.includes('--browser')){const {runG34Browser}=await import('./lib/kawmed-g3-4-browser.mjs');await runG34Browser();if(!process.env.KAWMED_G34_CASE){const {runG33Browser}=await import('./lib/kawmed-g3-3-browser.mjs');await runG33Browser();const {runG32Browser}=await import('./lib/kawmed-g3-2-browser.mjs');await runG32Browser()}}
