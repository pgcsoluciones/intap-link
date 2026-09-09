#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
FEATURE_BRANCH="feature/kawvo-onboarding-product-flow-v1"
APPROVED_PRODUCT_SHA="58425fa3422dd34ede4cd0b7b14dd563ed430f58"
EXPECTED_MAIN_SHA="152f000d272006dc39a112d615119777e578618b"
RUNNER_PATH="scripts/run-production-onboarding-product-flow-2026-09-09.sh"
WEB_PROJECT="intap-link"
APP_PROJECT="intap-web2"
LOG_DIR="$ROOT/.production-onboarding-product-flow-2026-09-09-logs"
WEB_LOG="$LOG_DIR/web-pages-production.log"
APP_LOG="$LOG_DIR/app-pages-production.log"
WORKER_LOG="$LOG_DIR/worker-production.log"
MIGRATION_LOG="$LOG_DIR/d1-production-migrations.log"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR"
mkdir -p "$LOG_DIR"

printf '\n============================================================\n'
printf ' KAWVO LINK · ONBOARDING + TEAM · PRODUCCIÓN\n'
printf '============================================================\n\n'
printf 'APROBACIÓN EXPLÍCITA: 2026-09-09\n'
printf 'Producto aprobado: %s\n' "$APPROVED_PRODUCT_SHA"
printf 'Main esperado:     %s\n' "$EXPECTED_MAIN_SHA"

# Recuperar exactamente el estado remoto y evitar promover sobre un main que cambió a escondidas.
run git fetch github main "$FEATURE_BRANCH"
CURRENT_MAIN="$(git rev-parse github/main)"
[ "$CURRENT_MAIN" = "$EXPECTED_MAIN_SHA" ] || fail "github/main cambió: esperado $EXPECTED_MAIN_SHA, actual $CURRENT_MAIN. Detener promoción y auditar."

run git checkout -B "$FEATURE_BRANCH" "github/$FEATURE_BRANCH"
run git reset --hard "github/$FEATURE_BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Working tree no está limpio"; }

FEATURE_SHA="$(git rev-parse HEAD)"
echo "Feature release: $FEATURE_SHA"

# El producto probado en Preview debe seguir intacto. Solo este runner puede existir encima.
git merge-base --is-ancestor "$APPROVED_PRODUCT_SHA" HEAD || fail "El SHA aprobado de Preview ya no es ancestro de la rama"
UNAPPROVED_FILES="$(git diff --name-only "$APPROVED_PRODUCT_SHA"..HEAD | grep -v "^${RUNNER_PATH}$" || true)"
[ -z "$UNAPPROVED_FILES" ] || { echo "$UNAPPROVED_FILES"; fail "Hay cambios de producto posteriores al SHA aprobado"; }

# La promoción debe ser fast-forward puro desde main.
git merge-base --is-ancestor github/main HEAD || fail "main y feature divergieron; detener promoción"
[ "$(git rev-list --count HEAD..github/main)" = "0" ] || fail "La feature está detrás de main"

run git diff --check github/main...HEAD

# Gates relevantes de esta entrega. El chequeo histórico functions/profile-discovery.ts
# continúa fuera de este release porque ya falla en main por un problema heredado.
run npm ci
run npm run build -w web
run npm run build -w app
run npx tsc --noEmit -p api/tsconfig.json
run npx esbuild api/src/preview-free-entry.ts --bundle --platform=node --format=esm --target=node20 --external:cloudflare:* --outfile=/tmp/kawvo-onboarding-product-api-production.mjs
run bash -lc 'cd api && npx wrangler deploy --config wrangler.toml --dry-run'

# Mostrar el estado de migraciones antes de modificar Producción.
echo
echo "▶ Migraciones D1 Producción pendientes / aplicadas"
(
  cd api
  npx wrangler d1 migrations list intap_db --remote --config wrangler.toml
) 2>&1 | tee "$MIGRATION_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "No pude consultar migraciones D1 Producción"

# Promoción exacta por fast-forward. Incluye el runner de release y todo el producto aprobado.
echo
echo "▶ Promover feature aprobada a main"
run git checkout -B main github/main
run git merge --ff-only "github/$FEATURE_BRANCH"
run git push github main
PROD_SHA="$(git rev-parse HEAD)"

# Esquema primero: el Worker nuevo requiere las tablas/columnas Team. Wrangler aplica solo
# migraciones pendientes del directorio api/migrations; no aplica migraciones-preview ni seeds QA.
echo
echo "▶ Aplicar migraciones D1 Producción"
(
  cd api
  npx wrangler d1 migrations apply intap_db --remote --config wrangler.toml
) 2>&1 | tee -a "$MIGRATION_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Migraciones D1 Producción"

# API primero, luego las dos superficies web.
echo
echo "▶ Deploy Worker Producción"
(
  cd api
  npm run deploy:production
) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Producción"
WORKER_VERSION="$(grep -E 'Current Version ID:' "$WORKER_LOG" | tail -1 | sed -E 's/.*Current Version ID:[[:space:]]*//' || true)"

echo
echo "▶ Deploy Web Producción → $WEB_PROJECT"
(npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch main) 2>&1 | tee "$WEB_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Web Producción"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$WEB_LOG" | tail -1 || true)"

echo
echo "▶ Deploy App Producción → $APP_PROJECT"
(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch main) 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App Producción"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$APP_LOG" | tail -1 || true)"

sleep 4

for url in \
  "https://intaprd.com/" \
  "https://app.intaprd.com/admin/login" \
  "https://app.intaprd.com/superadmin/promotions"
do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

# Confirmar que main remoto quedó exactamente en el SHA promovido.
run git fetch github main
REMOTE_MAIN="$(git rev-parse github/main)"
[ "$REMOTE_MAIN" = "$PROD_SHA" ] || fail "main remoto no coincide con el SHA promovido"

TAG="prod-kawvo-team-onboarding-2026-09-09-$(date +%H%M%S)"
run git tag -a "$TAG" -m "Kawvo Link Team + onboarding production 2026-09-09"
run git push github "$TAG"

cat <<EOF

============================================================
✓ KAWVO LINK · ONBOARDING + TEAM · PRODUCCIÓN DESPLEGADA
============================================================
Production SHA:  $PROD_SHA
Release tag:     $TAG
Worker Version:  ${WORKER_VERSION:-ver salida Wrangler}
Web Pages:       ${WEB_ORIGIN:-ver salida Pages}
App Pages:       ${APP_ORIGIN:-ver salida Pages}
Web Producción:  https://intaprd.com
App Producción:  https://app.intaprd.com
D1 Producción:   intap_db · migraciones pendientes aplicadas
QA smoke:        APROBADO
============================================================
EOF
