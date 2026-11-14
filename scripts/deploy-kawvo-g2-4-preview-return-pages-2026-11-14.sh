#!/usr/bin/env bash
# G2.4: dual Pages-only Preview rollout. Both App and Web must move together;
# staging precedes either alias update. No Worker/vars/API/D1/R2/production writes.
set -euo pipefail
[[ "${KAWVO_G2_4_PAGES_APPROVED:-}" == "SI" ]] || { echo "BLOCKED: falta KAWVO_G2_4_PAGES_APPROVED=SI"; exit 1; }
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawvo-g2-free-preview-return-2026-11-14"
BASE="f1f998fba3a64514ff3113b3e58a87e80475259a"
WORKER="intap-api-preview"
WORKER_SHA="23405a5b-e9ca-4247-843d-28cc4f236eaa"
APP_ORIGIN="https://app.preview.intaprd.com"
APP_ALIAS="https://qa-kawmed-guest-current-2026.intap-web2.pages.dev"
APP_BRANCH="qa-kawmed-guest-current-2026-11-02"
WEB_ORIGIN="https://preview.intaprd.com"
WEB_ALIAS="https://qa-sponsor-scan-1104.intap-link.pages.dev"
PRIOR_APP_LOG="$HOME/intap-release-logs/kawvo-g2-3-pages-Cc1pY2uX/publish.log"
fail(){ echo "BLOCKED: $*" >&2; exit 1; }
cd "$ROOT" || fail "Checkout local no disponible"
[[ "$(git branch --show-current)" == "$BRANCH" ]] || fail "Rama local equivocada"
[[ -z "$(git status --porcelain)" ]] || fail "Hay cambios locales"
git fetch github "$BRANCH" || fail "No se pudo consultar GitHub"
[[ "$(git rev-parse HEAD)" == "$(git rev-parse "github/$BRANCH")" ]] || fail "HEAD divergente respecto a GitHub"
git merge-base --is-ancestor "$BASE" HEAD || fail "G2.4 no desciende del G2.3 publicado"
git diff --check "$BASE" HEAD || fail "Diff inválido"
git diff --quiet "$BASE" HEAD -- api/ shared/ app/src/App.tsx app/src/components/admin/AdminGuard.tsx app/src/components/admin/free/FreeDashboard.tsx app/src/components/admin/medical/ app/src/components/admin/sponsored/ web/src/components/medical-profile/ web/src/components/sponsored/ package.json package-lock.json || fail "Zona protegida cambiada"
APP_FILES="$(printf '%s\n' app/src/components/admin/free/KawvoFreeShellPreview.tsx app/src/free-preview-link-fallback.ts | LC_ALL=C sort)"
WEB_FILES="$(printf '%s\n' web/src/components/free-profile/freeShellPreviewReturn.ts web/src/components/free-profile/FreePreviewEditShortcut.tsx web/src/components/free-profile/IntapLinkGratisProfile.tsx web/src/components/appointments/AppointmentOwnerBar.tsx | LC_ALL=C sort)"
[[ "$APP_FILES" == "$(git diff --name-only "$BASE" HEAD -- app/ | LC_ALL=C sort)" ]] || fail "App contiene cambios inesperados"
[[ "$WEB_FILES" == "$(git diff --name-only "$BASE" HEAD -- web/ | LC_ALL=C sort)" ]] || fail "Web contiene cambios inesperados"

node scripts/test-kawvo-g2-free-preview-return-contract-2026-11-14.mjs || fail "Contrato G2.4"
node scripts/test-kawvo-g2-free-route-continuity-contract-2026-11-14.mjs || fail "Contrato G2.3"
node scripts/test-intapcard-active-account-contract.mjs || fail "Aislamiento cuentas"
node scripts/test-free-contact-agenda-contract.mjs || fail "Regresión Free/Agenda"
node scripts/test-sponsored-profile-contract.mjs || fail "Regresión patrocinador"
node scripts/test-kawmed-isolation-contract.mjs || fail "Regresión Kawmed"

[[ -s "$PRIOR_APP_LOG" ]] || fail "Falta log de Pages G2.3 anterior"
OLD_APP="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$PRIOR_APP_LOG" | tail -1 || true)"
[[ -n "$OLD_APP" ]] || fail "No se pudo recuperar snapshot inmutable G2.3"
mkdir -p "$HOME/intap-release-logs"
LOG="$(mktemp -d "$HOME/intap-release-logs/kawvo-g2-4-pages-XXXXXXXX")" || fail "No se pudo crear log"
echo "LOG: $LOG"
printf '%s\n' "$OLD_APP" > "$LOG/rollback-app-g2-3.txt"

