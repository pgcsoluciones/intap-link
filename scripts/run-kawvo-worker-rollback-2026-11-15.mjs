#!/usr/bin/env node
// Explicitly authorized recovery of intap-api only. No build or database changes.
import {execFileSync} from 'node:child_process'
import {readFileSync,existsSync,mkdirSync,mkdtempSync,writeFileSync} from 'node:fs'
import {homedir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
const run=(cmd,args)=>execFileSync(cmd,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:8*1024*1024})
const normal=u=>String(u||'').replace(/\/$/,'').toLowerCase()
function existingCredentials(){
  if(process.env.CLOUDFLARE_API_TOKEN)return {Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN}
  if(process.env.CLOUDFLARE_API_KEY&&process.env.CLOUDFLARE_EMAIL)return {'X-Auth-Email':process.env.CLOUDFLARE_EMAIL,'X-Auth-Key':process.env.CLOUDFLARE_API_KEY}
  const paths=[
    join(homedir(),'Library','Preferences','.wrangler','config','default.toml'),
    join(homedir(),'.wrangler','config','default.toml'),
    join(homedir(),'.config','.wrangler','config','default.toml')
  ].filter(existsSync)
  if(paths.length!==1)throw Error('No se encontró una sola sesión Wrangler; ninguna operación Cloudflare fue modificada.')
  const token=readFileSync(paths[0],'utf8').match(/^oauth_token\s*=\s*"([^"\r\n]+)"/m)
  if(!token)throw Error('No hay token de acceso OAuth legible en sesión actual; no se requieren credenciales nuevas.')
  return {Authorization:'Bearer '+token[1]}
}
function existingAccount(){
  const output=run('npx',['--no-install','wrangler','whoami'])
  const ids=[...new Set((output.match(/\b[a-f0-9]{32}\b/gi)||[]).map(x=>x.toLowerCase()))]
  const id=process.env.CLOUDFLARE_ACCOUNT_ID || (ids.length===1?ids[0]:'')
  if(!/^[a-f0-9]{32}$/i.test(id)|| (ids.length&&!ids.includes(id.toLowerCase())))throw Error('Cuenta no determinada con precisión desde Wrangler.')
  return id
}


