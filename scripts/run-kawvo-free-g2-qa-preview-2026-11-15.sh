#!/usr/bin/env bash
# GLOBAL G2 — Four QA corrections; App Preview ONLY, stage first, preserve production.
# Only isolated App Pages stage and the audited existing App Preview alias may be deployed.
# NEVER wrangler deploy/rollback Worker, patch bindings, change OAuth/DB/R2, or touch production.
set -euo pipefail
PREFLIGHT_ONLY="${KAWVO_G2_QA_PREFLIGHT_ONLY:-SI}"
[[ "$PREFLIGHT_ONLY" == SI || "$PREFLIGHT_ONLY" == NO ]] || { echo "BLOCKED: modo inválido"; exit 1; }
if [[ "$PREFLIGHT_ONLY" == NO ]]; then
 [[ "${KAWVO_G2_QA_PAGES_APPROVED:-}" == SI ]] || { echo "BLOCKED: falta autorización G5 Preview"; exit 1; }
fi
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="fix/kawvo-free-g2-product-qa-2026-11-15"
CANDIDATE="c7b614af8628e5541b615d16e831085d47b5198a"
BASE="67cd49e224888dc19acefad933bfa0c7ddd6e9da"
APP_TREE="63f0e81a851f2988035d70fe56bc8424e955fbd7"
WORKER="intap-api-preview"
WORKER_VERSION="23405a5b-e9ca-4247-843d-28cc4f236eaa"
APP="https://app.preview.intaprd.com"
ALIAS="https://qa-kawmed-guest-current-2026.intap-web2.pages.dev"
WEB="https://qa-sponsor-scan-1104.intap-link.pages.dev"
PAGES_BRANCH="qa-kawmed-guest-current-2026-11-02"
STAGE_BRANCH="qa-kawvo-g5-3-free-1115"
OLD_DEPLOY="https://dbf7a9e4.intap-web2.pages.dev"
fail(){ echo "BLOCKED: $*" >&2; exit 1; }
cd "$ROOT" || fail "Checkout local no disponible"
[[ "$(git branch --show-current)" == "$BRANCH" ]] || fail "Rama equivocada"
[[ -z "$(git status --porcelain)" ]] || fail "Cambios sin guardar"
git fetch github main "$BRANCH" || fail "GitHub no disponible"
[[ "$(git rev-parse HEAD)" == "$CANDIDATE" && "$(git rev-parse "github/$BRANCH")" == "$CANDIDATE" ]] || fail "HEAD distinto del candidato exacto en GitHub"
[[ "$(git rev-parse github/main)" == "$BASE" ]] || fail "main cambió; detener"
git diff --check "$BASE" HEAD || fail "Diff inválido"
[[ "$(git rev-parse HEAD:app)" == "$APP_TREE" ]] || fail "App difiere del candidato G5 validado"
git diff --quiet "$BASE" HEAD -- api/ web/ shared/ package.json package-lock.json .github/ || fail "Superficie protegida modificada"
git diff --quiet "$BASE" HEAD -- api/ web/ shared/ functions/ package.json package-lock.json .github/ || fail "Superficie protegida modificada"
[[ "$(git rev-parse HEAD:functions)" == "034acf3d90ea40fe7262b39942d6a6e58c8c4ea1" ]] || fail "Functions históricas distintas"
EXPECTED_FILES="$(printf '%s\n' app/src/components/admin/free/FreeAgendaSummary.tsx app/src/components/admin/free/FreeAppointments.tsx app/src/components/admin/free/FreeDashboard.tsx app/src/components/admin/free/KawvoFreeShellPreview.tsx app/src/components/admin/free/freeAgendaSummaryData.ts app/src/components/appointments/AppointmentManager.tsx docs/architecture/KAWVO_FREE_G2_QA_CORRECTIONS_2026-11-15.md scripts/test-kawvo-free-g2-qa-corrections-2026-11-15.mjs | LC_ALL=C sort)"
[[ "$(git diff --name-only "$BASE" HEAD | LC_ALL=C sort)" == "$EXPECTED_FILES" ]] || fail "Allowlist exacta distinta"
[[ -d node_modules ]] || fail "Faltan dependencias locales; ejecutar npm ci"
node --check scripts/test-kawvo-free-g2-qa-corrections-2026-11-15.mjs
node scripts/test-kawvo-free-g2-qa-corrections-2026-11-15.mjs
node scripts/test-kawvo-g5-publication-navigation-2026-11-15.mjs
node scripts/test-intapcard-active-account-contract.mjs
node scripts/test-intapcard-multiaccount-contract.mjs
node scripts/test-intapcard-kawmed-integrated-contract.mjs
node scripts/test-kawmed-isolation-contract.mjs
echo "PASS: árbol App exacto, allowlist, regresiones G2/G5.2 y contrato Multicuenta"
mkdir -p "$HOME/intap-release-logs"
LOG="$(mktemp -d "$HOME/intap-release-logs/kawvo-g2-qa-preview-XXXXXXXX")" || fail "No se pudo crear log"
echo "LOG: $LOG"
echo "$OLD_DEPLOY" > "$LOG/g5-rollback-origin.txt"
[[ -d node_modules ]] || fail "Faltan dependencias locales; ejecutar npm ci"
npm run app:build > "$LOG/build-production.txt" 2>&1 || { tail -60 "$LOG/build-production.txt"; fail "Build candidato Producción G5.2"; }
PROD_JS="$(grep -Eo '/assets/index-[A-Za-z0-9_-]+\.js' app/dist/index.html | head -1)"
[[ -n "$PROD_JS" && -f "app/dist$PROD_JS" ]] || fail "Bundle productivo faltante"
node - "$PROD_JS" "$LOG/candidate-production.json" <<'NODE' || fail "Hash candidato Producción"
const fs=require('fs'),crypto=require('crypto'),[asset,report]=process.argv.slice(2)
const sha256=crypto.createHash('sha256').update(fs.readFileSync('app/dist'+asset)).digest('hex')
fs.writeFileSync(report,JSON.stringify({asset,sha256},null,2)+'\n')
console.log('PASS: build G5.2 Producción (no publicado) '+asset+' sha256='+sha256)
NODE
npm run app:build:preview > "$LOG/build.txt" 2>&1 || { tail -60 "$LOG/build.txt"; fail "Build App Preview"; }
[[ -f app/dist/index.html && -z "$(git status --porcelain)" ]] || fail "Build no generó artefacto limpio"
asset(){ grep -Eo '/assets/index-[A-Za-z0-9_-]+\.js' "$1" | head -1; }
NEW_JS="$(asset app/dist/index.html)"
[[ -n "$NEW_JS" && -f "app/dist$NEW_JS" ]] || fail "Falta JS candidato"