npm run app:build:preview > "$LOG/build-app.log" 2>&1 || { tail -60 "$LOG/build-app.log"; fail "Build App"; }
npm run web:build:preview > "$LOG/build-web.log" 2>&1 || { tail -60 "$LOG/build-web.log"; fail "Build Web"; }
[[ -f app/dist/index.html && -f web/dist/index.html && -z "$(git status --porcelain)" ]] || fail "Build no generó artefactos limpios"
asset(){ grep -Eo '/assets/index-[A-Za-z0-9_-]+\.js' "$1" | head -1; }
NEW_APP_JS="$(asset app/dist/index.html)"
NEW_WEB_JS="$(asset web/dist/index.html)"
[[ -n "$NEW_APP_JS" && -f "app/dist$NEW_APP_JS" && -n "$NEW_WEB_JS" && -f "web/dist$NEW_WEB_JS" ]] || fail "No se identificaron JS App/Web"

# Exact App origin ownership and live Worker environment, all read-only.
node scripts/audit-kawvo-g1-pages-alias-ownership-readonly-2026-11-13.mjs > "$LOG/app-alias.txt" 2>&1 || { tail -22 "$LOG/app-alias.txt"; fail "Owner App no verificado"; }
APP_REPORT="$(sed -n 's/^REPORTE: //p' "$LOG/app-alias.txt" | tail -1)"
node - "$APP_REPORT" "$APP_ALIAS" "$APP_BRANCH" <<'NODE' || fail "Alias App ya no pertenece a rama verificada"
const fs=require('fs'),[f,alias,branch]=process.argv.slice(2);
if(!f||!fs.existsSync(f))throw Error('No existe reporte App');
const v=JSON.parse(fs.readFileSync(f,'utf8')).found?.origen_del_worker;
if(!v||v.environment!=='preview'||v.branch!==branch||!v.aliases?.includes(alias))throw Error('Alias/branch App diferente');
NODE

