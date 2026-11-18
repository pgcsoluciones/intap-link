import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { build } from 'esbuild'
const require=createRequire(import.meta.url),ts=require('typescript')
const base='567a028a5a06754910a0335433b403cec806399a'
const dir='app/src/components/admin/medical/',medicalPath=dir+'MedicalDashboard.tsx'
const read=path=>readFileSync(path,'utf8'),prior=path=>execFileSync('git',['show',base+':'+path],{encoding:'utf8'})
const allowed=[medicalPath,dir+'MedicalAppointments.tsx',dir+'MedicalNotifications.tsx',dir+'KawMedShellReturn.ts',dir+'useKawMedShellReturn.ts',dir+'KawMedAgendaOverview.tsx','app/src/components/appointments/AppointmentManager.tsx','app/src/components/admin/IntapcardAccountSelector.tsx','scripts/test-kawmed-g3-2-navigation-contract.mjs','scripts/test-kawvo-g3-1-1-ui-contract.mjs','scripts/lib/kawvo-g3-1-1-browser.mjs','scripts/lib/kawmed-g3-2-browser.mjs','docs/architecture/KAWVO_KAWMED_G3_LOT_2.md',...['baseline-agenda-390','profile-390','agenda-390','agenda-1280','requests-390','availability-390'].map(name=>'docs/qa/KAWMED_G3_2/'+name+'.png')].sort()
const delta=[...new Set([...execFileSync('git',['diff','--name-only',base],{encoding:'utf8'}).trim().split('\n'),...execFileSync('git',['ls-files','--others','--exclude-standard'],{encoding:'utf8'}).trim().split('\n')].filter(Boolean))].sort()
assert.ok(delta.every(path=>allowed.includes(path)),'Only explicit G3.2 UI/tests/docs/evidence scope; no runners/infrastructure')
if(process.argv.includes('--scope'))assert.deepEqual(delta,allowed,'Exact successor allowlist')
for(const path of ['app/src/App.tsx','app/src/lib/api.ts',dir+'kawmed-shell-navigation.ts',dir+'KawMedUnifiedShellFrame.tsx','app/src/components/admin/shared/KawvoReadyToPublish.tsx','app/src/components/admin/shared/KawvoProfileIdentity.tsx','app/src/components/admin/shared/KawvoPagedList.tsx','app/src/components/admin/free/KawvoFreeShellPreview.tsx','app/src/components/admin/free/FreeDashboard.tsx','app/src/components/admin/free/FreePublicationActions.tsx','app/src/components/admin/free/FreeShellSessionExit.tsx','app/src/components/admin/free/FreeAppointments.tsx'])assert.equal(read(path),prior(path),'Approved component/guard unchanged: '+path)
function functions(source){
 const file=ts.createSourceFile('fixture.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),result=new Map()
 function visit(node){if(ts.isFunctionDeclaration(node)&&node.name)result.set(node.name.text,node.getText(file));if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&node.initializer&&ts.isArrowFunction(node.initializer))result.set(node.name.text,node.initializer.getText(file));ts.forEachChild(node,visit)}visit(file);return result
}
const oldMedical=functions(prior(medicalPath)),newMedical=functions(read(medicalPath))
for(const [name,body] of oldMedical){
 if(['MedicalDashboard','selectShellTab','openShellModule','openShellAgenda'].includes(name))continue
 assert.equal(newMedical.get(name),body,'Existing medical operation/validation unchanged: '+name)
}
const managerPath='app/src/components/appointments/AppointmentManager.tsx'
for(const [name,body] of functions(prior(managerPath))){if(!['AppointmentManager','load'].includes(name))assert.equal(functions(read(managerPath)).get(name),body,'Existing Agenda operation unchanged: '+name)}
for(const name of ['beginActivation','signOut'])assert.equal(functions(read('app/src/components/admin/IntapcardAccountSelector.tsx')).get(name),functions(prior('app/src/components/admin/IntapcardAccountSelector.tsx')).get(name),'Account operation unchanged: '+name)
const oldTest=prior('scripts/test-kawvo-g3-1-1-ui-contract.mjs'),shared=read('scripts/lib/kawvo-g3-1-1-browser.mjs')
assert.equal(read('scripts/test-kawvo-g3-1-1-ui-contract.mjs').split("const {runG311Browser}")[0],oldTest.split('let chromium\n')[0],'Frozen G3.1.1 scope and operations assertions preserved')
function assertions(source){const file=ts.createSourceFile('test.mjs',source,ts.ScriptTarget.Latest,true);const result=[];function visit(node){if(ts.isCallExpression(node)&&node.expression.getText(file).startsWith('assert.'))result.push(node.getText(file));ts.forEachChild(node,visit)}visit(file);return result}
assert.deepEqual(assertions(shared),assertions(oldTest.slice(oldTest.indexOf('let chromium\n'))),'All inherited G3.1.1 browser assertions preserved')
assert.ok(!read(dir+'MedicalAppointments.tsx').includes('history.back'),'Deterministic contextual and legacy back')
assert.ok(!/Solicitudes médicas|solicitudes médicas/.test(read(medicalPath)+read(dir+'MedicalNotifications.tsx')),'Precise appointment-request terminology')
const pure=await build({entryPoints:[dir+'KawMedShellReturn.ts'],bundle:true,write:false,platform:'node',format:'esm',define:{'import.meta.env':JSON.stringify({MODE:'preview'})}})
const {getKawMedShellReturn:parse,kawMedContextUrl:url,kawMedReturnTarget:back,kawMedLegacyReturn:legacy,isKawMedContextHost:host}=await import('data:text/javascript;base64,'+Buffer.from(pure.outputFiles[0].text).toString('base64'))
const context={account:'doctor-a',tab:'profile',module:'schedule',query:'Horarios',group:'Perfil médico',focus:'schedule',filter:'confirmed'}
const linked=url('/admin/medical/agenda',context,{section:'availability'})
assert.deepEqual(parse(new URL('https://fixture'+linked).search,'/admin/medical/agenda',true),{...context,viaRequests:false})
for(const [key,value] of [['med_account','../other'],['med_tab','legacy'],['med_module','credentials'],['med_q','x'.repeat(161)],['med_group','x'.repeat(81)],['med_filter','all'],['scope','sponsor_master']]){const p=new URLSearchParams(linked.split('?')[1]);p.set(key,value);assert.equal(parse('?'+p,'/admin/medical/agenda',true),null,'Reject forged context '+key)}
assert.equal(parse(linked.split('?')[1],'/admin/medical/demo/i-test/agenda',true),null)
assert.equal(parse(linked.split('?')[1],'/admin/medical/agenda',false),null)
assert.equal(host('production','app.preview.intaprd.com'),false);assert.equal(host('preview','stage.pages.dev'),false)
assert.ok(back({...context,viaRequests:true}).startsWith('/admin/medical/notifications?'))
assert.equal(legacy('/admin/medical/demo/i-fixture/agenda',''),'/admin/medical/demo/i-fixture')
assert.equal(legacy('/admin/medical/agenda','?scope=sponsor_master'),'/admin/sponsor/kawmed?tab=profile')
assert.equal(legacy('/admin/medical/agenda',''),'/admin/medical')
console.log('PASS U01–U09 static/pure: bounded account context, exact host/role isolation, deterministic fallbacks, unchanged mutations/guards, cumulative assertions, scoped successor')
if(!process.argv.includes('--browser'))process.exit(0)

const {runG32Browser}=await import('./lib/kawmed-g3-2-browser.mjs');await runG32Browser()
