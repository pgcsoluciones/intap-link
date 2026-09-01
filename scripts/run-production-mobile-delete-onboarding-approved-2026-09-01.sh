#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawvo-pwa-install"
APP_PROJECT="intap-link"
ROLLBACK_COMMIT="6487da36e697d09b06879d84a1c64a47bb1da60b"
RELEASE_SUFFIX="$(date +%Y%m%d-%H%M%S)"
APP_RELEASE_BRANCH="prod-mobile-delete-onboarding-$RELEASE_SUFFIX"
LOG_DIR="$ROOT/.production-mobile-delete-onboarding-2026-09-01-logs"
ROLLBACK_CONFIG="$ROOT/api/.wrangler.mobile-delete.rollback.toml"
WORKER_DEPLOYED=0

fail() {
  echo ""
  echo "✗ ERROR: $1"

  if [ "$WORKER_DEPLOYED" = "1" ]; then
    echo "▶ Restaurando front door productivo anterior..."
    if git show "$ROLLBACK_COMMIT:api/wrangler.toml" > "$ROLLBACK_CONFIG"; then
      (cd "$ROOT/api" && npx wrangler deploy --config .wrangler.mobile-delete.rollback.toml) || true
      rm -f "$ROLLBACK_CONFIG"
      echo "⚠ Se intentó restaurar la versión productiva anterior. Revisa la salida de Wrangler."
    else
      echo "⚠ No se pudo preparar el rollback automático."
    fi
  fi

  git checkout -- api/wrangler.toml 2>/dev/null || true
  exit 1
}

run() {
  echo ""
  echo "▶ $*"
  "$@" || fail "$*"
}

cd "$ROOT" || fail "No existe $ROOT"

find . -maxdepth 1 -type d -name '.*-logs' -print -exec rm -rf {} + 2>/dev/null || true
mkdir -p "$LOG_DIR"

[ "$(git branch --show-current)" = "$BRANCH" ] || fail "Rama incorrecta: $(git branch --show-current)"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Working tree no está limpio"; }

run git pull --ff-only github "$BRANCH"
SOURCE_SHA="$(git rev-parse HEAD)"

cat <<EOF

============================================================
RELEASE PRODUCTIVO APROBADO · MOBILE DELETE + WELCOME
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
echo "▶ Validando contrato funcional antes de Producción"
python3 - <<'PY' || fail "Contrato de borrado móvil"
from pathlib import Path
p = Path('api/src/preview-profile-delete-mobile.ts').read_text()
required = [
    "app.post('/api/v1/me/profile/delete'",
    'DELETE FROM profile_products WHERE profile_id = ?',
    'DELETE FROM profiles WHERE id = ? AND user_id = ?',
]
for token in required:
    if token not in p:
        raise SystemExit(f'Falta contrato requerido: {token}')
if p.index('DELETE FROM profile_products WHERE profile_id = ?') > p.index('DELETE FROM profiles WHERE id = ? AND user_id = ?'):
    raise SystemExit('profile_products debe eliminarse antes de profiles')
print('✓ borrado móvil conserva orden relacional seguro')
PY

python3 - <<'PY' || fail "Welcome moderna"
from pathlib import Path
p = Path('app/src/components/admin/free/onboarding/FreeOnboardingWelcome.tsx').read_text()
for token in ['Bienvenido de nuevo', '¿Qué deseas hacer?', 'Registrar un producto', 'Iniciar sesión', 'Crear una cuenta']:
    if token not in p:
        raise SystemExit(f'Falta copy esperado: {token}')
for forbidden in ['Tengo mi artículo y mis códigos', 'Sin códigos manuales', 'valida internamente']:
    if forbidden in p:
        raise SystemExit(f'Copy legacy/interno todavía visible: {forbidden}')
print('✓ welcome moderna sin onboarding manual bloqueante')
PY

python3 - <<'PY' || fail "CTA Plan Básico"
from pathlib import Path
p = Path('app/src/components/admin/free/FreePanelUi.tsx').read_text()
if "https://nfc.kawvoia.com/plan-basico" not in p:
    raise SystemExit('CTA Plan Básico no apunta a la URL aprobada')
if 'basicTrialWhatsAppUrl' not in p:
    raise SystemExit('El flujo de prueba de 7 días debe seguir separado')
print('✓ CTA comerciales del Plan Básico y trial separados')
PY

echo ""
echo "▶ Validando App Production"
(cd app && npx tsc && npx vite build --mode production) || fail "Build Production de App"

