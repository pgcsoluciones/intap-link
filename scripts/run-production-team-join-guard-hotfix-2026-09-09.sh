#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
FEATURE_BRANCH="feature/kawvo-onboarding-product-flow-v1"
PROD_BASE_SHA="384d8e2c1c10d30e697153282a915ef112d8ba20"
APPROVED_SHA="8e1c9677da3954a10ff8e3067f1251c379d0a89b"
APP_PROJECT="intap-web2"
LOG_DIR="$ROOT/.production-team-join-guard-hotfix-2026-09-09-logs"

fail(){ echo ""; echo "✗ ERROR: $1"; exit 1; }
run(){ echo ""; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" && mkdir -p "$LOG_DIR"

echo "============================================================"
echo " KAWVO LINK · TEAM JOIN GUARD HOTFIX · PRODUCCIÓN"
echo "============================================================"
echo "Producto aprobado: $APPROVED_SHA"
echo "Producción base:   $PROD_BASE_SHA"

run git fetch github main "$FEATURE_BRANCH"
run git checkout -B "$FEATURE_BRANCH" "github/$FEATURE_BRANCH"
run git reset --hard "github/$FEATURE_BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Working tree no está limpio"; }

CURRENT_HEAD="$(git rev-parse HEAD)"
echo "Feature release:   $CURRENT_HEAD"

if ! git merge-base --is-ancestor "$APPROVED_SHA" "github/$FEATURE_BRANCH"; then
  fail "El SHA aprobado ya no es ancestro de la feature"
fi

UNAPPROVED_FILES="$(git diff --name-only "$APPROVED_SHA".."github/$FEATURE_BRANCH" | grep -v '^scripts/run-production-team-join-guard-hotfix-2026-09-09.sh$' || true)"
[ -z "$UNAPPROVED_FILES" ] || { echo "$UNAPPROVED_FILES"; fail "Hay cambios de producto posteriores al SHA aprobado"; }

MAIN_SHA="$(git rev-parse github/main)"
[ "$MAIN_SHA" = "$PROD_BASE_SHA" ] || fail "main cambió: esperado $PROD_BASE_SHA, encontrado $MAIN_SHA"

HOTFIX_FILES="$(git diff --name-only "$PROD_BASE_SHA".."$APPROVED_SHA" | sort)"
EXPECTED_FILES="app/src/components/admin/AdminGuard.tsx"
[ "$HOTFIX_FILES" = "$EXPECTED_FILES" ] || {
  echo "Archivos encontrados:"; echo "$HOTFIX_FILES"
  fail "El hotfix contiene archivos fuera del alcance aprobado"
}

echo "✓ Alcance verificado: AdminGuard Team join únicamente"
echo "✓ Sin cambios de API, D1, Worker ni Web"

run git diff --check "$PROD_BASE_SHA"..."$APPROVED_SHA"
run npm ci
run npm run build -w app

run git checkout -B main github/main
run git merge --ff-only "github/$FEATURE_BRANCH"
run git push github main
PROD_SHA="$(git rev-parse HEAD)"

echo ""
echo "▶ Deploy App Producción → $APP_PROJECT"
APP_LOG="$LOG_DIR/app-pages-production.log"
(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch main) 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App Producción"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$APP_LOG" | tail -1)"

sleep 3
for url in \
  "https://app.intaprd.com/admin/login" \
  "https://app.intaprd.com/admin/free/team/join" \
  "https://app.intaprd.com/admin/free/team"; do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
  echo "✓ $url -> HTTP 200"
done

run git fetch github main
[ "$(git rev-parse github/main)" = "$PROD_SHA" ] || fail "main remoto no coincide con el SHA desplegado"

TAG="prod-team-join-guard-hotfix-2026-09-09-$(date +%H%M%S)"
run git tag -a "$TAG" -m "Kawvo Link Team join guard hotfix production 2026-09-09"
run git push github "$TAG"

cat <<EOF

============================================================
✓ KAWVO LINK · TEAM JOIN GUARD HOTFIX · PRODUCCIÓN DESPLEGADA
============================================================
Production SHA:  $PROD_SHA
Producto aprobado:$APPROVED_SHA
Release tag:     $TAG
App Pages:       ${APP_ORIGIN:-ver salida Pages}
App Producción:  https://app.intaprd.com
Worker/API:      SIN CAMBIOS
D1 Producción:   SIN CAMBIOS
Web Producción:  SIN CAMBIOS
Smoke:           APROBADO
============================================================
EOF
