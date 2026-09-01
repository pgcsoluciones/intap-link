#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawvo-pwa-install"
APP_PROJECT="intap-link"
ROLLBACK_COMMIT="22ee307214d917a9c261a93e1899ae6986ddf4e8"
APP_RELEASE_BRANCH="prod-account-center-$(date +%Y%m%d-%H%M%S)"
LOG_DIR="$ROOT/.production-account-center-2026-09-01-logs"
ROLLBACK_CONFIG="$ROOT/api/.wrangler.account-center.rollback.toml"
WORKER_DEPLOYED=0

fail() {
  echo ""
  echo "✗ ERROR: $1"
  if [ "$WORKER_DEPLOYED" = "1" ]; then
    echo "▶ Intentando restaurar el front door productivo anterior..."
    if git show "$ROLLBACK_COMMIT:api/wrangler.toml" > "$ROLLBACK_CONFIG"; then
      (cd "$ROOT/api" && npx wrangler deploy --config .wrangler.account-center.rollback.toml) || true
      rm -f "$ROLLBACK_CONFIG"
      echo "⚠ Se intentó restaurar la configuración productiva anterior."
    fi
  fi
  git checkout -- api/wrangler.toml 2>/dev/null || true
  exit 1
}

run() { echo ""; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
mkdir -p "$LOG_DIR"

run git fetch github "$BRANCH"
run git checkout -B "$BRANCH" "github/$BRANCH"
run git pull --ff-only github "$BRANCH"

[ -z "$(git status --porcelain)" ] || { git status --short; fail "Working tree no está limpio"; }

git merge-base --is-ancestor 52b66d939e3b614d91cfba85b7f62b0f27c80caf HEAD || fail "El merge aprobado de Mi cuenta no está presente en la rama productiva"
SOURCE_SHA="$(git rev-parse HEAD)"

cat <<EOF

============================================================
RELEASE PRODUCTIVO APROBADO · MI CUENTA / ACCOUNT CENTER
Branch:      $BRANCH
Source SHA:  $SOURCE_SHA
Rollback:    $ROLLBACK_COMMIT
============================================================
EOF

export INTAP_ENFORCE_PRODUCTION_APPROVAL=1
export INTAP_PRODUCTION_APPROVAL="SÍ"
export INTAP_APPROVED_COMMIT="$SOURCE_SHA"
run python3 scripts/production_approval_guard.py
run git diff --check

echo ""
echo "▶ Validando contrato aprobado"
python3 - <<'PY' || fail "Contrato Mi cuenta"
from pathlib import Path
checks = {
    'app/src/components/admin/free/FreeAccount.tsx': [
        'Plan Plus',
        'Enviar enlace de cuentas',
        'Invitar a un amigo',
        'Instalar app Kawvo',
        'https://nfc.kawvoia.com/invitacion?de=',
    ],
    'app/src/components/admin/free/FreeNotifications.tsx': [
        'Detalle de notificación',
        'image_url',
        'Marcar todas leídas',
        'Eliminar notificación',
        'Ir al Centro de ayuda y tickets',
    ],
    'app/src/components/admin/free/FreeSupportPanel.tsx': [
        'Centro de ayuda y tickets',
    ],
    'api/src/preview-support-tickets.ts': ['image_url'],
}
for path, tokens in checks.items():
    text = Path(path).read_text()
    for token in tokens:
        if token not in text:
            raise SystemExit(f'Falta {token!r} en {path}')
for migration in [
    Path('api/migrations/0042_account_center_resources.sql'),
    Path('api/migrations/0043_user_notification_media.sql'),
]:
    if not migration.exists():
        raise SystemExit(f'Falta migración {migration}')
print('✓ contrato de Mi cuenta y notificaciones validado')
PY

echo ""
echo "▶ Build App Production"
(cd app && npx tsc && npx vite build --mode production) || fail "Build App Production"

echo ""
echo "▶ TypeScript API Production"
(cd api && npx tsc --noEmit) || fail "TypeScript API"

echo ""
echo "▶ Dry-run Worker Production"
(cd api && npx wrangler deploy --config wrangler.toml --dry-run) || fail "Dry-run Worker Producción"

echo ""
echo "▶ Aplicando migraciones aditivas SOLO en D1 Producción"
(cd api && npx wrangler d1 migrations apply intap_db --remote --config wrangler.toml) || fail "Migraciones D1 Producción"

echo ""
echo "▶ Desplegando App a Pages release de PRODUCCIÓN"
APP_LOG="$LOG_DIR/app-pages-$(date +%Y%m%d-%H%M%S).log"
(cd api && npx wrangler pages deploy ../app/dist --project-name "$APP_PROJECT" --branch "$APP_RELEASE_BRANCH") 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App Pages Producción"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$APP_LOG" | tail -1)"
[ -n "$APP_ORIGIN" ] || fail "No pude identificar APP_PAGES_ORIGIN"
echo "✓ APP_PAGES_ORIGIN=$APP_ORIGIN"

