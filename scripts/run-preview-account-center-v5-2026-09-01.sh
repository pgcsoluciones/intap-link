#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawvo-account-center-v1"
APP_PROJECT="intap-link"
WEB_PROJECT="intap-web2"
LOG_DIR="$ROOT/.preview-account-center-v5-2026-09-01-logs"

fail() { echo ""; echo "✗ ERROR: $1"; echo "Producción no fue tocada."; exit 1; }
run() { echo ""; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
mkdir -p "$LOG_DIR"
run git fetch github "$BRANCH"
run git reset --hard "github/$BRANCH"
run python3 scripts/apply-account-center-v5.py
run git diff --check

echo ""
echo "▶ Validando Account Center v5"
grep -Fq 'path="/admin/free/notifications"' app/src/App.tsx || fail "Falta ruta propia de Notificaciones"
grep -Fq 'Detalle de notificación' app/src/components/admin/free/FreeNotifications.tsx || fail "Falta detalle robusto de notificación"
grep -Fq 'image_url' app/src/components/admin/free/FreeNotifications.tsx || fail "Notificaciones no soportan imágenes"
grep -Fq 'Marcar todas leídas' app/src/components/admin/free/FreeNotifications.tsx || fail "Falta gestión de lectura"
grep -Fq 'Eliminar notificación' app/src/components/admin/free/FreeNotifications.tsx || fail "Falta eliminación de notificaciones"
grep -Fq "navigate('/admin/free/notifications?from=account')" app/src/components/admin/free/FreeAccount.tsx || fail "Mi cuenta no abre el centro de notificaciones"
grep -Fq "navigate('/admin/artifacts?from=account')" app/src/components/admin/free/FreeAccount.tsx || fail "Productos no preserva origen Mi cuenta"
grep -Fq 'Regresar a Mi cuenta' app/src/components/admin/ArtifactActivation.tsx || fail "Productos no permite regresar a Mi cuenta"
grep -Fq '${webUrl}/invitacion' app/src/components/admin/free/FreeAccount.tsx || fail "Invitación no usa /invitacion"
grep -Fq 'te lo recomiendo' app/src/components/admin/free/FreeAccount.tsx || fail "Copy de invitación no fue actualizado"
grep -Fq 'Centro de ayuda y tickets' app/src/components/admin/free/FreeSupportPanel.tsx || fail "Centro de ayuda no usa copy aprobado"
grep -Fq 'bg-[#f5f5f5]' app/src/components/admin/free/FreeSupportPanel.tsx || fail "Centro de ayuda no usa fachada gris"
grep -Fq 'share=bancos: social card bancaria' functions/_middleware.ts || fail "Falta Graph Card bancaria"
grep -Fq "url.pathname === '/invitacion'" functions/_middleware.ts || fail "Falta Graph Card de invitación"
grep -Fq 'image_url' api/src/preview-support-tickets.ts || fail "API no expone imagen de notificación"
echo "✓ contrato v5 validado"

run git add \
  app/src/App.tsx \
  app/src/components/admin/free/FreeNotifications.tsx \
  app/src/components/admin/free/FreeNotificationBell.tsx \
  app/src/components/admin/free/FreeAccount.tsx \
  app/src/components/admin/free/FreeSupportPanel.tsx \
  app/src/components/admin/ArtifactActivation.tsx \
  api/src/preview-support-tickets.ts \
  api/migrations/0043_user_notification_media.sql \
  api/migrations-preview/0043_user_notification_media.sql \
  functions/_middleware.ts
if ! git diff --cached --quiet; then
  run git commit -m "feat(account): add notification center and social sharing continuity"
  run git push github "HEAD:$BRANCH"
fi

run git diff --check

echo ""
echo "▶ Build App Preview"
(cd app && npx tsc && npx vite build --mode preview) || fail "Build App Preview"

echo ""
echo "▶ Build Web Preview"
(cd web && npm run build) || fail "Build Web Preview"

echo ""
echo "▶ TypeScript API Preview"
(cd api && npx tsc --noEmit) || fail "TypeScript API Preview"

echo ""
echo "▶ D1 migration SOLO Preview"
(cd api && npx wrangler d1 migrations apply intap_db_preview --remote --config wrangler.preview.toml) || fail "Migración D1 Preview"

echo ""
echo "▶ Dry-run Worker Preview"
(cd api && npx wrangler deploy --config wrangler.preview.toml --dry-run) || fail "Dry-run Worker Preview"

echo ""
echo "▶ Deploy App SOLO Preview"
APP_LOG="$LOG_DIR/app-pages-$(date +%Y%m%d-%H%M%S).log"
(cd api && npx wrangler pages deploy ../app/dist --project-name "$APP_PROJECT" --branch "$BRANCH") 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App Preview"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$APP_LOG" | tail -1)"
[ -n "$APP_ORIGIN" ] || fail "No pude identificar APP_PAGES_ORIGIN"
echo "✓ APP_PAGES_ORIGIN=$APP_ORIGIN"

