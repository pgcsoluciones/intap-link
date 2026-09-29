#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/sponsored-banner-per-code"
EXPECTED_MAIN_SHA="dc7758f9b70cb8117146860b19270ff973d822bc"
APPROVED_PRODUCT_SHA="b70e26ca286434a99b04636f4c2773ceb140a02e"
RUNNER_PATH="scripts/run-production-sponsored-banner-quote-2026-09-29.sh"
PROD_DB="intap_db"
APP_PROJECT="intap-web2"
WEB_PROJECT="intap-link"
LOG_DIR="$ROOT/.production-sponsored-banner-quote-logs"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" && mkdir -p "$LOG_DIR"

cat <<EOF
============================================================
KAWVO LINK · PATROCINADO · CINTILLO + COTIZACIÓN · PRODUCCIÓN
============================================================
Incluye:
- cintillo patrocinado activable/desactivable por código beneficiario
- CTA Solicitar cotización / información
- formulario por WhatsApp o correo
- correo comercial del patrocinado
- correo visible en CRM patrocinador y Super Admin
- fix portable de Accesos adicionales
- firma KawLink siempre visible
- despliega API + Web + App
- aplica SOLO migraciones 0076 y 0077 si son las únicas pendientes
- smoke antes de promover main
============================================================
Main esperado:    $EXPECTED_MAIN_SHA
Preview aprobado: $APPROVED_PRODUCT_SHA
============================================================
EOF

run git fetch github main "$BRANCH"
CURRENT_MAIN="$(git rev-parse github/main)"
[ "$CURRENT_MAIN" = "$EXPECTED_MAIN_SHA" ] || fail "main cambió: esperado $EXPECTED_MAIN_SHA, actual $CURRENT_MAIN. Detener y auditar."

run git switch "$BRANCH"
run git pull --ff-only github "$BRANCH"
git restore -- "$RUNNER_PATH" 2>/dev/null || true
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Árbol local no limpio"; }

git merge-base --is-ancestor "$APPROVED_PRODUCT_SHA" HEAD || fail "El Preview aprobado ya no es ancestro"
POST_FILES="$(git diff --name-only "$APPROVED_PRODUCT_SHA"..HEAD | grep -v "^${RUNNER_PATH}$" || true)"
[ -z "$POST_FILES" ] || { echo "$POST_FILES"; fail "Hay cambios de producto posteriores al Preview aprobado"; }
git merge-base --is-ancestor github/main HEAD || fail "main y feature divergieron"

ALLOWED='^(api/migrations/0076_sponsored_banner_per_artifact\.sql|api/migrations/0077_sponsored_profile_email\.sql|api/migrations-preview/0075_sponsored_banner_per_artifact\.sql|api/migrations-preview/0076_sponsored_profile_email\.sql|api/src/sponsored-admin-extra\.ts|api/src/sponsored-profiles\.ts|api/src/sponsored-public\.ts|functions/_middleware\.ts|app/src/components/admin/SuperAdminSponsors\.tsx|app/src/components/admin/sponsored/SponsorDashboard\.tsx|app/src/components/admin/sponsored/SponsoredDashboard\.tsx|web/src/components/sponsored/SponsoredProfile\.tsx|scripts/test-sponsored-profile-contract\.mjs|scripts/run-preview-sponsored-banner-quote-2026-09-29\.sh|scripts/run-production-sponsored-banner-quote-2026-09-29\.sh)$'
UNEXPECTED="$(git diff --name-only github/main...HEAD | grep -Ev "$ALLOWED" || true)"
[ -z "$UNEXPECTED" ] || { echo "$UNEXPECTED"; fail "Hay archivos fuera del alcance aprobado"; }

run git diff --check github/main...HEAD

echo; echo "▶ Verificar configuración de Producción"
grep -Fq 'name = "intap-api"' api/wrangler.toml || fail "Worker de Producción incorrecto"
grep -Fq 'database_name = "intap_db"' api/wrangler.toml || fail "D1 de Producción incorrecta"
grep -Fq 'bucket_name = "intap-r2"' api/wrangler.toml || fail "R2 de Producción incorrecto"
grep -Fq 'APP_URL = "https://app.intaprd.com"' api/wrangler.toml || fail "APP_URL de Producción incorrecta"
grep -Fq 'WEB_URL = "https://intaprd.com"' api/wrangler.toml || fail "WEB_URL de Producción incorrecta"
grep -Fq 'VITE_API_URL=https://api.intaprd.com' web/.env.production || fail "Web API de Producción incorrecta"
grep -Fq 'VITE_APP_URL=https://app.intaprd.com' web/.env.production || fail "Web App de Producción incorrecta"
grep -Fq 'VITE_API_URL=https://api.intaprd.com' app/.env.production || fail "App API de Producción incorrecta"
grep -Fq 'VITE_WEB_URL=https://intaprd.com' app/.env.production || fail "App Web de Producción incorrecta"

run npm ci
run node scripts/test-sponsored-profile-contract.mjs
run npm run build -w web
run npm run build -w app
run bash -lc 'cd api && npx tsc --noEmit'
run bash -lc 'npx esbuild api/src/preview-free-entry.ts --bundle --platform=node --format=esm --target=node20 --external:cloudflare:* --outfile=/tmp/kawvo-sponsored-banner-quote-production-api.mjs'
run bash -lc 'cd api && npx wrangler deploy --config wrangler.toml --dry-run'

