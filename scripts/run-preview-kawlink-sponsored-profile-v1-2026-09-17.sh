#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawlink-sponsored-profile-v1"
WEB_PROJECT="intap-link"
APP_PROJECT="intap-web2"
PREVIEW_DB="intap_db_preview"
LOG_DIR="$ROOT/.preview-kawlink-sponsored-profile-v1-logs"
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
KAWVO LINK · PERFIL PATROCINADO V1 · PREVIEW
============================================================
- NO toca Producción
- NO hace merge a main
- aplica migraciones SOLO en D1 Preview
- valida contrato funcional patrocinado
- compila Web/App/API antes de desplegar
- despliega Web + App a Pages Preview
- apunta temporalmente el Worker Preview a origins inmutables
- restaura wrangler.preview.toml al terminar
============================================================
EOF

run git fetch github "$BRANCH" main
run git checkout "$BRANCH"
run git pull --ff-only github "$BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "El árbol de trabajo no está limpio"; }

run git diff --check main...HEAD
run npm ci
run node scripts/test-sponsored-profile-contract.mjs
run npm run build:preview -w web
run npm run build:preview -w app
run bash -lc 'cd api && npx tsc --noEmit'
run bash -lc 'npx esbuild api/src/preview-free-entry.ts --bundle --platform=node --format=esm --target=node20 --external:cloudflare:* --outfile=/tmp/kawvo-sponsored-preview-api.mjs'

echo; echo "▶ Aplicar migraciones SOLO en D1 Preview"
(
  cd api
  npx wrangler d1 migrations apply "$PREVIEW_DB" --remote --config wrangler.preview.toml
) || fail "Migraciones D1 Preview"

echo; echo "▶ Deploy Web Pages Preview"
(npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch "$BRANCH") 2>&1 | tee "$WEB_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Web Preview"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.(intap-link)\.pages\.dev' "$WEB_LOG" | tail -1)"
[ -n "$WEB_ORIGIN" ] || fail "No pude detectar origin inmutable de Web Pages"
echo "✓ Web Pages Preview: $WEB_ORIGIN"

echo; echo "▶ Deploy App Pages Preview"
(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch "$BRANCH") 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App Preview"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$APP_LOG" | tail -1)"
[ -n "$APP_ORIGIN" ] || fail "No pude detectar origin inmutable de App Pages"
echo "✓ App Pages Preview: $APP_ORIGIN"

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
if n1 != 1 or n2 != 1:
    raise SystemExit('No pude actualizar origins de Preview')
p.write_text(s)
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
  "https://preview.intaprd.com/" \
  "https://app.preview.intaprd.com/admin/login" \
  "https://app.preview.intaprd.com/superadmin/sponsors"
do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

echo; echo "▶ Smoke API patrocinado"
code="$(curl -sS -o "$LOG_DIR/sponsor-api-smoke.json" -w '%{http_code}' https://app.preview.intaprd.com/api/v1/public/sponsored/__qa_no_profile__)"
echo "✓ sponsored public endpoint inexistente -> HTTP $code"
[ "$code" = "404" ] || fail "Endpoint patrocinado no respondió 404 controlado"

# The runner creates LOG_DIR itself; remove it before asserting a clean tree.
rm -rf "$LOG_DIR"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "El runner dejó cambios locales"; }

cat <<EOF
============================================================
✓ PERFIL PATROCINADO V1 DESPLEGADO EN PREVIEW
============================================================
Feature SHA: $(git rev-parse HEAD)
Web origin: $WEB_ORIGIN
App origin: $APP_ORIGIN

Entradas de QA:
- Super Admin: https://app.preview.intaprd.com/superadmin/sponsors
- Panel beneficiario: https://app.preview.intaprd.com/admin/sponsored
- Panel patrocinador: https://app.preview.intaprd.com/admin/sponsor
- Perfil público: https://preview.intaprd.com/p/<usuario>
- Escaneo: https://preview.intaprd.com/l/<codigo>

Producción NO tocada
============================================================
EOF
