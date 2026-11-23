#!/usr/bin/env node
// KAW-G8-OPS: investigate an inactive Worker version. GET only; never upload, deploy or touch D1/R2.
import {readFileSync,existsSync,mkdtempSync,rmSync} from 'node:fs'
import {homedir,tmpdir} from 'node:os'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'

const PRODUCT='71dd92b870482427d8576e68d89c3167bcfe8f12'
const BASELINE='3d4973e4-e344-493a-a065-93f199b00359'
const MANIFEST_SHA='ed2a628ccc59a737c447dd3bf835d0d2df7cdfed5539eceef5fa859f1d10e21c'
const ROOT=join(homedir(),'Desktop/kawvo-g8-production-main')
const BACKUP=join(homedir(),'intap-release-logs/kawvo-g8-backup-udfewy')
const hash=b=>createHash('sha256').update(b).digest('hex')
const normalize=v=>Array.isArray(v)?v.map(normalize):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,normalize(v[k])])):v
const same=(a,b)=>JSON.stringify(normalize(a))===JSON.stringify(normalize(b))
const blocked=s=>{throw Error('BLOCKED: '+s)}
const need=(c,s)=>{if(!c)blocked(s)}
const command=(bin,args,cwd)=>execFileSync(bin,args,{cwd,stdio:['ignore','pipe','pipe'],encoding:'utf8',timeout:120000}).trim()
const versionsOf=result=>Array.isArray(result)?result:Array.isArray(result?.versions)?result.versions:Array.isArray(result?.items)?result.items:null
const moduleSha=m=>m&&typeof m.content_base64==='string'&&m.content_base64.length?hash(Buffer.from(m.content_base64,'base64')):null

function selfTest(){
 need(versionsOf([{id:'a'}])[0].id==='a','array pagination')
 need(versionsOf({versions:[{id:'b'}]})[0].id==='b','versions pagination')
 need(versionsOf({items:[{id:'c'}]})[0].id==='c','items pagination')
 need(versionsOf({other:[]})===null,'reject unknown pagination shape')
 need(same({x:1,y:2},{y:2,x:1}),'canonical comparison')
 need(!same({x:1},{x:2}),'mismatch detection')
 console.log('PASS: read-only parser/self-test; no Cloudflare access')
}

