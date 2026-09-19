#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="release/sponsored-pending-bundle-v1"
EXPECTED_MAIN_SHA="443e544e899c0f827f69a78f9613cf3dfc99f602"
APPROVED_PRODUCT_SHA="6efe341474523e4d85bf9ff6e78ea89f357925b2"
WEB_PROJECT="intap-link"
APP_PROJECT="intap-web2"
PREVIEW_DB="intap_db_preview"
PROD_DB="intap_db"
LOG_DIR="$ROOT/.release-sponsored-pending-bundle-v1"
PREVIEW_CFG="$ROOT/api/wrangler.preview.toml"
PREVIEW_CFG_BAK="$LOG_DIR/wrangler.preview.toml.bak"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
bash -n "$0" || fail "Sintaxis del runner"
rm -rf "$LOG_DIR"
mkdir -p "$LOG_DIR"

cat <<EOF
============================================================
KAWVO LINK · PENDIENTES PATROCINADO · PREVIEW → PRODUCCIÓN
============================================================
YA PRESENTE EN MAIN:
- Cerrar sesión del usuario patrocinado

ESTE RELEASE AGREGA:
- Paridad bancaria con Free
  · Cédula/RNC
  · logos bancarios
  · número de cuenta oculto/visible
  · ocultar sección sin borrar cuentas
  · copiar datos / compartir
- Normalización de WhatsApp y teléfono
  · números RD 809/829/849 -> +1
  · backend + perfil público
- Migración 0070 aislada del módulo Free/Plus/Team

El runner:
1) valida todo
2) despliega y prueba Preview
3) si Preview pasa, continúa a Producción
4) promueve exactamente el mismo código a main
============================================================
Main esperado:     $EXPECTED_MAIN_SHA
Producto aprobado: $APPROVED_PRODUCT_SHA
============================================================
EOF

run git fetch github main "$BRANCH"
CURRENT_MAIN="$(git rev-parse github/main)"
[ "$CURRENT_MAIN" = "$EXPECTED_MAIN_SHA" ] || fail "main cambió: esperado $EXPECTED_MAIN_SHA, actual $CURRENT_MAIN"

run git switch "$BRANCH"
run git pull --ff-only github "$BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Árbol local no limpio"; }

git merge-base --is-ancestor "$APPROVED_PRODUCT_SHA" HEAD || fail "Producto aprobado ya no es ancestro"
POST_FILES="$(git diff --name-only "$APPROVED_PRODUCT_SHA"..HEAD | grep -Ev '^scripts/run-release-sponsored-pending-bundle-v1-2026-09-19\.sh$' || true)"
[ -z "$POST_FILES" ] || { echo "$POST_FILES"; fail "Hay cambios de producto posteriores al SHA aprobado"; }

git merge-base --is-ancestor github/main HEAD || fail "main y release divergieron"

ALLOWED='^(api/migrations(-preview)?/0070_sponsored_bank_free_parity\.sql|api/src/(sponsored-bank-accounts|sponsored-profiles)\.ts|app/src/components/admin/sponsored/SponsoredBankAccounts\.tsx|web/src/components/sponsored/(SponsoredBankAccounts|SponsoredProfile)\.tsx|scripts/test-sponsored-profile-contract\.mjs|scripts/run-release-sponsored-pending-bundle-v1-2026-09-19\.sh)$'
UNEXPECTED="$(git diff --name-only github/main...HEAD | grep -Ev "$ALLOWED" || true)"
[ -z "$UNEXPECTED" ] || { echo "$UNEXPECTED"; fail "Hay archivos fuera del alcance"; }

run git diff --check github/main...HEAD
run npm ci
run node scripts/test-sponsored-profile-contract.mjs
run npm run build:preview -w web
run npm run build:preview -w app
run bash -lc "cd api && npx tsc --noEmit"
run bash -lc "npx esbuild api/src/preview-free-entry.ts --bundle --platform=node --format=esm --target=node20 --external:cloudflare:* --outfile=/tmp/kawvo-sponsored-pending-preview.mjs"
run bash -lc "cd api && npx wrangler deploy --config wrangler.preview.toml --dry-run"

