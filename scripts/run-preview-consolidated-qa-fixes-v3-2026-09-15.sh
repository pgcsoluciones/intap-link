#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/no-profile-activation-entry-v1"
DEPLOY_BRANCH="feature-no-profile-activation-entry-v1"
APP_PROJECT="intap-web2"
WRANGLER_CFG="api/wrangler.preview.toml"
LOG_DIR="$ROOT/.preview-consolidated-qa-v3-logs"
APP_LOG="$LOG_DIR/app-pages.log"
WORKER_LOG="$LOG_DIR/worker-preview.log"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }
restore_config(){ if [ -d "$ROOT/.git" ]; then git -C "$ROOT" restore -- "$WRANGLER_CFG" >/dev/null 2>&1 || true; fi; }
trap restore_config EXIT

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" && mkdir -p "$LOG_DIR"

cat <<'EOF'
============================================================
KAWVO LINK · QA CONSOLIDADO V3 · PREVIEW · REGRESIÓN CONTROLADA
============================================================
- NO reaplica parches: valida exactamente la rama ya corregida
- conserva flujo posterior a eliminar perfil
- conserva AdminGuard, API, Web, D1 y R2 de producción
- valida cuenta sin perfil + recorridos + notificaciones
- producción NO se toca
============================================================
EOF

run git fetch github "$BRANCH" main
run git checkout "$BRANCH"
run git pull --ff-only github "$BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "El árbol de trabajo no está limpio"; }

BASE_SHA="$(git merge-base HEAD github/main)"
FEATURE_SHA="$(git rev-parse HEAD)"
echo "Base:    $BASE_SHA"
echo "Feature: $FEATURE_SHA"
run git diff --check "$BASE_SHA...HEAD"

echo; echo "▶ Verificación estricta de alcance"
CHANGED="$(git diff --name-only "$BASE_SHA...HEAD")"
echo "$CHANGED"
if echo "$CHANGED" | grep -Eq '^(api/src/|web/src/|functions/|app/src/components/admin/AdminGuard.tsx|app/src/App.tsx)'; then
  fail "Se detectó un cambio fuera del alcance aprobado"
fi

for path in \
  app/src/components/admin/free/FreeGuidedTour.tsx \
  app/src/components/admin/free/FreeAccountGuidedTour.tsx \
  app/src/components/admin/free/FreeTeamGuidedTour.tsx \
  app/src/components/admin/free/FreeNotifications.tsx \
  app/src/components/admin/free/FreeNotificationBell.tsx \
  app/src/components/admin/free/onboarding/FreeOnboardingWelcome.tsx \
  app/src/components/admin/free/onboarding/FreeArtifactActivation.tsx
do
  echo "$CHANGED" | grep -Fxq "$path" || fail "Falta cambio esperado: $path"
done

grep -Fq "navigate('/admin/artifacts', { replace: true })" app/src/components/admin/free/onboarding/FreeOnboardingWelcome.tsx || fail "Se perdió el flujo posterior a eliminar perfil"
grep -Fq "Ya tengo un dispositivo Kawvo" app/src/components/admin/free/onboarding/FreeOnboardingWelcome.tsx || fail "Falta nueva entrada de activación"
grep -Fq "Acerca el NFC a tu móvil" app/src/components/admin/free/onboarding/FreeArtifactActivation.tsx || fail "Falta guía NFC"
grep -Fq "no mostrar solo" app/src/components/admin/free/FreeGuidedTour.tsx || fail "Falta apagado automático Dashboard"
grep -Fq "no mostrar solo" app/src/components/admin/free/FreeAccountGuidedTour.tsx || fail "Falta apagado automático Mi cuenta"
grep -Fq "no mostrar solo" app/src/components/admin/free/FreeTeamGuidedTour.tsx || fail "Falta apagado automático Team"
grep -Fq "kawvo:notifications-changed" app/src/components/admin/free/FreeNotifications.tsx || fail "Falta refresco de notificaciones"
grep -Fq "kawvo:notifications-changed" app/src/components/admin/free/FreeNotificationBell.tsx || fail "Falta refresco de campana"

echo "✓ Invariantes de regresión verificadas"

run npm run build:preview -w app

(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch "$DEPLOY_BRANCH") 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App Pages Preview"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$APP_LOG" | tail -1)"
[ -n "$APP_ORIGIN" ] || fail "No pude identificar App Pages origin"

APP_ORIGIN="$APP_ORIGIN" python3 - <<'PY'
from pathlib import Path
import os,re
p=Path('api/wrangler.preview.toml')
s=p.read_text()
s,n=re.subn(r'^APP_PAGES_ORIGIN = ".*"$', f'APP_PAGES_ORIGIN = "{os.environ["APP_ORIGIN"]}"', s, count=1, flags=re.M)
if n != 1: raise SystemExit('No encontré APP_PAGES_ORIGIN')
p.write_text(s)
PY

(
  cd api
  npx wrangler deploy --config wrangler.preview.toml --dry-run
  npx wrangler deploy --config wrangler.preview.toml
) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Preview"

sleep 4
for url in \
  "https://app.preview.intaprd.com/admin/login" \
  "https://app.preview.intaprd.com/admin/free/onboarding/welcome" \
  "https://app.preview.intaprd.com/admin/artifacts/activate" \
  "https://app.preview.intaprd.com/admin/free" \
  "https://app.preview.intaprd.com/admin/free/account" \
  "https://app.preview.intaprd.com/admin/free/team" \
  "https://app.preview.intaprd.com/admin/free/notifications"
do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

restore_config
trap - EXIT
[ -z "$(git status --porcelain)" ] || { git status --short; fail "El runner dejó cambios locales"; }

cat <<EOF
============================================================
✓ QA CONSOLIDADO V3 DESPLEGADO EN PREVIEW
============================================================
Feature SHA: $FEATURE_SHA
App Pages:   $APP_ORIGIN

Validar manualmente:
1. Cuenta autenticada sin perfil → nueva entrada, sin onboarding viejo.
2. Después de borrar perfil → conserva acceso a Mis productos.
3. Dashboard / Mi cuenta / Team → auto recorrido una sola vez; manual siempre disponible.
4. Notificaciones → abrir marca leída y refresca badge; al volver sigue leída.

Producción NO tocada
============================================================
EOF
