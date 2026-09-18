#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/superadmin-sponsor-code-list-v1"
EXPECTED_MAIN_SHA="7be94abe8375cc8ffec4bb21b5f5d79930c4f127"
APP_PROJECT="intap-web2"
LOG_DIR="$ROOT/.preview-superadmin-sponsor-code-list-v1-logs"
APP_LOG="$LOG_DIR/app-pages.log"
WORKER_LOG="$LOG_DIR/worker-preview.log"
PREVIEW_CFG="$ROOT/api/wrangler.preview.toml"
PREVIEW_CFG_BAK="$LOG_DIR/wrangler.preview.toml.bak"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" && mkdir -p "$LOG_DIR"

run git fetch github main "$BRANCH"
[ "$(git rev-parse github/main)" = "$EXPECTED_MAIN_SHA" ] || fail "main cambió; detener y auditar"
run git switch "$BRANCH"
run git pull --ff-only github "$BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Árbol local no limpio"; }

ALLOWED='^(api/src/sponsored-profiles\.ts|app/src/components/admin/SuperAdminSponsors\.tsx|scripts/test-sponsored-profile-contract\.mjs|scripts/run-preview-superadmin-sponsor-code-list-v1-2026-09-18\.sh)$'
UNEXPECTED="$(git diff --name-only github/main...HEAD | grep -Ev "$ALLOWED" || true)"
[ -z "$UNEXPECTED" ] || { echo "$UNEXPECTED"; fail "Hay archivos fuera del alcance"; }

run git diff --check github/main...HEAD
run npm ci
run node scripts/test-sponsored-profile-contract.mjs
run npm run build:preview -w app
run bash -lc 'cd api && npx tsc --noEmit'

echo; echo "▶ Deploy App Pages Preview"
(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch "$BRANCH") 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App Preview"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$APP_LOG" | tail -1)"
[ -n "$APP_ORIGIN" ] || fail "No pude detectar origin App Preview"

cp "$PREVIEW_CFG" "$PREVIEW_CFG_BAK"
restore_cfg(){ cp "$PREVIEW_CFG_BAK" "$PREVIEW_CFG" 2>/dev/null || true; }
trap restore_cfg EXIT
python3 - "$PREVIEW_CFG" "$APP_ORIGIN" <<'PY'
from pathlib import Path
import re,sys
p=Path(sys.argv[1]); app=sys.argv[2]
s=p.read_text()
s,n=re.subn(r'APP_PAGES_ORIGIN\s*=\s*"[^"]+"',f'APP_PAGES_ORIGIN = "{app}"',s,count=1)
if n != 1: raise SystemExit("No pude actualizar APP_PAGES_ORIGIN")
p.write_text(s)
PY

echo; echo "▶ Deploy Worker Preview"
(
 cd api
 npx wrangler deploy --config wrangler.preview.toml --dry-run
 npx wrangler deploy --config wrangler.preview.toml
) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Preview"
restore_cfg
trap - EXIT

sleep 4
for url in "https://app.preview.intaprd.com/admin/login" "https://app.preview.intaprd.com/superadmin/sponsors"; do
 code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
 echo "✓ $url -> HTTP $code"
 [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

rm -rf "$LOG_DIR"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Runner dejó cambios locales"; }

cat <<EOF
============================================================
✓ LISTADO PAGINADO DE CÓDIGOS DESPLEGADO EN PREVIEW
============================================================
Feature SHA: $(git rev-parse HEAD)
App origin:  $APP_ORIGIN
QA: https://app.preview.intaprd.com/superadmin/sponsors
Producción NO tocada
============================================================
EOF