# Resolve actual Pages metadata; never infer an alias from a branch label.
check_owner(){
node --input-type=module - "$1" "$2" "$3" "$4" "$5" <<'NODE' || fail "No se pudo confirmar metadata Pages; NO publicar"
import {execFileSync} from 'node:child_process'
import {readFileSync,existsSync,writeFileSync} from 'node:fs'
import {homedir} from 'node:os'
import {join} from 'node:path'
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

const [stage,branch,commit,expectedAlias,report]=process.argv.slice(2)
try{
  const headers=existingCredentials(),account=existingAccount()
  const prefix='https://api.cloudflare.com/client/v4/accounts/'+account+'/pages/projects/intap-web2/deployments'
  const shortId=new URL(stage).hostname.split('.')[0]
  let matched=null
  for(let p=1;p<=25;p++){
    const {items,info}=await api(p===1?prefix:prefix+'?page='+p,headers)
    matched=items.find(d=>normal(d.url)===normal(stage)||String(d.short_id||'').toLowerCase()===shortId)
    if(matched)break
    if(!items.length||(Number.isInteger(info.total_pages)&&p>=info.total_pages))break
  }
  if(!matched)throw Error('Stage inmutable no encontrado en intap-web2')
  const meta=matched.deployment_trigger?.metadata||{}
  if(normal(matched.url)!==normal(stage)||matched.environment!=='preview'||meta.branch!==branch||meta.commit_hash!==commit||matched.latest_stage?.status!=='success')throw Error('Stage no coincide con URL, rama, commit o estado esperado')
  const aliases=[...new Set((Array.isArray(matched.aliases)?matched.aliases:[]).map(normal))]
  const candidates=aliases.filter(u=>/^https:\/\/[a-z0-9-]+\.intap-web2\.pages\.dev$/.test(u)&&u!==normal(stage)&&(expectedAlias==='stage'?u.startsWith('https://qa-kawvo-g5-'):u===normal(expectedAlias)))
  if(candidates.length!==1)throw Error('No existe un alias Stage único y seguro; aliases informados: '+aliases.filter(u=>/^https:\/\/[a-z0-9-]+\.intap-web2\.pages\.dev$/.test(u)).join(', '))
  writeFileSync(report,JSON.stringify({stage,branch,commit,environment:matched.environment,alias:candidates[0],status:matched.latest_stage.status},null,2)+'\n',{mode:0o600})
  console.log('PASS: Cloudflare confirma rama y alias real: '+candidates[0])
}catch(e){console.error(String(e.message||e).replace(/\b[a-f0-9]{32}\b/gi,'[cuenta]'));process.exit(1)}
NODE
}
check_owner "$OLD_DEPLOY" "$PAGES_BRANCH" 37a9a01a667251883818c66a2801b2f2e243cbbf "$ALIAS" "$LOG/active-owner.json"
npx --no-install wrangler deployments status --name "$WORKER" --json > "$LOG/worker-before.json" 2> "$LOG/worker-before.err" || fail "Worker no disponible"
npx --no-install wrangler versions view "$WORKER_VERSION" --name "$WORKER" --json > "$LOG/version-before.json" 2> "$LOG/version-before.err" || fail "Versión de Worker no disponible"
node - "$LOG/worker-before.json" "$LOG/version-before.json" "$WORKER_VERSION" "$ALIAS" "$WEB" <<'NODE' || fail "Worker/bindings cambiaron; NO publicar"
const fs=require('fs'),[sf,vf,id,app,web]=process.argv.slice(2),s=JSON.parse(fs.readFileSync(sf,'utf8')),v=JSON.parse(fs.readFileSync(vf,'utf8'))
if(!Array.isArray(s.versions)||s.versions.length!==1||s.versions[0].version_id!==id||Number(s.versions[0].percentage)!==100)throw Error('Worker incorrecto')
const groups=[]
function walk(o){if(!o||typeof o!=='object')return;if(Array.isArray(o)){o.forEach(walk);return}if(Array.isArray(o.bindings))groups.push(o.bindings);Object.values(o).forEach(walk)}
walk(v)
const bs=groups.find(a=>a.some(x=>x.name==='APP_PAGES_ORIGIN'))
if(!bs||bs.length!==35||new Set(bs.map(x=>x.name)).size!==35)throw Error('Bindings inesperados')
for(const [n,val] of [['APP_PAGES_ORIGIN',app],['WEB_PAGES_ORIGIN',web]]){const entries=bs.filter(x=>x.name===n&&x.type==='plain_text');if(entries.length!==1||entries[0].text!==val)throw Error(n+' no coincide')}
for(const [n,t] of [['DB','d1'],['BUCKET','r2_bucket'],['GOOGLE_CLIENT_SECRET','secret_text']])if(!bs.some(x=>x.name===n&&x.type===t))throw Error('Binding faltante '+n)
console.log('PASS: Worker original al 100%, 35 bindings y orígenes intactos')
NODE
curl -fsSL --connect-timeout 10 --max-time 35 "$APP/admin/login" -o "$LOG/live-before.html" || fail "Dominio App Preview inaccesible"
curl -fsSL --connect-timeout 10 --max-time 35 "$ALIAS/admin/login" -o "$LOG/alias-before.html" || fail "Alias de Pages inaccesible"
curl -fsSL --connect-timeout 10 --max-time 35 "$OLD_DEPLOY/admin/login" -o "$LOG/previous-immutable.html" || fail "G5 anterior inmutable inaccesible"
OLD_JS="$(asset "$LOG/live-before.html")"
[[ -n "$OLD_JS" && "$(asset "$LOG/alias-before.html")" == "$OLD_JS" && "$(asset "$LOG/previous-immutable.html")" == "$OLD_JS" ]] || fail "Preview activo ya no corresponde al G5 anterior publicado"
curl -fsSL --connect-timeout 10 --max-time 60 "$APP$OLD_JS" -o "$LOG/live-before.js" || fail "No se puede copiar JS activo"
curl -fsSL --connect-timeout 10 --max-time 60 "$OLD_DEPLOY$OLD_JS" -o "$LOG/previous-immutable.js" || fail "No se puede recuperar JS G5 anterior"
cmp -s "$LOG/live-before.js" "$LOG/previous-immutable.js" || fail "JS activo no coincide byte a byte con G5 anterior inmutable"
printf '%s\n' "$OLD_DEPLOY" "$OLD_JS" > "$LOG/recovery-g5.txt"
echo "PASS: G5 anterior activo y respaldado por origen inmutable comprobado"

