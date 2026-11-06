#!/usr/bin/env bash
# SAFE PREFLIGHT: no Production deployment, no D1/R2 writes, no migration.
set -euo pipefail
export NO_COLOR=1
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="release/kawvo-production-guarded-ownerbar-scan-2026-11-06"
WEB_BASE="444f3da79a85a87baa739f1eafac87891607885d"
APP_BASE="bd1b99ac3462ed772ad36dfdaa667f1da5fbb93e"
API_ACTIVE="a74d6e25-63c6-4c84-beac-3ad39ba723de"
fail(){ echo "DETENIDO: $*" >&2; exit 1; }
cd "$ROOT" || fail "No existe el repositorio habitual."
[[ -z "$(git status --porcelain)" ]] || fail "Archivos modificados o no registrados: no modificaré el checkout."
git fetch github "$BRANCH" main
git switch "$BRANCH"
git pull --ff-only github "$BRANCH"
git diff --check "$WEB_BASE"..HEAD
git merge-base --is-ancestor "$WEB_BASE" HEAD || fail "No deriva del Web actualmente publicado."
git merge-base --is-ancestor "$APP_BASE" HEAD || fail "No deriva de la App actualmente publicada."
[[ -z "$(git diff --name-only "$WEB_BASE"..HEAD -- api/migrations)" ]] || fail "Se modificaron migraciones."
[[ -z "$(git diff --name-only "$WEB_BASE"..HEAD -- app/.env.production web/.env.production api/src/lib/cookies.ts)" ]] || fail "Se modificó configuración sensible."
grep -Fxq 'name = "intap-api"' api/wrangler.toml || fail "Worker de destino incorrecto."
grep -Fxq 'main = "src/preview-free-entry.ts"' api/wrangler.toml || fail "Entry Production cambió."
grep -Fxq 'keep_vars = true' api/wrangler.toml || fail "NO publicar sin keep_vars=true."
grep -Fxq 'ENVIRONMENT = "production"' api/wrangler.toml || fail "Entorno incorrecto."
grep -Fxq 'database_name = "intap_db"' api/wrangler.toml || fail "D1 incorrecta."
grep -Fxq 'bucket_name = "intap-r2"' api/wrangler.toml || fail "R2 incorrecto."
grep -Fxq 'VITE_APP_URL=https://app.intaprd.com' web/.env.production || fail "App origin de Web incorrecto."
grep -Fxq 'VITE_API_URL=https://api.intaprd.com' web/.env.production || fail "API Web de Producción incorrecta."
WEB_CHANGED="$(git diff --name-only "$WEB_BASE"..HEAD -- web/)"
EXPECTED_WEB="$(printf '%s\n' \
  web/src/components/appointments/AppointmentOwnerBar.mobile.css \
  web/src/components/appointments/AppointmentOwnerBar.tsx \
  web/src/components/free-profile/FreePreviewEditShortcut.tsx \
  web/src/components/free-profile/IntapLinkGratisProfile.tsx \
  web/src/components/medical-profile/KawMedProfile.tsx \
  web/src/components/sponsored/SponsoredAwareArtifactResolver.tsx \
  web/src/components/sponsored/SponsoredProfile.tsx)"
[[ "$WEB_CHANGED" == "$EXPECTED_WEB" ]] || fail "El cambio Web ya no coincide con las 7 rutas aprobadas."
API_CHANGED="$(git diff --name-only "$WEB_BASE"..HEAD -- api/src/ api/wrangler.toml)"
EXPECTED_API="$(printf '%s\n' \
  api/src/free-appointments.ts \
  api/src/index.ts \
  api/src/kawmed-live-guest.ts \
  api/src/medical-access-codes.ts \
  api/src/sponsored-profiles.ts \
  api/src/sponsored-scan.ts \
  api/wrangler.toml)"
[[ "$API_CHANGED" == "$EXPECTED_API" ]] || fail "El cambio API/producción excede el alcance esperado."

