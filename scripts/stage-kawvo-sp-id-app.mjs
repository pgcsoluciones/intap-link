// SP-ID: Stage App only; no migration or API compile/upload.
// Operational branch is separate from the product candidate. Never activates traffic.
import {execFileSync} from 'node:child_process'
import {existsSync,mkdirSync,readFileSync,writeFileSync,symlinkSync,readdirSync,lstatSync} from 'node:fs'
import {homedir,tmpdir} from 'node:os'
import {join,basename} from 'node:path'
import {createHash} from 'node:crypto'

process.umask(0o077)
const CANDIDATE='e7e38e941a15c322518ee81fe84e8bac7344b23c'
const WORKER='intap-api-preview'
const ACTIVE='e5b739c1-f778-4a90-84b9-fb985b7594e8'
const ACTIVE_SHA='2093a9a23c390809e104e22a6f031b7b1e400004f86445d59a997225df9291c3'
const ACTIVE_SOURCE='2bc1baf743b73d10ee88dbdecff58ae616d88e97'
const PROD='766e8d93-260c-4fb7-841c-a833515bf9d6'
const DB='e9f46214-623f-48da-af13-74198e12b222'
const ACCOUNT='adf4d5ebb625fed2c32e38cef57a6319'
const BASE='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT
const TAG='KAWVO-SP-ID-STAGE-'+CANDIDATE.slice(0,12)
const ROOT=process.cwd()
const API_DIR=join(homedir(),'intap-release-logs','r4-api-stage-'+ACTIVE_SOURCE.slice(0,12))
const DIR=join(homedir(),'intap-release-logs','r4-pages-stage-'+CANDIDATE.slice(0,12))
const SCHEMA=join(homedir(),'intap-release-logs','kawvo-r4-preview-schema-6kyPtiFO')
const PROD_PAGES={'intap-web2':'166657db-e27e-4a5b-9396-1232aa4d0fd0','intap-link':'f4c4990d-98ed-42a3-a989-cd082a7168f4'}
const PREVIEW_PAGES={'intap-web2':'6ae6041c-e238-4e29-be4a-65e13422597a','intap-link':'07aa15e6-637f-4fe5-a7da-b63b766601e3'}
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
// The build can outlive a Wrangler OAuth access token. Refresh GET only; never replay an upload.
let refreshedAuthorization=null
let authRefreshCount=0
async function request(token,method,path,payload){
  check(method==='GET'&&!payload,'solo lectura Cloudflare API; Stage App por Wrangler')
  const get=authorization=>fetch(BASE+path,{method:'GET',headers:{Authorization:authorization},redirect:'error',signal:AbortSignal.timeout(30000)})
  let res=await get(refreshedAuthorization||token)
  if(res.status===401&&!process.env.CLOUDFLARE_API_TOKEN&&authRefreshCount<3){
    authRefreshCount++
    console.log('HTTP 401 en consulta GET; renovando sesión Wrangler (máximo tres renovaciones GET).')
    await res.arrayBuffer()
    refreshedAuthorization=auth()
    res=await get(refreshedAuthorization)
  }
  const j=await res.json().catch(()=>null)
  check(res.status!==401,'Cloudflare rechazó la autenticación; renovar sesión local, no repetir subida si existe marcador')
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
  check(v.id===ACTIVE&&v.bindings?.length===39&&new Set(v.bindings.map(b=>b.name)).size===39,'inventario de bindings distinto')
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

const BRANCH='qa-r4-'+CANDIDATE.slice(0,12)
const SOURCE=join(DIR,'source')
const surfaces=[
 {folder:'app',project:'intap-web2',route:'/admin/login',official:'https://app.preview.intaprd.com'},
 {folder:'web',project:'intap-link',route:'/',official:'https://preview.intaprd.com'}
]
const env={...process.env,CLOUDFLARE_ACCOUNT_ID:ACCOUNT,WRANGLER_SEND_METRICS:'false'}
function command(binary,args,cwd,log){
 try{
   const output=execFileSync(binary,args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe'],env,maxBuffer:32*1024*1024,timeout:900000})
   writeFileSync(log,output,{mode:0o600,flag:'wx'});return output
 }catch(e){if(!existsSync(log))writeFileSync(log,String(e.stdout||'')+String(e.stderr||''),{mode:0o600,flag:'wx'});throw Error('BLOCKED: '+basename(log)+'; conservar evidencia, no repetir upload ambiguo')}
}
const wrangler=(args,log)=>command('npx',['--yes','--package=wrangler@4.166.0','--','wrangler',...args],SOURCE,join(DIR,log))
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
function prepare(s){
 const file=join(DIR,s.folder+'-prepared.json'),dist=join(SOURCE,s.folder,'dist')
 if(existsSync(file)){
  const p=read(file)
  check(p.candidate===CANDIDATE&&equal(p.files,manifest(dist))&&equal(p.context,context()),'artefacto preparado cambió: '+s.folder)
  check(sha(readFileSync(join(DIR,s.folder+'-functions.bundle')))===p.functionsSha256&&sha(readFileSync(join(DIR,s.folder+'-functions-routes.json')))===p.routesSha256,'Functions preparadas cambiaron')
  return p
 }
 check(!existsSync(dist),'build anterior incompleto; conservar evidencia '+s.folder)
 command('npm',['run','build:preview','-w',s.folder],SOURCE,join(DIR,s.folder+'-build.private.log'))
 wrangler(['pages','functions','build','functions','--outfile',join(DIR,s.folder+'-functions.bundle'),'--output-routes-path',join(DIR,s.folder+'-functions-routes.json'),'--build-output-directory',s.folder+'/dist'],s.folder+'-functions-build.private.log')
 checkSource()
 const p={candidate:CANDIDATE,files:manifest(dist),context:context(),functionsSha256:sha(readFileSync(join(DIR,s.folder+'-functions.bundle'))),routesSha256:sha(readFileSync(join(DIR,s.folder+'-functions-routes.json')))}
 save(s.folder+'-prepared.json',p)
 return p
}
async function main(){
 check(process.argv.length===3&&process.argv[2]==='AUTORIZO SP ID STAGE APP','autorización explícita Stage App requerida')
 check(git('rev-parse',CANDIDATE+'^{commit}')===CANDIDATE,'falta candidato exacto')
 check(git('ls-remote','https://github.com/pgcsoluciones/intap-link.git','refs/heads/feature/kawvo-sponsor-identity-entry-2026-11-26').split(/\s+/)[0]===CANDIDATE,'candidato cambió')
 check(git('ls-remote','https://github.com/pgcsoluciones/intap-link.git','refs/heads/main').split(/\s+/)[0]==='e28b934a61c669ed270a656ae42cf68c1b518a82','main cambió; revisar candidato')
 check(git('status','--porcelain')==='','checkout local sucio')
 git('diff','--exit-code','HEAD',CANDIDATE,'--','package.json','package-lock.json','app/package.json','web/package.json')
 mkdirSync(DIR,{recursive:true,mode:0o700})
 console.log('Preflight: verificando Worker y Pages activos, sin escrituras.')
 check(equal(git('diff','--name-only',ACTIVE_SOURCE,CANDIDATE).split('\n').sort(),[".github/workflows/quality.yml","app/src/components/admin/sponsored/SponsorDashboard.tsx","app/src/components/admin/sponsored/SponsorKawMed.tsx","docs/architecture/KAWVO_SPONSOR_IDENTITY_ENTRY_2026-11-26.md","scripts/test-sponsor-identity-entry.mjs"]),'delta SP-ID fuera de alcance')
 git('diff','--exit-code',ACTIVE_SOURCE,CANDIDATE,'--','api','web','functions','shared','docs/releases','package.json','package-lock.json','app/package.json')
 const migrationDir=join(homedir(),'intap-release-logs','r4-p1-schema-e55027c52ec0')
 const migration=read(join(migrationDir,'schema-pass.json'))
 check(migration.result==='R4_P1_SCHEMA_PREVIEW_PASS'&&migration.candidate==='e55027c52ec0d18d7ca9c76d85e99da7757c4335'&&migration.database===DB&&migration.worker==='22ea2ded-13bf-4f6d-95aa-70feb28e5ffe'&&migration.productionUnchanged===true&&migration.workerUnchanged===true&&migration.googleCalls===0&&equal(migration.tables,['sponsored_review_settings','sponsored_review_events'])&&migration.rows?.settings===0&&migration.rows?.events===0,'schema P1 no acreditado')
 check(sha(readFileSync(join(migrationDir,'intap_db_preview.before.sql')))===migration.backupSha256&&sha(readFileSync(join(migrationDir,'sponsored-reviews.sql')))===migration.sqlSha256&&sha(git('show',CANDIDATE+':docs/releases/kawvo-r4-proposed-migrations/sponsored-reviews.sql')+'\n')===migration.sqlSha256,'respaldo o SQL P1 no acreditado')
 const waDir=join(homedir(),'intap-release-logs','sp-wa-schema-'+ACTIVE_SOURCE.slice(0,12)),wa=read(join(waDir,'schema-pass.json'))
 check(wa.result==='SP_WA_SCHEMA_PREVIEW_PASS'&&wa.candidate===ACTIVE_SOURCE&&wa.database===DB&&wa.worker==='b11a32e8-6f2b-47db-baf3-fb8b26f9bee1'&&wa.productionUnchanged===true&&wa.workerUnchanged===true&&wa.googleCalls===0&&equal(wa.tables,['sponsor_commercial_contact_settings'])&&wa.rows?.settings===0,'schema SP-WA no acreditado')
 check(sha(readFileSync(join(waDir,'intap_db_preview.before.sql')))===wa.backupSha256&&sha(readFileSync(join(waDir,'contact-message.sql')))===wa.sqlSha256&&sha(git('show',CANDIDATE+':docs/releases/kawvo-sponsor-contact-proposed-migrations/contact-message.sql')+'\n')===wa.sqlSha256,'respaldo o SQL SP-WA no acreditado')
 const apiReceipt=read(join(API_DIR,'stage-pass.json'))
 check(apiReceipt.result==='R4_STAGE_API_PASS'&&apiReceipt.candidate===ACTIVE_SOURCE&&apiReceipt.baseline==='b11a32e8-6f2b-47db-baf3-fb8b26f9bee1'&&apiReceipt.version==='9292c6ac-cb33-4a5b-a71d-15db24d29bcf'&&apiReceipt.moduleSha256===ACTIVE_SHA&&apiReceipt.bindings===39&&apiReceipt.trafficUnchanged===true&&apiReceipt.productionUnchanged===true,'recibo API SP-WA no acreditado')
 const ciResponse=await fetch('https://api.github.com/repos/pgcsoluciones/intap-link/actions/runs?head_sha='+CANDIDATE+'&event=pull_request&per_page=20',{headers:{Accept:'application/vnd.github+json','User-Agent':'Kawvo-R4-P0'},redirect:'error',signal:AbortSignal.timeout(30000)})
 check(ciResponse.ok,'CI no accesible; sin escrituras')
 const ci=((await ciResponse.json()).workflow_runs||[]).find(r=>r.head_sha===CANDIDATE&&r.event==='pull_request'&&r.name==='INTAP LINK quality')
 check(ci?.id===45835129958&&ci.status==='completed'&&ci.conclusion==='success','CI exacta no verde')
 const free=Number(execFileSync('df',['-Pk',homedir()],{encoding:'utf8'}).trim().split('\n').pop().trim().split(/\s+/)[3])
 check(free>=2*1024*1024,'espacio libre inferior a 2 GiB; liberar antes de compilar')
 const token=auth(),baseline=await live(token)
 const previous=read(join(homedir(),'intap-release-logs','r4-preview-promotion-2bc1baf743b7','preview-pass.json'))
 check(previous.result==='R4_PREVIEW_ACTIVE_PASS'&&previous.candidate===ACTIVE_SOURCE&&previous.version===ACTIVE&&previous.moduleSha256===ACTIVE_SHA&&previous.app===PREVIEW_PAGES['intap-web2']&&previous.web===PREVIEW_PAGES['intap-link'],'recibo QA3 distinto')
 await verifyOfficial(baseline.proof)
 if(existsSync(join(DIR,'baseline.private.json')))check(equal(read(join(DIR,'baseline.private.json')),baseline),'baseline cambió')
 else save('baseline.private.json',baseline)
 console.log('PASS: API SP-WA y superficies vigentes verificadas; Preview oficial intacto.')
 if(!existsSync(SOURCE)){
  mkdirSync(SOURCE,{mode:0o700})
  execFileSync('tar',['-x','-C',SOURCE],{input:execFileSync('git',['archive',CANDIDATE],{cwd:ROOT,maxBuffer:256*1024*1024}),stdio:['pipe','pipe','pipe']})
  for(const rel of ['node_modules','app/node_modules','web/node_modules'])if(existsSync(join(ROOT,rel)))symlinkSync(join(ROOT,rel),join(SOURCE,rel),'dir')
  save('source-ready.json',{candidate:CANDIDATE,context:context()})
 }
 check(read(join(DIR,'source-ready.json')).candidate===CANDIDATE&&equal(read(join(DIR,'source-ready.json')).context,context()),'contexto fuente cambió')
 checkSource()
 console.log('PASS: fuentes Git verificadas, incluidos nombres UTF-8.')
 const receipts=[]
 for(const s of surfaces.filter(s=>s.folder==='app')){
  const pass=join(DIR,s.folder+'-stage-pass.json'),attempt=join(DIR,s.folder+'-stage-attempt.json')
  check(!existsSync(attempt)||existsSync(pass),'intento anterior sin recibo '+s.folder+'; no repetir')
  console.log('Preparación '+s.folder+'; intento previo='+existsSync(attempt)+'; recibo previo='+existsSync(pass))
  const p=prepare(s)
  if(existsSync(pass)){
   const r=read(pass);check(r.candidate===CANDIDATE&&r.project===s.project,'recibo Stage distinto')
   const d=await getStage(token,s,r.origin);check(d.id===r.deployment,'deployment cambió');await verifyAssets(s,d,p);receipts.push(r);continue
  }
  const project=await request(token,'GET','/pages/projects/'+s.project)
  check(project.production_branch!==BRANCH&&project.source?.config?.production_deployments_enabled===false,'rama/automatismo no seguro')
  check(!baseline.proof.pages[s.project].origin.includes(BRANCH+'.'),'rama Stage colisiona con Preview')
  const list=await request(token,'GET','/pages/projects/'+s.project+'/deployments?env=preview&per_page=10&page=1')
  const rows=Array.isArray(list)?list:list?.items
  check(Array.isArray(rows)&&!rows.some(d=>d.deployment_trigger?.metadata?.branch===BRANCH),'rama Stage ya usada; no repetir')
  check(equal(await live(token),baseline),'baseline cambió antes de Stage')
  console.log('PASS: artefacto '+s.folder+' preparado; iniciando único upload autorizado.')
  save(s.folder+'-stage-attempt.json',{candidate:CANDIDATE,project:s.project,branch:BRANCH,prepared:p})
  const output=wrangler(['pages','deploy',s.folder+'/dist','--project-name',s.project,'--branch',BRANCH,'--commit-hash',CANDIDATE,'--commit-dirty=false'],s.folder+'-deploy.private.log')
  check(/Uploading Functions bundle/i.test(output),'Functions no acreditadas; no repetir')
  const urls=[...new Set((output.match(/https:\/\/[a-f0-9]{8,}\.[a-z0-9-]+\.pages\.dev/g)||[]).filter(u=>u.endsWith('.'+s.project+'.pages.dev')))]
  check(urls.length===1,'URL inmutable ambigua; no repetir')
  const d=await retryRead(()=>getStage(token,s,urls[0])),verified=await retryRead(()=>verifyAssets(s,d,p))
  check(equal(manifest(join(SOURCE,s.folder,'dist')),p.files)&&equal(context(),p.context),'artefacto/contexto cambió durante Stage')
  check(equal(await live(token),baseline),'baseline protegida cambió después de Stage')
  await verifyOfficial(baseline.proof)
  const r={result:'R4_STAGE_'+s.folder.toUpperCase()+'_PASS',candidate:CANDIDATE,project:s.project,branch:BRANCH,deployment:d.id,origin:d.url,functionsSha256:p.functionsSha256,functionsRemoteBinaryEquality:false,...verified,sharedPreviewUnchanged:true,productionUnchanged:true}
  save(s.folder+'-stage-pass.json',r);console.log(JSON.stringify(r,null,2));receipts.push(r)
 }
 check(equal(await live(token),baseline),'baseline final cambió')
 console.log(JSON.stringify({result:'SP_ID_STAGE_APP_PASS',candidate:CANDIDATE,apiActive:ACTIVE,apiModuleSha256:ACTIVE_SHA,apiRecompiled:false,pages:receipts,previewActive:false,authenticatedQA:'PENDING',evidence:DIR},null,2))
}
main().catch(e=>{
 const msg=String(e?.message||'error desconocido')
 try{if(existsSync(DIR))writeFileSync(join(DIR,'error-'+Date.now()+'.private.txt'),String(e?.stack||msg),{mode:0o600,flag:'wx'})}catch{}
 console.error(msg.startsWith('BLOCKED:')?msg:'BLOCKED: '+(e?.code||e?.name||'Error')+'; revisar diagnóstico privado; no repetir upload ambiguo')
 console.error(JSON.stringify({evidence:DIR,sourceReady:existsSync(join(DIR,'source-ready.json')),appPrepared:existsSync(join(DIR,'app-prepared.json')),appAttempt:existsSync(join(DIR,'app-stage-attempt.json')),appPass:existsSync(join(DIR,'app-stage-pass.json')),webPrepared:existsSync(join(DIR,'web-prepared.json')),webAttempt:existsSync(join(DIR,'web-stage-attempt.json')),webPass:existsSync(join(DIR,'web-stage-pass.json')),localPath:typeof e?.path==='string'&&e.path.startsWith(DIR)?e.path.slice(DIR.length):undefined},null,2))
 process.exitCode=1
})
