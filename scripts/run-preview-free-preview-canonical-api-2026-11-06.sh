#!/usr/bin/env bash
# Preview-only QA for Production's cross-host Free profile-preview redirect.
set -euo pipefail
[[ "\${KAWVO_FREE_PREVIEW_QA_APPROVED:-}" == "SI" ]] || { echo "DETENIDO: requiere autorización SI para actualizar SOLO API Preview"; exit 1; }
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="fix/prod-free-preview-multicuenta-canonical-api-2026-11-06"
BASE="31d4a6614c8e33aad04efe89fc8d683b2c1c203c"
fail(){ echo "DETENIDO: $*" >&2; exit 1; }
cd "$ROOT" || fail "Repositorio habitual no existe"
[[ -z "$(git status --porcelain)" ]] || fail "Archivos locales sin guardar; no los modificaré."
git fetch github "$BRANCH"
git switch "$BRANCH"
git pull --ff-only github "$BRANCH"
git merge-base --is-ancestor "$BASE" HEAD || fail "No hereda release de Producción"
git diff --check "$BASE"..HEAD
CHANGED="$(git diff --name-only "$BASE"..HEAD)"
EXPECTED="$(printf '%s\n' \
  api/src/index.ts \
  api/wrangler.preview.toml \
  scripts/run-preview-free-preview-canonical-api-2026-11-06.sh \
  scripts/test-free-preview-canonical-session-origin-2026-11-06.mjs)"
[[ "$CHANGED" == "$EXPECTED" ]] || { printf 'Cambios detectados:\n%s\n' "$CHANGED"; fail "Diff fuera del alcance"; }
CFG="api/wrangler.preview.toml"
grep -Fxq 'name = "intap-api-preview"' "$CFG" || fail "Worker Preview distinto"
grep -Fxq 'main = "src/preview-frontdoor-entry.ts"' "$CFG" || fail "Entrada Preview distinta"
grep -Fxq 'keep_vars = true' "$CFG" || fail "Protección de variables no configurada"
grep -Fxq 'ENVIRONMENT = "preview"' "$CFG" || fail "No es Preview"
grep -Fxq 'database_name = "intap_db_preview"' "$CFG" || fail "D1 no es Preview"
grep -Fxq 'bucket_name = "intap-r2-preview"' "$CFG" || fail "R2 no es Preview"
grep -Fxq 'APP_PAGES_ORIGIN = "https://qa-kawmed-guest-current-2026.intap-web2.pages.dev"' "$CFG" || fail "App Pages Preview cambió"
grep -Fxq 'WEB_PAGES_ORIGIN = "https://qa-sponsor-scan-1104.intap-link.pages.dev"' "$CFG" || fail "Web Pages Preview cambió"
grep -Fxq 'keep_vars = true' api/wrangler.toml || fail "Protección de variables Production desapareció"
echo "===== Tests de aislamiento/cuenta + Free preview ====="
npm ci
node scripts/test-free-preview-canonical-session-origin-2026-11-06.mjs
node scripts/test-intapcard-active-account-contract.mjs
node scripts/test-free-ownerbar-multicuenta-middleware-2026-11-05.mjs
node scripts/test-free-multicuenta-ownerbar-preview-slot-2026-11-04.mjs
node scripts/test-sponsored-activation-landing-cleanup-2026-11-04.mjs
node scripts/test-all-master-physical-station-parity-2026-11-02.mjs
echo "===== Compilar API para Production y Preview SIN publicar ====="
(cd api && npx --no-install tsc --noEmit &&
  npx --no-install wrangler deploy --config wrangler.toml --dry-run &&
  npx --no-install wrangler deploy --config wrangler.preview.toml --dry-run)
mkdir -p "$HOME/intap-release-logs"
LOG_DIR="$(mktemp -d "$HOME/intap-release-logs/free-preview-canonical-api-qa-2026-11-06-XXXXXXXX")"
git rev-parse HEAD > "$LOG_DIR/commit.txt"
echo "===== Publicar SOLO Worker API Preview ====="
(cd api && npx --no-install wrangler deploy --config wrangler.preview.toml) 2>&1 | tee "$LOG_DIR/preview-worker.log"
grep -Fq 'Uploaded intap-api-preview' "$LOG_DIR/preview-worker.log" || fail "No se confirmó Worker Preview"
grep -Fq 'Current Version ID:' "$LOG_DIR/preview-worker.log" || fail "No se confirmó versión"
grep -Fq 'preview.intaprd.com/*' "$LOG_DIR/preview-worker.log" || fail "Ruta Web Preview ausente"
grep -Fq 'app.preview.intaprd.com/*' "$LOG_DIR/preview-worker.log" || fail "Ruta App Preview ausente"
CODE="$(curl -sS --max-time 25 -o /dev/null -w '%{http_code}' 'https://app.preview.intaprd.com/api/v1/me/free/profile-preview/intap3?full=1' || true)"
[[ "$CODE" == "401" || "$CODE" == "403" ]] || fail "Vista previa privada sin sesión respondió $CODE"
[[ -z "$(git status --porcelain)" ]] || fail "El checkout terminó con archivos modificados"
echo "PASS: corrección delimitada y API Preview desplegada. Producción, Pages App/Web, D1/R2 intactas."
echo "Worker Preview: $(grep -F 'Current Version ID:' "$LOG_DIR/preview-worker.log" | tail -n1)"
echo "Log: $LOG_DIR"
