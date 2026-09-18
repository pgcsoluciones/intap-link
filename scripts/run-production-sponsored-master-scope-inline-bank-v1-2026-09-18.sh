#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="hotfix/sponsored-master-scope-inline-bank-v1"
EXPECTED_MAIN_SHA="db40799a07e3eb15a5c5cb7765cbf3b7a38e1ce7"
APPROVED_PRODUCT_SHA="b79d3f21653dbe9ecb994c5af3b5b449cd73cb00"
RUNNER_PATH="scripts/run-production-sponsored-master-scope-inline-bank-v1-2026-09-18.sh"
APP_PROJECT="intap-web2"
LOG_DIR="$ROOT/.production-sponsored-master-scope-inline-bank-v1-logs"
APP_LOG="$LOG_DIR/app-pages-production.log"
WORKER_LOG="$LOG_DIR/worker-production.log"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" && mkdir -p "$LOG_DIR"

cat <<EOF
============================================================
KAWVO LINK · MASTER SCOPE + CUENTAS INLINE · PRODUCCIÓN
============================================================
- corrige selección explícita del perfil Master sponsor_owner
- GET Master crea/rellena su base antes de mostrarla
- edición, publicación, imágenes, starter y bancos respetan scope Master
- beneficiario queda separado del perfil Master
- integra cuentas bancarias dentro del editor patrocinado
- integra cuentas bancarias al recorrido guiado
- NO modifica Free/Plus/Team
- NO aplica migraciones ni comandos D1
- NO despliega Web pública
- despliega Worker/API + App
============================================================
Main esperado:     $EXPECTED_MAIN_SHA
Producto aprobado: $APPROVED_PRODUCT_SHA
============================================================
EOF

run git fetch github main "$BRANCH"
CURRENT_MAIN="$(git rev-parse github/main)"
[ "$CURRENT_MAIN" = "$EXPECTED_MAIN_SHA" ] || fail "main cambió: esperado $EXPECTED_MAIN_SHA, actual $CURRENT_MAIN. Detener y auditar."

run git switch "$BRANCH"
run git pull --ff-only github "$BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Árbol local no limpio"; }

git merge-base --is-ancestor "$APPROVED_PRODUCT_SHA" HEAD || fail "El producto aprobado ya no es ancestro"
POST_FILES="$(git diff --name-only "$APPROVED_PRODUCT_SHA"..HEAD | grep -v "^${RUNNER_PATH}$" || true)"
[ -z "$POST_FILES" ] || { echo "$POST_FILES"; fail "Hay cambios de producto posteriores al SHA aprobado"; }
git merge-base --is-ancestor github/main HEAD || fail "main y feature divergieron"

ALLOWED='^(api/src/sponsored-profile-scope\.ts|api/src/sponsored-profiles\.ts|api/src/sponsored-starter\.ts|api/src/sponsored-media\.ts|api/src/sponsored-bank-accounts\.ts|app/src/App\.tsx|app/src/components/admin/sponsored/SponsoredBankAccounts\.tsx|app/src/components/admin/sponsored/SponsoredDashboard\.tsx|app/src/components/admin/sponsored/SponsorDashboard\.tsx|app/src/components/admin/sponsored/SponsoredGuidedTour\.tsx|app/src/components/admin/sponsored/SponsoredStarterOnboarding\.tsx|scripts/test-sponsored-profile-contract\.mjs|scripts/run-production-sponsored-inline-bank-module-v1-2026-09-18\.sh|scripts/run-production-sponsored-master-scope-inline-bank-v1-2026-09-18\.sh)$'
UNEXPECTED="$(git diff --name-only github/main...HEAD | grep -Ev "$ALLOWED" || true)"
[ -z "$UNEXPECTED" ] || { echo "$UNEXPECTED"; fail "Hay archivos fuera del alcance"; }

run git diff --check github/main...HEAD
run npm ci
run node scripts/test-sponsored-profile-contract.mjs
run npm run build -w app
run npx tsc --noEmit -p api/tsconfig.json
run npx esbuild api/src/preview-free-entry.ts --bundle --platform=node --format=esm --target=node20 --external:cloudflare:* --outfile=/tmp/kawvo-sponsored-master-scope-production-api.mjs
run bash -lc 'cd api && npx wrangler deploy --config wrangler.toml --dry-run'

APP_MAIN_KB="$(find app/dist/assets -maxdepth 1 -type f -name 'index-*.js' -exec du -k {} + | sort -nr | awk 'NR==1{print $1}')"
echo "✓ Bundle App principal: ${APP_MAIN_KB:-0} KB"
[ "${APP_MAIN_KB:-99999}" -le 1450 ] || fail "Bundle App excede presupuesto de release (1450 KB)"

echo; echo "▶ Deploy Worker Producción"
(
 cd api
 npm run deploy:production
) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Producción"
WORKER_VERSION="$(grep -E 'Current Version ID:' "$WORKER_LOG" | tail -1 | sed -E 's/.*Current Version ID:[[:space:]]*//' || true)"

echo; echo "▶ Deploy App Producción"
(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch main) 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App Producción"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$APP_LOG" | tail -1 || true)"

sleep 5
echo; echo "▶ Smoke Producción"
for url in \
  "https://app.intaprd.com/admin/login" \
  "https://app.intaprd.com/admin/sponsor" \
  "https://app.intaprd.com/admin/sponsored"
do
 code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
 echo "✓ $url -> HTTP $code"
 [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

for apiurl in \
  "https://app.intaprd.com/api/v1/me/sponsored-profile?scope=master" \
  "https://app.intaprd.com/api/v1/me/sponsored-profile/bank-accounts?scope=master"
do
 code="$(curl -sS -o /dev/null -w '%{http_code}' "$apiurl")"
 echo "✓ sin sesión $apiurl -> HTTP $code"
 [ "$code" = "401" ] || fail "$apiurl no protegió autenticación como se esperaba"
done

echo; echo "▶ Promover release a main"
run git switch -C main github/main
run git merge --ff-only "github/$BRANCH"
run git push github main
PROD_SHA="$(git rev-parse HEAD)"
run git fetch github main
[ "$(git rev-parse github/main)" = "$PROD_SHA" ] || fail "main remoto no coincide con lo desplegado"

TAG="prod-sponsored-master-scope-inline-bank-v1-2026-09-18-$(date +%H%M%S)"
run git tag -a "$TAG" -m "Sponsored Master scope and inline bank V1 production 2026-09-18"
run git push github "$TAG"

rm -rf "$LOG_DIR"

cat <<EOF
============================================================
✓ MASTER SCOPE + CUENTAS INLINE DESPLEGADOS EN PRODUCCIÓN
============================================================
Production SHA: $PROD_SHA
Release tag:    $TAG
Worker Version: ${WORKER_VERSION:-ver salida Wrangler}
App Pages:      ${APP_ORIGIN:-ver salida Pages}
D1/Migraciones: NO TOCADOS
Web pública:    NO TOCADA
Free/Plus/Team: NO TOCADOS
Smoke:          APROBADO
============================================================
EOF