echo ""
echo "▶ Validando TypeScript del API"
(cd api && npx tsc --noEmit) || fail "TypeScript de API"

echo ""
echo "▶ Dry-run del Worker Production"
(cd api && npx wrangler deploy --config wrangler.toml --dry-run) || fail "Dry-run Worker Producción"

echo ""
echo "▶ Estado previo del Worker productivo"
(cd api && npx wrangler deployments list --config wrangler.toml) 2>&1 | tee "$LOG_DIR/worker-before.log" || true

echo ""
echo "▶ Desplegando App a Pages release de PRODUCCIÓN"
APP_LOG="$LOG_DIR/app-pages-$RELEASE_SUFFIX.log"
(cd api && npx wrangler pages deploy ../app/dist --project-name "$APP_PROJECT" --branch "$APP_RELEASE_BRANCH") 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy release App Pages"
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
    raise SystemExit('No pude fijar APP_PAGES_ORIGIN productivo')
p.write_text(s)
print('✓ APP_PAGES_ORIGIN productivo fijado localmente')
PY

run git diff --check

git show "$ROLLBACK_COMMIT:api/wrangler.toml" > "$ROLLBACK_CONFIG" || fail "Preparar config de rollback"

echo ""
echo "▶ Desplegando Worker a PRODUCCIÓN"
WORKER_LOG="$LOG_DIR/worker-prod-$RELEASE_SUFFIX.log"
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
  "https://app.intaprd.com/admin/free/home?source=pwa" \
  "https://app.intaprd.com/admin/free/onboarding/welcome" \
  "https://app.intaprd.com/admin/login?mode=register" \
  "https://app.intaprd.com/admin/login?mode=login" \
  "https://app.intaprd.com/admin/free/onboarding/product" \
  "https://app.intaprd.com/admin/free/onboarding/bootstrap"; do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
  echo "✓ $url -> HTTP 200"
done

DELETE_CODE="$(curl -sS -o /dev/null -w '%{http_code}' -X POST \
  -H 'content-type: application/json' \
  --data '{"confirm_slug":"ELIMINAR prueba","confirm_email":"nobody@example.com"}' \
  https://app.intaprd.com/api/v1/me/profile/delete)"
[ "$DELETE_CODE" = "401" ] || fail "Endpoint de borrado sin sesión respondió HTTP $DELETE_CODE en lugar de 401"
echo "✓ endpoint de borrado protegido -> HTTP 401 sin sesión"

PLAN_CODE="$(curl -sS -L -o /dev/null -w '%{http_code}' https://nfc.kawvoia.com/plan-basico)"
[ "$PLAN_CODE" = "200" ] || fail "Plan Básico respondió HTTP $PLAN_CODE"
echo "✓ Plan Básico -> HTTP 200"

APP_HTML="$LOG_DIR/app-welcome.html"
curl -fsS https://app.intaprd.com/admin/free/onboarding/welcome -o "$APP_HTML" || fail "Descargar HTML App productiva"
grep -q 'assets/index-' "$APP_HTML" || fail "HTML App productiva no contiene assets esperados"
echo "✓ App productiva sirve assets esperados"

rm -f "$ROLLBACK_CONFIG"
WORKER_DEPLOYED=0

run git add api/wrangler.toml
if ! git diff --cached --quiet; then
  run git commit -m "chore(prod): pin mobile delete onboarding release origin"
  run git push github "HEAD:$BRANCH"
fi

FINAL_SHA="$(git rev-parse HEAD)"
export INTAP_APPROVED_COMMIT="$FINAL_SHA"
run python3 scripts/production_approval_guard.py

TAG="prod-mobile-delete-onboarding-2026-09-01-$(date +%H%M%S)"
git tag -a "$TAG" -m "Approved mobile delete onboarding production release $FINAL_SHA" "$FINAL_SHA" || true
git push github "$TAG" || true

HEALTH="$(curl -fsS https://intaprd.com/api/health || true)"

cat <<EOF

============================================================
✓ RELEASE A PRODUCCIÓN COMPLETADO
============================================================
Branch:          $BRANCH
Commit:          $FINAL_SHA
Release tag:     $TAG
App Pages:       $APP_ORIGIN
Worker Version:  ${WORKER_VERSION:-ver salida Wrangler}
Panel:           https://app.intaprd.com/admin/free
Welcome:         https://app.intaprd.com/admin/free/onboarding/welcome
Plan Básico:     https://nfc.kawvoia.com/plan-basico
Health:          $HEALTH
Logs:            $LOG_DIR
============================================================
EOF
