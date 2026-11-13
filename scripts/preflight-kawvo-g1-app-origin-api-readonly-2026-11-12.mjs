#!/usr/bin/env node
// G1: inspect authenticated Cloudflare Preview using existing Wrangler credentials.
// READ-ONLY: never PATCH, POST, PUT, deploy, modify Worker/Pages, or print secrets.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'

const WORKER='intap-api-preview'
const EXPECTED_VERSION='23405a5b-e9ca-4247-843d-28cc4f236eaa'
const ORIGINAL='https://qa-kawmed-guest-current-2026.intap-web2.pages.dev'
const ORIGINAL_WEB='https://qa-sponsor-scan-1104.intap-link.pages.dev'
const STAGED='https://d1451e86.intap-web2.pages.dev'
const EXPECTED_BRANCH='feature/kawvo-free-g1-current-main-integration-2026-11-12'
const EXPECTED_COMMIT='790c46e11340be81e802edb4e6a6c60e0c459736'
const sha=x=>createHash('sha256').update(x).digest('hex')
const run=(cmd,args)=>execFileSync(cmd,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:10*1024*1024})
const json=x=>JSON.parse(x)
const fail=message=>{console.error('BLOCKED: '+message);process.exit(1)}
const checkedFetch=async(url,headers)=>{const r=await fetch(url,{headers,signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(url+' HTTP '+r.status);return r}
const bodyJson=async r=>{const j=await r.json();if(j.success===false)throw Error('Cloudflare API: '+JSON.stringify(j.errors?.map(e=>e.code)));return j.result??j}
const originFrom= (bindings,name)=>{
  const b=bindings.filter(x=>x?.name===name)
  assert.equal(b.length,1,'Falta binding único '+name)
  assert.equal(b[0].type,'plain_text',name+' no es plain_text')
  return b[0].text
}
const extractEntry=html=>{
  const m=html.match(/(?:src|href)=["'](\/assets\/index-[a-zA-Z0-9_-]+\.js)["']/)
  assert(m,'No encontré JS entry en index.html')
  return m[1]
}
function accountIDs(root) {
  // Wrangler whoami --json may wrap memberships in accounts, memberships, or result.
  const nodes=[]
  const scan=(x,depth=0)=>{
    if(!x||typeof x!=='object'||depth>6)return
    if(Array.isArray(x)){x.forEach(y=>scan(y,depth+1));return}
    if(x.accounts&&Array.isArray(x.accounts))x.accounts.forEach(a=>{if(/^[a-f0-9]{32}$/i.test(String(a.id??a.account_id??a.account?.id??'')))nodes.push(String(a.id??a.account_id??a.account?.id))})
    if(x.memberships&&Array.isArray(x.memberships))x.memberships.forEach(a=>{if(/^[a-f0-9]{32}$/i.test(String(a.account?.id??'')))nodes.push(a.account.id)})
    Object.values(x).forEach(y=>scan(y,depth+1))
  }
  scan(root)
  return [...new Set(nodes)]
}
try {
  assert.equal(run('git',['branch','--show-current']).trim(),EXPECTED_BRANCH,'Rama G1 incorrecta')
  // The staging commit can be an ancestor: later docs/QA scripts do not change the App bundle.
  run('git',['merge-base','--is-ancestor',EXPECTED_COMMIT,'HEAD'])
  run('git',['diff','--exit-code',EXPECTED_COMMIT,'HEAD','--','app/'])
  assert.equal(run('git',['status','--porcelain']).trim(),'','Hay archivos modificados localmente')
  assert(existsSync('app/dist/index.html'),'Falta compilación local')
  const html=readFileSync('app/dist/index.html','utf8')
  const localEntry=extractEntry(html)
  const localJs=readFileSync('app/dist'+localEntry)
  const [status,version]=await Promise.all([
    Promise.resolve(json(run('npx',['--no-install','wrangler','deployments','status','--name',WORKER,'--json']))),
    Promise.resolve(json(run('npx',['--no-install','wrangler','versions','view',EXPECTED_VERSION,'--name',WORKER,'--json'])))
  ])
  assert(Array.isArray(status.versions)&&status.versions.length===1,'Worker tiene múltiples versiones activas')
  assert.equal(status.versions[0].version_id,EXPECTED_VERSION,'Worker versión activa cambió')
  assert.equal(Number(status.versions[0].percentage),100,'Worker no está al 100%')
  const findBindings=(x)=>{const found=[];const scan=(o,depth=0)=>{if(!o||typeof o!=='object'||depth>9)return;if(Array.isArray(o)){o.forEach(v=>scan(v,depth+1));return}if(Array.isArray(o.bindings))found.push(o.bindings);Object.values(o).forEach(v=>scan(v,depth+1))};scan(x);return found}
  const versionMatches=findBindings(version).filter(bs=>bs.some(b=>b.name==='APP_PAGES_ORIGIN'))
  assert(versionMatches.length>=1,'No hay bindings en versión Worker conocida')
  const vBindings=versionMatches[0]
  assert.equal(originFrom(vBindings,'APP_PAGES_ORIGIN'),ORIGINAL,'Origen App del Worker cambió')
  assert.equal(originFrom(vBindings,'WEB_PAGES_ORIGIN'),ORIGINAL_WEB,'Origen Web del Worker cambió')
  // Fetch staged + live HTML AND JS before reading account settings.
  const [liveHtml,originHtml,stageHtml]=await Promise.all([
    checkedFetch('https://app.preview.intaprd.com/admin/login').then(x=>x.text()),
    checkedFetch(ORIGINAL+'/admin/login').then(x=>x.text()),
    checkedFetch(STAGED+'/admin/login').then(x=>x.text())
  ])
  const liveEntry=extractEntry(liveHtml),originEntry=extractEntry(originHtml),stageEntry=extractEntry(stageHtml)
  assert.equal(liveEntry,originEntry,'App Preview ya no sirve el origen histórico')
  assert.equal(stageEntry,localEntry,'Pages inmutable no coincide con el build local')
  const [stageJs,liveJs]=await Promise.all([
    checkedFetch(STAGED+stageEntry).then(r=>r.arrayBuffer()).then(b=>Buffer.from(b)),
    checkedFetch(ORIGINAL+originEntry).then(r=>r.arrayBuffer()).then(b=>Buffer.from(b))
  ])
  assert.equal(sha(stageJs),sha(localJs),'JS de Pages nuevo difiere del local')
  // Respect the existing local Wrangler login. Never invoke npx downloads or print credentials.
  // Mac Wrangler's historical global state is under ~/Library/Preferences/.wrangler.
  // This code reads the access token only in memory, for GET; never reads/stores refresh token.
  let headers
  if(process.env.CLOUDFLARE_API_TOKEN){
    headers={Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN}
  }else if(process.env.CLOUDFLARE_API_KEY&&process.env.CLOUDFLARE_EMAIL){
    headers={'X-Auth-Email':process.env.CLOUDFLARE_EMAIL,'X-Auth-Key':process.env.CLOUDFLARE_API_KEY}
  }else{
    const bases=[
      join(homedir(),'Library','Preferences','.wrangler','config','default.toml'),
      join(homedir(),'.wrangler','config','default.toml'),
      join(homedir(),'.config','.wrangler','config','default.toml')
    ]
    const present=bases.filter(existsSync)
    assert.equal(present.length,1,'No hay un único archivo legacy de sesión Wrangler; no se extraen tokens de ubicaciones inciertas')
    const config=readFileSync(present[0],'utf8')
    const tokenMatch=config.match(/^oauth_token\s*=\s*"([^"\r\n]+)"/m)
    assert(tokenMatch,'Wrangler usa keychain u otro método no accesible; no se extraen credenciales ni se modifica sesión')
    headers={Authorization:'Bearer '+tokenMatch[1]}
  }
  // Read account from existing Wrangler identity, not the stale preview TOML.
  // Never output the credentials or inferred account IDs.
  const whoamiOutput=run('npx',['--no-install','wrangler','whoami'])
  const ids=[...new Set((whoamiOutput.match(/\b[a-f0-9]{32}\b/gi)||[]).map(x=>x.toLowerCase()))]
  const account=process.env.CLOUDFLARE_ACCOUNT_ID|| (ids.length===1?ids[0]:'')
  assert(/^[a-f0-9]{32}$/i.test(account),'Wrangler tiene varias cuentas o no informó ID. Indica CLOUDFLARE_ACCOUNT_ID existente en el entorno; sin configurar nada nuevo.')
  if(ids.length&&!ids.includes(account.toLowerCase()))throw Error('Cuenta indicada no coincide con la identidad de Wrangler')
  const endpoint='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/'+WORKER+'/settings'
  const settings=await bodyJson(await checkedFetch(endpoint,headers))
  assert(Array.isArray(settings.bindings),'Cloudflare settings sin bindings')
  assert.equal(originFrom(settings.bindings,'APP_PAGES_ORIGIN'),ORIGINAL,'La configuración remota no coincide con Worker activo')
  assert.equal(originFrom(settings.bindings,'WEB_PAGES_ORIGIN'),ORIGINAL_WEB,'WEB_PAGES_ORIGIN remoto no coincide')
  const fromVersion=new Map(vBindings.map(b=>[b.name,b.type]))
  const fromSettings=new Map(settings.bindings.map(b=>[b.name,b.type]))
  assert.equal(fromVersion.size,vBindings.length,'Binding duplicado en versión')
  assert.equal(fromSettings.size,settings.bindings.length,'Binding duplicado en settings')
  assert.deepEqual([...fromSettings].sort(),[...fromVersion].sort(),'Settings y versión activa tienen bindings distintos')
  const dir=mkdtempSync(join(homedir(),'intap-release-logs/kawvo-g1-app-cutover-preflight-'))
  // Do not write credentials or plaintext binding values to disk.
  const report={
    action:'read-only; no cloud mutations',
    app_preview_worker:WORKER,
    active_version:EXPECTED_VERSION,
    app_origin_before:ORIGINAL,
    web_origin_unchanged:ORIGINAL_WEB,
    app_origin_candidate:STAGED,
    active_entry:liveEntry,
    candidate_entry:stageEntry,
    active_sha256:sha(liveJs),
    candidate_sha256:sha(stageJs),
    candidate_commit:EXPECTED_COMMIT,
    remote_binding_names_types:[...fromSettings].sort(),
    same_bindings_as_active_version:true,
    rollout_authorized:false,
    notes:['GET-only Cloudflare settings inspection; no PATCH or upload.','No data or secrets exported.','Activation must inherit every binding from exact deployed Worker version.','No deploy from stale api/wrangler.preview.toml.']
  }
  writeFileSync(join(dir,'report.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600})
  console.log('PASS: Worker live, Pages activo y Pages candidato coinciden con baseline.')
  console.log('PASS: Cloudflare API settings coincide en '+fromSettings.size+' binding(s) con versión activa.')
  console.log('APP ORIGEN ACTUAL: '+ORIGINAL)
  console.log('APP CANDIDATO: '+STAGED)
  console.log('COMMIT: '+EXPECTED_COMMIT)
  console.log('REPORTE: '+dir+'/report.json')
  console.log('NO SE HA CAMBIADO PREVIEW. Activación de Worker permanece bloqueada hasta procedimiento verificado.')
}catch(e){fail((e && e.name === 'AssertionError') ? e.message : 'Preflight no completado; no hubo cambios. Revise entorno de cuenta/autenticación, sin compartir tokens ni archivos de sesión.')}
