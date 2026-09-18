#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="hotfix/sponsor-master-bank-social-card-v1"
EXPECTED_MAIN_SHA="00cebfa706cacbe29ed00510a44b85c7195c4e4e"
APPROVED_PRODUCT_SHA="c11d63bd3288947af97d21568eb5f7dd903fd263"
RUNNER_PATH="scripts/run-production-sponsor-master-bank-social-card-v1-2026-09-18.sh"
WEB_PROJECT="intap-link"
APP_PROJECT="intap-web2"
LOG_DIR="$ROOT/.production-sponsor-master-bank-social-card-v1-logs"
WEB_LOG="$LOG_DIR/web-pages-production.log"
APP_LOG="$LOG_DIR/app-pages-production.log"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" && mkdir -p "$LOG_DIR"

cat <<EOF
============================================================
KAWVO LINK · MASTER BANCOS + SOCIAL CARD · PRODUCCIÓN
============================================================
- muestra módulo bancario habilitado en perfil Master
- agrega social card server-side para /p/:username
- social card usa nombre/descripción/portada DEL PERFIL
- NO usa información ni imágenes del patrocinador en beneficiarios
- enlaces /l/... heredan la card al redirigir a /p/...
- no toca API, D1 ni migraciones
- despliega Web + App
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

ALLOWED='^(functions/_middleware\.ts|app/src/components/admin/sponsored/SponsoredBankAccounts\.tsx|app/src/components/admin/sponsored/SponsorDashboard\.tsx|scripts/test-sponsored-profile-contract\.mjs|scripts/run-production-sponsor-master-bank-module-v1-2026-09-18\.sh|scripts/run-production-sponsor-master-bank-social-card-v1-2026-09-18\.sh)$'
UNEXPECTED="$(git diff --name-only github/main...HEAD | grep -Ev "$ALLOWED" || true)"
[ -z "$UNEXPECTED" ] || { echo "$UNEXPECTED"; fail "Hay archivos fuera del alcance"; }

run git diff --check github/main...HEAD
run npm ci
run node scripts/test-sponsored-profile-contract.mjs
run npm run build -w web
run npm run build -w app

echo; echo "▶ Deploy Web Producción"
(npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch main) 2>&1 | tee "$WEB_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Web Producción"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$WEB_LOG" | tail -1 || true)"

echo; echo "▶ Deploy App Producción"
(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch main) 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App Producción"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$APP_LOG" | tail -1 || true)"

sleep 5
echo; echo "▶ Smoke Producción"
for url in \
  "https://intaprd.com/" \
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

TAG="prod-sponsor-master-bank-social-card-v1-2026-09-18-$(date +%H%M%S)"
run git tag -a "$TAG" -m "Sponsor Master bank and social card V1 production 2026-09-18"
run git push github "$TAG"

rm -rf "$LOG_DIR"

cat <<EOF
============================================================
✓ MASTER BANCOS + SOCIAL CARD DESPLEGADOS EN PRODUCCIÓN
============================================================
Production SHA: $PROD_SHA
Release tag:    $TAG
Web Pages:      ${WEB_ORIGIN:-ver salida Pages}
App Pages:      ${APP_ORIGIN:-ver salida Pages}
API/D1:         NO TOCADOS
Smoke:          APROBADO
============================================================
EOF