# Web must remain the already published G2.4 bundle. No Web upload in this lot.
WEB_PRIOR="$HOME/intap-release-logs/kawvo-g2-4-pages-A6GfUYz0/web-publish.log"
[[ -s "$WEB_PRIOR" ]] || fail "Falta log Web G2.4"
OLD_WEB="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$WEB_PRIOR" | tail -1 || true)"
[[ -n "$OLD_WEB" ]] || fail "Falta Web G2.4 inmutable"
check_web(){
  curl -fsSL --connect-timeout 10 --max-time 35 "https://preview.intaprd.com" -o "$LOG/web-live-$1.html" || fail "Web Preview no responde"
  curl -fsSL --connect-timeout 10 --max-time 35 "$OLD_WEB" -o "$LOG/web-immutable-$1.html" || fail "Web G2.4 inmutable no responde"
  local js
  js="$(asset "$LOG/web-live-$1.html")"
  [[ -n "$js" && "$(asset "$LOG/web-immutable-$1.html")" == "$js" ]] || fail "Web G2.4 cambió"
  curl -fsSL --connect-timeout 10 --max-time 60 "https://preview.intaprd.com$js" -o "$LOG/web-live-$1.js" || fail "Bundle Web no disponible"
  curl -fsSL --connect-timeout 10 --max-time 60 "$OLD_WEB$js" -o "$LOG/web-immutable-$1.js" || fail "Bundle Web inmutable no disponible"
  cmp -s "$LOG/web-live-$1.js" "$LOG/web-immutable-$1.js" || fail "Web G2.4 distinto"
}
check_production(){
  local phase="$1"
  node --input-type=module - "$LOG" "$phase" <<'NODE' || fail "Producción no coincide con baseline; detener"
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {writeFileSync} from 'node:fs'
const [log,phase]=process.argv.slice(2)
const curl=u=>execFileSync('curl',['-fsSL','--connect-timeout','10','--max-time','75',u],{stdio:['ignore','pipe','pipe'],maxBuffer:64*1024*1024})
for(const [domain,route,origin,expected,hash] of [
 ['https://app.intaprd.com','/admin/login','https://812ddfc0.intap-web2.pages.dev','/assets/index-CUIxebii.js','ae39fc4fd0d41801f93cba116bdb0a69820c8458a98632ac883e1cded88ea2cb'],
 ['https://intaprd.com','/','https://1672b41a.intap-link.pages.dev','/assets/index-a1Ow7Cq4.js','36bd90be36587c28baadb12b3fc564ea2c5c837397c621f6300be37712ee4c3b']
]){
 for(const host of [domain,origin]){
  const asset=curl(host+route).toString('utf8').match(/\/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0]
  if(asset!==expected||createHash('sha256').update(curl(host+asset)).digest('hex')!==hash)throw Error('Bundle productivo cambió: '+host)
 }
}
for(const [name,id] of [['intap-api','3d4973e4-e344-493a-a065-93f199b00359'],['intap-api-preview','23405a5b-e9ca-4247-843d-28cc4f236eaa']]){
 const raw=execFileSync('npx',['--no-install','wrangler','deployments','status','--name',name,'--json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']})
 const versions=JSON.parse(raw).versions
 if(!Array.isArray(versions)||versions.length!==1||versions[0].version_id!==id||Number(versions[0].percentage)!==100)throw Error('Worker cambió: '+name)
}
writeFileSync(log+'/production-'+phase+'.txt','App/Web y ambos Workers coinciden con baseline G5\n')
console.log('PASS: Producción App/Web y ambos Workers intactos ('+phase+')')
NODE
}
check_web before
check_production before
if [[ "$PREFLIGHT_ONLY" == SI ]]; then
 echo "PASS G2 QA PREVIEW PREFLIGHT: contratos, App build, respaldo App G5 anterior, Web G2.4 y Worker verificados"
 echo "SIN DEPLOY NI STAGE. LOG: $LOG"
 exit 0
