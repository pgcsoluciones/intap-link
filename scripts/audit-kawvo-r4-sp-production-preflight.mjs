// KAW-R4-SP Production preflight: no deploy, merge, build, schema or data mutations.
import {execFileSync} from 'node:child_process'
import {existsSync,readFileSync,mkdirSync,writeFileSync,mkdtempSync} from 'node:fs'
import {homedir,tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
process.umask(0o077)
const CANDIDATE='e7e38e941a15c322518ee81fe84e8bac7344b23c',MAIN='e28b934a61c669ed270a656ae42cf68c1b518a82'
const ACCOUNT='adf4d5ebb625fed2c32e38cef57a6319',DB='3a2d724d-5938-4777-a63e-423bb41862c0',PREVIEW_DB='e9f46214-623f-48da-af13-74198e12b222'
const PROD='766e8d93-260c-4fb7-841c-a833515bf9d6',PREVIEW='d1b7ae97-c9e3-4470-9430-fbfb5c35d5c3',PREVIEW_SHA='2093a9a23c390809e104e22a6f031b7b1e400004f86445d59a997225df9291c3'
const cf='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT,remote='https://github.com/pgcsoluciones/intap-link.git'
const report={operation:'READ_ONLY',candidate:CANDIDATE,expectedMain:MAIN,workers:[],pages:[],schema:{},checks:[],blockers:[]}
const check=(condition,msg)=>{if(!condition)throw Error('BLOCKED: '+msg)}
const hash=b=>createHash('sha256').update(b).digest('hex')
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
const queryNames=['profiles','users','modules','analytics','profile_contact','team_members','team_workspaces','free_demo_v2_profiles','sponsored_profiles','sponsor_tenants','sponsor_sales_representatives','sponsor_sales_assignments','sponsor_module_grants','sponsor_commercial_resources','profile_review_settings','review_google_search_usage','sponsored_review_settings','sponsored_review_events','sponsor_commercial_contact_settings']
const queries=Object.fromEntries(queryNames.map(n=>[n,"SELECT name,type,pk FROM pragma_table_info('"+n+"') ORDER BY cid"]))
Object.assign(queries,{catalog:"SELECT code,is_active,effects_json FROM modules WHERE code='reviews_google'",plans:"SELECT id FROM plans WHERE id IN ('free','basic') ORDER BY id",published:"SELECT COUNT(*) AS n FROM profiles WHERE is_active=1 AND is_published=1",sponsoredPublished:"SELECT COUNT(*) AS n FROM sponsored_profiles WHERE status='published'",objects:"SELECT name,type,tbl_name FROM sqlite_master WHERE name IN ('profile_review_settings','review_google_search_usage','sponsored_review_settings','sponsored_review_events','sponsor_commercial_contact_settings','idx_review_google_search_user','idx_review_google_search_profile','idx_review_google_search_ip','idx_review_google_search_created','idx_sponsored_review_events_period') ORDER BY name"})
let token
function auth(){
 execFileSync('npx',['--yes','--package=wrangler@4.166.0','--','wrangler','whoami'],{cwd:tmpdir(),stdio:'pipe',env:{...process.env,WRANGLER_SEND_METRICS:'false'}})
 const files=['Library/Preferences/.wrangler/config/default.toml','.wrangler/config/default.toml','.config/.wrangler/config/default.toml'].map(p=>join(homedir(),p)).filter(existsSync)
 check(files.length===1,'sesión Wrangler ausente o ambigua')
 const t=readFileSync(files[0],'utf8').match(/^oauth_token\s*=\s*"([^"\r\n]+)"/m)?.[1]
 check(t,'sesión Wrangler no legible')
 return 'Bearer '+t
}
const getPaths=new Set(['/workers/scripts/intap-api/deployments','/workers/scripts/intap-api-preview/deployments','/workers/workers/intap-api/versions/'+PROD+'?include=modules','/workers/workers/intap-api-preview/versions/'+PREVIEW+'?include=modules','/pages/projects/intap-web2','/pages/projects/intap-link','/d1/database/'+DB])
async function req(path,sql){
 check(sql?path==='/d1/database/'+DB+'/query'&&Object.values(queries).includes(sql)&&sql.startsWith('SELECT '):getPaths.has(path),'operación no autorizada')
 const fetchOnce=()=>fetch(cf+path,{method:sql?'POST':'GET',headers:{Authorization:token,...(sql?{'Content-Type':'application/json'}:{})},body:sql?JSON.stringify({sql}):undefined,redirect:'error',signal:AbortSignal.timeout(30000)})
 let r=await fetchOnce()
 if(r.status===401){await r.arrayBuffer();token=auth();r=await fetchOnce()}
 const j=await r.json().catch(()=>null)
 check(r.ok&&j?.success===true,'Cloudflare '+path+' HTTP '+r.status)
 return j.result
}
async function query(name){
 const r=await req('/d1/database/'+DB+'/query',queries[name]),v=r?.[0]
 check(r?.length===1&&v.success===true&&v.meta?.changed_db===false&&Number(v.meta.rows_written||0)===0&&Number(v.meta.changes||0)===0,'SELECT no acreditado: '+name)
 return v.results
}
async function worker(name,expected,db,bucket,env){
 const dep=await req('/workers/scripts/'+name+'/deployments'),row=dep.deployments?.[0],vs=row?.versions
 check(vs?.length===1&&vs[0].version_id===expected&&Number(vs[0].percentage)===100,'versión '+name+' cambió: '+(vs||[]).map(x=>x.version_id+':'+x.percentage).join(','))
 const v=await req('/workers/workers/'+name+'/versions/'+expected+'?include=modules'),b=n=>v.bindings?.find(x=>x.name===n)
 check(v.id===expected&&b('ENVIRONMENT')?.text===env&&b('DB')?.type==='d1'&&(b('DB')?.id||b('DB')?.database_id)===db&&b('BUCKET')?.bucket_name===bucket,'aislamiento '+name+' no acreditado')
 check(v.bindings?.length>0&&new Set(v.bindings.map(x=>x.name)).size===v.bindings.length,'bindings duplicados o ausentes')
 const modules=v.modules?.map(x=>({name:x.name,type:x.content_type,sha256:hash(Buffer.from(x.content_base64,'base64'))}))
 check(modules?.length>0&&modules.some(x=>x.name===v.main_module),'módulos no verificables '+name)
 if(name==='intap-api-preview')check(modules.length===1&&modules[0].sha256===PREVIEW_SHA&&v.bindings.length===39,'Preview distinto')
 return {name,version:expected,traffic:100,mainModule:v.main_module,modules,compatibilityDate:v.compatibility_date,compatibilityFlags:v.compatibility_flags||[],bindingCount:v.bindings.length,bindings:v.bindings.map(x=>({name:x.name,type:x.type})).sort((a,b)=>a.name.localeCompare(b.name)),google:{placesSecret:b('GOOGLE_PLACES_API_KEY')?.type==='secret_text',embedSecret:b('GOOGLE_MAPS_EMBED_KEY')?.type==='secret_text',enabled:b('GOOGLE_REVIEWS_SEARCH_ENABLED')?.text==='1'},environment:env,database:db,bucket}
}
async function bytes(url){const r=await fetch(url,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(30000)});check(r.ok,'HTTP '+r.status+' '+url);return Buffer.from(await r.arrayBuffer())}
const entry=b=>b.toString().match(/\/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0]
async function pages(project,expected,domain,route){
 const p=await req('/pages/projects/'+project),d=p.canonical_deployment,m=d?.deployment_trigger?.metadata||{}
 check(d?.id===expected&&d.environment==='production'&&d.latest_stage?.status==='success'&&p.production_branch==='main','Pages '+project+' baseline cambió: '+String(d?.id||'ausente'))
 check(p.source?.config?.production_deployments_enabled===false,'autodeploy producción no acreditado '+project)
 check(d.url==='https://'+d.id.slice(0,8)+'.'+project+'.pages.dev','origen Pages no reconocido')
 const a=entry(await bytes(domain+route)),b=entry(await bytes(d.url+route))
 check(a&&a===b,'bundle oficial distinto '+project)
 const x=hash(await bytes(domain+a)),y=hash(await bytes(d.url+b))
 check(x===y,'bytes oficiales distintos '+project)
 return {project,id:d.id,origin:d.url,commit:m.commit_hash||null,branch:m.branch||null,dirty:m.commit_dirty??null,autoDeploy:false,entry:a,sha256:x,domain}
}
async function main(){
 check(process.argv.length===2,'runner exclusivamente de lectura')
 check(git('status','--porcelain')==='','checkout sucio')
 check(git('rev-parse',CANDIDATE+'^{commit}')===CANDIDATE,'candidato ausente')
 check(git('ls-remote',remote,'refs/heads/main').split(/\s+/)[0]===MAIN,'main cambió')
 check(git('ls-remote',remote,'refs/heads/feature/kawvo-sponsor-identity-entry-2026-11-26').split(/\s+/)[0]===CANDIDATE,'candidato cambió')
 const ciRes=await fetch('https://api.github.com/repos/pgcsoluciones/intap-link/actions/runs/45835129958',{headers:{'User-Agent':'Kawvo-production-preflight',Accept:'application/vnd.github+json'},redirect:'error',signal:AbortSignal.timeout(30000)})
 check(ciRes.ok,'CI inaccesible')
 const ci=await ciRes.json();check(ci.head_sha===CANDIDATE&&ci.status==='completed'&&ci.conclusion==='success','CI no acreditada')
 const prev=JSON.parse(readFileSync(join(homedir(),'intap-release-logs','r4-preview-promotion-e7e38e941a15','preview-pass.json'),'utf8'))
 check(prev.result==='R4_PREVIEW_ACTIVE_PASS'&&prev.candidate===CANDIDATE&&prev.version===PREVIEW&&prev.moduleSha256===PREVIEW_SHA&&prev.productionUnchanged===true,'recibo Preview no coincide')
 report.freeKiB=Number(execFileSync('df',['-Pk',homedir()],{encoding:'utf8'}).trim().split('\n').pop().trim().split(/\s+/)[3])
 token=auth()
 report.workers.push(await worker('intap-api',PROD,DB,'intap-r2','production'))
 report.workers.push(await worker('intap-api-preview',PREVIEW,PREVIEW_DB,'intap-r2-preview','preview'))
 report.pages.push(await pages('intap-web2','166657db-e27e-4a5b-9396-1232aa4d0fd0','https://app.intaprd.com','/admin/login'))
 report.pages.push(await pages('intap-link','f4c4990d-98ed-42a3-a989-cd082a7168f4','https://intaprd.com','/'))
 const db=await req('/d1/database/'+DB);check(db.uuid===DB&&db.name==='intap_db','D1 productiva no acreditada')
 for(const name of Object.keys(queries))report.schema[name]=await query(name)
 const required={profiles:['id','slug','name','user_id','plan_id','is_active','is_published','template_id'],users:['id','email'],modules:['code','name','effects_json','is_active'],analytics:['id','profile_id','event_type','target_id','created_at'],profile_contact:['profile_id','address'],team_members:['profile_id','team_id','status'],team_workspaces:['id','master_profile_id','owner_user_id','status'],free_demo_v2_profiles:['profile_id','status'],sponsored_profiles:['id','user_id','username','business_name','address','status','profile_role','sponsor_id'],sponsor_tenants:['id','name','whatsapp_message_template'],sponsor_sales_representatives:['id','sponsor_id','first_name','last_name','whatsapp','active'],sponsor_sales_assignments:['sponsor_id','artifact_id','representative_id','active','assigned_at'],sponsor_module_grants:['sponsor_id','module_code','enabled'],sponsor_commercial_resources:['sponsor_id','resource_url','resource_label']}
 for(const [name,cols] of Object.entries(required))check(cols.every(c=>report.schema[name].some(x=>x.name===c)),'schema existente incompatible: '+name)
 check(report.schema.plans.map(x=>x.id).join(',')==='basic,free','planes Free/Plus no acreditados')
 report.migrationState=report.schema.objects.length===0&&report.schema.catalog.length===0?'ABSENT_EXPECTED': 'EXISTING_RECONCILE'
 if(report.migrationState!=='ABSENT_EXPECTED')report.blockers.push('Objetos R4/SP-WA ya existen: reconciliar esquema antes de aplicar')
 for(const p of report.pages)if(p.commit!==MAIN||p.dirty===true||p.branch!=='main')report.blockers.push('Proveniencia Pages requiere reconciliación '+p.project)
 const inventory=JSON.parse(git('show',CANDIDATE+':contracts/protected-profiles.production.json'))
 const globals={}
 for(const f of ['robots.txt','sitemap.xml','llms.txt']){const b=await bytes('https://intaprd.com/'+f);globals[f]={sha256:hash(b),bytes:b.length}}
 report.discovery=globals
 report.historicalProfiles=[]
 for(const item of inventory.profiles){
  const slug=item.slug;check(/^[a-zA-Z0-9_-]+$/.test(slug),'slug histórico inválido')
  const html=await bytes('https://intaprd.com/'+encodeURIComponent(slug))
  report.historicalProfiles.push({slug,htmlSha256:hash(html)})
 }
 for(const item of inventory.legacy_redirects){
  const u=new URL(item.source);check(u.origin==='https://link.avanxy.com','alias histórico no reconocido')
  const r=await fetch(u,{redirect:'manual',signal:AbortSignal.timeout(30000)})
  const expected='https://intaprd.com'+u.pathname+u.search
  report.checks.push({alias:u.pathname+u.search,status:r.status,correct:r.status===301&&r.headers.get('location')===expected})
  if(r.status!==301||r.headers.get('location')!==expected)report.blockers.push('Alias histórico distinto '+u.pathname)
 }
 report.result=report.blockers.length?'PROD_PREFLIGHT_REVIEW_REQUIRED':'PROD_PREFLIGHT_READONLY_PASS'
}
try{await main()}catch(e){report.result='PROD_PREFLIGHT_BLOCKED';const m=String(e?.message||'error');report.blockers.push(m.startsWith('BLOCKED:')?m:'Error de lectura: '+(e?.code||e?.name||'Error'))}
const root=join(homedir(),'intap-release-logs');mkdirSync(root,{recursive:true,mode:0o700})
const dir=mkdtempSync(join(root,'r4-sp-production-preflight-'));writeFileSync(join(dir,'report.json'),JSON.stringify(report,null,2),{mode:0o600})
console.log(JSON.stringify({result:report.result,candidate:CANDIDATE,freeKiB:report.freeKiB,workers:report.workers,pages:report.pages,migrationState:report.migrationState,objects:report.schema.objects,catalogPresent:Boolean(report.schema.catalog?.length),published:report.schema.published?.[0]?.n,sponsoredPublished:report.schema.sponsoredPublished?.[0]?.n,historicalProfilesChecked:report.historicalProfiles?.length,checks:report.checks,blockers:report.blockers,evidence:dir,noRemoteWrites:true},null,2))
if(report.result!=='PROD_PREFLIGHT_READONLY_PASS')process.exitCode=1
