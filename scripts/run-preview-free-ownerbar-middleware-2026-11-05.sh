#!/usr/bin/env bash
# API Preview only; no Web/App Pages, data migration or Production.
set -euo pipefail
[[ "${KAWVO_FREE_MIDDLEWARE_PREVIEW_APPROVED:-}" == "SI" ]] || { echo "DETENIDO: requiere aprobación SI"; exit 1; }
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="fix/free-multicuenta-ownerbar-middleware-parity-2026-11-05"
BASE="0960b98e9311bb3ae15e9a7cfae3c36650ecc71a"
fail(){ echo "DETENIDO: $*" >&2; exit 1; }
cd "$ROOT" || fail "Repositorio no encontrado"
[[ -z "$(git status --porcelain)" ]] || fail "Hay cambios locales sin guardar"
git remote get-url github >/dev/null || fail "Falta el remoto github"
git fetch github "$BRANCH"
git switch "$BRANCH"
git pull --ff-only github "$BRANCH"
git merge-base --is-ancestor "$BASE" HEAD || fail "No incluye release previo"
git diff --check "$BASE"..HEAD
CHANGED="$(git diff --name-only "$BASE"..HEAD)"
for file in api/src/index.ts api/src/free-appointments.ts scripts/test-free-ownerbar-multicuenta-middleware-2026-11-05.mjs scripts/run-preview-free-ownerbar-middleware-2026-11-05.sh; do
  grep -Fxq "$file" <<< "$CHANGED" || fail "Falta archivo: $file"
done
[[ "$(printf '%s\n' "$CHANGED" | grep -c .)" -eq 4 ]] || fail "Archivos inesperados en el diff"
CFG="api/wrangler.preview.toml"
grep -Fxq 'name = "intap-api-preview"' "$CFG" || fail "Worker equivocado"
grep -Fxq 'main = "src/preview-frontdoor-entry.ts"' "$CFG" || fail "Entry equivocado"
grep -Fxq 'ENVIRONMENT = "preview"' "$CFG" || fail "Entorno equivocado"
grep -Fxq 'database_name = "intap_db_preview"' "$CFG" || fail "D1 equivocada"
grep -Fxq 'bucket_name = "intap-r2-preview"' "$CFG" || fail "R2 equivocado"
grep -Fxq 'APP_PAGES_ORIGIN = "https://qa-kawmed-guest-current-2026.intap-web2.pages.dev"' "$CFG" || fail "App Preview cambió"
grep -Fxq 'WEB_PAGES_ORIGIN = "https://qa-sponsor-scan-1104.intap-link.pages.dev"' "$CFG" || fail "Web Preview cambió"

echo "===== Pruebas API, sin publicar datos ====="
npm ci
node scripts/test-free-ownerbar-multicuenta-middleware-2026-11-05.mjs
node scripts/test-free-multicuenta-ownerbar-preview-slot-2026-11-04.mjs
node scripts/test-owner-toolbar-contextual-icons-2026-11-04.mjs
node scripts/test-owner-toolbar-icons-multivariant-2026-11-04.mjs
node scripts/test-sponsored-activation-landing-cleanup-2026-11-04.mjs
node scripts/test-superadmin-sponsor-tenant-switch-2026-11-04.mjs
node scripts/test-all-master-physical-station-parity-2026-11-02.mjs
(cd api && npx --no-install tsc --noEmit && npx --no-install wrangler deploy --config wrangler.preview.toml --dry-run)

mkdir -p "$HOME/intap-release-logs"
LOG_DIR="$(mktemp -d "$HOME/intap-release-logs/free-ownerbar-middleware-preview-XXXXXXXX")"
git rev-parse HEAD > "$LOG_DIR/commit.txt"
echo "===== Solo API Preview ====="
(cd api && npx --no-install wrangler deploy --config wrangler.preview.toml) 2>&1 | tee "$LOG_DIR/worker.log"
grep -Fq 'Uploaded intap-api-preview' "$LOG_DIR/worker.log" || fail "Worker incorrecto"
grep -Fq 'Current Version ID:' "$LOG_DIR/worker.log" || fail "Versión no confirmada"
grep -Fq 'preview.intaprd.com/*' "$LOG_DIR/worker.log" || fail "Falta la ruta Web Preview"
grep -Fq 'app.preview.intaprd.com/*' "$LOG_DIR/worker.log" || fail "Falta la ruta App Preview"
STATUS="$(curl -sS --max-time 25 -o "$LOG_DIR/free-no-session.txt" -w '%{http_code}' "https://app.preview.intaprd.com/api/v1/me/free/appointments/public-context?username=intap3" || true)"
[[ "$STATUS" == "401" || "$STATUS" == "403" ]] || fail "GET Free sin sesión dio HTTP $STATUS"
[[ -z "$(git status --porcelain)" ]] || fail "Cambios locales inesperados"
echo "API PREVIEW ACTUALIZADA. Web Pages, App, D1/R2 y Producción intactas."
echo "Acceso visitante al owner-context bloqueado: HTTP $STATUS."
echo "Validar en navegador autenticado /intap3, /beato2 y selector Multicuenta."
echo "Logs: $LOG_DIR"
