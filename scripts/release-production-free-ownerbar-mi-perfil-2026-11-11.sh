#!/usr/bin/env bash
# API Production ONLY: Free owner toolbar «Mi perfil» -> /admin/free.
# No Web/App Pages deploy, no D1 migrations, no direct R2 operations.
set -euo pipefail
[[ "$(printenv KAWVO_FREE_OWNERBAR_PROD_APPROVED 2>/dev/null || true)" == "SI" ]] || {
  echo "DETENIDO: se requiere aprobación KAWVO_FREE_OWNERBAR_PROD_APPROVED=SI para API PRODUCCIÓN"
  exit 1
}
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="fix/free-ownerbar-mi-perfil-to-panel-2026-11-11"
BASE="34e7423d85ca4244ca267671dc536ad7c0c5502e"
QA_SOURCE="2286c937d9ce13422f22b289f5029343c2f5ae4c"
OLD_API="455539b8-cf84-41ee-b2fd-325f1c82dcf1"
OLD_WEB="1672b41a.intap-link.pages.dev"
OLD_APP="bd1b99a"
RUNNER="scripts/release-production-free-ownerbar-mi-perfil-2026-11-11.sh"
fail(){ echo "DETENIDO: $*" >&2; exit 1; }
cd "$ROOT" || fail "No se encuentra el repositorio"
[[ -z "$(git status --porcelain)" ]] || fail "Checkout con cambios; no se tocarán archivos locales"
git fetch github "$BRANCH"
git switch "$BRANCH"
git pull --ff-only github "$BRANCH"
git merge-base --is-ancestor "$QA_SOURCE" HEAD || fail "La rama no contiene el QA aprobado"
[[ "$(git diff --name-only "$QA_SOURCE"..HEAD)" == "$RUNNER" ]] || fail "Se modificó código validado después del QA"
git diff --check "$BASE"..HEAD
CHANGED="$(git diff --name-only "$BASE"..HEAD)"
EXPECTED="$(printf '%s\n' \
  api/src/free-appointments.ts \
  scripts/release-production-free-ownerbar-mi-perfil-2026-11-11.sh \
  scripts/run-preview-free-ownerbar-mi-perfil-2026-11-11.sh \
  scripts/test-free-ownerbar-mi-perfil-to-panel-2026-11-11.mjs \
  scripts/test-free-ownerbar-multicuenta-middleware-2026-11-05.mjs)"
[[ "$CHANGED" == "$EXPECTED" ]] || { printf '%s\n' "$CHANGED"; fail "Diff de release no autorizado"; }
[[ -z "$(git diff --name-only "$BASE"..HEAD -- api/migrations app/ web/ api/wrangler.toml)" ]] || fail "Cambios fuera de API Free o pruebas"
grep -Fxq 'name = "intap-api"' api/wrangler.toml || fail "Nombre de Worker no esperado"
grep -Fxq 'main = "src/preview-free-entry.ts"' api/wrangler.toml || fail "Entrypoint incorrecto"
grep -Fxq 'keep_vars = true' api/wrangler.toml || fail "No conservaría las variables del Worker"
grep -Fxq 'ENVIRONMENT = "production"' api/wrangler.toml || fail "No es Producción"
grep -Fxq 'database_name = "intap_db"' api/wrangler.toml || fail "D1 incorrecta"
grep -Fxq 'bucket_name = "intap-r2"' api/wrangler.toml || fail "R2 incorrecto"

mkdir -p "$HOME/intap-release-logs"
LOG="$(mktemp -d "$HOME/intap-release-logs/free-ownerbar-prod-2026-11-11-XXXXXXXX")"
printf '%s\n' "$OLD_API" > "$LOG/rollback-worker-version.txt"
git rev-parse HEAD > "$LOG/source-commit.txt"
echo "LOG: $LOG"
on_error(){
  echo "ATENCIÓN: Procedimiento detenido. Si el Worker ya se publicó, NO REEJECUTAR: revisar $LOG" >&2
}
trap on_error ERR