node scripts/audit-kawvo-g2-web-pages-alias-readonly-2026-11-14.mjs > "$LOG/web-alias.txt" 2>&1 || { tail -25 "$LOG/web-alias.txt"; fail "Owner Web no verificado"; }
WEB_REPORT="$(sed -n 's/^REPORTE: //p' "$LOG/web-alias.txt" | tail -1)"
[[ -n "$WEB_REPORT" && -f "$WEB_REPORT" ]] || fail "No existe reporte Web"
WEB_BRANCH="$(node - "$WEB_REPORT" "$WEB_ALIAS" <<'NODE'
const fs=require('fs'),[f,alias]=process.argv.slice(2);
const r=JSON.parse(fs.readFileSync(f,'utf8'));
if(r.operation!=='READ ONLY'||r.web_preview_alias!==alias||r.owner?.environment!=='preview'||!r.owner.branch)process.exit(2);
console.log(r.owner.branch);
NODE
)" || fail "Rama Web inválida"
OLD_WEB="$(node - "$WEB_REPORT" <<'NODE'
const fs=require('fs'),v=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
console.log(v.immutable_url||'');
NODE
)"
[[ "$OLD_WEB" =~ ^https://[0-9a-f]{8,}\.intap-link\.pages\.dev$ ]] || fail "URL inmutable Web inválida"
printf '%s\n' "$OLD_WEB" "$WEB_BRANCH" > "$LOG/rollback-web.txt"
echo "PASS: rama Web Preview realmente propietaria: $WEB_BRANCH"

# Critical: deploying Web from an older App-only feature branch must not regress
# the Web Preview already serving Sponsored/Medical. Compare its real source SHA
# with the G2.3 baseline before any stage, using read-only Git objects.
WEB_DEPLOY_SHA="$(node - "$WEB_REPORT" <<'NODE'
const fs=require('fs'),v=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
console.log(v.owner?.commit||'');
NODE
)"
[[ "$WEB_DEPLOY_SHA" =~ ^[0-9a-f]{40}$ ]] || fail "El deploy Web anterior no tiene SHA Git completo y verificable"
[[ "$WEB_BRANCH" =~ ^[A-Za-z0-9._/-]+$ ]] || fail "Rama Web Pages tiene nombre inválido"
# Cloudflare Pages retains the historical deployment branch label even after
# the branch is removed from GitHub. The Pages branch name is NOT a Git ref.
# Audit the exact commit recorded by the immutable Pages deployment instead.
if ! git cat-file -e "$WEB_DEPLOY_SHA^{commit}" 2>/dev/null; then
  echo "INFO: rama Web Pages histórica sin Git ref; intentando recuperar SOLO el SHA auditado en lectura..."
  git fetch --no-tags github "$WEB_DEPLOY_SHA" > "$LOG/web-source-fetch.log" 2>&1 || fail "El SHA Web previo no es recuperable desde GitHub. No publicar; consultar Web owner report y commit de origen"
fi
git cat-file -e "$WEB_DEPLOY_SHA^{commit}" 2>/dev/null || fail "SHA Web previo no corresponde a un commit Git real; no publicar"
git diff --quiet "$WEB_DEPLOY_SHA" "$BASE" -- web/ shared/ package.json package-lock.json || fail "Web Preview fuente anterior difiere del baseline G2.3. BLOQUEADO para evitar regresiones Kawmed/patrocinados"
echo "PASS: fuente Web del commit Pages cotejada con base G2.3, sin reemplazar cambios recientes"

npx --no-install wrangler deployments status --name "$WORKER" --json > "$LOG/worker-before.json" 2> "$LOG/worker-before.err" || fail "Worker Preview inaccesible"
npx --no-install wrangler versions view "$WORKER_SHA" --name "$WORKER" --json > "$LOG/worker-bindings.json" 2> "$LOG/worker-bindings.err" || fail "Bindings no disponibles"
node - "$LOG/worker-before.json" "$LOG/worker-bindings.json" "$WORKER_SHA" "$APP_ALIAS" "$WEB_ALIAS" <<'NODE' || fail "Worker/bindings cambiaron, NO publicar"
const fs=require('fs'),[sf,vf,id,app,web]=process.argv.slice(2);
const s=JSON.parse(fs.readFileSync(sf,'utf8')),v=JSON.parse(fs.readFileSync(vf,'utf8'));
if(!Array.isArray(s.versions)||s.versions.length!==1||s.versions[0].version_id!==id||Number(s.versions[0].percentage)!==100)throw Error('Worker diferente');
const groups=[];
function walk(x){if(!x||typeof x!=='object')return;if(Array.isArray(x)){x.forEach(walk);return}if(Array.isArray(x.bindings))groups.push(x.bindings);Object.values(x).forEach(walk)}
walk(v);
const bs=groups.find(x=>x.some(a=>a.name==='APP_PAGES_ORIGIN'));
if(!bs||bs.length!==35||new Set(bs.map(x=>x.name)).size!==35)throw Error('35 bindings no coinciden');
for(const [name,target] of [['APP_PAGES_ORIGIN',app],['WEB_PAGES_ORIGIN',web]]){
 const found=bs.filter(x=>x.name===name&&x.type==='plain_text');
 if(found.length!==1||found[0].text!==target)throw Error(name+' inesperado');
}
for(const [name,type] of [['DB','d1'],['BUCKET','r2_bucket'],['GOOGLE_CLIENT_SECRET','secret_text']])
 if(!bs.some(x=>x.name===name&&x.type===type))throw Error('Binding requerido ausente: '+name);
console.log('PASS: Worker original al 100%, 35 bindings, ambos aliases intactos');
NODE

curl -fsSL --connect-timeout 10 --max-time 35 "$APP_ORIGIN/admin/login" -o "$LOG/app-before.html" || fail "App Preview inaccesible"
curl -fsSL --connect-timeout 10 --max-time 35 "$APP_ALIAS/admin/login" -o "$LOG/app-alias-before.html" || fail "Alias App inaccesible"
curl -fsSL --connect-timeout 10 --max-time 35 "$OLD_APP/admin/login" -o "$LOG/app-g2-3-before.html" || fail "App G2.3 inmutable inaccesible"
OLD_APP_JS="$(asset "$LOG/app-before.html")"
[[ -n "$OLD_APP_JS" && "$(asset "$LOG/app-alias-before.html")" == "$OLD_APP_JS" && "$(asset "$LOG/app-g2-3-before.html")" == "$OLD_APP_JS" ]] || fail "App Preview ya no corresponde a G2.3"
curl -fsSL --connect-timeout 10 --max-time 60 "$APP_ORIGIN$OLD_APP_JS" -o "$LOG/app-before.js" || fail "JS App activo inaccesible"
curl -fsSL --connect-timeout 10 --max-time 60 "$OLD_APP$OLD_APP_JS" -o "$LOG/app-g2-3.js" || fail "JS G2.3 inaccesible"
cmp -s "$LOG/app-before.js" "$LOG/app-g2-3.js" || fail "App diverge del G2.3 inmutable"
echo "PASS: App G2.3 activo y verificado con inmutable"

curl -fsSL --connect-timeout 10 --max-time 35 "$WEB_ORIGIN" -o "$LOG/web-before.html" || fail "Web Preview inaccesible"
curl -fsSL --connect-timeout 10 --max-time 35 "$WEB_ALIAS" -o "$LOG/web-alias-before.html" || fail "Alias Web inaccesible"
curl -fsSL --connect-timeout 10 --max-time 35 "$OLD_WEB" -o "$LOG/web-immutable-before.html" || fail "Web inmutable inaccesible"
OLD_WEB_JS="$(asset "$LOG/web-before.html")"
[[ -n "$OLD_WEB_JS" && "$(asset "$LOG/web-alias-before.html")" == "$OLD_WEB_JS" && "$(asset "$LOG/web-immutable-before.html")" == "$OLD_WEB_JS" ]] || fail "Web Preview activo y Web inmutable no coinciden"
curl -fsSL --connect-timeout 10 --max-time 60 "$WEB_ORIGIN$OLD_WEB_JS" -o "$LOG/web-before.js" || fail "Bundle Web activo inaccesible"
curl -fsSL --connect-timeout 10 --max-time 60 "$OLD_WEB$OLD_WEB_JS" -o "$LOG/web-immutable.js" || fail "JS Web inmutable inaccesible"
cmp -s "$LOG/web-before.js" "$LOG/web-immutable.js" || fail "Web Preview diverge del inmutable"
echo "PASS: Web Preview activo y respaldado por Pages inmutable"

# Both stage deployments are isolated branch aliases and cannot move the active Worker origins.
COMMIT="$(git rev-parse HEAD)"
npx --no-install wrangler pages deploy web/dist --project-name intap-link --branch qa-kawvo-g2-4-web-1114 --commit-hash "$COMMIT" > "$LOG/web-stage.log" 2>&1 || { tail -40 "$LOG/web-stage.log"; fail "Stage Web"; }
WEB_STAGE="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$LOG/web-stage.log" | tail -1 || true)"
[[ -n "$WEB_STAGE" ]] || fail "Stage Web sin URL inmutable"
curl -fsSL --connect-timeout 10 --max-time 35 "$WEB_STAGE" -o "$LOG/web-stage.html" || fail "Stage Web no responde"
[[ "$(asset "$LOG/web-stage.html")" == "$NEW_WEB_JS" ]] || fail "Stage Web JS distinto"
curl -fsSL --connect-timeout 10 --max-time 60 "$WEB_STAGE$NEW_WEB_JS" -o "$LOG/web-stage.js" || fail "Stage Web JS inaccesible"
cmp -s "$LOG/web-stage.js" "web/dist$NEW_WEB_JS" || fail "Stage Web JS no corresponde al build"

