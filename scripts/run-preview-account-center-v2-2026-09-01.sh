#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawvo-account-center-v1"
APP_PROJECT="intap-link"
LOG_DIR="$ROOT/.preview-account-center-v2-2026-09-01-logs"

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

run python3 scripts/apply-account-center-reference-v2.py
run git diff --check

echo ""
echo "▶ Validando referencia visual de Mi cuenta"
grep -Fq '>Editar textos</button>' app/src/components/admin/free/FreeServices.tsx || fail "Servicios no muestra Editar textos"
grep -Fq '>Editar textos</button>' app/src/components/admin/free/FreePortfolio.tsx || fail "Portafolio no muestra Editar textos"
grep -Fq '>Mi cuenta</button>' app/src/components/admin/free/FreeDashboard.tsx || fail "Mi cuenta no aparece como texto en la barra superior"
! grep -Fq '>◎</button>' app/src/components/admin/free/FreeDashboard.tsx || fail "Mi cuenta sigue apareciendo como icono"
! grep -Fq '>Salir</button>' app/src/components/admin/free/FreeDashboard.tsx || fail "Salir sigue en la barra superior del panel"
grep -Fq 'avatar_url' app/src/components/admin/free/FreeAccount.tsx || fail "Mi cuenta no carga avatar"
grep -Fq 'Editar</span>' app/src/components/admin/free/FreeAccount.tsx || fail "Avatar de Mi cuenta no es editable"
grep -Fq '<SectionTitle>CUENTA</SectionTitle>' app/src/components/admin/free/FreeAccount.tsx || fail "Falta grupo CUENTA"
grep -Fq '<SectionTitle>MI KAWVO</SectionTitle>' app/src/components/admin/free/FreeAccount.tsx || fail "Falta grupo MI KAWVO"
grep -Fq '<SectionTitle>AYUDA Y RECURSOS</SectionTitle>' app/src/components/admin/free/FreeAccount.tsx || fail "Falta grupo AYUDA Y RECURSOS"
grep -Fq '<FreeNotificationBell hideTrigger />' app/src/components/admin/free/FreeAccount.tsx || fail "Mi cuenta no usa la bandeja sin campana duplicada"
grep -Fq 'label="Notificaciones"' app/src/components/admin/free/FreeAccount.tsx || fail "Falta acceso Notificaciones dentro de Mi cuenta"
grep -Fq 'Marcar como leída' app/src/components/admin/free/FreeNotificationBell.tsx || fail "Falta marcar notificación como leída"
grep -Fq 'Eliminar notificación' app/src/components/admin/free/FreeNotificationBell.tsx || fail "Falta eliminar notificación"
grep -Fq 'Enviar cuentas bancarias' app/src/components/admin/free/FreeAccount.tsx || fail "Falta compartir cuentas bancarias"
grep -Fq 'Cerrar sesión' app/src/components/admin/free/FreeAccount.tsx || fail "Cerrar sesión no está dentro de Mi cuenta"
echo "✓ referencia visual y funcional de Mi cuenta validada"

run git add app/src/components/admin/free/FreeDashboard.tsx
if ! git diff --cached --quiet; then
  run git commit -m "fix(account): show Mi cuenta as topbar text"
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
echo "▶ Aplicando migraciones SOLO a D1 Preview"
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
s, n = re.subn(r'^APP_PAGES_ORIGIN = ".*"$', f'APP_PAGES_ORIGIN = "{os.environ["APP_ORIGIN"]}"', s, count=1, flags=re.M)
if n != 1:
    raise SystemExit('No pude actualizar APP_PAGES_ORIGIN')
p.write_text(s)
print('✓ APP_PAGES_ORIGIN Preview actualizado')
PY

run git diff --check
run git add api/wrangler.preview.toml
if ! git diff --cached --quiet; then
  run git commit -m "chore(preview): pin account center reference deployment"
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
  "https://app.preview.intaprd.com/superadmin/resources"; do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
  echo "✓ $url -> HTTP 200"
done

echo ""
echo "============================================================"
echo "✓ ACCOUNT CENTER V2 · PREVIEW LISTO PARA QA"
echo "============================================================"
echo "Branch:          $BRANCH"
echo "Commit:          $(git rev-parse HEAD)"
echo "App Pages:       $APP_ORIGIN"
echo "Worker Version:  ${WORKER_VERSION:-ver salida Wrangler}"
echo "Panel QA:        https://app.preview.intaprd.com/admin/free"
echo "Mi cuenta QA:    https://app.preview.intaprd.com/admin/free/account"
echo "Producción:      NO TOCADA"
echo ""
echo "QA VISUAL:"
echo "1) Barra superior: campana + texto Mi cuenta."
echo "2) Mi cuenta: sin campana en su encabezado."
echo "3) Mi cuenta: avatar editable + nombre + usuario + badge del plan."
echo "4) Opciones agrupadas como pantalla de configuración."
echo "5) Notificaciones abre una sola bandeja con detalle, leer y eliminar."
echo "============================================================"