latest_worker(){
  local value
  (cd api && npx --no-install wrangler deployments list --name intap-api) > "$LOG/worker-versions.txt" 2>&1
  value="$(grep -Eo 'Version\(s\):[[:space:]]+\(100%\)[[:space:]]+[a-f0-9-]{36}' "$LOG/worker-versions.txt" | tail -n1 | grep -Eo '[a-f0-9-]{36}$' || true)"
  printf '%s' "$value"
}
check_web_app(){
  local web app
  npx --no-install wrangler pages deployment list --project-name intap-link --environment production > "$LOG/web-versions.txt"
  web="$(grep -F '│ Production' "$LOG/web-versions.txt" | head -n1 || true)"
  [[ "$web" == *'│ main'* && "$web" == *'│ 31d4a66 '* && "$web" == *"$OLD_WEB"* ]] || fail "Despliegue Web cambió; detener"
  npx --no-install wrangler pages deployment list --project-name intap-web2 --environment production > "$LOG/app-versions.txt"
  app="$(grep -F '│ Production' "$LOG/app-versions.txt" | head -n1 || true)"
  [[ "$app" == *"│ $OLD_APP "* ]] || fail "Despliegue App cambió; detener"
}
check_auth(){
  local code
  code="$(curl -sS --max-time 25 -o /dev/null -w '%{http_code}' 'https://api.intaprd.com/api/v1/me/free/appointments/public-context?username=intap3' || true)"
  [[ "$code" == "401" || "$code" == "403" ]] || fail "El endpoint privado sin sesión devolvió HTTP $code"
  echo "Control de sesión privado: HTTP $code"
}

echo "===== Tests y compilación ANTES de tocar Producción ====="
npm ci
node scripts/test-free-ownerbar-mi-perfil-to-panel-2026-11-11.mjs
node scripts/test-free-ownerbar-multicuenta-middleware-2026-11-05.mjs
node scripts/test-free-multicuenta-ownerbar-preview-slot-2026-11-04.mjs
node scripts/test-intapcard-active-account-contract.mjs
node scripts/test-free-preview-canonical-session-origin-2026-11-06.mjs
node scripts/test-owner-toolbar-contextual-icons-2026-11-04.mjs
node scripts/test-owner-toolbar-icons-multivariant-2026-11-04.mjs
(cd api && npx --no-install tsc --noEmit && npx --no-install wrangler deploy --config wrangler.toml --dry-run)
[[ -z "$(git status --porcelain)" ]] || fail "Compilación modificó el checkout"

echo "===== Comprobación en Cloudflare en vivo ====="
ACTIVE_API="$(latest_worker)"
[[ "$ACTIVE_API" == "$OLD_API" ]] || fail "Worker cambió: esperado $OLD_API, actual $ACTIVE_API"
check_web_app
check_auth

echo "===== Publicando SOLO Worker API Producción ====="
echo "Si se interrumpe desde aquí, NO repetir sin inspeccionar el log."
(cd api && npx --no-install wrangler deploy --config wrangler.toml) 2>&1 | tee "$LOG/worker-deploy.txt"
grep -Fq 'Uploaded intap-api (' "$LOG/worker-deploy.txt" || fail "No hay confirmación del Worker; puede estar publicado, inspeccionar log"
NEW_API="$(grep -Eo 'Current Version ID: [a-f0-9-]{36}' "$LOG/worker-deploy.txt" | tail -n1 | awk '{print $4}' || true)"
[[ "$NEW_API" =~ ^[a-f0-9-]{36}$ ]] || fail "Worker pudo publicarse sin identificador; NO repetir"
printf '%s\n' "$NEW_API" > "$LOG/new-worker-version.txt"
[[ "$(latest_worker)" == "$NEW_API" ]] || fail "La versión activa no coincide con el Worker recién publicado"
check_auth
check_web_app
[[ -z "$(git status --porcelain)" ]] || fail "Cambios inesperados de checkout"
echo
echo "HOTFIX MI PERFIL PRODUCCIÓN PUBLICADO: $NEW_API"
echo "Destino de Mi perfil (respuesta al dueño autenticado): /admin/free"
echo "Agenda: /admin/free/agenda; Mi cuenta: /admin/free/account"
echo "Web y App no se han desplegado; no hubo migraciones ni escrituras D1/R2 directas."
echo "QA pendiente en navegador: Multicuenta > Free > Vista previa > Mi perfil y menú móvil."
echo "Reversión manual Worker: cd api && npx --no-install wrangler rollback $OLD_API --name intap-api"
echo "Log: $LOG"