fi
[[ "${KAWVO_G2_QA_PAGES_APPROVED:-}" == SI ]] || fail "Publicación sin autorización"
# Only the new isolated stage branch is uploaded before the active alias.
COMMIT="$(git rev-parse HEAD)"
[[ "$COMMIT" == "$CANDIDATE" && "$(git ls-remote github refs/heads/main | cut -f1)" == "$BASE" && "$(git ls-remote github "refs/heads/$BRANCH" | cut -f1)" == "$CANDIDATE" ]] || fail "main/candidato cambiaron"
[[ "$(gh pr view 168 --repo pgcsoluciones/intap-link --json headRefOid --jq .headRefOid)" == "$CANDIDATE" ]] || fail "PR distinto"
gh pr checks 168 --repo pgcsoluciones/intap-link --required || fail "CI requerida no aprobada"
npx --no-install wrangler pages deploy app/dist --project-name intap-web2 --branch "$STAGE_BRANCH" --commit-hash "$COMMIT" --commit-dirty=false > "$LOG/stage.log" 2>&1 || { tail -35 "$LOG/stage.log"; fail "Stage Pages"; }
STAGE="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$LOG/stage.log" | tail -1 || true)"
[[ "$STAGE" =~ ^https://[0-9a-f]{8,}\.intap-web2\.pages\.dev$ ]] || fail "No se obtuvo URL inmutable de Stage"
# Pages can briefly return 404 immediately after a successful upload.
# A bounded retry never bypasses the exact candidate bundle validation.
STAGE_OK=0
for attempt in 1 2 3 4 5 6 7 8; do
  if curl -fsSL --connect-timeout 10 --max-time 35 "$STAGE/admin/login" -o "$LOG/stage.html"; then STAGE_OK=1; break; fi
  echo "INFO: Stage aún no disponible (intento $attempt/8)"
  [[ "$attempt" == 8 ]] || sleep 3
done
[[ "$STAGE_OK" == 1 ]] || fail "Stage no responde tras intentos acotados"
[[ "$(asset "$LOG/stage.html")" == "$NEW_JS" ]] || fail "Stage contiene JS diferente"
curl -fsSL --connect-timeout 10 --max-time 60 "$STAGE$NEW_JS" -o "$LOG/stage.js" || fail "JS Stage no disponible"
cmp -s "$LOG/stage.js" "app/dist$NEW_JS" || fail "Stage distinto del build local"
# Resolve actual Cloudflare alias, never construct it from the branch name.
# The existing immutable deployment, exact commit, Preview environment,
# branch and successful status must all agree.
STAGE_EXPECTED_COMMIT="$COMMIT"
check_owner "$STAGE" "$STAGE_BRANCH" "$STAGE_EXPECTED_COMMIT" stage "$LOG/stage-owner.json"
STAGE_ALIAS="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).alias)' "$LOG/stage-owner.json")"
[[ "$STAGE_ALIAS" =~ ^https://qa-kawvo-g5-[a-z0-9-]+\.intap-web2\.pages\.dev$ && "$STAGE_ALIAS" != "$ALIAS" ]] || fail "Alias Stage inválido"
STAGE_ALIAS_OK=0
for attempt in 1 2 3 4 5 6 7 8; do
  if curl -fsSL --connect-timeout 10 --max-time 35 "$STAGE_ALIAS/admin/login" -o "$LOG/stage-alias.html" \
    && [[ "$(asset "$LOG/stage-alias.html")" == "$NEW_JS" ]] \
    && curl -fsSL --connect-timeout 10 --max-time 60 "$STAGE_ALIAS$NEW_JS" -o "$LOG/stage-alias.js" \
    && cmp -s "$LOG/stage-alias.js" "app/dist$NEW_JS"; then STAGE_ALIAS_OK=1; break; fi
  echo "INFO: Alias real Stage aún no confirma el candidato (intento $attempt/8)"
  [[ "$attempt" == 8 ]] || sleep 3
done
[[ "$STAGE_ALIAS_OK" == 1 ]] || fail "Alias real Stage no confirma el candidato; NO publicar ni repetir upload"
curl -fsSL --connect-timeout 10 --max-time 35 "$APP/admin/login" -o "$LOG/live-mid.html" || fail "App Preview cambió durante Stage"
[[ "$(asset "$LOG/live-mid.html")" == "$OLD_JS" ]] || fail "Preview cambió durante Stage; NO publicar"
curl -fsSL --connect-timeout 10 --max-time 35 "$ALIAS/admin/login" -o "$LOG/alias-mid.html" || fail "Alias App activo inaccesible"
[[ "$(asset "$LOG/alias-mid.html")" == "$OLD_JS" ]] || fail "Alias App cambió; NO publicar"
check_web mid
check_production mid
echo "PASS: G5.2 Stage idéntico al build, G5 anterior activo intacto"

# Sole deliberate mutation: App Pages branch already owned by Worker origin.
echo "Publicando SOLO App Pages Preview (sin Worker)..."
npx --no-install wrangler pages deploy app/dist --project-name intap-web2 --branch "$PAGES_BRANCH" --commit-hash "$COMMIT" --commit-dirty=false > "$LOG/publish.log" 2>&1 || { tail -45 "$LOG/publish.log"; fail "Publicación App Pages"; }
PUBLISHED="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$LOG/publish.log" | tail -1 || true)"
[[ "$PUBLISHED" =~ ^https://[0-9a-f]{8,}\.intap-web2\.pages\.dev$ ]] || fail "No se identificó origen publicado; NO repetir despliegue"
check_owner "$PUBLISHED" "$PAGES_BRANCH" "$COMMIT" "$ALIAS" "$LOG/published-owner.json"
OK=0
for i in 1 2 3 4 5 6 7 8; do
 if curl -fsSL --connect-timeout 10 --max-time 35 "$APP/admin/free/shell-preview?kawvo_shell=1" -o "$LOG/served.html" \
   && [[ "$(asset "$LOG/served.html")" == "$NEW_JS" ]] \
   && curl -fsSL --connect-timeout 10 --max-time 60 "$APP$NEW_JS" -o "$LOG/served.js" \
   && cmp -s "$LOG/served.js" "app/dist$NEW_JS"; then OK=1; break; fi
 sleep 3
done
npx --no-install wrangler deployments status --name "$WORKER" --json > "$LOG/worker-after.json" 2> "$LOG/worker-after.err" || fail "No se pudo comprobar Worker después"
node - "$LOG/worker-after.json" "$WORKER_VERSION" <<'NODE' || fail "Worker cambió inesperadamente"
const fs=require('fs'),[f,id]=process.argv.slice(2),s=JSON.parse(fs.readFileSync(f,'utf8'))
if(!Array.isArray(s.versions)||s.versions.length!==1||s.versions[0].version_id!==id||Number(s.versions[0].percentage)!==100)throw Error('Worker no corresponde a baseline')
NODE
[[ "$OK" == 1 ]] || fail "App Preview no sirve el JS esperado. NO repetir a ciegas; revisar recovery-g5.txt"
check_web after
check_production after
echo "PASS G2 QA APP PREVIEW: bundle publicado idéntico al build, Worker original al 100%"
echo "Sin cambios API/Worker/OAuth/D1/R2/Web/Producción"
echo "PENDIENTE: QA publicar/ocultar sin cambio de pestaña, retorno de módulos y vista previa desde Free"
echo "QA: $APP/admin/free"
echo "LOG: $LOG"
