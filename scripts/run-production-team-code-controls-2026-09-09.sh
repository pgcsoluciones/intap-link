#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
FEATURE_BRANCH="feature/kawvo-onboarding-product-flow-v1"
PROD_BASE_SHA="005ed02c45ace72650458ea44bb292d8c7d96dcb"
APPROVED_PRODUCT_SHA="1bd9af2d23592e53468775f109355df5f927d5c7"
APP_PROJECT="intap-web2"
LOG_DIR="$ROOT/.production-team-code-controls-2026-09-09-logs"

fail(){ echo ""; echo "✗ ERROR: $1"; exit 1; }
run(){ echo ""; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" && mkdir -p "$LOG_DIR"

echo "============================================================"
echo " KAWVO LINK · TEAM CODE CONTROLS · PRODUCCIÓN"
echo "============================================================"
echo "Producción base:  $PROD_BASE_SHA"
echo "Producto aprobado:$APPROVED_PRODUCT_SHA"

run git fetch github main "$FEATURE_BRANCH"
run git checkout -B "$FEATURE_BRANCH" "github/$FEATURE_BRANCH"
run git reset --hard "github/$FEATURE_BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Working tree no está limpio"; }

[ "$(git rev-parse github/main)" = "$PROD_BASE_SHA" ] || fail "main cambió desde la base esperada"
if ! git merge-base --is-ancestor "$APPROVED_PRODUCT_SHA" "github/$FEATURE_BRANCH"; then
  fail "El SHA aprobado ya no es ancestro de la rama"
fi

# Permitir únicamente los 3 archivos de producto aprobados y este runner.
ALLOWED='^(api/src/team-code-delete\.ts|api/src/preview-free-entry\.ts|app/src/team-copy-fallback\.ts|scripts/run-production-team-code-controls-2026-09-09\.sh)$'
UNEXPECTED="$(git diff --name-only "$PROD_BASE_SHA".."github/$FEATURE_BRANCH" | grep -Ev "$ALLOWED" || true)"
[ -z "$UNEXPECTED" ] || { echo "$UNEXPECTED"; fail "Hay cambios fuera del alcance aprobado"; }
echo "✓ Alcance verificado: controles de códigos Team"

if git diff --name-only "$PROD_BASE_SHA".."github/$FEATURE_BRANCH" | grep -E '^api/(migrations|migrations-preview)/' >/dev/null; then
  fail "No se esperaban migraciones"
fi
echo "✓ Sin migraciones"

run git diff --check "$PROD_BASE_SHA"..."$APPROVED_PRODUCT_SHA"
run npm ci
run npm run build -w app
run npx tsc --noEmit -p api/tsconfig.json
run npx esbuild api/src/preview-free-entry.ts --bundle --platform=node --format=esm --target=node20 --external:cloudflare:* --outfile=/tmp/kawvo-team-code-controls-api-production.mjs
run bash -lc 'cd api && npx wrangler deploy --config wrangler.toml --dry-run'

run git checkout -B main github/main
run git merge --ff-only "github/$FEATURE_BRANCH"
run git push github main
PROD_SHA="$(git rev-parse HEAD)"

# API primero: agrega eliminación manual y mantiene la retención/paginación de 5.
echo ""
echo "▶ Deploy Worker Producción"
WORKER_LOG="$LOG_DIR/worker-production.log"
(cd api && npm run deploy:production) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Producción"
WORKER_VERSION="$(grep -E 'Current Version ID:' "$WORKER_LOG" | tail -1 | sed -E 's/.*Current Version ID:[[:space:]]*//')"

# App: expone el control manual y el feedback/paginación visual.
echo ""
echo "▶ Deploy App Producción → $APP_PROJECT"
APP_LOG="$LOG_DIR/app-pages-production.log"
(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch main) 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App Producción"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$APP_LOG" | tail -1)"

sleep 3
for url in \
  "https://app.intaprd.com/admin/login" \
  "https://app.intaprd.com/admin/free/team"; do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
  echo "✓ $url -> HTTP 200"
done

run git fetch github main
[ "$(git rev-parse github/main)" = "$PROD_SHA" ] || fail "main remoto no coincide con el release"

TAG="prod-team-code-controls-2026-09-09-$(date +%H%M%S)"
run git tag -a "$TAG" -m "Kawvo Link Team code controls production 2026-09-09"
run git push github "$TAG"

cat <<EOF

============================================================
✓ KAWVO LINK · TEAM CODE CONTROLS · PRODUCCIÓN DESPLEGADA
============================================================
Production SHA:  $PROD_SHA
Release tag:     $TAG
Worker Version:  ${WORKER_VERSION:-ver salida Wrangler}
App Pages:       ${APP_ORIGIN:-ver salida Pages}
App Producción:  https://app.intaprd.com
D1 Producción:   SIN MIGRACIONES
Web Producción:  SIN CAMBIOS
Smoke:           APROBADO
============================================================
EOF
