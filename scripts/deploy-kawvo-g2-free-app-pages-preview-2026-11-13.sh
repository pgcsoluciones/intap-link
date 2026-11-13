#!/usr/bin/env bash
# G2.1: publish ONLY App Pages Preview via audited historical alias.
# NEVER wrangler deploy/rollback a Worker, change APP_PAGES_ORIGIN, OAuth or data.
set -euo pipefail
[[ "${KAWVO_G2_PAGES_APPROVED:-}" == "SI" ]] || { echo "BLOCKED: KAWVO_G2_PAGES_APPROVED=SI requerido"; exit 1; }
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawvo-g2-free-direct-access-2026-11-13"
G1_BASE="b7861f9da35ade3cdd7864184a30e79fd5bcf163"
G2_APPROVED="56297ee469e303650768831e6d6cb38b15b1477f"
WORKER="intap-api-preview"
WORKER_VERSION="23405a5b-e9ca-4247-843d-28cc4f236eaa"
APP="https://app.preview.intaprd.com"
ALIAS="https://qa-kawmed-guest-current-2026.intap-web2.pages.dev"
G1_IMMUTABLE="https://d1451e86.intap-web2.pages.dev"
PAGES_BRANCH="qa-kawmed-guest-current-2026-11-02"
QA_BRANCH="qa-kawvo-g2-free-1113"
WEB="https://qa-sponsor-scan-1104.intap-link.pages.dev"
fail(){ echo "BLOCKED: $*" >&2; exit 1; }
cd "$ROOT" || fail "Checkout no disponible"
[[ "$(git branch --show-current)" == "$BRANCH" ]] || fail "Rama incorrecta"
[[ -z "$(git status --porcelain)" ]] || fail "Hay cambios locales"
git fetch github "$BRANCH" || fail "No se pudo verificar GitHub"
[[ "$(git rev-parse HEAD)" == "$(git rev-parse "github/$BRANCH")" ]] || fail "HEAD no coincide con GitHub; ejecutar pull --ff-only primero"
git merge-base --is-ancestor "$G2_APPROVED" HEAD || fail "No contiene el G2.1 aprobado"
git merge-base --is-ancestor "$G1_BASE" HEAD || fail "No desciende de G1"
git diff --check "$G1_BASE" HEAD || fail "Diff inválido"
EXPECTED_APP="$(printf '%s\n' app/src/components/admin/free/FreeAppointments.tsx app/src/components/admin/free/FreePanelUi.tsx app/src/components/admin/free/KawvoFreeShellPreview.tsx | LC_ALL=C sort)"
ACTUAL_APP="$(git diff --name-only "$G1_BASE" HEAD -- app/ | LC_ALL=C sort)"
[[ "$ACTUAL_APP" == "$EXPECTED_APP" ]] || fail "App contiene cambios fuera de los 3 archivos G2"
git diff --quiet "$G1_BASE" HEAD -- api/ web/ app/src/App.tsx app/src/components/admin/AdminGuard.tsx app/src/components/admin/medical/ app/src/components/admin/sponsored/ app/src/components/admin/free/FreeDashboard.tsx package.json package-lock.json || fail "Superficie protegida modificada"
node scripts/test-kawvo-free-shell-preview-isolation-2026-11-12.mjs || fail "Contrato G1 aislamiento"
node scripts/test-kawvo-free-shell-desktop-parity-2026-11-12.mjs || fail "Contrato G1 UI"
node scripts/test-intapcard-active-account-contract.mjs || fail "Contrato multicuenta"
node scripts/test-kawvo-g2-free-direct-access-contract-2026-11-13.mjs || fail "Contrato G2"
node scripts/test-kawmed-demo-invitations-contract.mjs || fail "Contrato Kawmed invitaciones"
node scripts/test-kawmed-isolation-contract.mjs || fail "Contrato Kawmed aislamiento"
mkdir -p "$HOME/intap-release-logs"
LOG="$(mktemp -d "$HOME/intap-release-logs/kawvo-g2-pages-XXXXXXXX")" || fail "No se pudo crear log"
echo "LOG: $LOG"
npm run app:build:preview > "$LOG/build.txt" 2>&1 || { tail -60 "$LOG/build.txt"; fail "Build App Preview"; }
[[ -z "$(git status --porcelain)" ]] || fail "Build alteró archivos versionados"
[[ -f app/dist/index.html ]] || fail "Falta app/dist/index.html"
asset(){ grep -Eo '/assets/index-[A-Za-z0-9_-]+\.js' "$1" | head -1; }
JS="$(asset app/dist/index.html)"
[[ -n "$JS" && -f "app/dist$JS" ]] || fail "No hay JS candidato"

