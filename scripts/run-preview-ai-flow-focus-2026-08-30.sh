#!/usr/bin/env bash
set -euo pipefail

BRANCH="fix/free-mobile-ai-bank-share"
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
LOG_DIR="$ROOT/.preview-ai-flow-focus-logs"
mkdir -p "$LOG_DIR"

cd "$ROOT"

step() { printf '\n▶ %s\n\n' "$*"; }

CURRENT_BRANCH="$(git branch --show-current)"
if [[ "$CURRENT_BRANCH" != "$BRANCH" ]]; then
  echo "✗ Rama actual: $CURRENT_BRANCH; esperada: $BRANCH"
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "✗ El árbol de trabajo no está limpio. No continúo para no mezclar cambios."
  git status --short
  exit 1
fi

step "git pull --ff-only github $BRANCH"
git pull --ff-only github "$BRANCH"

step "Aplicando foco UX al Asistente IA"
python3 scripts/apply-ai-flow-focus-2026-08-30.py | tee "$LOG_DIR/patch.log"

step "git diff --check"
git diff --check

step "Validando App"
(
  cd app
  npx tsc
  npx vite build --mode preview
) 2>&1 | tee "$LOG_DIR/app-build.log"

step "git diff --check"
git diff --check

step "Commit y push del cambio de App"
git add app/src/components/admin/free/FreeAiProfileAssistant.tsx
git commit -m "fix(free): streamline AI review and confirmation flow"
git push github "HEAD:$BRANCH"

step "Desplegando App SOLO a Pages Preview"
APP_DEPLOY_OUTPUT="$(cd app && npx wrangler pages deploy dist --project-name intap-link --branch "$BRANCH" 2>&1 | tee "$LOG_DIR/app-deploy.log")"
printf '%s\n' "$APP_DEPLOY_OUTPUT"
APP_PAGES_ORIGIN="$(printf '%s\n' "$APP_DEPLOY_OUTPUT" | grep -Eo 'https://[a-f0-9]+\.intap-link\.pages\.dev' | tail -1)"
if [[ -z "$APP_PAGES_ORIGIN" ]]; then
  echo "✗ No pude detectar el origin inmutable de App Pages."
  exit 1
fi
printf '✓ APP_PAGES_ORIGIN=%s\n' "$APP_PAGES_ORIGIN"

python3 - "$APP_PAGES_ORIGIN" <<'PY'
from pathlib import Path
import re, sys
p = Path('api/wrangler.preview.toml')
s = p.read_text()
origin = sys.argv[1]
new, n = re.subn(r'^APP_PAGES_ORIGIN\s*=\s*"[^"]+"', f'APP_PAGES_ORIGIN = "{origin}"', s, count=1, flags=re.M)
if n != 1:
    raise SystemExit('No pude actualizar APP_PAGES_ORIGIN')
p.write_text(new)
print('✓ APP_PAGES_ORIGIN actualizado; Web Preview preservado')
PY

step "git diff --check"
git diff --check

git add api/wrangler.preview.toml
git commit -m "chore(preview): pin streamlined AI flow deployment"
git push github "HEAD:$BRANCH"

step "Desplegando Worker SOLO PREVIEW"
(
  cd api
  npx wrangler deploy --config wrangler.preview.toml
) 2>&1 | tee "$LOG_DIR/worker-deploy.log"

FINAL_COMMIT="$(git rev-parse HEAD)"
WORKER_VERSION="$(grep -E 'Current Version ID:' "$LOG_DIR/worker-deploy.log" | tail -1 | sed -E 's/.*Current Version ID:[[:space:]]*//')"

cat <<EOF

============================================================
✓ FOCO UX IA PREVIEW COMPLETADO
============================================================
Branch:          $BRANCH
Commit:          $FINAL_COMMIT
App Pages:       $APP_PAGES_ORIGIN
Worker Version:  ${WORKER_VERSION:-no detectado}
App QA:          https://app.preview.intaprd.com/admin/free
Producción:      NO TOCADA
Logs:            $LOG_DIR
============================================================
EOF
