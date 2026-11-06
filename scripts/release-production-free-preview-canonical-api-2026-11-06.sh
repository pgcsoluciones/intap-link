#!/usr/bin/env bash
# Narrow API-only production hotfix: Free multicuenta browser preview navigation.
# No Pages (Web/App) deployment, no D1 migrations, no R2 writes.
set -euo pipefail

if [[ "$(printenv KAWVO_FREE_PREVIEW_PROD_APPROVED 2>/dev/null || true)" != "SI" ]]; then
  echo "DETENIDO: autorización explícita KAWVO_FREE_PREVIEW_PROD_APPROVED=SI requerida."
  exit 1
fi

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="fix/prod-free-preview-multicuenta-canonical-api-2026-11-06"
BASE="31d4a6614c8e33aad04efe89fc8d683b2c1c203c"
APPROVED_SOURCE="fa5cc07bab833019a838cefc90d593eab68f9942"
PREVIOUS_API="080aef90-bbcf-4fc5-ab78-d404a007ae5d"
fail(){ echo "DETENIDO: $*" >&2; exit 1; }

cd "$ROOT" || fail "No existe el repositorio habitual"
[[ -z "$(git status --porcelain)" ]] || fail "Hay cambios locales; conservarlos antes de continuar"
git remote get-url github >/dev/null || fail "No existe remoto github"
git fetch github "$BRANCH"
git switch "$BRANCH"
git pull --ff-only github "$BRANCH"
git merge-base --is-ancestor "$APPROVED_SOURCE" HEAD || fail "No desciende del código que pasó QA"
git diff --check "$BASE"..HEAD

RUNNER="scripts/release-production-free-preview-canonical-api-2026-11-06.sh"
POST_QA_FILES="$(git diff --name-only "$APPROVED_SOURCE"..HEAD)"
[[ "$POST_QA_FILES" == "$RUNNER" ]] || fail "Código de producto alterado después del QA, rechazar publicación"

CHANGED="$(git diff --name-only "$BASE"..HEAD)"
EXPECTED="$(printf '%s\n' \
  api/src/index.ts \
  api/wrangler.preview.toml \
  scripts/release-production-free-preview-canonical-api-2026-11-06.sh \
  scripts/run-preview-free-preview-canonical-api-2026-11-06.sh \
  scripts/test-free-preview-canonical-session-origin-2026-11-06.mjs)"
[[ "$CHANGED" == "$EXPECTED" ]] || { printf '%s\n' "$CHANGED"; fail "Archivos inesperados"; }

grep -Fxq 'name = "intap-api"' api/wrangler.toml || fail "Worker incorrecto"
grep -Fxq 'main = "src/preview-free-entry.ts"' api/wrangler.toml || fail "Entry Worker incorrecta"
grep -Fxq 'keep_vars = true' api/wrangler.toml || fail "Falta keep_vars"
grep -Fxq 'ENVIRONMENT = "production"' api/wrangler.toml || fail "Entorno incorrecto"
grep -Fxq 'database_name = "intap_db"' api/wrangler.toml || fail "D1 incorrecta"
grep -Fxq 'bucket_name = "intap-r2"' api/wrangler.toml || fail "R2 incorrecto"
grep -Fxq 'name = "intap-api-preview"' api/wrangler.preview.toml || fail "Preview config cambió"

mkdir -p "$HOME/intap-release-logs"
LOG="$(mktemp -d "$HOME/intap-release-logs/prod-free-preview-hotfix-2026-11-06-XXXXXXXX")"
git rev-parse HEAD > "$LOG/release-commit.txt"
printf '%s\n' "$PREVIOUS_API" > "$LOG/rollback-worker-version.txt"
echo "Log de release: $LOG"

