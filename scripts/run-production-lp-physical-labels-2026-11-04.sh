#!/usr/bin/env bash
# Kawvo / PR #138. Production release gated on QA-approved L/P physical labels and M regression.
# Deploy targets: ONLY intap-api Worker + intap-web2 App Pages. No public Web, D1/R2 writes or migrations.
set -euo pipefail
[[ "${KAWVO_LPM_PRODUCTION_APPROVED:-}" == "SI" ]] || {
  echo "FALTA APROBACIÓN: KAWVO_LPM_PRODUCTION_APPROVED=SI"
  exit 1
}
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="fix/lp-physical-labels-superadmin-2026-11-04"
BASE="bd1b99ac3462ed772ad36dfdaa667f1da5fbb93e"
PROD_APP="https://app.intaprd.com"
PROD_API="https://api.intaprd.com"
fail(){ echo "DETENIDO: $*" >&2; exit 1; }

cd "$ROOT" || fail "No está el repositorio habitual: $ROOT"
[[ -z "$(git status --porcelain)" ]] || fail "El checkout tiene cambios locales sin guardar."
git remote get-url github >/dev/null || fail "No existe remoto github."
git fetch github "$BRANCH"
git switch "$BRANCH"
git pull --ff-only github "$BRANCH"
git merge-base --is-ancestor "$BASE" HEAD || fail "Falta el release base aprobado."
git diff --check "$BASE"..HEAD

# All changes relative to the approved Nov 2 release must be precisely scoped.
CHANGED="$(git diff --name-only "$BASE"..HEAD)"
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  case "$f" in
    api/src/index.ts|\
    api/src/sponsored-profiles.ts|\
    app/src/components/admin/KawMedClaim.tsx|\
    app/src/components/admin/SuperAdminArtifacts.tsx|\
    app/src/components/admin/SuperAdminSponsors.tsx|\
    scripts/test-lp-superadmin-physical-label-visibility-2026-11-04.mjs|\
    scripts/test-superadmin-sponsor-tenant-switch-2026-11-04.mjs|\
    scripts/run-preview-lp-physical-labels-2026-11-04.sh|\
    scripts/run-production-lp-physical-labels-2026-11-04.sh) ;;
    *) fail "Archivo inesperado respecto al release aprobado: $f" ;;
  esac
done <<< "$CHANGED"
for f in api/src/index.ts api/src/sponsored-profiles.ts app/src/components/admin/KawMedClaim.tsx app/src/components/admin/SuperAdminArtifacts.tsx app/src/components/admin/SuperAdminSponsors.tsx scripts/test-lp-superadmin-physical-label-visibility-2026-11-04.mjs scripts/test-superadmin-sponsor-tenant-switch-2026-11-04.mjs scripts/run-preview-lp-physical-labels-2026-11-04.sh scripts/run-production-lp-physical-labels-2026-11-04.sh; do
  grep -Fxq "$f" <<< "$CHANGED" || fail "Falta archivo requerido: $f"
done
[[ "$(git diff --numstat "$BASE"..HEAD -- api/src/index.ts)" == "$(printf '5\t3\tapi/src/index.ts')" ]] || fail "Cambio L API fuera del alcance."
[[ "$(git diff --numstat "$BASE"..HEAD -- api/src/sponsored-profiles.ts)" == "$(printf '1\t1\tapi/src/sponsored-profiles.ts')" ]] || fail "Cambio P API fuera del alcance."
[[ "$(git diff --numstat "$BASE"..HEAD -- app/src/components/admin/SuperAdminArtifacts.tsx)" == "$(printf '13\t8\tapp/src/components/admin/SuperAdminArtifacts.tsx')" ]] || fail "Cambio L App fuera del alcance."
[[ "$(git diff --numstat "$BASE"..HEAD -- app/src/components/admin/KawMedClaim.tsx)" == "$(printf '1\t1\tapp/src/components/admin/KawMedClaim.tsx')" ]] || fail "Salida KawMed fuera del alcance."
[[ "$(git diff --numstat "$BASE"..HEAD -- app/src/components/admin/SuperAdminSponsors.tsx)" == "$(printf '96\t7\tapp/src/components/admin/SuperAdminSponsors.tsx')" ]] || fail "Cambio P App fuera del alcance."
[[ -z "$(git diff --name-only "$BASE"..HEAD -- api/migrations api/wrangler.toml api/wrangler.preview.toml web)" ]] || fail "Se han introducido migraciones o cambios de configuración/Web inesperados."

