// SP-WA: additive private contact template only. No deploy, Google calls or production mutations.
import {execFileSync} from 'node:child_process'
import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {homedir,tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
process.umask(0o077)
const CANDIDATE='2bc1baf743b73d10ee88dbdecff58ae616d88e97'
const ACTIVE='b11a32e8-6f2b-47db-baf3-fb8b26f9bee1'
const ACTIVE_SHA='119079e6fd336872badab6869719dbcd2e96ec40297ae272e8ccb06979cd6d65'
const ACCOUNT='adf4d5ebb625fed2c32e38cef57a6319'
const DB='e9f46214-623f-48da-af13-74198e12b222'
const WORKER='intap-api-preview'
const PROD='766e8d93-260c-4fb7-841c-a833515bf9d6'
const BASE='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT
const ROOT=process.cwd(),DIR=join(homedir(),'intap-release-logs','sp-wa-schema-'+CANDIDATE.slice(0,12))
const CONFIG='api/wrangler.preview.toml'
const SQL_PATH='docs/releases/kawvo-sponsor-contact-proposed-migrations/contact-message.sql'
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
 quota:"SELECT name,type,pk FROM pragma_table_info('review_google_search_usage') ORDER BY cid",
 parent:"SELECT name,type,pk FROM pragma_table_info('sponsor_tenants') ORDER BY cid",
 sponsoredReview:"SELECT name,type,pk FROM pragma_table_info('sponsored_review_settings') ORDER BY cid",
 sponsoredEvents:"SELECT name,type,pk FROM pragma_table_info('sponsored_review_events') ORDER BY cid",
 reps:"SELECT name,type,pk FROM pragma_table_info('sponsor_sales_representatives') ORDER BY cid",
 assignments:"SELECT name,type,pk FROM pragma_table_info('sponsor_sales_assignments') ORDER BY cid",
 grants:"SELECT name,type,pk FROM pragma_table_info('sponsor_module_grants') ORDER BY cid",
 objects:"SELECT name,type,tbl_name FROM sqlite_master WHERE name='sponsor_commercial_contact_settings' ORDER BY name",
 settings:"SELECT name,type,pk FROM pragma_table_info('sponsor_commercial_contact_settings') ORDER BY cid",
 settingsFk:"SELECT \"table\",\"from\",\"to\",on_delete FROM pragma_foreign_key_list('sponsor_commercial_contact_settings')",
 counts:"SELECT COUNT(*) AS settings FROM sponsor_commercial_contact_settings",
 violations:"SELECT * FROM pragma_foreign_key_check('sponsor_commercial_contact_settings')"
}
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
 check(v.id===ACTIVE&&v.bindings?.length===39&&v.modules?.length===1&&sha(Buffer.from(v.modules[0].content_base64,'base64'))===ACTIVE_SHA,'Worker QA4 distinto')
 check(b('DB')?.type==='d1'&&(b('DB')?.id||b('DB')?.database_id)===DB&&b('ENVIRONMENT')?.text==='preview'&&b('BUCKET')?.bucket_name==='intap-r2-preview','D1 Preview no acreditada')
 check(b('APP_PAGES_ORIGIN')?.text==='https://9014e5a6.intap-web2.pages.dev'&&b('WEB_PAGES_ORIGIN')?.text==='https://07aa15e6.intap-link.pages.dev','orígenes Preview distintos')
 for(const [project,id] of [['intap-web2','166657db-e27e-4a5b-9396-1232aa4d0fd0'],['intap-link','f4c4990d-98ed-42a3-a989-cd082a7168f4']]){
  const p=await req(token,'GET','/pages/projects/'+project)
  check(p.canonical_deployment?.id===id&&p.source?.config?.production_deployments_enabled===false,'Producción Pages cambió: '+project)
 }
}
async function inspect(token){
 const x={}
 for(const key of ['catalog','review','quota','parent','sponsoredReview','sponsoredEvents','reps','assignments','grants','objects'])x[key]=await query(token,key)
 check(x.catalog.length===1&&x.catalog[0].is_active===1&&eq(JSON.parse(x.catalog[0].effects_json).includedPlans,['free','basic']),'catálogo R4 distinto')
 check(eq(x.review.map(r=>r.name),['profile_id','enabled','google_review_url','updated_at'])&&eq(x.quota.map(r=>r.name),['id','user_id','profile_id','ip_hash','created_at']),'schema R4 distinto')
 check(eq(x.sponsoredReview.map(r=>r.name),['sponsored_profile_id','enabled','google_review_url','updated_at'])&&eq(x.sponsoredEvents.map(r=>r.name),['id','sponsored_profile_id','event_type','target_id','created_at']),'schema P1 distinto')
 check(x.parent.some(r=>r.name==='id'&&r.pk===1)&&x.parent.some(r=>r.name==='whatsapp_message_template'),'sponsor_tenants distinto')
 for(const [key,fields] of Object.entries({reps:['id','sponsor_id','first_name','last_name','whatsapp','active'],assignments:['sponsor_id','artifact_id','representative_id','active','assigned_at'],grants:['sponsor_id','module_code','enabled']}))check(fields.every(n=>x[key].some(r=>r.name===n)),'esquema comercial distinto: '+key)
 return x
}
async function verifySchema(token){
 const x=await inspect(token),settings=await query(token,'settings'),settingsFk=await query(token,'settingsFk'),counts=await query(token,'counts'),violations=await query(token,'violations')
 check(eq(settings.map(r=>r.name),['sponsor_id','message_template','updated_at'])&&settings[0].pk===1,'schema SP-WA distinto')
 check(eq(settingsFk.map(r=>[r.table,r.from,r.to,r.on_delete]),[['sponsor_tenants','sponsor_id','id','CASCADE']]),'FK SP-WA distinta')
 check(x.objects.length===1&&x.objects[0].type==='table'&&counts[0]?.settings===0&&violations.length===0,'integridad o filas SP-WA inesperadas')
 return {...x,settings,settingsFk,counts}
}
async function main(){
 const apply=process.argv.length===3&&process.argv[2]==='AUTORIZO SP WA D1 PREVIEW'
 check(apply||process.argv.length===2,'argumento inválido')
 check(git('rev-parse',CANDIDATE+'^{commit}')===CANDIDATE&&git('ls-remote',REMOTE,'refs/heads/feature/kawvo-sponsor-private-whatsapp-2026-11-26').split(/\s+/)[0]===CANDIDATE,'candidato S1 distinto')
 check(git('ls-remote',REMOTE,'refs/heads/main').split(/\s+/)[0]==='e28b934a61c669ed270a656ae42cf68c1b518a82','main cambió')
 check(git('status','--porcelain')==='','checkout local sucio')
 check(git('show',CANDIDATE+':'+CONFIG)===readFileSync(CONFIG,'utf8').trim(),'config local no coincide')
 for(const line of ['name = "intap-api-preview"','database_name = "intap_db_preview"','database_id = "'+DB+'"'])check(readFileSync(CONFIG,'utf8').split(/\r?\n/).includes(line),'config no aislada')
 const ciRes=await fetch('https://api.github.com/repos/pgcsoluciones/intap-link/actions/runs/45819014880',{headers:{Accept:'application/vnd.github+json','User-Agent':'Kawvo-R4-S1-Quota'},redirect:'error',signal:AbortSignal.timeout(30000)})
 check(ciRes.ok,'CI no accesible')
 const ci=await ciRes.json()
 check(ci.id===45819014880&&ci.head_sha===CANDIDATE&&ci.status==='completed'&&ci.conclusion==='success','CI S1 no certificada')
 const previous=read(join(homedir(),'intap-release-logs','r4-preview-promotion-0f506ab6b6bf','preview-pass.json'))
 check(previous.result==='R4_PREVIEW_ACTIVE_PASS'&&previous.candidate==='0f506ab6b6bf67d3d1ccdadc4749e39128559a55'&&previous.version===ACTIVE&&previous.moduleSha256===ACTIVE_SHA&&previous.app==='9014e5a6-7281-48be-8ec0-378f1c088951'&&previous.web==='07aa15e6-637f-4fe5-a7da-b63b766601e3'&&previous.bindings===39&&previous.productionUnchanged===true,'recibo R4-P1-QA1 no acreditado')
 let token=auth()
 await live(token)
 const before=await inspect(token)
 if(!apply){
  console.log(JSON.stringify({result:'SP_WA_SCHEMA_PREFLIGHT_PASS',candidate:CANDIDATE,database:DB,quotaObjects:before.objects,applyAttempt:existsSync(join(DIR,'apply-attempt.json')),noWrites:true},null,2))
  return
 }
 if(existsSync(join(DIR,'schema-pass.json'))){
  const receipt=read(join(DIR,'schema-pass.json'))
  check(receipt.result==='SP_WA_SCHEMA_PREVIEW_PASS'&&receipt.candidate===CANDIDATE&&receipt.database===DB,'recibo de cuota distinto')
  await verifySchema(token)
  console.log(JSON.stringify({...receipt,resumed:true,evidence:DIR},null,2));return
 }
 check(!existsSync(DIR)&&before.objects.length===0,'esquema o intento previo existente; reconciliar, nunca repetir')
 const free=Number(execFileSync('df',['-Pk',homedir()],{encoding:'utf8'}).trim().split('\n').pop().trim().split(/\s+/)[3])
 check(Number.isFinite(free)&&free>=2*1024*1024,'espacio libre inferior a 2 GiB; liberar antes de respaldo y Stage')
 check(existsSync(join(ROOT,'node_modules','.bin','wrangler')),'Wrangler local no disponible')
 mkdirSync(DIR,{recursive:true,mode:0o700})
 const sql=git('show',CANDIDATE+':'+SQL_PATH)+'\n'
 const expected="-- Additive private commercial settings. Preview only after backup and explicit approval.\nCREATE TABLE sponsor_commercial_contact_settings (\n sponsor_id TEXT PRIMARY KEY REFERENCES sponsor_tenants(id) ON DELETE CASCADE,\n message_template TEXT NOT NULL CHECK(length(trim(message_template)) BETWEEN 1 AND 400),\n updated_at TEXT NOT NULL DEFAULT (datetime('now'))\n);\n"
 check(sql===expected,'SQL P1 fuera de alcance')
 const file=join(DIR,'contact-message.sql'),backup=join(DIR,'intap_db_preview.before.sql')
 writeFileSync(file,sql,{flag:'wx',mode:0o600});save('before.json',before)
 const wrangler=join(ROOT,'node_modules','.bin','wrangler')
 check(existsSync(wrangler),'Wrangler local no disponible')
 const env={...process.env,CLOUDFLARE_ACCOUNT_ID:ACCOUNT,WRANGLER_SEND_METRICS:'false'}
 const run=(args,log)=>{
  try{const out=execFileSync(wrangler,args,{cwd:ROOT,env,stdio:['ignore','pipe','pipe'],maxBuffer:32*1024*1024});writeFileSync(join(DIR,log),out,{flag:'wx',mode:0o600})}
  catch(e){writeFileSync(join(DIR,log),String(e.stdout||'')+'\n'+String(e.stderr||''),{flag:'wx',mode:0o600});throw Error('BLOCKED: operación local/Cloudflare; revisar recibo privado, no repetir')}
 }
 run(['d1','export','intap_db_preview','--remote','--config',CONFIG,'--output',backup],'backup.private.log')
 check(existsSync(backup)&&readFileSync(backup).length>0,'respaldo ausente')
 const backupSha=sha(readFileSync(backup))
 save('backup.json',{sha256:backupSha})
 token=auth();await live(token);check(eq(await inspect(token),before),'esquema cambió después del respaldo')
 save('apply-attempt.json',{candidate:CANDIDATE,database:DB,sqlSha256:sha(sql),backupSha256:backupSha})
 run(['d1','execute','intap_db_preview','--remote','--config',CONFIG,'--json','--file',file,'--yes'],'apply.private.json')
 token=auth();const after=await verifySchema(token)
 for(const key of Object.keys(before).filter(k=>k!=='objects'))check(eq(after[key],before[key]),'esquema preexistente cambió: '+key)
 await live(token)
 const receipt={result:'SP_WA_SCHEMA_PREVIEW_PASS',candidate:CANDIDATE,database:DB,worker:ACTIVE,tables:['sponsor_commercial_contact_settings'],rows:after.counts[0],sqlSha256:sha(sql),backupSha256:backupSha,productionUnchanged:true,workerUnchanged:true,googleCalls:0}
 save('schema-pass.json',receipt)
 console.log(JSON.stringify({...receipt,evidence:DIR},null,2))
}
main().catch(e=>{const msg=String(e.message||'error');console.error(msg.startsWith('BLOCKED:')?msg:'BLOCKED: '+(e.code||e.name||'Error'));console.error(JSON.stringify({evidence:DIR,applyAttempt:existsSync(join(DIR,'apply-attempt.json')),pass:existsSync(join(DIR,'schema-pass.json'))}));process.exitCode=1})
