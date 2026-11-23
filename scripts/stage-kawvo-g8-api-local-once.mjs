#!/usr/bin/env node
// KAW-G8-OPS-LOCAL — one-shot API version stage (NO traffic, no D1/R2 writes).
// Source is fixed to the G8 product main commit; tool branch is deliberately NOT merged.
import {readFileSync,existsSync,mkdirSync,mkdtempSync,writeFileSync} from 'node:fs'
import {homedir} from 'node:os'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'

const PRODUCT='71dd92b870482427d8576e68d89c3167bcfe8f12'
const OPS_MAIN='c846d0e5e1b9dec310f5a037bf91a400791b7267'
const MANIFEST_HASH='ed2a628ccc59a737c447dd3bf835d0d2df7cdfed5539eceef5fa859f1d10e21c'
const BASELINE='3d4973e4-e344-493a-a065-93f199b00359'
const REPO='pgcsoluciones/intap-link'
const uuid=s=>/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(s||'')
const sha=s=>createHash('sha256').update(s).digest('hex')
const stop=s=>{throw Error('BLOCKED: '+s)}
const need=(ok,s)=>{if(!ok)stop(s)}
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b))
const cmd=(bin,args,cwd)=>execFileSync(bin,args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:120000}).trim()
const root=join(homedir(),'Desktop/kawvo-g8-production-main')
const logRoot=join(homedir(),'intap-release-logs')
const backup=join(logRoot,'kawvo-g8-backup-udfewy')
const receipt=join(logRoot,'kawvo-g8-api-stage-once.private.json')
const mode=process.argv[2]
need(mode==='--stage','use --stage; never run a blind or repeated upload')
need(process.env.KAWVO_G8_STAGE_API==='SI','explicit stage authorization marker missing')
need(!existsSync(receipt),'a prior API stage attempt receipt exists; inspect it, do NOT retry')
need(cmd('git',['rev-parse','HEAD'],root)===PRODUCT,'product checkout not pinned')
need(!cmd('git',['status','--porcelain','--untracked-files=no'],root),'tracked product source changed')
need(cmd('gh',['api','repos/'+REPO+'/branches/main','--jq','.commit.sha'],root)===OPS_MAIN,'main moved')
need(cmd('gh',['variable','get','INTAP_APPROVED_COMMIT','--repo',REPO],root)===OPS_MAIN,'main approval moved')
need(cmd('gh',['variable','get','INTAP_PRODUCTION_APPROVAL','--repo',REPO],root)==='SÍ','production approval disabled')
const ci=cmd('gh',['api','repos/'+REPO+'/actions/runs/45239371896','--jq','[.status,.conclusion,.head_sha] | join(":")'],root)
need(ci==='completed:success:'+OPS_MAIN,'approved main quality CI not green')
const bytes=readFileSync(join(backup,'manifest.private.json'))
need(sha(bytes)===MANIFEST_HASH,'G8.6 backup manifest changed')
const m=JSON.parse(bytes)
need(m.layers?.API?.version===BASELINE,'old API version differs from pinned backup')
const inspector=await import(pathToFileURL(join(root,'scripts/inspect-kawvo-g8-readonly.mjs')).href)
const backupTool=await import(pathToFileURL(join(root,'scripts/prepare-kawvo-g8-backup.mjs')).href)
const reader=inspector.credentials(root)
need(m.accountFingerprint===sha(reader.account),'Mac Cloudflare account differs from G8.6 backup')
const endpoint='/accounts/'+reader.account+'/workers/scripts/intap-api'
const active=async()=>{
 const d=(await reader.get(endpoint+'/deployments'))?.deployments?.[0]
 need(d?.versions?.length===1&&d.versions[0].version_id===BASELINE&&Number(d.versions[0].percentage)===100,
  'production API traffic no longer 100% on G8.6 baseline')
}
const cfGet=async path=>{
 let response
 try{response=await fetch('https://api.cloudflare.com/client/v4'+path,{headers:{Authorization:reader.authorization},signal:AbortSignal.timeout(30000)})}
 catch{stop('Cloudflare GET network failure')}
 const body=await response.json().catch(()=>null)
 need(response.ok&&body?.success===true,'Cloudflare GET HTTP '+response.status)
 return body.result
}
await active()
const latest=await cfGet(endpoint+'/versions?per_page=1')
const rows=Array.isArray(latest)?latest:Array.isArray(latest?.versions)?latest.versions:Array.isArray(latest?.items)?latest.items:null
need(rows?.length>0&&rows[0]?.id===BASELINE,
 'latest uploaded API version differs from active G8.6 baseline; cannot inherit safely')
const old=await reader.get('/accounts/'+reader.account+'/workers/workers/intap-api/versions/'+BASELINE+'?include=modules')
const prior=JSON.parse(readFileSync(join(backup,'api/version.private.json')))
inspector.versionSummary(old,'intap-api')
need(same(backupTool.redactSecretBindings(old),prior),'current API version differs from retained G8.6 snapshot')
need(old.modules?.length===1&&old.modules[0]?.name===old.main_module,
 'existing API has multiple modules; one-module version upload is not equivalent')
need(old.bindings.length>0&&old.bindings.every(b=>/^[A-Za-z_$][\w$]*$/.test(b.name)),
 'effective production bindings unavailable or invalid')
need(old.bindings.some(b=>b.name==='DB'&&b.type==='d1')&&
 old.bindings.some(b=>b.name==='AGENTS_DB'&&b.type==='d1')&&
 old.bindings.some(b=>b.name==='BUCKET'&&b.type==='r2_bucket')&&
 old.bindings.some(b=>b.name==='ENVIRONMENT'&&b.type==='plain_text'&&b.text==='production'),
 'critical production bindings not present')
