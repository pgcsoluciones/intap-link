#!/usr/bin/env bash
# G2.2 — Pages-only Preview cutover, guarded by prior immutable G2.1 deployment.
# One mutation ONLY: wrangler pages deploy for the audited existing alias branch.
# NEVER wrangler deploy/rollback Worker, patch bindings, change OAuth/DB/R2, or touch production.
set -euo pipefail
[[ "${KAWVO_G2_2_PAGES_APPROVED:-}" == "SI" ]] || { echo "BLOCKED: falta KAWVO_G2_2_PAGES_APPROVED=SI"; exit 1; }
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawvo-g2-free-return-list-2026-11-13"
G2_1_BASE="690c56d7fcab95f89e964844da5be8567065141c"
WORKER="intap-api-preview"
WORKER_VERSION="23405a5b-e9ca-4247-843d-28cc4f236eaa"
APP="https://app.preview.intaprd.com"
ALIAS="https://qa-kawmed-guest-current-2026.intap-web2.pages.dev"
WEB="https://qa-sponsor-scan-1104.intap-link.pages.dev"
PAGES_BRANCH="qa-kawmed-guest-current-2026-11-02"
STAGE_BRANCH="qa-kawvo-g2-2-return-menu-1113"
PRIOR_LOG="$HOME/intap-release-logs/kawvo-g2-pages-wEFuXIXO/publish.log"
fail(){ echo "BLOCKED: $*" >&2; exit 1; }
cd "$ROOT" || fail "Checkout local no disponible"
[[ "$(git branch --show-current)" == "$BRANCH" ]] || fail "Rama equivocada"
[[ -z "$(git status --porcelain)" ]] || fail "Cambios sin guardar"
git fetch github "$BRANCH" || fail "GitHub no disponible"
[[ "$(git rev-parse HEAD)" == "$(git rev-parse "github/$BRANCH")" ]] || fail "HEAD distinto del aprobado en GitHub"
git merge-base --is-ancestor "$G2_1_BASE" HEAD || fail "G2.2 no desciende de G2.1"
git diff --check "$G2_1_BASE" HEAD || fail "Diff inválido"
git diff --quiet "$G2_1_BASE" HEAD -- api/ web/ shared/ app/src/App.tsx app/src/components/admin/AdminGuard.tsx app/src/components/admin/free/FreeDashboard.tsx app/src/components/appointments/ app/src/components/admin/medical/ app/src/components/admin/sponsored/ package.json package-lock.json || fail "Superficie protegida modificada"
EXPECTED_APP="$(printf '%s\n' \
 app/src/components/admin/free/KawvoFreeShellPreview.tsx \
 app/src/components/admin/free/KawvoShellReturn.ts \
 app/src/components/admin/shared/KawvoPagedList.tsx \
 app/src/components/admin/free/FreePanelUi.tsx \
 app/src/components/admin/free/FreeVisualEditor.tsx \
 app/src/components/admin/free/FreeAppointments.tsx \
 app/src/components/admin/free/FreeAccount.tsx \
 app/src/components/admin/free/FreeNotifications.tsx | LC_ALL=C sort)"