npx --no-install wrangler pages deploy app/dist --project-name intap-web2 --branch qa-kawvo-g2-4-app-1114 --commit-hash "$COMMIT" > "$LOG/app-stage.log" 2>&1 || { tail -40 "$LOG/app-stage.log"; fail "Stage App"; }
APP_STAGE="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$LOG/app-stage.log" | tail -1 || true)"
[[ -n "$APP_STAGE" ]] || fail "Stage App sin URL inmutable"
curl -fsSL --connect-timeout 10 --max-time 35 "$APP_STAGE/admin/login" -o "$LOG/app-stage.html" || fail "Stage App no responde"
[[ "$(asset "$LOG/app-stage.html")" == "$NEW_APP_JS" ]] || fail "Stage App JS distinto"
curl -fsSL --connect-timeout 10 --max-time 60 "$APP_STAGE$NEW_APP_JS" -o "$LOG/app-stage.js" || fail "Stage App JS inaccesible"
cmp -s "$LOG/app-stage.js" "app/dist$NEW_APP_JS" || fail "Stage App JS no corresponde al build"

curl -fsSL --connect-timeout 10 --max-time 35 "$WEB_ALIAS" -o "$LOG/web-mid.html" || fail "Web alias cambió durante Stage"
curl -fsSL --connect-timeout 10 --max-time 35 "$APP_ALIAS/admin/login" -o "$LOG/app-mid.html" || fail "App alias cambió durante Stage"
[[ "$(asset "$LOG/web-mid.html")" == "$OLD_WEB_JS" && "$(asset "$LOG/app-mid.html")" == "$OLD_APP_JS" ]] || fail "Alias previo cambió durante Stage"
echo "PASS: ambos Stage Web+App idénticos al build y aliases previos intactos"