echo
echo "▶ Preflight D1 Preview"
(
  cd api
  npx wrangler d1 migrations list "$PREVIEW_DB" --remote --config wrangler.preview.toml
) 2>&1 | tee "$LOG_DIR/preview-migrations.log"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "No se pudieron listar migraciones Preview"
PENDING_PREVIEW="$(grep -Eo '[0-9]{4}_[A-Za-z0-9._-]+\.sql' "$LOG_DIR/preview-migrations.log" | sort -u || true)"
[ "$PENDING_PREVIEW" = "0070_sponsored_bank_free_parity.sql" ] || { echo "Pendientes Preview: ${PENDING_PREVIEW:-ninguna/no reconocida}"; fail "0070 debe ser la única migración pendiente en Preview"; }

echo
echo "▶ Aplicar 0070 en D1 Preview"
(
  cd api
  npx wrangler d1 migrations apply "$PREVIEW_DB" --remote --config wrangler.preview.toml
) || fail "Migración 0070 Preview"

echo
echo "▶ Deploy Web Preview"
(npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch "$BRANCH") 2>&1 | tee "$LOG_DIR/web-preview.log"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Web Preview"
WEB_PREVIEW_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$LOG_DIR/web-preview.log" | tail -1)"
[ -n "$WEB_PREVIEW_ORIGIN" ] || fail "No pude detectar Web Preview origin"

echo
echo "▶ Deploy App Preview"
(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch "$BRANCH") 2>&1 | tee "$LOG_DIR/app-preview.log"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "App Preview"
APP_PREVIEW_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$LOG_DIR/app-preview.log" | tail -1)"
[ -n "$APP_PREVIEW_ORIGIN" ] || fail "No pude detectar App Preview origin"

cp "$PREVIEW_CFG" "$PREVIEW_CFG_BAK"
restore_preview_cfg(){ cp "$PREVIEW_CFG_BAK" "$PREVIEW_CFG" 2>/dev/null || true; }
trap restore_preview_cfg EXIT

python3 - "$PREVIEW_CFG" "$WEB_PREVIEW_ORIGIN" "$APP_PREVIEW_ORIGIN" <<'PY'
from pathlib import Path
import re,sys
p=Path(sys.argv[1]); web=sys.argv[2]; app=sys.argv[3]
s=p.read_text()
s,n1=re.subn(r'WEB_PAGES_ORIGIN\s*=\s*"[^"]+"',f'WEB_PAGES_ORIGIN = "{web}"',s,count=1)
s,n2=re.subn(r'APP_PAGES_ORIGIN\s*=\s*"[^"]+"',f'APP_PAGES_ORIGIN = "{app}"',s,count=1)
if n1 != 1 or n2 != 1:
    raise SystemExit("No pude actualizar origins Preview")
p.write_text(s)
PY

echo
echo "▶ Deploy Worker Preview"
(
  cd api
  npx wrangler deploy --config wrangler.preview.toml --dry-run
  npx wrangler deploy --config wrangler.preview.toml
) 2>&1 | tee "$LOG_DIR/worker-preview.log"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Worker Preview"

restore_preview_cfg
trap - EXIT

sleep 5
echo
echo "▶ Smoke Preview"
for url in   "https://preview.intaprd.com/"   "https://app.preview.intaprd.com/admin/login"   "https://app.preview.intaprd.com/admin/sponsored"
do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

echo
echo "✓ Preview aprobado. Continuando automáticamente a Producción."

run npm run build -w web
run npm run build -w app
run bash -lc "cd api && npx tsc --noEmit"
run bash -lc "npx esbuild api/src/preview-free-entry.ts --bundle --platform=node --format=esm --target=node20 --external:cloudflare:* --outfile=/tmp/kawvo-sponsored-pending-production.mjs"
run bash -lc "cd api && npx wrangler deploy --config wrangler.toml --dry-run"

