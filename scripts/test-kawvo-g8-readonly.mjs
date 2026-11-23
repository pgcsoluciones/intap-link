// Metadata fixtures and mocked HTTP only. No Cloudflare/GitHub credentials or remote requests.
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {build} from 'esbuild'
import {BASE,EXPECTED,SCHEMA_QUERIES,allowedRequest,Reader,versionSummary,compareSchema,collectCloudflare,localAudit,discoverArtifacts,comparePublicArtifact,main} from './inspect-kawvo-g8-readonly.mjs'
const dir=mkdtempSync(join(tmpdir(),'g8-readonly-test-')),db=join(dir,'metadata.sqlite'),account='a'.repeat(32),dbPreview='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',dbProd='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const idPreview='cccccccc-cccc-cccc-cccc-cccccccccccc',idProd='dddddddd-dddd-dddd-dddd-dddddddddddd'
execFileSync('python3',['-c',`import sqlite3,sys
c=sqlite3.connect(sys.argv[1]);c.executescript('CREATE TABLE sponsor_tenants(id TEXT PRIMARY KEY);CREATE TABLE intap_artifacts(id TEXT PRIMARY KEY);CREATE TABLE medical_access_codes(id TEXT PRIMARY KEY);');c.executescript(sys.stdin.read());c.commit()`,db],{input:['0153_sponsor_sales_representatives.sql','0154_artifact_display_identifiers.sql'].map(n=>readFileSync('docs/releases/kawvo-g8-proposed-migrations/'+n,'utf8')).join('\n')})
const rows=sql=>JSON.parse(execFileSync('python3',['-c',`import sqlite3,json,sys
c=sqlite3.connect(sys.argv[1]);c.row_factory=sqlite3.Row;print(json.dumps([dict(x) for x in c.execute(sys.argv[2])]))`,db,sql],{encoding:'utf8'}))
const actual=SCHEMA_QUERIES.map(rows);assert.equal(compareSchema(actual).status,'PASS')
for(const [table,expected] of Object.entries(EXPECTED))assert.equal(actual[0].find(t=>t.name===table).sql,expected.sql,'Embedded expectation is exact documented SQLite schema')
for(const kind of ['missing-table','column-type','notnull','default','pk','index','index-order','unique','foreign-key','check']){
 const copy=structuredClone(actual)
 if(kind==='missing-table')copy[0].pop()
 if(kind==='column-type')copy[1][0].type='BLOB'
 if(kind==='notnull')copy[1][0].notnull=1-copy[1][0].notnull
 if(kind==='default')copy[1][0].dflt_value="'different'"
 if(kind==='pk')copy[1][0].pk=1-copy[1][0].pk
 if(kind==='index')copy[2]=copy[2].filter(i=>i.name!=='idx_sponsor_sales_assignment_lookup')
 if(kind==='index-order')copy[2].filter(i=>i.name==='idx_sponsor_sales_assignment_lookup').reverse().forEach((i,n)=>i.column_name='wrong-'+n)
 if(kind==='unique')copy[2].forEach(i=>i.unique=0)
 if(kind==='foreign-key')copy[3].forEach(f=>f.on_delete='NO ACTION')
 if(kind==='check')copy[0].forEach(t=>t.sql=t.sql.replaceAll("'M'","'m'"))
 assert.equal(compareSchema(copy).status,'FAIL',kind+' must fail without mutations')
}
console.log('PASS schema: five documented tables, columns/types/defaults/PK, four named indexes, unique keys, FK and CHECK; ten negative controls')
const queryPath='/accounts/'+account+'/d1/database/'+dbPreview+'/query'
assert.ok(allowedRequest('POST',queryPath,SCHEMA_QUERIES[0]))
for(const [method,path,sql] of [['POST','/accounts/'+account+'/workers/scripts/intap-api-preview/deployments'],['DELETE',queryPath],['PATCH',queryPath],['POST',queryPath,'SELECT * FROM users'],['POST',queryPath,SCHEMA_QUERIES[0]+';DELETE FROM users'],['POST',queryPath,'PRAGMA writable_schema=ON'],['GET','/accounts/'+account+'/workers/scripts/intap-api/secrets'],['GET','/accounts/'+account+'/pages/projects/another-project'],['GET','/accounts/'+account+'/workers/scripts/another-worker/deployments']])assert.equal(allowedRequest(method,path,sql),false)
let requests=0
const client=new Reader({account,authorization:'Bearer private-fixture',fetch:async(_url,options)=>{requests++;assert.equal(options.method,'POST');const q=JSON.parse(options.body).sql;assert.ok(SCHEMA_QUERIES.includes(q));return Response.json({success:true,result:[{success:true,results:rows(q),meta:{rows_written:0,changes:0,changed_db:false}}]})}})
assert.equal((await client.schema(dbPreview)).status,'PASS');assert.equal(requests,4)
await assert.rejects(()=>client.request('POST','/accounts/'+account+'/workers/scripts/intap-api/deployments'),/allowlist/);assert.equal(requests,4)
const bad=new Reader({account,authorization:'fixture',fetch:async()=>Response.json({success:true,result:[{success:true,results:[],meta:{rows_written:1}}]})});await assert.rejects(()=>bad.schema(dbPreview),/reported a write/)
for(const status of [401,403]){const error=new Reader({account,authorization:'private-fixture',fetch:async()=>Response.json({success:false,errors:[{code:10000,message:'private-fixture'}]},{status})});await assert.rejects(()=>error.get('/accounts/'+account+'/workers/scripts/intap-api/deployments'),e=>e.message.includes('HTTP '+status)&&!e.message.includes('private-fixture'))}
console.log('PASS transport: no deployment/activation/secret endpoints; only fixed D1 metadata SELECT POST; errors sanitized and no retries')
const version=preview=>({id:preview?idPreview:idProd,main_module:'worker.js',modules:[{name:'worker.js',content_type:'application/javascript+module',content_base64:Buffer.from('private-source-fixture').toString('base64')}],compatibility_date:'2024-02-08',bindings:[{name:'ENVIRONMENT',type:'plain_text',text:preview?'preview':'production'},{name:'DB',type:'d1',id:preview?dbPreview:dbProd},{name:'BUCKET',type:'r2_bucket',bucket_name:'fixture-bucket'},{name:'SECRET',type:'secret_text',text:'do-not-copy-private-secret'},{name:'PRIVATE_PLAIN',type:'plain_text',text:'do-not-copy-private-plain'},{name:'APP_PAGES_ORIGIN',type:'plain_text',text:'https://abcdef12.intap-web2.pages.dev'},{name:'WEB_PAGES_ORIGIN',type:'plain_text',text:'https://fedcba98.intap-link.pages.dev'},...Array.from({length:preview?28:25},(_,i)=>({name:'ITEM_'+i,type:'plain_text',text:'do-not-copy-private-extra'}))]})
const projection=JSON.stringify(versionSummary(version(true),'intap-api-preview'));assert.ok(!projection.includes('do-not-copy'));assert.ok(!projection.includes('private-source-fixture'));assert.ok(!projection.includes(Buffer.from('private-source-fixture').toString('base64')))
assert.equal(versionSummary(version(true),'intap-api-preview').bindingCount,35);assert.equal(versionSummary(version(false),'intap-api').bindingCount,32)
await assert.rejects(async()=>versionSummary({...version(true),modules:[]},'intap-api-preview'),/module bytes unavailable/)
const calls=[];let drift=false
const cf=new Reader({account,authorization:'private-fixture',fetch:async(url,options)=>{
 const p=new URL(url).pathname+new URL(url).search;calls.push({method:options.method,path:p})
 if(options.method==='POST'){const q=JSON.parse(options.body).sql;return Response.json({success:true,result:[{success:true,results:rows(q),meta:{rows_written:0}}]})}
 let result
 if(p.endsWith('/deployments')){const preview=p.includes('intap-api-preview');result={deployments:[{versions:[{version_id:preview?idPreview:idProd,percentage:100}]}]}}
 else if(p.includes('/versions/'))result=version(p.includes('intap-api-preview'))
 else throw Error('Unexpected mock URL')
 return Response.json({success:true,result})
}})
const collected=await collectCloudflare(cf,{inventory:false});assert.equal(collected.schemaStatus,'PASS');assert.equal(calls.filter(c=>c.method==='POST').length,8);assert.equal(collected.decision,'NO-GO');assert.equal(collected.workers['intap-api-preview'].activeUnchangedDuringRead,true);assert.ok(!JSON.stringify(collected).includes('do-not-copy'))
let unexpectedPosts=0
const writeReported=new Reader({account,authorization:'fixture',fetch:async(url,options)=>{
 if(options.method==='POST'){unexpectedPosts++;return Response.json({success:true,result:[{success:true,results:[],meta:{rows_written:1}}]})}
 const preview=url.includes('intap-api-preview');return Response.json({success:true,result:url.endsWith('/deployments')?{deployments:[{versions:[{version_id:preview?idPreview:idProd,percentage:100}]}]}:version(preview)})
}})
await assert.rejects(()=>collectCloudflare(writeReported),e=>e.fatalReadOnlyViolation===true);assert.equal(unexpectedPosts,1,'Stop whole collection immediately if D1 reports an unexpected write')
// Full inventory: safe Pages projections, Functions limitations, routes and entry-byte fingerprints.
const fullCalls=[];let previewTrafficReads=0
const fullReader=new Reader({account,authorization:'private-fixture',fetch:async(url,options)=>{
 const u=new URL(url),p=u.pathname.replace(/^\/client\/v4/,'');fullCalls.push(options.method)
 let result
 if(p.includes('/workers/')&&p.endsWith('/deployments')){const preview=p.includes('intap-api-preview');if(preview)previewTrafficReads++;result={deployments:[{versions:[{version_id:preview?idPreview:idProd,percentage:100}]}]}}
 else if(p.includes('/versions/'))result=version(p.includes('intap-api-preview'))
 else if(p.endsWith('/settings'))result={bindings:version(true).bindings,logpush:false,observability:{enabled:true},secret:'do-not-copy-settings'}
 else if(p.endsWith('/schedules'))result={schedules:[{cron:'0 0 * * *'}]}
 else if(p==='/zones')result=[{id:'b'.repeat(32)}]
 else if(p.endsWith('/workers/routes'))result=[{script:'intap-api',pattern:'intaprd.com/api/*'},{script:'another-worker',pattern:'other.example/*'}]
 else if(/\/pages\/projects\/[^/]+$/.test(p))result={name:p.split('/').pop(),production_branch:'main',source:{config:{production_deployments_enabled:false,preview_deployment_setting:'all',secret:'do-not-copy-project-config'}},canonical_deployment:{id:idProd},build_config:{build_command:'do-not-copy-command'}}
 else if(p.includes('/pages/projects/')){
  const project=p.includes('intap-web2')?'intap-web2':'intap-link',preview=p.endsWith(idPreview)||u.search.includes('env=preview'),id=preview?idPreview:idProd
  const d={id,url:'https://'+(project==='intap-web2'?'abcdef12':'fedcba98')+'.'+project+'.pages.dev',environment:preview?'preview':'production',latest_stage:{status:'success'},uses_functions:true,deployment_trigger:{metadata:{branch:preview?'qa-current':'main',commit_hash:'e'.repeat(40)}},aliases:[],deployment_configs:{secret:'do-not-copy-deployment-config'}}
  result=u.search.includes('env=preview')?[{...d,id:idPreview}]:d
 }else throw Error('Unexpected mocked full inventory URL')
 return Response.json({success:true,result})
}})
const full=await collectCloudflare(fullReader,{schemas:false,publicFetch:async(_url,options)=>{assert.equal(options.method,'GET');assert.equal(options.headers,undefined,'Never send credentials to public asset hosts');return new Response(_url.includes('/assets/')?'synthetic public asset':'<script src="/assets/index-fixture.js"></script>')}})
assert.ok(full.pages['intap-web2'].production,JSON.stringify(full.pages));assert.ok(fullCalls.every(method=>method==='GET'));assert.equal(previewTrafficReads,2);assert.equal(full.pages['intap-web2'].production.usesFunctions,true);assert.equal(full.pages['intap-web2'].productionAutoDeploy,false);assert.equal(full.pages['intap-web2'].production.public.completeArtifact,false);assert.equal(full.routes.length,1);assert.ok(!JSON.stringify(full).includes('do-not-copy'));assert.ok(full.rollbackStatus.startsWith('BLOCKED'))
console.log('PASS full inventory mock: GET only, both active versions stable, Pages/Functions/config projected without secrets, partial entry fingerprints never certify complete rollback')
const artifactHome=join(dir,'home'),artifactFolder=join(artifactHome,'intap-release-logs/g7-1-search-shared-f42bccf2b824/source/app/dist');mkdirSync(artifactFolder,{recursive:true})
for(const [name,content] of Object.entries({'index.html':'fixture app','_headers':'fixture headers','_redirects':'/* /index.html 200','_routes.json':'{"version":1}','espacio y acénto.js':'fixture asset'}))writeFileSync(join(artifactFolder,name),content)
const artifacts=discoverArtifacts({home:artifactHome}),candidate=artifacts.find(a=>a.status==='PASS');assert.ok(candidate);assert.equal(candidate.functionsBundleSha256,null)
const assetCalls=[];const artifactComparison=await comparePublicArtifact(candidate,{commit:candidate.source,url:'https://abcdef12.intap-web2.pages.dev'},async(url,options)=>{assetCalls.push(url);assert.equal(options.method,'GET');const name=decodeURIComponent(new URL(url).pathname.slice(1));return new Response(readFileSync(join(artifactFolder,name==='admin/login'?'index.html':name)))})
assert.equal(artifactComparison.publicFilesVerified,2);assert.equal(artifactComparison.controlFilesRetained.length,3);assert.ok(assetCalls.some(u=>u.includes('espacio%20y%20ac%C3%A9nto.js')));assert.ok(assetCalls.every(u=>!u.includes('_routes')&&!u.includes('_headers')&&!u.includes('_redirects')));assert.equal(artifactComparison.completeRollbackReady,false)
await assert.rejects(()=>comparePublicArtifact(candidate,{commit:'0'.repeat(40),url:'https://abcdef12.intap-web2.pages.dev'}),/source\/Pages commit differ/)
const privateContext=join(artifactFolder,'../../functions');mkdirSync(privateContext,{recursive:true});writeFileSync(join(privateContext,'.dev.vars'),'synthetic-private-fixture')
assert.throws(()=>discoverArtifacts({home:artifactHome}),/private file in Functions context; stop without hashing/)
console.log('PASS artifact recovery inventory: known folders only, no rebuild/copy; preserve control files, encode spaces/accents, verify all public bytes, never claim compiled Functions rollback')
const shared=new Reader({account,authorization:'fixture',fetch:async url=>{const preview=url.includes('intap-api-preview');return Response.json({success:true,result:url.endsWith('/deployments')?{deployments:[{versions:[{version_id:preview?idPreview:idProd,percentage:100}]}]}:{...version(preview),bindings:version(preview).bindings.map(b=>b.name==='DB'?{...b,id:dbPreview}:b)}})}})
await assert.rejects(()=>collectCloudflare(shared,{inventory:false}),/share DB ID/)
const audit=localAudit(process.cwd());assert.equal(audit.guards.length,6);assert.ok(audit.guards.every(g=>g.evidence.length));assert.ok(audit.issue134.sourceReconciled&&audit.issue134.editingRequiresActive)
for(const args of [['--deploy'],['--activate'],['--local','--cloudflare']])await assert.rejects(()=>main(args),/no mutation mode/)
console.log('PASS inventory: active IDs, 35 Preview/32 fixture Prod bindings, secret and code values omitted; DB separation before SELECT; NO-GO retained')

