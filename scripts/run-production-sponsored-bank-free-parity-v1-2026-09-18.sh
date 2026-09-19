#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/sponsored-bank-free-parity-v1"
EXPECTED_MAIN_SHA="3b175f2b84c60ea605d53ed65f29813a5c1ce5e1"
APPROVED_PRODUCT_SHA="56ff0c2473e13f7266d5ee525b0f8a01d5d7a01f"
WEB_PROJECT="intap-link"
APP_PROJECT="intap-web2"
PROD_DB="intap_db"
LOG_DIR="$ROOT/.production-sponsored-bank-free-parity-v1-logs"
WEB_LOG="$LOG_DIR/web-pages.log"
APP_LOG="$LOG_DIR/app-pages.log"
WORKER_LOG="$LOG_DIR/worker.log"
MIGRATION_LOG="$LOG_DIR/migrations.log"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR"
mkdir -p "$LOG_DIR"

cat <<EOF
============================================================
KAWVO LINK · PARIDAD BANCARIA FREE → PATROCINADO · PRODUCCIÓN
============================================================
- Cédula/RNC protegida
- número de cuenta Oculto/Visible
- logos bancarios en perfil público
- Mostrar en mi perfil sin borrar cuentas
- compartir por WhatsApp / copiar enlace
- conserva almacenamiento patrocinado aislado
- aplica 0070 solo si es la única pendiente
- despliega API + Web + App
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
run npm run build -w web
run npm run build -w app
run bash -lc "cd api && npx tsc --noEmit"
run bash -lc "npx esbuild api/src/preview-free-entry.ts --bundle --platform=node --format=esm --target=node20 --external:cloudflare:* --outfile=/tmp/sponsored-bank-free-parity-production.mjs"
run bash -lc "cd api && npx wrangler deploy --config wrangler.toml --dry-run"

echo
echo "▶ Preflight D1 Producción"
(
 cd api
 npx wrangler d1 migrations list "$PROD_DB" --remote --config wrangler.toml
) 2>&1 | tee "$MIGRATION_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "No se pudieron listar migraciones Producción"
PENDING_SQL="$(grep -Eo '[0-9]{4}_[A-Za-z0-9._-]+\.sql' "$MIGRATION_LOG" | sort -u || true)"
[ "$PENDING_SQL" = "0070_sponsored_bank_free_parity.sql" ] || { echo "Pendientes: ${PENDING_SQL:-ninguna/no reconocida}"; fail "0070 debe ser la única migración pendiente"; }

echo
echo "▶ Aplicar 0070 D1 Producción"
(
 cd api
 npx wrangler d1 migrations apply "$PROD_DB" --remote --config wrangler.toml
) || fail "Migración D1 Producción"

echo
echo "▶ Verificar esquema patrocinado"
SCHEMA="$(cd api && npx wrangler d1 execute "$PROD_DB" --remote --config wrangler.toml --command "SELECT name,sql FROM sqlite_master WHERE name IN ('sponsored_bank_accounts','sponsored_bank_settings');" 2>/dev/null || true)"
echo "$SCHEMA" | grep -F "sponsored_bank_settings" >/dev/null || fail "Falta sponsored_bank_settings"
echo "$SCHEMA" | grep -F "holder_id_number" >/dev/null || fail "Falta holder_id_number"
echo "$SCHEMA" | grep -F "display_mode" >/dev/null || fail "Falta display_mode"
echo "✓ Esquema bancario patrocinado verificado"

echo
echo "▶ Deploy Worker Producción"
(
 cd api
 npm run deploy:production
) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Producción"
WORKER_VERSION="$(grep -E 'Current Version ID:' "$WORKER_LOG" | tail -1 | sed -E 's/.*Current Version ID:[[:space:]]*//' || true)"

echo
echo "▶ Deploy Web Producción"
(npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch main) 2>&1 | tee "$WEB_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Web Producción"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$WEB_LOG" | tail -1 || true)"

echo
echo "▶ Deploy App Producción"
(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch main) 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App Producción"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$APP_LOG" | tail -1 || true)"

sleep 5
for url in "https://intaprd.com/" "https://app.intaprd.com/admin/login" "https://app.intaprd.com/admin/sponsored"; do
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
[ "$(git rev-parse github/main)" = "$PROD_SHA" ] || fail "main remoto no coincide con lo desplegado"

TAG="prod-sponsored-bank-free-parity-v1-2026-09-18-$(date +%H%M%S)"
run git tag -a "$TAG" -m "Sponsored bank Free parity V1 production 2026-09-18"
run git push github "$TAG"

rm -rf "$LOG_DIR"

cat <<EOF
============================================================
✓ PARIDAD BANCARIA PATROCINADA DESPLEGADA EN PRODUCCIÓN
============================================================
Production SHA: $PROD_SHA
Release tag:    $TAG
Worker Version: ${WORKER_VERSION:-ver salida Wrangler}
Web Pages:      ${WEB_ORIGIN:-ver salida Pages}
App Pages:      ${APP_ORIGIN:-ver salida Pages}
D1:             0070 aplicada y verificada
============================================================
EOF