need(typeof old.compatibility_date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(old.compatibility_date),
 'effective compatibility date not known')
need(!old.assets||Object.keys(old.assets).length===0,'assets present; explicit retention required')
need(!old.exports||Object.keys(old.exports).every(k=>k==='default'&&old.exports[k]?.type==='worker'),
 'additional Worker exports require separate preserving procedure')
await active()

const esbuild=join(root,'node_modules/.bin/esbuild')
need(existsSync(esbuild),'no local esbuild; do not install/change dependencies')
mkdirSync(logRoot,{recursive:true,mode:0o700})
const temp=mkdtempSync(join(logRoot,'kawvo-g8-api-bundle-'))
const output=join(temp,'worker.mjs')
cmd(esbuild,[
 join(root,'api/src/preview-free-entry.ts'),'--bundle','--platform=node',
 '--format=esm','--target=node20','--external:cloudflare:*','--outfile='+output
],root)
const bundle=readFileSync(output)
need(bundle.length>10000&&bundle.length<10*1024*1024,'API bundle unexpected size')
const metadata={
 main_module:'worker.mjs',
 compatibility_date:old.compatibility_date,
 compatibility_flags:old.compatibility_flags||[],
 bindings:old.bindings.map(b=>({name:b.name,type:'inherit'})),
 annotations:{'workers/commit_sha':PRODUCT,'workers/tag':'kawvo-g8-71dd92b8',
 'workers/message':'G8 unified production API staged without traffic'}
}
for(const key of ['cache_options','limits','usage_model','migration_tag'])if(old[key]!==undefined&&old[key]!==null)metadata[key]=old[key]
if(old.placement?.mode)metadata.placement={mode:old.placement.mode}
if(old.exports?.default)metadata.exports={default:old.exports.default}
need(metadata.bindings.length===old.bindings.length,'binding inheritance count differs')
// Last read before the irreversible version-upload request. Never inherit unknown latest.
const finalLatest=await cfGet(endpoint+'/versions?per_page=1')
const finalRows=Array.isArray(finalLatest)?finalLatest:
 Array.isArray(finalLatest?.versions)?finalLatest.versions:
 Array.isArray(finalLatest?.items)?finalLatest.items:null
need(finalRows?.[0]?.id===BASELINE,'latest version moved before stage; no upload')
await active()

const form=new FormData()
form.append('metadata',JSON.stringify(metadata))
form.append('worker.mjs',new Blob([bundle],{type:'application/javascript+module'}),'worker.mjs')
writeFileSync(receipt,JSON.stringify({
 task:'KAW-G8-LOCAL-API-STAGE',status:'UPLOAD_ATTEMPTED_DO_NOT_RERUN',source:PRODUCT,
 approvedOps:OPS_MAIN,baseline:BASELINE,accountFingerprint:sha(reader.account),
 moduleSha256:sha(bundle),moduleBytes:bundle.length,bindingCount:old.bindings.length,
 trafficActivation:false
},null,2)+'\n',{flag:'wx',mode:0o600})
console.log('PASS PRE-STAGE: current active AND latest API equal G8.6; binding inheritance strict; source pinned')
console.log('UPLOAD: creating one inactive API version. No retry if command ends ambiguously.')
let response
try{response=await fetch('https://api.cloudflare.com/client/v4'+endpoint+'/versions?bindings_inherit=strict',{
 method:'POST',headers:{Authorization:reader.authorization},body:form,signal:AbortSignal.timeout(90000)
})}catch{stop('API version upload ambiguous; inspect Cloudflare before any retry')}
const payload=await response.json().catch(()=>null)
const newId=payload?.result?.id
need(response.ok&&payload?.success===true&&uuid(newId),
 'API upload HTTP '+response.status+' failed/ambiguous; do not repeat')
const result=JSON.parse(readFileSync(receipt))
result.status='UPLOADED_INACTIVE_PENDING_READBACK'
result.version=newId
writeFileSync(receipt,JSON.stringify(result,null,2)+'\n',{mode:0o600})
const fresh=await reader.get('/accounts/'+reader.account+'/workers/workers/intap-api/versions/'+newId+'?include=modules')
const safeBindings=arr=>backupTool.redactSecretBindings(arr).slice().sort((a,b)=>a.name.localeCompare(b.name))
need(same(safeBindings(fresh.bindings||[]),safeBindings(old.bindings)),
 'inactive API version binding/config mismatch; do NOT activate')
need(fresh.compatibility_date===old.compatibility_date&&
 same(fresh.compatibility_flags||[],old.compatibility_flags||[])&&
 same(fresh.limits||{},old.limits||{})&&
 same(fresh.cache_options||{},old.cache_options||{})&&
 (fresh.usage_model||null)===(old.usage_model||null),
 'inactive API runtime configuration mismatch; do NOT activate')
need(fresh.modules?.length===1&&fresh.modules[0]?.name==='worker.mjs'&&
 sha(Buffer.from(fresh.modules[0]?.content_base64||'','base64'))===sha(bundle),
 'inactive API module bytes mismatch; do NOT activate')
await active()
result.status='PASS_STAGED_INACTIVE_VERIFIED'
writeFileSync(receipt,JSON.stringify(result,null,2)+'\n',{mode:0o600})
console.log('PASS: API new version staged, modules and bindings verified; Production traffic still OLD @100%')
console.log('NEW_API_VERSION='+newId)
console.log('RECEIPT='+receipt)
