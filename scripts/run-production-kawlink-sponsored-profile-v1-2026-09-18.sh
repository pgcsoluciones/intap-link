#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
FEATURE_BRANCH="feature/kawlink-sponsored-profile-v1"
APPROVED_PREVIEW_SHA="f9789816400663af65db3f1dcd82c80fc838cf63"
EXPECTED_MAIN_SHA="7f6d53479cc54999d61dd34e0e1d115eafbcbd5d"
RUNNER_PATH="scripts/run-production-kawlink-sponsored-profile-v1-2026-09-18.sh"
WEB_PROJECT="intap-link"
APP_PROJECT="intap-web2"
PROD_DB="intap_db"
LOG_DIR="$ROOT/.production-kawlink-sponsored-profile-v1-logs"
WEB_LOG="$LOG_DIR/web-pages-production.log"
APP_LOG="$LOG_DIR/app-pages-production.log"
WORKER_LOG="$LOG_DIR/worker-production.log"
MIGRATION_LOG="$LOG_DIR/d1-production-migrations.log"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR"
mkdir -p "$LOG_DIR"

cat <<EOF
============================================================
KAWVO LINK · PERFIL PATROCINADO V1 · PRODUCCIÓN
============================================================
- promueve únicamente el Preview aprobado
- detiene el release si main cambió
- no admite cambios de producto posteriores al SHA aprobado
- valida contrato + Web + App + API antes de tocar Producción
- aplica únicamente migraciones pendientes de api/migrations
- despliega API + Web + App exactos ya validados
- smoke test antes de promover main
- no modifica Free/Plus/Team fuera de los archivos compartidos aprobados
============================================================
Preview aprobado: $APPROVED_PREVIEW_SHA
Main esperado:     $EXPECTED_MAIN_SHA
============================================================
EOF

run git fetch github main "$FEATURE_BRANCH"
CURRENT_MAIN="$(git rev-parse github/main)"
[ "$CURRENT_MAIN" = "$EXPECTED_MAIN_SHA" ] || fail "github/main cambió: esperado $EXPECTED_MAIN_SHA, actual $CURRENT_MAIN. Detener y auditar antes de producción."

run git switch "$FEATURE_BRANCH"
run git pull --ff-only github "$FEATURE_BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "El árbol de trabajo no está limpio"; }

FEATURE_SHA="$(git rev-parse HEAD)"
echo "Feature release: $FEATURE_SHA"

git merge-base --is-ancestor "$APPROVED_PREVIEW_SHA" HEAD || fail "El SHA aprobado de Preview ya no es ancestro de la rama"
POST_APPROVAL="$(git diff --name-only "$APPROVED_PREVIEW_SHA"..HEAD | grep -v "^${RUNNER_PATH}$" || true)"
[ -z "$POST_APPROVAL" ] || { echo "$POST_APPROVAL"; fail "Hay cambios de producto posteriores al Preview aprobado"; }

git merge-base --is-ancestor github/main HEAD || fail "main y feature divergieron; no se permite merge de reconciliación"
[ "$(git rev-list --count HEAD..github/main)" = "0" ] || fail "La feature está detrás de main"

ALLOWED='^(\.github/workflows/deploy-sponsored-preview\.yml|api/migrations(-preview)?/006[2-8]_sponsored_.*\.sql|api/src/(account-home-route|preview-free-entry|sponsored-[a-z0-9-]+)\.ts|app/src/App\.tsx|app/src/components/admin/(AdminGuard|AdminLogin|AuthCallback|ImageCropModal|SuperAdminLayout|SuperAdminSponsorBrand|SuperAdminSponsors)\.tsx|app/src/components/admin/free/(FreeCredentials|FreeSupportPanel)\.tsx|app/src/components/admin/free/onboarding/FreeOnboardingWelcome\.tsx|app/src/components/admin/sponsored/.*\.tsx|app/src/lib/imageUploadOptimization\.ts|scripts/(run-preview-kawlink-sponsored-profile-v1-2026-09-17|test-sponsored-profile-contract|run-production-kawlink-sponsored-profile-v1-2026-09-18)\.(sh|mjs)|web/src/App\.tsx|web/src/components/sponsored/.*\.tsx)$'
UNEXPECTED="$(git diff --name-only github/main...HEAD | grep -Ev "$ALLOWED" || true)"
[ -z "$UNEXPECTED" ] || { echo "$UNEXPECTED"; fail "Hay archivos fuera del alcance aprobado"; }

