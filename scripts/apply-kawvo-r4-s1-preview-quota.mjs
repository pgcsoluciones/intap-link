// S1: additive quota schema only. No deploy, Google calls or production mutations.
import {execFileSync} from 'node:child_process'
import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {homedir,tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
process.umask(0o077)
const CANDIDATE='f89cbda0ea2568405eeaddc796b382911b846bbc'
const ACTIVE='7500a966-c0ca-4f3c-a417-38d1d2ba98ca'
const ACTIVE_SHA='9da139f93316404e44286d1fff0f624204edc228ff682342311afa0107412101'
const ACCOUNT='adf4d5ebb625fed2c32e38cef57a6319'
const DB='e9f46214-623f-48da-af13-74198e12b222'
const WORKER='intap-api-preview'
const PROD='766e8d93-260c-4fb7-841c-a833515bf9d6'
const BASE='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT
const ROOT=process.cwd(),DIR=join(homedir(),'intap-release-logs','r4-s1-quota-'+CANDIDATE.slice(0,12))
const CONFIG='api/wrangler.preview.toml'
const SQL_PATH='docs/releases/kawvo-r4-proposed-migrations/google-search-usage.sql'
const REMOTE='https://github.com/pgcsoluciones/intap-link.git'
const check=(ok,msg)=>{if(!ok)throw Error('BLOCKED: '+msg)}
const sha=x=>createHash('sha256').update(x).digest('hex')
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const git=(...a)=>execFileSync('git',a,{cwd:ROOT,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
const read=p=>JSON.parse(readFileSync(p,'utf8'))
const save=(name,value)=>writeFileSync(join(DIR,name),JSON.stringify(value,null,2),{mode:0o600,flag:'wx'})
function auth(){
  if(process.env.CLOUDFLARE_API_TOKEN)return 'Bearer '+process.env.CLOUDFLARE_API_TOKEN
  execFileSync('npx',['--yes','--package=wrangler@4.166.0','--','wrangler','whoami'],{cwd:tmpdir(),stdio:'pipe',env:{...process.env,WRANGLER_SEND_METRICS:'false'}})
  const paths=['Library/Preferences/.wrangler/config/default.toml','.wrangler/config/default.toml','.config/.wrangler/config/default.toml'].map(p=>join(homedir(),p)).filter(existsSync)
  check(paths.length===1,'sesión Wrangler ausente o ambigua')
  const token=readFileSync(paths[0],'utf8').match(/^oauth_token\s*=\s*"([^"\r\n]+)"/m)?.[1]
  check(token,'sesión sin token legible después de whoami')
  return 'Bearer '+token
}

const queries={
 catalog:"SELECT code,is_active,effects_json FROM modules WHERE code='reviews_google'",
 review:"SELECT name,type,pk FROM pragma_table_info('profile_review_settings') ORDER BY cid",
 objects:"SELECT name,type,tbl_name FROM sqlite_master WHERE name='review_google_search_usage' OR name GLOB 'idx_review_google_search_*' ORDER BY name",
 columns:"SELECT name,type,pk FROM pragma_table_info('review_google_search_usage') ORDER BY cid",
 indices:"SELECT name FROM pragma_index_list('review_google_search_usage') WHERE origin='c' ORDER BY name",
 count:"SELECT COUNT(*) AS n FROM review_google_search_usage"
}
const indexNames=['idx_review_google_search_created','idx_review_google_search_ip','idx_review_google_search_profile','idx_review_google_search_user']
async function req(token,method,url,body){
 const paths=['/workers/scripts/'+WORKER+'/deployments','/workers/scripts/intap-api/deployments','/workers/workers/'+WORKER+'/versions/'+ACTIVE+'?include=modules','/pages/projects/intap-web2','/pages/projects/intap-link']
 check((method==='GET'&&!body&&paths.includes(url))||(method==='POST'&&url==='/d1/database/'+DB+'/query'&&Object.values(queries).includes(body?.sql)),'operación no autorizada')
 const r=await fetch(BASE+url,{method,headers:{Authorization:token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(30000)})
 const j=await r.json().catch(()=>null)
 check(r.ok&&j?.success===true,'HTTP '+r.status+' códigos '+(j?.errors||[]).map(x=>x.code).join(','))
 return j.result
}
async function query(token,name){
 const r=await req(token,'POST','/d1/database/'+DB+'/query',{sql:queries[name]})
 const x=r?.[0]
 check(r.length===1&&x.success===true&&x.meta?.changed_db===false&&Number(x.meta.rows_written||0)===0&&Number(x.meta.changes||0)===0,'consulta no acreditada como lectura: '+name)
 return x.results
}
async function live(token){
 for(const [worker,id] of [[WORKER,ACTIVE],['intap-api',PROD]]){
  const r=await req(token,'GET','/workers/scripts/'+worker+'/deployments'),v=r.deployments?.[0]?.versions
  check(v?.length===1&&v[0].version_id===id&&Number(v[0].percentage)===100,'versión activa cambió: '+worker)
 }
 const v=await req(token,'GET','/workers/workers/'+WORKER+'/versions/'+ACTIVE+'?include=modules')
 const b=n=>v.bindings?.find(x=>x.name===n)
 check(v.id===ACTIVE&&v.bindings?.length===35&&v.modules?.length===1&&sha(Buffer.from(v.modules[0].content_base64,'base64'))===ACTIVE_SHA,'Worker QA2 distinto')
 check(b('DB')?.type==='d1'&&(b('DB')?.id||b('DB')?.database_id)===DB&&b('ENVIRONMENT')?.text==='preview','D1 Preview no acreditada')
 check(b('APP_PAGES_ORIGIN')?.text==='https://fef2263a.intap-web2.pages.dev'&&b('WEB_PAGES_ORIGIN')?.text==='https://81096db5.intap-link.pages.dev','orígenes Preview distintos')
 for(const [project,id] of [['intap-web2','166657db-e27e-4a5b-9396-1232aa4d0fd0'],['intap-link','f4c4990d-98ed-42a3-a989-cd082a7168f4']]){
  const p=await req(token,'GET','/pages/projects/'+project)
  check(p.canonical_deployment?.id===id&&p.source?.config?.production_deployments_enabled===false,'Producción Pages cambió: '+project)
 }
}
async function inspect(token){
 const catalog=await query(token,'catalog'),review=await query(token,'review'),objects=await query(token,'objects')
 check(catalog.length===1&&catalog[0].is_active===1&&eq(JSON.parse(catalog[0].effects_json).includedPlans,['free','basic']),'catálogo R4 distinto')
 check(eq(review.map(x=>x.name),['profile_id','enabled','google_review_url','updated_at'])&&review[0].pk===1,'schema R4 distinto')
 return {catalog,review,objects}
}
async function verifySchema(token){
 const x=await inspect(token),columns=await query(token,'columns'),indices=await query(token,'indices'),count=await query(token,'count')
 check(eq(columns.map(x=>[x.name,x.type,x.pk]),[['id','TEXT',1],['user_id','TEXT',0],['profile_id','TEXT',0],['ip_hash','TEXT',0],['created_at','INTEGER',0]]),'schema de cuotas distinto')
 check(eq(indices.map(x=>x.name),indexNames)&&x.objects.length===5&&count[0]?.n===0,'índices o registros de cuota inesperados')
 return {catalog:x.catalog,review:x.review,columns,indices,count:count[0].n}
}
async function main(){
 const apply=process.argv.length===3&&process.argv[2]==='AUTORIZO R4 S1 D1 PREVIEW'
 check(apply||process.argv.length===2,'argumento inválido')
 check(git('rev-parse',CANDIDATE+'^{commit}')===CANDIDATE&&git('ls-remote',REMOTE,'refs/heads/feature/kawvo-r4-google-place-search-2026-11-25').split(/\s+/)[0]===CANDIDATE,'candidato S1 distinto')
 check(git('ls-remote',REMOTE,'refs/heads/main').split(/\s+/)[0]==='e28b934a61c669ed270a656ae42cf68c1b518a82','main cambió')
 check(git('status','--porcelain')==='','checkout local sucio')
 check(git('show',CANDIDATE+':'+CONFIG)===readFileSync(CONFIG,'utf8').trim(),'config local no coincide')
 for(const line of ['name = "intap-api-preview"','database_name = "intap_db_preview"','database_id = "'+DB+'"'])check(readFileSync(CONFIG,'utf8').split(/\r?\n/).includes(line),'config no aislada')
 const ciRes=await fetch('https://api.github.com/repos/pgcsoluciones/intap-link/actions/runs/45615786463',{headers:{Accept:'application/vnd.github+json','User-Agent':'Kawvo-R4-S1-Quota'},redirect:'error',signal:AbortSignal.timeout(30000)})
 check(ciRes.ok,'CI no accesible')
 const ci=await ciRes.json()
 check(ci.id===45615786463&&ci.head_sha===CANDIDATE&&ci.status==='completed'&&ci.conclusion==='success','CI S1 no certificada')
 const previous=read(join(homedir(),'intap-release-logs','r4-preview-promotion-9216cdaedf5b','preview-pass.json'))
 check(previous.result==='R4_PREVIEW_ACTIVE_PASS'&&previous.version===ACTIVE&&previous.moduleSha256===ACTIVE_SHA&&previous.productionUnchanged===true,'recibo QA2 no acreditado')
 const token=auth()
 await live(token)
 const before=await inspect(token)
 if(!apply){
  console.log(JSON.stringify({result:'R4_S1_QUOTA_PREFLIGHT_PASS',candidate:CANDIDATE,database:DB,quotaObjects:before.objects,applyAttempt:existsSync(join(DIR,'apply-attempt.json')),noWrites:true},null,2))
  return
 }
 check(!existsSync(DIR)&&before.objects.length===0,'esquema o intento previo existente; reconciliar, nunca repetir')
 mkdirSync(DIR,{recursive:true,mode:0o700})
 const sql=git('show',CANDIDATE+':'+SQL_PATH)+'\n'
 const expected="CREATE TABLE review_google_search_usage (\n id TEXT PRIMARY KEY,\n user_id TEXT NOT NULL,\n profile_id TEXT NOT NULL,\n ip_hash TEXT NOT NULL DEFAULT '',\n created_at INTEGER NOT NULL\n);\nCREATE INDEX idx_review_google_search_user ON review_google_search_usage(user_id,created_at);\nCREATE INDEX idx_review_google_search_profile ON review_google_search_usage(profile_id,created_at);\nCREATE INDEX idx_review_google_search_ip ON review_google_search_usage(ip_hash,created_at);\nCREATE INDEX idx_review_google_search_created ON review_google_search_usage(created_at);\n"
 check(sql.replace(/^--[^\n]*\n/,'')===expected,'SQL fuera de alcance')
 const file=join(DIR,'google-search-usage.sql'),backup=join(DIR,'intap_db_preview.before.sql')
 writeFileSync(file,sql,{flag:'wx',mode:0o600});save('before.json',before)
 const wrangler=join(ROOT,'node_modules','.bin','wrangler')
 check(existsSync(wrangler),'Wrangler local no disponible')
 const env={...process.env,WRANGLER_SEND_METRICS:'false'}
 const run=(args,log)=>{
  try{const out=execFileSync(wrangler,args,{cwd:ROOT,env,stdio:['ignore','pipe','pipe'],maxBuffer:32*1024*1024});writeFileSync(join(DIR,log),out,{flag:'wx',mode:0o600})}
  catch(e){writeFileSync(join(DIR,log),String(e.stdout||'')+'\n'+String(e.stderr||''),{flag:'wx',mode:0o600});throw Error('BLOCKED: operación local/Cloudflare; revisar recibo privado, no repetir')}
 }
 run(['d1','export','intap_db_preview','--remote','--config',CONFIG,'--output',backup],'backup.private.log')
 check(existsSync(backup)&&readFileSync(backup).length>0,'respaldo ausente')
 const backupSha=sha(readFileSync(backup))
 save('backup.json',{sha256:backupSha})
 await live(token);check(eq(await inspect(token),before),'esquema cambió después del respaldo')
 save('apply-attempt.json',{candidate:CANDIDATE,database:DB,sqlSha256:sha(sql),backupSha256:backupSha})
 run(['d1','execute','intap_db_preview','--remote','--config',CONFIG,'--json','--file',file,'--yes'],'apply.private.json')
 const after=await verifySchema(token)
 check(eq(after.catalog,before.catalog)&&eq(after.review,before.review),'configuración R4 cambió')
 await live(token)
 const receipt={result:'R4_S1_QUOTA_PREVIEW_PASS',candidate:CANDIDATE,database:DB,worker:ACTIVE,table:'review_google_search_usage',indices:4,rows:0,sqlSha256:sha(sql),backupSha256:backupSha,productionUnchanged:true,workerUnchanged:true,googleCalls:0}
 save('quota-pass.json',receipt)
 console.log(JSON.stringify({...receipt,evidence:DIR},null,2))
}
main().catch(e=>{const msg=String(e.message||'error');console.error(msg.startsWith('BLOCKED:')?msg:'BLOCKED: '+(e.code||e.name||'Error'));console.error(JSON.stringify({evidence:DIR,applyAttempt:existsSync(join(DIR,'apply-attempt.json')),pass:existsSync(join(DIR,'quota-pass.json'))}));process.exitCode=1})
