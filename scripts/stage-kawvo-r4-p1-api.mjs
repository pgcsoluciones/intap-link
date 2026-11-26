// R4: compile exact CI-approved candidate, upload inactive API only.
// Operational branch is separate from the product candidate. Never activates traffic.
import {execFileSync} from 'node:child_process'
import {existsSync,mkdirSync,readFileSync,writeFileSync,symlinkSync} from 'node:fs'
import {homedir,tmpdir} from 'node:os'
import {join,basename} from 'node:path'
import {createHash} from 'node:crypto'

process.umask(0o077)
const CANDIDATE='e55027c52ec0d18d7ca9c76d85e99da7757c4335'
const WORKER='intap-api-preview'
const ACTIVE='22ea2ded-13bf-4f6d-95aa-70feb28e5ffe'
const ACTIVE_SHA='70e7e22b923751318bd9e718e97bd51c00b168c92338b94f237956a7d734652f'
const ACTIVE_SOURCE='311b5fe6cc104a7007174f6f2fba730802cc392b'
const PROD='766e8d93-260c-4fb7-841c-a833515bf9d6'
const DB='e9f46214-623f-48da-af13-74198e12b222'
const ACCOUNT='adf4d5ebb625fed2c32e38cef57a6319'
const BASE='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT
const TAG='KAWVO-R4-P1-STAGE-'+CANDIDATE.slice(0,12)
const ROOT=process.cwd()
const DIR=join(homedir(),'intap-release-logs','r4-api-stage-'+CANDIDATE.slice(0,12))
const SCHEMA=join(homedir(),'intap-release-logs','kawvo-r4-preview-schema-6kyPtiFO')
const PROD_PAGES={'intap-web2':'166657db-e27e-4a5b-9396-1232aa4d0fd0','intap-link':'f4c4990d-98ed-42a3-a989-cd082a7168f4'}
const PREVIEW_PAGES={'intap-web2':'1be92438-d83f-4ce8-9d0a-75dcae4a23c1','intap-link':'baf8fa51-1cd6-4fa4-815f-24472c72f6e2'}
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
  check(method==='GET'&&!payload||method==='POST'&&path==='/workers/workers/'+WORKER+'/versions?deploy=false'&&payload,'operación fuera de Stage API')
  let res=await fetch(BASE+path,{method,headers:{Authorization:token,...(payload?{'Content-Type':'application/json'}:{})},body:payload?JSON.stringify(payload):undefined,redirect:'error',signal:AbortSignal.timeout(method==='GET'?30000:120000)})
  if(method==='GET'&&res.status===401&&!process.env.CLOUDFLARE_API_TOKEN){await res.arrayBuffer();res=await fetch(BASE+path,{method:'GET',headers:{Authorization:auth()},redirect:'error',signal:AbortSignal.timeout(30000)})}
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
function checkReceipt(){
  check(readFileSync(join(SCHEMA,'candidate.sha'),'utf8').trim()==='75e967bb4ddf1eabee2f3dbef0f8ba972126d690','recibo de schema original no coincide')
  const r=read(join(SCHEMA,'after.json'))
  check(r.length===4&&r.every(x=>x.success===true&&x.meta.changed_db===false&&Number(x.meta.rows_written)===0),'recibo D1 inválido')
  check(equal(r[0].results.map(x=>x.name),['profile_id','enabled','google_review_url','updated_at']),'schema no verificado')
  check(r[2].results[0]?.code==='reviews_google'&&r[2].results[0]?.is_active===1&&equal(JSON.parse(r[2].results[0].effects_json).includedPlans,['free','basic']),'catálogo incorrecto')
  check(r[3].results[0]?.n===0,'recibo inicial no vacío')
  const backup=readFileSync(join(SCHEMA,'intap_db_preview.before.sql'))
  check(backup.length>0&&readFileSync(join(SCHEMA,'backup.sha256'),'utf8').split(/\s+/)[0]===sha(backup),'respaldo privado no verificable')
}
async function compile(old){
  const src=join(DIR,'source'),prepared=join(DIR,'prepared.json'),file=join(DIR,'module.private.json')
  if(existsSync(prepared)){
    const p=read(prepared),m=read(file)
    check(p.candidate===CANDIDATE&&p.baseline===ACTIVE&&p.moduleSha===sha(Buffer.from(m.content_base64,'base64')),'paquete preparado cambió')
    return m
  }
  const config=join(DIR,'build-only.json'),form=join(DIR,'compiled-form.private.bin')
  const expectedConfig={name:WORKER,main:join(src,'api/src/preview-frontdoor-entry.ts'),compatibility_date:old.compatibility_date,compatibility_flags:old.compatibility_flags||[]}
  if(!existsSync(src)){
    mkdirSync(src,{mode:0o700})
    execFileSync('tar',['-x','-C',src],{input:execFileSync('git',['archive',CANDIDATE,'api/src','api/tsconfig.json','api/package.json','shared'],{cwd:ROOT,maxBuffer:128*1024*1024}),stdio:['pipe','pipe','pipe']})
    for(const rel of ['node_modules','api/node_modules'])if(existsSync(join(ROOT,rel)))symlinkSync(join(ROOT,rel),join(src,rel),'dir')
    save('build-only.json',expectedConfig)
    const env={...process.env,WRANGLER_SEND_METRICS:'false',WRANGLER_LOG_PATH:join(DIR,'wrangler.private.log')}
    try{
      const output=execFileSync('npx',['--yes','--package=wrangler@4.166.0','--','wrangler','versions','upload','--dry-run','--config',config,'--outdir',join(DIR,'bundle'),'--outfile',form],{cwd:src,encoding:'utf8',stdio:['ignore','pipe','pipe'],env,maxBuffer:32*1024*1024})
      writeFileSync(join(DIR,'build.private.log'),output,{mode:0o600})
    }catch(e){writeFileSync(join(DIR,'build.private.log'),String(e.stdout||'')+String(e.stderr||''),{mode:0o600});throw Error('BLOCKED: compilación local falló; revisar build.private.log; sin upload')}
  }else{
    check(existsSync(config)&&existsSync(form)&&existsSync(join(DIR,'build.private.log')),'preparación incompleta; conservar evidencia')
    console.log('Recuperando compilación existente; no recompilar ni repetir D1.')
  }
  check(equal(read(config),expectedConfig),'configuración de compilación cambió')
  const tree=git('ls-tree','-rz',CANDIDATE,'--','api/src','api/tsconfig.json','api/package.json','shared').split('\0').filter(Boolean)
  for(const line of tree){
    const match=line.match(/^100(?:644|755) blob ([a-f0-9]{40})\t([\s\S]+)$/)
    check(match,'entrada inesperada en árbol Git')
    const data=readFileSync(join(src,match[2]))
    const hash=createHash('sha1').update('blob '+data.length+'\0').update(data).digest('hex')
    check(hash===match[1],'fuente extraída cambió: '+match[2])
  }
  const bytes=readFileSync(form),boundary=bytes.subarray(0,bytes.indexOf('\r\n')).toString().slice(2)
  check(boundary.length>0,'multipart de compilación inválido')
  const parts=await new Response(bytes,{headers:{'content-type':'multipart/form-data; boundary='+boundary}}).formData()
  const rawMeta=parts.get('metadata')
  const meta=JSON.parse(typeof rawMeta==='string'?rawMeta:await rawMeta.text())
  const modules=[]
  for(const [name,f] of parts)if(name!=='metadata'){
    check(typeof f!=='string','parte de módulo no binaria: '+name)
    modules.push({name,filename:f.name,content_type:f.type,bytes:Buffer.from(await f.arrayBuffer())})
  }
  const shape={main:meta.main_module,bodyPart:meta.body_part||null,parts:modules.map(m=>({name:m.name,filename:m.filename,mime:m.content_type,bytes:m.bytes.length,sha256:sha(m.bytes)}))}
  console.log('Formato local: '+JSON.stringify(shape))
  check(!meta.body_part&&typeof meta.main_module==='string','no es un paquete ES Modules')
  // Only one executable entry, matching the exact dry-run artifact and active entrypoint.
  // Some compiler versions attach a .map or use application/javascript instead of
  // application/javascript+module. A source map is not a Worker runtime module.
  const entry=modules.filter(m=>m.name===meta.main_module)
  check(entry.length===1,'no hay un entrypoint único identificado por metadata')
  const main=entry[0],name=basename(meta.main_module)
  check(name===old.main_module&&[name,'./'+name].includes(meta.main_module),'nombre de entrypoint distinto: '+JSON.stringify(shape))
  check(['application/javascript+module','application/javascript','text/javascript'].includes(main.content_type),'MIME de entrypoint no admitido')
  const extras=modules.filter(m=>m!==main)
  for(const extra of extras){
    check([name+'.map','./'+name+'.map'].includes(extra.name)&&['application/json','application/source-map','application/octet-stream','text/plain',''].includes(extra.content_type),'módulo adicional no admitido: '+extra.name)
    const map=JSON.parse(extra.bytes.toString('utf8'))
    check(map.version===3&&Array.isArray(map.sources)&&typeof map.mappings==='string','source map inválido')
  }
  check(extras.length<=1,'más de un mapa de fuentes')
  const disk=join(DIR,'bundle',name)
  check(existsSync(disk)&&readFileSync(disk).equals(main.bytes),'bytes del entrypoint no coinciden con salida dry-run')
  const code=main.bytes
  execFileSync(process.execPath,['--input-type=module','--check'],{input:code,stdio:['pipe','pipe','pipe']})
  const m={name:old.main_module,content_type:old.modules[0].content_type,content_base64:code.toString('base64')}
  for(const marker of ['profile_review_settings','reviews_google','review_click','profile_preview_sessions','kawvo_preview_session','intap_profile_v2','tw.master_profile_id,tw.owner_user_id','member_status','team_status','places.id','review_google_search_usage','GOOGLE_PLACES_API_KEY','GOOGLE_SEARCH_BILLING','GOOGLE_SEARCH_PROVIDER_DENIED','sponsored_review_settings','sponsored_review_events','/sponsored-profile/reviews/:profileId'])check(code.includes(marker),'bundle sin marcador '+marker)
  check(sha(code)!==sha(Buffer.from(old.modules[0].content_base64,'base64')),'candidato idéntico a activa')
  save('module.private.json',m);save('prepared.json',{candidate:CANDIDATE,baseline:ACTIVE,moduleSha:sha(code),formSha:sha(bytes),format:shape,compiler:'Wrangler 4.166.0 dry-run'})
  return m
}
async function main(){
  check(process.argv.length===3&&process.argv[2]==='AUTORIZO R4 P1 STAGE API','autorización explícita Stage API requerida')
  console.log('Preflight S1: comprobando candidato y recibos; sin escrituras remotas.')
  check(!existsSync(join(DIR,'upload-attempt.json'))||existsSync(join(DIR,'stage-pass.json')),'intento anterior; reconciliar, nunca repetir upload')
  check(git('rev-parse',CANDIDATE+'^{commit}')===CANDIDATE,'falta candidato')
  check(git('ls-remote','https://github.com/pgcsoluciones/intap-link.git','refs/heads/feature/kawvo-r4-p1-sponsored-reviews-2026-11-25').split(/\s+/)[0]===CANDIDATE,'candidato cambió')
  check(git('status','--porcelain')==='','checkout local sucio; no modificar')
  git('diff','--exit-code','HEAD',CANDIDATE,'--','package.json','package-lock.json','api/package.json')
  check(equal(git('diff','--name-only',ACTIVE_SOURCE,CANDIDATE).split('\n').sort(),[".github/workflows/quality.yml","api/src/index.ts","api/src/reviews/link-adapter.ts","api/src/reviews/sponsored-adapter.ts","app/src/components/admin/shared/GoogleReviewLinkEditor.tsx","app/src/components/admin/shared/ReviewsTenantPanel.tsx","app/src/components/admin/sponsored/SponsorDashboard.tsx","app/src/components/admin/sponsored/SponsoredDashboard.tsx","app/src/components/admin/sponsored/SponsoredUnifiedShell.tsx","app/src/components/admin/sponsored/sponsored-shell-gate.ts","docs/architecture/KAWVO_R4_P1_SPONSORED_REVIEWS_2026-11-25.md","docs/releases/kawvo-r4-proposed-migrations/sponsored-reviews.sql","functions/_middleware.ts","scripts/test-kawvo-r4-sponsored-reviews.mjs","web/src/components/reviews/LinkReviews.tsx","web/src/components/reviews/review-section-links.ts","web/src/components/sponsored/SponsoredProfile.tsx"]),'delta P1 fuera de alcance')
  check(existsSync(join(ROOT,'node_modules')),'dependencias existentes requeridas')
  const free=Number(execFileSync('df',['-Pk',homedir()],{encoding:'utf8'}).trim().split('\n').pop().trim().split(/\s+/)[3])
  check(free>=2*1024*1024,'espacio libre inferior a 2 GiB; liberar antes de compilar')
  check(git('ls-remote','https://github.com/pgcsoluciones/intap-link.git','refs/heads/main').split(/\s+/)[0]==='e28b934a61c669ed270a656ae42cf68c1b518a82','main cambió')
  const ciResponse=await fetch('https://api.github.com/repos/pgcsoluciones/intap-link/actions/runs?head_sha='+CANDIDATE+'&event=pull_request&per_page=20',{headers:{Accept:'application/vnd.github+json','User-Agent':'Kawvo-R4-T1'},redirect:'error',signal:AbortSignal.timeout(30000)})
  check(ciResponse.ok,'CI pública no disponible; sin upload')
  const runs=(await ciResponse.json()).workflow_runs||[]
  const ci=runs.find(r=>r.head_sha===CANDIDATE&&r.event==='pull_request'&&r.name==='INTAP LINK quality')
  check(ci?.status==='completed'&&ci.conclusion==='success','CI exacta no verde; sin upload')
  console.log('PASS: SHA exacto, delta y CI GitHub '+ci.id+' verificados.')
  checkReceipt()
 const migration=read(join(homedir(),'intap-release-logs','r4-p1-schema-'+CANDIDATE.slice(0,12),'schema-pass.json'))
 check(migration.result==='R4_P1_SCHEMA_PREVIEW_PASS'&&migration.candidate===CANDIDATE&&migration.database===DB&&migration.worker===ACTIVE&&migration.productionUnchanged===true,'schema P1 no acreditado')
  const quota=read(join(homedir(),'intap-release-logs','r4-s1-quota-3348dfc1cbdc','quota-pass.json'))
  check(quota.result==='R4_S1_QUOTA_PREVIEW_PASS'&&quota.candidate==='3348dfc1cbdcc3a1462abd05ba905a0888cf8554'&&quota.database===DB&&quota.worker==='5d25113b-9ef9-429a-8e58-4f81e873092f','cuota Preview no acreditada')
  const oldReceipt=read(join(homedir(),'intap-release-logs','r4-preview-promotion-311b5fe6cc10','preview-pass.json'))
  check(oldReceipt.result==='R4_PREVIEW_ACTIVE_PASS'&&oldReceipt.candidate===ACTIVE_SOURCE&&oldReceipt.version===ACTIVE&&oldReceipt.moduleSha256===ACTIVE_SHA&&oldReceipt.app===PREVIEW_PAGES['intap-web2']&&oldReceipt.web===PREVIEW_PAGES['intap-link']&&oldReceipt.googleSearchEnabled===true&&oldReceipt.bindings===39,'recibo activo QA1 anterior no coincide')
  mkdirSync(DIR,{recursive:true,mode:0o700})
  check(!existsSync(join(DIR,'upload-attempt.json'))||existsSync(join(DIR,'stage-pass.json')),'intento anterior; reconciliar, nunca repetir upload')
  console.log('PASS: recibo de esquema y promoción anterior; verificando baseline remota.')
  let token=auth();const before=await live(token)
  if(existsSync(join(DIR,'baseline.private.json')))check(equal(read(join(DIR,'baseline.private.json')),before),'baseline cambió desde preparación')
  else save('baseline.private.json',before)
  console.log('PASS: baseline vigente; preparando módulo API.')
  if(existsSync(join(DIR,'stage-pass.json'))){
    const r=read(join(DIR,'stage-pass.json'))
    check(r.result==='R4_STAGE_API_PASS'&&r.candidate===CANDIDATE&&r.baseline===ACTIVE,'recibo Stage distinto')
    const v=await request(token,'GET','/workers/workers/'+WORKER+'/versions/'+r.version+'?include=modules')
    check(v.id===r.version&&sha(Buffer.from(v.modules[0].content_base64,'base64'))===r.moduleSha256&&equal([...v.bindings].sort((a,b)=>a.name.localeCompare(b.name)),[...before.v.bindings].sort((a,b)=>a.name.localeCompare(b.name))),'Stage existente distinto')
    console.log(JSON.stringify({...r,resumed:true,evidence:DIR},null,2));return
  }
  const module=await compile(before.v)
  token=auth();const current=await live(token)
  check(equal(before,current),'baseline cambió durante compilación')
  const history=await request(token,'GET','/workers/workers/'+WORKER+'/versions')
  const rows=Array.isArray(history)?history:history?.items||history?.versions
  check(Array.isArray(rows)&&!rows.some(x=>x.annotations?.['workers/tag']===TAG),'Stage previo o historia no acreditada')
  check(before.v.bindings.find(b=>b.name==='GOOGLE_PLACES_API_KEY')?.type==='secret_text'&&before.v.bindings.find(b=>b.name==='GOOGLE_MAPS_EMBED_KEY')?.type==='secret_text'&&before.v.bindings.find(b=>b.name==='GOOGLE_REVIEWS_SEARCH_ENABLED')?.text==='1','Google bindings no acreditados')
  const body={main_module:before.v.main_module,modules:[module],bindings:before.v.bindings.map(b=>({name:b.name,type:'inherit',version_id:ACTIVE})),annotations:{'workers/tag':TAG,'workers/message':'R4 inactive stage; exact CI candidate '+CANDIDATE}}
  for(const k of runtime)if(before.v[k]!=null)body[k]=before.v[k]
  console.log('PASS: artefacto validado; iniciando único upload inactivo.')
  save('upload-attempt.json',{candidate:CANDIDATE,baseline:ACTIVE,tag:TAG,payloadSha256:sha(JSON.stringify(sort(body)))})
  const result=await request(token,'POST','/workers/workers/'+WORKER+'/versions?deploy=false',body)
  const id=result?.id
  check(/^[a-f0-9-]{36}$/i.test(id||'')&&id!==ACTIVE,'respuesta ambigua; NO repetir')
  save('upload-result.json',{id})
  const v=await request(token,'GET','/workers/workers/'+WORKER+'/versions/'+id+'?include=modules')
  check(v.id===id&&v.annotations?.['workers/tag']===TAG&&v.main_module===before.v.main_module&&v.modules?.length===1&&v.modules[0].name===module.name&&v.modules[0].content_type===module.content_type&&sha(Buffer.from(v.modules[0].content_base64,'base64'))===sha(Buffer.from(module.content_base64,'base64')),'bytes o metadatos Stage distintos')
  check(v.bindings?.length===39&&equal([...v.bindings].sort((a,b)=>a.name.localeCompare(b.name)),[...before.v.bindings].sort((a,b)=>a.name.localeCompare(b.name))),'bindings Stage distintos')
  for(const k of runtime)check(equal(k==='compatibility_flags'?(v[k]||[]):v[k],k==='compatibility_flags'?(before.v[k]||[]):before.v[k]),'runtime distinto: '+k)
  const after=await live(token)
  check(equal(before,after),'superficies protegidas cambiaron; no activar')
  const receipt={result:'R4_STAGE_API_PASS',candidate:CANDIDATE,version:id,baseline:ACTIVE,moduleSha256:sha(Buffer.from(module.content_base64,'base64')),bindings:39,trafficUnchanged:true,productionUnchanged:true,previewPagesUnchanged:true}
  save('stage-pass.json',receipt)
  console.log(JSON.stringify({...receipt,evidence:DIR},null,2))
}
main().catch(e=>{
 const msg=String(e?.message||'error desconocido')
 try{mkdirSync(DIR,{recursive:true,mode:0o700});writeFileSync(join(DIR,'error-'+Date.now()+'.private.txt'),String(e?.stack||msg),{mode:0o600,flag:'wx'})}catch{}
 console.error(msg.startsWith('BLOCKED:')?msg:'BLOCKED: '+(e?.code||e?.name||'Error')+'; consultar diagnóstico privado')
 console.error(JSON.stringify({evidence:DIR,syscall:e?.syscall||undefined,command:typeof e?.path==='string'?basename(e.path):undefined,uploadAttempt:existsSync(join(DIR,'upload-attempt.json')),uploadResult:existsSync(join(DIR,'upload-result.json')),pass:existsSync(join(DIR,'stage-pass.json'))},null,2))
 process.exitCode=1
})
