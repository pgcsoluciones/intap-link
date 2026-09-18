#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="hotfix/sponsor-notifications-local-v1"
EXPECTED_MAIN_SHA="304443a08bbcee6fcee7010d1541afb8c102fd0b"
APPROVED_PRODUCT_SHA="9fef58fca61d4952fdb9fdde646d0cc81107a996"
RUNNER_PATH="scripts/run-production-sponsor-notifications-local-v1-2026-09-18.sh"
APP_PROJECT="intap-web2"
LOG_DIR="$ROOT/.production-sponsor-notifications-local-v1-logs"
APP_LOG="$LOG_DIR/app-pages-production.log"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" && mkdir -p "$LOG_DIR"

cat <<EOF
============================================================
KAWVO LINK · HOTFIX NOTIFICACIONES SPONSOR · PRODUCCIÓN
============================================================
- solo modifica SuperAdminSponsors.tsx
- no toca API, D1, Web pública ni migraciones
- no cambia Free, Plus, Team, Med ni perfiles públicos
- compila App antes del deploy
- smoke de login y SuperAdmin Sponsors
- fast-forward puro de main
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
DIFF_FILES="$(git diff --name-only github/main...HEAD | grep -v "^${RUNNER_PATH}$" || true)"
[ "$DIFF_FILES" = "app/src/components/admin/SuperAdminSponsors.tsx" ] || { echo "$DIFF_FILES"; fail "El hotfix contiene archivos fuera del alcance"; }

run git diff --check github/main...HEAD
run npm ci
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
  "https://app.intaprd.com/superadmin/sponsors"
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

TAG="prod-sponsor-notifications-local-v1-2026-09-18-$(date +%H%M%S)"
run git tag -a "$TAG" -m "Sponsor notification locality hotfix production 2026-09-18"
run git push github "$TAG"

rm -rf "$LOG_DIR"

cat <<EOF
============================================================
✓ HOTFIX NOTIFICACIONES SPONSOR DESPLEGADO EN PRODUCCIÓN
============================================================
Production SHA: $PROD_SHA
Release tag:    $TAG
App Pages:      ${APP_ORIGIN:-ver salida Pages}
API/D1/Web:     NO TOCADOS
Smoke:          APROBADO
============================================================
EOF
