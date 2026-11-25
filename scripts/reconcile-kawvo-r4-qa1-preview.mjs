// R4: promote exact staged API + immutable App/Web origins in one Preview frontdoor version.
// Operational branch is separate from the product candidate. Never activates traffic.
import {execFileSync} from 'node:child_process'
import {existsSync,mkdirSync,readFileSync,writeFileSync,symlinkSync,readdirSync,lstatSync} from 'node:fs'
import {homedir,tmpdir} from 'node:os'
import {join,basename} from 'node:path'
import {createHash} from 'node:crypto'

process.umask(0o077)
const CANDIDATE='f88e3ea352b227202f20ea56560b17fcdbeffd6e'
const WORKER='intap-api-preview'
const ACTIVE='a9403c7c-9b2f-4274-ba0d-7978c7161566'
const ACTIVE_SHA='76db04f34a5bea3ae83bacfcd149f2d747882c1c173577d3e4e215a8fdcb96bc'
const ACTIVE_SOURCE='75e967bb4ddf1eabee2f3dbef0f8ba972126d690'
const PROD='766e8d93-260c-4fb7-841c-a833515bf9d6'
const DB='e9f46214-623f-48da-af13-74198e12b222'
const ACCOUNT='adf4d5ebb625fed2c32e38cef57a6319'
const BASE='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT
const TAG='KAWVO-R4-QA1-PREVIEW-'+CANDIDATE.slice(0,12)
const ROOT=process.cwd()
const API_DIR=join(homedir(),'intap-release-logs','r4-api-stage-'+CANDIDATE.slice(0,12))
const PAGES_DIR=join(homedir(),'intap-release-logs','r4-pages-stage-'+CANDIDATE.slice(0,12))
const DIR=join(homedir(),'intap-release-logs','r4-preview-promotion-'+CANDIDATE.slice(0,12))
const SCHEMA=join(homedir(),'intap-release-logs','kawvo-r4-preview-schema-6kyPtiFO')
const PROD_PAGES={'intap-web2':'166657db-e27e-4a5b-9396-1232aa4d0fd0','intap-link':'f4c4990d-98ed-42a3-a989-cd082a7168f4'}
const PREVIEW_PAGES={'intap-web2':'92350326-be77-4f6c-bf18-0b73a38001f1','intap-link':'3f53675a-d135-4bf1-9007-b36da0dd1462'}
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
  check(method==='GET'&&!payload,'reconciliación estrictamente de solo lectura')
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

