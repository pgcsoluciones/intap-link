#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="fix/free-mobile-ai-bank-share"
APP_PROJECT="intap-link"
LOG_DIR="$ROOT/.preview-activation-onboarding-logs"

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
[ -z "$(git status --porcelain)" ] || fail "El working tree no está limpio."

run git pull --ff-only github "$BRANCH"
run python3 scripts/apply-initial-activation-onboarding-fix-2026-08-29.py
run git diff --check

echo ""
echo "▶ Validando App"
(cd app && npx tsc && npx vite build --mode preview) || fail "Build Preview de App"
run git diff --check

run git add \
  app/src/components/admin/ScanActivationEntry.tsx \
  app/src/components/admin/free/onboarding/FreeArtifactActivation.tsx

if git diff --cached --quiet; then
  fail "El fix no produjo cambios para confirmar."
fi

run git commit -m "fix(free): restore onboarding after first product activation"
run git push github "HEAD:$BRANCH"

echo ""
echo "▶ Desplegando App SOLO a Pages Preview"
APP_LOG="$LOG_DIR/app-pages-$(date +%Y%m%d-%H%M%S).log"
(cd api && npx wrangler pages deploy ../app/dist --project-name "$APP_PROJECT" --branch "$BRANCH") 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Pages Preview de App"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$APP_LOG" | tail -1)"
[ -n "$APP_ORIGIN" ] || fail "No pude identificar App Pages Preview"
echo "✓ APP_PAGES_ORIGIN=$APP_ORIGIN"

APP_ORIGIN="$APP_ORIGIN" python3 - <<'PY' || fail "Actualizar APP_PAGES_ORIGIN Preview"
from pathlib import Path
import os, re
p = Path('api/wrangler.preview.toml')
s = p.read_text()
app = os.environ['APP_ORIGIN']
s2, n = re.subn(r'^APP_PAGES_ORIGIN = ".*"$', f'APP_PAGES_ORIGIN = "{app}"', s, count=1, flags=re.M)
if n != 1:
    raise SystemExit('No pude actualizar APP_PAGES_ORIGIN')
p.write_text(s2)
print('✓ APP_PAGES_ORIGIN actualizado; Web Preview preservado')
PY

run git diff --check
run git add api/wrangler.preview.toml
if ! git diff --cached --quiet; then
  run git commit -m "chore(preview): pin activation onboarding app deployment"
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
echo "✓ ACTIVACIÓN → ONBOARDING PREVIEW COMPLETADO"
echo "============================================================"
echo "Branch:          $BRANCH"
echo "Commit:          $(git rev-parse HEAD)"
echo "App Pages:       $APP_ORIGIN"
echo "Worker Version:  ${WORKER_VERSION:-ver salida de Wrangler}"
echo "App QA:          https://app.preview.intaprd.com"
echo "Producción:      NO TOCADA"
echo "Logs:            $LOG_DIR"
echo "============================================================"
