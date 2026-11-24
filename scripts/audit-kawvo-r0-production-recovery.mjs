import {execFileSync} from 'node:child_process'
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import {homedir,tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
const SHA='df36677ce7c8988673bd79dd713273a0612950ec', ACTIVE='68103746-efb9-4f45-b4fa-d58388ed32b1'
const BASE='https://api.cloudflare.com/client/v4/accounts/adf4d5ebb625fed2c32e38cef57a6319'
const DIR=join(homedir(),'intap-release-logs','r0-production-recovery-'+SHA.slice(0,12))
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
const files=[]
function save(name,obj){
 const b=Buffer.isBuffer(obj)?obj:Buffer.from(JSON.stringify(obj,null,2))
 writeFileSync(join(DIR,name),b,{flag:'wx',mode:0o600})
 files.push({name,bytes:b.length,sha256:hash(b)})
}
async function main(){
 process.umask(0o077)
 assert(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()===SHA,'candidate mismatch')
 assert(!existsSync(DIR),'capture exists; preserve evidence')
 const t=auth()
 await traffic('intap-api',ACTIVE,t)
 await traffic('intap-api-preview','8f12558b-dc0b-40c5-a741-8f0d5a1bcb79',t)
 const v=await get('/workers/workers/intap-api/versions/'+ACTIVE+'?include=modules',t)
 assert(v.id===ACTIVE&&v.modules?.length&&v.modules.some(m=>m.name===v.main_module),'module missing')
 assert(v.bindings?.length&&new Set(v.bindings.map(b=>b.name)).size===v.bindings.length,'binding identity invalid')
 const b=n=>v.bindings.find(x=>x.name===n)
 assert(b('ENVIRONMENT')?.text==='production'&&b('DB')?.type==='d1'&&b('BUCKET')?.bucket_name==='intap-r2','wrong environment')
 mkdirSync(DIR,{recursive:true,mode:0o700})
 const clean=structuredClone(v)
 for(const b of clean.bindings)if(b.type.includes('secret'))for(const k of Object.keys(b))if(!['name','type'].includes(k))delete b[k]
 save('api-version.private.json',clean)
 const modules=v.modules.map((m,i)=>{const raw=Buffer.from(m.content_base64,'base64');assert(raw.length,'empty module');save('module-'+i+'.bin',raw);return {name:m.name,sha256:hash(raw)}})
 const app=await pages('intap-web2','https://app.intaprd.com','/admin/login','630cb1f0',t)
 const web=await pages('intap-link','https://intaprd.com','/','acd10d69-8b6f-4554-b2d5-2485e0ab583b',t)
 assert(web.commit==='6c469c1db47065c46b72b949944aef97de1f7c1a','Web commit drift')
 const inventory=JSON.parse(readFileSync('contracts/protected-profiles.production.json','utf8'))
 const sitemap=(await bytes('https://intaprd.com/sitemap.xml')).toString(),llms=(await bytes('https://intaprd.com/llms.txt')).toString()
 const profiles=[]
 for(const p of inventory.profiles){
  const url='https://intaprd.com/'+p.slug
  const r=await fetch(url,{headers:{'User-Agent':'Twitterbot/1.0'},redirect:'error',signal:AbortSignal.timeout(30000)})
  assert(r.ok,'profile HTTP '+p.slug)
  const html=await r.text()
  assert(html.includes('rel="canonical" href="'+url+'"')&&html.includes('property="og:image"')&&html.includes('name="twitter:card"'),'metadata missing '+p.slug)
  assert(sitemap.includes(url)&&llms.includes('/'+p.slug),'discovery missing '+p.slug)
  const ai=await bytes(url+'/ai.md'),facts=await bytes(url+'/facts.json')
  JSON.parse(facts.toString());assert(ai.length>=60,'ai.md incomplete '+p.slug)
  profiles.push({slug:p.slug,aiSHA:hash(ai),factsSHA:hash(facts)})
 }
 await traffic('intap-api',ACTIVE,t)
 await traffic('intap-api-preview','8f12558b-dc0b-40c5-a741-8f0d5a1bcb79',t)
 const receipt={result:'PASS_R0_RECOVERY_PREFLIGHT',candidate:SHA,api:ACTIVE,modules,bindings:v.bindings.length,app,web,profiles,files:[...files],restoreRehearsed:false,remoteWrites:0}
 for(const f of files)assert(hash(readFileSync(join(DIR,f.name)))===f.sha256,'capture integrity failure')
 save('receipt.json',receipt)
 console.log(JSON.stringify({...receipt,profiles:profiles.length,files:undefined,evidence:DIR},null,2))
}
main().catch(e=>{console.error('BLOCKED: '+String(e.message||e));process.exitCode=1})
