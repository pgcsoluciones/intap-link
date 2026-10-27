#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="hotfix/sponsor-account-isolation-2026-10-27"
APP_BRANCH="qa-intapcard-kawmed-combined-preview-2026-10-24"
WEB_BRANCH="qa-kawmed-web-1025"
PROJECT="intap-web2"
CONFIG="api/wrangler.preview.toml"
WEB_ALIAS="https://qa-kawmed-web-1025.intap-web2.pages.dev"
LOG_DIR="${TMPDIR:-/tmp}/kawmed-public-web-preview-$(date +%Y%m%d-%H%M%S)"
BACKUP=""

fail(){ printf '\nERROR: %s\n' "$*" >&2; exit 1; }
run(){ printf '▶'; printf ' %q' "$@"; printf '\n'; "$@"; }
restore(){
  if [[ -n "$BACKUP" && -f "$BACKUP" ]]; then
    cp "$BACKUP" "$CONFIG"
    rm -f "$BACKUP"
  fi
}
trap restore EXIT

cd "$ROOT" || fail "No existe el checkout local"
[[ -z "$(git status --porcelain)" ]] || fail "Hay cambios sin guardar. No se desplegará nada."
run git fetch github main "$BRANCH"
if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  run git switch "$BRANCH"
else
  run git switch --track -c "$BRANCH" "github/$BRANCH"
fi
run git pull --ff-only github "$BRANCH"
[[ -z "$(git status --porcelain)" ]] || fail "Checkout modificado"
git merge-base --is-ancestor github/main HEAD || fail "La rama no incluye el main actual"
run git diff --check github/main...HEAD
[[ "$(grep -Fc 'path="/m/:slug"' web/src/App.tsx)" -eq 1 ]] || fail "No se encontró una sola ruta pública KawMed /m/:slug"
grep -Fq "mp.status = 'active'" api/src/routes/medical-profile.ts || fail "Se perdió la regla de privacidad de borradores"
grep -Fq "WEB_PAGES_ORIGIN = \"$WEB_ALIAS\"" "$CONFIG" || fail "Web Preview no apunta al alias persistente esperado"

echo "▶ Revisión del alcance: no editar datos ni migraciones"
while IFS= read -r file; do
  [[ -z "$file" ]] && continue
  case "$file" in
    .github/workflows/quality.yml|api/wrangler.preview.toml|api/src/account-home-route.ts|api/src/index.ts|api/src/intap-active-account.ts|api/src/medical-access-codes.ts|api/src/medical-appointments.ts|api/src/medical-profile-owner.ts|api/src/medical-appointments.ts|api/src/sponsored-account-controls.ts|api/src/sponsored-appointments.ts|api/src/sponsored-profile-scope.ts|api/src/routes/medical-profile.ts|api/src/sponsored-multiprofile-access.ts|web/src/components/medical-profile/KawMedProfile.tsx|web/src/components/medical-profile/KawMedProfile.css|web/src/components/medical-profile/types.ts|web/src/components/appointments/AppointmentOwnerBar.tsx|app/src/lib/api.ts|app/src/App.tsx|app/src/components/admin/AdminGuard.tsx|app/src/components/admin/AuthCallback.tsx|app/src/components/admin/IntapcardAccountSelector.tsx|app/src/components/admin/sponsored/SponsorKawMed.tsx|app/src/components/admin/sponsored/SponsorDashboard.tsx|app/src/components/admin/sponsored/SponsoredDashboard.tsx|app/src/components/admin/KawMedClaim.tsx|app/src/components/admin/SuperAdminKawMed.tsx|app/src/components/admin/medical/MedicalDashboard.tsx|app/src/components/admin/sponsored/SponsoredResumeGate.tsx|scripts/run-preview-intapcard-kawmed-integrated-2026-10-24.sh|scripts/run-preview-intapcard-multiaccount-2026-10-24.sh|scripts/run-preview-kawmed-med-codes-ui-2026-10-23.sh|scripts/run-production-intapcard-kawmed-2026-10-25.sh|scripts/run-preview-kawmed-public-web-2026-10-25.sh|scripts/test-intapcard-kawmed-integrated-contract.mjs|scripts/test-intapcard-active-account-contract.mjs|scripts/test-intapcard-multiaccount-contract.mjs|scripts/test-kawmed-code-accordion-contract.mjs|scripts/test-kawmed-demo-invitations-contract.mjs|scripts/test-kawmed-web-preview-route-contract.mjs) ;;
    scripts/run-preview-sponsored-hotfix-2026-10-27.sh|api/src/sponsored-profiles.ts|api/src/sponsored-media.ts|scripts/run-preview-sponsor-isolation-2026-10-27.sh|scripts/test-intapcard-active-account-contract.mjs|docs/handoffs/BITACORA_MAESTRA_INTAP_KAWMED_MULTICUENTA_PATROCINIO_2026-10-27.md) ;;
    *) fail "Archivo fuera del alcance del Preview integrado: $file" ;;
  esac
