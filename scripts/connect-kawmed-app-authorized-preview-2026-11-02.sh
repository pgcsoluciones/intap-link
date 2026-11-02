#!/usr/bin/env bash
# KawMed #134 — updates ONLY Preview frontdoor to the verified current App Preview.
# Google OAuth remains on app.preview.intaprd.com; does not change Google credentials.
set -euo pipefail
umask 077
[[ "${KAWMED_PREVIEW_FRONTDOOR_APPROVED:-}" == "SI" ]] || {
 echo "Aprobación explícita requerida: KAWMED_PREVIEW_FRONTDOOR_APPROVED=SI"
 exit 1
}
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="fix/kawmed-live-invitation-pending-activation-2026-11-02"
BASE="444f3da79a85a87baa739f1eafac87891607885d"
APP_PAGES="https://qa-kawmed-guest-current-2026.intap-web2.pages.dev"
PREVIEW_APP="https://app.preview.intaprd.com"
cd "$ROOT"
[[ -z "$(git status --porcelain)" ]] || { echo "Hay cambios locales. Abortando."; exit 1; }
git fetch github "$BRANCH"
git switch "$BRANCH"
git pull --ff-only github "$BRANCH"
git merge-base --is-ancestor "$BASE" HEAD
git diff --check "$BASE"..HEAD
while IFS= read -r f; do
 case "$f" in
  api/src/kawmed-live-guest.ts|api/wrangler.preview.toml|scripts/test-kawmed-pending-live-invitation-2026-11-02.mjs|scripts/verify-kawmed-pending-live-invitation-2026-11-02.sh|scripts/deploy-preview-kawmed-pending-invitation-2026-11-02.sh|scripts/stage-current-kawmed-app-preview-2026-11-02.sh|scripts/connect-kawmed-app-authorized-preview-2026-11-02.sh) ;;
  *) echo "Archivo fuera del alcance: $f"; exit 1 ;;
 esac
done < <(git diff --name-only "$BASE"..HEAD)
[[ -z "$(git diff --name-only "$BASE"..HEAD -- app web)" ]] || { echo "App/Web cambiados inesperadamente."; exit 1; }
[[ "$(git diff --name-only "$BASE"..HEAD -- api | sort)" == "$(printf '%s\n' api/src/kawmed-live-guest.ts api/wrangler.preview.toml)" ]] || {
 echo "Se modificaron archivos API no previstos. Abortando."; exit 1;
}
[[ "$(git diff --numstat "$BASE"..HEAD -- api/wrangler.preview.toml)" == "$(printf '1\t1\tapi/wrangler.preview.toml')" ]] || {
 echo "Cambio de configuración mayor que una línea. Abortando."; exit 1;
}
grep -Fxq 'APP_PAGES_ORIGIN = "https://qa-kawmed-guest-current-2026.intap-web2.pages.dev"' api/wrangler.preview.toml
grep -Fxq 'WEB_PAGES_ORIGIN = "https://qa-kawmed-web-1025.intap-web2.pages.dev"' api/wrangler.preview.toml
grep -Fxq 'APP_URL = "https://app.preview.intaprd.com"' api/wrangler.preview.toml
grep -Fxq 'name = "intap-api-preview"' api/wrangler.preview.toml
grep -Fxq 'main = "src/preview-frontdoor-entry.ts"' api/wrangler.preview.toml
grep -Fxq 'database_name = "intap_db_preview"' api/wrangler.preview.toml
grep -Fxq 'VITE_API_URL=https://app.preview.intaprd.com' app/.env.preview
grep -Fxq 'VITE_WEB_URL=https://preview.intaprd.com' app/.env.preview

