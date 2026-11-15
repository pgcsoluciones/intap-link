#!/usr/bin/env bash
# G2.5 — App-only session exit, cumulative QA and read-only preflight or explicitly approved Preview release, guarded by prior immutable G2.4 deployment.
# One mutation ONLY: wrangler pages deploy for the audited existing alias branch.
# NEVER wrangler deploy/rollback Worker, patch bindings, change OAuth/DB/R2, or touch production.
set -euo pipefail
PREFLIGHT_ONLY="${KAWVO_G2_5_PREFLIGHT_ONLY:-SI}"
[[ "$PREFLIGHT_ONLY" == SI || "$PREFLIGHT_ONLY" == NO ]] || { echo "BLOCKED: modo inválido"; exit 1; }
if [[ "$PREFLIGHT_ONLY" == NO ]]; then
 [[ "${KAWVO_G2_5_PAGES_APPROVED:-}" == SI ]] || { echo "BLOCKED: falta autorización G2.5 Pages"; exit 1; }
fi
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawvo-g2-free-session-exit-2026-11-15"
BASE="0760f72e093866d488cc73e92ab99b57ca56aadb"
WORKER="intap-api-preview"
WORKER_VERSION="23405a5b-e9ca-4247-843d-28cc4f236eaa"
APP="https://app.preview.intaprd.com"
ALIAS="https://qa-kawmed-guest-current-2026.intap-web2.pages.dev"
WEB="https://qa-sponsor-scan-1104.intap-link.pages.dev"
PAGES_BRANCH="qa-kawmed-guest-current-2026-11-02"
STAGE_BRANCH="qa-kawvo-g2-5-session-1115"
PRIOR_LOG="$HOME/intap-release-logs/kawvo-g2-4-pages-A6GfUYz0/app-publish.log"
fail(){ echo "BLOCKED: $*" >&2; exit 1; }
cd "$ROOT" || fail "Checkout local no disponible"
[[ "$(git branch --show-current)" == "$BRANCH" ]] || fail "Rama equivocada"
[[ -z "$(git status --porcelain)" ]] || fail "Cambios sin guardar"
git fetch github "$BRANCH" || fail "GitHub no disponible"
[[ "$(git rev-parse HEAD)" == "$(git rev-parse "github/$BRANCH")" ]] || fail "HEAD distinto del aprobado en GitHub"
git merge-base --is-ancestor "$BASE" HEAD || fail "G2.5 no desciende del G2.4 publicado"
git diff --check "$BASE" HEAD || fail "Diff inválido"
git diff --quiet "$BASE" HEAD -- api/ web/ shared/ app/src/App.tsx app/src/components/admin/AdminGuard.tsx app/src/components/admin/free/FreeDashboard.tsx app/src/components/appointments/ app/src/components/admin/medical/ app/src/components/admin/sponsored/ package.json package-lock.json || fail "Superficie protegida modificada"
EXPECTED="$(printf '%s\n' \
 app/src/components/admin/free/FreeShellSessionExit.tsx \
 app/src/components/admin/free/KawvoFreeShellPreview.tsx \
 scripts/test-kawvo-g2-free-session-exit-contract-2026-11-15.mjs \
 scripts/run-kawvo-g2-5-free-session-exit-2026-11-15.sh \
 docs/architecture/KAWVO_G2_5_FREE_SESSION_EXIT_HANDOFF_2026-11-15.md | LC_ALL=C sort)"
