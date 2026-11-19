import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {build} from 'esbuild'
const base='8ef347ce7a09d43953a725bcb2d8fec5102390d8',read=p=>readFileSync(p,'utf8'),prior=p=>execFileSync('git',['show',base+':'+p],{encoding:'utf8'})
const bar='web/src/components/appointments/AppointmentOwnerBar.tsx',profile='web/src/components/medical-profile/KawMedProfile.tsx',helper='web/src/components/appointments/kawmedOwnerShellLinks.ts',suite='scripts/lib/kawmed-g3-2-browser.mjs'
const allowed=[bar,profile,helper,suite,'scripts/test-kawmed-g3-2-public-return-contract.mjs','docs/architecture/KAWVO_KAWMED_G3_LOT_2_PUBLIC_RETURN.md'].sort()
const delta=[...new Set([...execFileSync('git',['diff','--name-only',base],{encoding:'utf8'}).trim().split('\n'),...execFileSync('git',['ls-files','--others','--exclude-standard'],{encoding:'utf8'}).trim().split('\n')].filter(Boolean))].sort()
assert.deepEqual(delta,allowed,'Exact six-file public-owner return correction; App, backend, runners and infrastructure unchanged')
assert.equal(read(profile).replace('        medicalProfileId={profile.id}\n',''),prior(profile),'No patient interface, data, share, canonical or SEO changes')
assert.equal(read(bar).slice(read(bar).indexOf('  return <div className=')),prior(bar).slice(prior(bar).indexOf('  return <div className=')),'Owner/patient markup unchanged; only administrative destinations differ')
const require=createRequire(import.meta.url),ts=require('typescript')
function functions(source){const file=ts.createSourceFile('fixture.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),found=new Map();function visit(n){if(ts.isFunctionDeclaration(n)&&n.name)found.set(n.name.text,n.getText(file));ts.forEachChild(n,visit)}visit(file);return found}
for(const name of ['load','act'])assert.equal(functions(read(bar)).get(name),functions(prior(bar)).get(name),'Existing authorization read and request actions unchanged: '+name)
function calls(source,predicate){const file=ts.createSourceFile('fixture.mjs',source,ts.ScriptTarget.Latest,true),found=[];function visit(n){if(ts.isCallExpression(n)&&predicate(n.expression.getText(file)))found.push(n.getText(file));ts.forEachChild(n,visit)}visit(file);return found}
const scenarios=calls(read(suite),name=>name==='scenario')
for(const scenario of calls(prior(suite),name=>name==='scenario'))assert.ok(scenarios.includes(scenario),'Every original G3.2 scenario retained verbatim')
assert.equal(read('scripts/lib/kawvo-g3-1-1-browser.mjs'),prior('scripts/lib/kawvo-g3-1-1-browser.mjs'),'All G3.1.1 scenarios unchanged')
assert.equal(read('scripts/test-kawmed-g3-2-navigation-contract.mjs'),prior('scripts/test-kawmed-g3-2-navigation-contract.mjs'),'Frozen G3.2 scope and static checks not relaxed')
async function compile(path){const result=await build({entryPoints:[path],bundle:true,write:false,platform:'node',format:'esm',define:{'import.meta.env':JSON.stringify({MODE:'preview'})}});return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'))}
const {kawMedOwnerShellLinks:links}=await compile(helper)
const {getKawMedShellReturn:parse}=await compile('app/src/components/admin/medical/KawMedShellReturn.ts')
const owner={mode:'preview',hostname:'preview.intaprd.com',origin:'https://app.preview.intaprd.com',profileId:'doctor-a',context:{is_owner:true,is_master:false,is_guest_editor:false,settings_url:'/admin/medical',manage_url:'/admin/medical/agenda',action_scope:null}}
const result=links(owner)
for(const [name,tab]of[['settings','profile'],['agenda','agenda']]){const target=new URL(result[name]);assert.equal(target.origin,owner.origin);assert.equal(target.pathname,'/admin/medical');assert.deepEqual(parse(target.search,target.pathname,true),{account:'doctor-a',tab,query:'',group:'',viaRequests:false,filter:'pending'})}
for(const override of [{mode:'production'},{hostname:'intaprd.com'},{hostname:'qa.pages.dev'},{origin:'https://app.intaprd.com'},{origin:'https://app.preview.intaprd.com.evil.test'},{profileId:undefined},{profileId:'../other'}])assert.equal(links({...owner,...override}),null)
for(const context of [{is_owner:false},{is_master:true},{is_master:undefined},{is_guest_editor:true},{is_guest_editor:undefined},{action_scope:'sponsor_master'},{settings_url:'/admin/sponsor/kawmed?tab=profile'},{settings_url:'/admin/free'},{manage_url:'/admin/medical/agenda?scope=sponsor_master'},{manage_url:'/admin/medical/demo/i-test/agenda'}])assert.equal(links({...owner,context:{...owner.context,...context}}),null,'Never extend guest/Master/other product navigation')
console.log('PASS public-return scope/pure: exact destinations interoperate with unchanged App codec; Preview doctor gates; no patient markup/auth/account mutation; original cumulative scenarios preserved')
if(process.argv.includes('--browser')){const{runG32Browser}=await import('./lib/kawmed-g3-2-browser.mjs');await runG32Browser()}
