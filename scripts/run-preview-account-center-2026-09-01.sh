#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawvo-account-center-v1"
APP_PROJECT="intap-link"
LOG_DIR="$ROOT/.preview-account-center-2026-09-01-logs"

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

run python3 scripts/apply-account-center-v1.py
run git diff --check

echo ""
echo "▶ Validando contrato visual y navegación"
grep -Fq '>Editar textos</button>' app/src/components/admin/free/FreeServices.tsx || fail "Servicios no muestra Editar textos"
grep -Fq '>Editar textos</button>' app/src/components/admin/free/FreePortfolio.tsx || fail "Portafolio no muestra Editar textos"
grep -Fq "title: 'Mi cuenta'" app/src/components/admin/free/FreeDashboard.tsx || fail "Mi cuenta no está en el panel"
! grep -Fq "title: 'Mis productos Kawvo (NFC/QR)'" app/src/components/admin/free/FreeDashboard.tsx || fail "Mis productos sigue en el panel"
! grep -Fq '<FreeSupportPanel />' app/src/components/admin/free/FreeDashboard.tsx || fail "Soporte sigue en el panel"
! grep -Fq '<FreeProfileDangerZone' app/src/components/admin/free/FreeDashboard.tsx || fail "Eliminar perfil sigue en el panel"
grep -Fq 'path="/admin/free/account"' app/src/App.tsx || fail "Falta ruta Mi cuenta"
grep -Fq 'path="/superadmin/resources"' app/src/App.tsx || fail "Falta ruta Recursos SuperAdmin"
grep -Fq 'Eliminar notificación' app/src/components/admin/free/FreeNotificationBell.tsx || fail "Falta eliminar notificación"
grep -Fq 'Dispositivos vinculados' app/src/components/admin/free/FreeAccount.tsx || fail "Falta dispositivos vinculados"
grep -Fq 'Cuotas disponibles' app/src/components/admin/free/FreeAccount.tsx || fail "Faltan cuotas IA"
grep -Fq 'Recursos de Kawvo' app/src/components/admin/free/FreeAccount.tsx || fail "Falta sección Recursos"
echo "✓ contrato visual de Mi cuenta validado"

run git add \
  app/src/App.tsx \
  app/src/components/admin/SuperAdminLayout.tsx \
  app/src/components/admin/free/FreeDashboard.tsx \
  app/src/components/admin/free/FreeServices.tsx \
  app/src/components/admin/free/FreePortfolio.tsx \
  app/src/components/admin/free/FreeNotificationBell.tsx \
  app/src/components/admin/free/FreeAccount.tsx \
  app/src/components/admin/free/FreeContextHelp.tsx
if ! git diff --cached --quiet; then
  run git commit -m "feat(account): wire account center navigation"
  run git push github "HEAD:$BRANCH"
fi

run git diff --check

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
echo "▶ Aplicando migración aditiva SOLO a D1 Preview"
(cd api && npx wrangler d1 migrations apply intap_db_preview --remote --config wrangler.preview.toml) || fail "Migraciones D1 Preview"

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
  run git commit -m "chore(preview): pin account center deployment"
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
  "https://app.preview.intaprd.com/admin/free/account" \
  "https://app.preview.intaprd.com/admin/artifacts" \
  "https://app.preview.intaprd.com/admin/free/bank-accounts" \
  "https://app.preview.intaprd.com/superadmin/resources"; do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
  echo "✓ $url -> HTTP 200"
done

echo ""
echo "▶ Smoke de endpoints protegidos"
for spec in \
  "GET|https://app.preview.intaprd.com/api/v1/me/account/sessions" \
  "GET|https://app.preview.intaprd.com/api/v1/me/account/resources" \
  "DELETE|https://app.preview.intaprd.com/api/v1/me/notifications/smoke"; do
  method="${spec%%|*}"
  url="${spec#*|}"
  code="$(curl -sS -o /dev/null -w '%{http_code}' -X "$method" "$url")"
  [ "$code" = "401" ] || fail "$method $url sin sesión respondió HTTP $code"
  echo "✓ $method $url protegido -> HTTP 401"
done

echo ""
echo "============================================================"
echo "✓ ACCOUNT CENTER · PREVIEW LISTO PARA QA"
echo "============================================================"
echo "Branch:          $BRANCH"
echo "Commit:          $(git rev-parse HEAD)"
echo "App Pages:       $APP_ORIGIN"
echo "Worker Version:  ${WORKER_VERSION:-ver salida Wrangler}"
echo "Panel QA:        https://app.preview.intaprd.com/admin/free"
echo "Mi cuenta QA:    https://app.preview.intaprd.com/admin/free/account"
echo "SuperAdmin:      https://app.preview.intaprd.com/superadmin/resources"
echo "Producción:      NO TOCADA"
echo "Logs:            $LOG_DIR"
echo ""
echo "QA FÍSICO:"
echo "1) Panel: debe mostrar Mi cuenta y NO mostrar Mis productos, Soporte ni Eliminar perfil."
echo "2) Servicios y Portafolio: botón Editar textos."
echo "3) Mi cuenta: plan, notificaciones, IA, QR, banco si aplica, invitar, dispositivos, recursos, ayuda/tickets y eliminación."
echo "4) Campana y tarjeta Notificaciones deben abrir la misma bandeja; probar leído y eliminar."
echo "5) SuperAdmin Recursos: crear/editar/ocultar/eliminar un recurso de prueba."
echo "============================================================"
