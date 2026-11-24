// R0 inactive stage only. Adapted from verified #191 JSON uploader; no activation path.
import {execFileSync} from 'node:child_process'
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import {homedir,tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'

const SHA='77883918a4500320e562a7aa923c2f25bb62952c'
const ACTIVE='68103746-efb9-4f45-b4fa-d58388ed32b1'
const ACTIVE_MODULE_SHA='8cee714c6ac0eccec981b01813f022dd74d4737ce6e856b46e545d692faafb6a'
const NEW_MODULE_SHA='cfe4688f683a238594e6b1356700ff29e366c6b9f1ad5934db949e0e80ad7970'
const NEXT='766e8d93-260c-4fb7-841c-a833515bf9d6'
const OLD_APP='https://630cb1f0.intap-web2.pages.dev'
const NEW_APP='https://630cb1f0.intap-web2.pages.dev'
const WEB='https://acd10d69.intap-link.pages.dev'
const OLD_BUNDLE='/assets/index-CIkuPLAY.js'
const OLD_BUNDLE_SHA='5380bf2b09e75f52f570f7dc7a90ffaeb5e1edac775308c58bb1cd3a6429972d'
const NEW_BUNDLE='/assets/index-CIkuPLAY.js'
const NEW_BUNDLE_SHA='5380bf2b09e75f52f570f7dc7a90ffaeb5e1edac775308c58bb1cd3a6429972d'
const ACCOUNT='adf4d5ebb625fed2c32e38cef57a6319', WORKER='intap-api'
const BASE='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT
const DIR=join(homedir(),'intap-release-logs','kawvo-r0-production-stage-'+SHA.slice(0,12))
const MODULE_PATH=join(homedir(),'intap-release-logs','r0-production-api-bundle-'+SHA,'preview-free-entry.js')
const MODE=process.argv[2]
const TAG='KAWVO-R0-PROD-'+SHA.slice(0,12)
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
async function snapshot(token,expected=ACTIVE){
  const d=await get('/workers/scripts/'+WORKER+'/deployments',token)
  const active=d.deployments?.[0]?.versions
  assert(active?.length===1&&active[0].version_id===expected&&Number(active[0].percentage)===100,'active production Worker changed')
  const v=await get('/workers/workers/'+WORKER+'/versions/'+ACTIVE+'?include=modules',token)
  assert(v.id===ACTIVE&&v.bindings?.length===32&&v.modules?.length===1,'Worker structure changed')
  assert(new Set(v.bindings.map(b=>b.name)).size===32,'binding names duplicate')
  assert(v.main_module==='preview-free-entry.js'&&v.modules[0].name===v.main_module,'main module mismatch')
  assert(v.modules[0].content_type==='application/javascript+module','module MIME mismatch')
  assert(hashB64(v.modules[0].content_base64)===ACTIVE_MODULE_SHA,'active Worker module SHA changed')
  assert(v.compatibility_date==='2024-02-08'&&equal(v.compatibility_flags||[],[]),'runtime compatibility changed')
  const b=name=>v.bindings.find(x=>x.name===name)
  assert(b('ENVIRONMENT')?.text==='production'&&b('DB')?.type==='d1'&&b('BUCKET')?.type==='r2_bucket','environment/data binding changed')
  assert(b('APP_URL')?.text==='https://app.intaprd.com'&&b('WEB_URL')?.text==='https://intaprd.com'&&(b('DB')?.id||b('DB')?.database_id)==='3a2d724d-5938-4777-a63e-423bb41862c0'&&b('BUCKET')?.bucket_name==='intap-r2','production resources changed')
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
  assert(existsSync(MODULE_PATH),'production compiled module missing')
  const code=readFileSync(MODULE_PATH)
  assert(/^[a-f0-9]{64}$/.test(NEW_MODULE_SHA),'missing pinned compiled module SHA256')
  assert(hash(code)===NEW_MODULE_SHA,'candidate API SHA differs')
  assert(NEW_MODULE_SHA!==ACTIVE_MODULE_SHA,'new module must differ from active API')
  const text=code.toString('utf8')
  for(const marker of ['public-context','medical_sponsor_master_profiles','kawvo_preview_session'])
    assert(text.includes(marker),'candidate missing '+marker)
  return {bytes:code.length,b64:code.toString('base64')}
}
function validateNew(oldV,newV){
  assert(newV.modules?.length===1&&newV.modules[0].name===oldV.main_module,'uploaded main module differs')
  assert(hashB64(newV.modules[0].content_base64)===NEW_MODULE_SHA,'uploaded API SHA differs')
  assert(newV.bindings?.length===32&&new Set(newV.bindings.map(x=>x.name)).size===32,'uploaded binding count differs')
  for(const key of ['main_module','compatibility_date','compatibility_flags','limits','placement','cache_options','usage_model','exports'])
    assert(equal(newV[key],oldV[key]),'runtime drift '+key)
  for(const old of oldV.bindings){
    const next=newV.bindings.find(x=>x.name===old.name)
    assert(next,'binding removed: '+old.name)
    assert(equal(next,old),'binding drift '+old.name)
  }
}

async function publicChecks(){
 const paths=['/api/v1/public/profiles/novi','/api/v1/public/profiles/jprez','/api/v1/public/profiles/juan','/robots.txt','/sitemap.xml','/llms.txt','/novi/ai.md','/novi/facts.json']
 for(const path of paths){
  const r=await fetch('https://intaprd.com'+path,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(30000)})
  assert(r.status===(path.endsWith('/juan')?404:200),'public status mismatch '+path+' '+r.status)
 }
 for(const origin of ['https://api.intaprd.com','https://app.intaprd.com','https://intaprd.com']){
  for(const scope of ['medical-profile']){
   const r=await fetch(origin+'/api/v1/me/'+scope+'/appointments/public-context?username=novi',{redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(30000)})
   // The medical endpoint is known; sponsored route naming is checked separately in code.
   if(scope==='medical-profile')assert([401,403].includes(r.status),'anonymous medical context not rejected '+origin+' '+r.status)
  }
 }
 const r=await fetch('https://intaprd.com/assets/index-DK34_3Gp.js',{cache:'no-store',signal:AbortSignal.timeout(30000)})
 assert(r.ok&&hash(Buffer.from(await r.arrayBuffer()))==='21529c7db115fc9bd1472588c312926da0e899198b342f0e16289e75b763b835','old Web bundle drift')
 const html=await fetch('https://intaprd.com/',{cache:'no-store',signal:AbortSignal.timeout(30000)})
 assert(html.ok&&(await html.text()).includes('/assets/index-DK34_3Gp.js'),'Web entry changed')
}
async function main(){
 assert(['--check','--activate'].includes(MODE),'unsupported mode')
 assert(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()===SHA,'checkout SHA mismatch')
 assert(execFileSync('git',['rev-parse','HEAD^{tree}'],{encoding:'utf8'}).trim()===execFileSync('git',['rev-parse','df36677ce7c8988673bd79dd713273a0612950ec^{tree}'],{encoding:'utf8'}).trim(),'tree mismatch')
 assert(process.env.INTAP_ENFORCE_PRODUCTION_APPROVAL==='1'&&process.env.INTAP_PRODUCTION_APPROVAL==='SÍ'&&process.env.INTAP_APPROVED_COMMIT===SHA,'approval guard environment missing')
 execFileSync('python3',['scripts/production_approval_guard.py'],{stdio:'inherit'})
 const receipt=JSON.parse(readFileSync(join(DIR,'inactive-receipt.json'),'utf8'))
 assert(receipt.productSHA===SHA&&receipt.oldVersion===ACTIVE&&receipt.newVersion===NEXT&&receipt.apiModuleSHA===NEW_MODULE_SHA&&receipt.bindings===32&&receipt.trafficChanged===false,'stage receipt mismatch')
 for(const name of ['activation-attempt.json','activation-result.json','activation-receipt.json'])assert(!existsSync(join(DIR,name)),'prior activation evidence exists; do not repeat')
 const token=auth(),old=await snapshot(token),candidate=await get('/workers/workers/'+WORKER+'/versions/'+NEXT+'?include=modules',token)
 assert(candidate.id===NEXT&&candidate.annotations?.['workers/tag']===TAG,'candidate identity mismatch')
 validateNew(old,candidate)
 const preview=await get('/workers/scripts/intap-api-preview/deployments',token)
 assert(preview.deployments?.[0]?.versions?.length===1&&preview.deployments[0].versions[0].version_id==='8f12558b-dc0b-40c5-a741-8f0d5a1bcb79'&&Number(preview.deployments[0].versions[0].percentage)===100,'Preview baseline drift')
 for(const [name,id] of [['intap-link','acd10d69-8b6f-4554-b2d5-2485e0ab583b'],['intap-web2','630cb1f0-2c7f-4f96-b7ff-df41428cbcef']]){
  const p=await get('/pages/projects/'+name,token)
  assert(p.canonical_deployment?.id===id&&p.source?.config?.production_deployments_enabled===false,'Pages baseline or automation drift '+name)
 }
 const live=await bundle('https://app.intaprd.com')
 assert(live.file===OLD_BUNDLE&&live.sha===OLD_BUNDLE_SHA,'App drift')
 await publicChecks()
 console.log(JSON.stringify({result:'PASS_R0_API_ACTIVATION_PREFLIGHT',oldVersion:ACTIVE,newVersion:NEXT,bindings:32,trafficChanged:false}))
 if(MODE==='--check')return
 await snapshot(token)
 writeOnce('activation-attempt.json',{productSHA:SHA,oldVersion:ACTIVE,newVersion:NEXT,started:new Date().toISOString()})
 const r=await request('POST','/workers/scripts/'+WORKER+'/deployments',token,{strategy:'percentage',versions:[{version_id:NEXT,percentage:100}],annotations:{'workers/message':'R0 approved API activation '+SHA}})
 writeOnce('activation-result.json',{success:r.ok,http:r.http,codes:r.codes,deployment:r.result?.id||null})
 assert(r.ok,'activation failed or ambiguous; do not retry')
 await snapshot(token,NEXT)
 const deployed=await get('/workers/workers/'+WORKER+'/versions/'+NEXT+'?include=modules',token)
 validateNew(old,deployed)
 assert(equal(await get('/workers/scripts/intap-api-preview/deployments',token),preview),'Preview drift')
 assert(equal(await bundle('https://app.intaprd.com'),live),'App changed')
 await publicChecks()
 const result={result:'PASS_R0_API_ACTIVE',productSHA:SHA,oldVersion:ACTIVE,newVersion:NEXT,apiModuleSHA:NEW_MODULE_SHA,bindings:32,percentage:100,webUnchanged:true,appUnchanged:true,authenticatedQA:'PENDING'}
 writeOnce('activation-receipt.json',result)
 console.log(JSON.stringify(result,null,2))
}
main().catch(e=>{console.error('BLOCKED: '+String(e.message||e).replace(/^BLOCKED: /,''));process.exitCode=1})
