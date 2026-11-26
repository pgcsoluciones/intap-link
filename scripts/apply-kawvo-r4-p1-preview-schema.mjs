// S1: additive quota schema only. No deploy, Google calls or production mutations.
import {execFileSync} from 'node:child_process'
import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {homedir,tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
process.umask(0o077)
const CANDIDATE='e55027c52ec0d18d7ca9c76d85e99da7757c4335'
const ACTIVE='22ea2ded-13bf-4f6d-95aa-70feb28e5ffe'
const ACTIVE_SHA='70e7e22b923751318bd9e718e97bd51c00b168c92338b94f237956a7d734652f'
const ACCOUNT='adf4d5ebb625fed2c32e38cef57a6319'
const DB='e9f46214-623f-48da-af13-74198e12b222'
const WORKER='intap-api-preview'
const PROD='766e8d93-260c-4fb7-841c-a833515bf9d6'
const BASE='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT
const ROOT=process.cwd(),DIR=join(homedir(),'intap-release-logs','r4-p1-schema-'+CANDIDATE.slice(0,12))
const CONFIG='api/wrangler.preview.toml'
const SQL_PATH='docs/releases/kawvo-r4-proposed-migrations/sponsored-reviews.sql'
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
 parent:"SELECT name,type,pk FROM pragma_table_info('sponsored_profiles') ORDER BY cid",
 objects:"SELECT name,type,tbl_name FROM sqlite_master WHERE name IN ('sponsored_review_settings','sponsored_review_events','idx_sponsored_review_events_period') ORDER BY name",
 settings:"SELECT name,type,pk FROM pragma_table_info('sponsored_review_settings') ORDER BY cid",
 events:"SELECT name,type,pk FROM pragma_table_info('sponsored_review_events') ORDER BY cid",
 settingsFk:"SELECT \"table\",\"from\",\"to\",on_delete FROM pragma_foreign_key_list('sponsored_review_settings')",
 eventsFk:"SELECT \"table\",\"from\",\"to\",on_delete FROM pragma_foreign_key_list('sponsored_review_events')",
 indices:"SELECT name,\"unique\",origin FROM pragma_index_list('sponsored_review_events') ORDER BY name",
 counts:"SELECT (SELECT COUNT(*) FROM sponsored_review_settings) AS settings,(SELECT COUNT(*) FROM sponsored_review_events) AS events",
 violations:"SELECT * FROM pragma_foreign_key_check('sponsored_review_settings') UNION ALL SELECT * FROM pragma_foreign_key_check('sponsored_review_events')"
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
 check(b('APP_PAGES_ORIGIN')?.text==='https://1be92438.intap-web2.pages.dev'&&b('WEB_PAGES_ORIGIN')?.text==='https://baf8fa51.intap-link.pages.dev','orígenes Preview distintos')
 for(const [project,id] of [['intap-web2','166657db-e27e-4a5b-9396-1232aa4d0fd0'],['intap-link','f4c4990d-98ed-42a3-a989-cd082a7168f4']]){
  const p=await req(token,'GET','/pages/projects/'+project)
  check(p.canonical_deployment?.id===id&&p.source?.config?.production_deployments_enabled===false,'Producción Pages cambió: '+project)
 }
}
async function inspect(token){
 const catalog=await query(token,'catalog'),review=await query(token,'review'),quota=await query(token,'quota'),parent=await query(token,'parent'),objects=await query(token,'objects')
 check(catalog.length===1&&catalog[0].is_active===1&&eq(JSON.parse(catalog[0].effects_json).includedPlans,['free','basic']),'catálogo R4 distinto')
 check(eq(review.map(x=>x.name),['profile_id','enabled','google_review_url','updated_at'])&&review[0].pk===1,'schema Link distinto')
 check(eq(quota.map(x=>x.name),['id','user_id','profile_id','ip_hash','created_at']),'cuota R4 distinta')
 check(parent.some(x=>x.name==='id'&&x.pk===1)&&['user_id','sponsor_id','profile_role','status','username'].every(n=>parent.some(x=>x.name===n)),'identidad patrocinada no acreditada')
 return {catalog,review,quota,parent,objects}
}
async function verifySchema(token){
 const x=await inspect(token),settings=await query(token,'settings'),events=await query(token,'events'),settingsFk=await query(token,'settingsFk'),eventsFk=await query(token,'eventsFk'),indices=await query(token,'indices'),counts=await query(token,'counts'),violations=await query(token,'violations')
 check(eq(settings.map(r=>r.name),['sponsored_profile_id','enabled','google_review_url','updated_at'])&&settings[0].pk===1,'config P1 distinta')
 check(eq(events.map(r=>r.name),['id','sponsored_profile_id','event_type','target_id','created_at'])&&events[0].pk===1,'eventos P1 distintos')
 const expectedFk=[{table:'sponsored_profiles',from:'sponsored_profile_id',to:'id',on_delete:'CASCADE'}]
 check(eq(settingsFk,expectedFk)&&eq(eventsFk,expectedFk),'FK P1 distinta')
 check(x.objects.length===3&&indices.some(i=>i.name==='idx_sponsored_review_events_period')&&indices.some(i=>i.origin==='u'&&i.unique===1)&&violations.length===0&&counts[0]?.settings===0&&counts[0]?.events===0,'índices, integridad o filas P1 inesperados')
 return {...x,settings,events,settingsFk,eventsFk,indices,counts}
}
async function main(){
 const apply=process.argv.length===3&&process.argv[2]==='AUTORIZO R4 P1 D1 PREVIEW'
 check(apply||process.argv.length===2,'argumento inválido')
 check(git('rev-parse',CANDIDATE+'^{commit}')===CANDIDATE&&git('ls-remote',REMOTE,'refs/heads/feature/kawvo-r4-p1-sponsored-reviews-2026-11-25').split(/\s+/)[0]===CANDIDATE,'candidato S1 distinto')
 check(git('ls-remote',REMOTE,'refs/heads/main').split(/\s+/)[0]==='e28b934a61c669ed270a656ae42cf68c1b518a82','main cambió')
 check(git('status','--porcelain')==='','checkout local sucio')
 check(git('show',CANDIDATE+':'+CONFIG)===readFileSync(CONFIG,'utf8').trim(),'config local no coincide')
 for(const line of ['name = "intap-api-preview"','database_name = "intap_db_preview"','database_id = "'+DB+'"'])check(readFileSync(CONFIG,'utf8').split(/\r?\n/).includes(line),'config no aislada')
 const ciRes=await fetch('https://api.github.com/repos/pgcsoluciones/intap-link/actions/runs/45749207769',{headers:{Accept:'application/vnd.github+json','User-Agent':'Kawvo-R4-S1-Quota'},redirect:'error',signal:AbortSignal.timeout(30000)})
 check(ciRes.ok,'CI no accesible')
 const ci=await ciRes.json()
 check(ci.id===45749207769&&ci.head_sha===CANDIDATE&&ci.status==='completed'&&ci.conclusion==='success','CI S1 no certificada')
 const previous=read(join(homedir(),'intap-release-logs','r4-preview-promotion-311b5fe6cc10','preview-pass.json'))
 check(previous.result==='R4_PREVIEW_ACTIVE_PASS'&&previous.version===ACTIVE&&previous.moduleSha256===ACTIVE_SHA&&previous.productionUnchanged===true,'recibo QA4 no acreditado')
 let token=auth()
 await live(token)
 const before=await inspect(token)
 if(!apply){
  console.log(JSON.stringify({result:'R4_P1_SCHEMA_PREFLIGHT_PASS',candidate:CANDIDATE,database:DB,quotaObjects:before.objects,applyAttempt:existsSync(join(DIR,'apply-attempt.json')),noWrites:true},null,2))
  return
 }
 if(existsSync(join(DIR,'schema-pass.json'))){
  const receipt=read(join(DIR,'schema-pass.json'))
  check(receipt.result==='R4_P1_SCHEMA_PREVIEW_PASS'&&receipt.candidate===CANDIDATE&&receipt.database===DB,'recibo de cuota distinto')
  await verifySchema(token)
  console.log(JSON.stringify({...receipt,resumed:true,evidence:DIR},null,2));return
 }
 check(!existsSync(DIR)&&before.objects.length===0,'esquema o intento previo existente; reconciliar, nunca repetir')
 mkdirSync(DIR,{recursive:true,mode:0o700})
 const sql=git('show',CANDIDATE+':'+SQL_PATH)+'\n'
 const expected="-- Proposed additive schema. Apply only to exact D1 after backup and authorization.\nCREATE TABLE sponsored_review_settings (\n sponsored_profile_id TEXT PRIMARY KEY REFERENCES sponsored_profiles(id) ON DELETE CASCADE,\n enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),\n google_review_url TEXT NOT NULL DEFAULT '',\n updated_at TEXT NOT NULL DEFAULT (datetime('now'))\n);\nCREATE TABLE sponsored_review_events (\n id TEXT PRIMARY KEY,\n sponsored_profile_id TEXT NOT NULL REFERENCES sponsored_profiles(id) ON DELETE CASCADE,\n event_type TEXT NOT NULL CHECK(event_type IN ('review_view','review_qr','review_click')),\n target_id TEXT NOT NULL,\n created_at TEXT NOT NULL DEFAULT (datetime('now')),\n UNIQUE(sponsored_profile_id,event_type,target_id)\n);\nCREATE INDEX idx_sponsored_review_events_period ON sponsored_review_events(sponsored_profile_id,created_at,event_type);\n"
 check(sql===expected,'SQL P1 fuera de alcance')
 const file=join(DIR,'sponsored-reviews.sql'),backup=join(DIR,'intap_db_preview.before.sql')
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
 token=auth();await live(token);check(eq(await inspect(token),before),'esquema cambió después del respaldo')
 save('apply-attempt.json',{candidate:CANDIDATE,database:DB,sqlSha256:sha(sql),backupSha256:backupSha})
 run(['d1','execute','intap_db_preview','--remote','--config',CONFIG,'--json','--file',file,'--yes'],'apply.private.json')
 token=auth();const after=await verifySchema(token)
 check(eq(after.catalog,before.catalog)&&eq(after.review,before.review)&&eq(after.quota,before.quota)&&eq(after.parent,before.parent),'esquema preexistente cambió')
 await live(token)
 const receipt={result:'R4_P1_SCHEMA_PREVIEW_PASS',candidate:CANDIDATE,database:DB,worker:ACTIVE,tables:['sponsored_review_settings','sponsored_review_events'],rows:after.counts[0],sqlSha256:sha(sql),backupSha256:backupSha,productionUnchanged:true,workerUnchanged:true,googleCalls:0}
 save('schema-pass.json',receipt)
 console.log(JSON.stringify({...receipt,evidence:DIR},null,2))
}
main().catch(e=>{const msg=String(e.message||'error');console.error(msg.startsWith('BLOCKED:')?msg:'BLOCKED: '+(e.code||e.name||'Error'));console.error(JSON.stringify({evidence:DIR,applyAttempt:existsSync(join(DIR,'apply-attempt.json')),pass:existsSync(join(DIR,'schema-pass.json'))}));process.exitCode=1})
