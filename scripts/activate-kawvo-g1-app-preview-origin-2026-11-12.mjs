#!/usr/bin/env node
// KAWVO G1 App Preview cutover. This updates ONLY APP_PAGES_ORIGIN on intap-api-preview,
// retaining all other bindings via Cloudflare inherit. NO Worker source upload.
// Cloudflare API docs: PATCH /workers/scripts/:name/settings, POST /deployments.
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import assert from 'node:assert/strict'

const WORKER='intap-api-preview'
const BEFORE_VERSION='23405a5b-e9ca-4247-843d-28cc4f236eaa'
const BEFORE_APP='https://qa-kawmed-guest-current-2026.intap-web2.pages.dev'
const BEFORE_WEB='https://qa-sponsor-scan-1104.intap-link.pages.dev'
const AFTER_APP='https://d1451e86.intap-web2.pages.dev'
const BRANCH='feature/kawvo-free-g1-current-main-integration-2026-11-12'
const ROOT_COMMIT='790c46e11340be81e802edb4e6a6c60e0c459736'
const PAGE='https://app.preview.intaprd.com'
const run=(cmd,args)=>execFileSync(cmd,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:8*1024*1024}).trim()
const json=x=>JSON.parse(x)
const die=x=>{console.error('BLOCKED: '+x);process.exit(1)}
const origin=(list,name)=>{
  const all=list.filter(b=>b.name===name)
  assert.equal(all.length,1,'Binding '+name+' no es único')
  assert.equal(all[0].type,'plain_text',name+' tiene tipo inesperado')
  return all[0].text
}
const map=list=>new Map(list.map(b=>[b.name,b.type]))
// Cloudflare GET /scripts/:name/versions returns {result:{items:[...]}}
// not a result array. Preserve strict fail-closed behavior on any other shape.
const listedVersions=result=>{
  assert(result && !Array.isArray(result) && Array.isArray(result.items),'Formato inesperado del listado de versiones de Cloudflare')
  assert(result.items.length>0,'Cloudflare devolvió listado de versiones vacío')
  assert(result.items.every(v=>uuid(v.id)),'El listado contiene identificadores de versión inválidos')
  return result.items
}
const uuid=x=>/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(String(x))
const equals=(a,b)=>assert.deepEqual([...map(a)].sort(),[...map(b)].sort(),'Cloudflare cambió bindings')
const entry=html=>{
  const m=html.match(/(?:src|href)=["'](\/assets\/index-[a-zA-Z0-9_-]+\.js)["']/)
  assert(m,'No se encontró JS en HTML')
  return m[1]
}
function credentials() {
  if(process.env.CLOUDFLARE_API_TOKEN)return {Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN}
  if(process.env.CLOUDFLARE_API_KEY&&process.env.CLOUDFLARE_EMAIL)return {'X-Auth-Email':process.env.CLOUDFLARE_EMAIL,'X-Auth-Key':process.env.CLOUDFLARE_API_KEY}
  const paths=[
    join(homedir(),'Library','Preferences','.wrangler','config','default.toml'),
    join(homedir(),'.wrangler','config','default.toml'),
    join(homedir(),'.config','.wrangler','config','default.toml')
  ].filter(existsSync)
  assert.equal(paths.length,1,'No hay una única sesión de Wrangler; detenido')
  const c=readFileSync(paths[0],'utf8')
  const m=c.match(/^oauth_token\s*=\s*"([^"\r\n]+)"/m)
  assert(m,'No se pudo usar sesión Wrangler existente')
  return {Authorization:'Bearer '+m[1]}
}
function account() {
  const output=run('npx',['--no-install','wrangler','whoami'])
  const ids=[...new Set((output.match(/\b[a-f0-9]{32}\b/gi)||[]).map(x=>x.toLowerCase()))]
  const value=process.env.CLOUDFLARE_ACCOUNT_ID|| (ids.length===1?ids[0]:'')
  assert(/^[a-f0-9]{32}$/i.test(value),'Cuenta Cloudflare ambigua; detenido')
  if(ids.length)assert(ids.includes(value.toLowerCase()),'Cuenta no pertenece a sesión Wrangler')
  return value
}
function deploymentStatus() {
  const x=json(run('npx',['--no-install','wrangler','deployments','status','--name',WORKER,'--json']))
  assert(Array.isArray(x.versions)&&x.versions.length===1,'Hay múltiples versiones de Worker en tráfico')
  assert.equal(Number(x.versions[0].percentage),100,'El Worker no sirve el 100% de una versión')
  return x.versions[0].version_id
}
async function api(url,headers,method='GET',payload) {
  const opts={method,headers:{...headers},signal:AbortSignal.timeout(30000)}
  if(payload!==undefined){
    if(payload instanceof FormData)opts.body=payload
    else {opts.headers['Content-Type']='application/json';opts.body=JSON.stringify(payload)}
  }
  const res=await fetch(url,opts)
  if(!res.ok)throw Error('Cloudflare '+method+' HTTP '+res.status)
  const j=await res.json()
  if(j.success!==true)throw Error('Cloudflare '+method+' rejected; codes '+(j.errors||[]).map(e=>e.code).join(','))
  return j.result
}
async function htmlEntry(url) {
  const r=await fetch(url,{signal:AbortSignal.timeout(25000),headers:{'Cache-Control':'no-cache'}})
  assert.equal(r.status,200,'HTTP '+r.status+' en '+url)
  return entry(await r.text())
}
function bindingList(x) {
  assert(Array.isArray(x?.bindings),'Faltan bindings en Worker settings')
  assert.equal(x.bindings.length,35,'El número de bindings no es 35')
  assert.equal(map(x.bindings).size,35,'Hay bindings duplicados')
  return x.bindings
}
let changed=false, headers, deploymentUrl
async function rollback() {
  if(!changed||!headers||!deploymentUrl)return
  try{
    console.error('INICIANDO ROLLBACK hacia versión de Worker original '+BEFORE_VERSION)
    await api(deploymentUrl,headers,'POST',{
      strategy:'percentage',
      versions:[{version_id:BEFORE_VERSION,percentage:100}],
      annotations:{'workers/message':'Rollback G1 UI-only Preview: restore previous Worker version'}
    })
    console.error('ROLLBACK solicitado; verificar App Preview antes de continuar.')
  }catch{console.error('ALERTA: no se pudo confirmar rollback; conservar versión anterior '+BEFORE_VERSION+' y revisar despliegues antes de operar.')}
}
try {
  assert.equal(process.env.KAWVO_G1_ACTIVATE,'SI','Activación requiere KAWVO_G1_ACTIVATE=SI')
  assert.equal(run('git',['branch','--show-current']),BRANCH,'Rama incorrecta')
  run('git',['merge-base','--is-ancestor',ROOT_COMMIT,'HEAD'])
  run('git',['diff','--exit-code',ROOT_COMMIT,'HEAD','--','app/'])
  assert.equal(run('git',['status','--porcelain']),'','Árbol Git no está limpio')
  // Reuse the already verified full, read-only preflight with matching App bundle.
  console.log('▶ Preflight G1 read-only antes de activar...')
  const pre=run('node',['scripts/preflight-kawvo-g1-app-origin-api-readonly-2026-11-12.mjs'])
  assert(pre.includes('PASS: Cloudflare API settings coincide en 35 binding(s)'),'Preflight no completado')
  console.log('PASS: preflight 35 bindings')
  headers=credentials()
  const id=account()
  const base='https://api.cloudflare.com/client/v4/accounts/'+id+'/workers/scripts/'+WORKER
  const settingsUrl=base+'/settings'
  const versionsUrl=base+'/versions'
  deploymentUrl=base+'/deployments'
  assert.equal(deploymentStatus(),BEFORE_VERSION,'El Worker activo cambió')
  const [current,versions]=await Promise.all([
    api(settingsUrl,headers),
    api(versionsUrl+'?per_page=5',headers)
  ])
  const bs=bindingList(current)
  assert.equal(origin(bs,'APP_PAGES_ORIGIN'),BEFORE_APP,'APP_PAGES_ORIGIN ya cambió')
  assert.equal(origin(bs,'WEB_PAGES_ORIGIN'),BEFORE_WEB,'WEB_PAGES_ORIGIN ya cambió')
  const beforeVersions=listedVersions(versions)
  assert.equal(beforeVersions[0].id,BEFORE_VERSION,'Última versión no coincide con la activa; herencia no es segura')
  assert.equal(await htmlEntry(PAGE+'/admin/login'),await htmlEntry(BEFORE_APP+'/admin/login'),'Dominio no sirve Pages anterior')
  const expected=await htmlEntry(AFTER_APP+'/admin/login')
  assert.equal(expected,entry(readFileSync('app/dist/index.html','utf8')),'Candidato no coincide con compilación')
  // Preserve every binding except APP_PAGES_ORIGIN. Inherit resolves against the
  // verified most recent version; prevents disclosure/re-upload of any secret.
  const inherited=bs.map(b=>b.name==='APP_PAGES_ORIGIN'
    ? {name:b.name,type:'plain_text',text:AFTER_APP}
    : {name:b.name,type:'inherit'})
  const form=new FormData()
  form.set('settings',JSON.stringify({
    bindings:inherited,
    annotations:{'workers/message':'KAWVO G1 UI-only App Pages Preview: switch APP_PAGES_ORIGIN to d1451e86; preserve 34 bindings'}
  }))
  // Guard against a concurrent Worker update immediately before mutation.
  assert.equal(deploymentStatus(),BEFORE_VERSION,'Cambió Worker entre verificaciones')
  console.log('▶ Actualizando exclusivamente APP_PAGES_ORIGIN; sin subir código Worker...')
  changed=true
  const patched=await api(settingsUrl,headers,'PATCH',form)
  if(patched?.bindings) {
    equals(bs,patched.bindings)
    assert.equal(origin(patched.bindings,'APP_PAGES_ORIGIN'),AFTER_APP,'PATCH no dejó APP apuntando a Pages G1')
    assert.equal(origin(patched.bindings,'WEB_PAGES_ORIGIN'),BEFORE_WEB,'PATCH cambió Web')
  }
  const afterSettings=await api(settingsUrl,headers)
  const afterBs=bindingList(afterSettings)
  equals(bs,afterBs)
  assert.equal(origin(afterBs,'APP_PAGES_ORIGIN'),AFTER_APP,'Origen APP no cambiado')
  assert.equal(origin(afterBs,'WEB_PAGES_ORIGIN'),BEFORE_WEB,'Origen WEB cambió')
  // The PATCH may create a new version without activating it; if so deploy
  // exactly the new latest version at 100%, using the documented deployment API.
  const v2=listedVersions(await api(versionsUrl+'?per_page=5',headers))
  const next=v2[0].id
  if(deploymentStatus()===BEFORE_VERSION){
    assert.notEqual(next,BEFORE_VERSION,'PATCH no generó versión nueva desplegable')
    console.log('▶ Desplegando nueva versión de ajustes a App Preview 100%...')
    await api(deploymentUrl,headers,'POST',{
      strategy:'percentage',
      versions:[{version_id:next,percentage:100}],
      annotations:{'workers/message':'KAWVO G1 UI-only App Preview, 35 bindings preserved'}
    })
  }
  assert.equal(deploymentStatus(),next,'La versión activada difiere de la nueva')
  // Fail closed + rollback if the expected App JS isn't actually served.
  let served=''
  for(let i=0;i<5;i++){
    served=await htmlEntry(PAGE+'/admin/free/shell-preview?kawvo_shell=1')
    if(served===expected)break
    await new Promise(r=>setTimeout(r,1500))
  }
  assert.equal(served,expected,'App Preview aún sirve bundle anterior')
  assert.equal(await htmlEntry(PAGE+'/admin/login'),expected,'Login no usa nuevo bundle')
  const again=await api(settingsUrl,headers)
  equals(bs,bindingList(again))
  assert.equal(origin(again.bindings,'WEB_PAGES_ORIGIN'),BEFORE_WEB)
  assert.equal(origin(again.bindings,'APP_PAGES_ORIGIN'),AFTER_APP)
  changed=false
  console.log('PASS: APP PREVIEW ACTUALIZADO al bundle '+expected)
  console.log('PASS: 35 bindings preservados, Web intacta y Google hostname sin cambios.')
  console.log('WORKER VERSIÓN ANTERIOR (rollback): '+BEFORE_VERSION)
  console.log('WORKER VERSIÓN NUEVA: '+next)
  console.log('QA: '+PAGE+'/admin/free/shell-preview?kawvo_shell=1')
  console.log('NO se alteraron D1, R2, OAuth, web, ni producción.')
}catch(e){
  console.error('BLOCKED: '+((e?.name==='AssertionError')?e.message:'Activación no verificada: '+(e?.message||'error desconocido')))
  await rollback()
  process.exitCode=1
}
