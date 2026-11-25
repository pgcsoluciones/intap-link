import {execFileSync} from 'node:child_process'
import {existsSync,readFileSync,writeFileSync,readdirSync} from 'node:fs'
import {homedir,tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
const SHA='e886746db8a1c5386d41420baa49104e5a5105d5', ACTIVE='5b1f7f8e-b2eb-4b2d-9823-f175376a207d', PROD='766e8d93-260c-4fb7-841c-a833515bf9d6'
const ROOT=join(homedir(),'Desktop','kawvo-r0-final-release'), DIR=join(homedir(),'intap-release-logs','r0-final-e886746d')
const BASE='https://api.cloudflare.com/client/v4/accounts/adf4d5ebb625fed2c32e38cef57a6319', WORKER='intap-api-preview', TAG='KAWVO-R0-FINAL-e886746d', BRANCH='qa-r0-final-e886746d'
const MODULE_SHA='1af792712416e349ba4ac0c91f5be94ff781fb5dc3237be9596006ad63c4ada1'
const surfaces=[
 {project:'intap-link',folder:'web',binding:'WEB_PAGES_ORIGIN',old:'https://1a7d0158.intap-link.pages.dev',next:'https://f4766964.intap-link.pages.dev',official:'https://preview.intaprd.com',route:'/',entry:'index-BoraR-x_.js',sha:'aee4b4cd7fbdeb303297cbaff11c6e34a6e1050d238929601febb70a83775713',production:'acd10d69-8b6f-4554-b2d5-2485e0ab583b',currentProductionPrefix:'2d7c6df4'},
 {project:'intap-web2',folder:'app',binding:'APP_PAGES_ORIGIN',old:'https://df21b0f0.intap-web2.pages.dev',next:'https://1974cbc0.intap-web2.pages.dev',official:'https://app.preview.intaprd.com',route:'/admin/login',entry:'index-BRC1lzmt.js',sha:'e8b02d6061d4a5a12aebc106170146aaa41f925da800fe5b3d9dc81a4d316314',currentProductionPrefix:'630cb1f0'}
]
const runtime=['main_module','compatibility_date','compatibility_flags','limits','placement','cache_options','usage_model','exports']
const assert=(ok,msg)=>{if(!ok)throw Error('BLOCKED: '+msg)}
const hash=b=>createHash('sha256').update(b).digest('hex')
const normalize=v=>Array.isArray(v)?v.map(normalize):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,normalize(v[k])])):v
const equal=(a,b)=>JSON.stringify(normalize(a??null))===JSON.stringify(normalize(b??null))
const receipt=(name,v)=>writeFileSync(join(DIR,name+'.json'),JSON.stringify(v,null,2),{flag:'wx',mode:0o600})
function auth(){
 if(process.env.CLOUDFLARE_API_TOKEN)return 'Bearer '+process.env.CLOUDFLARE_API_TOKEN
 execFileSync('npx',['--yes','--package=wrangler@4.166.0','--','wrangler','whoami'],{cwd:tmpdir(),stdio:'pipe'})
 const paths=['Library/Preferences/.wrangler/config/default.toml','.wrangler/config/default.toml','.config/.wrangler/config/default.toml'].map(p=>join(homedir(),p)).filter(existsSync)
 assert(paths.length===1,'ambiguous OAuth source')
 const token=readFileSync(paths[0],'utf8').match(/^oauth_token\s*=\s*"([^"\r\n]+)"/m)?.[1]
 assert(token,'OAuth token missing');return 'Bearer '+token
}
async function main(){
 const mode=process.argv[2];assert(['--check','--promote'].includes(mode),'invalid mode')
 assert(execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim()===SHA,'candidate SHA')
 assert(!execFileSync('git',['status','--porcelain'],{cwd:ROOT,encoding:'utf8'}).trim(),'dirty worktree')
 const token=auth()
 async function request(method,path,payload){
  const r=await fetch(BASE+path,{method,headers:{Authorization:token,...(payload?{'Content-Type':'application/json'}:{})},body:payload?JSON.stringify(payload):undefined,redirect:'error',signal:AbortSignal.timeout(method==='GET'?30000:120000)})
  const j=await r.json().catch(()=>null)
  assert(r.ok&&j?.success===true,method+' '+path+' HTTP '+r.status+' codes '+(j?.errors||[]).map(e=>e.code).join(','))
  return j.result
 }
 const get=p=>request('GET',p), version=id=>get('/workers/workers/'+WORKER+'/versions/'+id+'?include=modules')
 async function active(worker,id){const d=await get('/workers/scripts/'+worker+'/deployments');const v=d.deployments?.[0]?.versions;assert(v?.length===1&&v[0].version_id===id&&Number(v[0].percentage)===100,'unexpected active '+worker)}
 async function production(){
  await active('intap-api',PROD)
  for(const s of surfaces){const p=await get('/pages/projects/'+s.project);assert(p.canonical_deployment?.url?.includes(s.currentProductionPrefix+'.'),'production Pages drift '+s.project)}
 }
 await production();await active(WORKER,ACTIVE)
 const old=await version(ACTIVE)
 assert(old.id===ACTIVE&&old.main_module==='preview-frontdoor-entry.js'&&old.modules?.length===1&&old.modules[0].name===old.main_module&&hash(Buffer.from(old.modules[0].content_base64,'base64'))===MODULE_SHA,'Preview module baseline')
 assert(old.bindings?.length===35&&new Set(old.bindings.map(b=>b.name)).size===35,'binding inventory')
 const binding=name=>old.bindings.find(b=>b.name===name)
 assert(binding('ENVIRONMENT')?.text==='preview'&&binding('DB')?.type==='d1'&&binding('BUCKET')?.type==='r2_bucket','Preview data isolation')
 for(const s of surfaces)assert(binding(s.binding)?.text===s.old,'origin baseline '+s.binding)
 async function bytes(url){const r=await fetch(url,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(30000)});assert(r.ok,'HTTP '+r.status+' '+url);return Buffer.from(await r.arrayBuffer())}
 async function assets(s,origin){
  const dir=join(ROOT,s.folder,'dist','assets')
  assert(hash(readFileSync(join(dir,s.entry)))===s.sha,'local entry hash')
  const html=await bytes(origin+s.route);assert(html.toString().includes('/assets/'+s.entry),'entry HTML mismatch '+origin)
  const files=readdirSync(dir).filter(f=>/\.(js|css)$/.test(f))
  for(let i=0;i<files.length;i+=6)await Promise.all(files.slice(i,i+6).map(async f=>assert(hash(await bytes(origin+'/assets/'+f))===hash(readFileSync(join(dir,f))),'asset drift '+origin+' '+f)))
  return files.length
 }
 const pages=[]
 for(const s of surfaces){
  const p=await get('/pages/projects/'+s.project);assert(p.production_branch!==BRANCH,'production branch collision')
  let found,retained
  for(let page=1;page<=10;page++){
   const list=await get('/pages/projects/'+s.project+'/deployments?env=preview&per_page=10&page='+page),rows=Array.isArray(list)?list:list?.items
   assert(Array.isArray(rows),'invalid Pages list')
   found??=rows.find(d=>d.url===s.next);retained??=rows.find(d=>d.url===s.old)
   if(found&&retained||rows.length<10)break
  }
  assert(found?.environment==='preview'&&found.deployment_trigger?.metadata?.branch===BRANCH&&found.deployment_trigger?.metadata?.commit_hash===SHA&&found.latest_stage?.status==='success','stage metadata '+s.project)
  assert(retained?.id&&retained.latest_stage?.status==='success','rollback Pages not retained '+s.project)
  const oldHtml=await bytes(s.old+s.route), live=await bytes(s.official+s.route)
  const entry=b=>b.toString().match(/\/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0]
  assert(entry(oldHtml)&&entry(oldHtml)===entry(live),'old official entry mismatch '+s.project)
  assert(hash(await bytes(s.old+entry(oldHtml)))===hash(await bytes(s.official+entry(live))),'old official entry bytes mismatch')
  pages.push({project:s.project,id:found.id,rollback:retained.id,origin:s.next,assets:await assets(s,s.next)})
 }
 const history=await get('/workers/workers/'+WORKER+'/versions'),rows=Array.isArray(history)?history:history?.items||history?.versions
 assert(Array.isArray(rows)&&!rows.some(v=>v.annotations?.['workers/tag']===TAG),'prior upload found or history unavailable')
 for(const f of ['nav-upload-attempt','nav-inactive','nav-activate-attempt','nav-receipt'])assert(!existsSync(join(DIR,f+'.json')),'prior attempt; reconcile before retry')
 await production();await active(WORKER,ACTIVE)
 const info={sha:SHA,oldVersion:ACTIVE,moduleSHA:MODULE_SHA,bindings:35,pages}
 console.log(JSON.stringify({result:'PASS_R0_FINAL_PROMOTION_PREFLIGHT',...info},null,2))
 if(mode==='--check')return
 const payload={main_module:old.main_module,modules:old.modules,bindings:old.bindings.map(b=>{const s=surfaces.find(s=>s.binding===b.name);return s?{name:b.name,type:'plain_text',text:s.next}:{name:b.name,type:'inherit',version_id:ACTIVE}}),annotations:{'workers/tag':TAG,'workers/message':'R0 final Preview; rollback '+ACTIVE}}
 for(const k of runtime)if(k!=='main_module'&&old[k]!=null)payload[k]=old[k]
 receipt('nav-upload-attempt',info)
 const up=await request('POST','/workers/workers/'+WORKER+'/versions?deploy=false',payload),id=up?.id
 assert(/^[0-9a-f-]{36}$/i.test(id||'')&&id!==ACTIVE,'ambiguous version upload')
 receipt('nav-inactive',{...info,newVersion:id})
 function verify(v){
  assert(v.id===id&&v.modules?.length===1&&v.modules[0].name===old.main_module&&hash(Buffer.from(v.modules[0].content_base64,'base64'))===MODULE_SHA,'module drift')
  for(const k of runtime)assert(equal(v[k],old[k]),'runtime drift '+k)
  assert(v.bindings?.length===35&&new Set(v.bindings.map(b=>b.name)).size===35,'new binding inventory')
  for(const b of old.bindings){const s=surfaces.find(s=>s.binding===b.name);assert(equal(v.bindings.find(n=>n.name===b.name),s?{...b,text:s.next}:b),'binding drift '+b.name)}
  assert(v.annotations?.['workers/tag']===TAG,'version tag mismatch')
 }
 verify(await version(id));await production();await active(WORKER,ACTIVE)
 receipt('nav-activate-attempt',{oldVersion:ACTIVE,newVersion:id})
 await request('POST','/workers/scripts/'+WORKER+'/deployments',{strategy:'percentage',versions:[{version_id:id,percentage:100}],annotations:{'workers/message':'R0 final Preview; rollback '+ACTIVE}})
 await active(WORKER,id);verify(await version(id));await production()
 for(const s of surfaces)await assets(s,s.official)
 const done={result:'PASS_R0_FINAL_PREVIEW_ACTIVE',...info,newVersion:id,authenticatedQA:'PENDING',productionUnchanged:true}
 receipt('nav-receipt',done);console.log(JSON.stringify(done,null,2))
}
main().catch(e=>{console.error(String(e?.message||e).replace(/^BLOCKED: /,'BLOCKED: ') .startsWith('BLOCKED:')?e.message:'BLOCKED: '+e.message);process.exitCode=1})