// Execute pure existing gates, never mount or activate an interface.
for(const [file,fn,context] of [
 ['medical/kawmed-shell-navigation.ts','canUseKawMedShell',{pathname:'/admin/medical',search:'?kawvo_med_shell=1',scope:'doctor',delegated:false,profileId:'fixture',guestEditor:false}],
 ['medical/kawmed-guest-shell-navigation.ts','canUseKawMedDelegateShell',{pathname:'/admin/medical/demo/i-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',search:'?kawvo_med_shell=1',scope:'doctor',assignedId:'fixture',verifiedId:'fixture',profileId:'fixture'}],
 ['medical/kawmed-master-shell-navigation.ts','isKawMedMasterShellRequest',{pathname:'/admin/sponsor/kawmed',search:''}],
 ['sponsored/sponsored-shell-gate.ts','shouldShowSponsoredShell',{search:'?kawvo_sponsored_shell=1',isMaster:false,legacyPanel:false,profileId:'fixture'}],
 ['sponsored/sponsor-shell-navigation.ts','canUseSponsorShell',{search:'',tenant:{id:'fixture',role:'owner'},active:{kind:'sponsor',id:'fixture'}}]
]){
 const built=await build({entryPoints:['app/src/components/admin/'+file],bundle:true,write:false,platform:'node',format:'esm',logLevel:'silent'}),mod=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'))
 assert.equal(mod[fn]({...context,mode:'preview',hostname:'app.preview.intaprd.com'}),true,file)
 assert.equal(mod[fn]({...context,mode:'production',hostname:'app.intaprd.com'}),false,file)
 assert.equal(mod[fn]({...context,mode:'preview',hostname:'app.intaprd.com'}),false,file)
}
console.log('PASS pure source activation matrix: Preview allowed only with existing guards; Production false; zero interfaces activated')
const matrix=JSON.parse(readFileSync('docs/releases/KAWVO_G8_BLOCKER_MATRIX.json','utf8'));assert.equal(matrix.contractClassification.length,12)
for(const row of matrix.contractClassification)assert.deepEqual(readFileSync(row.file),execFileSync('git',['show',BASE+':'+row.file]),'Never alter any of the twelve failing assertions')
assert.equal(matrix.contractClassification.filter(r=>r.classification==='incompatibilidad de alcance').length,9);assert.equal(matrix.contractClassification.filter(r=>r.classification==='legado confirmado').length,3)
console.log('PASS classification provenance: all 12 historical failing scripts unchanged; 9 phase-scope incompatibilities and 3 confirmed legacy expectations; #134 race is a separately reproduced existing defect')
