#!/usr/bin/env bash
# G1: stage current-main integration ONLY to isolated Pages QA; no Worker/domain switch.
set -euo pipefail
[[ "${KAWVO_G1_STAGE_APPROVED:-}" == "SI" ]] || { echo "DETENIDO: KAWVO_G1_STAGE_APPROVED=SI requerido"; exit 1; }
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawvo-free-g1-current-main-integration-2026-11-12"
STAGE_BRANCH="qa-kawvo-free-g1-current-main-1112"
ACTIVE_WORKER="23405a5b-e9ca-4247-843d-28cc4f236eaa"
ACTIVE_APP="qa-kawmed-guest-current-2026.intap-web2.pages.dev"
ACTIVE_WEB="qa-sponsor-scan-1104.intap-link.pages.dev"
fail(){ echo "DETENIDO: $*" >&2; exit 1; }
cd "$ROOT" || fail "No está disponible checkout"
[[ -z "$(git status --porcelain)" ]] || fail "Hay cambios locales; no se despliega"
[[ "$(git branch --show-current)" == "$BRANCH" ]] || fail "Rama incorrecta"
git fetch github main "$BRANCH"
git pull --ff-only github "$BRANCH"
git merge-base --is-ancestor github/main HEAD || fail "main ya no es ancestro del candidato"
git diff --check github/main..HEAD
[[ -z "$(git diff --name-only github/main HEAD -- api/ web/ app/src/components/admin/medical/ app/src/components/admin/sponsored/ app/src/components/admin/AdminGuard.tsx app/src/components/admin/free/FreeDashboard.tsx package.json package-lock.json)" ]] || fail "Modificaciones sensibles en diff"
node scripts/test-kawvo-free-shell-preview-isolation-2026-11-12.mjs
node scripts/test-kawvo-free-shell-desktop-parity-2026-11-12.mjs
node scripts/test-intapcard-active-account-contract.mjs
mkdir -p "$HOME/intap-release-logs"
LOG="$(mktemp -d "$HOME/intap-release-logs/kawvo-g1-stage-current-main-XXXXXXXX")"
echo "LOG: $LOG"
npm run app:build:preview > "$LOG/build.log" 2>&1 || { tail -60 "$LOG/build.log"; fail "Falló build"; }
[[ -f app/dist/index.html ]] || fail "Falta compilación"
npx --no-install wrangler deployments status --name intap-api-preview --json > "$LOG/worker-status.json" 2> "$LOG/worker-stderr.log" || fail "No se pudo consultar Worker"
node - "$LOG/worker-status.json" "$ACTIVE_WORKER" <<'NODE' || fail "Worker Preview cambió; detener"
const fs=require('node:fs');const [f,id]=process.argv.slice(2);const x=JSON.parse(fs.readFileSync(f,'utf8'));if(!Array.isArray(x.versions)||x.versions.length!==1||x.versions[0].version_id!==id||Number(x.versions[0].percentage)!==100)process.exit(1);
NODE
npx --no-install wrangler versions view "$ACTIVE_WORKER" --name intap-api-preview --json > "$LOG/worker-version.json" 2> "$LOG/worker-version-stderr.log" || fail "No se pudo consultar binding Worker"
node - "$LOG/worker-version.json" "$ACTIVE_APP" "$ACTIVE_WEB" <<'NODE' || fail "Orígenes Preview cambiaron"
const fs=require('node:fs');const [f,app,web]=process.argv.slice(2),o=JSON.parse(fs.readFileSync(f,'utf8'));const found=[];function walk(x){if(!x||typeof x!=='object')return;if(Array.isArray(x)){x.forEach(walk);return;}if(x.name==='APP_PAGES_ORIGIN'||x.name==='WEB_PAGES_ORIGIN')found.push(x);Object.values(x).forEach(walk)}walk(o);for(const [n,v] of [['APP_PAGES_ORIGIN','https://'+app],['WEB_PAGES_ORIGIN','https://'+web]]){const arr=found.filter(x=>x.name===n);if(arr.length!==1||arr[0].text!==v)process.exit(1)}
NODE
curl -fsSL --connect-timeout 10 --max-time 35 "https://app.preview.intaprd.com/admin/login" -o "$LOG/active-preview-login.html" || fail "Dominio Preview no responde"
COMMIT="$(git rev-parse HEAD)"
echo "STAGING Pages QA aislado: $STAGE_BRANCH commit $COMMIT"
npx --no-install wrangler pages deploy app/dist --project-name intap-web2 --branch "$STAGE_BRANCH" --commit-hash "$COMMIT" 2>&1 | tee "$LOG/stage-pages.log"
ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$LOG/stage-pages.log" | tail -1 || true)"
[[ -n "$ORIGIN" ]] || fail "No se obtuvo URL inmutable"
echo "$ORIGIN" > "$LOG/origin.txt"
curl -fsSL --connect-timeout 10 --max-time 35 "$ORIGIN/admin/free/shell-preview?kawvo_shell=1" -o "$LOG/stage.html" || fail "Stage no responde"
ASSET="$(grep -Eo '/assets/index-[^"]+\.js' app/dist/index.html | head -1)"
[[ -n "$ASSET" ]] || fail "No se identificó JS candidato"
grep -Fq "$ASSET" "$LOG/stage.html" || fail "Stage no sirve bundle del candidato"
curl -fsSL --connect-timeout 10 --max-time 35 "$ORIGIN$ASSET" -o "$LOG/stage.js" || fail "JS stage no responde"
cmp -s "$LOG/stage.js" "app/dist$ASSET" || fail "JS stage difiere de compilación local"
[[ -z "$(git status --porcelain)" ]] || fail "El stage alteró archivos versionados"
echo "PASS: staging QA aislado de PR #158; bundle idéntico al compilado local."
echo "URL: $ORIGIN"
echo "NO AUTENTICAR EN .pages.dev; el shell requiere app.preview.intaprd.com."
echo "NO se modificaron Worker, OAuth, API, D1, R2, Production ni dominio activo."
echo "LOG: $LOG"
