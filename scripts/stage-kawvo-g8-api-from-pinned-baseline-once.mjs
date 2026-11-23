#!/usr/bin/env node
// KAW-G8 P0: upload ONE inactive API version; inherit every binding from the exact ACTIVE G8.6 version.
// Uses Workers Beta Versions CREATE (deploy=false). Never deploys traffic, mutates D1/R2, or retries.
import {readFileSync,existsSync,mkdirSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs'
import {homedir,tmpdir} from 'node:os'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'

const PRODUCT='71dd92b870482427d8576e68d89c3167bcfe8f12'
const OPS_MAIN='c846d0e5e1b9dec310f5a037bf91a400791b7267'
const BACKUP_HASH='ed2a628ccc59a737c447dd3bf835d0d2df7cdfed5539eceef5fa859f1d10e21c'
const BASELINE='3d4973e4-e344-493a-a065-93f199b00359'
const KNOWN_LATEST='1972228c-4dd7-4ede-9d94-8338132b3b20'
const EXPECTED_BUNDLE='f465c714f3a5b4b3627d58797be32621c674e7056e27ff4c36fbf8e09e96fbd6'
const REPO='pgcsoluciones/intap-link'
const ROOT=join(homedir(),'Desktop/kawvo-g8-production-main')
const LOG=join(homedir(),'intap-release-logs')
const BACKUP=join(LOG,'kawvo-g8-backup-udfewy')
const RECEIPT=join(LOG,'kawvo-g8-api-stage-once.private.json')
const hash=b=>createHash('sha256').update(b).digest('hex')
const uuid=s=>/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(s||'')
const canon=x=>Array.isArray(x)?x.map(canon):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canon(x[k])])):x
const same=(a,b)=>JSON.stringify(canon(a))===JSON.stringify(canon(b))
const stop=s=>{throw Error('BLOCKED: '+s)}
const need=(v,s)=>{if(!v)stop(s)}
const cmd=(bin,args,where)=>{try{return execFileSync(bin,args,{cwd:where,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:120000}).trim()}catch{stop('local command failed ('+bin.split('/').pop()+'); no Cloudflare write')}}
const redactSafe=(tool,a)=>tool.redactSecretBindings(a).slice().sort((x,y)=>x.name.localeCompare(y.name))
const versionIds=result=>Array.isArray(result)?result:Array.isArray(result?.versions)?result.versions:Array.isArray(result?.items)?result.items:null

function makeMetadata(old,bytes){
 need(old?.id===BASELINE&&Array.isArray(old?.bindings)&&old.bindings.length>0,'baseline version/bindings invalid')
 need(old.modules?.length===1&&old.modules[0]?.name===old.main_module,'active API is not a one-module Worker')
 need(old.bindings.every(b=>/^[A-Za-z_$][\w$]*$/.test(b.name)),'invalid effective binding name')
 need(old.bindings.some(b=>b.name==='DB'&&b.type==='d1')&&old.bindings.some(b=>b.name==='AGENTS_DB'&&b.type==='d1')&&old.bindings.some(b=>b.name==='BUCKET'&&b.type==='r2_bucket')&&old.bindings.some(b=>b.name==='ENVIRONMENT'&&b.type==='plain_text'&&b.text==='production'),'required production bindings absent')
 need(typeof old.compatibility_date==='string'&&/^\d{4}-\d\d-\d\d$/.test(old.compatibility_date),'baseline compatibility date missing')
 need(!old.assets||Object.keys(old.assets).length===0,'active Worker has assets requiring separate preservation')
 need(!old.containers?.length,'active Worker has containers requiring separate preservation')
 need(!old.exports||Object.keys(old.exports).every(k=>k==='default'&&old.exports[k]?.type==='worker'),'active Worker exports not supported by this uploader')
 need(old.modules[0]?.content_base64?.length>0,'baseline module content missing')
 need(hash(bytes)===EXPECTED_BUNDLE,'compiled G8 bundle hash drift; no upload')
 const m={
  main_module:'worker.mjs',
  modules:[{name:'worker.mjs',content_type:'application/javascript+module',content_base64:bytes.toString('base64')}],
  compatibility_date:old.compatibility_date,compatibility_flags:old.compatibility_flags||[],
  bindings:old.bindings.map(b=>({name:b.name,type:'inherit',version_id:BASELINE})),
  annotations:{'workers/tag':'kawvo-g8-71dd92b8','workers/message':'G8 approved source '+PRODUCT+'; STAGED ONLY; no traffic'}
 }
 for(const k of ['cache_options','limits','usage_model'])if(old[k]!==null&&old[k]!==undefined)m[k]=old[k]
 if(old.placement)m.placement=old.placement
 if(old.exports?.default)m.exports={default:old.exports.default}
 need(m.bindings.length===old.bindings.length&&m.bindings.every(b=>b.version_id===BASELINE),'explicit pinned inheritance not satisfied')
 return m
}