mkdir -p "$HOME/intap-release-logs"
LOG_DIR="$(mktemp -d "$HOME/intap-release-logs/kawvo-prod-preflight-2026-11-06-XXXXXXXX")"
git rev-parse HEAD > "$LOG_DIR/source-commit.txt"
printf '%s\n' "$WEB_CHANGED" > "$LOG_DIR/changed-web.txt"
printf '%s\n' "$API_CHANGED" > "$LOG_DIR/changed-api.txt"
echo "===== Versiones ACTIVAS Cloudflare (lectura) ====="
(cd api && npx --no-install wrangler deployments list --name intap-api) 2>&1 | tee "$LOG_DIR/api-deployments.txt"
LAST_API="$(grep -Eo 'Version\(s\):[[:space:]]+\(100%\)[[:space:]]+[a-f0-9-]{36}' "$LOG_DIR/api-deployments.txt" | tail -n1 | grep -Eo '[a-f0-9-]{36}$' || true)"
[[ "$LAST_API" == "$API_ACTIVE" ]] || fail "La API cambió: versión activa=$LAST_API; esperada=$API_ACTIVE. No publicar."
npx --no-install wrangler pages deployment list --project-name intap-link --environment production > "$LOG_DIR/web-deployments.txt"
WEB_ROW="$(grep -F '│ Production' "$LOG_DIR/web-deployments.txt" | head -n1 || true)"
[[ "$WEB_ROW" == *'444f3da'* ]] || fail "Web Producción cambió; detener."
npx --no-install wrangler pages deployment list --project-name intap-web2 --environment production > "$LOG_DIR/app-deployments.txt"
APP_ROW="$(grep -F '│ Production' "$LOG_DIR/app-deployments.txt" | head -n1 || true)"
[[ "$APP_ROW" == *'bd1b99a'* ]] || fail "App Producción cambió; detener."

echo "===== Pruebas locales: Free, Sponsor, Master, KawMed, M/L/P ====="
npm ci
node scripts/test-free-ownerbar-multicuenta-middleware-2026-11-05.mjs
node scripts/test-free-multicuenta-ownerbar-preview-slot-2026-11-04.mjs
node scripts/test-owner-toolbar-contextual-icons-2026-11-04.mjs
node scripts/test-owner-toolbar-icons-multivariant-2026-11-04.mjs
node scripts/test-sponsored-activation-landing-cleanup-2026-11-04.mjs
node scripts/test-superadmin-sponsor-tenant-switch-2026-11-04.mjs
node scripts/test-all-master-physical-station-parity-2026-11-02.mjs
node scripts/test-nfc-physical-identifier-release.mjs
echo "===== Build real Production (SIN desplegar) ====="
(cd api && npx --no-install tsc --noEmit && npx --no-install wrangler deploy --config wrangler.toml --dry-run)
npm run web:build
MAIN_JS="$(grep -Eo '/assets/index-[A-Za-z0-9_-]+\.js' web/dist/index.html | head -n1 || true)"
[[ -n "$MAIN_JS" && -f "web/dist$MAIN_JS" ]] || fail "No se compiló el JS principal."
grep -R -l -F 'api.intaprd.com' web/dist/assets/*.js >/dev/null || fail "Falta API de Producción en el bundle Web."
shasum -a 256 "web/dist$MAIN_JS" > "$LOG_DIR/web-main-js.sha256"

echo "===== Verificación HTTP visitante sin sesión ====="
check(){ local label="$1" url="$2" expected="$3" status
  status="$(curl -sS --max-time 25 -o /dev/null -w '%{http_code}' "$url" || true)"
  printf '%s: HTTP %s\n' "$label" "$status" | tee -a "$LOG_DIR/status.txt"
  [[ " $expected " == *" $status "* ]] || fail "HTTP inesperado en $label"
}
check 'Web prod' 'https://intaprd.com/' '200 301 302'
check 'App prod' 'https://app.intaprd.com/admin/login' '200 301 302'
check 'API Free sin sesión' 'https://api.intaprd.com/api/v1/me/free/appointments/public-context?username=intap3' '401 403'
[[ -z "$(git status --porcelain)" ]] || fail "Cambios locales inesperados al terminar."
echo
echo "PREFLIGHT APROBADO. NO SE HA DESPLEGADO NADA A PRODUCCIÓN."
echo "API activa y rollback potencial: $LAST_API"
echo "Web base: $WEB_BASE | App no será modificada: $APP_BASE"
echo "Rama candidata: $(git rev-parse HEAD)"
echo "Log: $LOG_DIR"