done < <(git diff --name-only github/main...HEAD)
if git diff --name-only github/main...HEAD | grep -Eq '^(api/migrations|api/migrations-preview|package(-lock)?\.json)'; then
  fail "Detectados cambios de datos o dependencias no autorizados"
fi

run npm ci
run node scripts/test-kawmed-web-preview-route-contract.mjs
run node scripts/test-intapcard-kawmed-integrated-contract.mjs
run node scripts/test-intapcard-active-account-contract.mjs
run node scripts/test-intapcard-multiaccount-contract.mjs
run node scripts/test-kawmed-code-accordion-contract.mjs
run node scripts/test-kawmed-isolation-contract.mjs
run node scripts/test-kawmed-demo-invitations-contract.mjs
run npx tsc --noEmit -p api/tsconfig.json
run npm run build:preview -w web
run npm run build:preview -w app
grep -RlF '/m/:slug' web/dist/assets --include='*.js' >/dev/null || fail "El build Web no contiene la ruta /m/:slug"
find web/dist/assets -maxdepth 1 -name '*KawMedProfile*.js' | grep -q . || fail "Falta el bundle público KawMed"

mkdir -p "$LOG_DIR"
echo "▶ Desplegando sponsor isolation PR #123 únicamente a Pages Preview; sin D1 ni R2"
npx wrangler pages deploy app/dist --project-name "$PROJECT" --branch "$APP_BRANCH" 2>&1 | tee "$LOG_DIR/app-pages.log"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$LOG_DIR/app-pages.log" | tail -1)"
[[ -n "$APP_ORIGIN" ]] || fail "No se obtuvo origen inmutable de App"

npx wrangler pages deploy web/dist --project-name "$PROJECT" --branch "$WEB_BRANCH" 2>&1 | tee "$LOG_DIR/web-pages.log"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$LOG_DIR/web-pages.log" | tail -1)"
[[ -n "$WEB_ORIGIN" ]] || fail "No se obtuvo origen inmutable de Web"
grep -Fq "$WEB_ALIAS" "$LOG_DIR/web-pages.log" || fail "El alias Web no coincide con el persistido en Wrangler. No modificar el Worker."

# Cloudflare Pages puede responder temporalmente 404 al nuevo deployment
# mientras sus assets/Functions se propagan. Comprobar el HTML real, sin saltar
# la barrera de seguridad: jamás cambiar el Worker Preview si falla esta fase.
verify_pages_html(){
  local label="$1" url="$2" code="" attempt="" html="$LOG_DIR/$1-origin.html"
  local headers="$LOG_DIR/$1-origin-headers.txt"
  for attempt in 1 2 3 4 5 6 7 8 9 10 11 12; do
    code="$(curl -sSL --connect-timeout 10 --max-time 25 \
      -H 'Accept: text/html' -D "$headers" -o "$html" \
      -w '%{http_code}' "$url" || true)"
    if [[ "$code" == "200" ]] && grep -Eiq '<!doctype html|<html[[:space:]>]' "$html"; then
      echo "✓ Pages $label entregó HTML (HTTP 200, intento $attempt)"
      return 0
    fi
    echo "  Pages $label HTTP ${code:-error} (intento $attempt/12)."
    [[ "$attempt" == "12" ]] || sleep 5
  done
  echo "▶ Diagnóstico Pages $label: respuesta final HTTP ${code:-error}" >&2
  echo "  URL: $url" >&2
  echo "  Cabeceras: $headers" >&2
  echo "  Respuesta: $html" >&2
  echo "  Se bloquea el cambio de Worker Preview para no romper rutas existentes." >&2
  fail "La ruta Pages $label sigue sin entregar HTML. Revisar los archivos de diagnóstico."
}
verify_pages_html app "$APP_ORIGIN/admin/accounts"
# Distinguir si Pages no sirve la SPA en absoluto o solo falla la ruta anidada.
verify_pages_html web-root "$WEB_ORIGIN/"
verify_pages_html web "$WEB_ORIGIN/m/med-intapcard"