# Read-only alias-ownership audit discovers the current Pages deployment branch.
node scripts/audit-kawvo-g1-pages-alias-ownership-readonly-2026-11-13.mjs > "$LOG/alias-audit.txt" 2>&1 || { tail -25 "$LOG/alias-audit.txt"; fail "Auditoría de Pages/Worker"; }
AUDIT_REPORT="$(sed -n 's/^REPORTE: //p' "$LOG/alias-audit.txt" | tail -1)"
[[ -n "$AUDIT_REPORT" && -f "$AUDIT_REPORT" ]] || fail "Auditoría no generó reporte"
node - "$AUDIT_REPORT" "$PAGES_BRANCH" "$ALIAS" <<'NODE' || fail "Alias Pages pertenece a otra rama; no publicar"
const fs=require('fs'),[f,branch,alias]=process.argv.slice(2);
const x=JSON.parse(fs.readFileSync(f,'utf8'));
const entry=x.found?.origen_del_worker;
if(!entry||entry.branch!==branch||!entry.aliases?.includes(alias)||entry.environment!=='preview')throw Error('Ownership de Pages no confirmado');
console.log('PASS: alias Pages Preview coincide con la rama real');
NODE
npx --no-install wrangler deployments status --name "$WORKER" --json > "$LOG/worker-before.json" 2> "$LOG/worker-before.err" || fail "No se pudo leer Worker"
npx --no-install wrangler versions view "$WORKER_VERSION" --name "$WORKER" --json > "$LOG/worker-version.json" 2> "$LOG/worker-version.err" || fail "No se pudo leer versión Worker"
node - "$LOG/worker-before.json" "$LOG/worker-version.json" "$WORKER_VERSION" "$ALIAS" "$WEB" <<'NODE' || fail "Worker cambió; NO publicar"
const fs=require('fs'),[sf,vf,id,app,web]=process.argv.slice(2);
const s=JSON.parse(fs.readFileSync(sf,'utf8')),v=JSON.parse(fs.readFileSync(vf,'utf8'));
if(!Array.isArray(s.versions)||s.versions.length!==1||s.versions[0].version_id!==id||Number(s.versions[0].percentage)!==100)throw Error('Versión Worker inesperada');
const groups=[];
function walk(o){if(!o||typeof o!=='object')return;if(Array.isArray(o)){o.forEach(walk);return}if(Array.isArray(o.bindings))groups.push(o.bindings);Object.values(o).forEach(walk)}
walk(v);
const bs=groups.find(a=>a.some(x=>x.name==='APP_PAGES_ORIGIN'));
if(!bs||bs.length!==35||new Set(bs.map(x=>x.name)).size!==35)throw Error('Bindings Worker cambiaron');
for(const [k,val] of [['APP_PAGES_ORIGIN',app],['WEB_PAGES_ORIGIN',web]]){
 const a=bs.filter(x=>x.name===k&&x.type==='plain_text');
 if(a.length!==1||a[0].text!==val)throw Error('Origen '+k+' distinto');
}
for(const [k,t] of [['DB','d1'],['BUCKET','r2_bucket'],['GOOGLE_CLIENT_SECRET','secret_text']])
 if(!bs.some(x=>x.name===k&&x.type===t))throw Error('Falta binding '+k);
console.log('PASS: Worker y 35 bindings conservados');
NODE
curl -fsSL --connect-timeout 10 --max-time 35 "$APP/admin/login" -o "$LOG/domain-before.html" || fail "App Preview no responde"
curl -fsSL --connect-timeout 10 --max-time 35 "$ALIAS/admin/login" -o "$LOG/alias-before.html" || fail "Alias Pages no responde"
curl -fsSL --connect-timeout 10 --max-time 35 "$G1_IMMUTABLE/admin/login" -o "$LOG/g1-before.html" || fail "Snapshot inmutable de G1 no responde"
LIVE_JS="$(asset "$LOG/domain-before.html")"
[[ -n "$LIVE_JS" && "$(asset "$LOG/alias-before.html")" == "$LIVE_JS" && "$(asset "$LOG/g1-before.html")" == "$LIVE_JS" ]] || fail "Preview difiere del bundle G1 verificado; no reemplazar"
curl -fsSL --connect-timeout 10 --max-time 60 "$APP$LIVE_JS" -o "$LOG/domain-before.js" || fail "Bundle original inaccesible"
curl -fsSL --connect-timeout 10 --max-time 60 "$G1_IMMUTABLE$LIVE_JS" -o "$LOG/g1-before.js" || fail "Bundle G1 inaccesible"
cmp -s "$LOG/domain-before.js" "$LOG/g1-before.js" || fail "Bundle activo diverge del G1 inmutable"
printf '%s\n' "$G1_IMMUTABLE" "$LIVE_JS" > "$LOG/rollback-reference.txt"
echo "PASS: snapshot G1 verificado; reversible por reconstrucción/redeploy de G1, sin Worker"

