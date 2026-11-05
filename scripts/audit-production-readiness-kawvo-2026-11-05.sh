#!/usr/bin/env bash
# READ ONLY. Never deploy to Production, change D1/R2, or touch branches.
set -euo pipefail
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="release/prod-readiness-kawvo-2026-11-05"
fail(){ printf 'DETENIDO: %s\n' "$*" >&2; exit 1; }
cd "$ROOT" || fail "No existe checkout esperado"
[[ -z "$(git status --porcelain)" ]] || fail "Hay archivos modificados: revisar primero"
git remote get-url github >/dev/null || fail "Remoto github no encontrado"
git fetch github "$BRANCH" main
git switch "$BRANCH"
git pull --ff-only github "$BRANCH"
git diff --check github/main..HEAD || fail "Hay errores de formato"
grep -Fxq 'name = "intap-api"' api/wrangler.toml || fail "Worker de Producción incorrecto"
grep -Fxq 'ENVIRONMENT = "production"' api/wrangler.toml || fail "ENVIRONMENT equivocado"
grep -Fxq 'database_name = "intap_db"' api/wrangler.toml || fail "BD de Producción incorrecta"
grep -Fxq 'bucket_name = "intap-r2"' api/wrangler.toml || fail "R2 de Producción incorrecto"
grep -Fxq 'name = "intap-api-preview"' api/wrangler.preview.toml || fail "No se encuentra Preview"
grep -Fxq 'WEB_PAGES_ORIGIN = "https://qa-sponsor-scan-1104.intap-link.pages.dev"' api/wrangler.preview.toml || fail "Origen Web de Preview inesperado"
mkdir -p "$HOME/intap-release-logs"
LOG_DIR="$(mktemp -d "$HOME/intap-release-logs/prod-readiness-2026-11-05-XXXXXXXX")"
git rev-parse HEAD > "$LOG_DIR/release-head.txt"
git rev-parse github/main > "$LOG_DIR/main-head.txt"
git diff --name-only github/main..HEAD > "$LOG_DIR/changed-vs-main.txt"
printf 'Rama de release: %s\nRama main: %s\n' "$(cat "$LOG_DIR/release-head.txt")" "$(cat "$LOG_DIR/main-head.txt")"
printf 'Diferencia de archivos vs main: %s\n' "$(wc -l < "$LOG_DIR/changed-vs-main.txt" | tr -d ' ')"
printf 'IMPORTANTE: esta diferencia incluye historial no consolidado y NO es una lista para desplegar completa.\n'

echo '===== Contratos de funciones y controles (sin deploy) ====='
node scripts/test-free-ownerbar-multicuenta-middleware-2026-11-05.mjs
node scripts/test-free-multicuenta-ownerbar-preview-slot-2026-11-04.mjs
node scripts/test-owner-toolbar-contextual-icons-2026-11-04.mjs
node scripts/test-owner-toolbar-icons-multivariant-2026-11-04.mjs
node scripts/test-sponsored-activation-landing-cleanup-2026-11-04.mjs
node scripts/test-lp-superadmin-physical-label-visibility-2026-11-04.mjs
node scripts/test-all-master-physical-station-parity-2026-11-02.mjs
node scripts/test-superadmin-sponsor-tenant-switch-2026-11-04.mjs
node scripts/test-nfc-physical-identifier-release.mjs

echo '===== Comprobaciones HTTP sin credenciales ====='
check_status(){
  local label="$1" url="$2" expected="$3" status
  status="$(curl -sS --max-time 25 -o /dev/null -w '%{http_code}' "$url" || true)"
  printf '%s: HTTP %s\n' "$label" "$status" | tee -a "$LOG_DIR/http-status.txt"
  [[ " $expected " == *" $status "* ]] || fail "Estado HTTP inesperado en $label"
}
check_status 'Producción Web' 'https://intaprd.com/' '200 301 302'
check_status 'Producción App' 'https://app.intaprd.com/admin/login' '200 301 302'
check_status 'Producción API privada' 'https://api.intaprd.com/api/v1/me/free/appointments/public-context?username=intap3' '401 403'
check_status 'Preview Web' 'https://preview.intaprd.com/' '200 301 302'
check_status 'Preview App' 'https://app.preview.intaprd.com/admin/login' '200 301 302'
check_status 'Preview API privada' 'https://app.preview.intaprd.com/api/v1/me/free/appointments/public-context?username=intap3' '401 403'

echo '===== Esquema D1 Producción, SOLO SELECT ====='
SQL="SELECT name FROM sqlite_master WHERE type='table' AND name IN ('intap_artifacts','sponsor_artifacts','sponsor_tenants','sponsored_profiles','artifact_display_identifiers','medical_display_identifiers','sponsor_sales_representatives','sponsor_sales_assignments','sponsor_commercial_resources') ORDER BY name;"
(cd api && npx --no-install wrangler d1 execute intap_db --remote --command "$SQL") 2>&1 | tee "$LOG_DIR/schema-tables.txt"
for table in intap_artifacts sponsor_artifacts sponsor_tenants sponsored_profiles artifact_display_identifiers medical_display_identifiers sponsor_sales_representatives sponsor_sales_assignments sponsor_commercial_resources; do
  grep -Fq "\"$table\"" "$LOG_DIR/schema-tables.txt" || grep -Fq "│ $table " "$LOG_DIR/schema-tables.txt" || fail "D1 Producción aún no confirma tabla $table; revisar migraciones antes de cualquier despliegue"
done

echo
echo 'LECTURA FINALIZADA. NO SE DESPLEGÓ NI ESCRIBIÓ EN PRODUCCIÓN.'
echo "Logs (solo auditoría): $LOG_DIR"
