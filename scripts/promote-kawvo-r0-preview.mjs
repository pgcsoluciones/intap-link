import {execFileSync} from 'node:child_process'
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import {homedir,tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'

const SHA='50b969309e85920337f017643d525b9dc5381275'
const ACTIVE='a451e9d6-fa18-45a0-88ef-f82ab1318d6d'
const ACTIVE_MODULE_SHA='6b9aa97273fe27e99282b12da03894feb008bfbeefdfd789f703df8d48b71066'
const NEW_MODULE_SHA='1af792712416e349ba4ac0c91f5be94ff781fb5dc3237be9596006ad63c4ada1'
const OLD_APP='https://c5bf3abb.intap-web2.pages.dev'
const NEW_APP='https://c5bf3abb.intap-web2.pages.dev'
const WEB='https://7014ce2e.intap-link.pages.dev'
const OLD_BUNDLE='/assets/index-DBVubrbE.js'
const OLD_BUNDLE_SHA='1231dc64e79fa28022e6e4a2192a197e66451369434f9b55caa642b06b3935a8'
const NEW_BUNDLE='/assets/index-DBVubrbE.js'
const NEW_BUNDLE_SHA='1231dc64e79fa28022e6e4a2192a197e66451369434f9b55caa642b06b3935a8'
const ACCOUNT='adf4d5ebb625fed2c32e38cef57a6319', WORKER='intap-api-preview'
const BASE='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT
const DIR=join(homedir(),'intap-release-logs','kawvo-r0-preview-stage-'+SHA.slice(0,12))
const MODULE_PATH=join(homedir(),'intap-release-logs','r0-preview-api-bundle-'+SHA,'preview-frontdoor-entry.js')
const MODE=process.argv[2]
const TAG='KAWVO-R0-WEB-API-'+SHA.slice(0,12)
const assert=(ok,msg)=>{if(!ok)throw new Error('BLOCKED: '+msg)}
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const hashB64=base64=>hash(Buffer.from(base64,'base64'))
const equal=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null)
function writeOnce(name,value){writeFileSync(join(DIR,name),JSON.stringify(value,null,2),{flag:'wx',mode:0o600})}
function auth(){
  if(process.env.CLOUDFLARE_API_TOKEN)return 'Bearer '+process.env.CLOUDFLARE_API_TOKEN
  execFileSync('npx',['--yes','--package=wrangler@4.166.0','--','wrangler','whoami'],{cwd:tmpdir(),stdio:'pipe'})
  const paths=['Library/Preferences/.wrangler/config/default.toml','.wrangler/config/default.toml','.config/.wrangler/config/default.toml'].map(p=>join(homedir(),p)).filter(existsSync)
  assert(paths.length===1,'Wrangler OAuth source missing or ambiguous')
  const token=readFileSync(paths[0],'utf8').match(/^oauth_token\s*=\s*"([^"\r\n]+)"/m)?.[1]
  assert(token,'Wrangler OAuth token missing')
  return 'Bearer '+token
}
async function request(method,path,token,payload){
  const headers={Authorization:token}
  if(payload!==undefined)headers['Content-Type']='application/json'
  const res=await fetch(BASE+path,{method,headers,body:payload===undefined?undefined:JSON.stringify(payload),redirect:'error',signal:AbortSignal.timeout(method==='GET'?30000:120000)})
  const body=await res.json().catch(()=>null)
  return {ok:res.ok&&body?.success===true,http:res.status,result:body?.result||null,codes:(body?.errors||[]).map(x=>x.code).slice(0,4)}
}
async function get(path,token){
  const r=await request('GET',path,token)
  assert(r.ok,'GET '+path+' HTTP '+r.http+' codes '+r.codes.join(','))
  return r.result
}
async function snapshot(token){
  const d=await get('/workers/scripts/'+WORKER+'/deployments',token)
  const active=d.deployments?.[0]?.versions
  assert(active?.length===1&&active[0].version_id===ACTIVE&&Number(active[0].percentage)===100,'active Preview Worker changed')
  const v=await get('/workers/workers/'+WORKER+'/versions/'+ACTIVE+'?include=modules',token)
  assert(v.id===ACTIVE&&v.bindings?.length===35&&v.modules?.length===1,'Worker structure changed')
  assert(new Set(v.bindings.map(b=>b.name)).size===35,'binding names duplicate')
  assert(v.main_module==='preview-frontdoor-entry.js'&&v.modules[0].name===v.main_module,'main module mismatch')
  assert(v.modules[0].content_type==='application/javascript+module','module MIME mismatch')
  assert(hashB64(v.modules[0].content_base64)===ACTIVE_MODULE_SHA,'active Worker module SHA changed')
  assert(v.compatibility_date==='2024-02-08'&&equal(v.compatibility_flags||[],[]),'runtime compatibility changed')
  const b=name=>v.bindings.find(x=>x.name===name)
  assert(b('ENVIRONMENT')?.text==='preview'&&b('DB')?.type==='d1'&&b('BUCKET')?.type==='r2_bucket','environment/data binding changed')
  assert(b('APP_PAGES_ORIGIN')?.text===OLD_APP&&b('WEB_PAGES_ORIGIN')?.text===WEB,'Pages origin changed')
  return v
}
async function bundle(url){
  const r=await fetch(url+'/admin/login',{cache:'no-store',signal:AbortSignal.timeout(30000)})
  assert(r.ok,'HTML '+url+' HTTP '+r.status)
  const file=(await r.text()).match(new RegExp(String.raw`/assets/index-[A-Za-z0-9_-]+\.js`))?.[0]
  assert(file,'bundle missing '+url)
  const js=await fetch(url+file,{cache:'no-store',signal:AbortSignal.timeout(30000)})
  assert(js.ok,'JS '+url+' HTTP '+js.status)
  return {file,sha:hash(Buffer.from(await js.arrayBuffer()))}
}
async function versionList(token){
  const result=await get('/workers/workers/'+WORKER+'/versions',token)
  const rows=Array.isArray(result)?result:result?.items||result?.versions
  assert(Array.isArray(rows)&&rows.length,'version list missing')
  return rows
}