echo; echo "▶ Preflight D1 Producción"
(
  cd api
  npx wrangler d1 migrations list "$PROD_DB" --remote --config wrangler.toml
) 2>&1 | tee "$LOG_DIR/prod-migrations.log"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "No se pudieron listar migraciones Producción"

PENDING_PROD="$(grep -Eo '[0-9]{4}_[A-Za-z0-9._-]+\.sql' "$LOG_DIR/prod-migrations.log" | sort -u || true)"
EXPECTED_PENDING="$(printf '%s\n%s' '0076_sponsored_banner_per_artifact.sql' '0077_sponsored_profile_email.sql')"
[ "$PENDING_PROD" = "$EXPECTED_PENDING" ] || {
  echo "Pendientes detectadas:"
  echo "${PENDING_PROD:-ninguna/no reconocida}"
  fail "Producción debe tener pendientes únicamente 0076 y 0077 de este release"
}

echo; echo "▶ Aplicar migraciones 0076 + 0077 en D1 Producción"
(
  cd api
  npx wrangler d1 migrations apply "$PROD_DB" --remote --config wrangler.toml
) || fail "Migraciones Producción"

echo; echo "▶ Verificar esquema patrocinado en Producción"
BANNER_COL="$(cd api && npx wrangler d1 execute "$PROD_DB" --remote --config wrangler.toml --command "SELECT name FROM pragma_table_info('sponsor_artifacts') WHERE name='banner_enabled';" 2>/dev/null || true)"
EMAIL_COL="$(cd api && npx wrangler d1 execute "$PROD_DB" --remote --config wrangler.toml --command "SELECT name FROM pragma_table_info('sponsored_profiles') WHERE name='email';" 2>/dev/null || true)"
echo "$BANNER_COL" | grep -F 'banner_enabled' >/dev/null || fail "Falta banner_enabled después de migrar"
echo "$EMAIL_COL" | grep -F 'email' >/dev/null || fail "Falta email patrocinado después de migrar"
echo "✓ Esquema patrocinado verificado"

echo; echo "▶ Deploy API Producción"
(
  cd api
  npm run deploy:production
) 2>&1 | tee "$LOG_DIR/worker.log"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy API Producción"
WORKER_VERSION="$(grep -E 'Current Version ID:' "$LOG_DIR/worker.log" | tail -1 | sed -E 's/.*Current Version ID:[[:space:]]*//' || true)"

echo; echo "▶ Smoke API antes de UI"
code="$(curl -sS -o /dev/null -w '%{http_code}' https://intaprd.com/api/v1/public/sponsored/kawvo-release-smoke-no-existe)"
echo "✓ ruta pública patrocinada inexistente -> HTTP $code"
[ "$code" = "404" ] || fail "Ruta patrocinada esperaba HTTP 404, recibió $code"

echo; echo "▶ Deploy Web Producción"
(npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch main) 2>&1 | tee "$LOG_DIR/web.log"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Web Producción"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$LOG_DIR/web.log" | tail -1 || true)"

echo; echo "▶ Deploy App Producción"
(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch main) 2>&1 | tee "$LOG_DIR/app.log"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App Producción"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$LOG_DIR/app.log" | tail -1 || true)"

sleep 5
echo; echo "▶ Smoke Producción"
for url in \
  "https://intaprd.com/" \
  "https://app.intaprd.com/admin/login" \
  "https://app.intaprd.com/superadmin/sponsors" \
  "https://app.intaprd.com/admin/sponsor" \
  "https://app.intaprd.com/admin/sponsored"
do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

echo; echo "▶ Promover release validado a main"
run git switch -C main github/main
run git merge --ff-only "github/$BRANCH"
run git push github main
PROD_SHA="$(git rev-parse HEAD)"
run git fetch github main
[ "$(git rev-parse github/main)" = "$PROD_SHA" ] || fail "main remoto no coincide con lo desplegado"

TAG="prod-sponsored-banner-quote-2026-09-29-$(date +%H%M%S)"
run git tag -a "$TAG" -m "Sponsored banner per code and quote form production 2026-09-29"
run git push github "$TAG"

rm -rf "$LOG_DIR"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Runner dejó cambios locales"; }

cat <<EOF
============================================================
✓ PERFIL PATROCINADO DESPLEGADO EN PRODUCCIÓN
============================================================
Production SHA: $PROD_SHA
Release tag:    $TAG
Worker Version: ${WORKER_VERSION:-ver salida Wrangler}
Web Pages:      ${WEB_ORIGIN:-ver salida Pages}
App Pages:      ${APP_ORIGIN:-ver salida Pages}

Incluye:
✓ Cintillo Activo/Inactivo por código beneficiario
✓ Cotización / información por WhatsApp o correo
✓ Correo comercial del patrocinado
✓ Correo en CRM patrocinador y Super Admin
✓ Accesos adicionales sin dependencia de users.name
✓ Firma KawLink siempre visible
✓ Producción promovida a main
============================================================
EOF
