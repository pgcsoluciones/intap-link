import assert from 'node:assert/strict'
import {mkdtempSync,readFileSync,writeFileSync,statSync,existsSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {ACTIVE,CANDIDATE,CREATE,main,payload,uploadStage,validateSnapshot} from './stage-kawvo-g7-api-pinned.mjs'
const make=()=>({id:ACTIVE,main_module:'original.js',modules:[{name:'original.js',content_type:'application/javascript+module',content_base64:'b3JpZ2luYWw='}],compatibility_date:'2024-02-08',compatibility_flags:[],limits:{cpu_ms:50},placement:{mode:'smart'},cache_options:{enabled:false},exports:{default:{type:'worker',state:'created',cache:{enabled:false}}},bindings:[{name:'ENVIRONMENT',type:'plain_text',text:'preview'},{name:'DB',type:'d1',id:'fixture-only-db'},{name:'BUCKET',type:'r2_bucket',bucket_name:'fixture-only-bucket'},{name:'SECRET_FIXTURE',type:'secret_text',text:'DO_NOT_PRINT_FIXTURE_SECRET'},...Array.from({length:31},(_,i)=>({name:'FIXTURE_'+i,type:'plain_text',text:'value-'+i}))]})
const modules=[{name:'candidate.js',content_type:'application/javascript+module',content_base64:Buffer.from('export default {fetch(){},scheduled(){}}').toString('base64')}]
const fixture=make(),body=payload(fixture,modules)
assert.equal(body.bindings.length,35);assert.ok(body.bindings.every(b=>b.type==='inherit'&&b.version_id===ACTIVE));assert.ok(!JSON.stringify(body).includes('DO_NOT_PRINT_FIXTURE_SECRET'))
for(const key of ['triggers','routes','migrations','env','logpush','observability','tail_consumers'])assert.ok(!(key in body))
for(const bad of [{...fixture,id:'d0f6a4b9-a01b-4900-a904-ec82a5a44d92'},{...fixture,bindings:fixture.bindings.slice(1)},{...fixture,bindings:[...fixture.bindings.slice(1),fixture.bindings[1]]},{...fixture,modules:[]},{...fixture,exports:{Other:{type:'durable-object'}}},{...fixture,migrations:{new_tag:'forbidden'}}])assert.throws(()=>validateSnapshot(bad))
console.log('PASS Stage preparation: pin 35 active bindings, preserve runtime, no secret values or settings/migrations, reject invalid snapshots')
for(const mode of ['success','http-error','timeout','bytes','bindings','runtime','annotation','drift-before','drift-after']){
 const directory=mkdtempSync(join(tmpdir(),'g7-stage-simulation-')),version=make(),id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';let posts=0,gets=0,posted
 const client={account:'fixture-account',headers:{Authorization:'Bearer fixture-token'},async api(path){gets++;if(path.endsWith('/deployments'))return {result:{deployments:[{id:mode==='drift-after'&&gets>1?'changed':'existing-deployment',versions:[{version_id:mode==='drift-before'?id:ACTIVE,percentage:100}]}]}};assert.equal(path,'/workers/workers/intap-api-preview/versions/'+id+'?include=modules');const uploaded={...version,id,main_module:modules[0].name,modules:structuredClone(modules),annotations:posted.annotations};if(mode==='bytes')uploaded.modules[0].content_base64='YWRkaXRpb25hbA==';if(mode==='bindings')uploaded.bindings=version.bindings.slice(1);if(mode==='runtime')uploaded.compatibility_date='2025-01-01';if(mode==='annotation')uploaded.annotations={};return {result:uploaded}}}
 const request=async(url,options)=>{posts++;assert.equal(url,'https://api.cloudflare.com/client/v4/accounts/fixture-account'+CREATE);assert.equal(options.method,'POST');assert.equal(options.redirect,'error');posted=JSON.parse(options.body);assert.ok(posted.bindings.every(b=>b.version_id===ACTIVE));assert.equal(posted.annotations['workers/tag'],CANDIDATE);if(mode==='timeout')throw Error('fixture timeout');if(mode==='http-error')return Response.json({success:false,errors:[{code:10057,message:'DO_NOT_PRINT_FIXTURE_SECRET'}]},{status:400});return Response.json({success:true,result:{id}})}
 if(mode==='success'){const receipt=await uploadStage({directory,version,modules,client,fetch:request});assert.equal(receipt.result,'PASS');assert.equal(receipt.trafficUnchanged,true);assert.equal(statSync(join(directory,'stage-pass.json')).mode&0o777,0o600)}
 else{await assert.rejects(()=>uploadStage({directory,version,modules,client,fetch:request}),error=>!error.message.includes('DO_NOT_PRINT_FIXTURE_SECRET'));assert.ok(!existsSync(join(directory,'stage-pass.json')))}
 assert.equal(posts,mode==='drift-before'?0:1)
 if(mode!=='drift-before'){await assert.rejects(()=>uploadStage({directory,version,modules,client,fetch:request}),/intento anterior/);assert.equal(posts,1,'No second POST after any previous/ambiguous upload')}
 console.log('PASS simulated Stage API: '+mode+'; no real HTTP/data, no traffic/settings mutation')
}
// Actual existing Wrangler build of the exact source; default mode must not contact the API.
const directory=mkdtempSync(join(tmpdir(),'g7-stage-prepare-')),snapshot=join(directory,'active-version.private.json');writeFileSync(snapshot,JSON.stringify(fixture),{mode:0o600})
const originalFetch=globalThis.fetch;globalThis.fetch=async()=>{throw Error('Default preparation must not fetch')}
try{
 const root=process.env.G7_TEST_SOURCE_ROOT||process.cwd()
 await main([],{root,snapshot});const evidence=join(directory,'stage-api-'+CANDIDATE.slice(0,12)),compiled=join(evidence,'compiled-form.private.bin'),first=statSync(compiled).mtimeMs
 await main([],{root,snapshot});assert.equal(statSync(compiled).mtimeMs,first,'Prepared artifact reused, not rebuilt')
 const p=JSON.parse(readFileSync(join(evidence,'payload.private.json')));assert.equal(p.bindings.length,35);assert.ok(p.bindings.every(b=>b.version_id===ACTIVE));assert.ok(p.modules[0].content_base64.length>1000)
 console.log('PASS real local compilation: exact candidate, installed Wrangler dry-run, module extraction, default no API and artifact reuse')
}finally{globalThis.fetch=originalFetch}
