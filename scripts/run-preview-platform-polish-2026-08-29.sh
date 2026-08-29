#!/usr/bin/env bash

# Kawvo Link · lote de pulido general · SOLO PREVIEW
# No ejecuta wrangler.toml de Producción ni despliega a ramas/productos de Producción.

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="fix/free-mobile-ai-bank-share"
APP_PROJECT="intap-link"
WEB_PROJECT="intap-web2"
LOG_DIR="$ROOT/.preview-polish-logs"

fail() {
  echo ""
  echo "✗ ERROR: $1"
  echo "No se tocó Producción. Revisa la salida anterior."
  exit 1
}

run() {
  echo ""
  echo "▶ $*"
  "$@" || fail "$*"
}

cd "$ROOT" || fail "No existe $ROOT"
mkdir -p "$LOG_DIR"

CURRENT_BRANCH="$(git branch --show-current)"
[ "$CURRENT_BRANCH" = "$BRANCH" ] || fail "Rama activa: $CURRENT_BRANCH. Se esperaba $BRANCH"

if [ -n "$(git status --porcelain)" ]; then
  fail "El working tree no está limpio. No voy a mezclar cambios locales con este lote."
fi

run git pull --ff-only github "$BRANCH"

# Aplicación determinista de cambios auditados.
run python3 scripts/apply-platform-polish-batch-2026-08-29.py
run python3 scripts/apply-platform-polish-followup-2026-08-29.py
run python3 scripts/apply-ai-apply-resilience-2026-08-29.py
run git diff --check

# Validación estática y builds Preview.
echo ""
echo "▶ Validando App"
(cd app && npx tsc && npx vite build --mode preview) || fail "Build Preview de App"

echo ""
echo "▶ Validando Web"
(cd web && npx tsc && npx vite build --mode preview) || fail "Build Preview de Web"

echo ""
echo "▶ Validando API"
(cd api && npx tsc --noEmit) || fail "TypeScript de API"

run git diff --check

# Guardamos el lote funcional antes de cualquier deploy.
run git add \
  api/src/ai-profile-assistant.ts \
  app/src/components/admin/free/FreeAiProfileAssistant.tsx \
  app/src/components/admin/free/FreeDashboard.tsx \
  app/src/components/admin/free/FreePortfolio.tsx \
  app/src/components/admin/free/FreeServices.tsx \
  app/src/components/admin/free/FreeVisualEditor.tsx \
  app/src/components/admin/free/onboarding/FreeOnboardingIdentity.tsx \
  web/src/components/PublicProfile.tsx \
  web/src/components/free-profile/IntapLinkGratisProfile.tsx

if git diff --cached --quiet; then
  fail "Los scripts no produjeron cambios para confirmar."
fi

run git commit -m "fix(free): harden media sharing AI apply and profile UX"
run git push github "HEAD:$BRANCH"

# Pages Preview: capturamos deployment inmutable, no alias de rama.
echo ""
echo "▶ Desplegando App SOLO a Cloudflare Pages Preview"
APP_LOG="$LOG_DIR/app-pages-$(date +%Y%m%d-%H%M%S).log"
(cd api && npx wrangler pages deploy ../app/dist --project-name "$APP_PROJECT" --branch "$BRANCH") 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Pages Preview de App"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$APP_LOG" | tail -1)"
[ -n "$APP_ORIGIN" ] || fail "No pude identificar el deployment inmutable de App en $APP_LOG"
echo "✓ APP_PAGES_ORIGIN=$APP_ORIGIN"

echo ""
echo "▶ Desplegando Web SOLO a Cloudflare Pages Preview"
WEB_LOG="$LOG_DIR/web-pages-$(date +%Y%m%d-%H%M%S).log"
(cd api && npx wrangler pages deploy ../web/dist --project-name "$WEB_PROJECT" --branch "$BRANCH") 2>&1 | tee "$WEB_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Pages Preview de Web"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$WEB_LOG" | tail -1)"
[ -n "$WEB_ORIGIN" ] || fail "No pude identificar el deployment inmutable de Web en $WEB_LOG"
echo "✓ WEB_PAGES_ORIGIN=$WEB_ORIGIN"

# El Worker Preview debe apuntar exactamente a esos dos deployments inmutables.
APP_ORIGIN="$APP_ORIGIN" WEB_ORIGIN="$WEB_ORIGIN" python3 - <<'PY' || fail "Actualizar origins Preview"
from pathlib import Path
import os, re
p = Path('api/wrangler.preview.toml')
s = p.read_text()
app = os.environ['APP_ORIGIN']
web = os.environ['WEB_ORIGIN']
s2, n1 = re.subn(r'^APP_PAGES_ORIGIN = ".*"$', f'APP_PAGES_ORIGIN = "{app}"', s, count=1, flags=re.M)
s3, n2 = re.subn(r'^WEB_PAGES_ORIGIN = ".*"$', f'WEB_PAGES_ORIGIN = "{web}"', s2, count=1, flags=re.M)
if n1 != 1 or n2 != 1:
    raise SystemExit('No pude actualizar ambos origins Preview')
p.write_text(s3)
print('✓ wrangler.preview.toml actualizado')
PY

run git diff --check
run git add api/wrangler.preview.toml
if ! git diff --cached --quiet; then
  run git commit -m "chore(preview): pin latest Pages deployments"
  run git push github "HEAD:$BRANCH"
fi

echo ""
echo "▶ Desplegando Worker SOLO PREVIEW"
WORKER_LOG="$LOG_DIR/worker-$(date +%Y%m%d-%H%M%S).log"
(cd api && npx wrangler deploy --config wrangler.preview.toml) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Preview"
WORKER_VERSION="$(grep -E 'Current Version ID:' "$WORKER_LOG" | tail -1 | sed -E 's/.*Current Version ID:[[:space:]]*//')"

echo ""
echo "============================================================"
echo "✓ LOTE PREVIEW COMPLETADO"
echo "============================================================"
echo "Branch:          $BRANCH"
echo "Commit:          $(git rev-parse HEAD)"
echo "App Pages:       $APP_ORIGIN"
echo "Web Pages:       $WEB_ORIGIN"
echo "Worker Version:  ${WORKER_VERSION:-ver salida de Wrangler}"
echo "App QA:          https://app.preview.intaprd.com/admin/free"
echo "Web QA:          https://preview.intaprd.com"
echo "Producción:      NO TOCADA"
echo "Logs:            $LOG_DIR"
echo "============================================================"
