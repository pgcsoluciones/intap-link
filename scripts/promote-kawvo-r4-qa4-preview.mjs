// QA4: clone active QA3 Worker bytes, changing only APP_PAGES_ORIGIN and WEB_PAGES_ORIGIN. No Pages uploads, no D1.
import {execFileSync} from 'node:child_process'
import {existsSync,mkdirSync,readFileSync,writeFileSync,symlinkSync,readdirSync,lstatSync} from 'node:fs'
import {homedir,tmpdir} from 'node:os'
import {join,basename} from 'node:path'
import {createHash} from 'node:crypto'

process.umask(0o077)
const CANDIDATE='dfc666aa0a333ede69e893eb342d06f3abdf79d1'
const WORKER='intap-api-preview'
const ACTIVE='af952a18-edad-43a1-b268-b8c48a945ff6'
const ACTIVE_SHA='9da139f93316404e44286d1fff0f624204edc228ff682342311afa0107412101'
const ACTIVE_SOURCE='b98538e8314c5dbbce9120a09852f76ddb61a968'
const APP_SOURCE=CANDIDATE
const PROD='766e8d93-260c-4fb7-841c-a833515bf9d6'
const DB='e9f46214-623f-48da-af13-74198e12b222'
const ACCOUNT='adf4d5ebb625fed2c32e38cef57a6319'
const BASE='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT
const TAG='KAWVO-R4-QA4-PREVIEW-'+CANDIDATE.slice(0,12)
const ROOT=process.cwd()
const API_DIR=join(homedir(),'intap-release-logs','r4-api-stage-'+CANDIDATE.slice(0,12))
const PAGES_DIR=join(homedir(),'intap-release-logs','r4-pages-stage-'+CANDIDATE.slice(0,12))
const DIR=join(homedir(),'intap-release-logs','r4-preview-promotion-'+CANDIDATE.slice(0,12))
const SCHEMA=join(homedir(),'intap-release-logs','kawvo-r4-preview-schema-6kyPtiFO')
const PROD_PAGES={'intap-web2':'166657db-e27e-4a5b-9396-1232aa4d0fd0','intap-link':'f4c4990d-98ed-42a3-a989-cd082a7168f4'}
const PREVIEW_PAGES={'intap-web2':'fef2263a-7494-47c7-ab57-b5eb052152c0','intap-link':'6aadcabd-7113-4d1e-8453-5382628e16d5'}
const runtime=['compatibility_date','compatibility_flags','limits','placement','cache_options','usage_model','exports']
const check=(ok,msg)=>{if(!ok)throw Error('BLOCKED: '+msg)}
const sha=x=>createHash('sha256').update(x).digest('hex')
const sort=x=>Array.isArray(x)?x.map(sort):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,sort(x[k])])):x
const equal=(a,b)=>JSON.stringify(sort(a??null))===JSON.stringify(sort(b??null))
const read=p=>JSON.parse(readFileSync(p,'utf8'))
const save=(name,v)=>writeFileSync(join(DIR,name),JSON.stringify(v,null,2),{mode:0o600,flag:'wx'})
const git=(...a)=>execFileSync('git',a,{cwd:ROOT,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
function auth(){
  if(process.env.CLOUDFLARE_API_TOKEN)return 'Bearer '+process.env.CLOUDFLARE_API_TOKEN
  execFileSync('npx',['--yes','--package=wrangler@4.166.0','--','wrangler','whoami'],{cwd:tmpdir(),stdio:'pipe',env:{...process.env,WRANGLER_SEND_METRICS:'false'}})
  const paths=['Library/Preferences/.wrangler/config/default.toml','.wrangler/config/default.toml','.config/.wrangler/config/default.toml'].map(p=>join(homedir(),p)).filter(existsSync)
  check(paths.length===1,'sesión Wrangler ausente o ambigua')
  const token=readFileSync(paths[0],'utf8').match(/^oauth_token\s*=\s*"([^"\r\n]+)"/m)?.[1]
  check(token,'sesión sin token legible después de whoami')
  return 'Bearer '+token
}
async function request(token,method,path,payload){
  check(method==='GET'||(method==='POST'&&['/workers/workers/'+WORKER+'/versions?deploy=false','/workers/scripts/'+WORKER+'/deployments'].includes(path)),'operación fuera de Preview')
  const res=await fetch(BASE+path,{method,headers:{Authorization:token,...(payload?{'Content-Type':'application/json'}:{})},body:payload?JSON.stringify(payload):undefined,redirect:'error',signal:AbortSignal.timeout(method==='GET'?30000:120000)})
  const j=await res.json().catch(()=>null)
  check(res.ok&&j?.success===true,method+' '+path+' HTTP '+res.status+' codes '+(j?.errors||[]).map(e=>e.code).join(','))
  return j.result
}
async function live(token){
  const get=p=>request(token,'GET',p)
  const active=async(worker,expected)=>{
    const d=await get('/workers/scripts/'+worker+'/deployments'),current=d.deployments?.[0]
    check(current?.id&&current.versions?.length===1&&current.versions[0].version_id===expected&&Number(current.versions[0].percentage)===100,'versión activa cambió: '+worker)
    return {id:current.id,version:expected}
  }
  const preview=await active(WORKER,ACTIVE),production=await active('intap-api',PROD)
  const v=await get('/workers/workers/'+WORKER+'/versions/'+ACTIVE+'?include=modules')
  check(v.id===ACTIVE&&v.bindings?.length===35&&new Set(v.bindings.map(b=>b.name)).size===35,'inventario de bindings distinto')
  check(v.modules?.length===1&&v.main_module===v.modules[0].name&&v.main_module==='preview-frontdoor-entry.js','entrypoint original distinto')
  check(v.modules[0].content_type==='application/javascript+module'&&sha(Buffer.from(v.modules[0].content_base64,'base64'))===ACTIVE_SHA,'MIME o SHA original distinto')
  check(v.compatibility_date==='2024-02-08'&&equal(v.compatibility_flags||[],[]),'runtime no esperado')
  check(!Object.keys(v.assets||{}).length&&!v.containers?.length&&!Object.keys(v.migrations||{}).length,'assets/containers/migraciones fuera de alcance')
  check(Object.entries(v.exports||{}).every(([name,x])=>name==='default'&&x.type==='worker'&&(!x.state||x.state==='created')),'exports fuera de alcance')
  const binding=n=>v.bindings.find(b=>b.name===n)
  check(binding('ENVIRONMENT')?.text==='preview'&&binding('DB')?.type==='d1'&&(binding('DB')?.id||binding('DB')?.database_id)===DB&&binding('BUCKET')?.type==='r2_bucket'&&binding('BUCKET')?.bucket_name==='intap-r2-preview','aislamiento D1/R2 no acreditado')
  const pages={}
  for(const [project,field] of [['intap-web2','APP_PAGES_ORIGIN'],['intap-link','WEB_PAGES_ORIGIN']]){
    const p=await get('/pages/projects/'+project)
    check(p.source?.config?.production_deployments_enabled===false&&p.canonical_deployment?.id===PROD_PAGES[project]&&p.canonical_deployment?.environment==='production','Pages Producción cambió: '+project)
    const d=await get('/pages/projects/'+project+'/deployments/'+PREVIEW_PAGES[project])
    check(d.id===PREVIEW_PAGES[project]&&d.environment==='preview'&&d.latest_stage?.status==='success','rollback Preview no acreditado: '+project)
    check([d.url,...(d.aliases||[])].includes(binding(field)?.text),'origen Preview no coincide: '+project)
    pages[project]={production:p.canonical_deployment.id,preview:d.id,origin:binding(field).text}
  }
  return {v,proof:{preview,production,pages,moduleSha:sha(Buffer.from(v.modules[0].content_base64,'base64'))}}
}

const STAGE_API=ACTIVE
const STAGE_SHA=ACTIVE_SHA
const BRANCH='qa-r4-'+CANDIDATE.slice(0,12)
const SOURCE=join(PAGES_DIR,'source')
const surfaces=[
 {folder:'app',project:'intap-web2',route:'/admin/login',official:'https://app.preview.intaprd.com'},
 {folder:'web',project:'intap-link',route:'/',official:'https://preview.intaprd.com'}
]
function manifest(root){
 const files={}
 function walk(rel){const p=join(root,rel),st=lstatSync(p);check(!st.isSymbolicLink(),'symlink inesperado: '+rel);if(st.isDirectory()){for(const child of readdirSync(p).sort())walk(rel?rel+'/'+child:child)}else{check(st.isFile(),'archivo especial');files[rel]=sha(readFileSync(p))}}
 walk('');return files
}
function context(source=SOURCE){
 const files={}
 for(const name of ['functions','shared','package.json','package-lock.json','app/package.json','web/package.json']){
  const p=join(source,name)
  if(lstatSync(p).isDirectory())files[name]=manifest(p)
  else files[name]=sha(readFileSync(p))
 }
 for(const name of ['wrangler.toml','wrangler.json','wrangler.jsonc'])check(!existsSync(join(source,name)),'config Pages raíz inesperada')
 return files
}
function checkSource(){
 const tree=git('ls-tree','-rz',CANDIDATE,'--','app','web','functions','shared','package.json','package-lock.json').split('\0').filter(Boolean)
 for(const line of tree){const m=line.match(/^100(?:644|755) blob ([a-f0-9]{40})\t([\s\S]+)$/);check(m,'entrada Git inesperada');const b=readFileSync(join(SOURCE,m[2]));check(createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex')===m[1],'fuente distinta: '+m[2])}
}
async function bytes(url){
 const r=await fetch(url,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(30000)})
 check(r.ok,'HTTP '+r.status+' '+url)
 return Buffer.from(await r.arrayBuffer())
}
async function verifyOfficial(proof){
 for(const s of surfaces){
  const old=proof.pages[s.project].origin
  const a=await bytes(old+s.route),b=await bytes(s.official+s.route)
  const entry=x=>x.toString().match(/\/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0]
  check(entry(a)&&entry(a)===entry(b),'entry oficial cambió: '+s.project)
  check(sha(await bytes(old+entry(a)))===sha(await bytes(s.official+entry(b))),'bytes oficiales cambiaron: '+s.project)
 }
}
async function retryRead(fn){
 let error
 for(let i=0;i<4;i++){try{return await fn()}catch(e){error=e;if(i<3)await new Promise(resolve=>setTimeout(resolve,3000*(i+1)))}}
 throw error
}
async function getStage(token,s,url,candidate=CANDIDATE,branch=BRANCH){
 const get=p=>request(token,'GET',p)
 const project=await get('/pages/projects/'+s.project)
 check(project.production_branch!==branch&&project.source?.config?.production_deployments_enabled===false,'rama o automático producción inseguro')
 for(let page=1;page<=10;page++){
  const r=await get('/pages/projects/'+s.project+'/deployments?env=preview&per_page=10&page='+page)
  const rows=Array.isArray(r)?r:r?.items;check(Array.isArray(rows),'listado Pages inválido')
  const d=rows.find(d=>d.url===url)
  if(d){check(d.environment==='preview'&&d.deployment_trigger?.metadata?.branch===branch&&d.deployment_trigger?.metadata?.commit_hash===candidate&&d.latest_stage?.status==='success'&&d.uses_functions===true,'metadata Stage no certificada '+s.project);return d}
  if(rows.length<10)break
 }
 throw Error('BLOCKED: deployment Stage todavía no acreditado '+s.project)
}
async function verifyAssets(s,d,prepared,source=SOURCE,branch=BRANCH){
 const files=Object.entries(prepared.files).filter(([name])=>name.startsWith('assets/')&&/\.(js|css)$/.test(name))
 check(files.length>0,'sin assets JS/CSS')
 const index=readFileSync(join(source,s.folder,'dist','index.html'),'utf8').match(/\/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0]
 check(index&&prepared.files[index.slice(1)],'entry local ausente')
 const aliases=(d.aliases||[]).filter(u=>u==='https://'+branch+'.'+s.project+'.pages.dev')
 check(aliases.length===1,'alias Stage no acreditado')
 for(const origin of [d.url,aliases[0]]){
  check((await bytes(origin+s.route)).toString().includes(index),'entry remoto distinto '+origin)
  for(let i=0;i<files.length;i+=6)await Promise.all(files.slice(i,i+6).map(async([name,digest])=>check(sha(await bytes(origin+'/'+name.split('/').map(encodeURIComponent).join('/')))===digest,'asset distinto '+name)))
 }
 return {entry:index,assets:files.length,alias:aliases[0]}
}

const pinned={
 app:{id:'d6b96d91-fe58-4a86-b438-9f59caa9c5f0',origin:'https://d6b96d91.intap-web2.pages.dev',entry:'/assets/index-DNEGp8Cq.js',functions:'e53299b5569b6e14a0e6b7e12a78e2daa10f24ef0caa83963087836a6075b08c',assets:4},
 web:{id:'baf8fa51-1cd6-4fa4-815f-24472c72f6e2',origin:'https://baf8fa51.intap-link.pages.dev',entry:'/assets/index-DxCC3ikT.js',functions:'fa7d62240184b7132be0c9091dfcb79813568c45630fb7c9d3cfe57dd9012646',assets:50}
}
const versionPath='/workers/workers/'+WORKER+'/versions/'
const deploymentPath='/workers/scripts/'+WORKER+'/deployments'
function checkGit(){
 check(git('rev-parse',CANDIDATE+'^{commit}')===CANDIDATE,'falta candidato exacto')
 check(git('ls-remote','https://github.com/pgcsoluciones/intap-link.git','refs/heads/feature/kawvo-r4-reviews-2026-11-25').split(/\s+/)[0]===CANDIDATE,'candidato cambió')
 check(git('ls-remote','https://github.com/pgcsoluciones/intap-link.git','refs/heads/main').split(/\s+/)[0]==='e28b934a61c669ed270a656ae42cf68c1b518a82','main cambió')
 check(git('status','--porcelain')==='','checkout local sucio')
}
async function protectedProduction(token,baseline){
 const d=await request(token,'GET','/workers/scripts/intap-api/deployments')
 const v=d.deployments?.[0]
 check(v?.id===baseline.proof.production.id&&v.versions?.length===1&&v.versions[0].version_id===PROD&&Number(v.versions[0].percentage)===100,'API Producción cambió')
 for(const s of surfaces){
  const p=await request(token,'GET','/pages/projects/'+s.project)
  check(p.source?.config?.production_deployments_enabled===false&&p.canonical_deployment?.id===PROD_PAGES[s.project],'Pages Producción cambió: '+s.project)
  const old=await request(token,'GET','/pages/projects/'+s.project+'/deployments/'+PREVIEW_PAGES[s.project])
  check(old.id===PREVIEW_PAGES[s.project]&&old.environment==='preview'&&old.latest_stage?.status==='success','rollback Pages no disponible')
 }
}
async function active(token,id){
 const r=await request(token,'GET',deploymentPath),d=r.deployments?.[0]
 check(d?.versions?.length===1&&d.versions[0].version_id===id&&Number(d.versions[0].percentage)===100,'tráfico Preview distinto: '+id)
 return d.id
}
function verifyPromoted(v,id,base,staged){
 check(v.id===id&&v.annotations?.['workers/tag']===TAG&&v.main_module===staged.main_module&&v.modules?.length===1,'identidad versión promovida incorrecta')
 const m=v.modules[0]
 check(m.name===staged.modules[0].name&&m.content_type===staged.modules[0].content_type&&sha(Buffer.from(m.content_base64,'base64'))===STAGE_SHA,'bytes API no coinciden con Stage')
 check(v.bindings?.length===35&&new Set(v.bindings.map(b=>b.name)).size===35,'inventario bindings distinto')
 for(const b of base.bindings){
  const next=b.name==='APP_PAGES_ORIGIN'?{...b,text:pinned.app.origin}:b.name==='WEB_PAGES_ORIGIN'?{...b,text:pinned.web.origin}:b
  check(equal(v.bindings.find(n=>n.name===b.name),next),'binding distinto: '+b.name)
 }
 for(const k of runtime)check(equal(k==='compatibility_flags'?(v[k]||[]):v[k],k==='compatibility_flags'?(base[k]||[]):base[k]),'runtime distinto: '+k)
}
async function pagesProof(token){
 checkSource()
 const proofs=[]
 for(const s of surfaces){
  const candidate=s.folder==='app'?APP_SOURCE:CANDIDATE,branch='qa-r4-'+candidate.slice(0,12)
  const dir=join(homedir(),'intap-release-logs','r4-pages-stage-'+candidate.slice(0,12)),source=join(dir,'source')
  const x=pinned[s.folder],r=read(join(dir,s.folder+'-stage-pass.json')),p=read(join(dir,s.folder+'-prepared.json'))
  check(r.result==='R4_STAGE_'+s.folder.toUpperCase()+'_PASS'&&r.candidate===candidate&&r.project===s.project&&r.branch===branch&&r.deployment===x.id&&r.origin===x.origin&&r.entry===x.entry&&r.assets===x.assets&&r.functionsSha256===x.functions&&r.sharedPreviewUnchanged===true&&r.productionUnchanged===true,'recibo Stage distinto: '+s.folder)
  check(p.candidate===candidate&&equal(p.files,manifest(join(source,s.folder,'dist')))&&equal(p.context,context(source)),'artefacto Stage cambió: '+s.folder)
  check(p.functionsSha256===x.functions&&sha(readFileSync(join(dir,s.folder+'-functions.bundle')))===x.functions&&sha(readFileSync(join(dir,s.folder+'-functions-routes.json')))===p.routesSha256,'Functions locales cambiaron')
  const d=await getStage(token,s,x.origin,candidate,branch)
  check(d.id===x.id,'ID Stage no coincide')
  const proof=await verifyAssets(s,d,p,source,branch)
  if(s.folder==='web'){
   const image='assets/og/google-reviews.png',digest=p.files[image]
   check(typeof digest==='string'&&sha(await bytes(x.origin+'/'+image))===digest,'PNG social Stage distinto')
  }
  check(proof.entry===x.entry&&proof.assets===x.assets,'inventario JS/CSS distinto')
  proofs.push({s,p,...proof,deployment:x.id,origin:x.origin})
 }
 return proofs
}
async function official(proofs){
 for(const {s,p,entry,assets} of proofs){
  const html=await bytes(s.official+s.route)
  check(html.toString().includes(entry),'HTML Preview oficial no corresponde: '+s.project)
  const files=Object.entries(p.files).filter(([name])=>name.startsWith('assets/')&&/\.(js|css)$/.test(name))
  check(files.length===assets,'inventario oficial distinto')
  if(s.folder==='web')check(sha(await bytes(s.official+'/assets/og/google-reviews.png'))===p.files['assets/og/google-reviews.png'],'PNG social oficial distinto')
  for(let i=0;i<files.length;i+=6)await Promise.all(files.slice(i,i+6).map(async([name,digest])=>check(sha(await bytes(s.official+'/'+name.split('/').map(encodeURIComponent).join('/')))===digest,'asset oficial distinto: '+name)))
 }
}
async function smoke(){
 const slug='r4-smoke-absent-'+CANDIDATE.slice(0,12)
 const publicUrl='https://preview.intaprd.com/api/v1/public/profiles/'+slug+'/reviews'
 const response=await fetch(publicUrl,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(30000)})
 const data=await response.json().catch(()=>null)
 check(response.status===200&&data?.ok===true&&data.data===null,'endpoint público R4 no responde contrato')
 const privateResponse=await fetch('https://app.preview.intaprd.com/api/v1/me/profile/reviews/'+slug,{cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(30000)})
 check([401,403].includes(privateResponse.status),'endpoint Tenant sin sesión no rechazado')
 return {publicAbsent:response.status,privateAnonymous:privateResponse.status}
}
async function main(){
 const reconcile=process.argv.length===2
 check(reconcile||(process.argv.length===3&&process.argv[2]==='AUTORIZO R4 QA4 PREVIEW APP WEB'),'autorización Preview exacta requerida')
 checkGit()
 git('diff','--exit-code',ACTIVE_SOURCE,CANDIDATE,'--','api','shared','package.json','package-lock.json','web/package.json','app/package.json')
 const expected=['app/src/components/admin/shared/ReviewsTenantPanel.tsx','docs/architecture/KAWVO_R4_REVIEWS_CONTRACT_2026-11-25.md','functions/_middleware.ts','scripts/test-kawvo-r4-review-placement.mjs','web/public/assets/og/google-reviews.png','web/src/components/PublicProfile.tsx','web/src/components/free-profile/IntapLinkGratisProfile.tsx','web/src/components/medical-profile/KawMedEvaluationDesign.tsx','web/src/components/medical-profile/KawMedProfile.tsx','web/src/components/reviews/LinkReviews.tsx','web/src/components/reviews/review-section-links.ts','web/src/components/shared/ProfileQrModal.tsx'].sort()
 check(equal(git('diff','--name-only',ACTIVE_SOURCE,CANDIDATE).split('\n').sort(),expected),'delta QA4 distinto')
 const ciResponse=await fetch('https://api.github.com/repos/pgcsoluciones/intap-link/actions/runs/45636272878',{headers:{Accept:'application/vnd.github+json','User-Agent':'Kawvo-R4-QA4-Promotion'},redirect:'error',signal:AbortSignal.timeout(30000)})
 check(ciResponse.ok,'CI no accesible')
 const ci=await ciResponse.json()
 check(ci.id===45636272878&&ci.head_sha===CANDIDATE&&ci.status==='completed'&&ci.conclusion==='success','CI exacta no certificada')
 const previous=read(join(homedir(),'intap-release-logs','r4-preview-promotion-b98538e8314c','preview-pass.json'))
 check(previous.result==='R4_PREVIEW_ACTIVE_PASS'&&previous.candidate===ACTIVE_SOURCE&&previous.version===ACTIVE&&previous.moduleSha256===ACTIVE_SHA&&previous.app===PREVIEW_PAGES['intap-web2']&&previous.web===PREVIEW_PAGES['intap-link'],'recibo QA3 anterior no coincide')
 const baseline=read(join(PAGES_DIR,'baseline.private.json'))
 check(baseline.v.id===ACTIVE&&baseline.proof.preview.version===ACTIVE&&baseline.proof.moduleSha===ACTIVE_SHA,'baseline QA4 distinta')
 const token=auth()
 const base=await request(token,'GET',versionPath+ACTIVE+'?include=modules')
 check(equal(base,baseline.v),'versión QA3 histórica distinta')
 const info={candidate:CANDIDATE,rollback:ACTIVE,stagedApi:ACTIVE,moduleSha256:ACTIVE_SHA,app:pinned.app.id,web:pinned.web.id,bindings:35}
 mkdirSync(DIR,{recursive:true,mode:0o700})
 const attempted=existsSync(join(DIR,'activate-attempt.json'))
 const hasInactive=existsSync(join(DIR,'inactive.json'))
 let id
 if(hasInactive){
  const inactive=read(join(DIR,'inactive.json'))
  for(const [k,v] of Object.entries(info))check(inactive[k]===v,'recibo inactivo distinto: '+k)
  id=inactive.version
  check(/^[a-f0-9-]{36}$/i.test(id||'')&&id!==ACTIVE,'ID inactivo inválido')
  verifyPromoted(await request(token,'GET',versionPath+id+'?include=modules'),id,base,base)
 }else{
  check(!attempted&&!existsSync(join(DIR,'upload-attempt.json'))&&!existsSync(join(DIR,'preview-pass.json')),'intento anterior sin recibo; no repetir')
  check(!reconcile,'no existe versión inactiva; reconciliación no escribe')
 }
 if(attempted){
  check(hasInactive&&equal(read(join(DIR,'activate-attempt.json')),{...info,version:id}),'marcador de activación distinto')
  await active(token,id)
 }else{
  check(equal(await live(token),baseline),'baseline cambió desde Stage App/Web')
  await verifyOfficial(baseline.proof)
 }
 await protectedProduction(token,baseline)
 const proofs=await pagesProof(token)
 if(!hasInactive){
  const rows=await request(token,'GET','/workers/workers/'+WORKER+'/versions')
  const history=Array.isArray(rows)?rows:rows?.items||rows?.versions
  check(Array.isArray(history)&&!history.some(v=>v.annotations?.['workers/tag']===TAG),'promoción anterior detectada; no repetir')
  check(equal(await live(token),baseline),'baseline cambió antes de promoción')
  const payload={main_module:base.main_module,modules:base.modules.map(({name,content_type,content_base64})=>({name,content_type,content_base64})),bindings:base.bindings.map(b=>b.name==='APP_PAGES_ORIGIN'?{name:b.name,type:'plain_text',text:pinned.app.origin}:b.name==='WEB_PAGES_ORIGIN'?{name:b.name,type:'plain_text',text:pinned.web.origin}:{name:b.name,type:'inherit',version_id:ACTIVE}),annotations:{'workers/tag':TAG,'workers/message':'R4 QA4: only APP_PAGES_ORIGIN and WEB_PAGES_ORIGIN; rollback '+ACTIVE}}
  for(const k of runtime)if(base[k]!=null)payload[k]=base[k]
  console.log(JSON.stringify({result:'R4_QA4_PROMOTION_PREFLIGHT_PASS',...info},null,2))
  save('upload-attempt.json',{...info,payloadSha256:sha(JSON.stringify(sort(payload)))})
  const up=await request(token,'POST','/workers/workers/'+WORKER+'/versions?deploy=false',payload)
  id=up?.id
  check(/^[a-f0-9-]{36}$/i.test(id||'')&&id!==ACTIVE,'respuesta upload ambigua; no repetir')
  save('inactive.json',{...info,version:id})
  verifyPromoted(await request(token,'GET',versionPath+id+'?include=modules'),id,base,base)
 }
 if(!attempted){
  check(!reconcile,'solo lectura: versión inactiva verificada; falta autorización de activación')
  await protectedProduction(token,baseline)
  check(equal(await live(token),baseline),'baseline cambió antes de activar')
  await verifyOfficial(baseline.proof)
  console.log('PASS: versión inactiva verificada, únicos cambios APP_PAGES_ORIGIN y WEB_PAGES_ORIGIN.')
  save('activate-attempt.json',{...info,version:id})
  await request(token,'POST',deploymentPath,{strategy:'percentage',versions:[{version_id:id,percentage:100}],annotations:{'workers/message':'R4 QA4 Pages only; rollback '+ACTIVE}})
 }
 await retryRead(()=>active(token,id))
 verifyPromoted(await request(token,'GET',versionPath+id+'?include=modules'),id,base,base)
 await protectedProduction(token,baseline)
 await retryRead(()=>official(proofs))
 const checks=await retryRead(smoke)
 await active(token,id);await protectedProduction(token,baseline)
 const receipt={result:'R4_PREVIEW_ACTIVE_PASS',...info,version:id,traffic:100,checks,assets:{app:4,web:50},productionUnchanged:true,apiModuleUnchanged:true,functionsRemoteBinaryEquality:false,authenticatedQA:'PENDING',reconciled:attempted}
 if(!existsSync(join(DIR,'preview-pass.json')))save('preview-pass.json',receipt)
 else check(read(join(DIR,'preview-pass.json')).version===id,'recibo existente distinto')
 console.log(JSON.stringify({...receipt,evidence:DIR},null,2))
}
main().catch(e=>{
 const msg=String(e?.message||'error desconocido')
 try{if(existsSync(DIR))writeFileSync(join(DIR,'error-'+Date.now()+'.private.txt'),String(e?.stack||msg),{mode:0o600,flag:'wx'})}catch{}
 console.error(msg.startsWith('BLOCKED:')?msg:'BLOCKED: '+(e?.code||e?.name||'Error')+'; conservar diagnóstico privado')
 console.error(JSON.stringify({evidence:DIR,uploadAttempt:existsSync(join(DIR,'upload-attempt.json')),inactive:existsSync(join(DIR,'inactive.json')),activateAttempt:existsSync(join(DIR,'activate-attempt.json')),pass:existsSync(join(DIR,'preview-pass.json')),rollback:ACTIVE},null,2))
 process.exitCode=1
})