ACTUAL="$(git diff --name-only "$BASE" HEAD | LC_ALL=C sort)"
[[ "$ACTUAL" == "$EXPECTED" ]] || { printf 'Esperados:\n%s\nActuales:\n%s\n' "$EXPECTED" "$ACTUAL"; fail "Allowlist G2.5"; }
git diff --quiet 8e7b95e26c7ed4561d6c7d459327259d9ac7edfe "$BASE" -- app/ web/ shared/ functions/ package.json package-lock.json || fail "Base técnica G2.4 distinta de fuente publicada"
# All independent tests must execute. The previous audit does not publish.
ERRORS=0
bash -n scripts/run-kawvo-g2-5-free-session-exit-2026-11-15.sh || ERRORS=1
node scripts/audit-kawvo-g2-4-all-contracts-2026-11-15.mjs || ERRORS=1
node scripts/test-kawvo-g2-free-session-exit-contract-2026-11-15.mjs || ERRORS=1
[[ "$ERRORS" == 0 ]] || fail "Auditoría acumulativa: revisar todos los fallos anteriores"
[[ -s "$PRIOR_LOG" ]] || fail "Falta evidencia inmutable G2.4 en el log del despliegue anterior"
OLD_DEPLOY="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$PRIOR_LOG" | tail -1 || true)"
[[ -n "$OLD_DEPLOY" ]] || fail "Log anterior no contiene URL Pages inmutable verificable. NO publicar"
mkdir -p "$HOME/intap-release-logs"
LOG="$(mktemp -d "$HOME/intap-release-logs/kawvo-g2-5-pages-XXXXXXXX")" || fail "No se pudo crear log"
echo "LOG: $LOG"
echo "$OLD_DEPLOY" > "$LOG/g2-4-rollback-origin.txt"
[[ -d node_modules ]] || fail "Faltan dependencias locales; ejecutar npm ci"
npm run app:build:preview > "$LOG/build.txt" 2>&1 || { tail -60 "$LOG/build.txt"; fail "Build App Preview"; }
[[ -f app/dist/index.html && -z "$(git status --porcelain)" ]] || fail "Build no generó artefacto limpio"
asset(){ grep -Eo '/assets/index-[A-Za-z0-9_-]+\.js' "$1" | head -1; }
NEW_JS="$(asset app/dist/index.html)"
[[ -n "$NEW_JS" && -f "app/dist$NEW_JS" ]] || fail "Falta JS candidato"

# Read-only Pages owner and Worker binding preflight.
node scripts/audit-kawvo-g1-pages-alias-ownership-readonly-2026-11-13.mjs > "$LOG/pages-audit.txt" 2>&1 || { tail -25 "$LOG/pages-audit.txt"; fail "Auditoría read-only Pages"; }
AUDIT="$(sed -n 's/^REPORTE: //p' "$LOG/pages-audit.txt" | tail -1)"
[[ -n "$AUDIT" && -f "$AUDIT" ]] || fail "Sin reporte de Pages"
node - "$AUDIT" "$PAGES_BRANCH" "$ALIAS" <<'NODE' || fail "Rama propietaria del alias cambió"
const fs=require('fs'),[f,branch,alias]=process.argv.slice(2)
const e=JSON.parse(fs.readFileSync(f,'utf8')).found?.origen_del_worker
if(!e||e.branch!==branch||e.environment!=='preview'||!e.aliases?.includes(alias))throw Error('No coincide alias/branch de App Preview')
console.log('PASS: rama exacta Pages y alias verificados')
NODE
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
curl -fsSL --connect-timeout 10 --max-time 35 "$OLD_DEPLOY/admin/login" -o "$LOG/previous-immutable.html" || fail "G2.4 inmutable inaccesible"
OLD_JS="$(asset "$LOG/live-before.html")"
[[ -n "$OLD_JS" && "$(asset "$LOG/alias-before.html")" == "$OLD_JS" && "$(asset "$LOG/previous-immutable.html")" == "$OLD_JS" ]] || fail "Preview activo ya no corresponde al G2.4 publicado"
curl -fsSL --connect-timeout 10 --max-time 60 "$APP$OLD_JS" -o "$LOG/live-before.js" || fail "No se puede copiar JS activo"
curl -fsSL --connect-timeout 10 --max-time 60 "$OLD_DEPLOY$OLD_JS" -o "$LOG/previous-immutable.js" || fail "No se puede recuperar JS G2.4"
cmp -s "$LOG/live-before.js" "$LOG/previous-immutable.js" || fail "JS activo no coincide byte a byte con G2.4 inmutable"
printf '%s\n' "$OLD_DEPLOY" "$OLD_JS" > "$LOG/recovery-g2-4.txt"
echo "PASS: G2.4 activo y respaldado por origen inmutable comprobado"

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
check_web before
if [[ "$PREFLIGHT_ONLY" == SI ]]; then
 echo "PASS G2.5 PREFLIGHT: contratos, App build, respaldo App G2.4, Web G2.4 y Worker verificados"
 echo "SIN DEPLOY NI STAGE. LOG: $LOG"
 exit 0
