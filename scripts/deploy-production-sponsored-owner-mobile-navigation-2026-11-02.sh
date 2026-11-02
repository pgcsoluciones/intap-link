#!/usr/bin/env bash
# #133 — Web-only owner navigation release, respecting previously restored owner bar.
# Touches Cloudflare Pages intap-link ONLY; no app, API, D1, Preview or migrations.
set -euo pipefail
[[ "${KAWVO_SPONSORED_MOBILE_WEB_DEPLOY_APPROVED:-}" == "SI" ]] || {
  echo "Se requiere aprobación: KAWVO_SPONSORED_MOBILE_WEB_DEPLOY_APPROVED=SI."
  exit 1
}
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="fix/sponsored-owner-edit-mobile-menu-2026-11-02"
BASE="17e00516852e7492aba90a51b357c21b792a3d40"
cd "$ROOT"
[[ -z "$(git status --porcelain)" ]] || { echo "Hay cambios locales; NO desplegar."; exit 1; }
git fetch github "$BRANCH"
git switch "$BRANCH"
git pull --ff-only github "$BRANCH"
git merge-base --is-ancestor "$BASE" HEAD
git diff --check "$BASE"..HEAD

while IFS= read -r file; do
  case "$file" in
    web/src/components/sponsored/SponsoredProfile.tsx|web/src/components/appointments/AppointmentOwnerBar.tsx|web/src/components/appointments/AppointmentOwnerBar.mobile.css|scripts/test-sponsored-owner-mobile-navigation-2026-11-02.mjs|scripts/verify-sponsored-owner-mobile-navigation-2026-11-02.sh|scripts/deploy-production-sponsored-owner-mobile-navigation-2026-11-02.sh) ;;
    *) echo "Archivo inesperado en rama Web: $file"; exit 1 ;;
  esac
done < <(git diff --name-only "$BASE"..HEAD)

EXPECTED_WEB_FILES="$(printf '%s\n' web/src/components/appointments/AppointmentOwnerBar.mobile.css web/src/components/appointments/AppointmentOwnerBar.tsx web/src/components/sponsored/SponsoredProfile.tsx)"
ACTUAL_WEB_FILES="$(git diff --name-only "$BASE"..HEAD -- web | sort)"
[[ "$ACTUAL_WEB_FILES" == "$EXPECTED_WEB_FILES" ]] || { echo "Diff Web fuera del alcance autorizado."; exit 1; }
[[ -z "$(git diff --name-only "$BASE"..HEAD -- api app)" ]] || { echo "Cambios en API/App detectados: NO desplegar."; exit 1; }

# Guard exact single-line prop change in sponsor and single CSS import in shared bar.
EXPECTED_SPONSOR="$(printf '1\t1\tweb/src/components/sponsored/SponsoredProfile.tsx')"
EXPECTED_BAR="$(printf '1\t0\tweb/src/components/appointments/AppointmentOwnerBar.tsx')"
[[ "$(git diff --numstat "$BASE"..HEAD -- web/src/components/sponsored/SponsoredProfile.tsx)" == "$EXPECTED_SPONSOR" ]] || { echo "Perfil patrocinado cambiado fuera de alcance."; exit 1; }
[[ "$(git diff --numstat "$BASE"..HEAD -- web/src/components/appointments/AppointmentOwnerBar.tsx)" == "$EXPECTED_BAR" ]] || { echo "Barra compartida cambiada fuera de alcance."; exit 1; }

echo "===== Contratos, aislamiento y edición móvil ====="
node scripts/test-sponsored-owner-mobile-navigation-2026-11-02.mjs
node scripts/test-owner-bar-api-origin-multicuenta-2026-11-01.mjs
node scripts/test-sponsored-owner-commercial-links-2026-11-02.mjs
node scripts/test-sponsored-owner-context-denial-2026-11-01.mjs