# Change Web first (new flag is inert until App emits it), then App.
echo "Publicando únicamente Web Pages Preview..."
npx --no-install wrangler pages deploy web/dist --project-name intap-link --branch "$WEB_BRANCH" --commit-hash "$COMMIT" > "$LOG/web-publish.log" 2>&1 || { tail -40 "$LOG/web-publish.log"; fail "Web Pages publicación"; }
grep -Fq "$WEB_ALIAS" "$LOG/web-publish.log" || fail "Alias Web no confirmado; NO reintentar a ciegas"
echo "Publicando únicamente App Pages Preview..."
npx --no-install wrangler pages deploy app/dist --project-name intap-web2 --branch "$APP_BRANCH" --commit-hash "$COMMIT" > "$LOG/app-publish.log" 2>&1 || { tail -40 "$LOG/app-publish.log"; fail "App Pages publicación"; }
grep -Fq "$APP_ALIAS" "$LOG/app-publish.log" || fail "Alias App no confirmado; NO reintentar a ciegas"

OK_APP=0
OK_WEB=0
for i in 1 2 3 4 5 6 7 8; do
 if curl -fsSL --connect-timeout 10 --max-time 35 "$APP_ORIGIN/admin/free/shell-preview?kawvo_shell=1" -o "$LOG/app-served.html" \
    && [[ "$(asset "$LOG/app-served.html")" == "$NEW_APP_JS" ]] \
    && curl -fsSL --connect-timeout 10 --max-time 60 "$APP_ORIGIN$NEW_APP_JS" -o "$LOG/app-served.js" \
    && cmp -s "$LOG/app-served.js" "app/dist$NEW_APP_JS"; then OK_APP=1; fi
 if curl -fsSL --connect-timeout 10 --max-time 35 "$WEB_ORIGIN" -o "$LOG/web-served.html" \
    && [[ "$(asset "$LOG/web-served.html")" == "$NEW_WEB_JS" ]] \
    && curl -fsSL --connect-timeout 10 --max-time 60 "$WEB_ORIGIN$NEW_WEB_JS" -o "$LOG/web-served.js" \
    && cmp -s "$LOG/web-served.js" "web/dist$NEW_WEB_JS"; then OK_WEB=1; fi
 if [[ "$OK_APP" == 1 && "$OK_WEB" == 1 ]]; then break; fi
 sleep 3
done
npx --no-install wrangler deployments status --name "$WORKER" --json > "$LOG/worker-after.json" 2> "$LOG/worker-after.err" || fail "No se pudo leer Worker al terminar"
node - "$LOG/worker-after.json" "$WORKER_SHA" <<'NODE' || fail "Worker sufrió cambio inesperado"
const fs=require('fs'),[file,id]=process.argv.slice(2),v=JSON.parse(fs.readFileSync(file,'utf8'))
if(!Array.isArray(v.versions)||v.versions.length!==1||v.versions[0].version_id!==id||Number(v.versions[0].percentage)!==100)throw Error('Worker Preview cambió')
NODE
[[ "$OK_APP" == 1 && "$OK_WEB" == 1 ]] || fail "Publicación efectuada, pero uno de los bundles no está servido; revisar logs, NO repetir"
echo "PASS G2.4 APP+WEB PREVIEW: bundles correctos y Worker intacto al 100%."
echo "NO CAMBIOS: API, Worker, OAuth, D1/R2, Producción."
echo "QA REAL PENDIENTE: vista previa, Volver a edición y Mi perfil desde perfil Free autenticado."
echo "URL: $APP_ORIGIN/admin/free/shell-preview?kawvo_shell=1"
echo "LOG: $LOG"
