#!/usr/bin/env bash
# Preview-only UI change: icons in owner toolbar, "Mi perfil" label.
# No Worker API deployment, D1/R2 writes, Production or NFC/QR changes.
set -euo pipefail
[[ "${KAWVO_OWNER_ICONS_PREVIEW_APPROVED:-}" == "SI" ]] || { echo "Falta aprobación KAWVO_OWNER_ICONS_PREVIEW_APPROVED=SI"; exit 1; }
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="fix/owner-toolbar-icons-mi-perfil-2026-11-04"
BASE="c195442a2d172e4d309411eaa97f877dcb9f41bd"
WEB_ALIAS="https://qa-sponsor-scan-1104.intap-link.pages.dev"
PUBLIC_PREVIEW="https://preview.intaprd.com"
fail(){ echo "DETENIDO: $*" >&2; exit 1; }

cd "$ROOT" || fail "No encuentro el repositorio habitual."
[[ -z "$(git status --porcelain)" ]] || fail "Hay cambios locales. No modificaré el checkout."
git remote get-url github >/dev/null || fail "No hay remoto github."
git fetch github "$BRANCH"
git switch "$BRANCH"
git pull --ff-only github "$BRANCH"
git merge-base --is-ancestor "$BASE" HEAD || fail "No incluye el release Web Preview validado."
git diff --check "$BASE"..HEAD

CHANGED="$(git diff --name-only "$BASE"..HEAD)"
while IFS= read -r file; do
  [[ -z "$file" ]] && continue
  case "$file" in
    web/src/components/appointments/AppointmentOwnerBar.tsx|\
    web/src/components/appointments/AppointmentOwnerBar.mobile.css|\
    web/src/components/medical-profile/KawMedProfile.tsx|\
    web/src/components/sponsored/SponsoredProfile.tsx|\
    scripts/test-owner-toolbar-contextual-icons-2026-11-04.mjs|\
    scripts/run-preview-owner-toolbar-icons-2026-11-04.sh) ;;
    *) fail "Archivo fuera de alcance: $file" ;;
  esac
done <<< "$CHANGED"
for file in web/src/components/appointments/AppointmentOwnerBar.tsx web/src/components/appointments/AppointmentOwnerBar.mobile.css web/src/components/medical-profile/KawMedProfile.tsx web/src/components/sponsored/SponsoredProfile.tsx scripts/test-owner-toolbar-contextual-icons-2026-11-04.mjs scripts/run-preview-owner-toolbar-icons-2026-11-04.sh; do
  grep -Fxq "$file" <<< "$CHANGED" || fail "Falta archivo previsto: $file"
done

grep -Fxq 'VITE_APP_URL=https://app.preview.intaprd.com' web/.env.preview || fail "App destino no es Preview."
grep -Fxq 'VITE_PUBLIC_ORIGIN=https://preview.intaprd.com' web/.env.preview || fail "Origen público no es Preview."
grep -Fxq "WEB_PAGES_ORIGIN = \"$WEB_ALIAS\"" api/wrangler.preview.toml || fail "Frontdoor Preview cambió; revisar antes de publicar."
grep -Fxq 'APP_PAGES_ORIGIN = "https://qa-kawmed-guest-current-2026.intap-web2.pages.dev"' api/wrangler.preview.toml || fail "App Preview cambió inesperadamente."

echo "===== Pruebas y compilación Web ====="
npm ci
node scripts/test-owner-toolbar-contextual-icons-2026-11-04.mjs
node scripts/test-sponsored-activation-landing-cleanup-2026-11-04.mjs
node scripts/test-all-master-physical-station-parity-2026-11-02.mjs
npm run build:preview -w web

# The owner toolbar is in a route-split chunk; verify built asset contents,
# not just index.html. Do not require a particular chunk hash.
grep -RlF 'Mi perfil' web/dist/assets >/dev/null || fail "El bundle no incluye Mi perfil."
grep -RlF 'Solicitudes de agenda' web/dist/assets >/dev/null || fail "El bundle no incluye la barra."
grep -RlF 'Activar después' web/dist/assets >/dev/null || fail "El build no conserva el scan-to-claim aprobado."
MAIN_JS="$(grep -Eo '/assets/index-[A-Za-z0-9_-]+\.js' web/dist/index.html | head -1 || true)"
[[ -n "$MAIN_JS" && -f "web/dist$MAIN_JS" ]] || fail "No existe entrada JS del build."
OWNER_JS="$(find web/dist/assets -maxdepth 1 -type f -name '*.js' -exec grep -l 'Solicitudes de agenda' {} + | head -1 || true)"
[[ -n "$OWNER_JS" ]] || fail "No se identifica bundle propietario."
OWNER_ASSET="/assets/$(basename "$OWNER_JS")"

mkdir -p "$HOME/intap-release-logs"
LOG_DIR="$(mktemp -d "$HOME/intap-release-logs/owner-icons-web-preview-XXXXXXXX")"
git rev-parse HEAD > "$LOG_DIR/commit.txt"

echo "===== Publicación SOLO en Pages Web Preview intap-link ====="
npx --no-install wrangler pages deploy web/dist --project-name intap-link --branch qa-sponsor-scan-1104 --commit-hash "$(git rev-parse HEAD)" 2>&1 | tee "$LOG_DIR/pages.log"
grep -Fq "$WEB_ALIAS" "$LOG_DIR/pages.log" || fail "Cloudflare no reportó el alias esperado."

check_bundle(){
  local origin="$1" suffix="$2" n
  for n in 1 2 3 4 5 6 7 8; do
    if curl -fsSL --max-time 30 -H 'Cache-Control: no-cache' "$origin/l/KVFWC2S2CQ" -o "$LOG_DIR/$suffix.html" &&
       grep -Fq "$MAIN_JS" "$LOG_DIR/$suffix.html"; then break; fi
    sleep 5
  done
  grep -Fq "$MAIN_JS" "$LOG_DIR/$suffix.html" || fail "HTML antiguo en $origin"
  curl -fsSL --max-time 35 "$origin$MAIN_JS" -o "$LOG_DIR/$suffix-main.js"
  cmp -s "web/dist$MAIN_JS" "$LOG_DIR/$suffix-main.js" || fail "Bundle principal distinto en $origin"
  curl -fsSL --max-time 35 "$origin$OWNER_ASSET" -o "$LOG_DIR/$suffix-owner.js"
  cmp -s "$OWNER_JS" "$LOG_DIR/$suffix-owner.js" || fail "Barra de propietario antigua en $origin"
}
check_bundle "$WEB_ALIAS" "pages"
check_bundle "$PUBLIC_PREVIEW" "public"
[[ -z "$(git status --porcelain)" ]] || fail "Hay cambios locales inesperados al finalizar."

echo "BARRA DE PROPIETARIO PREVIEW ACTUALIZADA: $PUBLIC_PREVIEW"
echo "Prueba manual: perfil KawMed + patrocinado, escritorio y móvil, y verificar enlaces."
echo "La Web pública y el frontdoor sirven los bundles correctos; API, App, Producción, D1 y R2 sin cambios."
echo "Logs: $LOG_DIR"
