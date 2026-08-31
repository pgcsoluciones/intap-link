#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawvo-pwa-install"
WEB_PROJECT="intap-web2"
LOG_DIR="$ROOT/.preview-vcard-direct-open-logs"

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
[ "$(git branch --show-current)" = "$BRANCH" ] || fail "Rama incorrecta: $(git branch --show-current)"

# Permitimos únicamente residuos locales de logs; cualquier cambio de código bloquea.
DIRTY="$(git status --porcelain | grep -vE '^\?\? \.production-|^\?\? \.preview-' || true)"
[ -z "$DIRTY" ] || fail "Working tree tiene cambios de código no esperados"

run git pull --ff-only github "$BRANCH"
run python3 scripts/apply-vcard-direct-open-2026-08-31.py
run git diff --check

echo ""
echo "▶ Validando Web Preview"
(cd web && npx tsc && npx vite build --mode preview) || fail "Build Preview de Web"

run git add web/src/components/free-profile/IntapLinkGratisProfile.tsx
if git diff --cached --quiet; then
  fail "El patch vCard no produjo cambios"
fi
run git commit -m "fix(vcard): open contact directly on mobile"
run git push github "HEAD:$BRANCH"

echo ""
echo "▶ Desplegando Web SOLO a Pages Preview"
WEB_LOG="$LOG_DIR/web-pages-$(date +%Y%m%d-%H%M%S).log"
(cd api && npx wrangler pages deploy ../web/dist --project-name "$WEB_PROJECT" --branch "$BRANCH") 2>&1 | tee "$WEB_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Web Preview"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$WEB_LOG" | tail -1)"
[ -n "$WEB_ORIGIN" ] || fail "No pude identificar WEB_PAGES_ORIGIN"
echo "✓ WEB_PAGES_ORIGIN=$WEB_ORIGIN"

WEB_ORIGIN="$WEB_ORIGIN" python3 - <<'PY' || fail "Actualizar WEB_PAGES_ORIGIN Preview"
from pathlib import Path
import os, re
p = Path('api/wrangler.preview.toml')
s = p.read_text()
s, n = re.subn(r'^WEB_PAGES_ORIGIN = ".*"$', f'WEB_PAGES_ORIGIN = "{os.environ["WEB_ORIGIN"]}"', s, count=1, flags=re.M)
if n != 1:
    raise SystemExit('No pude actualizar WEB_PAGES_ORIGIN Preview')
p.write_text(s)
print('✓ WEB_PAGES_ORIGIN Preview actualizado')
PY

run git diff --check
run git add api/wrangler.preview.toml
if ! git diff --cached --quiet; then
  run git commit -m "chore(preview): pin vCard direct-open deployment"
  run git push github "HEAD:$BRANCH"
fi

echo ""
echo "▶ Desplegando Worker SOLO PREVIEW"
WORKER_LOG="$LOG_DIR/worker-$(date +%Y%m%d-%H%M%S).log"
(cd api && npx wrangler deploy --config wrangler.preview.toml) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Preview"
WORKER_VERSION="$(grep -E 'Current Version ID:' "$WORKER_LOG" | tail -1 | sed -E 's/.*Current Version ID:[[:space:]]*//')"

curl -fsS -o /dev/null https://preview.intaprd.com/ || fail "Web Preview raíz"

echo ""
echo "============================================================"
echo "✓ VCARD DIRECT-OPEN · PREVIEW LISTO PARA QA"
echo "============================================================"
echo "Branch:          $BRANCH"
echo "Commit:          $(git rev-parse HEAD)"
echo "Web Pages:       $WEB_ORIGIN"
echo "Worker Version:  ${WORKER_VERSION:-ver salida Wrangler}"
echo "Web QA:          https://preview.intaprd.com"
echo "Producción:      NO TOCADA"
echo "Logs:            $LOG_DIR"
echo "============================================================"