function selfTest(){
 const old={id:BASELINE,main_module:'legacy.js',modules:[{name:'legacy.js',content_base64:'YQ=='}],compatibility_date:'2024-02-08',
 bindings:[{name:'DB',type:'d1'},{name:'AGENTS_DB',type:'d1'},{name:'BUCKET',type:'r2_bucket'},{name:'ENVIRONMENT',type:'plain_text',text:'production'},{name:'X',type:'secret_text'}]}
 const bytes=Buffer.from('fixture')
 // Pure guard checks: cannot call makeMetadata with different local bundle hash.
 need(versionIds([{id:KNOWN_LATEST}])[0].id===KNOWN_LATEST,'list parser')
 need(versionIds({versions:[{id:KNOWN_LATEST}]})[0].id===KNOWN_LATEST,'versions parser')
 need(same({a:1,b:2},{b:2,a:1}),'canonical comparator')
 need(old.bindings.map(b=>({name:b.name,type:'inherit',version_id:BASELINE})).every(b=>b.version_id===BASELINE),'baseline inheritance')
 need(hash(bytes)!==EXPECTED_BUNDLE,'fixture must not pass immutable bundle hash')
 console.log('PASS SELF-TEST: pinned baseline inheritance + one-shot guards; zero remote writes')
}

async function main(){
 need(process.argv.length===3&&['--stage','--self-test'].includes(process.argv[2]),'use --stage or --self-test')
 if(process.argv[2]==='--self-test'){selfTest();return}
 need(process.platform==='darwin'&&process.version==='v20.20.2','approved Mac/Node runtime required')
 need(process.env.KAWVO_G8_STAGE_API==='SI','approved stage marker required')
 need(!existsSync(RECEIPT),'existing private API stage receipt; inspect before any retry')
 need(cmd('git',['rev-parse','HEAD'],ROOT)===PRODUCT,'approved product checkout changed')
 need(cmd('git',['status','--porcelain','--untracked-files=no'],ROOT)==='','tracked G8 product checkout dirty')
 need(cmd('gh',['api','repos/'+REPO+'/branches/main','--jq','.commit.sha'],ROOT)===OPS_MAIN,'main changed')
 need(cmd('gh',['variable','get','INTAP_APPROVED_COMMIT','--repo',REPO],ROOT)===OPS_MAIN,'GitHub approval SHA changed')
 need(cmd('gh',['variable','get','INTAP_PRODUCTION_APPROVAL','--repo',REPO],ROOT)==='SÍ','GitHub production approval missing')
 need(cmd('gh',['api','repos/'+REPO+'/actions/runs/45239371896','--jq','[.status,.conclusion,.head_sha] | join(":")'],ROOT)==='completed:success:'+OPS_MAIN,'approved main CI result invalid')
 const manifestBytes=readFileSync(join(BACKUP,'manifest.private.json'))
 need(hash(manifestBytes)===BACKUP_HASH,'private G8.6 manifest changed')
 const manifest=JSON.parse(manifestBytes)
 need(manifest.layers?.API?.version===BASELINE,'G8.6 baseline changed')
 const inspector=await import(pathToFileURL(join(ROOT,'scripts/inspect-kawvo-g8-readonly.mjs')).href)
 const backupTool=await import(pathToFileURL(join(ROOT,'scripts/prepare-kawvo-g8-backup.mjs')).href)
 const reader=inspector.credentials(ROOT)
 need(manifest.accountFingerprint===hash(reader.account),'Cloudflare account differs from original G8.6 account')
 const ep='/accounts/'+reader.account+'/workers/scripts/intap-api'
 const active=async()=>{
  const d=(await reader.get(ep+'/deployments'))?.deployments?.[0]
  need(d?.versions?.length===1&&d.versions[0]?.version_id===BASELINE&&Number(d.versions[0]?.percentage)===100,'current production traffic no longer pinned G8.6 @100%')
 }
 const latest=async()=>{
  let response
  try{response=await fetch('https://api.cloudflare.com/client/v4'+ep+'/versions?per_page=1',{method:'GET',headers:{Authorization:reader.authorization},redirect:'error',signal:AbortSignal.timeout(30000)})}
  catch{stop('Cloudflare versions GET unavailable; no remote write')}
  const b=await response.json().catch(()=>null)
  need(response.ok&&b?.success===true,'Cloudflare version list HTTP '+response.status+'; no upload')
  const rows=versionIds(b.result)
  need(rows?.length>0&&uuid(rows[0]?.id),'Cloudflare versions response invalid')
  return rows[0].id
 }
 await active()
 need(await latest()===KNOWN_LATEST,'newer API upload detected; do not overwrite review baseline')
 const old=await reader.get('/accounts/'+reader.account+'/workers/workers/intap-api/versions/'+BASELINE+'?include=modules')
 inspector.versionSummary(old,'intap-api')
 const retained=JSON.parse(readFileSync(join(BACKUP,'api/version.private.json')))
 need(same(backupTool.redactSecretBindings(old),retained),'current baseline differs from G8.6 snapshot')
 need(existsSync(join(ROOT,'node_modules/.bin/esbuild')),'local bundled compiler missing; do not install anything')
 const tmp=mkdtempSync(join(tmpdir(),'kawvo-g8-api-package-'))
 let bundle
 try{
  const output=join(tmp,'worker.mjs')
  cmd(join(ROOT,'node_modules/.bin/esbuild'),[join(ROOT,'api/src/preview-free-entry.ts'),'--bundle','--platform=node','--format=esm','--target=node20','--external:cloudflare:*','--outfile='+output],ROOT)
  bundle=readFileSync(output)
 }finally{rmSync(tmp,{force:true,recursive:true})}
 need(bundle.length>10000&&bundle.length<10*1024*1024,'bundle size outside contract')
 const metadata=makeMetadata(old,bundle)
 need(!existsSync(RECEIPT),'another API stage attempt receipt appeared')
 await active()
 need(await latest()===KNOWN_LATEST,'new API version appeared just before upload; STOP')
 await active()
 mkdirSync(LOG,{recursive:true,mode:0o700})
 const attempt={task:'KAW-G8-API-STAGE-BASELINE-PINNED',status:'UPLOAD_ATTEMPTED_DO_NOT_RERUN',product:PRODUCT,
  approvedMain:OPS_MAIN,baseline:BASELINE,previousLatest:KNOWN_LATEST,accountFingerprint:hash(reader.account),
  bundleSha256:hash(bundle),bindingCount:old.bindings.length,inheritanceFrom:BASELINE,
  cloudflareBetaEndpoint:true,deploy:false,remoteD1R2Writes:0}
 writeFileSync(RECEIPT,JSON.stringify(attempt,null,2)+'\n',{flag:'wx',mode:0o600})
 console.log('PASS PREFLIGHT: G8.6 active @100%; exact G8 module; explicit baseline-pinned bindings')
 console.log('UPLOAD ONCE: creating inactive version with deploy=false; never retry ambiguous result')
 let response
 try{response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+reader.account+'/workers/workers/intap-api/versions?deploy=false',{
  method:'POST',headers:{Authorization:reader.authorization,'Content-Type':'application/json'},body:JSON.stringify(metadata),
  redirect:'error',signal:AbortSignal.timeout(90000)})}
 catch{stop('upload result ambiguous; inspect Cloudflare versions and private receipt; do NOT retry')}
 const payload=await response.json().catch(()=>null)
 const id=payload?.result?.id
 need(response.ok&&payload?.success===true&&uuid(id),'Cloudflare create inactive version HTTP '+response.status+'; no retry')
 attempt.version=id;attempt.status='UPLOADED_INACTIVE_PENDING_READBACK'
 writeFileSync(RECEIPT,JSON.stringify(attempt,null,2)+'\n',{mode:0o600})
 const fresh=await reader.get('/accounts/'+reader.account+'/workers/workers/intap-api/versions/'+id+'?include=modules')
 need(fresh?.id===id&&fresh.main_module==='worker.mjs'&&fresh.modules?.length===1&&fresh.modules[0]?.name==='worker.mjs'&&hash(Buffer.from(fresh.modules[0]?.content_base64||'','base64'))===EXPECTED_BUNDLE,'uploaded module mismatch; no activation')
 need(same(redactSafe(backupTool,fresh.bindings||[]),redactSafe(backupTool,old.bindings||[])),'new API effective bindings differ from active; no activation')
 for(const k of ['compatibility_date','compatibility_flags','limits','cache_options','usage_model','placement'])
  need(same(fresh[k]??null,old[k]??null),'new API runtime difference at '+k+'; no activation')
 need(same(fresh.exports||{},old.exports||{}),'new API exports differ; no activation')
 await active()
 attempt.status='PASS_STAGED_INACTIVE_VERIFIED'
 writeFileSync(RECEIPT,JSON.stringify(attempt,null,2)+'\n',{mode:0o600})
 console.log('PASS: inactive API G8 version created, exact module/bindings/runtime verified; traffic OLD @100%')
 console.log('NEW_API_VERSION='+id)
 console.log('RECEIPT='+RECEIPT)
}
main().catch(e=>{console.error(e.message?.startsWith('BLOCKED:')?e.message:'BLOCKED: stage failed; do not retry; inspect private receipt');process.exitCode=1})
