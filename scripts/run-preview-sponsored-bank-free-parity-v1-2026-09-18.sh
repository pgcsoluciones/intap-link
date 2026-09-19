#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/sponsored-bank-free-parity-v1"
EXPECTED_MAIN_SHA="3b175f2b84c60ea605d53ed65f29813a5c1ce5e1"
APPROVED_PRODUCT_SHA="56ff0c2473e13f7266d5ee525b0f8a01d5d7a01f"
WEB_PROJECT="intap-link"
APP_PROJECT="intap-web2"
PREVIEW_DB="intap_db_preview"
LOG_DIR="$ROOT/.preview-sponsored-bank-free-parity-v1-logs"
WEB_LOG="$LOG_DIR/web-pages.log"
APP_LOG="$LOG_DIR/app-pages.log"
WORKER_LOG="$LOG_DIR/worker-preview.log"
MIGRATION_LOG="$LOG_DIR/migrations.log"
PREVIEW_CFG="$ROOT/api/wrangler.preview.toml"
PREVIEW_CFG_BAK="$LOG_DIR/wrangler.preview.toml.bak"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR"
mkdir -p "$LOG_DIR"

cat <<EOF
============================================================
KAWVO LINK · PARIDAD BANCARIA FREE → PATROCINADO · PREVIEW
============================================================
- Cédula/RNC protegida
- número de cuenta Oculto/Visible
- logos bancarios en perfil público
- Mostrar en mi perfil sin borrar cuentas
- compartir por WhatsApp / copiar enlace
- conserva almacenamiento patrocinado aislado
- aplica 0070 SOLO en D1 Preview
- Producción NO se toca
============================================================
Main esperado:     $EXPECTED_MAIN_SHA
Producto aprobado: $APPROVED_PRODUCT_SHA
============================================================
EOF

run git fetch github main "$BRANCH"
[ "$(git rev-parse github/main)" = "$EXPECTED_MAIN_SHA" ] || fail "main cambió; detener y auditar"
run git switch "$BRANCH"
run git pull --ff-only github "$BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Árbol local no limpio"; }
git merge-base --is-ancestor "$APPROVED_PRODUCT_SHA" HEAD || fail "Producto aprobado ya no es ancestro"
POST_FILES="$(git diff --name-only "$APPROVED_PRODUCT_SHA"..HEAD | grep -Ev '^scripts/run-(preview|production)-sponsored-bank-free-parity-v1-2026-09-18\.sh$' || true)"
[ -z "$POST_FILES" ] || { echo "$POST_FILES"; fail "Hay cambios posteriores al producto aprobado"; }
git merge-base --is-ancestor github/main HEAD || fail "main y feature divergieron"

ALLOWED='^(api/migrations(-preview)?/0070_sponsored_bank_free_parity\.sql|api/src/sponsored-bank-accounts\.ts|app/src/components/admin/sponsored/SponsoredBankAccounts\.tsx|web/src/components/sponsored/SponsoredBankAccounts\.tsx|scripts/test-sponsored-profile-contract\.mjs|scripts/run-(preview|production)-sponsored-bank-free-parity-v1-2026-09-18\.sh)$'
UNEXPECTED="$(git diff --name-only github/main...HEAD | grep -Ev "$ALLOWED" || true)"
[ -z "$UNEXPECTED" ] || { echo "$UNEXPECTED"; fail "Hay archivos fuera del alcance"; }

run git diff --check github/main...HEAD
run npm ci
run node scripts/test-sponsored-profile-contract.mjs
run npm run build:preview -w web
run npm run build:preview -w app
run bash -lc "cd api && npx tsc --noEmit"
run bash -lc "npx esbuild api/src/preview-free-entry.ts --bundle --platform=node --format=esm --target=node20 --external:cloudflare:* --outfile=/tmp/sponsored-bank-free-parity-preview.mjs"
run bash -lc "cd api && npx wrangler deploy --config wrangler.preview.toml --dry-run"

echo
echo "▶ Preflight D1 Preview"
(
 cd api
 npx wrangler d1 migrations list "$PREVIEW_DB" --remote --config wrangler.preview.toml
) 2>&1 | tee "$MIGRATION_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "No se pudieron listar migraciones Preview"
PENDING_SQL="$(grep -Eo '[0-9]{4}_[A-Za-z0-9._-]+\.sql' "$MIGRATION_LOG" | sort -u || true)"
[ "$PENDING_SQL" = "0070_sponsored_bank_free_parity.sql" ] || { echo "Pendientes: ${PENDING_SQL:-ninguna/no reconocida}"; fail "0070 debe ser la única migración pendiente en Preview"; }

echo
echo "▶ Aplicar 0070 SOLO D1 Preview"
(
 cd api
 npx wrangler d1 migrations apply "$PREVIEW_DB" --remote --config wrangler.preview.toml
) || fail "Migración D1 Preview"

echo
echo "▶ Deploy Web Pages Preview"
(npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch "$BRANCH") 2>&1 | tee "$WEB_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Web Preview"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$WEB_LOG" | tail -1)"
[ -n "$WEB_ORIGIN" ] || fail "No pude detectar Web origin"

echo
echo "▶ Deploy App Pages Preview"
(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch "$BRANCH") 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App Preview"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$APP_LOG" | tail -1)"
[ -n "$APP_ORIGIN" ] || fail "No pude detectar App origin"

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
if n1 != 1 or n2 != 1: raise SystemExit("No pude actualizar origins Preview")
p.write_text(s)
PY

echo
echo "▶ Deploy Worker Preview"
(
 cd api
 npx wrangler deploy --config wrangler.preview.toml --dry-run
 npx wrangler deploy --config wrangler.preview.toml
) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Preview"
restore_cfg
trap - EXIT

sleep 5
for url in "https://preview.intaprd.com/" "https://app.preview.intaprd.com/admin/login" "https://app.preview.intaprd.com/admin/sponsored"; do
 code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
 echo "✓ $url -> HTTP $code"
 [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

rm -rf "$LOG_DIR"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Runner dejó cambios locales"; }

cat <<EOF
============================================================
✓ PARIDAD BANCARIA PATROCINADA DESPLEGADA EN PREVIEW
============================================================
Feature SHA: $(git rev-parse HEAD)
Web origin:  $WEB_ORIGIN
App origin:  $APP_ORIGIN
D1 Preview:  0070 aplicada
Producción:  NO TOCADA
============================================================
EOF
