#!/usr/bin/env bash
set -euo pipefail

ROOT="${HOME}/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawmed-medical-profile-v1"
WEB_PROJECT="intap-link"
PREVIEW_DB="intap_db_preview"
LOG_DIR="$ROOT/.preview-kawmed-v1-logs"
WEB_LOG="$LOG_DIR/web-pages.log"
WORKER_LOG="$LOG_DIR/worker-preview.log"
PREVIEW_CFG="$ROOT/api/wrangler.preview.toml"
PREVIEW_CFG_BAK="$LOG_DIR/wrangler.preview.toml.bak"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" && mkdir -p "$LOG_DIR"

cat <<'EOF'
============================================================
KAWMED · PERFIL MÉDICO V1 · PREVIEW
============================================================
- NO toca Producción
- NO hace merge a main
- aplica migración SOLO a intap_db_preview
- despliega Web y Worker SOLO en Preview
- ruta de QA: /m/lauramendez
============================================================
EOF

git remote get-url github >/dev/null 2>&1 && REMOTE=github || REMOTE=origin
run git fetch "$REMOTE" "$BRANCH" main
run git checkout "$BRANCH"
run git pull --ff-only "$REMOTE" "$BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "El árbol de trabajo no está limpio"; }

run git diff --check main...HEAD
run npm ci
run npm run build:preview -w web
run bash -lc 'cd api && npx tsc --noEmit'
run bash -lc 'npx esbuild api/src/preview-free-entry.ts --bundle --platform=node --format=esm --target=node20 --external:cloudflare:* --outfile=/tmp/kawmed-preview-api.mjs'
run bash -lc 'npx esbuild api/src/preview-frontdoor-entry.ts --bundle --platform=node --format=esm --target=node20 --external:cloudflare:* --outfile=/tmp/kawmed-preview-frontdoor.mjs'

echo; echo "▶ Aplicar migraciones SOLO en D1 Preview"
(cd api && npx wrangler d1 migrations apply "$PREVIEW_DB" --remote --config wrangler.preview.toml) || fail "Migraciones D1 Preview"

echo; echo "▶ Deploy Web Pages Preview"
(npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch "$BRANCH") 2>&1 | tee "$WEB_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Web Preview"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$WEB_LOG" | tail -1)"
[ -n "$WEB_ORIGIN" ] || fail "No pude detectar origin inmutable de Web Pages"

cp "$PREVIEW_CFG" "$PREVIEW_CFG_BAK"
restore_cfg(){ cp "$PREVIEW_CFG_BAK" "$PREVIEW_CFG" 2>/dev/null || true; }
trap restore_cfg EXIT

python3 - "$PREVIEW_CFG" "$WEB_ORIGIN" <<'PY'
from pathlib import Path
import re,sys
p=Path(sys.argv[1]); web=sys.argv[2]
s=p.read_text()
s,n=re.subn(r'WEB_PAGES_ORIGIN\s*=\s*"[^"]+"',f'WEB_PAGES_ORIGIN = "{web}"',s,count=1)
if n != 1: raise SystemExit('No pude actualizar WEB_PAGES_ORIGIN de Preview')
p.write_text(s)
PY

echo; echo "▶ Deploy Worker Preview / front door"
(cd api && npx wrangler deploy --config wrangler.preview.toml --dry-run && npx wrangler deploy --config wrangler.preview.toml) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Preview"
restore_cfg
trap - EXIT
sleep 4

echo; echo "▶ Smoke API KawMed"
API_JSON="$LOG_DIR/kawmed-api.json"
code="$(curl -sS -o "$API_JSON" -w '%{http_code}' https://preview.intaprd.com/api/v1/public/medical-profiles/lauramendez)"
[ "$code" = "200" ] || { cat "$API_JSON"; fail "API KawMed respondió HTTP $code"; }
grep -q '"ok":true' "$API_JSON" || { cat "$API_JSON"; fail "API KawMed no devolvió ok"; }
grep -q '"slug":"lauramendez"' "$API_JSON" || { cat "$API_JSON"; fail "El demo lauramendez no está disponible"; }

echo; echo "▶ Smoke Web KawMed"
code="$(curl -sS -L -o "$LOG_DIR/kawmed-page.html" -w '%{http_code}' https://preview.intaprd.com/m/lauramendez)"
[ "$code" = "200" ] || fail "Perfil KawMed respondió HTTP $code"

echo; echo "▶ Guardas de aislamiento"
code="$(curl -sS -L -o /dev/null -w '%{http_code}' https://preview.intaprd.com/demo)"
[ "$code" = "200" ] || fail "/demo dejó de responder 200"
code="$(curl -sS -L -o /dev/null -w '%{http_code}' https://preview.intaprd.com/trial)"
[ "$code" = "200" ] || fail "/trial dejó de responder 200"

rm -rf "$LOG_DIR"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "El runner dejó cambios locales"; }

cat <<EOF
============================================================
✓ KAWMED V1 DESPLEGADO EN PREVIEW
============================================================
Feature SHA: $(git rev-parse HEAD)
Perfil demo:
https://preview.intaprd.com/m/lauramendez

API:
https://preview.intaprd.com/api/v1/public/medical-profiles/lauramendez

Producción NO tocada.
============================================================
EOF
