#!/usr/bin/env bash
# PR #138: ONLY API Preview and App Pages Preview. No Production/D1/R2/Web changes.
set -euo pipefail
[[ "${KAWVO_LPM_PREVIEW_APPROVED:-}" == "SI" ]] || { echo "Falta KAWVO_LPM_PREVIEW_APPROVED=SI"; exit 1; }
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="fix/lp-physical-labels-superadmin-2026-11-04"
BASE="bd1b99ac3462ed772ad36dfdaa667f1da5fbb93e"
APP_ALIAS="https://qa-kawmed-guest-current-2026.intap-web2.pages.dev"
PREVIEW_APP="https://app.preview.intaprd.com"
fail(){ echo "ERROR: $*" >&2; exit 1; }
cd "$ROOT" || fail "No existe el repositorio en $ROOT"
[[ -z "$(git status --porcelain)" ]] || fail "Hay cambios locales; no modificar checkout."
git remote get-url github >/dev/null || fail "No existe el remoto github."
git fetch github "$BRANCH"
git switch "$BRANCH"
git pull --ff-only github "$BRANCH"
git merge-base --is-ancestor "$BASE" HEAD || fail "No contiene el release base."
git diff --check "$BASE"..HEAD
CHANGED="$(git diff --name-only "$BASE"..HEAD)"
while IFS= read -r file; do
  [[ -z "$file" ]] && continue
  case "$file" in
    api/src/index.ts|api/src/sponsored-profiles.ts|app/src/components/admin/SuperAdminArtifacts.tsx|app/src/components/admin/SuperAdminSponsors.tsx|scripts/test-lp-superadmin-physical-label-visibility-2026-11-04.mjs|scripts/run-preview-lp-physical-labels-2026-11-04.sh|scripts/run-production-lp-physical-labels-2026-11-04.sh) ;;
    *) fail "Archivo ajeno al PR #138: $file" ;;
  esac
done <<< "$CHANGED"
for f in api/src/index.ts api/src/sponsored-profiles.ts app/src/components/admin/SuperAdminArtifacts.tsx app/src/components/admin/SuperAdminSponsors.tsx scripts/test-lp-superadmin-physical-label-visibility-2026-11-04.mjs scripts/run-preview-lp-physical-labels-2026-11-04.sh scripts/run-production-lp-physical-labels-2026-11-04.sh; do
  grep -Fxq "$f" <<< "$CHANGED" || fail "Falta archivo esperado: $f"
done
[[ "$(git diff --numstat "$BASE"..HEAD -- api/src/index.ts)" == "$(printf '5\t3\tapi/src/index.ts')" ]] || fail "Cambio L API fuera del alcance."
[[ "$(git diff --numstat "$BASE"..HEAD -- api/src/sponsored-profiles.ts)" == "$(printf '1\t1\tapi/src/sponsored-profiles.ts')" ]] || fail "Cambio P API fuera del alcance."
[[ "$(git diff --numstat "$BASE"..HEAD -- app/src/components/admin/SuperAdminArtifacts.tsx)" == "$(printf '13\t8\tapp/src/components/admin/SuperAdminArtifacts.tsx')" ]] || fail "Cambio L App fuera del alcance."
[[ "$(git diff --numstat "$BASE"..HEAD -- app/src/components/admin/SuperAdminSponsors.tsx)" == "$(printf '3\t3\tapp/src/components/admin/SuperAdminSponsors.tsx')" ]] || fail "Cambio P App fuera del alcance."
[[ -z "$(git diff --name-only "$BASE"..HEAD -- web api/migrations)" ]] || fail "Web o migraciones inesperadas."
grep -Fxq 'name = "intap-api-preview"' api/wrangler.preview.toml || fail "Worker no es Preview."
grep -Fxq 'main = "src/preview-frontdoor-entry.ts"' api/wrangler.preview.toml || fail "Frontdoor Preview modificado."
grep -Fxq 'APP_URL = "https://app.preview.intaprd.com"' api/wrangler.preview.toml || fail "App URL incorrecta."
grep -Fxq 'APP_PAGES_ORIGIN = "https://qa-kawmed-guest-current-2026.intap-web2.pages.dev"' api/wrangler.preview.toml || fail "Alias Preview no coincide."
grep -Fxq 'database_name = "intap_db_preview"' api/wrangler.preview.toml || fail "D1 incorrecta."
grep -Fxq 'bucket_name = "intap-r2-preview"' api/wrangler.preview.toml || fail "R2 incorrecto."
grep -Fxq 'VITE_API_URL=https://app.preview.intaprd.com' app/.env.preview || fail "App no usa API Preview."

