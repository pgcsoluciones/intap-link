#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="hotfix/sponsor-master-bank-module-v1"
EXPECTED_MAIN_SHA="00cebfa706cacbe29ed00510a44b85c7195c4e4e"
APPROVED_PRODUCT_SHA="1f052ebdedadb903cd228924c225580ed5726cd9"
RUNNER_PATH="scripts/run-production-sponsor-master-bank-module-v1-2026-09-18.sh"
APP_PROJECT="intap-web2"
LOG_DIR="$ROOT/.production-sponsor-master-bank-module-v1-logs"
APP_LOG="$LOG_DIR/app-pages-production.log"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" && mkdir -p "$LOG_DIR"

cat <<EOF
============================================================
KAWVO LINK · MÓDULO BANCARIO MASTER · PRODUCCIÓN
============================================================
- muestra Configurar cuentas en perfil Master cuando está habilitado
- conserva mismo módulo bancario patrocinado
- regreso contextual al panel patrocinador
- no toca API, D1, migraciones ni Web pública
- compila App + contrato + smoke
============================================================
Main esperado: $EXPECTED_MAIN_SHA
Hotfix aprobado: $APPROVED_PRODUCT_SHA
============================================================
EOF

run git fetch github main "$BRANCH"
CURRENT_MAIN="$(git rev-parse github/main)"
[ "$CURRENT_MAIN" = "$EXPECTED_MAIN_SHA" ] || fail "main cambió: esperado $EXPECTED_MAIN_SHA, actual $CURRENT_MAIN. Detener y auditar."

run git switch "$BRANCH"
run git pull --ff-only github "$BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Árbol local no limpio"; }

git merge-base --is-ancestor "$APPROVED_PRODUCT_SHA" HEAD || fail "El hotfix aprobado ya no es ancestro"
POST_FILES="$(git diff --name-only "$APPROVED_PRODUCT_SHA"..HEAD | grep -v "^${RUNNER_PATH}$" || true)"
[ -z "$POST_FILES" ] || { echo "$POST_FILES"; fail "Hay cambios de producto posteriores al hotfix aprobado"; }

git merge-base --is-ancestor github/main HEAD || fail "main y hotfix divergieron"
ALLOWED='^(app/src/components/admin/sponsored/SponsoredBankAccounts\.tsx|app/src/components/admin/sponsored/SponsorDashboard\.tsx|scripts/test-sponsored-profile-contract\.mjs|scripts/run-production-sponsor-master-bank-module-v1-2026-09-18\.sh)$'
UNEXPECTED="$(git diff --name-only github/main...HEAD | grep -Ev "$ALLOWED" || true)"
[ -z "$UNEXPECTED" ] || { echo "$UNEXPECTED"; fail "Hay archivos fuera del alcance"; }

run git diff --check github/main...HEAD
run npm ci
run node scripts/test-sponsored-profile-contract.mjs
run npm run build -w app

APP_MAIN_KB="$(find app/dist/assets -maxdepth 1 -type f -name 'index-*.js' -exec du -k {} + | sort -nr | awk 'NR==1{print $1}')"
echo "✓ Bundle App principal: ${APP_MAIN_KB:-0} KB"
[ "${APP_MAIN_KB:-99999}" -le 1450 ] || fail "Bundle App excede presupuesto de release (1450 KB)"

echo; echo "▶ Deploy App Producción"
(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch main) 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App Producción"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$APP_LOG" | tail -1 || true)"

sleep 4
echo; echo "▶ Smoke Producción"
for url in \
  "https://app.intaprd.com/admin/login" \
  "https://app.intaprd.com/admin/sponsor" \
  "https://app.intaprd.com/admin/sponsored/bank-accounts"
do
 code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
 echo "✓ $url -> HTTP $code"
 [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

echo; echo "▶ Promover hotfix a main"
run git switch -C main github/main
run git merge --ff-only "github/$BRANCH"
run git push github main
PROD_SHA="$(git rev-parse HEAD)"
run git fetch github main
[ "$(git rev-parse github/main)" = "$PROD_SHA" ] || fail "main remoto no coincide con lo desplegado"

TAG="prod-sponsor-master-bank-module-v1-2026-09-18-$(date +%H%M%S)"
run git tag -a "$TAG" -m "Sponsor Master bank module V1 production 2026-09-18"
run git push github "$TAG"

rm -rf "$LOG_DIR"

cat <<EOF
============================================================
✓ MÓDULO BANCARIO MASTER DESPLEGADO EN PRODUCCIÓN
============================================================
Production SHA: $PROD_SHA
Release tag:    $TAG
App Pages:      ${APP_ORIGIN:-ver salida Pages}
API/D1/Web:     NO TOCADOS
Smoke:          APROBADO
============================================================
EOF
