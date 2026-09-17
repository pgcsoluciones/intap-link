#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/account-access-methods-v1"
APP_PROJECT="intap-web2"
CFG="$ROOT/api/wrangler.preview.toml"
LOG_DIR="$ROOT/.preview-account-access-methods-v1-restore-origin-logs"
APP_LOG="$LOG_DIR/app-pages.log"
WORKER_LOG="$LOG_DIR/worker-preview.log"
CFG_BAK="$LOG_DIR/wrangler.preview.toml.bak"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" && mkdir -p "$LOG_DIR"

cat <<'EOF'
============================================================
KAWVO LINK · RESTAURAR APP PREVIEW CORRECTA
============================================================
Corrige la regresión visual provocada al redeployar el Worker Preview
con un APP_PAGES_ORIGIN antiguo.

- recompila la rama actual de Credenciales
- despliega App Pages Preview nueva
- apunta app.preview.intaprd.com al deployment correcto
- conserva RESEND_API_KEY ya configurado
- no toca Producción
- no toca D1/R2
============================================================
EOF

run git fetch github "$BRANCH" main
run git checkout "$BRANCH"
run git pull --ff-only github "$BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "El árbol de trabajo no está limpio"; }

run git diff --check
run npm run build:preview -w app

(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch feature-account-access-methods-v1) 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App Preview"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$APP_LOG" | tail -1)"
[ -n "$APP_ORIGIN" ] || fail "No pude detectar origin inmutable de App Pages"
echo "✓ App Pages Preview correcta: $APP_ORIGIN"

cp "$CFG" "$CFG_BAK"
restore_cfg(){ cp "$CFG_BAK" "$CFG" 2>/dev/null || true; }
trap restore_cfg EXIT

python3 - "$CFG" "$APP_ORIGIN" <<'PY'
from pathlib import Path
import re,sys
p=Path(sys.argv[1]); origin=sys.argv[2]
s=p.read_text()
s2,n=re.subn(r'APP_PAGES_ORIGIN\s*=\s*"[^"]+"',f'APP_PAGES_ORIGIN = "{origin}"',s,count=1)
if n != 1: raise SystemExit('No pude actualizar APP_PAGES_ORIGIN')
p.write_text(s2)
print('✓ APP_PAGES_ORIGIN temporal =', origin)
PY

(
  cd api
  npx wrangler deploy --config wrangler.preview.toml --dry-run
  npx wrangler deploy --config wrangler.preview.toml
) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Preview"

restore_cfg
trap - EXIT

sleep 4

echo; echo "▶ Smoke HTTP Preview"
for url in \
  "https://app.preview.intaprd.com/admin/login" \
  "https://app.preview.intaprd.com/admin/free" \
  "https://app.preview.intaprd.com/admin/free/account" \
  "https://app.preview.intaprd.com/admin/free/credentials"
do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

[ -z "$(git status --porcelain)" ] || { git status --short; fail "El runner dejó cambios locales"; }

WORKER_VERSION="$(grep -E 'Current Version ID:' "$WORKER_LOG" | tail -1 | sed -E 's/.*Current Version ID:[[:space:]]*//' || true)"

cat <<EOF
============================================================
✓ APP PREVIEW RESTAURADA
============================================================
Feature SHA: $(git rev-parse HEAD)
App Pages: $APP_ORIGIN
Worker Preview: ${WORKER_VERSION:-ver salida Wrangler}

Abrir:
https://app.preview.intaprd.com/admin/free

Producción NO tocada
D1/R2 NO tocados
============================================================
EOF