const STAGE_API='e71b8f82-845b-4c40-b163-ac39589761fc'
const STAGE_SHA='94c8fa3cdea64a16100c77d494911fccdb2216790dbc2368034d047ae2dd9a26'
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
function context(){
 const files={}
 for(const name of ['functions','shared','package.json','package-lock.json','app/package.json','web/package.json']){
  const p=join(SOURCE,name)
  if(lstatSync(p).isDirectory())files[name]=manifest(p)
  else files[name]=sha(readFileSync(p))
 }
 for(const name of ['wrangler.toml','wrangler.json','wrangler.jsonc'])check(!existsSync(join(SOURCE,name)),'config Pages raíz inesperada')
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
async function verifyApi(token,baseline){
 const r=read(join(API_DIR,'stage-pass.json'))
 check(r.result==='R4_STAGE_API_PASS'&&r.candidate===CANDIDATE&&r.version===STAGE_API&&r.moduleSha256===STAGE_SHA&&r.baseline===ACTIVE&&r.bindings===35&&r.trafficUnchanged===true,'recibo Stage API distinto')
 const v=await request(token,'GET','/workers/workers/'+WORKER+'/versions/'+STAGE_API+'?include=modules')
 check(v.id===STAGE_API&&v.main_module===baseline.v.main_module&&v.modules?.length===1&&v.modules[0].name===v.main_module&&sha(Buffer.from(v.modules[0].content_base64,'base64'))===STAGE_SHA,'Stage API cambió')
 check(equal([...v.bindings].sort((a,b)=>a.name.localeCompare(b.name)),[...baseline.v.bindings].sort((a,b)=>a.name.localeCompare(b.name))),'bindings Stage API cambiaron')
 for(const k of runtime)check(equal(k==='compatibility_flags'?(v[k]||[]):v[k],k==='compatibility_flags'?(baseline.v[k]||[]):baseline.v[k]),'runtime Stage API cambió: '+k)
}
async function retryRead(fn){
 let error
 for(let i=0;i<4;i++){try{return await fn()}catch(e){error=e;if(i<3)await new Promise(resolve=>setTimeout(resolve,3000*(i+1)))}}
 throw error
}
async function getStage(token,s,url){
 const get=p=>request(token,'GET',p)
 const project=await get('/pages/projects/'+s.project)
 check(project.production_branch!==BRANCH&&project.source?.config?.production_deployments_enabled===false,'rama o automático producción inseguro')
 for(let page=1;page<=10;page++){
  const r=await get('/pages/projects/'+s.project+'/deployments?env=preview&per_page=10&page='+page)
  const rows=Array.isArray(r)?r:r?.items;check(Array.isArray(rows),'listado Pages inválido')
  const d=rows.find(d=>d.url===url)
  if(d){check(d.environment==='preview'&&d.deployment_trigger?.metadata?.branch===BRANCH&&d.deployment_trigger?.metadata?.commit_hash===CANDIDATE&&d.latest_stage?.status==='success'&&d.uses_functions===true,'metadata Stage no certificada '+s.project);return d}
  if(rows.length<10)break
 }
 throw Error('BLOCKED: deployment Stage todavía no acreditado '+s.project)
}
async function verifyAssets(s,d,prepared){
 const files=Object.entries(prepared.files).filter(([name])=>name.startsWith('assets/')&&/\.(js|css)$/.test(name))
 check(files.length>0,'sin assets JS/CSS')
 const index=readFileSync(join(SOURCE,s.folder,'dist','index.html'),'utf8').match(/\/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0]
 check(index&&prepared.files[index.slice(1)],'entry local ausente')
 const aliases=(d.aliases||[]).filter(u=>u==='https://'+BRANCH+'.'+s.project+'.pages.dev')
 check(aliases.length===1,'alias Stage no acreditado')
 for(const origin of [d.url,aliases[0]]){
  check((await bytes(origin+s.route)).toString().includes(index),'entry remoto distinto '+origin)
  for(let i=0;i<files.length;i+=6)await Promise.all(files.slice(i,i+6).map(async([name,digest])=>check(sha(await bytes(origin+'/'+name.split('/').map(encodeURIComponent).join('/')))===digest,'asset distinto '+name)))
 }
 return {entry:index,assets:files.length,alias:aliases[0]}
}

const pinned={
 app:{id:'fef2263a-7494-47c7-ab57-b5eb052152c0',origin:'https://fef2263a.intap-web2.pages.dev',entry:'/assets/index-C9oIdfYh.js',functions:'e90333fcaafe95ce29b43153709b876630532d8c107f13d1346e67d18bc199b8',assets:4},
 web:{id:'81096db5-e67d-48ea-942a-cd60c29b79f2',origin:'https://81096db5.intap-link.pages.dev',entry:'/assets/index-DITeb3sR.js',functions:'c27ab7aa6ac573bb2daa8e2e175ebf088e1db49ce1e489d25ff1616ab6b90054',assets:47}
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
  const x=pinned[s.folder],r=read(join(PAGES_DIR,s.folder+'-stage-pass.json')),p=read(join(PAGES_DIR,s.folder+'-prepared.json'))
  check(r.result==='R4_STAGE_'+s.folder.toUpperCase()+'_PASS'&&r.candidate===CANDIDATE&&r.project===s.project&&r.deployment===x.id&&r.origin===x.origin&&r.entry===x.entry&&r.assets===x.assets&&r.functionsSha256===x.functions&&r.sharedPreviewUnchanged===true&&r.productionUnchanged===true,'recibo Stage distinto: '+s.folder)
  check(p.candidate===CANDIDATE&&equal(p.files,manifest(join(SOURCE,s.folder,'dist')))&&equal(p.context,context()),'artefacto Stage cambió: '+s.folder)
  check(p.functionsSha256===x.functions&&sha(readFileSync(join(PAGES_DIR,s.folder+'-functions.bundle')))===x.functions&&sha(readFileSync(join(PAGES_DIR,s.folder+'-functions-routes.json')))===p.routesSha256,'Functions locales cambiaron')
  const d=await getStage(token,s,x.origin)
  check(d.id===x.id,'ID Stage no coincide')
  const proof=await verifyAssets(s,d,p)
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

async function inspect(url,expected,asset,diagnostic=false){
 const r=await fetch(url,{method:'GET',...(diagnostic?{cache:'no-store',headers:{'Cache-Control':'no-cache','Pragma':'no-cache','Accept-Encoding':'identity'}}:{}),redirect:'manual',signal:AbortSignal.timeout(30000)})
 const b=Buffer.from(await r.arrayBuffer())
 const type=r.headers.get('content-type')||''
 const mimeOK=asset.endsWith('.js')?/javascript|ecmascript/i.test(type):/text\/css/i.test(type)
 return {status:r.status,sha256:sha(b),bytes:b.length,type,encoding:r.headers.get('content-encoding'),cache:r.headers.get('cf-cache-status'),age:r.headers.get('age'),etag:r.headers.get('etag'),ray:r.headers.get('cf-ray'),match:r.status===200&&mimeOK&&sha(b)===expected}
}
async function inspectCanonical(proofs){
 const results=[]
 const nonce=String(Date.now())
 for(const {s,p,entry,assets,origin} of proofs){
  const html=await bytes(s.official+s.route)
  check(html.toString().includes(entry),'HTML oficial no corresponde: '+s.project)
  const files=Object.entries(p.files).filter(([name])=>name.startsWith('assets/')&&/\.(js|css)$/.test(name))
  check(files.length===assets,'inventario distinto')
  const rows=[]
  for(let i=0;i<files.length;i+=4){
   const group=await Promise.all(files.slice(i,i+4).map(async([name,expected])=>{
    const relative='/'+name.split('/').map(encodeURIComponent).join('/')
    const canonical=await inspect(s.official+relative,expected,name)
    if(canonical.match)return {name,expected,canonical}
    const [immutable,bypass]=await Promise.all([inspect(origin+relative,expected,name),inspect(s.official+relative+'?r4_reconcile='+nonce,expected,name,true)])
    return {name,expected,canonical,immutable,bypass}
   }))
   rows.push(...group)
  }
  results.push({surface:s.folder,entry,assets,matched:rows.filter(x=>x.canonical.match).length,rows})
 }
 return results
}
async function main(){
 check(process.argv.length===2,'ejecutar sin autorización de escritura')
 checkGit()
 const token=auth()
 const baseline=read(join(API_DIR,'baseline.private.json'))
 check(baseline.v.id===ACTIVE&&baseline.proof.preview.version===ACTIVE&&baseline.proof.moduleSha===ACTIVE_SHA,'baseline original no coincide')
 const uploaded=read(join(DIR,'upload-attempt.json')),inactive=read(join(DIR,'inactive.json')),attempt=read(join(DIR,'activate-attempt.json'))
 const info={candidate:CANDIDATE,rollback:ACTIVE,stagedApi:STAGE_API,moduleSha256:STAGE_SHA,app:pinned.app.id,web:pinned.web.id,bindings:35}
 for(const r of [uploaded,inactive,attempt])for(const [k,v] of Object.entries(info))check(r[k]===v,'recibo de promoción distinto: '+k)
 const id=inactive.version
 check(/^[a-f0-9-]{36}$/i.test(id||'')&&id!==ACTIVE&&id!==STAGE_API&&attempt.version===id,'identificador de promoción inválido')
 const deployment=await request(token,'GET',deploymentPath),current=deployment.deployments?.[0]
 const traffic=current?.versions?.map(x=>({version:x.version_id,percentage:x.percentage}))||[]
 console.log(JSON.stringify({result:'R4_QA1_LIVE_STATE',expected:id,traffic,rollback:ACTIVE},null,2))
 check(traffic.length===1&&traffic[0].version===id&&Number(traffic[0].percentage)===100,'la promoción no está activa al 100%; no repetir POST')
 await protectedProduction(token,baseline)
 await verifyApi(token,baseline)
 const staged=await request(token,'GET',versionPath+STAGE_API+'?include=modules')
 const promoted=await request(token,'GET',versionPath+id+'?include=modules')
 verifyPromoted(promoted,id,baseline.v,staged)
 const proofs=await pagesProof(token)
 const checks=await retryRead(smoke)
 const results=await inspectCanonical(proofs)
 const mismatches=results.flatMap(x=>x.rows.filter(r=>!r.canonical.match).map(r=>({surface:x.surface,...r})))
 const report={result:mismatches.length?'R4_QA1_ASSETS_BLOCKED':'R4_QA1_ASSETS_PASS',...info,version:id,traffic:100,checks,surfaces:results.map(({surface,entry,assets,matched})=>({surface,entry,assets,matched})),mismatches,productionUnchanged:true,functionsRemoteBinaryEquality:false,authenticatedQA:'PENDING'}
 await active(token,id);await protectedProduction(token,baseline)
 save('reconcile-'+Date.now()+'.json',{...report,results})
 console.log(JSON.stringify(report,null,2))
 if(mismatches.length)throw Error('BLOCKED: discrepancias canónicas; no purgar caché ni activar otra versión sin diagnóstico')
 await retryRead(()=>official(proofs))
 await active(token,id);await protectedProduction(token,baseline)
 // Exact canonical asset integrity + existing promotion receipts; no new deployment.
 if(!existsSync(join(DIR,'preview-pass.json')))save('preview-pass.json',{result:'R4_PREVIEW_ACTIVE_PASS',...info,version:id,traffic:100,checks,productionUnchanged:true,functionsRemoteBinaryEquality:false,authenticatedQA:'PENDING',reconciled:true})
 else {
  const existing=read(join(DIR,'preview-pass.json'))
  check(existing.result==='R4_PREVIEW_ACTIVE_PASS'&&existing.version===id&&existing.candidate===CANDIDATE,'recibo PASS existente distinto')
 }
 console.log(JSON.stringify({result:'R4_PREVIEW_ACTIVE_PASS',version:id,candidate:CANDIDATE,reconciled:true,evidence:DIR},null,2))
}
main().catch(e=>{
 const msg=String(e?.message||'error desconocido')
 console.error(msg.startsWith('BLOCKED:')?msg:'BLOCKED: '+(e?.code||e?.name||'Error')+'; reconciliación sin escrituras remotas')
 process.exitCode=1
})
