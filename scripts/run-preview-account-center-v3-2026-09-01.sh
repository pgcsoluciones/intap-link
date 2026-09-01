#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawvo-account-center-v1"
APP_PROJECT="intap-link"
LOG_DIR="$ROOT/.preview-account-center-v3-2026-09-01-logs"

fail() {
  echo ""
  echo "✗ ERROR: $1"
  echo "Producción no fue tocada."
  exit 1
}
run() { echo ""; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
mkdir -p "$LOG_DIR"
run git fetch github "$BRANCH"
if [ "$(git branch --show-current)" != "$BRANCH" ]; then run git checkout -B "$BRANCH" "github/$BRANCH"; fi
run git pull --ff-only github "$BRANCH"

if ! git diff --quiet || ! git diff --cached --quiet; then
  git status --short
  fail "Hay cambios versionados locales"
fi

run python3 scripts/apply-account-center-v3.py
run git diff --check

echo ""
echo "▶ Validando Account Center v3"
grep -Fq 'UpgradeCrownIcon' app/src/components/admin/free/FreeAccount.tsx || fail "Falta corona de upgrade"
grep -Fq 'Plan Plus' app/src/components/admin/free/FreePanelUi.tsx || fail "El plan de pago no se presenta como Plus"
! grep -Fq 'Plan Básico' app/src/components/admin/free/FreePanelUi.tsx || fail "Sigue copy visible Plan Básico en UI central"
grep -Fq 'label="Notificaciones"' app/src/components/admin/free/FreeAccount.tsx || fail "Falta Notificaciones"
! grep -Fq 'Dispositivos vinculados' app/src/components/admin/free/FreeAccount.tsx || fail "Dispositivos vinculados sigue visible"
grep -Fq 'label="Mis productos"' app/src/components/admin/free/FreeAccount.tsx || fail "Falta Mis productos"
grep -Fq 'Vista previa del código QR' app/src/components/admin/free/FreeAccount.tsx || fail "QR no tiene preview"
grep -Fq 'label="Enviar enlace de cuentas"' app/src/components/admin/free/FreeAccount.tsx || fail "Falta enviar enlace de cuentas"
grep -Fq 'Mensaje que vas a compartir' app/src/components/admin/free/FreeAccount.tsx || fail "Invitación no muestra preview"
grep -Fq 'Centro de ayuda' app/src/components/admin/free/FreeSupportPanel.tsx || fail "Centro de ayuda no está unificado"
! grep -Fq "p === '/admin/free/account'" app/src/components/admin/free/FreeContextHelp.tsx || fail "Flotante de ayuda sigue activo en Mi cuenta"
grep -Fq 'label="Cerrar sesión"' app/src/components/admin/free/FreeAccount.tsx || fail "Falta Cerrar sesión"
echo "✓ contrato v3 validado"

run git add \
  app/src/components/admin/free/FreePanelUi.tsx \
  app/src/components/admin/free/FreeQuickActions.tsx \
  app/src/components/admin/free/FreeDashboard.tsx \
  app/src/components/admin/free/FreeLinks.tsx \
  app/src/components/admin/free/FreeBankAccounts.tsx \
  app/src/components/admin/free/FreePortfolio.tsx \
  app/src/components/admin/free/FreeProfileDangerZone.tsx \
  app/src/components/admin/free/FreeServices.tsx \
  app/src/components/admin/free/FreeAiProfileAssistant.tsx \
  app/src/components/admin/free/FreeAccount.tsx \
  app/src/components/admin/free/FreeSupportPanel.tsx \
  app/src/components/admin/free/FreeContextHelp.tsx
if ! git diff --cached --quiet; then
  run git commit -m "feat(account): refine icons previews and Plus plan copy"
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
if n != 1: raise SystemExit('No pude actualizar APP_PAGES_ORIGIN')
p.write_text(s)
PY
run git add api/wrangler.preview.toml
if ! git diff --cached --quiet; then
  run git commit -m "chore(preview): pin account center v3 deployment"
  run git push github "HEAD:$BRANCH"
fi

echo ""
echo "▶ Desplegando Worker SOLO PREVIEW"
WORKER_LOG="$LOG_DIR/worker-$(date +%Y%m%d-%H%M%S).log"
(cd api && npx wrangler deploy --config wrangler.preview.toml) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Preview"
WORKER_VERSION="$(grep -E 'Current Version ID:' "$WORKER_LOG" | tail -1 | sed -E 's/.*Current Version ID:[[:space:]]*//')"

for url in \
  "https://app.preview.intaprd.com/admin/free" \
  "https://app.preview.intaprd.com/admin/free/account"; do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
  echo "✓ $url -> HTTP 200"
done

echo ""
echo "============================================================"
echo "✓ ACCOUNT CENTER V3 · PREVIEW LISTO PARA QA"
echo "============================================================"
echo "Commit:          $(git rev-parse HEAD)"
echo "App Pages:       $APP_ORIGIN"
echo "Worker Version:  ${WORKER_VERSION:-ver salida Wrangler}"
echo "Mi cuenta QA:    https://app.preview.intaprd.com/admin/free/account"
echo "Producción:      NO TOCADA"
echo ""
echo "QA VISUAL:"
echo "1) Corona en Mejorar mi plan y copy Plan Plus."
echo "2) Notificaciones con campana; Cuotas IA se conserva; sin Dispositivos vinculados."
echo "3) Mis productos con bolso; QR abre preview antes de descargar."
echo "4) Banco con edificio y nota legible; compartir enlace."
echo "5) Invitar a un amigo muestra mensaje antes de compartir."
echo "6) Centro de ayuda y tickets único; sin flotante Ayuda."
echo "7) Cerrar sesión con icono puerta/flecha."
echo "============================================================"
