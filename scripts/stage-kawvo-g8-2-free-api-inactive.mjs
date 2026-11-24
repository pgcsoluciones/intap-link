// G8.2 Free — INACTIVE API Preview stage, proven G7.1 JSON Workers versions API.
// --check is read-only. --upload creates ONE deploy=false version and verifies
// bytes/bindings, but NEVER changes traffic. No production, D1 or R2 writes.
import {execFileSync} from 'node:child_process'
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import {homedir,tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'

const SHA='1188010f37151b8d17778256c744403fa35522dc'
const ACTIVE='2fa16f51-8504-4101-9266-ea9fe51e6803'
const ACTIVE_MODULE_SHA='88d21dd0eb3cdd6766960e3234bc490bc4b15e60698643918a980907ac0f71da'
const NEW_MODULE_SHA='cc3cf71f6e371cada97d7caf325546f5bd3c95bc83091bc012d1b90734265ace'
const OLD_APP='https://bd482514.intap-web2.pages.dev'
const NEW_APP='https://c5bf3abb.intap-web2.pages.dev'
const WEB='https://7014ce2e.intap-link.pages.dev'
const OLD_BUNDLE='/assets/index-DU9Euvfp.js'
const OLD_BUNDLE_SHA='354af5c79bf554196536cf33755876b2ee5afa3ed5cc6311bbfd827e6069c103'
const NEW_BUNDLE='/assets/index-DBVubrbE.js'
const NEW_BUNDLE_SHA='1231dc64e79fa28022e6e4a2192a197e66451369434f9b55caa642b06b3935a8'
const ACCOUNT='adf4d5ebb625fed2c32e38cef57a6319', WORKER='intap-api-preview'
const BASE='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT
const DIR=join(homedir(),'intap-release-logs','kawvo-g82-free-api-inactive-'+SHA.slice(0,12))
const MODULE_PATH=join(homedir(),'intap-release-logs','g82-free-api-bundle-'+SHA,'preview-frontdoor-entry.js')
const MODE=process.argv[2]
const TAG='KAWVO-G82-FREE-API-'+SHA.slice(0,12)
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
function checkLocal(){
  assert(existsSync(MODULE_PATH),'G8.2 compiled module missing')
  const code=readFileSync(MODULE_PATH)
  assert(hash(code)===NEW_MODULE_SHA,'candidate API SHA differs')
  const text=code.toString('utf8')
  for(const marker of ['preview_retry','profile_preview_sessions','kawvo_preview_session'])
    assert(text.includes(marker),'candidate missing '+marker)
  return {bytes:code.length,b64:code.toString('base64')}
}
function validateNew(oldV,newV){
  assert(newV.modules?.length===1&&newV.modules[0].name===oldV.main_module,'uploaded main module differs')
  assert(hashB64(newV.modules[0].content_base64)===NEW_MODULE_SHA,'uploaded API SHA differs')
  assert(newV.bindings?.length===35&&new Set(newV.bindings.map(x=>x.name)).size===35,'uploaded binding count differs')
  for(const key of ['main_module','compatibility_date','compatibility_flags','limits','placement','cache_options','usage_model','exports'])
    assert(equal(newV[key],oldV[key]),'runtime drift '+key)
  for(const old of oldV.bindings){
    const next=newV.bindings.find(x=>x.name===old.name)
    assert(next,'binding removed: '+old.name)
    if(old.name==='APP_PAGES_ORIGIN')assert(next.type==='plain_text'&&next.text===NEW_APP,'App origin incorrect')
    else assert(equal(next,old),'binding drift '+old.name)
  }
}
async function main(){
  assert(['--check','--upload','--promote'].includes(MODE)&&process.argv.length===3,'use --check, --upload or --promote')
  const local=checkLocal()
  const token=auth(),old=await snapshot(token)
  const [history,live,stage]=await Promise.all([versionList(token),bundle('https://app.preview.intaprd.com'),bundle(NEW_APP)])
  assert(live.file===OLD_BUNDLE&&live.sha===OLD_BUNDLE_SHA,'official App bundle changed')
  assert(stage.file===NEW_BUNDLE&&stage.sha===NEW_BUNDLE_SHA,'staged App bundle changed')
  const candidates=history.filter(x=>x.annotations?.['workers/tag']===TAG)
  assert(candidates.length===0,'G8.2 candidate already in version history; do not upload again')
  const marker=join(DIR,'upload-attempt.json')
  const hasAttempt=existsSync(marker)||existsSync(join(DIR,'upload-result.json'))||existsSync(join(DIR,'inactive-receipt.json'))
  const safe=!hasAttempt
  if(MODE==='--check'){
    console.log(JSON.stringify({result:safe?'PASS_G82_FREE_API_INACTIVE_PREFLIGHT':'BLOCKED',operation:'READ_ONLY',productSHA:SHA,activeVersion:ACTIVE,bindings:old.bindings.length,modules:old.modules.length,currentOrigin:OLD_APP,webOrigin:WEB,stagedOrigin:NEW_APP,stagedAppBundle:stage,apiModuleSHA:NEW_MODULE_SHA,apiModuleBytes:local.bytes,candidateVersions:candidates.length,attemptExists:hasAttempt,ready:safe},null,2))
    return
  }
  assert(safe,'prior upload attempt exists; never retry')
  mkdirSync(DIR,{recursive:true,mode:0o700})
  const newModule={...old.modules[0],content_base64:local.b64}
  const metadata={
    main_module:old.main_module,
    modules:[newModule],
    bindings:old.bindings.map(b=>b.name==='APP_PAGES_ORIGIN'?{name:b.name,type:'plain_text',text:NEW_APP}:{name:b.name,type:'inherit',version_id:ACTIVE}),
    annotations:{'workers/tag':TAG,'workers/message':'G8.2 Free API inactive stage; API code + App Pages only; baseline '+ACTIVE}
  }
  for(const key of ['compatibility_date','compatibility_flags','limits','placement','cache_options','usage_model','exports'])
    if(old[key]!==undefined&&old[key]!==null)metadata[key]=old[key]
  writeOnce('upload-attempt.json',{productSHA:SHA,oldVersion:ACTIVE,oldOrigin:OLD_APP,newOrigin:NEW_APP,webOrigin:WEB,oldModule:ACTIVE_MODULE_SHA,newModule:NEW_MODULE_SHA,tag:TAG,versionHistoryIds:history.map(x=>x.id),started:new Date().toISOString()})
  const uploaded=await request('POST','/workers/workers/'+WORKER+'/versions?deploy=false',token,metadata)
  writeOnce('upload-result.json',{success:uploaded.ok,http:uploaded.http,codes:uploaded.codes,newVersion:uploaded.result?.id||null})
  assert(uploaded.ok&&/^[a-f0-9-]{36}$/i.test(uploaded.result?.id||''),'upload failed or ambiguous; do not retry')
  const newId=uploaded.result.id
  const newV=await get('/workers/workers/'+WORKER+'/versions/'+newId+'?include=modules',token)
  validateNew(old,newV)
  await snapshot(token) // STILL old version at 100%
  const official=await bundle('https://app.preview.intaprd.com')
  assert(equal(official,live),'official Preview changed unexpectedly')
  writeOnce('inactive-receipt.json',{result:'PASS_G82_FREE_API_INACTIVE',productSHA:SHA,oldVersion:ACTIVE,newVersion:newId,apiModuleSHA:NEW_MODULE_SHA,appOrigin:NEW_APP,webOrigin:WEB,bindings:35,trafficChanged:false,productionTouched:false})
  if(MODE==='--upload'){
    console.log(JSON.stringify({result:'PASS_G82_FREE_API_INACTIVE',newVersion:newId,oldVersion:ACTIVE,apiModuleSHA:NEW_MODULE_SHA,appOrigin:NEW_APP,webOrigin:WEB,activeTrafficUnchanged:true,productionUntouched:true},null,2))
    return
  }
  // --promote: this is the only authorized activation path. The single
  // deployment write occurs only after the inactive version passes readback.
  const justBefore=await snapshot(token)
  assert(justBefore.id===ACTIVE,'Preview baseline moved before activation')
  const beforeTraffic=await bundle('https://app.preview.intaprd.com')
  assert(equal(beforeTraffic,live),'official App changed before activation')
  assert(!existsSync(join(DIR,'activation-attempt.json')),'activation already attempted')
  writeOnce('activation-attempt.json',{productSHA:SHA,oldVersion:ACTIVE,newVersion:newId,started:new Date().toISOString()})
  const activation=await request('POST','/workers/scripts/'+WORKER+'/deployments',token,{
    strategy:'percentage',
    versions:[{version_id:newId,percentage:100}],
    annotations:{'workers/message':'G8.2 Free Preview QA; rollback to '+ACTIVE}
  })
  writeOnce('activation-result.json',{success:activation.ok,http:activation.http,codes:activation.codes})
  assert(activation.ok,'activation failed or ambiguous; do not retry; inspect deployment read-only')
  const deployed=await get('/workers/scripts/'+WORKER+'/deployments',token)
  const actual=deployed.deployments?.[0]?.versions
  assert(actual?.length===1&&actual[0].version_id===newId&&Number(actual[0].percentage)===100,'deployment readback mismatch; do not retry')
  const promoted=await get('/workers/workers/'+WORKER+'/versions/'+newId+'?include=modules',token)
  validateNew(old,promoted)
  const appLive=await bundle('https://app.preview.intaprd.com')
  assert(appLive.file===NEW_BUNDLE&&appLive.sha===NEW_BUNDLE_SHA,'official App bundle mismatch; do not repeat promotion')
  writeOnce('promotion-receipt.json',{result:'PASS_G82_FREE_OFFICIAL_PREVIEW',productSHA:SHA,oldVersion:ACTIVE,newVersion:newId,appOrigin:NEW_APP,webOrigin:WEB,apiSHA256:NEW_MODULE_SHA,appBundle:appLive,productionTouched:false})
  console.log(JSON.stringify({result:'PASS_G82_FREE_OFFICIAL_PREVIEW',productSHA:SHA,oldVersion:ACTIVE,newVersion:newId,apiSHA256:NEW_MODULE_SHA,appOrigin:NEW_APP,webOrigin:WEB,appBundle:appLive,productionUntouched:true,qaAuthenticatedPending:true},null,2))
}
main().catch(e=>{console.error(String(e?.message||e).startsWith('BLOCKED:')?String(e.message):'BLOCKED: '+String(e?.message||e));process.exitCode=1})