echo ""
echo "▶ Deploy Web SOLO Preview"
WEB_LOG="$LOG_DIR/web-pages-$(date +%Y%m%d-%H%M%S).log"
(cd web && npx wrangler pages deploy dist --project-name "$WEB_PROJECT" --branch "$BRANCH") 2>&1 | tee "$WEB_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Web Preview"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$WEB_LOG" | tail -1)"
[ -n "$WEB_ORIGIN" ] || fail "No pude identificar WEB_PAGES_ORIGIN"
echo "✓ WEB_PAGES_ORIGIN=$WEB_ORIGIN"

APP_ORIGIN="$APP_ORIGIN" WEB_ORIGIN="$WEB_ORIGIN" python3 - <<'PY' || fail "Pin origins Preview"
from pathlib import Path
import os, re
p = Path('api/wrangler.preview.toml')
s = p.read_text()
s, a = re.subn(r'^APP_PAGES_ORIGIN = ".*"$', f'APP_PAGES_ORIGIN = "{os.environ["APP_ORIGIN"]}"', s, count=1, flags=re.M)
s, w = re.subn(r'^WEB_PAGES_ORIGIN = ".*"$', f'WEB_PAGES_ORIGIN = "{os.environ["WEB_ORIGIN"]}"', s, count=1, flags=re.M)
if a != 1 or w != 1: raise SystemExit('No pude actualizar origins Preview')
p.write_text(s)
PY
run git add api/wrangler.preview.toml
if ! git diff --cached --quiet; then
  run git commit -m "chore(preview): pin account center v5 origins"
  run git push github "HEAD:$BRANCH"
fi

echo ""
echo "▶ Deploy Worker SOLO Preview"
WORKER_LOG="$LOG_DIR/worker-$(date +%Y%m%d-%H%M%S).log"
(cd api && npx wrangler deploy --config wrangler.preview.toml) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Preview"
WORKER_VERSION="$(grep -E 'Current Version ID:' "$WORKER_LOG" | tail -1 | sed -E 's/.*Current Version ID:[[:space:]]*//')"

for url in \
  "https://app.preview.intaprd.com/admin/free" \
  "https://app.preview.intaprd.com/admin/free/account" \
  "https://app.preview.intaprd.com/admin/free/notifications" \
  "https://app.preview.intaprd.com/admin/artifacts?from=account" \
  "https://preview.intaprd.com/invitacion"; do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
  echo "✓ $url -> HTTP 200"
done

INVITE_HTML="$(curl -sS https://preview.intaprd.com/invitacion)"
printf '%s' "$INVITE_HTML" | grep -Fq 'Te recomiendo Kawvo Link' || fail "Graph Card /invitacion no está inyectada"
echo "✓ Graph Card /invitacion detectada"

echo ""
echo "============================================================"
echo "✓ ACCOUNT CENTER V5 · PREVIEW LISTO PARA QA"
echo "============================================================"
echo "Commit:         $(git rev-parse HEAD)"
echo "App Pages:      $APP_ORIGIN"
echo "Web Pages:      $WEB_ORIGIN"
echo "Worker Version: ${WORKER_VERSION:-ver salida Wrangler}"
echo "Mi cuenta:      https://app.preview.intaprd.com/admin/free/account"
echo "Notificaciones: https://app.preview.intaprd.com/admin/free/notifications"
echo "Invitación:     https://preview.intaprd.com/invitacion"
echo "Producción:     NO TOCADA"
echo ""
echo "QA VISUAL/FUNCIONAL:"
echo "1) Mi cuenta -> Mis productos -> Regresar a Mi cuenta."
echo "2) Mi cuenta/campana -> Centro de Notificaciones propio."
echo "3) Lista, Sin leer, detalle, imagen/promoción, marcar leída, marcar todas, eliminar y CTA."
echo "4) Enviar enlace de cuentas: comprobar Graph Card en WhatsApp/social y apertura directa en Bancos."
echo "5) Invitar a un amigo: copy recomendado + /invitacion + Graph Card."
echo "6) Centro de ayuda/tickets único, gris y con todas las funciones anteriores."
echo "============================================================"