run git diff --check github/main...HEAD
run npm ci
run node scripts/test-sponsored-profile-contract.mjs
run npm run build -w web
run npm run build -w app
run npx tsc --noEmit -p api/tsconfig.json
run npx esbuild api/src/preview-free-entry.ts --bundle --platform=node --format=esm --target=node20 --external:cloudflare:* --outfile=/tmp/kawvo-sponsored-production-api.mjs
run bash -lc 'cd api && npx wrangler deploy --config wrangler.toml --dry-run'

APP_MAIN_KB="$(find app/dist/assets -maxdepth 1 -type f -name 'index-*.js' -exec du -k {} + | sort -nr | awk 'NR==1{print $1}')"
WEB_MAIN_KB="$(find web/dist/assets -maxdepth 1 -type f -name 'index-*.js' -exec du -k {} + | sort -nr | awk 'NR==1{print $1}')"
echo "✓ Bundle App principal: ${APP_MAIN_KB:-0} KB"
echo "✓ Bundle Web principal: ${WEB_MAIN_KB:-0} KB"
[ "${APP_MAIN_KB:-99999}" -le 1450 ] || fail "Bundle App excede presupuesto de release (1450 KB)"
[ "${WEB_MAIN_KB:-99999}" -le 280 ] || fail "Bundle Web excede presupuesto de release (280 KB)"

echo; echo "▶ Consultar migraciones D1 Producción"
(
  cd api
  npx wrangler d1 migrations list "$PROD_DB" --remote --config wrangler.toml
) 2>&1 | tee "$MIGRATION_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "No pude consultar migraciones D1 Producción"

PREVIOUS_MAIN="$CURRENT_MAIN"
echo "✓ Punto de retorno de código: $PREVIOUS_MAIN"

echo; echo "▶ Aplicar migraciones D1 Producción"
(
  cd api
  npx wrangler d1 migrations apply "$PROD_DB" --remote --config wrangler.toml
) 2>&1 | tee -a "$MIGRATION_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Migraciones D1 Producción"

echo; echo "▶ Deploy Worker Producción"
(
  cd api
  npm run deploy:production
) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Producción"
WORKER_VERSION="$(grep -E 'Current Version ID:' "$WORKER_LOG" | tail -1 | sed -E 's/.*Current Version ID:[[:space:]]*//' || true)"

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
  "https://app.intaprd.com/superadmin/sponsors"
do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

code="$(curl -sS -o "$LOG_DIR/sponsor-api-smoke.json" -w '%{http_code}' https://app.intaprd.com/api/v1/public/sponsored/__qa_no_profile__)"
echo "✓ endpoint patrocinado inexistente -> HTTP $code"
[ "$code" = "404" ] || fail "Endpoint patrocinado no respondió 404 controlado"

echo; echo "▶ Promover release aprobado a main"
run git switch -C main github/main
run git merge --ff-only "github/$FEATURE_BRANCH"
run git push github main
PROD_SHA="$(git rev-parse HEAD)"

run git fetch github main
REMOTE_MAIN="$(git rev-parse github/main)"
[ "$REMOTE_MAIN" = "$PROD_SHA" ] || fail "main remoto no coincide con el SHA desplegado"

TAG="prod-kawlink-sponsored-v1-2026-09-18-$(date +%H%M%S)"
run git tag -a "$TAG" -m "KawLink Sponsored Profile V1 production 2026-09-18"
run git push github "$TAG"

rm -rf "$LOG_DIR"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "El runner dejó cambios locales"; }

cat <<EOF
============================================================
✓ KAWVO LINK · PERFIL PATROCINADO V1 · PRODUCCIÓN DESPLEGADA
============================================================
Production SHA: $PROD_SHA
Release tag:    $TAG
Previous main:  $PREVIOUS_MAIN
Worker Version: ${WORKER_VERSION:-ver salida Wrangler}
Web Pages:      ${WEB_ORIGIN:-ver salida Pages}
App Pages:      ${APP_ORIGIN:-ver salida Pages}

QA Producción:
- https://app.intaprd.com/superadmin/sponsors
- https://app.intaprd.com/admin/sponsored
- https://app.intaprd.com/admin/sponsor
- https://intaprd.com/p/<usuario>
- https://intaprd.com/l/<codigo>

Contrato, builds, presupuesto de bundle y smoke: APROBADOS
============================================================
EOF
