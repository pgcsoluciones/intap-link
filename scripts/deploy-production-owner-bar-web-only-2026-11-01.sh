#!/usr/bin/env bash
# #130 — Corrección Web-only de la barra del propietario patrocinado/Free/MED.
# No toca API, App, D1 ni Preview. Requiere autorización explícita del operador.
set -euo pipefail
[[ "${KAWVO_OWNER_BAR_WEB_DEPLOY_APPROVED:-}" == "SI" ]] || {
  echo "Aprobación requerida: KAWVO_OWNER_BAR_WEB_DEPLOY_APPROVED=SI"
  exit 1
}
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BASE="5cc143fe870f0ccea0b92903824594b5084dd29d"
BRANCH="fix/owner-bar-api-origin-multicuenta-2026-11-01"
cd "$ROOT"
[[ -z "$(git status --porcelain)" ]] || { echo "Hay cambios locales. No desplegar."; exit 1; }
git fetch github "$BRANCH"
git switch "$BRANCH"
git pull --ff-only github "$BRANCH"
git merge-base --is-ancestor "$BASE" HEAD
git diff --check "$BASE"..HEAD
while IFS= read -r path; do
  case "$path" in
    web/src/components/appointments/AppointmentOwnerBar.tsx|scripts/test-owner-bar-api-origin-multicuenta-2026-11-01.mjs|scripts/verify-owner-bar-api-origin-multicuenta-2026-11-01.sh|scripts/deploy-production-owner-bar-web-only-2026-11-01.sh) ;;
    *) echo "Archivo inesperado: $path"; exit 1 ;;
  esac
done < <(git diff --name-only "$BASE"..HEAD)
[[ "$(git diff --name-only "$BASE"..HEAD -- web api app)" == "web/src/components/appointments/AppointmentOwnerBar.tsx" ]] || { echo "Scope runtime inesperado."; exit 1; }
EXPECTED_DIFF="$(printf '14\t2\tweb/src/components/appointments/AppointmentOwnerBar.tsx')"
[[ "$(git diff --numstat "$BASE"..HEAD -- web/src/components/appointments/AppointmentOwnerBar.tsx)" == "$EXPECTED_DIFF" ]] || { echo "Cambio runtime distinto del aprobado. Abortando."; exit 1; }
grep -Fxq 'VITE_API_URL=https://api.intaprd.com' web/.env.production
grep -Fxq 'VITE_APP_URL=https://app.intaprd.com' web/.env.production
node scripts/test-owner-bar-api-origin-multicuenta-2026-11-01.mjs
node scripts/test-sponsored-owner-context-denial-2026-11-01.mjs
(cd web && npm run build)
MAIN_ASSET="$(grep -Eo '/assets/index-[A-Za-z0-9_-]+\.js' web/dist/index.html | head -1)"
[[ -n "$MAIN_ASSET" ]] || { echo "No se encontró bundle principal Web."; exit 1; }
OWNER_FILE="$(find web/dist/assets -maxdepth 1 -type f -name 'AppointmentOwnerBar-*.js' | head -1)"
[[ -n "$OWNER_FILE" ]] || { echo "Falta chunk propietario."; exit 1; }
OWNER_ASSET="/assets/$(basename "$OWNER_FILE")"
grep -Fq 'api.intaprd.com' "$OWNER_FILE" || { echo "El chunk Web no contiene el host API esperado."; exit 1; }
mkdir -p "$HOME/intap-release-logs"
LOG_DIR="$(mktemp -d "$HOME/intap-release-logs/ownerbar-web-XXXXXXXX")"
echo "Desplegando SOLO Web pública: Pages intap-link / rama de producción main."
echo "Logs de publicación: $LOG_DIR"
npx --no-install wrangler pages deploy web/dist --project-name intap-link --branch main --commit-hash "$(git rev-parse HEAD)" 2>&1 | tee "$LOG_DIR/web-deploy.log"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$LOG_DIR/web-deploy.log" | tail -1 || true)"
[[ -n "$WEB_ORIGIN" ]] || { echo "El comando de deploy terminó, pero NO se verificó la URL inmutable; revisar el log antes de hacer otro despliegue."; exit 1; }
curl -fsSL --max-time 30 "$WEB_ORIGIN/" -o "$LOG_DIR/immutable-index.html"
grep -Fq "$MAIN_ASSET" "$LOG_DIR/immutable-index.html" || { echo "Deployment inmutable no contiene el bundle nuevo."; exit 1; }
curl -fsSL --max-time 30 "$WEB_ORIGIN$OWNER_ASSET" -o "$LOG_DIR/immutable-owner.js"
cmp -s "$OWNER_FILE" "$LOG_DIR/immutable-owner.js" || { echo "Chunk propietario inmutable distinto del build local."; exit 1; }
echo "Deploy inmutable validado: $WEB_ORIGIN"
verified=0
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsSL --max-time 30 -H 'Cache-Control: no-cache' "https://intaprd.com/?ownerbar_release=$(git rev-parse --short HEAD)" -o "$LOG_DIR/canonical-index.html" \
    && grep -Fq "$MAIN_ASSET" "$LOG_DIR/canonical-index.html" \
    && curl -fsSL --max-time 30 "https://intaprd.com$OWNER_ASSET" -o "$LOG_DIR/canonical-owner.js" \
    && cmp -s "$OWNER_FILE" "$LOG_DIR/canonical-owner.js"; then
      verified=1
      echo "Dominio canónico sirve bundle + chunk propietario idénticos al build (intento $attempt)."
      break
  fi
  echo "El dominio canónico aún no refleja este build (intento $attempt/10)."
  [[ "$attempt" -eq 10 ]] || sleep 3
done
[[ "$verified" -eq 1 ]] || { echo "Web subida; no se verificó dominio canónico. NO repetir deploy automáticamente; revisar logs."; exit 1; }
curl -fsSL --max-time 30 -H 'Accept: text/html' "https://intaprd.com/p/dapsa" -o "$LOG_DIR/dapsa-spa.html"
grep -Fq "$MAIN_ASSET" "$LOG_DIR/dapsa-spa.html" || { echo "La ruta /p/dapsa no sirve el bundle aprobado."; exit 1; }
echo "WEB PÚBLICA DESPLEGADA Y VALIDADA EN DOMINIO. SIN CAMBIOS App, API, D1 o Preview."
echo "FALTA QA DE PROPIETARIO AUTENTICADO: https://intaprd.com/p/dapsa"
echo "No cerrar #130 hasta ver Configuración + Agenda en la barra."
