// R4: compile exact CI-approved candidate, upload inactive API only.
// Operational branch is separate from the product candidate. Never activates traffic.
import {execFileSync} from 'node:child_process'
import {existsSync,mkdirSync,readFileSync,writeFileSync,symlinkSync} from 'node:fs'
import {homedir,tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'

process.umask(0o077)
const CANDIDATE='75e967bb4ddf1eabee2f3dbef0f8ba972126d690'
const WORKER='intap-api-preview'
const ACTIVE='9775e192-cc7e-4a12-b2e6-67f341aa31e7'
const ACTIVE_SHA='1af792712416e349ba4ac0c91f5be94ff781fb5dc3237be9596006ad63c4ada1'
const ACTIVE_SOURCE='e886746db8a1c5386d41420baa49104e5a5105d5'
const PROD='766e8d93-260c-4fb7-841c-a833515bf9d6'
const DB='e9f46214-623f-48da-af13-74198e12b222'
const ACCOUNT='adf4d5ebb625fed2c32e38cef57a6319'
const BASE='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT
const TAG='KAWVO-R4-STAGE-'+CANDIDATE.slice(0,12)
const ROOT=process.cwd()
const DIR=join(homedir(),'intap-release-logs','r4-api-stage-'+CANDIDATE.slice(0,12))
const SCHEMA=join(homedir(),'intap-release-logs','kawvo-r4-preview-schema-6kyPtiFO')
const PROD_PAGES={'intap-web2':'166657db-e27e-4a5b-9396-1232aa4d0fd0','intap-link':'f4c4990d-98ed-42a3-a989-cd082a7168f4'}
const PREVIEW_PAGES={'intap-web2':'a637094e-970d-475d-90c7-d937c71f2469','intap-link':'baa5dcd8-6050-469f-9330-79d0de511064'}
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
    check(p.canonical_deployment?.id===PROD_PAGES[project]&&p.canonical_deployment?.environment==='production','Pages Producción cambió: '+project)
    const d=await get('/pages/projects/'+project+'/deployments/'+PREVIEW_PAGES[project])
    check(d.id===PREVIEW_PAGES[project]&&d.environment==='preview'&&d.latest_stage?.status==='success','rollback Preview no acreditado: '+project)
    check([d.url,...(d.aliases||[])].includes(binding(field)?.text),'origen Preview no coincide: '+project)
    pages[project]={production:p.canonical_deployment.id,preview:d.id,origin:binding(field).text}
  }
  return {v,proof:{preview,production,pages,moduleSha:sha(Buffer.from(v.modules[0].content_base64,'base64'))}}
}
function checkReceipt(){
  check(readFileSync(join(SCHEMA,'candidate.sha'),'utf8').trim()===CANDIDATE,'recibo de schema pertenece a otro candidato')
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
  check(!existsSync(src),'preparación incompleta: conservar evidencia; no repetir a ciegas')
  mkdirSync(src,{mode:0o700})
  execFileSync('tar',['-x','-C',src],{input:execFileSync('git',['archive',CANDIDATE,'api/src','api/tsconfig.json','api/package.json','shared'],{cwd:ROOT,maxBuffer:128*1024*1024}),stdio:['pipe','pipe','pipe']})
  for(const rel of ['node_modules','api/node_modules'])if(existsSync(join(ROOT,rel)))symlinkSync(join(ROOT,rel),join(src,rel),'dir')
  const config=join(DIR,'build-only.json'),form=join(DIR,'compiled-form.private.bin')
  save('build-only.json',{name:WORKER,main:join(src,'api/src/preview-frontdoor-entry.ts'),compatibility_date:old.compatibility_date,compatibility_flags:old.compatibility_flags||[]})
  const env={...process.env,WRANGLER_SEND_METRICS:'false',WRANGLER_LOG_PATH:join(DIR,'wrangler.private.log')}
  try{
    const output=execFileSync('npx',['--yes','--package=wrangler@4.166.0','--','wrangler','versions','upload','--dry-run','--config',config,'--outdir',join(DIR,'bundle'),'--outfile',form],{cwd:src,encoding:'utf8',stdio:['ignore','pipe','pipe'],env,maxBuffer:32*1024*1024})
    writeFileSync(join(DIR,'build.private.log'),output,{mode:0o600})
  }catch(e){writeFileSync(join(DIR,'build.private.log'),String(e.stdout||'')+String(e.stderr||''),{mode:0o600});throw Error('BLOCKED: compilación local falló; revisar build.private.log; sin upload')}
  const bytes=readFileSync(form),boundary=bytes.subarray(0,bytes.indexOf('\r\n')).toString().slice(2)
  check(boundary.length>0,'multipart de compilación inválido')
  const parts=await new Response(bytes,{headers:{'content-type':'multipart/form-data; boundary='+boundary}}).formData()
  const meta=JSON.parse(String(parts.get('metadata'))),modules=[]
  for(const [name,f] of parts)if(name!=='metadata'){check(typeof f!=='string','parte de módulo no binaria');modules.push({name,content_type:f.type,content_base64:Buffer.from(await f.arrayBuffer()).toString('base64')})}
  check(modules.length===1&&meta.main_module===old.main_module&&modules[0].name===old.main_module&&modules[0].content_type===old.modules[0].content_type,'compilación no preserva formato del Worker')
  const m=modules[0],code=Buffer.from(m.content_base64,'base64')
  for(const marker of ['profile_review_settings','reviews_google','review_click','profile_preview_sessions','kawvo_preview_session'])check(code.includes(marker),'bundle sin marcador '+marker)
  check(sha(code)!==sha(Buffer.from(old.modules[0].content_base64,'base64')),'candidato idéntico a activa')
  save('module.private.json',m);save('prepared.json',{candidate:CANDIDATE,baseline:ACTIVE,moduleSha:sha(code),compiler:'Wrangler 4.166.0 dry-run'})
  return m
}
async function main(){
  check(process.argv.length===3&&process.argv[2]==='AUTORIZO R4 STAGE API','autorización explícita Stage API requerida')
  check(git('rev-parse',CANDIDATE+'^{commit}')===CANDIDATE,'falta candidato')
  check(git('ls-remote','https://github.com/pgcsoluciones/intap-link.git','refs/heads/feature/kawvo-r4-reviews-2026-11-25').split(/\s+/)[0]===CANDIDATE,'candidato cambió')
  check(git('status','--porcelain')==='','checkout local sucio; no modificar')
  git('diff','--exit-code','HEAD',CANDIDATE,'--','package.json','package-lock.json','api/package.json')
  git('merge-base','--is-ancestor',ACTIVE_SOURCE,CANDIDATE)
  const delta=git('diff','--name-only',ACTIVE_SOURCE,CANDIDATE,'--','api','shared','package.json','package-lock.json').split('\n').sort()
  check(equal(delta,['api/src/index.ts','api/src/reviews/external-google.ts','api/src/reviews/link-adapter.ts'].sort()),'delta API excede R4')
  check(existsSync(join(ROOT,'node_modules')),'dependencias existentes requeridas')
  checkReceipt()
  mkdirSync(DIR,{recursive:true,mode:0o700})
  check(!existsSync(join(DIR,'upload-attempt.json')),'intento anterior; reconciliar, nunca repetir upload')
  const token=auth(),before=await live(token)
  if(existsSync(join(DIR,'baseline.private.json')))check(equal(read(join(DIR,'baseline.private.json')),before),'baseline cambió desde preparación')
  else save('baseline.private.json',before)
  const module=await compile(before.v)
  const current=await live(token)
  check(equal(before,current),'baseline cambió durante compilación')
  const history=await request(token,'GET','/workers/workers/'+WORKER+'/versions')
  const rows=Array.isArray(history)?history:history?.items||history?.versions
  check(Array.isArray(rows)&&!rows.some(x=>x.annotations?.['workers/tag']===TAG),'Stage previo o historia no acreditada')
  const body={main_module:before.v.main_module,modules:[module],bindings:before.v.bindings.map(b=>({name:b.name,type:'inherit',version_id:ACTIVE})),annotations:{'workers/tag':TAG,'workers/message':'R4 inactive stage; exact CI candidate '+CANDIDATE}}
  for(const k of runtime)if(before.v[k]!=null)body[k]=before.v[k]
  save('upload-attempt.json',{candidate:CANDIDATE,baseline:ACTIVE,tag:TAG,payloadSha256:sha(JSON.stringify(sort(body)))})
  const result=await request(token,'POST','/workers/workers/'+WORKER+'/versions?deploy=false',body)
  const id=result?.id
  check(/^[a-f0-9-]{36}$/i.test(id||'')&&id!==ACTIVE,'respuesta ambigua; NO repetir')
  save('upload-result.json',{id})
  const v=await request(token,'GET','/workers/workers/'+WORKER+'/versions/'+id+'?include=modules')
  check(v.id===id&&v.annotations?.['workers/tag']===TAG&&v.main_module===before.v.main_module&&v.modules?.length===1&&v.modules[0].name===module.name&&v.modules[0].content_type===module.content_type&&sha(Buffer.from(v.modules[0].content_base64,'base64'))===sha(Buffer.from(module.content_base64,'base64')),'bytes o metadatos Stage distintos')
  check(v.bindings?.length===35&&equal([...v.bindings].sort((a,b)=>a.name.localeCompare(b.name)),[...before.v.bindings].sort((a,b)=>a.name.localeCompare(b.name))),'bindings Stage distintos')
  for(const k of runtime)check(equal(k==='compatibility_flags'?(v[k]||[]):v[k],k==='compatibility_flags'?(before.v[k]||[]):before.v[k]),'runtime distinto: '+k)
  const after=await live(token)
  check(equal(before,after),'superficies protegidas cambiaron; no activar')
  const receipt={result:'R4_STAGE_API_PASS',candidate:CANDIDATE,version:id,baseline:ACTIVE,moduleSha256:sha(Buffer.from(module.content_base64,'base64')),bindings:35,trafficUnchanged:true,productionUnchanged:true,previewPagesUnchanged:true}
  save('stage-pass.json',receipt)
  console.log(JSON.stringify({...receipt,evidence:DIR},null,2))
}
main().catch(e=>{console.error(String(e?.message||'').startsWith('BLOCKED:')?e.message:'BLOCKED: error local/API; conservar evidencia privada, no repetir upload');process.exitCode=1})
