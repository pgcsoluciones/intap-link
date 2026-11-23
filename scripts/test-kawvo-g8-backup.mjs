// Offline synthetic fixtures only. No credentials, Cloudflare requests or production files.
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,readdirSync,chmodSync,symlinkSync,unlinkSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {captureAllowed,captureBackup,verifyBackup,readG85,redactSecretBindings,main,BASE} from './prepare-kawvo-g8-backup.mjs'
import {allowedRequest,Reader} from './inspect-kawvo-g8-readonly.mjs'

process.umask(0o077)
const home=mkdtempSync(join(tmpdir(),'g8-backup-fixture-')),account='a'.repeat(32),version='11111111-1111-1111-1111-111111111111',appId='22222222-2222-2222-2222-222222222222',webId='33333333-3333-3333-3333-333333333333'
const native={id:version,main_module:'worker.mjs',compatibility_date:'2024-02-08',compatibility_flags:['nodejs_compat'],bindings:[{name:'ENVIRONMENT',type:'plain_text',text:'production'},{name:'DB',type:'d1',id:'44444444-4444-4444-4444-444444444444'},{name:'BUCKET',type:'r2_bucket',bucket_name:'fixture-production-bucket'},{name:'SENSITIVE_PLAIN',type:'plain_text',text:'private-plain-fixture'},{name:'SECRET',type:'secret_text',text:'secret-must-never-export'}],modules:[{name:'worker.mjs',content_type:'application/javascript+module',content_base64:Buffer.from('export default {fetch(){return new Response("fixture")}}').toString('base64')},{name:'nested/module with acénto.wasm',content_type:'application/wasm',content_base64:Buffer.from([0,97,115,109]).toString('base64')}]}
const deployment=project=>({id:project==='intap-web2'?appId:webId,environment:'production',url:'https://abcdef12.'+project+'.pages.dev',latest_stage:{status:'success'},uses_functions:true,deployment_trigger:{metadata:{branch:'main',commit_hash:'e'.repeat(40)}}})
const report={task:'KAW-G8-004',inspectorHead:BASE,remoteWrites:0,cloudflare:{schemaStatus:'PASS',workers:{'intap-api':{status:'PASS',environment:'production',version}},pages:Object.fromEntries(['intap-web2','intap-link'].map(p=>[p,{production:{id:deployment(p).id}}]))}}
const auditRoot=join(home,'intap-release-logs');mkdirSync(auditRoot);const auditFolder=join(auditRoot,'kawvo-g8-readonly-fixture');mkdirSync(auditFolder);writeFileSync(join(auditFolder,'report.json'),JSON.stringify(report),{mode:0o600})
const audit=readG85(auditRoot);assert.equal(audit.report.cloudflare.schemaStatus,'PASS')
assert.throws(()=>readG85(home),/completed G8.5 report/)
assert.deepEqual(redactSecretBindings({binding:{type:'secret_text',name:'SECRET',value:'raw'}}),{binding:{type:'secret_text',name:'SECRET',valueNotExported:true}})
assert.equal(allowedRequest('GET','/accounts/'+account+'/workers/domains'),true);assert.equal(allowedRequest('POST','/accounts/'+account+'/workers/domains'),false)
for(const status of [401,403]){const denied=new Reader({account,authorization:'Bearer synthetic-private-fixture',fetch:async(_url,options)=>{assert.equal(options.method,'GET');return Response.json({success:false,errors:[{code:10000,message:'private-error-must-not-leak'}]},{status})}});await assert.rejects(()=>denied.get('/accounts/'+account+'/workers/scripts/intap-api/settings'),e=>e.message.includes('HTTP '+status)&&!e.message.includes('private-error'))}
for(const path of ['/accounts/'+account+'/d1/database/'+version+'/query','/accounts/'+account+'/workers/scripts/intap-api/secrets','/accounts/'+account+'/workers/scripts/intap-api-preview/deployments','/accounts/'+account+'/pages/projects/intap-link/deployments/'+webId+'/rollback','/accounts/'+account+'/workers/workers/intap-api/versions?deploy=false'])assert.equal(captureAllowed(path,account),false)
console.log('PASS prior evidence reused locally; capture GET allowlist excludes D1, secrets, Preview, uploads and restore endpoints')