check_version(){
  local expected="$1" active
  (cd api && npx --no-install wrangler deployments list --name intap-api) > "$LOG/production-api-versions.txt" 2>&1
  active="$(grep -Eo 'Version\(s\):[[:space:]]+\(100%\)[[:space:]]+[a-f0-9-]{36}' "$LOG/production-api-versions.txt" | tail -n1 | grep -Eo '[a-f0-9-]{36}$' || true)"
  [[ "$active" == "$expected" ]] || fail "API cambió: actual=$active; esperada=$expected"
}
check_pages(){
  local web app
  npx --no-install wrangler pages deployment list --project-name intap-link --environment production > "$LOG/production-web-versions.txt"
  web="$(grep -F '│ Production' "$LOG/production-web-versions.txt" | head -n1 || true)"
  # Wrangler Pages CLI imprime solo 7 caracteres del source commit (31d4a66),
  # no el prefijo de 8 usado en logs del release (31d4a661).
  # Fijamos ADEMÁS el deployment inmutable para no aceptar otra versión.
  [[ "$web" == *'│ main'* && "$web" == *'│ 31d4a66 '* && "$web" == *'1672b41a.intap-link.pages.dev'* ]] || fail "Web Producción cambió; no combinar versiones"
  npx --no-install wrangler pages deployment list --project-name intap-web2 --environment production > "$LOG/production-app-versions.txt"
  app="$(grep -F '│ Production' "$LOG/production-app-versions.txt" | head -n1 || true)"
  [[ "$app" == *'bd1b99a'* ]] || fail "App Producción cambió; no combinar versiones"
}
check_unauth(){
  local code
  code="$(curl -sS --max-time 25 -o /dev/null -w '%{http_code}' 'https://api.intaprd.com/api/v1/me/free/appointments/public-context?username=intap3' || true)"
  [[ "$code" == "401" || "$code" == "403" ]] || fail "Endpoint Free privado sin sesión: HTTP $code"
}
echo "===== Comprobaciones de seguridad del hotfix ====="
npm ci
node scripts/test-free-preview-canonical-session-origin-2026-11-06.mjs
node scripts/test-intapcard-active-account-contract.mjs
node scripts/test-free-ownerbar-multicuenta-middleware-2026-11-05.mjs
node scripts/test-free-multicuenta-ownerbar-preview-slot-2026-11-04.mjs
node scripts/test-sponsored-activation-landing-cleanup-2026-11-04.mjs
node scripts/test-all-master-physical-station-parity-2026-11-02.mjs
(cd api && npx --no-install tsc --noEmit && npx --no-install wrangler deploy --config wrangler.toml --dry-run)
check_version "$PREVIOUS_API"
check_pages
check_unauth
[[ -z "$(git status --porcelain)" ]] || fail "Cambios locales tras compilar; abortar"

echo "===== API Producción solamente ====="
echo "A partir de aquí, si falla algo, NO volver a ejecutar sin consultar el log."
(cd api && npx --no-install wrangler deploy --config wrangler.toml) 2>&1 | tee "$LOG/production-worker-deploy.txt"
grep -Fq 'Uploaded intap-api (' "$LOG/production-worker-deploy.txt" || fail "Cloudflare no confirmó subida del Worker"
NEW_VERSION="$(grep -Eo 'Current Version ID: [a-f0-9-]{36}' "$LOG/production-worker-deploy.txt" | tail -n1 | awk '{print $4}' || true)"
[[ "$NEW_VERSION" =~ ^[a-f0-9-]{36}$ ]] || fail "Worker publicado; no se pudo leer version. NO repetir"
echo "$NEW_VERSION" > "$LOG/new-worker-version.txt"
check_version "$NEW_VERSION"
check_unauth

echo "===== Prueba HTTP real de redirección HTML sin sesión ====="
EXPECTED_REDIRECT='https://api.intaprd.com/api/v1/me/free/profile-preview/intap3?full=1'
HTTP="$(curl -sS --max-time 30 -H 'Accept: text/html' -D "$LOG/free-preview-headers.txt" -o /dev/null -w '%{http_code}' 'https://app.intaprd.com/api/v1/me/free/profile-preview/intap3?full=1' || true)"
LOCATION="$(grep -i '^location:' "$LOG/free-preview-headers.txt" | tail -n1 | sed -E 's/^[Ll]ocation:[[:space:]]*//' | tr -d '\r' || true)"
[[ "$HTTP" == "302" && "$LOCATION" == "$EXPECTED_REDIRECT" ]] || fail "Worker se publicó pero redirección no coincide: HTTP=$HTTP Location=$LOCATION. No repetir sin revisar"
HTTP_CANONICAL="$(curl -sS --max-time 30 -H 'Accept: text/html' -o /dev/null -w '%{http_code}' "$EXPECTED_REDIRECT" || true)"
[[ "$HTTP_CANONICAL" == "401" || "$HTTP_CANONICAL" == "403" ]] || fail "Enlace destino sin sesión no protegido: HTTP $HTTP_CANONICAL"
check_pages
[[ -z "$(git status --porcelain)" ]] || fail "Checkout inesperadamente modificado"

echo
echo "HOTFIX API PRODUCCIÓN PUBLICADO: $NEW_VERSION"
echo "Redirección GET HTML app.intaprd.com a api.intaprd.com: HTTP $HTTP"
echo "Destinatario sin sesión permanece protegido: HTTP $HTTP_CANONICAL"
echo "Web/App Pages y D1/R2 sin modificaciones directas."
echo "QA AUTENTICADA PENDIENTE: multicuenta -> Free intap3 -> panel -> Vista previa, y editor iframe."
echo "Rollback manual: cd api && npx --no-install wrangler rollback $PREVIOUS_API --name intap-api"
echo "Logs: $LOG"
