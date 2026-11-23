#!/usr/bin/env node
// KAW-G8-P0 FINAL API STAGE: one inactive version, exact G8.6 binding inheritance.
// No traffic activation, D1/R2 changes, app/web deploy, or retry. Designed for Node 20.20.2 on owner's Mac.
// Requires evidence of prior HTTP 400, exact private receipt, unmodified main approval, immutable G8 code.
import {readFileSync,existsSync,writeFileSync,mkdtempSync,rmSync,mkdirSync} from 'node:fs'
import {homedir,tmpdir} from 'node:os'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'

const SOURCE='71dd92b870482427d8576e68d89c3167bcfe8f12'
const OPS_MAIN='c846d0e5e1b9dec310f5a037bf91a400791b7267'
const BASELINE='3d4973e4-e344-493a-a065-93f199b00359'
const PREVIOUS_LATEST='1972228c-4dd7-4ede-9d94-8338132b3b20'
const EXPECTED_BUNDLE_SHA='f465c714f3a5b4b3627d58797be32621c674e7056e27ff4c36fbf8e09e96fbd6'
const MANIFEST_SHA='ed2a628ccc59a737c447dd3bf835d0d2df7cdfed5539eceef5fa859f1d10e21c'
const REPO='pgcsoluciones/intap-link',WORKER='intap-api'
const ROOT=join(homedir(),'Desktop/kawvo-g8-production-main')
const EVIDENCE=join(homedir(),'intap-release-logs')
const BACKUP=join(EVIDENCE,'kawvo-g8-backup-udfewy')
const PRIOR=join(EVIDENCE,'kawvo-g8-api-stage-once.private.json')
const RECEIPT=join(EVIDENCE,'kawvo-g8-api-p0-final-once.private.json')
const hash=x=>createHash('sha256').update(x).digest('hex')
const uuid=x=>/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(x||'')
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b))
const stop=s=>{throw new Error('BLOCKED: '+s)}
const check=(v,s)=>{if(!v)stop(s)}
const git=(...a)=>run('git',a)
const run=(binary,args)=>{try{return execFileSync(binary,args,{cwd:ROOT,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:120000}).trim()}catch{stop('local '+binary.split('/').pop()+' failed; no upload')}}
const versions=result=>Array.isArray(result)?result:Array.isArray(result?.versions)?result.versions:Array.isArray(result?.items)?result.items:null
const keyNames=a=>a.map(b=>b.name).sort()
const allowedKeys=(value,keys,label)=>{check(value&&typeof value==='object'&&!Array.isArray(value),label+' invalid');check(Object.keys(value).every(k=>keys.includes(k)),label+' unexpected keys');return value}
function preservedOptions(v){
 const out={}
 if(v.cache_options!==undefined&&v.cache_options!==null){
  out.cache_options=allowedKeys(v.cache_options,['enabled','cross_version_cache'],'cache_options')
  check(Object.values(out.cache_options).every(x=>typeof x==='boolean'),'cache_options values unexpected')
 }
 if(v.limits!==undefined&&v.limits!==null){
  out.limits=allowedKeys(v.limits,['cpu_ms','subrequests'],'limits')
  check(Object.values(out.limits).every(x=>Number.isSafeInteger(x)&&x>0),'limits values unexpected')
 }
 if(v.usage_model!==undefined&&v.usage_model!==null){
  check(['standard','bundled','unbound'].includes(v.usage_model),'unknown usage model')
  out.usage_model=v.usage_model
 }
 if(v.placement!==undefined&&v.placement!==null){
  const p=allowedKeys(v.placement,['mode'],'placement')
  // A GET can report {mode:"off"}; CREATE only accepts smart or targeted, so absence preserves off.
  if(p.mode==='smart')out.placement={mode:'smart'}
  else check(p.mode==='off','unexpected placement requires separate safe release plan')
 }
 if(v.migration_tag||v.migrations&&Object.keys(v.migrations).length)stop('unexpected durable-object migration baseline')
 if(v.exports!==undefined&&v.exports!==null){
  check(Object.keys(v.exports).every(k=>k==='default'),'non-default Worker exports require separate release')
  const e=v.exports.default
  if(e){
   allowedKeys(e,['type','state','cache'],'default export')
   check(e.type==='worker'&&(e.state===undefined||e.state==='created'),'unsupported default export')
   out.exports={default:{type:'worker'}}
   if(e.cache){
    allowedKeys(e.cache,['enabled'],'default export cache')
    check(typeof e.cache.enabled==='boolean','invalid export cache')
    out.exports.default.cache={enabled:e.cache.enabled}
   }
  }
 }
 check(!v.assets||Object.keys(v.assets).length===0,'Worker assets require dedicated retention')
 check(!v.containers||v.containers.length===0,'Worker containers require dedicated retention')
 return out
}
function payload(old,bundle){
 check(old?.id===BASELINE&&Array.isArray(old.bindings)&&old.bindings.length>0,'baseline version invalid')
 check(old.modules?.length===1&&old.modules[0]?.name===old.main_module,'baseline Worker modules cannot be preserved')
 check(old.bindings.every(x=>/^[A-Za-z_$][\w$]*$/.test(x.name)),'invalid binding name')
 check(new Set(keyNames(old.bindings)).size===old.bindings.length,'duplicate effective binding')
 for(const [name,type] of [['DB','d1'],['AGENTS_DB','d1'],['BUCKET','r2_bucket'],['ENVIRONMENT','plain_text']])
  check(old.bindings.some(b=>b.name===name&&b.type===type),'critical binding missing: '+name)
 check(old.bindings.find(b=>b.name==='ENVIRONMENT').text==='production','not a production Worker')
 check(/^\d{4}-\d\d-\d\d$/.test(old.compatibility_date||''),'unknown compatibility date')
 check(Array.isArray(old.compatibility_flags||[]),'compatibility flags not an array')
 check(hash(bundle)===EXPECTED_BUNDLE_SHA,'built G8 module bytes differ from immutable checked hash')
 const options=preservedOptions(old)
 const metadata={
  main_module:'worker.mjs',
  modules:[{name:'worker.mjs',content_type:'application/javascript+module',content_base64:bundle.toString('base64')}],
  compatibility_date:old.compatibility_date,
  bindings:old.bindings.map(b=>({name:b.name,type:'inherit',version_id:BASELINE})),
  annotations:{'workers/tag':'kawvo-g8-'+SOURCE.slice(0,8),'workers/message':'Kawvo G8 '+SOURCE+' STAGED, no traffic'},
  ...options
 }
 if(old.compatibility_flags?.length)metadata.compatibility_flags=old.compatibility_flags
 check(metadata.bindings.every(b=>b.version_id===BASELINE&&b.type==='inherit'),'unqualified binding inheritance')
 return metadata
}
function safeErrors(body,status){
 const errors=Array.isArray(body?.errors)?body.errors:[]
 return {http:status,codes:errors.map(e=>String(e?.code)).filter(s=>/^\d{1,8}$/.test(s)).slice(0,8),
  pointers:errors.map(e=>e?.source?.pointer).filter(s=>typeof s==='string'&&/^\/[a-zA-Z0-9_~./-]{1,96}$/.test(s)).slice(0,8)}
}
function test(){
 const fixture={id:BASELINE,main_module:'legacy.js',modules:[{name:'legacy.js',content_base64:'YQ=='}],compatibility_date:'2024-02-08',compatibility_flags:[],
  placement:{mode:'off'},exports:{default:{type:'worker',state:'created'}},bindings:[
   {name:'DB',type:'d1'},{name:'AGENTS_DB',type:'d1'},{name:'BUCKET',type:'r2_bucket'},{name:'ENVIRONMENT',type:'plain_text',text:'production'},{name:'SECRET',type:'secret_text'}]}
 const opts=preservedOptions(fixture)
 check(!('placement' in opts),'off placement not a valid create parameter')
 check(opts.exports.default.type==='worker'&&!('state' in opts.exports.default),'read-only export state omitted')
 check(fixture.bindings.map(b=>({name:b.name,type:'inherit',version_id:BASELINE})).every(b=>b.version_id===BASELINE),'pinned secret inheritance')
 check(versions([{id:PREVIOUS_LATEST}])[0].id===PREVIOUS_LATEST,'versions shape')
 check(versions({items:[{id:PREVIOUS_LATEST}]})[0].id===PREVIOUS_LATEST,'versions items shape')
 check(safeErrors({errors:[{code:10057,source:{pointer:'/bindings/0/version_id'},message:'do not print'}]},400).codes[0]==='10057','sanitize API error')
 check(same({x:1,y:2},{y:2,x:1}),'canonical compare')
 console.log('PASS SELF-TEST: API schema/pinned inheritance/error sanitizer; zero remote writes')
}
async function main(){
 check(process.argv.length===3&&['--self-test','--stage'].includes(process.argv[2]),'use --self-test or --stage')
 if(process.argv[2]==='--self-test'){test();return}
 check(process.platform==='darwin'&&process.version==='v20.20.2','Mac Node 20.20.2 required')
 check(process.env.KAWVO_G8_STAGE_API==='SI'&&process.env.KAWVO_G8_PRIOR_400_ACK==='SI','explicit previous 400/stage acknowledgement missing')
 check(!existsSync(RECEIPT),'G8 P0 final stage already attempted: stop, never retry')
 check(git('rev-parse','HEAD')===SOURCE,'source commit changed')
 check(git('status','--porcelain','--untracked-files=no')==='','source checkout has tracked changes')
 check(run('gh',['api','repos/'+REPO+'/branches/main','--jq','.commit.sha'])===OPS_MAIN,'main changed after authorization')
 check(run('gh',['variable','get','INTAP_APPROVED_COMMIT','--repo',REPO])===OPS_MAIN,'approved main SHA drift')
 check(run('gh',['variable','get','INTAP_PRODUCTION_APPROVAL','--repo',REPO])==='SÍ','production authorization missing')
 check(run('gh',['api','repos/'+REPO+'/actions/runs/45239371896','--jq','[.status,.conclusion,.head_sha] | join(":")'])==='completed:success:'+OPS_MAIN,'approved CI not green')
 const prior=JSON.parse(readFileSync(PRIOR))
 check(prior.task==='KAW-G8-API-STAGE-BASELINE-PINNED'&&prior.status==='UPLOAD_ATTEMPTED_DO_NOT_RERUN'&&
  prior.product===SOURCE&&prior.approvedMain===OPS_MAIN&&prior.baseline===BASELINE&&prior.previousLatest===PREVIOUS_LATEST&&
  prior.bundleSha256===EXPECTED_BUNDLE_SHA&&prior.deploy===false,'unexpected previous attempted upload receipt')
 const manifestBytes=readFileSync(join(BACKUP,'manifest.private.json'))
 check(hash(manifestBytes)===MANIFEST_SHA,'G8.6 backup checksum drift')
 const manifest=JSON.parse(manifestBytes)
 check(manifest.layers.API.version===BASELINE,'G8.6 API baseline mismatch')
 const inspector=await import(pathToFileURL(join(ROOT,'scripts/inspect-kawvo-g8-readonly.mjs')).href)
 const backupTool=await import(pathToFileURL(join(ROOT,'scripts/prepare-kawvo-g8-backup.mjs')).href)
 const reader=inspector.credentials(ROOT)
 check(manifest.accountFingerprint===hash(reader.account)&&prior.accountFingerprint===hash(reader.account),'Cloudflare account mismatch')
 const ep='/accounts/'+reader.account+'/workers/scripts/'+WORKER
 const active=async()=>{
  const d=(await reader.get(ep+'/deployments'))?.deployments?.[0]
  check(d?.versions?.length===1&&d.versions[0]?.version_id===BASELINE&&Number(d.versions[0]?.percentage)===100,'active API traffic changed; stop')
 }
 const latest=async()=>{
  let response
  try{response=await fetch('https://api.cloudflare.com/client/v4'+ep+'/versions?per_page=1',{method:'GET',redirect:'error',headers:{Authorization:reader.authorization},signal:AbortSignal.timeout(30000)})}
  catch{stop('Cloudflare versions GET failed; no upload')}
  const body=await response.json().catch(()=>null)
  check(response.ok&&body?.success===true,'Cloudflare versions list unavailable HTTP '+response.status)
  const rows=versions(body.result)
  check(rows?.length>0&&uuid(rows[0]?.id),'latest version response invalid')
  return rows[0].id
 }
 await active()
 check(await latest()===PREVIOUS_LATEST,'previous HTTP 400 ambiguous or another upload occurred; no retry')
 const old=await reader.get('/accounts/'+reader.account+'/workers/workers/'+WORKER+'/versions/'+BASELINE+'?include=modules')
 inspector.versionSummary(old,WORKER)
 const backupVersion=JSON.parse(readFileSync(join(BACKUP,'api/version.private.json')))
 check(same(backupTool.redactSecretBindings(old),backupVersion),'baseline version differs from original backup')
 check(existsSync(join(ROOT,'node_modules/.bin/esbuild')),'existing G8 compiler missing; do not install anything')
 const temp=mkdtempSync(join(tmpdir(),'kawvo-g8-api-validated-'))
 let bundle
 try{
  const dest=join(temp,'worker.mjs')
  run(join(ROOT,'node_modules/.bin/esbuild'),[join(ROOT,'api/src/preview-free-entry.ts'),'--bundle','--platform=node','--format=esm','--target=node20','--external:cloudflare:*','--outfile='+dest])
  bundle=readFileSync(dest)
 }finally{rmSync(temp,{recursive:true,force:true})}
 check(bundle.length>10000&&bundle.length<10*1024*1024,'unexpected G8 module size')
 const body=payload(old,bundle)
 await active()
 check(await latest()===PREVIOUS_LATEST,'latest Worker version changed just before stage')
 await active()
 mkdirSync(EVIDENCE,{recursive:true,mode:0o700})
 const r={task:'KAWVO-G8-P0-STAGE',status:'ATTEMPTED_STOP_NO_RETRY',source:SOURCE,approvedMain:OPS_MAIN,
  baseline:BASELINE,previousLatest:PREVIOUS_LATEST,accountFingerprint:hash(reader.account),moduleSha256:hash(bundle),
  inheritedBindingVersion:BASELINE,bindingsCount:old.bindings.length,remoteD1R2Writes:0,trafficActivation:false}
 writeFileSync(RECEIPT,JSON.stringify(r,null,2)+'\n',{flag:'wx',mode:0o600})
 console.log('PASS PREFLIGHT: same baseline + latest, exact G8 bytes; preserving exact G8.6 secret inheritance')
 console.log('UPLOAD ONCE: creating G8 inactive API version; no traffic activation')
 let response
 try{response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+reader.account+'/workers/workers/'+WORKER+'/versions?deploy=false',{
  method:'POST',headers:{Authorization:reader.authorization,'Content-Type':'application/json'},
  redirect:'error',body:JSON.stringify(body),signal:AbortSignal.timeout(90000)})}
 catch{stop('Cloudflare upload result ambiguous; do not retry; use private receipt')}
 const b=await response.json().catch(()=>null)
 if(!response.ok||b?.success!==true||!uuid(b?.result?.id)){
  const error=safeErrors(b,response.status)
  r.status='REJECTED_OR_AMBIGUOUS_NO_RETRY';r.error=error
  writeFileSync(RECEIPT,JSON.stringify(r,null,2)+'\n',{mode:0o600})
  const now=await latest().catch(()=>null)
  r.latestAfterRejectedUpload=now
  r.status=now===PREVIOUS_LATEST?'REJECTED_HTTP_'+response.status+'_LATEST_UNCHANGED':'AMBIGUOUS_AFTER_HTTP_'+response.status
  writeFileSync(RECEIPT,JSON.stringify(r,null,2)+'\n',{mode:0o600})
  console.error('CLOUDFLARE_REJECTION='+JSON.stringify({ ...error, latestUnchanged:now===PREVIOUS_LATEST,receipt:RECEIPT }))
  stop('Cloudflare rejected upload; no automatic retry, no activation')
 }
 const newId=b.result.id
 r.version=newId;r.status='UPLOADED_INACTIVE_PENDING_READBACK'
 writeFileSync(RECEIPT,JSON.stringify(r,null,2)+'\n',{mode:0o600})
 const fresh=await reader.get('/accounts/'+reader.account+'/workers/workers/'+WORKER+'/versions/'+newId+'?include=modules')
 check(fresh?.id===newId&&fresh.main_module==='worker.mjs'&&fresh.modules?.length===1&&fresh.modules[0]?.name==='worker.mjs'&&hash(Buffer.from(fresh.modules[0]?.content_base64||'','base64'))===EXPECTED_BUNDLE_SHA,'new version module is not G8; do not activate')
 const redact=a=>backupTool.redactSecretBindings(a).slice().sort((x,y)=>x.name.localeCompare(y.name))
 check(same(redact(fresh.bindings||[]),redact(old.bindings||[])),'effective bindings drift; do not activate')
 check(fresh.compatibility_date===old.compatibility_date&&same(fresh.compatibility_flags||[],old.compatibility_flags||[]),'compatibility settings drift')
 for(const k of ['limits','cache_options','usage_model'])check(same(fresh[k]??null,old[k]??null),'runtime drift: '+k)
 const placement=v=>v?.placement?.mode==='off'||!v?.placement?null:v.placement
 check(same(placement(fresh),placement(old)),'Worker placement drift')
 const exportsShape=v=>Object.fromEntries(Object.entries(v?.exports||{}).map(([name,e])=>[name,{type:e?.type,cache:e?.cache||null}]))
 check(same(exportsShape(fresh),exportsShape(old)),'Worker exports drift')
 await active()
 r.status='PASS_STAGED_INACTIVE_VERIFIED'
 writeFileSync(RECEIPT,JSON.stringify(r,null,2)+'\n',{mode:0o600})
 console.log('PASS: G8 exact API version staged inactive, original effective bindings confirmed, traffic still G8.6 @100%')
 console.log('NEW_API_VERSION='+newId)
 console.log('RECEIPT='+RECEIPT)
}
main().catch(e=>{console.error(e.message?.startsWith('BLOCKED:')?e.message:'BLOCKED: unexpected release failure; no retry');process.exitCode=1})