# Stage only on a NEW QA branch; this must not move the active Preview alias.
COMMIT="$(git rev-parse HEAD)"
echo "STAGING QA aislado; sólo App Pages..."
npx --no-install wrangler pages deploy app/dist --project-name intap-web2 --branch "$QA_BRANCH" --commit-hash "$COMMIT" > "$LOG/stage.log" 2>&1 || { tail -35 "$LOG/stage.log"; fail "Stage Pages"; }
STAGE="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$LOG/stage.log" | tail -1 || true)"
[[ -n "$STAGE" ]] || fail "Sin URL inmutable de stage"
curl -fsSL --connect-timeout 10 --max-time 35 "$STAGE/admin/login" -o "$LOG/stage.html" || fail "Stage inmutable inaccesible"
[[ "$(asset "$LOG/stage.html")" == "$JS" ]] || fail "Stage no sirve el bundle G2"
curl -fsSL --connect-timeout 10 --max-time 60 "$STAGE$JS" -o "$LOG/stage.js" || fail "JS Stage inaccesible"
cmp -s "$LOG/stage.js" "app/dist$JS" || fail "JS Stage no coincide con build"
curl -fsSL --connect-timeout 10 --max-time 35 "$ALIAS/admin/login" -o "$LOG/alias-mid.html" || fail "Alias cambió durante Stage"
[[ "$(asset "$LOG/alias-mid.html")" == "$LIVE_JS" ]] || fail "Alias G1 cambió durante Stage; no publicar"
echo "PASS: Stage App G2 idéntico al build, dominio activo G1 intacto"

# One controlled mutation: the SAME Pages branch as verified by the ownership audit.
echo "PUBLICANDO únicamente App Pages Preview en la rama verificada..."
npx --no-install wrangler pages deploy app/dist --project-name intap-web2 --branch "$PAGES_BRANCH" --commit-hash "$COMMIT" > "$LOG/publish.log" 2>&1 || { tail -45 "$LOG/publish.log"; fail "Publicación App Pages Preview"; }
grep -Fq "$ALIAS" "$LOG/publish.log" || { tail -25 "$LOG/publish.log"; fail "No se confirmó alias esperado; no repetir a ciegas"; }
OK=0
for i in 1 2 3 4 5 6 7 8; do
  if curl -fsSL --connect-timeout 10 --max-time 35 "$APP/admin/free/shell-preview?kawvo_shell=1" -o "$LOG/served.html" \
    && [[ "$(asset "$LOG/served.html")" == "$JS" ]] \
    && curl -fsSL --connect-timeout 10 --max-time 60 "$APP$JS" -o "$LOG/served.js" \
    && cmp -s "$LOG/served.js" "app/dist$JS"; then OK=1; break; fi
  sleep 3
done
npx --no-install wrangler deployments status --name "$WORKER" --json > "$LOG/worker-after.json" 2> "$LOG/worker-after.err" || fail "No se pudo verificar Worker tras Pages"
node - "$LOG/worker-after.json" "$WORKER_VERSION" <<'NODE' || fail "Worker cambió inesperadamente; investigación manual"
const fs=require('fs'),[f,id]=process.argv.slice(2),x=JSON.parse(fs.readFileSync(f,'utf8'));
if(!Array.isArray(x.versions)||x.versions.length!==1||x.versions[0].version_id!==id||Number(x.versions[0].percentage)!==100)throw Error('Worker cambiado');
NODE
[[ "$OK" == 1 ]] || fail "Pages se publicó, pero App Preview no sirve G2; revisar logs y rollback-reference.txt sin repetir deploy"
echo "PASS: APP PAGES PREVIEW G2.1 sirve JS idéntico al build G2"
echo "PASS: Worker Preview original intacto al 100%"
echo "NO SE CAMBIARON API/Worker, OAuth, D1/R2, Web ni Producción"
echo "PENDIENTE: QA autenticada manual de roles, regreso, publicación, Agenda y móvil"
echo "QA: $APP/admin/free/shell-preview?kawvo_shell=1"
echo "LOG: $LOG"
