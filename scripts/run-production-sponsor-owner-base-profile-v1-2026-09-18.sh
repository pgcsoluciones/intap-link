#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/sponsor-owner-base-profile-v1"
EXPECTED_MAIN_SHA="c61ca9e3bab8d65de75820f40e8959b5dc7c12ee"
APPROVED_PREVIEW_SHA="5230982a2f977546ffc37b41fd2a9a89e66e8e67"
RUNNER_PATH="scripts/run-production-sponsor-owner-base-profile-v1-2026-09-18.sh"
APP_PROJECT="intap-web2"
LOG_DIR="$ROOT/.production-sponsor-owner-base-profile-v1-logs"
APP_LOG="$LOG_DIR/app-pages-production.log"
WORKER_LOG="$LOG_DIR/worker-production.log"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" && mkdir -p "$LOG_DIR"

cat <<EOF
============================================================
KAWVO LINK · BASE PERFIL PATROCINADOR · PRODUCCIÓN
============================================================
- promueve exactamente el Preview aprobado
- NO aplica migraciones
- NO toca D1
- NO despliega Web pública
- cambia únicamente flujo Master/patrocinador
- beneficiario conserva starter por actividad
- compila App + API + contrato antes de tocar Producción
- despliega Worker + App
- smoke antes de promover main
============================================================
Main esperado:    $EXPECTED_MAIN_SHA
Preview aprobado: $APPROVED_PREVIEW_SHA
============================================================
EOF

run git fetch github main "$BRANCH"
CURRENT_MAIN="$(git rev-parse github/main)"
[ "$CURRENT_MAIN" = "$EXPECTED_MAIN_SHA" ] || fail "github/main cambió: esperado $EXPECTED_MAIN_SHA, actual $CURRENT_MAIN. Detener y auditar."

run git switch "$BRANCH"
run git pull --ff-only github "$BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Árbol local no limpio"; }

git merge-base --is-ancestor "$APPROVED_PREVIEW_SHA" HEAD || fail "El Preview aprobado ya no es ancestro"
POST_APPROVAL="$(git diff --name-only "$APPROVED_PREVIEW_SHA"..HEAD | grep -v "^${RUNNER_PATH}$" || true)"
[ -z "$POST_APPROVAL" ] || { echo "$POST_APPROVAL"; fail "Hay cambios de producto posteriores al Preview aprobado"; }

git merge-base --is-ancestor github/main HEAD || fail "main y feature divergieron"
[ "$(git rev-list --count HEAD..github/main)" = "0" ] || fail "La feature está detrás de main"

ALLOWED='^(api/src/sponsored-owner-profile-seed\.ts|api/src/sponsored-scan\.ts|api/src/sponsored-profiles\.ts|api/src/sponsored-starter\.ts|app/src/components/admin/sponsored/SponsoredStarterOnboarding\.tsx|app/src/components/admin/sponsored/SponsoredDashboard\.tsx|scripts/test-sponsored-profile-contract\.mjs|scripts/run-preview-sponsor-owner-base-profile-v1-2026-09-18\.sh|scripts/run-production-sponsor-owner-base-profile-v1-2026-09-18\.sh)$'
UNEXPECTED="$(git diff --name-only github/main...HEAD | grep -Ev "$ALLOWED" || true)"
[ -z "$UNEXPECTED" ] || { echo "$UNEXPECTED"; fail "Hay archivos fuera del alcance"; }

run git diff --check github/main...HEAD
run npm ci
run node scripts/test-sponsored-profile-contract.mjs
run npm run build -w app
run npx tsc --noEmit -p api/tsconfig.json
run npx esbuild api/src/preview-free-entry.ts --bundle --platform=node --format=esm --target=node20 --external:cloudflare:* --outfile=/tmp/kawvo-sponsor-owner-base-production-api.mjs
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
api_code="$(curl -sS -o "$LOG_DIR/sponsor-me.json" -w '%{http_code}' https://app.intaprd.com/api/v1/sponsor/me)"
echo "✓ /api/v1/sponsor/me sin sesión -> HTTP $api_code"
[ "$api_code" = "401" ] || fail "sponsor/me sin sesión no respondió 401"

echo; echo "▶ Promover release a main"
run git switch -C main github/main
run git merge --ff-only "github/$BRANCH"
run git push github main
PROD_SHA="$(git rev-parse HEAD)"
run git fetch github main
[ "$(git rev-parse github/main)" = "$PROD_SHA" ] || fail "main remoto no coincide con el SHA desplegado"

TAG="prod-sponsor-owner-base-profile-v1-2026-09-18-$(date +%H%M%S)"
run git tag -a "$TAG" -m "Sponsor owner base profile V1 production 2026-09-18"
run git push github "$TAG"

rm -rf "$LOG_DIR"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Runner dejó cambios locales"; }

cat <<EOF
============================================================
✓ BASE PERFIL PATROCINADOR DESPLEGADA EN PRODUCCIÓN
============================================================
Production SHA: $PROD_SHA
Release tag:    $TAG
Worker Version: ${WORKER_VERSION:-ver salida Wrangler}
App Pages:      ${APP_ORIGIN:-ver salida Pages}

API + App:      DESPLEGADOS
D1/Migraciones: NO TOCADOS
Web pública:    NO TOCADA
Smoke:          APROBADO
============================================================
EOF
