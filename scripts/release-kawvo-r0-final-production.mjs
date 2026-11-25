import {execFileSync,spawnSync} from 'node:child_process'
import {existsSync,mkdirSync,readFileSync,writeFileSync,readdirSync} from 'node:fs'
import {homedir,tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
const SHA='1751bb55a2aae1f0f390708c526241bc6a17de5d', API='766e8d93-260c-4fb7-841c-a833515bf9d6', PREVIEW='105c4ebe-b021-4e02-a637-36fdc17ba693'
const ROOT=join(homedir(),'Desktop','kawvo-r0-final-release'), DIR=join(homedir(),'intap-release-logs','r0-production-1751bb55')
const BASE='https://api.cloudflare.com/client/v4/accounts/adf4d5ebb625fed2c32e38cef57a6319'
const surfaces=[
 {project:'intap-web2',folder:'app',host:'https://app.intaprd.com',route:'/admin/login',old:'630cb1f0-2c7f-4f96-b7ff-df41428cbcef',oldEntry:'index-CIkuPLAY.js',oldHash:'5380bf2b09e75f52f570f7dc7a90ffaeb5e1edac775308c58bb1cd3a6429972d',entry:'index-NwmPq5TK.js',sha:'74e5a31a1cffc0676c5d755e45acf6457d05c269f03610c44cf9ac006310bc3d'},
 {project:'intap-link',folder:'web',host:'https://intaprd.com',route:'/',old:'2d7c6df4-3c4d-4281-81b5-969ccc26a731',oldEntry:'index-CVua0mAQ.js',oldHash:'4dad5f72712849c0ce9fc6351f4f98c3fc70d260d2e5e4f11a7abd595d40fca3',entry:'index-D0uAkmAN.js',sha:'cb1f51a4a1cdabb90c0f46c0da5185fa9cebb9141c3440b32b4ff34228a24e09'}
]
const assert=(ok,msg)=>{if(!ok)throw Error(msg)}
const hash=b=>createHash('sha256').update(b).digest('hex')
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const save=(name,obj)=>writeFileSync(join(DIR,name+'.json'),JSON.stringify(obj,null,2),{flag:'wx',mode:0o600})
function auth(){
 if(process.env.CLOUDFLARE_API_TOKEN)return 'Bearer '+process.env.CLOUDFLARE_API_TOKEN
 execFileSync('npx',['--yes','--package=wrangler@4.166.0','--','wrangler','whoami'],{cwd:tmpdir(),stdio:'pipe'})
 const paths=['Library/Preferences/.wrangler/config/default.toml','.wrangler/config/default.toml','.config/.wrangler/config/default.toml'].map(p=>join(homedir(),p)).filter(existsSync)
 assert(paths.length===1,'ambiguous OAuth source')
 const token=readFileSync(paths[0],'utf8').match(/^oauth_token\s*=\s*"([^"\r\n]+)"/m)?.[1]
 assert(token,'OAuth token missing');return 'Bearer '+token
}
async function main(){
 process.umask(0o077)
 assert(process.cwd()===ROOT,'incorrect directory')
 assert(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()===SHA,'wrong HEAD')
 assert(!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),'dirty checkout')
 const main=execFileSync('git',['ls-remote','https://github.com/pgcsoluciones/intap-link.git','refs/heads/main'],{encoding:'utf8'}).trim().split(/\s+/)[0]
 assert(main===SHA,'remote main drift')
 execFileSync('python3',['scripts/production_approval_guard.py'],{stdio:'inherit'})
 assert(process.env.INTAP_ENFORCE_PRODUCTION_APPROVAL==='1','guard not enforced')
 mkdirSync(DIR,{recursive:true})
 for(const name of ['preflight','app-attempt','app-receipt','web-attempt','web-receipt','final'])assert(!existsSync(join(DIR,name+'.json')),'prior release attempt; reconcile, do not repeat')
 const token=auth()
 async function get(path){
  const r=await fetch(BASE+path,{headers:{Authorization:token},redirect:'error',signal:AbortSignal.timeout(30000)})
  const j=await r.json().catch(()=>null)
  assert(r.ok&&j?.success===true,'GET '+path+' HTTP '+r.status);return j.result
 }
 async function bytes(url,headers={}){
  const r=await fetch(url,{headers,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(30000)})
  assert(r.ok,'HTTP '+r.status+' '+url);return Buffer.from(await r.arrayBuffer())
 }
 async function traffic(worker,id){
  const d=await get('/workers/scripts/'+worker+'/deployments'),v=d.deployments?.[0]?.versions
  assert(v?.length===1&&v[0].version_id===id&&Number(v[0].percentage)===100,'traffic drift '+worker)
 }
 async function workers(){
  await traffic('intap-api',API);await traffic('intap-api-preview',PREVIEW)
  const v=await get('/workers/workers/intap-api/versions/'+API+'?include=modules')
  assert(v.id===API&&v.bindings?.length===32&&v.modules?.length===1&&hash(Buffer.from(v.modules[0].content_base64,'base64'))==='cfe4688f683a238594e6b1356700ff29e366c6b9f1ad5934db949e0e80ad7970','production API drift')
 }
 async function project(s){
  const p=await get('/pages/projects/'+s.project)
  assert(p.name===s.project&&p.production_branch==='main'&&p.source?.config?.production_deployments_enabled===false,'project/auto-deploy mismatch '+s.project)
  return p
 }
 async function retained(s){
  const v=await get('/pages/projects/'+s.project+'/deployments/'+s.old)
  assert(v.id===s.old&&v.environment==='production'&&v.latest_stage?.status==='success'&&v.uses_functions===true&&v.deployment_trigger?.metadata?.branch==='main','rollback unavailable '+s.project)
  assert(v.url==='https://'+s.old.slice(0,8)+'.'+s.project+'.pages.dev','rollback URL mismatch')
  const html=await bytes(v.url+s.route)
  assert(html.toString().includes('/assets/'+s.oldEntry),'rollback entry mismatch')
  assert(hash(await bytes(v.url+'/assets/'+s.oldEntry))===s.oldHash,'rollback bytes mismatch')
  return {id:v.id,url:v.url,commit:v.deployment_trigger.metadata.commit_hash,functions:true}
 }
 async function before(s){
  const p=await project(s)
  assert(p.canonical_deployment?.id===s.old,'production baseline drift '+s.project)
  const old=await retained(s)
  assert((await bytes(s.host+s.route)).toString().includes('/assets/'+s.oldEntry),'canonical old HTML drift')
  assert(hash(await bytes(s.host+'/assets/'+s.oldEntry))===s.oldHash,'canonical old bytes drift')
  return old
 }
 function local(s){
  const dir=join(ROOT,s.folder,'dist','assets')
  assert(hash(readFileSync(join(dir,s.entry)))===s.sha,'local entry SHA mismatch '+s.project)
  assert(readFileSync(join(ROOT,s.folder,'dist','index.html'),'utf8').includes('/assets/'+s.entry),'local HTML mismatch')
  return Object.fromEntries(readdirSync(dir).filter(n=>/\.(js|css)$/.test(n)).sort().map(n=>[n,hash(readFileSync(join(dir,n)))]))
 }
 const inventory=JSON.parse(readFileSync('contracts/protected-profiles.production.json','utf8')).profiles
 const meta=(html)=>[...html.matchAll(/<meta\b[^>]*>|<link\b[^>]*>/gi)].map(m=>m[0]).filter(t=>/\b(?:property|name)=["'](?:og:[^"']+|twitter:[^"']+|description|robots)["']|\brel=["']canonical["']/i.test(t)).sort()
 async function protectedProfiles(){
  const host='https://intaprd.com',sitemap=(await bytes(host+'/sitemap.xml')).toString(),llms=(await bytes(host+'/llms.txt')).toString()
  assert(/sitemap/i.test((await bytes(host+'/robots.txt')).toString()),'robots sitemap missing')
  const out=[]
  for(const p of inventory){
   const u=host+'/'+p.slug
   const api=await fetch(host+'/api/v1/public/profiles/'+encodeURIComponent(p.slug),{redirect:'error',signal:AbortSignal.timeout(30000)})
   if(p.slug==='juan'){assert(api.status===404&&!sitemap.includes(u),'juan baseline changed');out.push({slug:p.slug,status:404});continue}
   assert(api.ok,'public API missing '+p.slug)
   const html=(await bytes(u,{'User-Agent':'Twitterbot/1.0'})).toString()
   assert(html.includes('rel="canonical" href="'+u+'"')&&html.includes('property="og:image"')&&html.includes('name="twitter:card"'),'metadata missing '+p.slug)
   assert(sitemap.includes(u)&&llms.includes('/'+p.slug),'discovery missing '+p.slug)
   const ai=await bytes(u+'/ai.md'),facts=JSON.parse((await bytes(u+'/facts.json')).toString())
   delete facts.generatedAt
   out.push({slug:p.slug,meta:hash(JSON.stringify(meta(html))),ai:hash(ai),facts:hash(JSON.stringify(facts)),jsonld:hash(JSON.stringify([...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1])))})
  }
  for(const slug of ['novi','aycdom2']){
   const path='/'+slug+'?ref=contract-test',r=await fetch('https://link.avanxy.com'+path,{redirect:'manual',signal:AbortSignal.timeout(30000)})
   assert(r.status===301&&r.headers.get('location')===host+path,'historical alias drift '+slug)
  }
  return out
 }
 await workers()
 const snapshots=[]
 for(const s of surfaces)snapshots.push({project:s.project,rollback:await before(s),assets:local(s)})
 assert(snapshots[1].assets['index-B0l7z9MY.js']==='71c4ed92fdde23f70cf4fd2ae1daaa3f51085a1d1eb240584ab39096306309f5','secondary web bundle mismatch')
 const profiles=await protectedProfiles()
 save('preflight',{sha:SHA,api:API,preview:PREVIEW,snapshots,profiles,restoreRehearsed:false})
 console.log('PASS_R0_PRODUCTION_RECOVERY_PREFLIGHT')
 async function verify(s,manifest){
  const p=await project(s),d=p.canonical_deployment
  assert(d?.id&&d.id!==s.old&&d.environment==='production','canonical deployment not changed '+s.project)
  const v=await get('/pages/projects/'+s.project+'/deployments/'+d.id)
  assert(v.id===d.id&&v.latest_stage?.status==='success'&&v.uses_functions===true&&v.deployment_trigger?.metadata?.branch==='main'&&v.deployment_trigger?.metadata?.commit_hash===SHA,'new deployment metadata mismatch '+s.project)
  for(const origin of [s.host,v.url]){
   assert((await bytes(origin+s.route)).toString().includes('/assets/'+s.entry),'new HTML mismatch '+origin)
   const files=Object.entries(manifest)
   for(let i=0;i<files.length;i+=6)await Promise.all(files.slice(i,i+6).map(async ([name,sha])=>assert(hash(await bytes(origin+'/assets/'+encodeURIComponent(name)))===sha,'asset drift '+origin+' '+name)))
  }
  await retained(s);await workers()
  return {project:s.project,id:v.id,url:v.url,sha:SHA,assets:Object.keys(manifest).length,rollback:s.old}
 }
 const results=[]
 for(let i=0;i<surfaces.length;i++){
  const s=surfaces[i]
  await workers();await before(s);assert(equal(local(s),snapshots[i].assets),'local artifact drift')
  if(i===1)assert((await project(surfaces[0])).canonical_deployment?.id===results[0].id,'App drift before Web')
  save(s.folder+'-attempt',{sha:SHA,project:s.project,rollback:s.old})
  const p=spawnSync('npx',['--yes','--package=wrangler@4.166.0','--','wrangler','pages','deploy',s.folder+'/dist','--project-name='+s.project,'--branch=main','--commit-hash='+SHA,'--commit-dirty=false'],{cwd:ROOT,stdio:'inherit',env:process.env})
  assert(p.status===0,'upload failed or ambiguous '+s.project+'; do not retry')
  const result=await verify(s,snapshots[i].assets)
  save(s.folder+'-receipt',result);results.push(result);console.log(JSON.stringify(result,null,2))
  console.log('PASS_R0_PRODUCTION_'+s.folder.toUpperCase())
 }
 const after=await protectedProfiles()
 assert(equal(profiles,after),'protected profile metadata/discovery changed; investigate, do not retry')
 for(const s of surfaces)assert((await project(s)).canonical_deployment?.id===results.find(r=>r.project===s.project).id,'post-release deployment drift')
 await workers()
 const done={result:'PASS_R0_PRODUCTION_TECHNICAL_QA',sha:SHA,api:API,preview:PREVIEW,pages:results,protectedProfiles:profiles.length,authenticatedQA:'PENDING',socialWhatsAppQA:'PENDING',restoreRehearsed:false}
 save('final',done);console.log(JSON.stringify(done,null,2))
}
main().catch(e=>{console.error('BLOCKED: '+String(e.message||e));process.exitCode=1})