async function main(){
 need(process.argv.length===3&&['--inspect','--self-test'].includes(process.argv[2]),'use --inspect or --self-test')
 if(process.argv[2]==='--self-test'){selfTest();return}
 need(process.version==='v20.20.2','Mac Node version differs from approved build')
 need(command('git',['rev-parse','HEAD'],ROOT)===PRODUCT,'source checkout changed')
 need(command('git',['status','--porcelain','--untracked-files=no'],ROOT)==='','tracked source checkout is dirty')
 need(existsSync(join(BACKUP,'manifest.private.json')),'original G8.6 receipt absent')
 const bytes=readFileSync(join(BACKUP,'manifest.private.json'))
 need(hash(bytes)===MANIFEST_SHA,'original G8.6 receipt checksum differs')
 const saved=JSON.parse(bytes)
 need(saved.layers?.API?.version===BASELINE,'G8.6 baseline identity differs')

 // Load the existing read-only helpers from an actual .mjs file, never stdin.
 const inspector=await import(pathToFileURL(join(ROOT,'scripts/inspect-kawvo-g8-readonly.mjs')).href)
 const backupTool=await import(pathToFileURL(join(ROOT,'scripts/prepare-kawvo-g8-backup.mjs')).href)
 const reader=inspector.credentials(ROOT)
 need(saved.accountFingerprint===hash(reader.account),'Cloudflare account not the G8.6 account')
 const prefix='/accounts/'+reader.account+'/workers/scripts/intap-api'
 const active=async()=>{
  const d=(await reader.get(prefix+'/deployments'))?.deployments?.[0]
  need(d?.versions?.length===1&&d.versions[0]?.version_id===BASELINE&&Number(d.versions[0]?.percentage)===100,'Production API active version is no longer pinned G8.6 @100%')
 }
 await active()
 const getVersions=async()=>{
  const path=prefix+'/versions?per_page=5'
  need(path==='/accounts/'+reader.account+'/workers/scripts/intap-api/versions?per_page=5','unexpected API path')
  let response
  try{response=await fetch('https://api.cloudflare.com/client/v4'+path,{method:'GET',headers:{Authorization:reader.authorization},redirect:'error',signal:AbortSignal.timeout(30000)})}
  catch{blocked('Cloudflare GET versions network/timeout; no retry or write')}
  const body=await response.json().catch(()=>null)
  need(response.ok&&body?.success===true,'Cloudflare versions GET HTTP '+response.status+'; no upload')
  const versions=versionsOf(body.result)
  need(versions?.length>0&&typeof versions[0]?.id==='string','Cloudflare versions list has unexpected shape')
  return versions
 }
 const versions=await getVersions()
 const latestId=versions[0].id
 const old=await reader.get('/accounts/'+reader.account+'/workers/workers/intap-api/versions/'+BASELINE+'?include=modules')
 inspector.versionSummary(old,'intap-api')
 const retained=JSON.parse(readFileSync(join(BACKUP,'api/version.private.json')))
 need(same(backupTool.redactSecretBindings(old),retained),'G8.6 old version no longer matches private backup')
 const latest=latestId===BASELINE?old:await reader.get('/accounts/'+reader.account+'/workers/workers/intap-api/versions/'+latestId+'?include=modules')
 need(latest?.id===latestId,'latest version read mismatch')

 const tmp=mkdtempSync(join(tmpdir(),'kawvo-g8-readonly-build-'))
 let localBytes
 try{
  const output=join(tmp,'worker.mjs')
  command(join(ROOT,'node_modules/.bin/esbuild'),[
   join(ROOT,'api/src/preview-free-entry.ts'),'--bundle','--platform=node',
   '--format=esm','--target=node20','--external:cloudflare:*','--outfile='+output
  ],ROOT)
  localBytes=readFileSync(output)
 }finally{rmSync(tmp,{force:true,recursive:true})}
 need(localBytes.length>10000&&localBytes.length<10*1024*1024,'local production API bundle has unexpected size')
 const localSha=hash(localBytes)
 const modules=Array.isArray(latest.modules)?latest.modules:[]
 const remoteHash=modules.length===1?moduleSha(modules[0]):null
 const bindingIdentityMatch=same(
  backupTool.redactSecretBindings(latest.bindings||[]).slice().sort((a,b)=>a.name.localeCompare(b.name)),
  backupTool.redactSecretBindings(old.bindings||[]).slice().sort((a,b)=>a.name.localeCompare(b.name)))
 const runtimeKeys=['compatibility_date','compatibility_flags','limits','cache_options','usage_model','placement','exports']
 const project=x=>Object.fromEntries(runtimeKeys.map(k=>[k,x?.[k]??null]))
 const runtimeMatch=same(project(latest),project(old))
 const sameCode=remoteHash!==null&&remoteHash===localSha&&modules[0]?.name==='worker.mjs'
 const provenance=latest.annotations?.['workers/commit_sha']===PRODUCT?true:
  typeof latest.annotations?.['workers/commit_sha']==='string'?false:null
 await active()
 console.log(JSON.stringify({
  task:'KAW-G8-API-VERSION-FORENSICS',remoteWrites:0,trafficChanged:false,source:PRODUCT,
  activeBaseline:BASELINE,latestVersion:latestId,latestDifferentFromActive:latestId!==BASELINE,
  listedVersionIds:versions.slice(0,5).map(x=>x.id),
  candidate:{moduleSha256:remoteHash,expectedModuleSha256:localSha,exactG8Bundle:sameCode,
   bindingsEqualToActive:bindingIdentityMatch,runtimeEqualToActive:runtimeMatch,
   sourceAnnotationMatches:provenance},
  decision:latestId===BASELINE?'BASELINE_ONLY_NO_NEW_STAGE':
   sameCode&&bindingIdentityMatch&&runtimeMatch&&provenance!==false?'REUSE_REVIEW_REQUIRED_NO_UPLOAD':'BLOCKED_DIFFERENT_UPLOADED_VERSION',
  next:'Do not rerun stage or activate: review these safe results and authorize a separate step.'
 },null,2))
}
main().catch(e=>{console.error(e.message?.startsWith('BLOCKED:')?e.message:'BLOCKED: read-only inspection failed; raw output omitted');process.exitCode=1})