echo
echo "▶ Preflight D1 Producción"
(
  cd api
  npx wrangler d1 migrations list "$PROD_DB" --remote --config wrangler.toml
) 2>&1 | tee "$LOG_DIR/prod-migrations.log"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "No se pudieron listar migraciones Producción"
PENDING_PROD="$(grep -Eo '[0-9]{4}_[A-Za-z0-9._-]+\.sql' "$LOG_DIR/prod-migrations.log" | sort -u || true)"
[ "$PENDING_PROD" = "0070_sponsored_bank_free_parity.sql" ] || { echo "Pendientes Producción: ${PENDING_PROD:-ninguna/no reconocida}"; fail "0070 debe ser la única migración pendiente en Producción"; }

echo
echo "▶ Aplicar 0070 en D1 Producción"
(
  cd api
  npx wrangler d1 migrations apply "$PROD_DB" --remote --config wrangler.toml
) || fail "Migración 0070 Producción"

echo
echo "▶ Verificar columnas bancarias en Producción"
SCHEMA_CHECK="$(cd api && npx wrangler d1 execute "$PROD_DB" --remote --config wrangler.toml --command "SELECT name FROM pragma_table_info('sponsored_bank_accounts') WHERE name IN ('bank_code','holder_id_type','holder_id_number','display_mode') ORDER BY name;" 2>/dev/null || true)"
for col in bank_code display_mode holder_id_number holder_id_type; do
  echo "$SCHEMA_CHECK" | grep -F "$col" >/dev/null || fail "Falta columna $col después de 0070"
done
echo "✓ Esquema bancario patrocinado verificado"

echo
echo "▶ Deploy Worker Producción"
(
  cd api
  npm run deploy:production
) 2>&1 | tee "$LOG_DIR/worker-production.log"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Worker Producción"
WORKER_VERSION="$(grep -E 'Current Version ID:' "$LOG_DIR/worker-production.log" | tail -1 | sed -E 's/.*Current Version ID:[[:space:]]*//' || true)"

echo
echo "▶ Deploy Web Producción"
(npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch main) 2>&1 | tee "$LOG_DIR/web-production.log"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Web Producción"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$LOG_DIR/web-production.log" | tail -1 || true)"

echo
echo "▶ Deploy App Producción"
(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch main) 2>&1 | tee "$LOG_DIR/app-production.log"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "App Producción"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$LOG_DIR/app-production.log" | tail -1 || true)"

sleep 5
echo
echo "▶ Smoke Producción"
for url in   "https://intaprd.com/"   "https://app.intaprd.com/admin/login"   "https://app.intaprd.com/admin/sponsored"
do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

echo
echo "▶ Promover release a main"
run git switch -C main github/main
run git merge --ff-only "github/$BRANCH"
run git push github main
PROD_SHA="$(git rev-parse HEAD)"
run git fetch github main
[ "$(git rev-parse github/main)" = "$PROD_SHA" ] || fail "main remoto no coincide con el SHA desplegado"

TAG="prod-sponsored-pending-bundle-v1-2026-09-19-$(date +%H%M%S)"
run git tag -a "$TAG" -m "Sponsored bank parity and WhatsApp normalization 2026-09-19"
run git push github "$TAG"

rm -rf "$LOG_DIR"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Runner dejó cambios locales"; }

cat <<EOF
============================================================
✓ PENDIENTES PATROCINADO DESPLEGADOS EN PRODUCCIÓN
============================================================
Production SHA: $PROD_SHA
Release tag:    $TAG
Worker Version: ${WORKER_VERSION:-ver salida Wrangler}
Web Pages:      ${WEB_ORIGIN:-ver salida Pages}
App Pages:      ${APP_ORIGIN:-ver salida Pages}

Incluye:
✓ Cerrar sesión patrocinado (ya estaba en main)
✓ Paridad bancaria Free → patrocinado
✓ Normalización WhatsApp/teléfono
✓ D1 0070 aplicada
============================================================
EOF