function fixture({drift=false,denyWeb=false,denySettings=false,wrongEnvironment=false,pagesPreview=false}={}){
 const calls=[],folder=mkdtempSync(join(home,'capture-'));let activeReads=0
 const reader={account,async get(path){calls.push({method:'GET',path});assert.ok(captureAllowed(path,account));
  if(path.endsWith('/workers/scripts/intap-api/deployments'))return {deployments:[{versions:[{version_id:drift&&activeReads++>0?appId:version,percentage:100}]}],latest_uploaded_version_id:'ffffffff-ffff-ffff-ffff-ffffffffffff'}
  if(path.includes('/workers/workers/intap-api/versions/')){assert.ok(path.includes(version));const v=structuredClone(native);if(wrongEnvironment)v.bindings[0].text='preview';return v}
  if(path.endsWith('/settings')){if(denySettings)throw Error('private-error-must-not-leak');return {bindings:native.bindings,observability:{enabled:true}}}
  if(path.endsWith('/schedules'))return {schedules:[{cron:'17 * * * *'}]}
  if(path==='/zones?name=intaprd.com')return [{id:'b'.repeat(32)}]
  if(path.endsWith('/workers/routes'))return [{script:'intap-api',pattern:'api.intaprd.com/*'},{script:'intap-api-preview',pattern:'preview.intaprd.com/*'}]
  if(path.endsWith('/workers/domains'))return [{service:'intap-api',environment:'production',hostname:'api.intaprd.com'},{service:'intap-api-preview',environment:'production',hostname:'api-preview.intaprd.com'}]
  if(path.includes('/pages/projects/')){
   const project=path.includes('intap-web2')?'intap-web2':'intap-link';if(denyWeb&&project==='intap-link')throw Error('private-error-must-not-leak')
   const d=deployment(project);if(pagesPreview)d.environment='preview'
   if(path.includes('/deployments/'))return d
   return {name:project,production_branch:'main',canonical_deployment:{id:d.id},deployment_configs:{production:{env_vars:{SECRET:{type:'secret_text',value:'secret-must-never-export'}}}}}
  }
  throw Error('Unexpected fixture URL')
 }}
 const publicFetch=async(url,options)=>{calls.push({method:options.method,url});assert.equal(options.method,'GET');assert.equal(options.headers,undefined);const u=new URL(url);assert.ok(['/','/admin/login','/assets/index-fixture.js','/assets/index-fixture.css'].includes(u.pathname));return new Response(u.pathname.startsWith('/assets/')?'fixture-public-asset':'<script src="/assets/index-fixture.js"></script><link href="/assets/index-fixture.css">')}
 return {folder,calls,run:()=>captureBackup({reader,audit,folder,head:BASE,publicFetch})}
}
const f=fixture(),result=await f.run();assert.equal(result.integrity,'PASS');assert.equal(result.API,'PASS');assert.equal(result.App,'BLOCKED');assert.equal(result.Web,'BLOCKED');assert.equal(result.recovery,'BLOCKED');assert.equal(result.remoteWrites,0)
assert.deepEqual(result.recoveryByLayer,{API:'BLOCKED',App:'BLOCKED',Web:'BLOCKED'},'Capture integrity must not be presented as recovery approval for any layer')
const manifest=JSON.parse(readFileSync(join(f.folder,'manifest.private.json'),'utf8'));assert.equal(manifest.layers.API.modules.length,2);assert.equal(manifest.layers.API.version,version);assert.equal(manifest.layers.App.usesFunctions,true);assert.equal(manifest.layers.App.fullLocalArtifact,'BLOCKED');assert.equal(manifest.layers.Web.compiledFunctionsBackup,'BLOCKED');assert.ok(f.calls.every(c=>c.method==='GET'));assert.ok(f.calls.every(c=>!String(c.path||'').includes('/d1/')))
assert.deepEqual(JSON.parse(readFileSync(join(f.folder,'api/domains.private.json'),'utf8')).map(d=>d.hostname),['api.intaprd.com'])
for(const row of manifest.files)assert.ok(!readFileSync(join(f.folder,row.path)).includes('secret-must-never-export'),'Secret binding value must not enter any saved artifact')
assert.ok(!JSON.stringify(result).includes('private-plain-fixture'),'Private configuration never printed in safe summary')
assert.equal(JSON.parse(readFileSync(join(f.folder,'rollback-plan.private.json'),'utf8')).executable,false)
const count=f.calls.length;verifyBackup(f.folder);assert.equal(f.calls.length,count,'Offline verification must not use Cloudflare')
console.log('PASS private native module/config capture, secret value omission, retained active ID (not latest), Pages Functions limitations, entry byte comparison and GET-only call ledger')

