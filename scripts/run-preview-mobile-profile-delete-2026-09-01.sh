#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="fix/mobile-profile-delete-preview"
APP_PROJECT="intap-link"
LOG_DIR="$ROOT/.preview-mobile-profile-delete-logs"

fail() {
  echo ""
  echo "✗ ERROR: $1"
  echo "Producción no fue tocada."
  exit 1
}

run() {
  echo ""
  echo "▶ $*"
  "$@" || fail "$*"
}

cd "$ROOT" || fail "No existe $ROOT"
mkdir -p "$LOG_DIR"

run git fetch github "$BRANCH"
if [ "$(git branch --show-current)" != "$BRANCH" ]; then
  run git checkout -B "$BRANCH" "github/$BRANCH"
fi
run git pull --ff-only github "$BRANCH"

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo ""
  echo "=== CAMBIOS TRACKED DETECTADOS ==="
  git status --short
  fail "Hay cambios versionados locales; no los sobreescribiremos"
fi

run git diff --check

echo ""
echo "▶ Validando contrato de borrado con servicios/productos"
grep -Fq 'DELETE FROM profile_products WHERE profile_id = ?' api/src/preview-profile-delete-mobile.ts \
  || fail "El endpoint móvil no limpia profile_products antes de profiles"
echo "✓ profile_products se elimina explícitamente antes del perfil"

echo ""
echo "▶ Validando retiro del onboarding legacy bloqueante"
! grep -Fq 'Tengo mi artículo y mis códigos' app/src/components/admin/free/onboarding/FreeOnboardingWelcome.tsx \
  || fail "La welcome todavía contiene el CTA legacy de códigos manuales"
grep -Fq 'Crear una cuenta' app/src/components/admin/free/onboarding/FreeOnboardingWelcome.tsx \
  || fail "La welcome no ofrece Crear una cuenta"
grep -Fq 'Iniciar sesión' app/src/components/admin/free/onboarding/FreeOnboardingWelcome.tsx \
  || fail "La welcome no ofrece Iniciar sesión"
grep -Fq 'path="/admin/free/onboarding/product" element={<Navigate to="/admin/free/onboarding/welcome" replace />}' app/src/App.tsx \
  || fail "La ruta legacy product sigue activa"
grep -Fq 'path="/admin/free/onboarding/bootstrap" element={<Navigate to="/admin/free/onboarding/welcome" replace />}' app/src/App.tsx \
  || fail "La ruta legacy bootstrap sigue activa"
! grep -Fq 'sus códigos de compra/activación' app/src/components/admin/AdminLogin.tsx \
  || fail "El login todavía muestra copy legacy de códigos manuales"
echo "✓ welcome/auth alineados con Scan-to-Claim y sin entrada manual de códigos"

echo ""
echo "▶ Validando App Preview"
(cd app && npx tsc && npx vite build --mode preview) || fail "Build Preview de App"

echo ""
echo "▶ Validando TypeScript del API Preview"
(cd api && npx tsc --noEmit) || fail "TypeScript API Preview"

echo ""
echo "▶ Dry-run del Worker Preview"
(cd api && npx wrangler deploy --config wrangler.preview.toml --dry-run) || fail "Dry-run Worker Preview"

echo ""
echo "▶ Desplegando App SOLO a Pages Preview"
APP_LOG="$LOG_DIR/app-pages-$(date +%Y%m%d-%H%M%S).log"
(cd api && npx wrangler pages deploy ../app/dist --project-name "$APP_PROJECT" --branch "$BRANCH") 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App Preview"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$APP_LOG" | tail -1)"
[ -n "$APP_ORIGIN" ] || fail "No pude identificar APP_PAGES_ORIGIN"
echo "✓ APP_PAGES_ORIGIN=$APP_ORIGIN"