const OLD='3d4973e4-e344-493a-a065-93f199b00359', NEW='1972228c-4dd7-4ede-9d94-8338132b3b20', PREVIEW='23405a5b-e9ca-4247-843d-28cc4f236eaa'
const MAIN='67cd49e224888dc19acefad933bfa0c7ddd6e9da'
const equal=(a,b,msg)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error(msg)}
const sorted=x=>Array.isArray(x)?x.map(sorted):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,sorted(x[k])])):x
const wr=(...args)=>JSON.parse(run('npx',['--no-install','wrangler',...args,'--json']))
const root=join(homedir(),'Desktop','intap-link-universal-bilingual-audit')
process.chdir(root)
mkdirSync(join(homedir(),'intap-release-logs'),{recursive:true})
const log=mkdtempSync(join(homedir(),'intap-release-logs','kawvo-worker-rollback-'))
const report={phase:'preflight',rollback_attempted:false,errors:[]}
const persist=()=>writeFileSync(join(log,'report.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600})
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
console.log('LOG: '+log)
function active(name,id){const d=wr('deployments','status','--name',name);equal(d.versions?.map(v=>({id:v.version_id,pct:Number(v.percentage)})),[{id,pct:100}],'Versión activa inesperada '+name);return {name,id,percentage:100,deployment_id:d.id}}
function version(id){const v=wr('versions','view',id,'--name','intap-api');equal(v.id,id,'ID incorrecto');if(!Array.isArray(v.resources?.bindings)||v.resources.bindings.length!==32||!v.resources.script_runtime)throw Error('Metadata incompleta');return v.resources}
function compareVersions(){const a=version(OLD),b=version(NEW);const bindings=x=>x.bindings.map(sorted).sort((a,b)=>a.name.localeCompare(b.name));equal(bindings(a),bindings(b),'Bindings cambiaron');equal(sorted(a.script_runtime),sorted(b.script_runtime),'Runtime cambió');return {count:32,metadata_equal:true,runtime_equal:true}}
const curlStatus=(host,path)=>{const raw=run('curl',['-sS','--connect-timeout','10','--max-time','30','-o','/dev/null','-w','%{http_code}',host+path]);return Number(raw.trim())}
function smoke(){const result={};const health=JSON.parse(run('curl',['-fsS','--connect-timeout','10','--max-time','30','https://api.intaprd.com/api/health']));equal(health.ok,true,'API health no OK');result.health=true;for(const host of ['https://api.intaprd.com','https://app.intaprd.com','https://intaprd.com']){const statuses={};for(const p of ['/api/v1/me/intapcard/accounts','/api/v1/me/home-route']){const code=curlStatus(host,p);equal(code,401,'Ruta protegida incorrecta '+host+p);statuses[p]=code}result[host]=statuses}return result}
try{
 equal(process.argv[2],'RESTORE-3d4973e4','Autorización operativa ausente')
 equal(run('git',['branch','--show-current']).trim(),'main','Rama incorrecta')
 equal(run('git',['status','--porcelain']).trim(),'','Checkout sucio')
 run('git',['fetch','github','main'])
 equal(run('git',['rev-parse','HEAD']).trim(),MAIN,'HEAD cambió')
 equal(run('git',['rev-parse','github/main']).trim(),MAIN,'main remoto cambió')
 const account=existingAccount(),headers=existingCredentials()
 equal(account.toLowerCase(),'adf4d5ebb625fed2c32e38cef57a6319','Cuenta Cloudflare distinta')
 async function get(path){const res=await fetch('https://api.cloudflare.com/client/v4'+path,{headers,signal:AbortSignal.timeout(30000)});const b=await res.json().catch(()=>null);if(!res.ok||b?.success!==true)throw Error('GET Cloudflare HTTP '+res.status+' ('+path.split('/').pop()+')');return b.result}
 async function triggers(){const prefix='/accounts/'+account+'/workers';const d=await get(prefix+'/domains?hostname=api.intaprd.com');if(!Array.isArray(d))throw Error('Dominios no verificables');const domain=d.find(x=>x.hostname==='api.intaprd.com'&&x.service==='intap-api');if(!domain||!domain.zone_id||domain.enabled===false)throw Error('Dominio API incorrecto');const routes=await get('/zones/'+domain.zone_id+'/workers/routes');if(!Array.isArray(routes))throw Error('Rutas no verificables');const own=routes.filter(x=>x.script==='intap-api').map(x=>x.pattern).sort();equal(own,['app.intaprd.com/api/*','intaprd.com/api/*'],'Rutas no coinciden con configuración del repo');const sched=await get(prefix+'/scripts/intap-api/schedules');const crons=sched.schedules?.map(x=>x.cron).sort();equal(crons,['17 * * * *','17 5 * * *'],'Cron no coincide con configuración del repo');return {domain:domain.hostname,routes:own,crons}}
 async function pages(){const out=[];for(const [name,id] of [['intap-web2','f9f7fa23-86de-43bd-bb1c-e940318d58d4'],['intap-link','1672b41a-8e3d-44a8-b576-026693c04e29']]){const p=await get('/accounts/'+account+'/pages/projects/'+name);equal(p.canonical_deployment?.id,id,'Pages cambió '+name);equal(p.source?.config?.production_deployments_enabled,false,'Auto-deploy Pages activo '+name);out.push({name,id})}return out}
 report.before={production:active('intap-api',NEW),preview:active('intap-api-preview',PREVIEW),comparison:compareVersions(),triggers:await triggers(),pages:await pages()}
 // Pre-rollback smoke is diagnostic; recovery may be necessary even if current API is unhealthy.
 try{report.before.smoke=smoke()}catch(e){report.before.smoke_error=String(e.message).slice(0,180)}
 persist()
 console.log('PASS preflight: versiones, 32 bindings, runtime, rutas, cron, Pages y Preview')
 active('intap-api',NEW);active('intap-api-preview',PREVIEW)
 report.phase='rollback';report.rollback_attempted=true;persist()
 const output=run('npx',['--no-install','wrangler','rollback',OLD,'--name','intap-api','--message','P0 recovery: restore exact protected Worker baseline after unintended Workers Builds deployment'])
 writeFileSync(join(log,'rollback.log'),output,{mode:0o600})
 report.phase='verification';persist()
 let last
 for(let i=0;i<10;i++){try{report.after={production:active('intap-api',OLD),preview:active('intap-api-preview',PREVIEW),triggers:await triggers(),pages:await pages(),smoke:smoke()};equal(report.after.triggers,report.before.triggers,'Triggers cambiaron');equal(report.after.pages,report.before.pages,'Pages cambió');last=null;break}catch(e){last=e;if(i<9)await sleep(3000)}}
 if(last)throw last
 report.phase='PASS';persist();console.log('PASS WORKER RECOVERY')
}catch(e){report.errors.push(String(e.message||e).split('\n')[0].slice(0,180));persist();console.error('BLOCKED '+report.phase+(report.rollback_attempted?': NO REPETIR rollback sin consultar estado':': sin rollback'));process.exitCode=1}
console.log('REPORTE: '+join(log,'report.json')+'\n'+JSON.stringify(report,null,2))