const modulePath=join(f.folder,manifest.layers.API.modules[0].file),original=readFileSync(modulePath)
writeFileSync(modulePath,'corrupt');assert.throws(()=>verifyBackup(f.folder),/hash mismatch/);writeFileSync(modulePath,original)
unlinkSync(modulePath);assert.throws(()=>verifyBackup(f.folder));writeFileSync(modulePath,original,{mode:0o600})
chmodSync(modulePath,0o644);assert.throws(()=>verifyBackup(f.folder),/permissions/);chmodSync(modulePath,0o600)
const extra=join(f.folder,'unexpected');writeFileSync(extra,'x');assert.throws(()=>verifyBackup(f.folder),/unexpected\/unhashed/);unlinkSync(extra)
symlinkSync(modulePath,extra);assert.throws(()=>verifyBackup(f.folder),/symlink/);unlinkSync(extra)
const check=join(f.folder,'manifest.sha256'),checksum=readFileSync(check);writeFileSync(check,'0'.repeat(64));assert.throws(()=>verifyBackup(f.folder),/checksum/);writeFileSync(check,checksum)
assert.equal(verifyBackup(f.folder).integrity,'PASS')
console.log('PASS offline integrity rejects changed bytes, insecure modes, unexpected files, symlinks and changed manifest checksum')

const partial=fixture({denyWeb:true}),p=await partial.run();assert.equal(p.Web,'BLOCKED');assert.equal(p.integrity,'PASS','Only files actually captured are integrity-checked');assert.equal(p.recovery,'BLOCKED');assert.ok(!readFileSync(join(partial.folder,'manifest.private.json'),'utf8').includes('private-error-must-not-leak'))
await assert.rejects(fixture({drift:true}).run,/traffic drift/)
const deniedConfig=fixture({denySettings:true}),denied=await deniedConfig.run();assert.equal(denied.API,'BLOCKED');assert.equal(denied.integrity,'PASS');const deniedManifest=readFileSync(join(deniedConfig.folder,'manifest.private.json'),'utf8');assert.ok(deniedManifest.includes('/settings')&&deniedManifest.includes('raw error omitted')&&!deniedManifest.includes('private-error'));assert.ok(deniedConfig.calls.some(x=>x.path?.includes('/pages/projects/')),'A denied config read must not prevent independent Pages capture')
await assert.rejects(fixture({wrongEnvironment:true}).run,/environment/)
const badPage=fixture({pagesPreview:true}),b=await badPage.run();assert.equal(b.App,'BLOCKED');assert.equal(b.Web,'BLOCKED')
for(const mode of ['--restore','--deploy','--upload','--activate'])await assert.rejects(()=>main([mode]),/unsupported mode/)
await assert.rejects(()=>main(['--capture','--sha',BASE],{platform:'linux'}),/Mac-only/)
await assert.rejects(()=>main(['--capture','--sha','0'.repeat(40)],{platform:'darwin'}),/SHA mismatch or dirty/)
console.log('PASS drift, denied reads, wrong environment and Preview rollback target fail closed; mutation modes unavailable; real captures Mac-only')