APP_ORIGIN="$APP_ORIGIN" python3 - <<'PY' || fail "Actualizar APP_PAGES_ORIGIN Preview"
from pathlib import Path
import os, re
p = Path('api/wrangler.preview.toml')
s = p.read_text()
s, n = re.subn(
    r'^APP_PAGES_ORIGIN = ".*"$',
    f'APP_PAGES_ORIGIN = "{os.environ["APP_ORIGIN"]}"',
    s,
    count=1,
    flags=re.M,
)
if n != 1:
    raise SystemExit('No pude actualizar APP_PAGES_ORIGIN')
p.write_text(s)
print('✓ APP_PAGES_ORIGIN Preview actualizado')
PY

run git diff --check
run git add api/wrangler.preview.toml
if ! git diff --cached --quiet; then
  run git commit -m "chore(preview): pin mobile profile delete deployment"
  run git push github "HEAD:$BRANCH"
fi

echo ""
echo "▶ Desplegando Worker SOLO PREVIEW"
WORKER_LOG="$LOG_DIR/worker-$(date +%Y%m%d-%H%M%S).log"
(cd api && npx wrangler deploy --config wrangler.preview.toml) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Preview"
WORKER_VERSION="$(grep -E 'Current Version ID:' "$WORKER_LOG" | tail -1 | sed -E 's/.*Current Version ID:[[:space:]]*//')"

echo ""
echo "▶ Smoke de rutas Preview"
for url in \
  "https://app.preview.intaprd.com/admin/free" \
  "https://app.preview.intaprd.com/admin/free/home?source=pwa" \
  "https://app.preview.intaprd.com/admin/free/onboarding/welcome" \
  "https://app.preview.intaprd.com/admin/login?mode=register" \
  "https://app.preview.intaprd.com/admin/login?mode=login" \
  "https://app.preview.intaprd.com/admin/free/onboarding/product" \
  "https://app.preview.intaprd.com/admin/free/onboarding/bootstrap"; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' "$url")"
  [ "$code" = "200" ] || [ "$code" = "302" ] || fail "Smoke $url -> HTTP $code"
  echo "✓ $url -> HTTP $code"
done

echo ""
echo "▶ Smoke del nuevo endpoint mobile-safe"
DELETE_ROUTE_BODY="$LOG_DIR/delete-route-unauth-$(date +%Y%m%d-%H%M%S).json"
DELETE_ROUTE_CODE="$(curl -sS -o "$DELETE_ROUTE_BODY" -w '%{http_code}' \
  -X POST \
  -H 'Content-Type: application/json' \
  --data '{"confirm_slug":"ELIMINAR smoke","confirm_email":"smoke@example.com"}' \
  'https://app.preview.intaprd.com/api/v1/me/profile/delete')"
[ "$DELETE_ROUTE_CODE" = "401" ] || fail "POST /api/v1/me/profile/delete sin sesión -> HTTP $DELETE_ROUTE_CODE"
echo "✓ POST /api/v1/me/profile/delete expuesto y protegido -> HTTP 401 sin sesión"

echo ""
echo "============================================================"
echo "✓ PREVIEW LISTO PARA QA FÍSICO"
echo "============================================================"
echo "Branch:          $BRANCH"
echo "Commit:          $(git rev-parse HEAD)"
echo "App Pages:       $APP_ORIGIN"
echo "Worker Version:  ${WORKER_VERSION:-ver salida Wrangler}"
echo "Welcome QA:      https://app.preview.intaprd.com/admin/free/onboarding/welcome"
echo "Login QA:        https://app.preview.intaprd.com/admin/login"
echo "Panel QA:        https://app.preview.intaprd.com/admin/free"
echo "Producción:      NO TOCADA"
echo "Logs:            $LOG_DIR"
echo ""
echo "SIGUIENTE QA FÍSICO:"
echo "1) Eliminación -> pantalla de confirmación -> Continuar."
echo "2) Debe terminar en la entrada Crear una cuenta / Iniciar sesión."
echo "3) No debe aparecer ningún formulario de códigos manuales."
echo "4) Con una sesión válida sin perfil, welcome debe mostrar opciones sin bloquear."
echo "============================================================"