const STAGED='3a3ca802-464d-4cca-98bc-c869702cc67d'
const NEW_WEB='https://e388b303.intap-link.pages.dev'
const WEB_BRANCH='qa-kawvo-r0-50b96930'
const ROOT=join(homedir(),'Desktop','kawvo-r0-preview-qa')
const WEB_FILE='/assets/index-CiMhaZAR.js'
const RUNTIME=['main_module','compatibility_date','compatibility_flags','limits','placement','cache_options','usage_model','exports']
const version=(id,token)=>get('/workers/workers/'+WORKER+'/versions/'+id+'?include=modules',token)
async function active(token,id){
 const d=await get('/workers/scripts/'+WORKER+'/deployments',token)
 const v=d.deployments?.[0]?.versions
 assert(v?.length===1&&v[0].version_id===id&&Number(v[0].percentage)===100,'traffic baseline differs')
}
function compare(old,v,web){
 assert(v.modules?.length===1&&v.modules[0].name===old.main_module&&hashB64(v.modules[0].content_base64)===NEW_MODULE_SHA,'API module mismatch')
 for(const key of RUNTIME)assert(equal(old[key],v[key]),'runtime drift '+key)
 assert(v.bindings?.length===35&&new Set(v.bindings.map(x=>x.name)).size===35,'binding count mismatch')
 for(const b of old.bindings){
  const n=v.bindings.find(x=>x.name===b.name)
  assert(n,'missing binding '+b.name)
  assert(equal(n,b.name==='WEB_PAGES_ORIGIN'?{...b,text:web}:b),'binding drift '+b.name)
 }
}
async function webAsset(origin,file){
 const res=await fetch(origin+file,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(30000)})
 assert(res.ok,'asset HTTP '+res.status+' '+file)
 return hash(Buffer.from(await res.arrayBuffer()))
}
async function checkWeb(origin){
 const expected=hash(readFileSync(join(ROOT,'web/dist',WEB_FILE)))
 assert(await webAsset(origin,WEB_FILE)===expected,'Web main asset bytes differ')
 for(const name of ['ownerApiOrigin-B4iZ6fxd.js','KawMedProfile-C23SZa7C.js','SponsoredProfile-17EupizY.js','IntapLinkGratisProfile-CHQ1NwEw.js']){
  const path='/assets/'+name
  assert(await webAsset(origin,path)===hash(readFileSync(join(ROOT,'web/dist',path))),'Web chunk differs '+name)
 }
 const res=await fetch(origin+'/',{cache:'no-store',redirect:'follow',signal:AbortSignal.timeout(30000)})
 assert(res.ok&&(await res.text()).includes(WEB_FILE),'Web HTML does not reference candidate bundle')
 return expected
}
async function checkPages(token){
 const p=await get('/pages/projects/intap-link',token)
 assert(p.name==='intap-link'&&p.production_branch!==WEB_BRANCH,'Pages project/branch mismatch')
 // Use bounded read-only pagination instead of the rejected per_page=100.
 let d
 for(let page=1;page<=10;page++){
  const list=await get('/pages/projects/intap-link/deployments?env=preview&per_page=10&page='+page,token)
  const rows=Array.isArray(list)?list:list?.items
  assert(Array.isArray(rows),'Pages list response invalid')
  d=rows.find(x=>x.url===NEW_WEB)
  if(d||rows.length<10)break
 }
 assert(d?.id&&d.environment==='preview'&&d.deployment_trigger?.metadata?.branch===WEB_BRANCH&&d.deployment_trigger?.metadata?.commit_hash===SHA,'Pages immutable deployment identity mismatch')
 assert(d.latest_stage?.status==='success','Pages deployment not successful')
 return d.id
}
async function main(){
 assert(['--check','--promote'].includes(MODE)&&process.argv.length===3,'use --check or --promote')
 assert(execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim()===SHA,'local candidate mismatch')
 const receipt=JSON.parse(readFileSync(join(DIR,'inactive-receipt.json'),'utf8'))
 assert(receipt.result==='PASS_R0_API_INACTIVE'&&receipt.newVersion===STAGED&&receipt.productSHA===SHA&&receipt.apiModuleSHA===NEW_MODULE_SHA,'stage receipt mismatch')
 const token=auth(),old=await snapshot(token),candidate=await version(STAGED,token)
 compare(old,candidate,WEB)
 assert(candidate.annotations?.['workers/tag']==='KAWVO-R0-PREVIEW-'+SHA.slice(0,12),'staged API tag differs')
 const pageId=await checkPages(token),webHash=await checkWeb(NEW_WEB)
 const app=await bundle('https://app.preview.intaprd.com')
 assert(app.file===OLD_BUNDLE&&app.sha===OLD_BUNDLE_SHA,'App baseline mismatch')
 await active(token,ACTIVE)
 const history=await versionList(token)
 assert(!history.some(v=>v.annotations?.['workers/tag']===TAG),'candidate already uploaded; reconcile, never retry')
 for(const name of ['combined-upload-attempt.json','combined-upload-result.json','combined-inactive.json','combined-activation-attempt.json','combined-receipt.json'])
  assert(!existsSync(join(DIR,name)),'prior combined attempt exists; reconcile')
 const info={productSHA:SHA,oldVersion:ACTIVE,apiStage:STAGED,webDeployment:pageId,webOrigin:NEW_WEB,webBundle:WEB_FILE,webSHA256:webHash,appOrigin:OLD_APP,bindings:35}
 if(MODE==='--check'){console.log(JSON.stringify({result:'PASS_R0_PROMOTION_PREFLIGHT',...info,trafficChanged:false},null,2));return}
 const payload={main_module:candidate.main_module,modules:candidate.modules,bindings:old.bindings.map(b=>b.name==='WEB_PAGES_ORIGIN'?{name:b.name,type:'plain_text',text:NEW_WEB}:{name:b.name,type:'inherit',version_id:ACTIVE}),annotations:{'workers/tag':TAG,'workers/message':'R0 Preview API and Web; App unchanged; rollback '+ACTIVE}}
 for(const k of RUNTIME)if(k!=='main_module'&&old[k]!==undefined&&old[k]!==null)payload[k]=old[k]
 writeOnce('combined-upload-attempt.json',info)
 const up=await request('POST','/workers/workers/'+WORKER+'/versions?deploy=false',token,payload)
 writeOnce('combined-upload-result.json',{ok:up.ok,http:up.http,codes:up.codes,id:up.result?.id||null})
 assert(up.ok&&/^[a-f0-9-]{36}$/i.test(up.result?.id||''),'combined upload failed/ambiguous; do not retry')
 const id=up.result.id
 assert(id!==ACTIVE&&id!==STAGED,'unexpected combined ID')
 const staged=await version(id,token)
 compare(old,staged,NEW_WEB)
 assert(staged.annotations?.['workers/tag']===TAG,'combined tag mismatch')
 await snapshot(token)
 await checkWeb(NEW_WEB)
 assert(equal(await bundle('https://app.preview.intaprd.com'),app),'App changed before activation')
 writeOnce('combined-inactive.json',{...info,newVersion:id})
 await active(token,ACTIVE)
 writeOnce('combined-activation-attempt.json',{oldVersion:ACTIVE,newVersion:id})
 const result=await request('POST','/workers/scripts/'+WORKER+'/deployments',token,{strategy:'percentage',versions:[{version_id:id,percentage:100}],annotations:{'workers/message':'R0 Preview API+Web; rollback '+ACTIVE}})
 writeOnce('combined-activation-result.json',{ok:result.ok,http:result.http,codes:result.codes})
 assert(result.ok,'activation failed/ambiguous; do not retry')
 await active(token,id)
 compare(old,await version(id,token),NEW_WEB)
 assert(equal(await bundle('https://app.preview.intaprd.com'),app),'official App changed')
 assert(await checkWeb('https://preview.intaprd.com')===webHash,'official Web bytes differ')
 const done={result:'PASS_R0_PREVIEW_PROMOTED',...info,newVersion:id,authenticatedQA:'PENDING'}
 writeOnce('combined-receipt.json',done)
 console.log(JSON.stringify(done,null,2))
}
main().catch(e=>{console.error(String(e?.message||e).startsWith('BLOCKED:')?String(e.message):'BLOCKED: '+String(e?.message||e));process.exitCode=1})