BACKUP="$(mktemp)"
cp "$CONFIG" "$BACKUP"
APP_ORIGIN="$APP_ORIGIN" WEB_ORIGIN="$WEB_ORIGIN" python3 - <<'PY'
from pathlib import Path
import os, re
p = Path("api/wrangler.preview.toml")
body = p.read_text()
for key in ("APP_PAGES_ORIGIN","WEB_PAGES_ORIGIN"):
    source = os.environ["APP_ORIGIN" if key.startswith("APP") else "WEB_ORIGIN"]
    body, count = re.subn(r'^'+key+r' = ".*"$', key+' = "'+source+'"', body, count=1, flags=re.M)
    if count != 1: raise SystemExit("Missing expected Preview config: "+key)
p.write_text(body)
PY

echo "▶ Actualizando SOLO front door de Worker Preview con los dos orígenes revisados"
(
  cd api
  npx wrangler deploy --config wrangler.preview.toml --dry-run
  npx wrangler deploy --config wrangler.preview.toml
) 2>&1 | tee "$LOG_DIR/worker-preview.log"
restore
BACKUP=""
[[ -z "$(git status --porcelain)" ]] || fail "El runner dejó cambios sin restaurar"

echo "▶ Smoke de rutas y autenticación Preview"
for path in /admin/accounts /admin/medical /superadmin/kawmed; do
  http="$(curl -sSL -o /dev/null -w '%{http_code}' "https://app.preview.intaprd.com$path")"
  [[ "$http" == "200" ]] || fail "Admin App rota: $path HTTP $http"
done
verify_pages_html web-custom 'https://preview.intaprd.com/m/med-intapcard'
# La ruta debe estar realmente en el JS servido, no solo responder index.html.
curl -fsSL 'https://preview.intaprd.com/m/med-intapcard' -o "$LOG_DIR/public-index.html"
JS_PATH="$(grep -Eo '(/assets/[^" ]+\.js)' "$LOG_DIR/public-index.html" | head -1)"
[[ -n "$JS_PATH" ]] || fail "No se encontró JS de la página pública"
curl -fsSL "https://preview.intaprd.com$JS_PATH" -o "$LOG_DIR/web-entry.js"
grep -Fq '/m/:slug' "$LOG_DIR/web-entry.js" || fail "El JS publicado aún no contiene /m/:slug"
for endpoint in /api/v1/me/intapcard/accounts /api/v1/me/home-route; do
  unauth="$(curl -sSL -o /dev/null -w '%{http_code}' "https://app.preview.intaprd.com$endpoint")"
  [[ "$unauth" == "401" ]] || fail "Endpoint $endpoint sin sesión devolvió $unauth, se esperaba 401"
done
MED_HTTP="$(curl -sSL -o /dev/null -w '%{http_code}' 'https://preview.intaprd.com/api/v1/public/medical-profiles/med-intapcard')"
[[ "$MED_HTTP" == "200" || "$MED_HTTP" == "404" ]] || fail "API perfil médico respondió $MED_HTTP"
echo "✓ Web pública Preview /m/med-intapcard: ruta reconocida"
echo "✓ API perfil MED: HTTP $MED_HTTP (404 es correcto para borrador sin publicar)"
echo "✓ Admin multicuenta sigue disponible"
echo "✓ App: $APP_ORIGIN"
echo "✓ Web: $WEB_ORIGIN"
echo "✓ SHA hotfix: $(git rev-parse --short HEAD)"
echo "✓ Logs: $LOG_DIR"
echo "✓ Producción NO modificada"