APP_ORIGIN="$APP_ORIGIN" python3 - <<'PY' || fail "Actualizar APP_PAGES_ORIGIN productivo"
from pathlib import Path
import os, re
p = Path('api/wrangler.toml')
s = p.read_text()
s, n = re.subn(r'^APP_PAGES_ORIGIN = ".*"$', f'APP_PAGES_ORIGIN = "{os.environ["APP_ORIGIN"]}"', s, count=1, flags=re.M)
if n != 1:
    raise SystemExit('No pude fijar APP_PAGES_ORIGIN')
p.write_text(s)
PY
run git diff --check

git show "$ROLLBACK_COMMIT:api/wrangler.toml" > "$ROLLBACK_CONFIG" || fail "Preparar rollback del Worker"

echo ""
echo "▶ Desplegando Worker a PRODUCCIÓN"
WORKER_LOG="$LOG_DIR/worker-$(date +%Y%m%d-%H%M%S).log"
(cd api && npx wrangler deploy --config wrangler.toml) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Producción"
WORKER_DEPLOYED=1
WORKER_VERSION="$(grep -E 'Current Version ID:' "$WORKER_LOG" | tail -1 | sed -E 's/.*Current Version ID:[[:space:]]*//')"

sleep 2

echo ""
echo "▶ Smoke tests de Producción"
HEALTH="$(curl -fsS https://intaprd.com/api/health)" || fail "Health productivo"
echo "✓ Health: $HEALTH"

for url in \
  "https://app.intaprd.com/admin/free" \
  "https://app.intaprd.com/admin/free/account" \
  "https://app.intaprd.com/admin/free/notifications" \
  "https://app.intaprd.com/admin/artifacts?from=account"; do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
  echo "✓ $url -> HTTP 200"
done

for url in \
  "https://app.intaprd.com/api/v1/me/account/resources" \
  "https://app.intaprd.com/api/v1/me/notifications?limit=1"; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' "$url")"
  [ "$code" = "401" ] || fail "$url sin sesión respondió HTTP $code en lugar de 401"
  echo "✓ endpoint protegido -> HTTP 401"
done

INVITE_CODE="$(curl -sS -L -o /dev/null -w '%{http_code}' 'https://nfc.kawvoia.com/invitacion?de=QA')"
[ "$INVITE_CODE" = "200" ] || fail "Landing de invitación respondió HTTP $INVITE_CODE"
echo "✓ landing de invitación -> HTTP 200"

rm -f "$ROLLBACK_CONFIG"
WORKER_DEPLOYED=0

run git add api/wrangler.toml
if ! git diff --cached --quiet; then
  run git commit -m "chore(prod): pin account center release origin"
  run git push github "HEAD:$BRANCH"
fi

FINAL_SHA="$(git rev-parse HEAD)"
export INTAP_APPROVED_COMMIT="$FINAL_SHA"
run python3 scripts/production_approval_guard.py

TAG="prod-account-center-2026-09-01-$(date +%H%M%S)"
git tag -a "$TAG" -m "Approved Kawvo Mi cuenta production release $FINAL_SHA" "$FINAL_SHA" || true
git push github "$TAG" || true

cat <<EOF

============================================================
✓ MI CUENTA / ACCOUNT CENTER · PRODUCCIÓN COMPLETADA
============================================================
Branch:          $BRANCH
Commit:          $FINAL_SHA
Release tag:     $TAG
App Pages:       $APP_ORIGIN
Worker Version:  ${WORKER_VERSION:-ver salida Wrangler}
Mi cuenta:       https://app.intaprd.com/admin/free/account
Notificaciones:  https://app.intaprd.com/admin/free/notifications
Health:          $HEALTH
Logs:            $LOG_DIR
============================================================
EOF
