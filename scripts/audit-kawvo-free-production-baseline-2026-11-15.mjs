#!/usr/bin/env node
// G5 preparation: one strictly read-only baseline inspection; no build, no deploy,
// no rollback, no database, no OAuth edits, no secrets printed or persisted.
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

const EXPECTED_MAIN='76babd4dd26faf7d502910c0fc65989c3b16f36a'
const APPROVED_PREVIEW='af5d915e982b125d0984bc6938bac5e58d876ca2'
const stage='release/kawvo-free-production-preparation-2026-11-15'
const fail=message=>{throw Error(message)}
const sha256=b=>createHash('sha256').update(b).digest('hex')
const curl=url=>execFileSync('curl',['-fsSL','--connect-timeout','10','--max-time','75',url],{stdio:['ignore','pipe','pipe'],maxBuffer:64*1024*1024})
function asset(html){
  const match=html.toString('utf8').match(/\/assets\/index-[A-Za-z0-9_-]+\.js/)
  if(!match)fail('No se identificó el bundle principal')
  return match[0]
}
async function getProject(account,headers,name){
  const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+'/pages/projects/'+name,{headers,signal:AbortSignal.timeout(30000)})
  const body=await response.json().catch(()=>null)
  if(!response.ok||body?.success!==true||body?.result?.name!==name)fail('GET Pages '+name+' HTTP '+response.status+'; no se pudo comprobar el proyecto')
  return body.result
}
const root=join(homedir(),'intap-release-logs')
mkdirSync(root,{recursive:true})
const log=mkdtempSync(join(root,'kawvo-free-production-baseline-'))
const report={operation:'READ ONLY',expected_main:EXPECTED_MAIN,approved_preview:APPROVED_PREVIEW,projects:[],worker:[],errors:[]}
console.log('LOG: '+log)
try{
  if(run('git',['branch','--show-current']).trim()!==stage)fail('Rama de preparación incorrecta')
  if(run('git',['status','--porcelain']).trim())fail('Checkout con cambios locales')
  run('git',['fetch','github','main'])
  report.current_main=run('git',['rev-parse','github/main']).trim()
  if(report.current_main!==EXPECTED_MAIN)fail('main avanzó desde la comparación; revisar nuevo SHA')
  const headers=existingCredentials(),account=existingAccount()
  for(const [name,domain,route] of [['intap-web2','https://app.intaprd.com','/admin/login'],['intap-link','https://intaprd.com','/']]){
    const item={project:name,domain}
    report.projects.push(item)
    try{
      const p=await getProject(account,headers,name)
      const d=p.canonical_deployment,meta=d?.deployment_trigger?.metadata||{}
      item.production_branch=p.production_branch
      if(!d||p.production_branch!=='main'||d.environment!=='production'||meta.branch!=='main'||d.latest_stage?.status!=='success')fail('Despliegue canónico no coincide con Producción/main exitosa')
      if(!/^[a-f0-9]{8,40}\.([a-z0-9-]+)\.pages\.dev$/.test(new URL(d.url).hostname)||new URL(d.url).hostname.split('.')[1]!==name||new URL(d.url).protocol!=='https:'||new URL(d.url).pathname!=='/')fail('Origen inmutable no reconocido')
      item.immutable_url=normal(d.url)
      item.deployment_id=String(d.id||'')
      item.commit=/^[a-f0-9]{7,40}$/i.test(String(meta.commit_hash||''))?meta.commit_hash:null
      item.commit_dirty=typeof meta.commit_dirty==='boolean'?meta.commit_dirty:null
      item.matches_main=item.commit===report.current_main
      item.production_auto_deploy=typeof p.source?.config?.production_deployments_enabled==='boolean'?p.source.config.production_deployments_enabled:null
      item.created_on=d.created_on||null
      const liveHtml=curl(domain+route),originHtml=curl(item.immutable_url+route)
      item.bundle=asset(liveHtml)
      if(asset(originHtml)!==item.bundle)fail('Dominio sirve otro bundle que el origen canónico')
      const live=curl(domain+item.bundle),immutable=curl(item.immutable_url+item.bundle)
      if(!live.equals(immutable))fail('Bundle del dominio difiere del origen inmutable')
      item.sha256=sha256(live)
      item.verified=true
      console.log('PASS: '+name+' dominio y despliegue inmutable iguales')
      console.log('  Commit registrado: '+(item.commit||'no informado'))
      console.log('  Coincide con main: '+(item.matches_main?'SI':'NO'))
      console.log('  Origen: '+item.immutable_url)
      console.log('  Bundle: '+item.bundle+' sha256='+item.sha256)
    }catch(e){report.errors.push(name+': '+String(e.message||e).split('\n')[0]);console.error('BLOCKED: '+name+' — '+String(e.message||e).split('\n')[0])}
  }
  for(const name of ['intap-api','intap-api-preview']){
    try{
      const s=JSON.parse(run('npx',['--no-install','wrangler','deployments','status','--name',name,'--json']))
      if(!Array.isArray(s.versions)||!s.versions.length)fail('Estado Worker no verificable')
      const versions=s.versions.map(v=>({version_id:String(v.version_id||''),percentage:Number(v.percentage)}))
      if(versions.some(v=>!/^[a-f0-9-]{36}$/i.test(v.version_id)||!Number.isFinite(v.percentage)))fail('Estado Worker inválido')
      report.worker.push({name,versions})
      console.log('PASS: Worker '+name+' (solo lectura): '+versions.map(v=>v.version_id+' '+v.percentage+'%').join(', '))
    }catch{report.errors.push(name+': no se pudo obtener estado de versiones');console.error('BLOCKED: no se pudo verificar '+name)}
  }
}catch(e){report.errors.push(String(e.message||e).split('\n')[0]);console.error('BLOCKED: '+String(e.message||e).split('\n')[0])}
const out=join(log,'report.json')
writeFileSync(out,JSON.stringify(report,null,2)+'\n',{mode:0o600})
console.log('REPORTE: '+out)
console.log('SIN CAMBIOS: solo lectura, sin build, merge, deploy, rollback ni D1/R2.')
if(report.errors.length){console.log('BASELINE INCOMPLETA: revisar evidencia antes de preparar candidato');process.exitCode=1}
else console.log('PASS G5 BASELINE: evidencia productiva capturada; commit/migración requieren revisión y autorización separada.')
