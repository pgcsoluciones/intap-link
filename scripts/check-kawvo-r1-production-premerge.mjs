import {execFileSync} from 'node:child_process'
import {existsSync,mkdirSync,readFileSync,writeFileSync,readdirSync} from 'node:fs'
import {homedir,tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
const SHA='f51429b49b8f5feb18a860b4214797f978f66261', API='766e8d93-260c-4fb7-841c-a833515bf9d6', PREVIEW='9775e192-cc7e-4a12-b2e6-67f341aa31e7'
const ROOT=join(homedir(),'Desktop','kawvo-r1-free-qa'), DIR=join(homedir(),'intap-release-logs','r1-production-premerge-f51429b4')
const BASE='https://api.cloudflare.com/client/v4/accounts/adf4d5ebb625fed2c32e38cef57a6319'
const surfaces=[
 {project:'intap-web2',folder:'app',host:'https://app.intaprd.com',route:'/admin/login',old:'f32a04db-8451-4523-917c-971c805bff15',oldEntry:'index-NwmPq5TK.js',oldHash:'74e5a31a1cffc0676c5d755e45acf6457d05c269f03610c44cf9ac006310bc3d',entry:'index-NwmPq5TK.js',sha:'74e5a31a1cffc0676c5d755e45acf6457d05c269f03610c44cf9ac006310bc3d'},
 {project:'intap-link',folder:'web',host:'https://intaprd.com',route:'/',old:'f4c4990d-98ed-42a3-a989-cd082a7168f4',oldEntry:'index-D0uAkmAN.js',oldHash:'cb1f51a4a1cdabb90c0f46c0da5185fa9cebb9141c3440b32b4ff34228a24e09',entry:'index-D0uAkmAN.js',sha:'cb1f51a4a1cdabb90c0f46c0da5185fa9cebb9141c3440b32b4ff34228a24e09'}
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
 assert(main==='1751bb55a2aae1f0f390708c526241bc6a17de5d','remote main drift')
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
 for(const surface of surfaces)snapshots.push({project:surface.project,rollback:await before(surface),autoDeploy:false})
 const preview=await get('/workers/workers/intap-api-preview/versions/'+PREVIEW+'?include=modules')
 assert(preview.id===PREVIEW&&preview.bindings?.length===35&&preview.modules?.length===1&&hash(Buffer.from(preview.modules[0].content_base64,'base64'))==='1af792712416e349ba4ac0c91f5be94ff781fb5dc3237be9596006ad63c4ada1','Preview runtime drift')
 assert(preview.bindings.find(b=>b.name==='APP_PAGES_ORIGIN')?.text==='https://a637094e.intap-web2.pages.dev','Preview App origin drift')
 assert(preview.bindings.find(b=>b.name==='WEB_PAGES_ORIGIN')?.text==='https://baa5dcd8.intap-link.pages.dev','Preview Web origin drift')
 const profiles=await protectedProfiles()
 const info={result:'PASS_R1_PRODUCTION_PREMERGE_READONLY',sha:SHA,main,api:API,preview:PREVIEW,snapshots,protectedProfiles:profiles.length,workersBuilds:'OWNER_RECONFIRM_REQUIRED',restoreRehearsed:false}
 save('preflight',{...info,profiles});console.log(JSON.stringify(info,null,2))
}
main().catch(e=>{console.error('BLOCKED: '+String(e.message||e));process.exitCode=1})
