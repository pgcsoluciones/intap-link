#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawlink-trial-72h"
WEB_PROJECT="intap-link"
APP_PROJECT="intap-web2"
PREVIEW_DB="intap_db_preview"
LOG_DIR="$ROOT/.preview-kawlink-trial-72h-logs"
WEB_LOG="$LOG_DIR/web-pages.log"
APP_LOG="$LOG_DIR/app-pages.log"
WORKER_LOG="$LOG_DIR/worker-preview.log"
PREVIEW_CFG="$ROOT/api/wrangler.preview.toml"
PREVIEW_CFG_BAK="$LOG_DIR/wrangler.preview.toml.bak"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" && mkdir -p "$LOG_DIR"

cat <<'EOF'
============================================================
KAWVO LINK · TRIAL 72H · PREVIEW
============================================================
- NO toca Producción
- NO hace merge a main
- namespace nuevo /trial
- NO modifica /demo, Free, Sponsored ni Team
- aplica migraciones SOLO en D1 Preview
- compila Web/App/API antes de desplegar
- valida contrato Trial y aislamiento
============================================================
EOF

run git fetch github "$BRANCH" main
run git checkout "$BRANCH"
run git pull --ff-only github "$BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "El árbol de trabajo no está limpio"; }

run git diff --check main...HEAD
run npm ci
run node scripts/test-trial-contract.mjs
run npm run build:preview -w web
run npm run build:preview -w app
run bash -lc 'cd api && npx tsc --noEmit'
run bash -lc 'npx esbuild api/src/preview-free-entry.ts --bundle --platform=node --format=esm --target=node20 --external:cloudflare:* --outfile=/tmp/kawvo-trial-preview-api.mjs'
run bash -lc 'npx esbuild api/src/preview-frontdoor-entry.ts --bundle --platform=node --format=esm --target=node20 --external:cloudflare:* --outfile=/tmp/kawvo-trial-preview-frontdoor.mjs'

echo; echo "▶ Aplicar migraciones SOLO en D1 Preview"
(cd api && npx wrangler d1 migrations apply "$PREVIEW_DB" --remote --config wrangler.preview.toml) || fail "Migraciones D1 Preview"

echo; echo "▶ Deploy Web Pages Preview"
(npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch "$BRANCH") 2>&1 | tee "$WEB_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Web Preview"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.(intap-link)\.pages\.dev' "$WEB_LOG" | tail -1)"
[ -n "$WEB_ORIGIN" ] || fail "No pude detectar origin inmutable de Web Pages"

echo; echo "▶ Deploy App Pages Preview"
(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch "$BRANCH") 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App Preview"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$APP_LOG" | tail -1)"
[ -n "$APP_ORIGIN" ] || fail "No pude detectar origin inmutable de App Pages"

cp "$PREVIEW_CFG" "$PREVIEW_CFG_BAK"
restore_cfg(){ cp "$PREVIEW_CFG_BAK" "$PREVIEW_CFG" 2>/dev/null || true; }
trap restore_cfg EXIT
python3 - "$PREVIEW_CFG" "$WEB_ORIGIN" "$APP_ORIGIN" <<'PY'
from pathlib import Path
import re,sys
p=Path(sys.argv[1]); web=sys.argv[2]; app=sys.argv[3]
s=p.read_text()
s,n1=re.subn(r'WEB_PAGES_ORIGIN\s*=\s*"[^"]+"',f'WEB_PAGES_ORIGIN = "{web}"',s,count=1)
s,n2=re.subn(r'APP_PAGES_ORIGIN\s*=\s*"[^"]+"',f'APP_PAGES_ORIGIN = "{app}"',s,count=1)
if n1 != 1 or n2 != 1: raise SystemExit('No pude actualizar origins de Preview')
p.write_text(s)
PY

(cd api && npx wrangler deploy --config wrangler.preview.toml --dry-run && npx wrangler deploy --config wrangler.preview.toml) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Preview"
restore_cfg
trap - EXIT
sleep 4

echo; echo "▶ Smoke HTTP Trial"
for url in "https://preview.intaprd.com/trial" "https://app.preview.intaprd.com/admin/login"; do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

echo; echo "▶ Smoke API pública"
code="$(curl -sS -o "$LOG_DIR/master.json" -w '%{http_code}' https://preview.intaprd.com/api/v1/public/trials/master)"
[ "$code" = "200" ] || fail "Master Trial API respondió HTTP $code"
grep -q '"ok":true' "$LOG_DIR/master.json" || fail "Master Trial API no devolvió ok"

code="$(curl -sS -o "$LOG_DIR/admin.json" -w '%{http_code}' https://preview.intaprd.com/api/v1/superadmin/trials/context)"
[ "$code" = "401" ] || fail "Admin Trial sin sesión debe responder 401, respondió $code"
echo "✓ Seguridad: endpoint Super Admin bloqueado sin sesión"

code="$(curl -sS -o "$LOG_DIR/notfound.json" -w '%{http_code}' https://preview.intaprd.com/api/v1/public/trials/__qa_no_trial__)"
[ "$code" = "404" ] || fail "Trial inexistente debe responder 404, respondió $code"
echo "✓ Trial inexistente: 404 controlado"

# Regression guard: Mauro is the first persisted published Trial used to verify
# that a deploy cannot make an existing slug disappear from the public API.
code="$(curl -sS -o "$LOG_DIR/mauro.json" -w '%{http_code}' https://preview.intaprd.com/api/v1/public/trials/mauro)"
[ "$code" = "200" ] || fail "Regresión: /api/v1/public/trials/mauro respondió HTTP $code"
grep -q '"slug":"mauro"' "$LOG_DIR/mauro.json" || fail "Regresión: Mauro existe en D1 pero no fue resuelto por la API pública"
! grep -q 'API route not found' "$LOG_DIR/mauro.json" || fail "Regresión de routing: Mauro cayó en el catch-all API"
echo "✓ Trial persistente Mauro: slug público resuelto correctamente"

rm -rf "$LOG_DIR"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "El runner dejó cambios locales"; }

cat <<EOF
============================================================
✓ TRIAL 72H DESPLEGADO Y SMOKE-TESTED EN PREVIEW
============================================================
Feature SHA: $(git rev-parse HEAD)
Web origin: $WEB_ORIGIN
App origin: $APP_ORIGIN

QA manual autenticado:
1. Abre https://preview.intaprd.com/trial
2. Inicia sesión como Super Admin si hace falta.
3. Pulsa + Crear Trial.
4. Edita texto e imágenes; recarga y confirma autosave.
5. Finaliza con un slug nuevo.
6. Verifica URL /trial/<slug>, QR, copiar y compartir.
7. En incógnito confirma que NO aparecen controles administrativos.

Producción NO tocada.
============================================================
EOF