# Production must not accidentally use the Preview D1/R2/Worker.
grep -Fxq 'name = "intap-api"' api/wrangler.toml || fail "Worker no es intap-api."
grep -Fxq 'main = "src/preview-free-entry.ts"' api/wrangler.toml || fail "Entry point producción distinto."
grep -Fxq 'ENVIRONMENT = "production"' api/wrangler.toml || fail "No es entorno producción."
grep -Fxq 'APP_URL = "https://app.intaprd.com"' api/wrangler.toml || fail "APP_URL no es Producción."
grep -Fxq 'WEB_URL = "https://intaprd.com"' api/wrangler.toml || fail "WEB_URL no es Producción."
grep -Fxq 'database_name = "intap_db"' api/wrangler.toml || fail "D1 de Producción incorrecta."
grep -Fxq 'database_id = "3a2d724d-5938-4777-a63e-423bb41862c0"' api/wrangler.toml || fail "ID D1 incorrecto."
grep -Fxq 'bucket_name = "intap-r2"' api/wrangler.toml || fail "R2 de Producción incorrecto."
grep -Fxq 'VITE_API_URL=https://api.intaprd.com' app/.env.production || fail "App build no apunta a API Producción."

check_private(){
  local status
  status="$(curl -sS --max-time 25 -o /dev/null -w '%{http_code}' "$PROD_API/api/v1/sponsor/kawmed/overview" || true)"
  [[ "$status" == "401" || "$status" == "403" ]] || fail "El endpoint privado devolvió HTTP $status, esperado 401/403."
}
echo "===== QA local de paridad M/P/L (sin deploy) ====="
npm ci
node scripts/test-all-master-physical-station-parity-2026-11-02.mjs
node scripts/test-lp-superadmin-physical-label-visibility-2026-11-04.mjs
node scripts/test-superadmin-sponsor-tenant-switch-2026-11-04.mjs
node scripts/test-nfc-physical-identifier-release.mjs
node scripts/test-med-physical-display-read-contract.mjs
node scripts/test-kawmed-code-accordion-contract.mjs
node scripts/test-intapcard-active-account-contract.mjs
node scripts/test-kawmed-isolation-contract.mjs
(cd api && npx --no-install tsc --noEmit && npx --no-install wrangler deploy --config wrangler.toml --dry-run)
npm run build -w app
MAIN_ASSET="$(grep -Eo '/assets/index-[A-Za-z0-9_-]+\.js' app/dist/index.html | head -1 || true)"
[[ -n "$MAIN_ASSET" && -f "app/dist$MAIN_ASSET" ]] || fail "Falta bundle compilado de App."
grep -R -l -F 'api.intaprd.com' app/dist/assets/*.js >/dev/null || fail "El JS compilado no apunta a API Producción."
echo "===== Estado previo de seguridad en Producción ====="
check_private

mkdir -p "$HOME/intap-release-logs"
LOG_DIR="$(mktemp -d "$HOME/intap-release-logs/stations-lpm-production-XXXXXXXX")"
git rev-parse HEAD > "$LOG_DIR/commit.txt"
echo "Log del release: $LOG_DIR"
echo "===== Despliegue SOLO de Worker API Producción ====="
(cd api && npx --no-install wrangler deploy --config wrangler.toml) 2>&1 | tee "$LOG_DIR/api.log"
check_private

echo "===== Despliegue SOLO de App Pages Producción ====="
npx --no-install wrangler pages deploy app/dist --project-name intap-web2 --branch main --commit-hash "$(git rev-parse HEAD)" 2>&1 | tee "$LOG_DIR/app.log"
curl -fsSL --max-time 30 -H 'Cache-Control: no-cache' "$PROD_APP/admin/sponsor/kawmed?tab=codes" -o "$LOG_DIR/prod-index.html"
grep -Fq "$MAIN_ASSET" "$LOG_DIR/prod-index.html" || fail "Producción publicada, pero App HTML aún no refiere al bundle correcto. No repetir automáticamente."
curl -fsSL --max-time 30 "$PROD_APP$MAIN_ASSET" -o "$LOG_DIR/app-bundle.js"
cmp -s "app/dist$MAIN_ASSET" "$LOG_DIR/app-bundle.js" || fail "El JS de Producción no coincide byte a byte con el compilado."
check_private
[[ -z "$(git status --porcelain)" ]] || fail "Checkout terminó con cambios locales inesperados."
echo "PRODUCCIÓN L/P/M ACTUALIZADA: $PROD_APP/superadmin/products"
echo "Worker intap-api + App Pages intap-web2. Web pública, D1, R2 y migraciones sin modificaciones."
echo "Validar generación e inventario L en /superadmin/products, P en /superadmin/sponsors y M sin regresión, además de multicuenta."
echo "Logs: $LOG_DIR"
