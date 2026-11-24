import {execFileSync} from 'node:child_process'
import {existsSync,mkdirSync,readFileSync,writeFileSync,readdirSync,lstatSync} from 'node:fs'
import {homedir,tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
const SHA='77883918a4500320e562a7aa923c2f25bb62952c', ACTIVE='766e8d93-260c-4fb7-841c-a833515bf9d6'
const BASE='https://api.cloudflare.com/client/v4/accounts/adf4d5ebb625fed2c32e38cef57a6319'
const DIR=join(homedir(),'intap-release-logs','kawvo-r0-production-stage-'+SHA.slice(0,12))
const assert=(ok,msg)=>{if(!ok)throw Error(msg)}
const hash=b=>createHash('sha256').update(b).digest('hex')
function auth(){
  if(process.env.CLOUDFLARE_API_TOKEN)return 'Bearer '+process.env.CLOUDFLARE_API_TOKEN
  execFileSync('npx',['--yes','--package=wrangler@4.166.0','--','wrangler','whoami'],{cwd:tmpdir(),stdio:'pipe'})
  const paths=['Library/Preferences/.wrangler/config/default.toml','.wrangler/config/default.toml','.config/.wrangler/config/default.toml'].map(p=>join(homedir(),p)).filter(existsSync)
  assert(paths.length===1,'Wrangler OAuth source missing or ambiguous')
  const token=readFileSync(paths[0],'utf8').match(/^oauth_token\s*=\s*"([^"\r\n]+)"/m)?.[1]
  assert(token,'Wrangler OAuth token missing')
  return 'Bearer '+token
}


async function get(path,token){
 const r=await fetch(BASE+path,{method:'GET',headers:{Authorization:token},redirect:'error',signal:AbortSignal.timeout(30000)})
 const b=await r.json().catch(()=>null)
 assert(r.ok&&b?.success===true,'GET '+path+' HTTP '+r.status)
 return b.result
}
async function bytes(url){
 const r=await fetch(url,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(30000)})
 assert(r.ok,'HTTP '+r.status+' '+url)
 return Buffer.from(await r.arrayBuffer())
}
async function traffic(name,id,t){
 const d=await get('/workers/scripts/'+name+'/deployments',t)
 const v=d.deployments?.[0]?.versions
 assert(v?.length===1&&v[0].version_id===id&&Number(v[0].percentage)===100,'traffic drift '+name)
}
async function pages(project,host,route,expected,t){
 const p=await get('/pages/projects/'+project,t),d=p.canonical_deployment
 assert(p.name===project&&p.production_branch==='main'&&d?.id?.startsWith(expected)&&d.environment==='production','canonical drift '+project)
 const v=await get('/pages/projects/'+project+'/deployments/'+d.id,t)
 assert(v.id===d.id&&v.environment==='production'&&v.latest_stage?.status==='success'&&v.deployment_trigger?.metadata?.branch==='main','retention metadata mismatch '+project)
 assert(v.url===d.url&&v.url==='https://'+expected.slice(0,8)+'.'+project+'.pages.dev','immutable origin mismatch')
 assert(typeof v.uses_functions==='boolean','Functions metadata unavailable')
 assert(p.source?.config?.production_deployments_enabled!==true,'auto deployment enabled '+project)
 const entries=[]
 for(const origin of [host,v.url]){
  const html=await bytes(origin+route)
  const assets=[...new Set(html.toString().match(/\/assets\/[A-Za-z0-9_./-]+\.(?:js|css)/g)||[])].sort()
  assert(assets.some(x=>x.endsWith('.js')),'entry assets missing')
  const a={}
  for(const path of assets)a[path]=hash(await bytes(origin+path))
  entries.push(a)
 }
 assert(JSON.stringify(entries[0])===JSON.stringify(entries[1]),'canonical assets differ '+project)
 return {id:v.id,url:v.url,commit:v.deployment_trigger.metadata.commit_hash,functions:v.uses_functions,autoDeploy:p.source?.config?.production_deployments_enabled??null,entryAssets:entries[0]}
}

