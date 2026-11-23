import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,statSync,existsSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {pathToFileURL} from 'node:url'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {ACTIVE,CANDIDATE,CREATE,authenticate,authenticationPreflight,main,payload,uploadStage,validateSnapshot} from './stage-kawvo-g7-api-pinned.mjs'
// Reproduce the exact pinned #171 reader, using only synthetic sessions/HTTP.
const readerFolder=mkdtempSync(join(tmpdir(),'g7-auth-reader-'))
for(const name of ['kawmed-g3-1-pages.mjs','run-kawmed-g3-1-stage-preview-2026-11-16.sh'])writeFileSync(join(readerFolder,name),execFileSync('git',['show','fefa9180edd3c13f4548b835d2436b72eb2b96b6:scripts/'+name]))
const {Runner}=await import(pathToFileURL(join(readerFolder,'kawmed-g3-1-pages.mjs')).href)
const savedToken=process.env.CLOUDFLARE_API_TOKEN,savedAccount=process.env.CLOUDFLARE_ACCOUNT_ID
try{
 delete process.env.CLOUDFLARE_API_TOKEN;delete process.env.CLOUDFLARE_ACCOUNT_ID
 const home=mkdtempSync(join(tmpdir(),'g7-auth-session-')),config=join(home,'.wrangler/config/default.toml'),root=join(home,'checkout'),account='a'.repeat(32)
 mkdirSync(join(home,'.wrangler/config'),{recursive:true});mkdirSync(join(root,'node_modules/.bin'),{recursive:true});writeFileSync(join(root,'node_modules/.bin/wrangler'),'fixture-only')
 let calls=0,requests=0
 const exec=(_binary,args)=>{assert.deepEqual(args,['whoami']);calls++;writeFileSync(config,'oauth_token = "fresh-fixture-session"\n');return account}
 const fetch=async(_url,options)=>{requests++;assert.equal(options.method,'GET');if(options.headers.Authorization!=='Bearer fresh-fixture-session')return Response.json({success:false,errors:[{code:10000,message:'Authentication error'}]},{status:401});return Response.json({success:true,result:{deployments:[{id:'fixture-deployment',versions:[{version_id:ACTIVE,percentage:100}]}]}})}
 const reset=()=>writeFileSync(config,'oauth_token = "expired-fixture-session"\n')
 reset();const old=new Runner({root,home,exec,fetch});old.credentials();assert.equal(calls,1);assert.equal(old.headers.Authorization,'Bearer expired-fixture-session');await assert.rejects(()=>authenticationPreflight(old),/HTTP 401.*10000/)
 reset();const fixed=new Runner({root,home,exec,fetch});assert.deepEqual(authenticate(fixed),{sessionReloaded:true});assert.equal(calls,2);assert.equal((await authenticationPreflight(fixed)).id,'fixture-deployment');assert.equal(requests,2)
 assert.deepEqual(authenticate(fixed),{sessionReloaded:false});assert.equal(calls,3)
 process.env.CLOUDFLARE_API_TOKEN='environment-fixture-session';const envClient=new Runner({root,home,exec,fetch});assert.deepEqual(authenticate(envClient),{sessionReloaded:false});assert.equal(envClient.headers.Authorization,'Bearer environment-fixture-session')
 delete process.env.CLOUDFLARE_API_TOKEN
 for(const status of [401,403]){let reads=0;const client=new Runner({root,home,exec,fetch:async(_url,options)=>{reads++;assert.equal(options.method,'GET');return Response.json({success:false,errors:[{code:10000,message:'Authentication error'}]},{status})}});authenticate(client);await assert.rejects(()=>authenticationPreflight(client),e=>e.message.includes('HTTP '+status)&&!e.message.includes('fresh-fixture-session'));assert.equal(reads,1,'no automatic auth/API retry')}
 console.log('PASS exact #171 OAuth rotation regression: old header 401; reread after whoami PASS; env identity preserved; auth-only GET; 401/403 no retries, no upload or secrets')
}finally{
 for(const [key,value] of [['CLOUDFLARE_API_TOKEN',savedToken],['CLOUDFLARE_ACCOUNT_ID',savedAccount]])if(value===undefined)delete process.env[key];else process.env[key]=value
}
const make=()=>({id:ACTIVE,main_module:'original.js',modules:[{name:'original.js',content_type:'application/javascript+module',content_base64:'b3JpZ2luYWw='}],compatibility_date:'2024-02-08',compatibility_flags:[],limits:{cpu_ms:50},placement:{mode:'smart'},cache_options:{enabled:false},exports:{default:{type:'worker',state:'created',cache:{enabled:false}}},bindings:[{name:'ENVIRONMENT',type:'plain_text',text:'preview'},{name:'DB',type:'d1',id:'fixture-only-db'},{name:'BUCKET',type:'r2_bucket',bucket_name:'fixture-only-bucket'},{name:'SECRET_FIXTURE',type:'secret_text',text:'DO_NOT_PRINT_FIXTURE_SECRET'},...Array.from({length:31},(_,i)=>({name:'FIXTURE_'+i,type:'plain_text',text:'value-'+i}))]})
const modules=[{name:'candidate.js',content_type:'application/javascript+module',content_base64:Buffer.from('export default {fetch(){},scheduled(){}}').toString('base64')}]
const fixture=make(),body=payload(fixture,modules)
assert.ok(!('limits' in payload({...fixture,limits:null},modules)))
validateSnapshot({...fixture,assets:{}});assert.throws(()=>validateSnapshot({...fixture,assets:{config:{enabled:true}}}))
assert.equal(payload({...fixture,compatibility_date:'2024-02-08T00:00:00Z'},modules).compatibility_date,'2024-02-08T00:00:00Z')
assert.equal(body.bindings.length,35);assert.ok(body.bindings.every(b=>b.type==='inherit'&&b.version_id===ACTIVE));assert.ok(!JSON.stringify(body).includes('DO_NOT_PRINT_FIXTURE_SECRET'))
for(const key of ['triggers','routes','migrations','env','logpush','observability','tail_consumers'])assert.ok(!(key in body))
for(const bad of [{...fixture,id:'d0f6a4b9-a01b-4900-a904-ec82a5a44d92'},{...fixture,bindings:fixture.bindings.slice(1)},{...fixture,bindings:[...fixture.bindings.slice(1),fixture.bindings[1]]},{...fixture,modules:[]},{...fixture,exports:{Other:{type:'durable-object'}}},{...fixture,migrations:{new_tag:'forbidden'}}])assert.throws(()=>validateSnapshot(bad))
console.log('PASS Stage preparation: pin 35 active bindings, preserve runtime, no secret values or settings/migrations, reject invalid snapshots')
for(const mode of ['success','http-error','timeout','bytes','bindings','runtime','annotation','drift-before','drift-after','auth-error']){
 const directory=mkdtempSync(join(tmpdir(),'g7-stage-simulation-')),version=make(),id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';let posts=0,gets=0,posted
 const client={account:'fixture-account',headers:{Authorization:'Bearer fixture-token'},async api(path){gets++;if(mode==='auth-error')throw Error('Cloudflare GET HTTP 401 códigos=10000');if(path.endsWith('/deployments'))return {result:{deployments:[{id:mode==='drift-after'&&gets>1?'changed':'existing-deployment',versions:[{version_id:mode==='drift-before'?id:ACTIVE,percentage:100}]}]}};assert.equal(path,'/workers/workers/intap-api-preview/versions/'+id+'?include=modules');const uploaded={...version,id,main_module:modules[0].name,modules:structuredClone(modules),annotations:posted.annotations};if(mode==='bytes')uploaded.modules[0].content_base64='YWRkaXRpb25hbA==';if(mode==='bindings')uploaded.bindings=version.bindings.slice(1);if(mode==='runtime')uploaded.compatibility_date='2025-01-01';if(mode==='annotation')uploaded.annotations={};return {result:uploaded}}}
 const request=async(url,options)=>{posts++;assert.equal(url,'https://api.cloudflare.com/client/v4/accounts/fixture-account'+CREATE);assert.equal(options.method,'POST');assert.equal(options.redirect,'error');posted=JSON.parse(options.body);assert.ok(posted.bindings.every(b=>b.version_id===ACTIVE));assert.equal(posted.annotations['workers/tag'],CANDIDATE);if(mode==='timeout')throw Error('fixture timeout');if(mode==='http-error')return Response.json({success:false,errors:[{code:10057,message:'DO_NOT_PRINT_FIXTURE_SECRET'}]},{status:400});return Response.json({success:true,result:{id}})}
 if(mode==='success'){const receipt=await uploadStage({directory,version,modules,client,fetch:request});assert.equal(receipt.result,'PASS');assert.equal(receipt.trafficUnchanged,true);assert.equal(statSync(join(directory,'stage-pass.json')).mode&0o777,0o600)}
 else{await assert.rejects(()=>uploadStage({directory,version,modules,client,fetch:request}),error=>!error.message.includes('DO_NOT_PRINT_FIXTURE_SECRET'));assert.ok(!existsSync(join(directory,'stage-pass.json')))}
 assert.equal(posts,['drift-before','auth-error'].includes(mode)?0:1)
 if(!['drift-before','auth-error'].includes(mode)){await assert.rejects(()=>uploadStage({directory,version,modules,client,fetch:request}),/intento anterior/);assert.equal(posts,1,'No second POST after any previous/ambiguous upload')}
 if(mode==='auth-error'){assert.ok(!existsSync(join(directory,'stage-attempt.json')));assert.ok(!existsSync(join(directory,'traffic-before.json')))}
 console.log('PASS simulated Stage API: '+mode+'; no real HTTP/data, no traffic/settings mutation')
}
// Actual existing Wrangler build of the exact source; default mode must not contact the API.
const directory=mkdtempSync(join(tmpdir(),'g7-stage-prepare-')),snapshot=join(directory,'active-version.private.json');writeFileSync(snapshot,JSON.stringify(fixture),{mode:0o600})
const originalFetch=globalThis.fetch;globalThis.fetch=async()=>{throw Error('Default preparation must not fetch')}
try{
 const root=process.env.G7_TEST_SOURCE_ROOT||process.cwd()
 await assert.rejects(()=>main(['--check-auth'],{root,snapshot}),/requiere el paquete existente/);assert.ok(!existsSync(join(directory,'stage-api-'+CANDIDATE.slice(0,12))))
 await main([],{root,snapshot});const evidence=join(directory,'stage-api-'+CANDIDATE.slice(0,12)),compiled=join(evidence,'compiled-form.private.bin'),first=statSync(compiled).mtimeMs
 await main([],{root,snapshot});assert.equal(statSync(compiled).mtimeMs,first,'Prepared artifact reused, not rebuilt')
 const p=JSON.parse(readFileSync(join(evidence,'payload.private.json')));assert.equal(p.bindings.length,35);assert.ok(p.bindings.every(b=>b.version_id===ACTIVE));assert.ok(p.modules[0].content_base64.length>1000)
 console.log('PASS real local compilation: exact candidate, installed Wrangler dry-run, module extraction, default no API and artifact reuse')
 // Exercise --check-auth through main with the pinned reader and mocked credentials/GET.
 for(const name of ['kawmed-g3-1-pages.mjs','run-kawmed-g3-1-stage-preview-2026-11-16.sh'])writeFileSync(join(directory,name),readFileSync(join(readerFolder,name)))
 const {Runner:CachedRunner}=await import(pathToFileURL(join(directory,'kawmed-g3-1-pages.mjs')).href),originalCredentials=CachedRunner.prototype.credentials,oldToken=process.env.CLOUDFLARE_API_TOKEN,oldAccount=process.env.CLOUDFLARE_ACCOUNT_ID
 const preserved=['prepared.json','prepared-modules.private.json','payload.private.json','compiled-form.private.bin']
 const bytes=preserved.map(name=>readFileSync(join(evidence,name))),times=preserved.map(name=>statSync(join(evidence,name)).mtimeMs)
 writeFileSync(join(evidence,'error.private.txt'),'original error retained');let authGets=0
 try{
  process.env.CLOUDFLARE_API_TOKEN='fixture-auth-only';delete process.env.CLOUDFLARE_ACCOUNT_ID
  CachedRunner.prototype.credentials=function(){this.exec=(_binary,args)=>{assert.deepEqual(args,['whoami']);return 'a'.repeat(32)};return originalCredentials.call(this)}
  globalThis.fetch=async(_url,options)=>{authGets++;assert.equal(options.method,'GET');assert.equal(options.headers.Authorization,'Bearer fixture-auth-only');return Response.json({success:true,result:{deployments:[{id:'fixture-current',versions:[{version_id:ACTIVE,percentage:100}]}]}})}
  await main(['--check-auth'],{root,snapshot});assert.equal(authGets,1)
  for(const [i,name] of preserved.entries()){assert.deepEqual(readFileSync(join(evidence,name)),bytes[i]);assert.equal(statSync(join(evidence,name)).mtimeMs,times[i])}
  assert.equal(readFileSync(join(evidence,'error.private.txt'),'utf8'),'original error retained')
  for(const name of ['stage-attempt.json','traffic-before.json','stage-response.private.json'])assert.ok(!existsSync(join(evidence,name)))
  console.log('PASS auth-only full flow: one simulated GET, no POST/attempt/recompile, existing package bytes/hashes/mtime and prior error preserved')
 }finally{
  CachedRunner.prototype.credentials=originalCredentials
  for(const [key,value] of [['CLOUDFLARE_API_TOKEN',oldToken],['CLOUDFLARE_ACCOUNT_ID',oldAccount]])if(value===undefined)delete process.env[key];else process.env[key]=value
 }
}finally{globalThis.fetch=originalFetch}
