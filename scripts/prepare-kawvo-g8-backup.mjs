// KAW-G8-006: GET-only capture to the owner's Mac. No restore/upload/activation implementation.
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {existsSync,lstatSync,readFileSync,readdirSync,mkdirSync,mkdtempSync,writeFileSync} from 'node:fs'
import {homedir} from 'node:os'
import {join,resolve,sep} from 'node:path'
import {pathToFileURL} from 'node:url'
import {credentials,versionSummary,githubAudit} from './inspect-kawvo-g8-readonly.mjs'
import {assertG8Runtime} from './lib/kawvo-g8-freeze.mjs'

export const BASE='f14cb0180f964d65daaa9b3c69dceccc6011ab24'
export const G86_MANIFEST='ed2a628ccc59a737c447dd3bf835d0d2df7cdfed5539eceef5fa859f1d10e21c'
const sha=b=>createHash('sha256').update(b).digest('hex'),uuid=x=>/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(x||'')
const blocked=code=>{throw Error('BLOCKED: '+code)}
const need=(test,code)=>{if(!test)blocked(code)}
const parse=p=>JSON.parse(readFileSync(p,'utf8'))
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b))
function git(root,...args){try{return execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()}catch{blocked('local Git control failed; no remote operation performed')}}
function file(p,privateMode=false){const s=lstatSync(p);need(s.isFile()&&!s.isSymbolicLink()&&s.uid===process.getuid(),'file ownership/type invalid');if(privateMode)need((s.mode&0o077)===0,'private file permissions invalid');return s}
function directory(p,privateMode=false){const s=lstatSync(p);need(s.isDirectory()&&!s.isSymbolicLink()&&s.uid===process.getuid()&&(s.mode&0o022)===0,'directory ownership/type/write permissions invalid');if(privateMode)need((s.mode&0o077)===0,'private directory permissions invalid')}
function safePath(p){need(typeof p==='string'&&p.length>0&&!p.includes('\\')&&!p.includes('\0')&&!p.startsWith('/')&&p.split('/').every(x=>x&&x!=='.'&&x!=='..'),'unsafe backup-relative path');return p}
// Secret binding values are never available as restore inputs; preserve names/types only.
export function redactSecretBindings(value){
 if(Array.isArray(value))return value.map(redactSecretBindings)
 if(value&&typeof value==='object'){
  if(value.type==='secret_text')return {name:value.name,type:'secret_text',valueNotExported:true}
  return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,redactSecretBindings(v)]))
 }
 return value
}
export function readG85(logRoot){
 directory(logRoot)
 const reports=[]
 for(const name of readdirSync(logRoot).filter(n=>/^kawvo-g8-readonly-[A-Za-z0-9_-]+$/.test(n))){
  const folder=join(logRoot,name),path=join(folder,'report.json');directory(folder);if(!existsSync(path))continue
  const s=file(path);need(s.size<4*1024*1024,'oversized prior audit report')
  const r=parse(path),w=r.cloudflare?.workers?.['intap-api']
  if(r.remoteWrites===0&&r.cloudflare?.schemaStatus==='PASS'&&w?.status==='PASS'&&w.environment==='production'&&uuid(w.version))reports.push({path,sha256:sha(readFileSync(path)),mtime:s.mtimeMs,report:r})
 }
 need(reports.length>0,'completed G8.5 report not available locally; do not rerun D1')
 reports.sort((a,b)=>b.mtime-a.mtime);return reports[0]
}
export function captureAllowed(path,account){
 const prefix='/accounts/'+account
 return /^[a-f0-9]{32}$/.test(account)&&[
  new RegExp('^'+prefix+'/workers/scripts/intap-api/(deployments|settings|schedules)$'),
  new RegExp('^'+prefix+'/workers/domains$'),
  new RegExp('^'+prefix+'/workers/workers/intap-api/versions/[a-f0-9-]{36}\\?include=modules$'),
  new RegExp('^'+prefix+'/pages/projects/intap-(web2|link)(/deployments/[a-f0-9-]{36})?$'),
  /^\/zones\?name=intaprd\.com$/,/^\/zones\/[a-f0-9]{32}\/workers\/routes$/
 ].some(r=>r.test(path))
}
function pagesIdentity(d,project){
 need(uuid(d?.id)&&d.environment==='production'&&d.latest_stage?.status==='success','Pages target must be a retained successful Production deployment')
 const u=new URL(d.url);need(u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash&&u.pathname==='/'&&new RegExp('^[a-z0-9-]+\\.'+project+'\\.pages\\.dev$').test(u.hostname),'unexpected immutable Pages origin')
 need(/^[a-f0-9]{40}$/.test(d.deployment_trigger?.metadata?.commit_hash||''),'Pages commit not attributable')
 return {deployment:d.id,url:u.origin,commit:d.deployment_trigger.metadata.commit_hash,branch:d.deployment_trigger.metadata.branch,usesFunctions:typeof d.uses_functions==='boolean'?d.uses_functions:null}
}
export function makePlan(manifest){
 return {task:'KAW-G8-006',decision:'NO-GO',executable:false,authorization:'NOT GRANTED; no write capability in this tool',
  api:{worker:'intap-api',targetVersion:manifest.layers.API.version,futureRequest:{method:'POST',endpoint:'/accounts/{authorized-account}/workers/scripts/intap-api/deployments',body:{strategy:'percentage',versions:[{version_id:manifest.layers.API.version,percentage:100}]}},procedure:'After separate exact authorization: re-read traffic, retained version, bindings/settings/cron/routes; use native deployment of the pinned version at 100%, never latest. Recheck full version bytes/config and approved smoke tests. No D1/R2 reversal.',settings:'A Worker version does not restore unversioned settings; compare private settings/cron/routes separately, never overwrite drift blindly.',secrets:'Names/types only; continued availability of existing secrets must be accredited without exporting values.'},
  app:{project:'intap-web2',target:manifest.layers.App.deployment,futureRequest:{method:'POST',endpoint:'/accounts/{authorized-account}/pages/projects/intap-web2/deployments/'+(manifest.layers.App.deployment||'{BLOCKED-no-target}')+'/rollback'},procedure:'After separate authorization: GET target again, require successful Production deployment retained; use native Pages rollback to this ID, not a new build/upload. Verify custom domain, JS/CSS and authorized Functions routes. Compare project configuration separately.'},
  web:{project:'intap-link',target:manifest.layers.Web.deployment,futureRequest:{method:'POST',endpoint:'/accounts/{authorized-account}/pages/projects/intap-link/deployments/'+(manifest.layers.Web.deployment||'{BLOCKED-no-target}')+'/rollback'},procedure:'Same pinned native Production rollback, preserving deployed Functions/assets/control files. Preview deployments are not valid targets. Do not substitute an App validator or rebuild an assumed equivalent.'},
  order:'Choose affected layer(s) from the incident and compatibility evidence; UI-only -> its Pages project; incompatible API -> stop writes and restore pinned API, then only necessary frontend(s). No automatic cross-layer restore.',
  missing:manifest.pending,remoteRestoreRehearsed:false}
}
export function verifyBackup(folder){
 directory(folder,true);const manifestPath=join(folder,'manifest.private.json');file(manifestPath,true)
 const bytes=readFileSync(manifestPath);file(join(folder,'manifest.sha256'),true);need(readFileSync(join(folder,'manifest.sha256'),'utf8').trim()===sha(bytes),'manifest checksum mismatch')
 const m=JSON.parse(bytes);need(m.task==='KAW-G8-006'&&m.remoteWrites===0&&m.decision==='NO-GO','invalid backup manifest')
 const paths=new Set();for(const row of m.files){safePath(row.path);need(!paths.has(row.path),'duplicate backup file');paths.add(row.path);let prefix=folder;for(const part of row.path.split('/').slice(0,-1)){prefix=join(prefix,part);directory(prefix,true)}const p=join(folder,row.path);const s=file(p,true);need(s.size===row.bytes&&sha(readFileSync(p))===row.sha256,'backup file missing or hash mismatch')}
 const walk=(p,relative='')=>{for(const child of readdirSync(p)){const rel=relative?relative+'/'+child:child,s=lstatSync(join(p,child));need(!s.isSymbolicLink(),'backup symlink forbidden');if(s.isDirectory()){directory(join(p,child),true);walk(join(p,child),rel)}else need(paths.has(rel)||['manifest.private.json','manifest.sha256'].includes(rel),'unexpected/unhashed backup file')}};walk(folder)
 const v=parse(join(folder,'api/version.private.json')),summary=versionSummary(v,'intap-api')
 need(v.id===m.layers.API.version&&summary.modules.length===m.layers.API.modules.length,'API identity/module count mismatch')
 for(const module of m.layers.API.modules){need(summary.modules.some(x=>x.name===module.name&&x.sha256===module.sha256&&x.bytes===module.bytes),'version/module metadata mismatch');need(sha(readFileSync(join(folder,safePath(module.file))))===module.sha256,'native module bytes mismatch')}
 for(const [layer,project] of [['App','intap-web2'],['Web','intap-link']]){if(!m.layers[layer].deployment){need(m.layers[layer].status==='BLOCKED','missing layer must remain blocked');continue}const d=pagesIdentity(parse(join(folder,layer.toLowerCase()+'/deployment.private.json')),project);need(d.deployment===m.layers[layer].deployment,'Pages identity mismatch')}
 return {integrity:'PASS',layers:m.layers,recovery:'BLOCKED',remoteRestoreRehearsed:false,decision:'NO-GO',manifestSha256:sha(bytes)}
}
// Native target eligibility is distinct from a cold export and from an executed restoration.
export async function verifyNativeRecovery({reader,folder,expectedManifest=G86_MANIFEST}){
 const verified=verifyBackup(folder);need(verified.manifestSha256===expectedManifest,'G8.6 receipt fingerprint differs; do not recapture or replace baseline')
 const m=parse(join(folder,'manifest.private.json'));need(m.accountFingerprint===sha(reader.account),'backup account differs from existing authorized account')
 const prefix='/accounts/'+reader.account,get=path=>{need(captureAllowed(path,reader.account),'native retention GET outside allowlist');return reader.get(path)},layers={}
 const attempt=async(name,fn)=>{try{layers[name]=await fn()}catch(e){layers[name]={status:'BLOCKED',reason:e.message?.startsWith('BLOCKED:')?e.message:'BLOCKED: retained target read unavailable; raw error omitted'}}}
 await attempt('API',async()=>{
  const id=m.layers.API.version;need(uuid(id),'missing pinned API version')
  const v=await get(prefix+'/workers/workers/intap-api/versions/'+id+'?include=modules');versionSummary(v,'intap-api');need(v.id===id&&same(redactSecretBindings(v),parse(join(folder,'api/version.private.json'))),'retained API bytes/config differ from captured version')
  const d=(await get(prefix+'/workers/scripts/intap-api/deployments'))?.deployments?.[0];need(d?.versions?.length===1&&d.versions[0].version_id===id&&Number(d.versions[0].percentage)===100,'active Production baseline changed; review before promotion')
  return {status:'PASS',scope:'Native retained version/code/config target verified; not a restore rehearsal',target:id,requiresUnchangedResourcesAndSecrets:true}
 })
 for(const [name,project] of [['App','intap-web2'],['Web','intap-link']])await attempt(name,async()=>{
  const old=parse(join(folder,name.toLowerCase()+'/deployment.private.json')),before=pagesIdentity(old,project)
  const current=await get(prefix+'/pages/projects/'+project+'/deployments/'+before.deployment),target=pagesIdentity(current,project)
  need(same(target,before),'retained Pages identity/commit/Functions metadata changed');need(typeof target.usesFunctions==='boolean','Functions ownership not exposed; native eligibility incomplete')
  return {status:'PASS',scope:'Retained successful Production deployment is eligible for native rollback as one unit; no restore executed',target:target.deployment,project,functions:target.usesFunctions?'Included in native deployment unit; no separate rebuild/export required':'No Functions reported in this retained deployment',independentFunctionsBinaryCompared:false}
 })
 return {task:'KAW-G8-FINAL',sourceManifestSha256:verified.manifestSha256,layers,scope:'Read-verified native rollback eligibility; no cold-backup requirement for Pages',remoteRestoreRehearsed:false,remoteWrites:0,remoteD1Queries:0,recaptureExecuted:false,decision:'NO-GO'}
}
export async function captureBackup({reader,audit,folder,head,publicFetch=globalThis.fetch}){
 directory(folder,true);const files=[]
 const save=(path,data)=>{safePath(path);const dest=join(folder,path),parent=resolve(dest,'..');if(!existsSync(parent))mkdirSync(parent,{recursive:true,mode:0o700});directory(parent,true);const b=Buffer.isBuffer(data)?data:Buffer.from(JSON.stringify(redactSecretBindings(data),null,2)+'\n');writeFileSync(dest,b,{mode:0o600,flag:'wx'});files.push({path,bytes:b.length,sha256:sha(b)})}
 const calls=[],prefix='/accounts/'+reader.account,get=async path=>{need(captureAllowed(path,reader.account),'request outside backup GET allowlist');const endpoint=path.replace(/[a-f0-9-]{36}|[a-f0-9]{32}/g,'[id]');calls.push({method:'GET',endpoint});try{return await reader.get(path)}catch(e){blocked(endpoint+'; '+(e.message?.startsWith('BLOCKED:')?e.message:'read unavailable; raw error omitted'))}}
 const active=async()=>{const d=(await get(prefix+'/workers/scripts/intap-api/deployments'))?.deployments?.[0];need(d?.versions?.length===1&&Number(d.versions[0].percentage)===100&&uuid(d.versions[0].version_id),'ambiguous active Production Worker');return d.versions[0].version_id}
 const attempt=async(label,fn)=>{try{return await fn()}catch(e){return {status:'BLOCKED',reason:e.message?.startsWith('BLOCKED:')?e.message:'BLOCKED: capture read unavailable; no raw error copied',layer:label}}}
 const versionId=await active();need(versionId===audit.report.cloudflare.workers['intap-api'].version,'Production Worker drift since G8.5; stop capture')
 const version=await get(prefix+'/workers/workers/intap-api/versions/'+versionId+'?include=modules'),summary=versionSummary(version,'intap-api');need(version.id===versionId,'Worker version drift')
 save('api/version.private.json',version)
 const modules=[];for(const [i,m] of version.modules.entries()){const data=Buffer.from(m.content_base64,'base64');need(data.length>0&&data.toString('base64')===m.content_base64,'non-canonical module encoding');const path='api/modules/'+i+'.bin';save(path,data);modules.push({name:m.name,file:path,sha256:sha(data),bytes:data.length,contentType:m.content_type})}
 const settings=await attempt('API settings',async()=>{const s=await get(prefix+'/workers/scripts/intap-api/settings');need(s&&Array.isArray(s.bindings),'Worker settings incomplete');return s}),cron=await attempt('API cron',async()=>{const s=await get(prefix+'/workers/scripts/intap-api/schedules');need(Array.isArray(s)||Array.isArray(s?.schedules),'Worker cron snapshot incomplete');return s});save('api/settings.private.json',settings);save('api/cron.private.json',cron)
 const routes=await attempt('API routes',async()=>{const zones=await get('/zones?name=intaprd.com');need(zones.length===1&&/^[a-f0-9]{32}$/.test(zones[0].id),'zone not unique');return (await get('/zones/'+zones[0].id+'/workers/routes')).filter(r=>r.script==='intap-api')});save('api/routes.private.json',routes)
 const domains=await attempt('API custom domains',async()=>{const list=await get(prefix+'/workers/domains');need(Array.isArray(list),'Worker custom domain result incomplete');return list.filter(d=>d.service==='intap-api')});save('api/domains.private.json',domains)
 const retained=await get(prefix+'/workers/workers/intap-api/versions/'+versionId+'?include=modules');need(same(version,retained),'retained native version changed during capture')
 const pending=['Remote restore not rehearsed; no write authorized','Secret values not exported: continued platform availability not certified','Unversioned configuration restoration requires exact comparison, not automatic overwrite']
 const missingConfig=[settings,cron,routes,domains].filter(x=>x.status==='BLOCKED');for(const x of missingConfig)pending.push(x.layer+': '+x.reason)
 const layers={API:{status:missingConfig.length?'BLOCKED':'PASS',scope:'Local native modules/version/bindings hashed; settings/cron/routes/custom-domain response snapshots recorded where accessible. Not an account-wide routing export or recovery approval.',version:versionId,bindingCount:summary.bindingCount,modules,retainedVersionRead:'PASS',configurationReads:missingConfig.length?'BLOCKED':'PASS',recoverable:'BLOCKED'}}
 for(const [layer,project,host,route] of [['App','intap-web2','https://app.intaprd.com','/admin/login'],['Web','intap-link','https://intaprd.com','/']]){
  layers[layer]=await attempt(layer,async()=>{
   const p=await get(prefix+'/pages/projects/'+project);need(p.name===project&&uuid(p.canonical_deployment?.id),'Pages canonical deployment unavailable')
   const d=await get(prefix+'/pages/projects/'+project+'/deployments/'+p.canonical_deployment.id),identity=pagesIdentity(d,project),previous=audit.report.cloudflare.pages?.[project]?.production?.id
   need(!previous||previous===identity.deployment,'Pages Production drift since G8.5; stop this layer')
   save(layer.toLowerCase()+'/project.private.json',p);save(layer.toLowerCase()+'/deployment.private.json',d)
   // Only static login/landing and their declared JS/CSS. No profile, patient or API data.
   const entries={};for(const origin of [identity.url,host]){
    const res=await publicFetch(origin+route,{method:'GET',redirect:'error',signal:AbortSignal.timeout(30000)});need(res.ok,'public entry GET failed');const html=Buffer.from(await res.arrayBuffer());need(html.length<2*1024*1024,'oversized public HTML')
    const assets=[...new Set(html.toString().match(/\/assets\/[A-Za-z0-9_./-]+\.(?:js|css)/g)||[])];need(assets.some(x=>x.endsWith('.js'))&&assets.every(x=>!x.includes('..')),'public JS entry unavailable');const hashes={}
    for(const asset of assets){const a=await publicFetch(origin+asset,{method:'GET',redirect:'error',signal:AbortSignal.timeout(30000)});need(a.ok,'public asset GET failed');const b=Buffer.from(await a.arrayBuffer());need(b.length<16*1024*1024,'oversized public asset');hashes[asset]=sha(b);save(layer.toLowerCase()+'/entry/'+(origin===host?'custom':'immutable')+'/'+asset.slice(1),b)}
    save(layer.toLowerCase()+'/entry/'+(origin===host?'custom':'immutable')+'/index.html',html);entries[origin]=hashes
   }
   need(same(entries[host],entries[identity.url]),'custom domain assets differ from retained Pages deployment')
   const again=await get(prefix+'/pages/projects/'+project);need(again.canonical_deployment?.id===identity.deployment,'Pages pointer drift during capture')
   pending.push(layer+': complete dist/control files and compiled Functions not exported by deployment metadata; native rollback target identified but not exercised')
   return {status:'BLOCKED',...identity,project,retainedProductionTarget:'PASS',entryBytes:'PASS',fullLocalArtifact:'BLOCKED',compiledFunctionsBackup:identity.usesFunctions===false?'NOT_APPLICABLE: deployment reports no Functions':'BLOCKED',recoverable:'BLOCKED'}
  })
 }
 need(await active()===versionId,'Worker traffic drift during capture; incomplete evidence retained')
 save('prior-audit-receipt.json',{path:audit.path,sha256:audit.sha256,sourceHead:audit.report.inspectorHead,schema:'PASS reused; zero D1 queries in capture'})
 save('read-ledger.private.json',calls)
 const manifest={task:'KAW-G8-006',toolHead:head,sourceBaseline:BASE,createdAt:new Date().toISOString(),remoteWrites:0,remoteD1Queries:0,decision:'NO-GO',accountFingerprint:sha(reader.account),layers,pending,files}
 save('rollback-plan.private.json',makePlan(manifest)); // Local non-executable instructions; never submitted to Cloudflare.
 writeFileSync(join(folder,'manifest.private.json'),JSON.stringify(manifest,null,2)+'\n',{mode:0o600,flag:'wx'});writeFileSync(join(folder,'manifest.sha256'),sha(readFileSync(join(folder,'manifest.private.json')))+'\n',{mode:0o600,flag:'wx'})
 // Integrity of captured files never certifies absent Pages artifacts/Functions or recovery.
 const verified=verifyBackup(folder)
 return {directory:folder,manifestSha256:verified.manifestSha256,scope:'Capture/integrity only; recoveryByLayer is authoritative',integrity:verified.integrity,API:layers.API.status,App:layers.App.status,Web:layers.Web.status,recovery:'BLOCKED',recoveryByLayer:{API:'BLOCKED',App:'BLOCKED',Web:'BLOCKED'},decision:'NO-GO',remoteWrites:0}
}
export async function main(args=process.argv.slice(2),{root=process.cwd(),platform=process.platform}={}){
 process.umask(0o077)
 if(args[0]==='--sha')args=['--preflight',...args]
 const mode=args[0]||'--preflight';need(['--preflight','--capture','--verify','--plan','--verify-native'].includes(mode),'unsupported mode; restore/deploy/upload not implemented')
 const offline=['--verify','--plan'].includes(mode),offset=offline||mode==='--verify-native'?2:1
 need(args[offset]==='--sha'&&/^[a-f0-9]{40}$/.test(args[offset+1]||'')&&args.length===offset+2,'use mode [private-directory for verify/plan/verify-native] --sha EXACT_HEAD')
 need(process.version==='v20.20.2','existing Node 20.20.2 required; nothing installed');need(platform==='darwin','private evidence capture/inspection is Mac-only')
 root=resolve(root);const head=git(root,'rev-parse','HEAD');need(head===args[offset+1]&&git(root,'status','--porcelain')==='','SHA mismatch or dirty tool checkout');git(root,'merge-base','--is-ancestor',BASE,'HEAD');assertG8Runtime(root)
 if(offline){const result=verifyBackup(resolve(args[1]));if(mode==='--plan')need(parse(join(resolve(args[1]),'rollback-plan.private.json')).executable===false,'restore plan must be non-executable');console.log(JSON.stringify({mode,integrity:result.integrity,recovery:'BLOCKED',decision:'NO-GO'}));return result}
 if(mode==='--verify-native'){
  const source=resolve(args[1]);verifyBackup(source);need(sha(readFileSync(join(source,'manifest.private.json')))===G86_MANIFEST,'G8.6 receipt fingerprint differs')
  const toolsRoot=resolve(process.env.KAWVO_READONLY_TOOL_ROOT||root);need(sha(readFileSync(join(toolsRoot,'package-lock.json')))===sha(readFileSync(join(root,'package-lock.json'))),'existing tool checkout lockfile differs')
  const result=await verifyNativeRecovery({reader:credentials(toolsRoot),folder:source}),gh=githubAudit(toolsRoot),hooks=gh.hooks
  result.remainingAutomation={githubHooks:Array.isArray(hooks)?(hooks.some(h=>h.active)?'BLOCKED: active hooks require destination/trigger review':'PASS: no active repository webhooks reported'):'BLOCKED: existing gh administrative read unavailable',githubApps:'BLOCKED: this API/session does not inventory every installed GitHub App; known Cloudflare automations already confirmed disabled, not re-audited',githubRead:gh}
  const logs=join(homedir(),'intap-release-logs');directory(logs);need(!logs.startsWith(root+sep)&&!logs.startsWith(toolsRoot+sep),'private output must stay outside checkouts')
  const out=mkdtempSync(join(logs,'kawvo-g8-native-'));writeFileSync(join(out,'receipt.private.json'),JSON.stringify(result,null,2),{mode:0o600,flag:'wx'})
  console.log(JSON.stringify({mode,head,sourceManifestSha256:G86_MANIFEST,API:result.layers.API.status,App:result.layers.App.status,Web:result.layers.Web.status,remainingAutomation:{githubHooks:result.remainingAutomation.githubHooks,githubApps:result.remainingAutomation.githubApps},evidence:out,remoteWrites:0,recaptureExecuted:false,remoteRestoreRehearsed:false,decision:'NO-GO'}));return result
 }
 const logs=join(homedir(),'intap-release-logs'),audit=readG85(logs)
 if(mode==='--preflight'){const result={status:'PASS',scope:'Local SHA/runtime/permissions and existing G8.5 receipt; no network requests',head,auditReceiptSha256:audit.sha256,API:'BLOCKED: capture required',App:'BLOCKED',Web:'BLOCKED',decision:'NO-GO'};console.log(JSON.stringify(result));return result}
 const toolsRoot=resolve(process.env.KAWVO_READONLY_TOOL_ROOT||root);need(sha(readFileSync(join(toolsRoot,'package-lock.json')))===sha(readFileSync(join(root,'package-lock.json'))),'existing Wrangler tool checkout lockfile differs')
 need(logs!==root&&!logs.startsWith(root+sep)&&logs!==toolsRoot&&!logs.startsWith(toolsRoot+sep),'private output must be outside tool checkouts')
 need((lstatSync(logs).mode&0o300)===0o300,'private destination is not writable/searchable by owner')
 const reader=credentials(toolsRoot),folder=mkdtempSync(join(logs,'kawvo-g8-backup-'))
 try{const result=await captureBackup({reader,audit,folder,head});console.log(JSON.stringify(result));return result}catch(e){writeFileSync(join(folder,'incomplete.private.json'),JSON.stringify({status:'BLOCKED',reason:e.message?.startsWith('BLOCKED:')?e.message:'Capture read failed; raw error omitted',instruction:'Evidence retained; do not restore or retry writes',remoteWrites:0}),{mode:0o600,flag:'wx'});blocked('capture incomplete; private evidence retained in '+folder)}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)main().catch(e=>{console.error(e.message?.startsWith('BLOCKED:')?e.message:'BLOCKED: local backup preparation failed; raw details omitted');process.exitCode=1})
