// S1-QA2: activate only verified inactive API stage; all bindings and Pages unchanged.
import {execFileSync} from 'node:child_process'
import {existsSync,mkdirSync,readFileSync,writeFileSync,symlinkSync} from 'node:fs'
import {homedir,tmpdir} from 'node:os'
import {join,basename} from 'node:path'
import {createHash} from 'node:crypto'

process.umask(0o077)
const CANDIDATE='1d6571a9e3f413d8d803a4732456bfa523d089d0'
const WORKER='intap-api-preview'
const ACTIVE='e81ea986-dc71-47ea-80fd-6324b2051034'
const ACTIVE_SHA='472c81ac891196420415f18c55c650c0a0cc22bab99b125e1b7c6492f993f10e'
const ACTIVE_SOURCE='79f210efdef551cf2b0cd4e80b3c82130e98a99c'
const PROD='766e8d93-260c-4fb7-841c-a833515bf9d6'
const DB='e9f46214-623f-48da-af13-74198e12b222'
const ACCOUNT='adf4d5ebb625fed2c32e38cef57a6319'
const BASE='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT
const TAG='KAWVO-R4-S1-QA2-STAGE-'+CANDIDATE.slice(0,12)
const ROOT=process.cwd()
const STAGE_DIR=join(homedir(),'intap-release-logs','r4-api-stage-'+CANDIDATE.slice(0,12))
const DIR=join(homedir(),'intap-release-logs','r4-preview-promotion-'+CANDIDATE.slice(0,12))
const SCHEMA=join(homedir(),'intap-release-logs','kawvo-r4-preview-schema-6kyPtiFO')
const PROD_PAGES={'intap-web2':'166657db-e27e-4a5b-9396-1232aa4d0fd0','intap-link':'f4c4990d-98ed-42a3-a989-cd082a7168f4'}
const PREVIEW_PAGES={'intap-web2':'6b0bf078-0888-4c3a-9e69-e029e95a91b1','intap-link':'baf8fa51-1cd6-4fa4-815f-24472c72f6e2'}
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
  check(method==='GET'&&!payload||method==='POST'&&path==='/workers/scripts/'+WORKER+'/deployments'&&payload,'operación fuera de activación Preview')
  const res=await fetch(BASE+path,{method,headers:{Authorization:token,...(payload?{'Content-Type':'application/json'}:{})},body:payload?JSON.stringify(payload):undefined,redirect:'error',signal:AbortSignal.timeout(method==='GET'?30000:120000)})
  const j=await res.json().catch(()=>null)
  check(res.ok&&j?.success===true,method+' '+path+' HTTP '+res.status+' codes '+(j?.errors||[]).map(e=>e.code).join(','))
  return j.result
}
async function live(token,expected=ACTIVE,expectedSha=ACTIVE_SHA){
  const get=p=>request(token,'GET',p)
  const active=async(worker,expected)=>{
    const d=await get('/workers/scripts/'+worker+'/deployments'),current=d.deployments?.[0]
    check(current?.id&&current.versions?.length===1&&current.versions[0].version_id===expected&&Number(current.versions[0].percentage)===100,'versión activa cambió: '+worker)
    return {id:current.id,version:expected}
  }
  const preview=await active(WORKER,expected),production=await active('intap-api',PROD)
  const v=await get('/workers/workers/'+WORKER+'/versions/'+expected+'?include=modules')
  check(v.id===expected&&v.bindings?.length===39&&new Set(v.bindings.map(b=>b.name)).size===39,'inventario de bindings distinto')
  check(v.modules?.length===1&&v.main_module===v.modules[0].name&&v.main_module==='preview-frontdoor-entry.js','entrypoint original distinto')
  check(v.modules[0].content_type==='application/javascript+module'&&sha(Buffer.from(v.modules[0].content_base64,'base64'))===expectedSha,'MIME o SHA original distinto')
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

async function checkPages(proof){
 const surfaces=[
  {folder:'app',candidate:'79f210efdef551cf2b0cd4e80b3c82130e98a99c',project:'intap-web2',host:'https://app.preview.intaprd.com',route:'/admin/login',entry:'/assets/index-D9owEkgD.js',assets:4},
  {folder:'web',candidate:'dfc666aa0a333ede69e893eb342d06f3abdf79d1',project:'intap-link',host:'https://preview.intaprd.com',route:'/',entry:'/assets/index-DxCC3ikT.js',assets:50}
 ]
 const bytes=async url=>{const r=await fetch(url,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(30000)});check(r.ok,'HTTP '+r.status+' '+url);return Buffer.from(await r.arrayBuffer())}
 for(const s of surfaces){
  const path=join(homedir(),'intap-release-logs','r4-pages-stage-'+s.candidate.slice(0,12))
  const receipt=read(join(path,s.folder+'-stage-pass.json')),manifest=read(join(path,s.folder+'-prepared.json'))
  check(receipt.candidate===s.candidate&&receipt.deployment===PREVIEW_PAGES[s.project]&&receipt.origin===proof.pages[s.project].origin&&receipt.entry===s.entry&&receipt.assets===s.assets,'recibo Pages distinto')
  check(manifest.candidate===s.candidate,'manifest Pages distinto')
  const files=Object.entries(manifest.files).filter(([name])=>name.startsWith('assets/')&&/\.(js|css)$/.test(name))
  check(files.length===s.assets,'inventario Pages distinto')
  if(s.folder==='web'){const name='assets/og/google-reviews.png';check(typeof manifest.files[name]==='string','PNG social ausente');files.push([name,manifest.files[name]])}
  for(const origin of [receipt.origin,s.host]){
   check((await bytes(origin+s.route)).toString().includes(s.entry),'entry Pages distinto')
   for(let i=0;i<files.length;i+=6)await Promise.all(files.slice(i,i+6).map(async([name,digest])=>check(sha(await bytes(origin+'/'+name.split('/').map(encodeURIComponent).join('/')))===digest,'asset Pages distinto: '+name)))
  }
 }
}
async function smoke(){
 const slug='r4-smoke-absent-'+CANDIDATE.slice(0,12)
 const a=await fetch('https://preview.intaprd.com/api/v1/public/profiles/'+slug+'/reviews',{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(30000)})
 const b=await a.json().catch(()=>null)
 check(a.status===200&&b?.ok===true&&b.data===null,'smoke público distinto')
 const c=await fetch('https://app.preview.intaprd.com/api/v1/me/profile/reviews/'+slug,{cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(30000)})
 check([401,403].includes(c.status),'smoke privado distinto')
 return {publicAbsent:a.status,privateAnonymous:c.status}
}
async function main(){
 check(process.argv.length===3&&process.argv[2]==='AUTORIZO R4 S1 QA2 PREVIEW API','autorización exacta requerida')
 check(git('rev-parse',CANDIDATE+'^{commit}')===CANDIDATE&&git('status','--porcelain')==='','checkout distinto')
 check(git('ls-remote','https://github.com/pgcsoluciones/intap-link.git','refs/heads/feature/kawvo-r4-google-place-search-2026-11-25').split(/\s+/)[0]===CANDIDATE,'candidato cambió')
 check(git('ls-remote','https://github.com/pgcsoluciones/intap-link.git','refs/heads/main').split(/\s+/)[0]==='e28b934a61c669ed270a656ae42cf68c1b518a82','main cambió')
 check(equal(git('diff','--name-only',ACTIVE_SOURCE,CANDIDATE).split('\n').sort(),["api/src/reviews/google-place-search.ts","docs/architecture/KAWVO_R4_GOOGLE_SEARCH_2026-11-25.md","scripts/test-kawvo-r4-google-search.mjs"]),'delta distinto')
 const response=await fetch('https://api.github.com/repos/pgcsoluciones/intap-link/actions/runs?head_sha='+CANDIDATE+'&event=pull_request&per_page=20',{headers:{Accept:'application/vnd.github+json','User-Agent':'Kawvo-R4-S1-QA2'},redirect:'error',signal:AbortSignal.timeout(30000)})
 check(response.ok,'CI no accesible')
 const ci=((await response.json()).workflow_runs||[]).find(r=>r.head_sha===CANDIDATE&&r.event==='pull_request'&&r.name==='INTAP LINK quality')
 check(ci?.status==='completed'&&ci.conclusion==='success','CI exacta no verde')
 const old=read(join(homedir(),'intap-release-logs','r4-preview-promotion-79f210efdef5','preview-pass.json'))
 check(old.result==='R4_PREVIEW_ACTIVE_PASS'&&old.candidate===ACTIVE_SOURCE&&old.version===ACTIVE&&old.moduleSha256===ACTIVE_SHA&&old.bindings===39&&old.app===PREVIEW_PAGES['intap-web2']&&old.web===PREVIEW_PAGES['intap-link'],'recibo QA1 distinto')
 const stage=read(join(STAGE_DIR,'stage-pass.json')),base=read(join(STAGE_DIR,'baseline.private.json'))
 check(stage.result==='R4_STAGE_API_PASS'&&stage.candidate===CANDIDATE&&stage.baseline===ACTIVE&&stage.bindings===39&&stage.trafficUnchanged===true&&stage.productionUnchanged===true&&stage.previewPagesUnchanged===true&&/^[a-f0-9-]{36}$/i.test(stage.version)&&stage.version!==ACTIVE&&/^[a-f0-9]{64}$/.test(stage.moduleSha256),'recibo Stage distinto')
 check(base.v.id===ACTIVE&&base.proof.preview.version===ACTIVE&&base.proof.moduleSha===ACTIVE_SHA,'baseline Stage distinta')
 const info={candidate:CANDIDATE,rollback:ACTIVE,stagedApi:stage.version,moduleSha256:stage.moduleSha256,app:old.app,web:old.web,bindings:39}
 const validate=v=>{
  check(v.id===stage.version&&v.annotations?.['workers/tag']===TAG&&v.main_module===base.v.main_module&&v.modules?.length===1&&v.modules[0].content_type===base.v.modules[0].content_type&&sha(Buffer.from(v.modules[0].content_base64,'base64'))===stage.moduleSha256,'bytes Stage distintos')
  check(equal([...v.bindings].sort((a,b)=>a.name.localeCompare(b.name)),[...base.v.bindings].sort((a,b)=>a.name.localeCompare(b.name))),'bindings Stage distintos')
  for(const k of runtime)check(equal(v[k],base.v[k]),'runtime distinto '+k)
 }
 mkdirSync(DIR,{recursive:true,mode:0o700})
 const attempted=existsSync(join(DIR,'activate-attempt.json'))
 let token=auth()
 validate(await request(token,'GET','/workers/workers/'+WORKER+'/versions/'+stage.version+'?include=modules'))
 if(!attempted){
  check(equal(await live(token),base),'baseline cambió')
  await checkPages(base.proof)
  token=auth()
  check(equal(await live(token),base),'baseline cambió antes de activar')
  console.log(JSON.stringify({result:'R4_S1_QA2_PROMOTION_PREFLIGHT_PASS',...info},null,2))
  save('activate-attempt.json',info)
  await request(token,'POST','/workers/scripts/'+WORKER+'/deployments',{strategy:'percentage',versions:[{version_id:stage.version,percentage:100}],annotations:{'workers/message':'R4 S1-QA2 Workers manual redirect; rollback '+ACTIVE}})
 }else check(equal(read(join(DIR,'activate-attempt.json')),info),'intento anterior distinto; no repetir')
 token=auth()
 const after=await live(token,stage.version,stage.moduleSha256)
 validate(after.v)
 check(equal(after.proof.pages,base.proof.pages)&&equal(after.proof.production,base.proof.production),'superficies protegidas distintas')
 await checkPages(after.proof)
 const checks=await smoke()
 const receipt={result:'R4_PREVIEW_ACTIVE_PASS',...info,version:stage.version,traffic:100,checks,assets:{app:4,web:50},productionUnchanged:true,webUnchanged:true,appUnchanged:true,googleSearchEnabled:true,googleCalls:0,functionsRemoteBinaryEquality:false,authenticatedQA:'PENDING',reconciled:attempted}
 if(!existsSync(join(DIR,'preview-pass.json')))save('preview-pass.json',receipt)
 else check(read(join(DIR,'preview-pass.json')).version===stage.version,'recibo anterior distinto')
 console.log(JSON.stringify({...receipt,evidence:DIR},null,2))
}
main().catch(e=>{console.error(String(e.message||'').startsWith('BLOCKED:')?e.message:'BLOCKED: '+(e.name||'Error'));console.error('Conservar recibos; no repetir activación ambigua. '+DIR);process.exitCode=1})