echo "===== Instalación, contratos, TypeScript y build Preview ====="
npm ci
node scripts/test-all-master-physical-station-parity-2026-11-02.mjs
node scripts/test-lp-superadmin-physical-label-visibility-2026-11-04.mjs
node scripts/test-nfc-physical-identifier-release.mjs
node scripts/test-med-physical-display-read-contract.mjs
node scripts/test-kawmed-code-accordion-contract.mjs
node scripts/test-intapcard-active-account-contract.mjs
(cd api && npx --no-install tsc --noEmit && npx --no-install wrangler deploy --config wrangler.preview.toml --dry-run)
npm run build:preview -w app
MAIN_ASSET="$(grep -Eo '/assets/index-[A-Za-z0-9_-]+\.js' app/dist/index.html | head -1 || true)"
[[ -n "$MAIN_ASSET" && -f "app/dist$MAIN_ASSET" ]] || fail "Bundle App no encontrado."
grep -R -l -F 'app.preview.intaprd.com' app/dist/assets/*.js >/dev/null || fail "Bundle App no corresponde a Preview."

mkdir -p "$HOME/intap-release-logs"
LOG_DIR="$(mktemp -d "$HOME/intap-release-logs/stations-lpm-preview-XXXXXXXX")"
echo "$(git rev-parse HEAD)" > "$LOG_DIR/commit.txt"
echo "===== Despliegue App Pages SOLO Preview ====="
npx --no-install wrangler pages deploy app/dist --project-name intap-web2 --branch qa-kawmed-guest-current-2026-11-02 --commit-hash "$(git rev-parse HEAD)" 2>&1 | tee "$LOG_DIR/pages.log"
curl -fsSL --max-time 30 -H 'Cache-Control: no-cache' "$APP_ALIAS/admin/sponsor/kawmed?tab=codes" -o "$LOG_DIR/app.html"
grep -Fq "$MAIN_ASSET" "$LOG_DIR/app.html" || fail "Alias Pages no apunta al nuevo bundle. No reintentar automáticamente."
curl -fsSL --max-time 30 "$APP_ALIAS$MAIN_ASSET" -o "$LOG_DIR/alias.js"
cmp -s "app/dist$MAIN_ASSET" "$LOG_DIR/alias.js" || fail "Bundle Pages difiere del local."

echo "===== Despliegue Worker SOLO Preview ====="
(cd api && npx --no-install wrangler deploy --config wrangler.preview.toml) 2>&1 | tee "$LOG_DIR/worker.log"
curl -fsSL --max-time 30 -H 'Cache-Control: no-cache' "$PREVIEW_APP/admin/sponsor/kawmed?tab=codes" -o "$LOG_DIR/frontdoor.html"
grep -Fq "$MAIN_ASSET" "$LOG_DIR/frontdoor.html" || fail "Frontdoor Preview no apunta al nuevo bundle."
curl -fsSL --max-time 30 "$PREVIEW_APP$MAIN_ASSET" -o "$LOG_DIR/frontdoor.js"
cmp -s "app/dist$MAIN_ASSET" "$LOG_DIR/frontdoor.js" || fail "Bundle en dominio Preview difiere del local."
ANON="$(curl -sS --max-time 25 -o /dev/null -w '%{http_code}' "$PREVIEW_APP/api/v1/sponsor/kawmed/overview" || true)"
[[ "$ANON" == "401" || "$ANON" == "403" ]] || fail "Endpoint privado retornó HTTP $ANON."
[[ -z "$(git status --porcelain)" ]] || fail "Archivos locales modificados inesperadamente."
echo "PREVIEW L/P/M ACTUALIZADO: $PREVIEW_APP/superadmin/products"
echo "API/App verificadas. Producción, D1, R2 y Web pública sin cambios."
echo "Próximo paso: QA autenticada L en /superadmin/products, P en /superadmin/sponsors, M en Master KawMed y multicuenta."
echo "Logs: $LOG_DIR"
