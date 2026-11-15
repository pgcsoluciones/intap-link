#!/usr/bin/env node
// Cloudflare Pages Web-Preview alias owner audit. GET/read-only, no Worker mutation.
import {execFileSync} from 'node:child_process'
import {existsSync,readFileSync,mkdirSync,mkdtempSync,writeFileSync} from 'node:fs'
import {homedir} from 'node:os'
import {join} from 'node:path'

const project='intap-link'
const alias='https://qa-sponsor-scan-1104.intap-link.pages.dev'
const worker='intap-api-preview'
const expectedWorker='23405a5b-e9ca-4247-843d-28cc4f236eaa'
const fail=(reason)=>{console.error('BLOCKED: '+reason);process.exit(1)}
const run=(cmd,args)=>execFileSync(cmd,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:8*1024*1024})
const normal=(value)=>String(value||'').replace(/\/$/,'').toLowerCase()

function auth(){
  if(process.env.CLOUDFLARE_API_TOKEN)return {Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN}
  if(process.env.CLOUDFLARE_API_KEY&&process.env.CLOUDFLARE_EMAIL)return {'X-Auth-Email':process.env.CLOUDFLARE_EMAIL,'X-Auth-Key':process.env.CLOUDFLARE_API_KEY}
  const files=[
    join(homedir(),'Library','Preferences','.wrangler','config','default.toml'),
    join(homedir(),'.wrangler','config','default.toml'),
    join(homedir(),'.config','.wrangler','config','default.toml')
  ].filter(existsSync)
  if(files.length!==1)throw Error('Sesión Wrangler no es inequívoca')
  const token=readFileSync(files[0],'utf8').match(/^oauth_token\s*=\s*"([^"\r\n]+)"/m)
  if(!token)throw Error('No se encontró token OAuth de la sesión Wrangler')
  return {Authorization:'Bearer '+token[1]}
}
function account(){
  const info=run('npx',['--no-install','wrangler','whoami'])
  const ids=[...new Set((info.match(/\b[a-f0-9]{32}\b/gi)||[]).map(x=>x.toLowerCase()))]
  const value=process.env.CLOUDFLARE_ACCOUNT_ID||(ids.length===1?ids[0]:'')
  if(!/^[a-f0-9]{32}$/i.test(value)||(ids.length&&!ids.includes(value.toLowerCase())))throw Error('Cuenta Cloudflare no verificada')
  return value
}
async function get(url,headers){
  const response=await fetch(url,{headers,signal:AbortSignal.timeout(30000)})
  const data=await response.json().catch(()=>null)
  if(!response.ok||!data?.success||!Array.isArray(data.result))throw Error('GET Pages falló, HTTP '+response.status)
  return {items:data.result,info:data.result_info||{}}
}
try{
  const workerStatus=JSON.parse(run('npx',['--no-install','wrangler','deployments','status','--name',worker,'--json']))
  if(workerStatus.versions?.length!==1||workerStatus.versions[0].version_id!==expectedWorker||Number(workerStatus.versions[0].percentage)!==100)throw Error('Worker Preview original no está al 100%')
  const headers=auth(),accountId=account()
  const base='https://api.cloudflare.com/client/v4/accounts/'+accountId+'/pages/projects/'+project+'/deployments'
  let found=null,pages=0
  for(let page=1;page<=30;page++){
    const {items,info}=await get(page===1?base:base+'?page='+page,headers)
    pages++
    for(const row of items){
      const aliases=(row.aliases||[]).map(normal)
      if(aliases.includes(normal(alias))){
        found={
          branch:row.deployment_trigger?.metadata?.branch||'',
          commit:row.deployment_trigger?.metadata?.commit_hash||'',
          short_id:row.short_id||'',
          environment:row.environment||'',
          stage:row.latest_stage?.status||'',
          alias
        }
        break
      }
    }
    if(found||!items.length||(Number.isInteger(info.total_pages)&&page>=info.total_pages)||(!Number.isInteger(info.total_pages)&&items.length<20))break
  }
  if(!found||!found.branch||!/^[0-9a-f]{8,}$/i.test(found.short_id)||found.environment!=='preview')throw Error('No se pudo identificar la rama y URL inmutable del alias Web Preview')
  const output={
    operation:'READ ONLY',pages_project:project,web_preview_alias:alias,
    pages_examined:pages,worker_original_active:true,owner:found,
    immutable_url:'https://'+found.short_id+'.intap-link.pages.dev'
  }
  const root=join(homedir(),'intap-release-logs')
  mkdirSync(root,{recursive:true})
  const dir=mkdtempSync(join(root,'kawvo-g2-4-web-owner-'))
  const filepath=join(dir,'report.json')
  writeFileSync(filepath,JSON.stringify(output,null,2)+'\n',{mode:0o600})
  console.log('PASS: alias Web Preview perteneciente a rama '+found.branch)
  console.log('PASS: Web inmutable '+output.immutable_url)
  console.log('PASS: Worker Preview original al 100%')
  console.log('REPORTE: '+filepath)
  console.log('SIN CAMBIOS: Pages, Worker, API, D1/R2, OAuth, Producción')
}catch(error){fail(String(error?.message||'error').replace(/\b[a-f0-9]{32}\b/gi,'[oculto]'))}
