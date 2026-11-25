// R4 QA2 investigation: fixed SELECTs against the exact Preview D1; no mutation.
import {execFileSync} from 'node:child_process'
import {existsSync,readFileSync} from 'node:fs'
import {homedir,tmpdir} from 'node:os'
import {join} from 'node:path'
const ACCOUNT='adf4d5ebb625fed2c32e38cef57a6319'
const DB='e9f46214-623f-48da-af13-74198e12b222'
const WORKER='intap-api-preview'
const ACTIVE='c155ecd2-5ee4-4402-97c7-9d8291a1416e'
const BASE='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT
const check=(ok,msg)=>{if(!ok)throw Error('BLOCKED: '+msg)}
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
 schema:"SELECT m.name AS table_name,p.name AS column_name,p.type FROM sqlite_master m JOIN pragma_table_info(m.name) p WHERE m.type='table' AND m.name IN ('profiles','profile_review_settings','analytics','plan_limits','profile_modules','team_workspaces','team_members','free_demo_v2_profiles') ORDER BY m.name,p.cid",
 profiles:`SELECT p.slug,p.plan_id,p.template_id,p.is_active,p.is_published,
 EXISTS(SELECT 1 FROM plan_limits pl WHERE pl.plan_id=p.plan_id) AS has_plan_limits,
 EXISTS(SELECT 1 FROM team_workspaces tw WHERE tw.master_profile_id=p.id AND tw.status='active') AS active_team_master,
 EXISTS(SELECT 1 FROM team_members tm JOIN team_workspaces tw ON tw.id=tm.team_id WHERE tm.profile_id=p.id AND tm.status='active' AND tw.status='active') AS active_team_member,
 EXISTS(SELECT 1 FROM free_demo_v2_profiles d WHERE d.profile_id=p.id AND d.status!='claimed') AS unclaimed_demo,
 EXISTS(SELECT 1 FROM profile_review_settings r WHERE r.profile_id=p.id) AS has_review_settings
 FROM profiles p JOIN users u ON u.id=p.user_id
 WHERE lower(trim(u.email))='intapcard@gmail.com' AND lower(coalesce(p.plan_id,'free')) IN ('free','basic') ORDER BY p.slug LIMIT 100`,
 analytics:`SELECT count(*) AS review_events FROM analytics WHERE event_type IN ('review_view','review_qr','review_click') AND created_at>=datetime('now','-30 days')`
}
async function req(token,method,url,body){
 check((method==='GET'&&!body&&['/workers/scripts/'+WORKER+'/deployments','/workers/workers/'+WORKER+'/versions/'+ACTIVE].includes(url))||(method==='POST'&&url==='/d1/database/'+DB+'/query'&&Object.values(queries).includes(body?.sql)),'operación no autorizada')
 const r=await fetch(BASE+url,{method,headers:{Authorization:token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(30000)})
 const j=await r.json().catch(()=>null)
 if(!r.ok||!j?.success)throw Error('HTTP '+r.status+' códigos '+(j?.errors||[]).map(x=>x.code).join(','))
 return j.result
}
async function main(){
 const token=auth()
 const d=await req(token,'GET','/workers/scripts/'+WORKER+'/deployments')
 check(d.deployments?.[0]?.versions?.length===1&&d.deployments[0].versions[0].version_id===ACTIVE&&Number(d.deployments[0].versions[0].percentage)===100,'Preview cambió desde el recibo QA1')
 const v=await req(token,'GET','/workers/workers/'+WORKER+'/versions/'+ACTIVE)
 const db=v.bindings?.find(b=>b.name==='DB')
 check(db?.type==='d1'&&(db.id||db.database_id)===DB&&v.bindings?.find(b=>b.name==='ENVIRONMENT')?.text==='preview','D1 Preview no acreditada')
 const out={result:'R4_QA2_READONLY',worker:ACTIVE,database:DB,checks:{}}
 for(const [name,sql] of Object.entries(queries)){
  try{
   const result=await req(token,'POST','/d1/database/'+DB+'/query',{sql})
   const x=result?.[0],meta=x?.meta
   check(result.length===1&&x.success===true&&meta?.changed_db===false&&Number(meta.rows_written||0)===0&&Number(meta.changes||0)===0,'respuesta D1 no acreditada como lectura')
   out.checks[name]={status:'PASS',rows:name==='schema'?x.results.filter(r=>r.table_name==='analytics'||r.table_name==='profile_review_settings'):x.results}
  }catch(e){if(String(e.message).includes('respuesta D1 no acreditada'))throw e;out.checks[name]={status:'BLOCKED',error:e.message}}
 }
 console.log(JSON.stringify(out,null,2))
}
main().catch(e=>{console.error('BLOCKED: '+String(e.message));process.exitCode=1})
