#!/usr/bin/env bash
# API Preview only, no Pages, no Production, no D1/R2 writes or migrations.
set -euo pipefail
[[ "$(printenv KAWVO_FREE_OWNERBAR_QA_APPROVED 2>/dev/null || true)" == "SI" ]] || { echo "DETENIDO: requiere KAWVO_FREE_OWNERBAR_QA_APPROVED=SI para API Preview"; exit 1; }
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="fix/free-ownerbar-mi-perfil-to-panel-2026-11-11"
BASE="34e7423d85ca4244ca267671dc536ad7c0c5502e"
OLD_PREVIEW_API="47966297-0e9a-4eaf-a644-02d70ffc6dc2"
fail(){ echo "DETENIDO: $*" >&2; exit 1; }
cd "$ROOT" || fail "Repositorio habitual no disponible"
[[ -z "$(git status --porcelain)" ]] || fail "Archivos locales pendientes: no cambio rama"
git fetch github "$BRANCH"
git switch "$BRANCH"
git pull --ff-only github "$BRANCH"
git merge-base --is-ancestor "$BASE" HEAD || fail "No deriva del hotfix Free ya publicado"
git diff --check "$BASE"..HEAD
CHANGED="$(git diff --name-only "$BASE"..HEAD)"
EXPECTED="$(printf '%s\n' \
 api/src/free-appointments.ts \
 scripts/run-preview-free-ownerbar-mi-perfil-2026-11-11.sh \
 scripts/test-free-ownerbar-mi-perfil-to-panel-2026-11-11.mjs \
 scripts/test-free-ownerbar-multicuenta-middleware-2026-11-05.mjs)"
[[ "$CHANGED" == "$EXPECTED" ]] || { printf "Cambios inesperados:\n%s\n" "$CHANGED"; fail "Alcance no aprobado"; }
grep -Fxq 'name = "intap-api-preview"' api/wrangler.preview.toml || fail "Worker distinto"
grep -Fxq 'main = "src/preview-frontdoor-entry.ts"' api/wrangler.preview.toml || fail "Entrada distinta"
grep -Fxq 'keep_vars = true' api/wrangler.preview.toml || fail "Falta conservación de variables"
grep -Fxq 'ENVIRONMENT = "preview"' api/wrangler.preview.toml || fail "Entorno incorrecto"
grep -Fxq 'database_name = "intap_db_preview"' api/wrangler.preview.toml || fail "D1 diferente"
grep -Fxq 'bucket_name = "intap-r2-preview"' api/wrangler.preview.toml || fail "R2 diferente"
mkdir -p "$HOME/intap-release-logs"
LOG="$(mktemp -d "$HOME/intap-release-logs/free-ownerbar-mi-perfil-qa-2026-11-11-XXXXXXXX")"
echo "Log: $LOG"
echo "===== Seguridad y regresión Free ====="
npm ci
node scripts/test-free-ownerbar-mi-perfil-to-panel-2026-11-11.mjs
node scripts/test-free-ownerbar-multicuenta-middleware-2026-11-05.mjs
node scripts/test-free-multicuenta-ownerbar-preview-slot-2026-11-04.mjs
node scripts/test-intapcard-active-account-contract.mjs
node scripts/test-free-preview-canonical-session-origin-2026-11-06.mjs
node scripts/test-owner-toolbar-contextual-icons-2026-11-04.mjs
node scripts/test-owner-toolbar-icons-multivariant-2026-11-04.mjs
echo "===== Compilación sin publicar ====="
(cd api && npx --no-install tsc --noEmit && npx --no-install wrangler deploy --config wrangler.preview.toml --dry-run && npx --no-install wrangler deploy --config wrangler.toml --dry-run)
echo "===== Reconfirmación Worker Preview ====="
(cd api && npx --no-install wrangler deployments list --name intap-api-preview) > "$LOG/preview-api-versions.txt" 2>&1
LATEST="$(grep -Eo 'Version\(s\):[[:space:]]+\(100%\)[[:space:]]+[a-f0-9-]{36}' "$LOG/preview-api-versions.txt" | tail -n1 | grep -Eo '[a-f0-9-]{36}$' || true)"
[[ "$LATEST" == "$OLD_PREVIEW_API" ]] || fail "API Preview cambió desde el último QA: $LATEST; no sobrescribir"
[[ -z "$(git status --porcelain)" ]] || fail "Cambios locales inesperados"
echo "===== Desplegando únicamente API Preview ====="
(cd api && npx --no-install wrangler deploy --config wrangler.preview.toml) 2>&1 | tee "$LOG/preview-worker-deploy.txt"
grep -Fq 'Uploaded intap-api-preview (' "$LOG/preview-worker-deploy.txt" || fail "Cloudflare no confirmó subida de API Preview"
NEW="$(grep -Eo 'Current Version ID: [a-f0-9-]{36}' "$LOG/preview-worker-deploy.txt" | tail -n1 | awk '{print $4}' || true)"
[[ "$NEW" =~ ^[a-f0-9-]{36}$ ]] || fail "Worker Preview pudo publicarse pero falta versión; no reintentar"
HTTP="$(curl -sS --max-time 25 -o /dev/null -w '%{http_code}' 'https://app.preview.intaprd.com/api/v1/me/free/appointments/public-context?username=intap3' || true)"
[[ "$HTTP" == 401 || "$HTTP" == 403 ]] || fail "La información privada sin sesión respondió HTTP $HTTP"
echo "PASS: API PREVIEW publicada $NEW. Endpoint privado sin sesión HTTP $HTTP."
echo "API/Web/App Producción, D1 y R2 sin modificaciones directas."
echo "Log: $LOG"