echo "===== Seguridad KawMed y compilación Preview ====="
node scripts/test-kawmed-pending-live-invitation-2026-11-02.mjs
node scripts/test-kawmed-live-guest-contract.mjs
node scripts/test-kawmed-isolation-contract.mjs
(cd api && npx --no-install tsc --noEmit && npx --no-install wrangler deploy --config wrangler.preview.toml --dry-run)
npm run build:preview -w app
MAIN_ASSET="$(grep -Eo '/assets/index-[A-Za-z0-9_-]+\.js' app/dist/index.html | head -1)"
[[ -n "$MAIN_ASSET" ]] || { echo "Bundle principal no encontrado"; exit 1; }
mkdir -p "$HOME/intap-release-logs"
LOG_DIR="$(mktemp -d "$HOME/intap-release-logs/kawmed-authorized-preview-XXXXXXXX")"
trap 'rm -f "$LOG_DIR"/oauth-before.headers "$LOG_DIR"/oauth-after.headers' EXIT

echo "===== Verificar Pages Preview ya publicada (sin login en Pages) ====="
curl -fsSL --max-time 30 "$APP_PAGES/" -o "$LOG_DIR/pages-index.html"
grep -Fq "$MAIN_ASSET" "$LOG_DIR/pages-index.html" || { echo "La rama Preview no sirve el bundle esperado. Abortando."; exit 1; }
curl -fsSL --max-time 30 "$APP_PAGES$MAIN_ASSET" -o "$LOG_DIR/pages-main.js"
cmp -s "app/dist$MAIN_ASSET" "$LOG_DIR/pages-main.js" || { echo "Pages JS distinto del build. Abortando."; exit 1; }

# Auth is on the approved custom domain, not a pages.dev staging hostname.
check_oauth(){
 local output="$1"
 curl -sS --max-time 25 -D "$output" -o /dev/null "$PREVIEW_APP/api/v1/auth/google/start"
 node - "$output" <<'NODE'
const fs = require('node:fs');
const contents = fs.readFileSync(process.argv[2],'utf8');
const status = contents.match(/^HTTP\/[\d.]+\s+(\d+)/mi);
const location = contents.match(/^location:\s*(\S+)/mi);
if(!status || status[1]!=='302' || !location)process.exit(1);
const target = new URL(location[1]);
if(target.origin!=='https://accounts.google.com' || target.searchParams.get('redirect_uri')!=='https://app.preview.intaprd.com/api/v1/auth/google/callback')process.exit(1);
console.log('Google OAuth Preview: redirección 302 y callback al dominio autorizado confirmados.');
NODE
}
check_anonymous(){
 local code
 code="$(curl -sS --max-time 25 -o /dev/null -w '%{http_code}' "$PREVIEW_APP/api/v1/me/kawmed/live-access/invalid-invitation" || true)"
 [[ "$code" == "401" ]] || { echo "Acceso anónimo $code en vez de 401; abortando."; return 1; }
}
check_oauth "$LOG_DIR/oauth-before.headers"
check_anonymous

echo "===== Publicar SOLO frontdoor del Worker Preview (no Pages, no D1) ====="
(cd api && npx --no-install wrangler deploy --config wrangler.preview.toml)

echo "===== Validación del dominio Google-autorizado ====="
curl -fsSL --max-time 30 -H 'Cache-Control: no-cache' "$PREVIEW_APP/superadmin/kawmed" -o "$LOG_DIR/authorized-index.html"
grep -Fq "$MAIN_ASSET" "$LOG_DIR/authorized-index.html" || {
 echo "Worker Preview desplegado, pero HTML no apunta al nuevo bundle. NO repetir automáticamente."; exit 1;
}
curl -fsSL --max-time 30 "$PREVIEW_APP$MAIN_ASSET" -o "$LOG_DIR/authorized-main.js"
cmp -s "app/dist$MAIN_ASSET" "$LOG_DIR/authorized-main.js" || {
 echo "Worker Preview desplegado, pero el bundle del dominio autorizado no coincide. NO repetir automáticamente."; exit 1;
}
check_oauth "$LOG_DIR/oauth-after.headers"
check_anonymous
echo "DOMINIO PREVIEW AUTORIZADO ACTUALIZADO Y VERIFICADO."
echo "Google OAuth: callback en app.preview.intaprd.com, sin cambios."
echo "Producción, D1 y Web pública sin cambios."
echo "Abrir https://app.preview.intaprd.com/superadmin/kawmed con Google."