fi
[[ "${KAWVO_G2_5_PAGES_APPROVED:-}" == SI ]] || fail "Publicación sin autorización"
# Reuse only the specific isolated Stage already uploaded for this candidate.
# Default remains a new isolated stage; never infer a reusable stage from HTTP 200.
COMMIT="$(git rev-parse HEAD)"
REUSE_STAGE="${KAWVO_G2_5_REUSE_STAGE:-NO}"
[[ "$REUSE_STAGE" == SI || "$REUSE_STAGE" == NO ]] || fail "Modo reutilización Stage inválido"
if [[ "$REUSE_STAGE" == SI ]]; then
  STAGED_COMMIT="a8974afc3d913d33903f815c079f6dd2acc85283"
  git cat-file -e "$STAGED_COMMIT^{commit}" || fail "Commit Stage previo no disponible"
  git diff --quiet "$STAGED_COMMIT" HEAD -- . ':(exclude)scripts/**' ':(exclude)docs/**' || fail "El código candidato cambió después del Stage; no reutilizar"
  EXISTING_STAGE_LOG="$HOME/intap-release-logs/kawvo-g2-5-pages-lYm3H6w1/stage.log"
  [[ -s "$EXISTING_STAGE_LOG" ]] || fail "Falta evidencia del Stage previo"
  grep -Fq "https://qa-kawvo-g2-5-session-1115.intap-web2.pages.dev" "$EXISTING_STAGE_LOG" || fail "Alias Stage previo no confirmado"
  STAGE="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$EXISTING_STAGE_LOG" | tail -1 || true)"
  [[ "$STAGE" == "https://fa6fde1d.intap-web2.pages.dev" ]] || fail "URL Stage previo no coincide con evidencia"
  cp "$EXISTING_STAGE_LOG" "$LOG/stage.log"
  echo "INFO: reutilizando Stage G2.5 ya publicado, sin nuevo upload"
else
  npx --no-install wrangler pages deploy app/dist --project-name intap-web2 --branch "$STAGE_BRANCH" --commit-hash "$COMMIT" > "$LOG/stage.log" 2>&1 || { tail -35 "$LOG/stage.log"; fail "Stage Pages"; }
  STAGE="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$LOG/stage.log" | tail -1 || true)"
fi
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
# Check its branch alias serves the same candidate, not a different deployment.
curl -fsSL --connect-timeout 10 --max-time 35 "https://qa-kawvo-g2-5-session-1115.intap-web2.pages.dev/admin/login" -o "$LOG/stage-alias.html" || fail "Alias Stage inaccesible"
[[ "$(asset "$LOG/stage-alias.html")" == "$NEW_JS" ]] || fail "Alias Stage distinto al candidato"
curl -fsSL --connect-timeout 10 --max-time 35 "$APP/admin/login" -o "$LOG/live-mid.html" || fail "App Preview cambió durante Stage"
[[ "$(asset "$LOG/live-mid.html")" == "$OLD_JS" ]] || fail "Preview cambió durante Stage; NO publicar"
curl -fsSL --connect-timeout 10 --max-time 35 "$ALIAS/admin/login" -o "$LOG/alias-mid.html" || fail "Alias App activo inaccesible"
[[ "$(asset "$LOG/alias-mid.html")" == "$OLD_JS" ]] || fail "Alias App cambió; NO publicar"
check_web mid
echo "PASS: G2.5 Stage idéntico al build, G2.4 activo intacto"

# Sole deliberate mutation: App Pages branch already owned by Worker origin.
echo "Publicando SOLO App Pages Preview (sin Worker)..."
npx --no-install wrangler pages deploy app/dist --project-name intap-web2 --branch "$PAGES_BRANCH" --commit-hash "$COMMIT" > "$LOG/publish.log" 2>&1 || { tail -45 "$LOG/publish.log"; fail "Publicación App Pages"; }
grep -Fq "$ALIAS" "$LOG/publish.log" || { tail -25 "$LOG/publish.log"; fail "No confirmó alias; NO repetir despliegue"; }
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
[[ "$OK" == 1 ]] || fail "App Preview no sirve el JS esperado. NO repetir a ciegas; revisar recovery-g2-4.txt"
check_web after
echo "PASS G2.5 APP PREVIEW: bundle publicado idéntico al build, Worker original al 100%"
echo "Sin cambios API/Worker/OAuth/D1/R2/Web/Producción"
echo "PENDIENTE: QA autenticada de cerrar sesión escritorio/móvil, volver a Demos Free y regresión de navegación"
echo "QA: $APP/admin/free/shell-preview?kawvo_shell=1"
echo "LOG: $LOG"