async function main(){
 process.umask(0o077)
 assert(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()===SHA,'checkout mismatch')
 const baseline=JSON.parse(readFileSync(join(homedir(),'intap-release-logs','r0-production-recovery-df36677ce7c8','receipt.json'),'utf8'))
 const t=auth()
 await traffic('intap-api',ACTIVE,t)
 await traffic('intap-api-preview','8f12558b-dc0b-40c5-a741-8f0d5a1bcb79',t)
 const v=await get('/workers/workers/intap-api/versions/'+ACTIVE+'?include=modules',t)
 assert(v.id===ACTIVE&&v.bindings?.length===32&&v.modules?.length===1&&hash(Buffer.from(v.modules[0].content_base64,'base64'))==='cfe4688f683a238594e6b1356700ff29e366c6b9f1ad5934db949e0e80ad7970','active module drift')
 const old=await get('/workers/workers/intap-api/versions/68103746-efb9-4f45-b4fa-d58388ed32b1?include=modules',t)
 assert(old.id===baseline.api&&hash(Buffer.from(old.modules[0].content_base64,'base64'))===baseline.modules[0].sha256,'rollback API drift')
 for(const b of old.bindings)assert(JSON.stringify(b)===JSON.stringify(v.bindings.find(x=>x.name===b.name)),'binding drift '+b.name)
 const app=await pages('intap-web2','https://app.intaprd.com','/admin/login','630cb1f0',t)
 assert(JSON.stringify(app)===JSON.stringify(baseline.app),'App changed')
 const web=await pages('intap-link','https://intaprd.com','/','2d7c6df4',t)
 assert(web.commit===SHA&&web.functions===true&&web.autoDeploy===false,'Web metadata mismatch')
 assert(web.entryAssets['/assets/index-CVua0mAQ.js'],'new entry bundle missing')
 const retained=await get('/pages/projects/intap-link/deployments/'+baseline.web.id,t)
 assert(retained.id===baseline.web.id&&retained.latest_stage?.status==='success'&&retained.uses_functions===true,'Web recovery missing')
 const assets=readdirSync('web/dist/assets').filter(n=>/\.(js|css)$/.test(n)&&lstatSync(join('web/dist/assets',n)).isFile())
 for(let i=0;i<assets.length;i+=6)await Promise.all(assets.slice(i,i+6).map(async n=>{
  const sha=hash(readFileSync(join('web/dist/assets',n)))
  for(const host of ['https://intaprd.com',web.url])assert(hash(await bytes(host+'/assets/'+encodeURIComponent(n)))===sha,'asset mismatch '+n)
 }))
 const sitemap=(await bytes('https://intaprd.com/sitemap.xml')).toString(),llms=(await bytes('https://intaprd.com/llms.txt')).toString()
 assert(/sitemap/i.test((await bytes('https://intaprd.com/robots.txt')).toString()),'robots sitemap missing')
 const profiles=[]
 for(const p of baseline.profiles){
  const url='https://intaprd.com/'+p.slug
  const api=await fetch('https://intaprd.com/api/v1/public/profiles/'+p.slug,{redirect:'error',signal:AbortSignal.timeout(30000)})
  if(p.slug==='juan'){assert(api.status===404&&!sitemap.includes(url),'juan state changed');profiles.push({slug:p.slug,status:'UNCHANGED_UNAVAILABLE'});continue}
  assert(api.ok,'API profile missing '+p.slug)
  const r=await fetch(url,{headers:{'User-Agent':'Twitterbot/1.0'},redirect:'error',signal:AbortSignal.timeout(30000)})
  assert(r.ok,'profile HTTP '+p.slug)
  const html=await r.text()
  assert(html.includes('rel="canonical" href="'+url+'"')&&html.includes('property="og:image"')&&html.includes('name="twitter:card"'),'metadata missing '+p.slug)
  assert(sitemap.includes(url)&&llms.includes('/'+p.slug),'discovery missing '+p.slug)
  const ai=await bytes(url+'/ai.md'),facts=await bytes(url+'/facts.json')
  JSON.parse(facts.toString());assert(ai.length>=60,'ai.md incomplete '+p.slug)
  profiles.push({slug:p.slug,status:'PASS',aiUnchanged:hash(ai)===p.aiSHA,factsUnchanged:hash(facts)===p.factsSHA})
 }
 for(const slug of ['novi','aycdom2']){
  const path='/'+slug+'?ref=contract-test'
  const r=await fetch('https://link.avanxy.com'+path,{redirect:'manual',signal:AbortSignal.timeout(30000)})
  assert(r.status===301&&r.headers.get('location')==='https://intaprd.com'+path,'alias regression '+slug)
 }
 for(const host of ['https://api.intaprd.com','https://app.intaprd.com','https://intaprd.com']){
  const r=await fetch(host+'/api/v1/me/medical-profile/appointments/public-context?username=novi',{redirect:'manual',signal:AbortSignal.timeout(30000)})
  assert([401,403].includes(r.status),'anonymous medical context not rejected '+host)
 }
 await traffic('intap-api',ACTIVE,t)
 await traffic('intap-api-preview','8f12558b-dc0b-40c5-a741-8f0d5a1bcb79',t)
 const result={result:'PASS_R0_PRODUCTION_TECHNICAL_QA',productSHA:SHA,api:ACTIVE,web,app,assetsCompared:assets.length,profiles,authenticatedQA:'PENDING',remoteWrites:0}
 writeFileSync(join(DIR,'production-technical-qa.json'),JSON.stringify(result,null,2),{flag:'wx',mode:0o600})
 console.log(JSON.stringify(result,null,2))
}
main().catch(e=>{console.error('BLOCKED: '+String(e.message||e));process.exitCode=1})