echo "===== Compilación Web, sin cambios API o D1 ====="
(cd web && npm run build)
MAIN_ASSET="$(grep -Eo '/assets/index-[A-Za-z0-9_-]+\.js' web/dist/index.html | head -1)"
[[ -n "$MAIN_ASSET" ]] || { echo "No se encontró bundle principal."; exit 1; }
OWNER_JS="$(find web/dist/assets -maxdepth 1 -type f -name 'AppointmentOwnerBar-*.js' | head -1)"
OWNER_CSS="$(find web/dist/assets -maxdepth 1 -type f -name 'AppointmentOwnerBar-*.css' | head -1)"
SPONSORED_JS="$(find web/dist/assets -maxdepth 1 -type f -name 'SponsoredProfile-*.js' | head -1)"
[[ -n "$OWNER_JS" && -n "$OWNER_CSS" && -n "$SPONSORED_JS" ]] || { echo "Faltan assets de barra, CSS o perfil."; exit 1; }
grep -Fq '.kawmed-owner-header__mobile-menu' "$OWNER_CSS" || { echo "CSS responsive ausente."; exit 1; }
grep -Fq 'Editar mi perfil' "$SPONSORED_JS" || { echo "Etiqueta Edición ausente del JS patrocinado."; exit 1; }
grep -Fq 'api.intaprd.com' "$OWNER_JS" || { echo "Se perdió la corrección de cookie/host API."; exit 1; }

mkdir -p "$HOME/intap-release-logs"
LOG_DIR="$(mktemp -d "$HOME/intap-release-logs/sponsor-mobile-XXXXXXXX")"
echo "Publicando SOLO Web pública: Pages intap-link, rama principal."
echo "Log de publicación: $LOG_DIR"
npx --no-install wrangler pages deploy web/dist --project-name intap-link --branch main --commit-hash "$(git rev-parse HEAD)" 2>&1 | tee "$LOG_DIR/pages-deploy.log"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$LOG_DIR/pages-deploy.log" | tail -1 || true)"
[[ -n "$WEB_ORIGIN" ]] || { echo "Deploy reportó éxito, pero no se pudo extraer URL inmutable; no repetir deploy automáticamente."; exit 1; }

verify_assets(){
  local origin="$1" tag="$2" index="$3"
  curl -fsSL --max-time 30 -H 'Cache-Control: no-cache' "$origin/?sponsor_mobile_release=$(git rev-parse --short HEAD)" -o "$index" || return 1
  grep -Fq "$MAIN_ASSET" "$index" || return 1
  for local_path in "$OWNER_JS" "$OWNER_CSS" "$SPONSORED_JS"; do
    local_asset="/assets/$(basename "$local_path")"
    curl -fsSL --max-time 30 "$origin$local_asset" -o "$LOG_DIR/$tag-$(basename "$local_path")" || return 1
    cmp -s "$local_path" "$LOG_DIR/$tag-$(basename "$local_path")" || return 1
  done
}
verify_assets "$WEB_ORIGIN" immutable "$LOG_DIR/immutable-index.html" || {
  echo "No se verificaron assets del despliegue inmutable; revisar log, sin redeploy automático."; exit 1;
}
echo "Deployment inmutable: JS y CSS idénticos al build local."
verified=0
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if verify_assets 'https://intaprd.com' canonical "$LOG_DIR/canonical-index.html"; then
    verified=1
    echo "Dominio canónico sirve JS y CSS correctos (intento $attempt)."
    break
  fi
  echo "Dominio canónico aún no actualizado (intento $attempt/10)."
  [[ "$attempt" -eq 10 ]] || sleep 3
done
[[ "$verified" -eq 1 ]] || { echo "Despliegue realizado, pero dominio canónico aún no verificado. NO repetir deploy automáticamente."; exit 1; }
curl -fsSL --max-time 30 -H 'Accept: text/html' 'https://intaprd.com/p/dapsa' -o "$LOG_DIR/dapsa.html"
grep -Fq "$MAIN_ASSET" "$LOG_DIR/dapsa.html" || { echo "La ruta /p/dapsa no sirve el build nuevo."; exit 1; }

echo "WEB MÓVIL PUBLICADA Y VALIDADA. Sin cambios App, API, D1 ni Preview."
echo "QA VISUAL NECESARIA: https://intaprd.com/p/dapsa — Escritorio: Editar mi perfil / Catálogo / Agenda / campana."
echo "QA MÓVIL: Menú hamburguesa con Editar mi perfil y Catálogo; Agenda y campana visibles fuera."
echo "No cerrar #133 hasta revisar captura real en móvil y escritorio."