ACTUAL_APP="$(git diff --name-only "$G2_1_BASE" HEAD -- app/ | LC_ALL=C sort)"
[[ "$ACTUAL_APP" == "$EXPECTED_APP" ]] || fail "App difiere de los ocho archivos auditados"
node scripts/test-kawvo-free-shell-preview-isolation-2026-11-12.mjs || fail "Contrato G1"
node scripts/test-kawvo-free-shell-desktop-parity-2026-11-12.mjs || fail "Contrato desktop G1"
node scripts/test-intapcard-active-account-contract.mjs || fail "Contrato multicuenta"
node scripts/test-kawvo-g2-free-direct-access-contract-2026-11-13.mjs || fail "Contrato G2.1"
node scripts/test-kawvo-g2-free-return-list-contract-2026-11-13.mjs || fail "Contrato G2.2"
node scripts/test-kawmed-demo-invitations-contract.mjs || fail "Contrato invitaciones Kawmed"
node scripts/test-kawmed-isolation-contract.mjs || fail "Contrato aislamiento médico"
[[ -s "$PRIOR_LOG" ]] || fail "Falta evidencia inmutable G2.1 en el log del despliegue anterior"
OLD_DEPLOY="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$PRIOR_LOG" | tail -1 || true)"
[[ -n "$OLD_DEPLOY" ]] || fail "Log anterior no contiene URL Pages inmutable verificable. NO publicar"
mkdir -p "$HOME/intap-release-logs"
LOG="$(mktemp -d "$HOME/intap-release-logs/kawvo-g2-2-pages-XXXXXXXX")" || fail "No se pudo crear log"
echo "LOG: $LOG"
echo "$OLD_DEPLOY" > "$LOG/g2-1-rollback-origin.txt"
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
curl -fsSL --connect-timeout 10 --max-time 35 "$OLD_DEPLOY/admin/login" -o "$LOG/old-immutable.html" || fail "G2.1 inmutable inaccesible"
OLD_JS="$(asset "$LOG/live-before.html")"
[[ -n "$OLD_JS" && "$(asset "$LOG/alias-before.html")" == "$OLD_JS" && "$(asset "$LOG/old-immutable.html")" == "$OLD_JS" ]] || fail "Preview activo ya no corresponde a G2.1"
curl -fsSL --connect-timeout 10 --max-time 60 "$APP$OLD_JS" -o "$LOG/live-before.js" || fail "No se puede copiar JS activo"
curl -fsSL --connect-timeout 10 --max-time 60 "$OLD_DEPLOY$OLD_JS" -o "$LOG/old-immutable.js" || fail "No se puede recuperar JS G2.1"
cmp -s "$LOG/live-before.js" "$LOG/old-immutable.js" || fail "JS activo no coincide byte a byte con G2.1 inmutable"
printf '%s\n' "$OLD_DEPLOY" "$OLD_JS" > "$LOG/recovery-g2-1.txt"
echo "PASS: G2.1 activo y respaldado por origen inmutable comprobado"

# Stage G2.2 in a separate Pages branch; NO active alias switch yet.
COMMIT="$(git rev-parse HEAD)"
npx --no-install wrangler pages deploy app/dist --project-name intap-web2 --branch "$STAGE_BRANCH" --commit-hash "$COMMIT" > "$LOG/stage.log" 2>&1 || { tail -35 "$LOG/stage.log"; fail "Stage Pages"; }
STAGE="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$LOG/stage.log" | tail -1 || true)"
[[ -n "$STAGE" ]] || fail "No se obtuvo URL inmutable de Stage"
curl -fsSL --connect-timeout 10 --max-time 35 "$STAGE/admin/login" -o "$LOG/stage.html" || fail "Stage no responde"
[[ "$(asset "$LOG/stage.html")" == "$NEW_JS" ]] || fail "Stage contiene JS diferente"
curl -fsSL --connect-timeout 10 --max-time 60 "$STAGE$NEW_JS" -o "$LOG/stage.js" || fail "JS Stage no disponible"
cmp -s "$LOG/stage.js" "app/dist$NEW_JS" || fail "Stage distinto del build local"
curl -fsSL --connect-timeout 10 --max-time 35 "$APP/admin/login" -o "$LOG/live-mid.html" || fail "App Preview cambió durante Stage"
[[ "$(asset "$LOG/live-mid.html")" == "$OLD_JS" ]] || fail "Preview cambió durante Stage; NO publicar"
echo "PASS: G2.2 Stage idéntico al build, G2.1 activo intacto"

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
[[ "$OK" == 1 ]] || fail "App Preview no sirve el JS esperado. NO repetir a ciegas; revisar recovery-g2-1.txt"
echo "PASS G2.2 APP PREVIEW: bundle publicado idéntico al build, Worker original al 100%"
echo "Sin cambios API/Worker/OAuth/D1/R2/Web/Producción"
echo "PENDIENTE: QA autenticada de pestañas, filtros, retorno, permisos y móvil"
echo "QA: $APP/admin/free/shell-preview?kawvo_shell=1"
echo "LOG: $LOG"
