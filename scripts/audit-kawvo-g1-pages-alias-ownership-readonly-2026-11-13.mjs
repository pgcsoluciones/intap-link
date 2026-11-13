#!/usr/bin/env node
// KAWVO G1 - Read-only audit of Pages deployment aliases and git branch sources.
// Uses the *existing* Wrangler session. No deploy, PATCH, POST, secrets or output of account IDs.
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const PROJECT='intap-web2'
const WORKER='intap-api-preview'
const ORIGINAL_WORKER='23405a5b-e9ca-4247-843d-28cc4f236eaa'
const DOMAIN_ALIAS='https://qa-kawmed-guest-current-2026.intap-web2.pages.dev'
const NEW_ALIAS='https://qa-kawmed-guest-current-2026-5vvy.intap-web2.pages.dev'
const NEW_DEPLOY='ac86d677'
const QA_DEPLOY='d1451e86'
const fail=message=>{console.error('BLOCKED: '+message);process.exit(1)}
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
async function api(url,headers){
  const response=await fetch(url,{headers,signal:AbortSignal.timeout(30000)})
  // Expose only API error codes and short sanitized descriptions; never dump headers,
  // credentials, Cloudflare account ID, body with env_vars, or request URLs.
  const body=await response.json().catch(()=>null)
  if(!response.ok||body?.success!==true){
    const codes=(Array.isArray(body?.errors)?body.errors:[])
      .slice(0,3).map(x=>String(x.code||'unknown')).join(',')
    const details=(Array.isArray(body?.errors)?body.errors:[])
      .slice(0,2).map(x=>String(x.message||'').slice(0,140)
        .replace(/\b[a-f0-9]{32}\b/gi,'[cuenta]')
        .replace(/Bearer\s+\S+/gi,'Bearer [oculto]')).join(' | ')
    throw Error('Cloudflare Pages GET HTTP '+response.status+'; codes='+codes+'; '+details+'; sin modificaciones.')
  }
  if(!Array.isArray(body.result))throw Error('Cloudflare Pages GET no devolvió una lista.')
  return {items:body.result,info:body.result_info||{}}
}
function reportEntry(d){
  const branch=d.deployment_trigger?.metadata?.branch
  const aliases=Array.isArray(d.aliases)?d.aliases.map(normal):[]
  return {
    deployment_id:d.id,
    short_id:d.short_id||'',
    branch:typeof branch==='string'?branch:'',
    commit:d.deployment_trigger?.metadata?.commit_hash||'',
    environment:d.environment||'',
    stage:d.latest_stage?.status||'',
    aliases,
    created_on:d.created_on||''
  }
}
try{
  const status=JSON.parse(run('npx',['--no-install','wrangler','deployments','status','--name',WORKER,'--json']))
  if(!Array.isArray(status.versions)||status.versions.length!==1||status.versions[0].version_id!==ORIGINAL_WORKER||Number(status.versions[0].percentage)!==100)throw Error('Worker no está al 100% en la versión de rollback segura.')
  console.log('PASS: Worker Preview original sigue activo al 100%.')
  const headers=existingCredentials(),account=existingAccount()
  const prefix='https://api.cloudflare.com/client/v4/accounts/'+account+'/pages/projects/'+PROJECT+'/deployments'
  const matches=new Map()
  const seen=new Set()
  let pages=0, count=0
  for(let p=1;p<=25;p++){
    // Official endpoint works without query params; do not request per_page=100.
    // Use Cloudflare default pagination and only vary page for later requests.
    const {items,info}=await api(p===1?prefix:prefix+'?page='+p,headers)
    pages++
    if(!items.length)break
    for(const d of items){
      const info=reportEntry(d)
      const target=info.aliases.includes(normal(DOMAIN_ALIAS))?'origen_del_worker':
        info.aliases.includes(normal(NEW_ALIAS))?'alias_nuevo':
        info.short_id===NEW_DEPLOY?'despliegue_ac86d677':
        info.short_id===QA_DEPLOY?'despliegue_d1451e86':null
      if(target)matches.set(target,info)
      if(d.id&&!seen.has(d.id)){seen.add(d.id);count++}
    }
    // Continue until both alias owners and new deployment details are found.
    if(matches.has('origen_del_worker')&&matches.has('alias_nuevo')&&matches.has('despliegue_ac86d677'))break
    if(Number.isInteger(info.total_pages) && p>=info.total_pages)break
    if(!Number.isInteger(info.total_pages) && items.length<20)break
  }
  const result={
    operation:'READ ONLY — Cloudflare Pages deployment history',
    worker_original_active:true,
    pages_project:PROJECT,
    pages_examined:pages,
    deployments_examined:count,
    old_alias:DOMAIN_ALIAS,
    new_alias:NEW_ALIAS,
    found:Object.fromEntries([...matches].map(([k,v])=>[k,v])),
    conclusion:matches.has('origen_del_worker')&&matches.has('alias_nuevo')
      ? 'Both aliases grounded: compare their .branch strings before any new publication'
      : 'Insufficient Pages history to identify both aliases; no deployment authorized'
  }
  const logroot=join(homedir(),'intap-release-logs')
  mkdirSync(logroot,{recursive:true})
  const log=mkdtempSync(join(logroot,'kawvo-g1-pages-alias-audit-'))
  const path=join(log,'report.json')
  writeFileSync(path,JSON.stringify(result,null,2)+'\n',{mode:0o600})
  for(const [key,v] of matches){
    console.log('ENCONTRADO: '+key)
    console.log('  Rama real: '+(v.branch||'(vacía)'))
    console.log('  Deploy: '+(v.short_id||'(sin short_id)'))
    console.log('  Aliases: '+v.aliases.join(' | '))
  }
  console.log('REPORTE: '+path)
  if(!matches.has('origen_del_worker'))console.log('AVISO: origen del Worker no aparece entre las páginas consultadas; no asumir la rama.')
  console.log('SIN CAMBIOS: Worker, Pages, API, OAuth, D1/R2, producción.')
}catch(e){fail(e.message?.replace(/\b[a-f0-9]{32}\b/gi,'[account]')||'Error al leer historial de Pages')}
