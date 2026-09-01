#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawvo-account-center-v1"
APP_PROJECT="intap-link"
LOG_DIR="$ROOT/.preview-account-center-v5_3-2026-09-01-logs"

fail() { echo ""; echo "✗ ERROR: $1"; echo "Producción no fue tocada."; exit 1; }
run() { echo ""; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
mkdir -p "$LOG_DIR"
run git fetch github "$BRANCH"
run git reset --hard "github/$BRANCH"
run python3 scripts/apply-account-center-v5_3.py
run git diff --check

echo ""
echo "▶ Validando V5.3"
grep -Fq 'Respuesta de soporte' app/src/components/admin/free/FreeNotifications.tsx || fail "Notificaciones no muestran respuesta inline"
grep -Fq 'apiGet(`/me/support-tickets/${selected.source_id}`)' app/src/components/admin/free/FreeNotifications.tsx || fail "Notificaciones no cargan ticket en el mismo detalle"
grep -Fq 'invitationUrl = `https://nfc.kawvoia.com/invitacion?de=${encodeURIComponent(inviteSenderName)}`' app/src/components/admin/free/FreeAccount.tsx || fail "Invitación no usa de=Nombre"
grep -Fq "split(/\\s+/)[0]" app/src/components/admin/free/FreeAccount.tsx || fail "Invitación no usa primer nombre"
echo "✓ contrato V5.3 validado"

run git add \
  app/src/components/admin/free/FreeNotifications.tsx \
  app/src/components/admin/free/FreeAccount.tsx
if ! git diff --cached --quiet; then
  run git commit -m "fix(account): keep ticket responses in notifications and personalize invites"
  run git push github "HEAD:$BRANCH"
fi

run git diff --check

echo ""
echo "▶ Build App Preview"
(cd app && npx tsc && npx vite build --mode preview) || fail "Build App Preview"

echo ""
echo "▶ Deploy App SOLO Preview"
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
  run git commit -m "chore(preview): pin account center v5.3 app origin"
  run git push github "HEAD:$BRANCH"
fi

echo ""
echo "▶ Deploy Worker SOLO Preview para fijar nuevo App origin"
WORKER_LOG="$LOG_DIR/worker-$(date +%Y%m%d-%H%M%S).log"
(cd api && npx wrangler deploy --config wrangler.preview.toml) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Preview"
WORKER_VERSION="$(grep -E 'Current Version ID:' "$WORKER_LOG" | tail -1 | sed -E 's/.*Current Version ID:[[:space:]]*//')"

for url in \
  "https://app.preview.intaprd.com/admin/free/account" \
  "https://app.preview.intaprd.com/admin/free/notifications"; do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
  echo "✓ $url -> HTTP 200"
done

echo ""
echo "============================================================"
echo "✓ ACCOUNT CENTER V5.3 · PREVIEW LISTO PARA QA"
echo "============================================================"
echo "Commit:         $(git rev-parse HEAD)"
echo "App Pages:      $APP_ORIGIN"
echo "Worker Version: ${WORKER_VERSION:-ver salida Wrangler}"
echo "Producción:     NO TOCADA"
echo ""
echo "QA:"
echo "1) Notificación de soporte -> Ver respuesta: permanece en el detalle y muestra respuesta inline."
echo "2) Botón opcional Ir al Centro de ayuda y tickets es la única salida explícita."
echo "3) Invitar a un amigo genera https://nfc.kawvoia.com/invitacion?de=PrimerNombre."
echo "============================================================"
