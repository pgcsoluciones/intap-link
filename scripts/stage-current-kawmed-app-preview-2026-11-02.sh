#!/usr/bin/env bash
# KawMed #134 — stage CURRENT App ONLY on isolated Pages Preview branch.
# No changes to app.preview domain, Worker, D1, public Web, or Production.
set -euo pipefail
[[ "${KAWMED_CURRENT_APP_PREVIEW_STAGING_APPROVED:-}" == "SI" ]] || {
 echo "Autorización requerida: KAWMED_CURRENT_APP_PREVIEW_STAGING_APPROVED=SI"
 exit 1
}
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="fix/kawmed-live-invitation-pending-activation-2026-11-02"
BASE="444f3da79a85a87baa739f1eafac87891607885d"
PAGES_BRANCH="qa-kawmed-guest-current-2026-11-02"
cd "$ROOT"
[[ -z "$(git status --porcelain)" ]] || { echo "Hay cambios locales. Abortando."; exit 1; }
git fetch github "$BRANCH"
git switch "$BRANCH"
git pull --ff-only github "$BRANCH"
git merge-base --is-ancestor "$BASE" HEAD
git diff --check "$BASE"..HEAD
while IFS= read -r f; do
  case "$f" in
    api/src/kawmed-live-guest.ts|scripts/test-kawmed-pending-live-invitation-2026-11-02.mjs|scripts/verify-kawmed-pending-live-invitation-2026-11-02.sh|scripts/deploy-preview-kawmed-pending-invitation-2026-11-02.sh|scripts/stage-current-kawmed-app-preview-2026-11-02.sh) ;;
    *) echo "Archivo fuera de alcance: $f"; exit 1 ;;
  esac
done < <(git diff --name-only "$BASE"..HEAD)
[[ -z "$(git diff --name-only "$BASE"..HEAD -- app web)" ]] || { echo "App/Web modificados inesperadamente."; exit 1; }
grep -Fxq 'VITE_API_URL=https://app.preview.intaprd.com' app/.env.preview
grep -Fxq 'VITE_WEB_URL=https://preview.intaprd.com' app/.env.preview
grep -Fq 'path="/superadmin/kawmed"' app/src/App.tsx
grep -Fq 'path="/admin/medical/demo/:token"' app/src/App.tsx
grep -Fq 'if(liveAccess)return <MedicalDashboard' app/src/components/admin/medical/KawMedDemoGuest.tsx
node scripts/test-kawmed-live-guest-contract.mjs
node scripts/test-kawmed-pending-live-invitation-2026-11-02.mjs
echo "===== Build App en modo PREVIEW ====="
npm run build:preview -w app
grep -R -l -F 'app.preview.intaprd.com' app/dist/assets/*.js >/dev/null || {
  echo "El bundle no incluye la API Preview. Abortando."; exit 1;
}
MAIN_ASSET="$(grep -Eo '/assets/index-[A-Za-z0-9_-]+\.js' app/dist/index.html | head -1)"
[[ -n "$MAIN_ASSET" ]] || { echo "Falta bundle principal App."; exit 1; }
mkdir -p "$HOME/intap-release-logs"
LOG_DIR="$(mktemp -d "$HOME/intap-release-logs/kawmed-app-preview-XXXXXXXX")"
echo "===== Publicando SOLO Pages Preview intap-web2, rama aislada ====="
echo "Log: $LOG_DIR"
npx --no-install wrangler pages deploy app/dist --project-name intap-web2 --branch "$PAGES_BRANCH" --commit-hash "$(git rev-parse HEAD)" 2>&1 | tee "$LOG_DIR/pages-staging.log"
ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$LOG_DIR/pages-staging.log" | tail -1 || true)"
[[ -n "$ORIGIN" ]] || { echo "No se pudo obtener URL inmutable; no repetir deploy automáticamente."; exit 1; }
curl -fsSL --max-time 30 "$ORIGIN/" -o "$LOG_DIR/immutable-index.html"
grep -Fq "$MAIN_ASSET" "$LOG_DIR/immutable-index.html" || { echo "La SPA remota no sirve el bundle nuevo."; exit 1; }
curl -fsSL --max-time 30 "$ORIGIN$MAIN_ASSET" -o "$LOG_DIR/immutable-main.js"
cmp -s "app/dist$MAIN_ASSET" "$LOG_DIR/immutable-main.js" || { echo "JS remoto distinto del build local."; exit 1; }
curl -fsSL --max-time 30 "$ORIGIN/superadmin/kawmed" -o "$LOG_DIR/kawmed-route.html"
grep -Fq "$MAIN_ASSET" "$LOG_DIR/kawmed-route.html" || { echo "La ruta KawMed no devuelve el bundle esperado."; exit 1; }
OLD_MAIN="$(curl -fsSL --max-time 30 -H 'Cache-Control: no-cache' 'https://app.preview.intaprd.com/superadmin' | grep -Eo '/assets/index-[A-Za-z0-9_-]+\.js' | head -1 || true)"
if [[ "$OLD_MAIN" == "$MAIN_ASSET" ]]; then
 echo "Frontdoor Preview actual: bundle principal ya coincide."
else
 echo "Frontdoor Preview actual: bundle principal DISTINTO del nuevo App."
fi
echo "APP PREVIEW ACTUAL AISLADA Y VERIFICADA: $ORIGIN"
echo "NO se cambió el dominio app.preview, Worker, D1 ni Producción."
echo "Pendiente: probar UI aislada y, con aprobación, actualizar origen del frontdoor Preview."
