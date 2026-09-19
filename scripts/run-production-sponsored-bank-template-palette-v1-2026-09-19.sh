#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/sponsored-bank-template-palette-v1"
EXPECTED_MAIN_SHA="e4a302501ffa8e422adea3371753aa37815a5f2f"
APPROVED_PRODUCT_SHA="7f2313113836dd5fd298ef5758e77b09a9c43e79"
WEB_PROJECT="intap-link"
APP_PROJECT="intap-web2"
LOG_DIR="$ROOT/.production-sponsored-bank-template-palette-v1-logs"
WEB_LOG="$LOG_DIR/web-pages.log"
APP_LOG="$LOG_DIR/app-pages.log"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR"
mkdir -p "$LOG_DIR"

cat <<EOF
============================================================
KAWVO LINK · BANCOS INTEGRADOS A PLANTILLA · PRODUCCIÓN
============================================================
- cuentas bancarias heredan la paleta elegida por el usuario
- sección integrada dentro de SponsoredProfile
- orden público: Horario → Cuentas bancarias → Catálogo
- elimina montaje bancario independiente/duplicado
- panel editor mantiene el mismo orden
- NO toca D1
- NO despliega Worker/API
- despliega Web + App
============================================================
Main esperado:     $EXPECTED_MAIN_SHA
Producto aprobado: $APPROVED_PRODUCT_SHA
============================================================
EOF

run git fetch github main "$BRANCH"
[ "$(git rev-parse github/main)" = "$EXPECTED_MAIN_SHA" ] || fail "main cambió; detener y auditar"

run git switch "$BRANCH"
run git pull --ff-only github "$BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Árbol local no limpio"; }

git merge-base --is-ancestor "$APPROVED_PRODUCT_SHA" HEAD || fail "Producto aprobado ya no es ancestro"
POST_FILES="$(git diff --name-only "$APPROVED_PRODUCT_SHA"..HEAD | grep -Ev '^scripts/run-production-sponsored-bank-template-palette-v1-2026-09-19\.sh$' || true)"
[ -z "$POST_FILES" ] || { echo "$POST_FILES"; fail "Hay cambios posteriores al producto aprobado"; }

git merge-base --is-ancestor github/main HEAD || fail "main y feature divergieron"

ALLOWED='^(web/src/(App\.tsx|components/sponsored/(SponsoredProfile|SponsoredBankAccounts)\.tsx)|app/src/components/admin/sponsored/SponsoredDashboard\.tsx|scripts/test-sponsored-profile-contract\.mjs|scripts/run-production-sponsored-bank-template-palette-v1-2026-09-19\.sh)$'
UNEXPECTED="$(git diff --name-only github/main...HEAD | grep -Ev "$ALLOWED" || true)"
[ -z "$UNEXPECTED" ] || { echo "$UNEXPECTED"; fail "Hay archivos fuera del alcance"; }

run git diff --check github/main...HEAD
run npm ci
run node scripts/test-sponsored-profile-contract.mjs
run npm run build -w web
run npm run build -w app

echo
echo "▶ Deploy Web Producción"
(npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch main) 2>&1 | tee "$WEB_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Web Producción"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$WEB_LOG" | tail -1 || true)"

echo
echo "▶ Deploy App Producción"
(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch main) 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App Producción"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$APP_LOG" | tail -1 || true)"

sleep 5

echo
echo "▶ Smoke Producción"
for url in \
  "https://intaprd.com/" \
  "https://app.intaprd.com/admin/login" \
  "https://app.intaprd.com/admin/sponsored"
do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

echo
echo "▶ Promover release a main"
run git switch -C main github/main
run git merge --ff-only "github/$BRANCH"
run git push github main
PROD_SHA="$(git rev-parse HEAD)"
run git fetch github main
[ "$(git rev-parse github/main)" = "$PROD_SHA" ] || fail "main remoto no coincide con lo desplegado"

TAG="prod-sponsored-bank-template-palette-v1-2026-09-19-$(date +%H%M%S)"
run git tag -a "$TAG" -m "Sponsored bank template palette V1 production 2026-09-19"
run git push github "$TAG"

rm -rf "$LOG_DIR"

cat <<EOF
============================================================
✓ BANCOS INTEGRADOS A PLANTILLA DESPLEGADOS EN PRODUCCIÓN
============================================================
Production SHA: $PROD_SHA
Release tag:    $TAG
Web Pages:      ${WEB_ORIGIN:-ver salida Pages}
App Pages:      ${APP_ORIGIN:-ver salida Pages}
D1:             NO TOCADO
Worker/API:     NO TOCADO
============================================================
EOF
