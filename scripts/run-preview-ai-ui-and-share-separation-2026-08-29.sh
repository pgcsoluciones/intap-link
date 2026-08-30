#!/usr/bin/env bash

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="fix/free-mobile-ai-bank-share"
APP_PROJECT="intap-link"
WEB_PROJECT="intap-web2"
LOG_DIR="$ROOT/.preview-ai-ui-share-logs"

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
[ "$(git branch --show-current)" = "$BRANCH" ] || fail "Rama incorrecta"
[ -z "$(git status --porcelain)" ] || fail "Working tree no está limpio"

run git pull --ff-only github "$BRANCH"
run python3 scripts/apply-ai-ui-and-share-separation-2026-08-29.py
run git diff --check

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
run git add \
  app/src/components/admin/free/FreeAiProfileAssistant.tsx \
  web/src/components/free-profile/IntapLinkGratisProfile.tsx \
  api/src/ai-profile-assistant.ts

if git diff --cached --quiet; then
  fail "El patch no produjo cambios"
fi

run git commit -m "fix(free): separate bank sharing and simplify AI flow"
run git push github "HEAD:$BRANCH"

echo ""
echo "▶ Desplegando App SOLO a Pages Preview"
APP_LOG="$LOG_DIR/app-pages-$(date +%Y%m%d-%H%M%S).log"
(cd api && npx wrangler pages deploy ../app/dist --project-name "$APP_PROJECT" --branch "$BRANCH") 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App Preview"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$APP_LOG" | tail -1)"
[ -n "$APP_ORIGIN" ] || fail "No pude identificar APP_PAGES_ORIGIN"
echo "✓ APP_PAGES_ORIGIN=$APP_ORIGIN"

echo ""
echo "▶ Desplegando Web SOLO a Pages Preview"
WEB_LOG="$LOG_DIR/web-pages-$(date +%Y%m%d-%H%M%S).log"
(cd api && npx wrangler pages deploy ../web/dist --project-name "$WEB_PROJECT" --branch "$BRANCH") 2>&1 | tee "$WEB_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Web Preview"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$WEB_LOG" | tail -1)"
[ -n "$WEB_ORIGIN" ] || fail "No pude identificar WEB_PAGES_ORIGIN"
echo "✓ WEB_PAGES_ORIGIN=$WEB_ORIGIN"

APP_ORIGIN="$APP_ORIGIN" WEB_ORIGIN="$WEB_ORIGIN" python3 - <<'PY' || fail "Actualizar origins Preview"
from pathlib import Path
import os, re
p = Path('api/wrangler.preview.toml')
s = p.read_text()
s, n1 = re.subn(r'^APP_PAGES_ORIGIN = ".*"$', f'APP_PAGES_ORIGIN = "{os.environ["APP_ORIGIN"]}"', s, count=1, flags=re.M)
s, n2 = re.subn(r'^WEB_PAGES_ORIGIN = ".*"$', f'WEB_PAGES_ORIGIN = "{os.environ["WEB_ORIGIN"]}"', s, count=1, flags=re.M)
if n1 != 1 or n2 != 1:
    raise SystemExit('No pude actualizar origins Preview')
p.write_text(s)
print('✓ origins Preview actualizados')
PY

run git diff --check
run git add api/wrangler.preview.toml
if ! git diff --cached --quiet; then
  run git commit -m "chore(preview): pin AI UX and share QA deployments"
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
echo "✓ IA / SHARE PREVIEW COMPLETADO"
echo "============================================================"
echo "Branch:          $BRANCH"
echo "Commit:          $(git rev-parse HEAD)"
echo "App Pages:       $APP_ORIGIN"
echo "Web Pages:       $WEB_ORIGIN"
echo "Worker Version:  ${WORKER_VERSION:-ver salida Wrangler}"
echo "App QA:          https://app.preview.intaprd.com/admin/free"
echo "Web QA:          https://preview.intaprd.com"
echo "Producción:      NO TOCADA"
echo "Logs:            $LOG_DIR"
echo "============================================================"
