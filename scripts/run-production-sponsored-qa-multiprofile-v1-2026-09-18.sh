#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/sponsored-qa-multiprofile-v1"
EXPECTED_MAIN_SHA="aa4805f3ee1030e41812346c5f6fbba61fbeb2d5"
APPROVED_PRODUCT_SHA="1dd1519db68319fe36c587aa8de94667f6a85deb"
RUNNER_PATH="scripts/run-production-sponsored-qa-multiprofile-v1-2026-09-18.sh"
APP_PROJECT="intap-web2"
PROD_DB="intap_db"
LOG_DIR="$ROOT/.production-sponsored-qa-multiprofile-v1-logs"
APP_LOG="$LOG_DIR/app-pages.log"
WORKER_LOG="$LOG_DIR/worker-production.log"
MIGRATION_LIST_LOG="$LOG_DIR/migrations-list.log"
MIGRATION_APPLY_LOG="$LOG_DIR/migrations-apply.log"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" && mkdir -p "$LOG_DIR"

cat <<EOF
============================================================
KAWVO LINK · CUENTA AUTORIZADA MULTIPERFIL · PRODUCCIÓN
============================================================
- excepción exclusivamente para intapcard@gmail.com
- NO cambia nombre, apariencia ni flujo público de perfiles
- cada código conserva patrocinador, URL, username y configuración
- cuentas normales conservan 1 perfil patrocinado máximo
- aplica migración 0069 únicamente si es la ÚNICA pendiente
- despliega Worker/API + App
- NO despliega Web pública
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
POST_FILES="$(git diff --name-only "$APPROVED_PRODUCT_SHA"..HEAD | grep -Ev "^scripts/run-(preview|production)-sponsored-qa-multiprofile-v1-2026-09-18\.sh$" || true)"
[ -z "$POST_FILES" ] || { echo "$POST_FILES"; fail "Hay cambios posteriores al producto aprobado"; }
git merge-base --is-ancestor github/main HEAD || fail "main y feature divergieron"

ALLOWED='^(api/migrations(-preview)?/0069_sponsored_authorized_multiprofile\.sql|api/src/(account-home-route|sponsored-account-controls|sponsored-consent-claim|sponsored-multiprofile-access|sponsored-profile-scope|sponsored-scan)\.ts|app/src/App\.tsx|app/src/components/admin/sponsored/(SponsoredActivation|SponsoredBankAccounts|SponsoredDashboard|SponsoredExperienceTools|SponsoredProfileSelector|SponsoredResumeGate|SponsoredStarterOnboarding)\.tsx|scripts/test-sponsored-profile-contract\.mjs|scripts/run-preview-sponsored-qa-multiprofile-v1-2026-09-18\.sh|scripts/run-production-sponsored-qa-multiprofile-v1-2026-09-18\.sh)$'
UNEXPECTED="$(git diff --name-only github/main...HEAD | grep -Ev "$ALLOWED" || true)"
[ -z "$UNEXPECTED" ] || { echo "$UNEXPECTED"; fail "Hay archivos fuera del alcance"; }

run git diff --check github/main...HEAD
run npm ci
run node scripts/test-sponsored-profile-contract.mjs
run npm run build -w app
run bash -lc 'cd api && npx tsc --noEmit'
run bash -lc 'cd api && npx wrangler deploy --config wrangler.toml --dry-run'

echo; echo "▶ Preflight de migraciones D1 Producción"
(
 cd api
 npx wrangler d1 migrations list "$PROD_DB" --remote --config wrangler.toml
) 2>&1 | tee "$MIGRATION_LIST_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "No se pudieron listar migraciones de Producción"
PENDING_SQL="$(grep -Eo '[0-9]{4}_[A-Za-z0-9._-]+\.sql' "$MIGRATION_LIST_LOG" | sort -u || true)"
[ "$PENDING_SQL" = "0069_sponsored_authorized_multiprofile.sql" ] || { echo; echo "Migraciones detectadas:"; echo "${PENDING_SQL:-ninguna/no reconocida}"; fail "No aplicaré D1: 0069 debe ser la única migración pendiente"; }
echo "✓ 0069 es la única migración pendiente"

echo; echo "▶ Aplicar SOLO migración pendiente 0069 en D1 Producción"
(
 cd api
 npx wrangler d1 migrations apply "$PROD_DB" --remote --config wrangler.toml
) 2>&1 | tee "$MIGRATION_APPLY_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Migración D1 Producción"

echo; echo "▶ Verificar trigger resultante en D1"
TRIGGER_SQL="$(cd api && npx wrangler d1 execute "$PROD_DB" --remote --config wrangler.toml --command "SELECT sql FROM sqlite_master WHERE type='trigger' AND name='trg_sponsored_profiles_one_beneficiary_per_user';" 2>/dev/null || true)"
echo "$TRIGGER_SQL" | grep -F "intapcard@gmail.com" >/dev/null || fail "El trigger resultante no contiene la excepción autorizada"
echo "$TRIGGER_SQL" | grep -F "profile_role = 'beneficiary'" >/dev/null || fail "El trigger resultante no conserva la regla de beneficiarios"
echo "✓ Trigger D1 verificado"

echo; echo "▶ Deploy Worker Producción"
(
 cd api
 npm run deploy:production
) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Producción"
WORKER_VERSION="$(grep -E 'Current Version ID:' "$WORKER_LOG" | tail -1 | sed -E 's/.*Current Version ID:[[:space:]]*//' || true)"

echo; echo "▶ Deploy App Producción"
(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch main) 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App Producción"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$APP_LOG" | tail -1 || true)"

sleep 5
echo; echo "▶ Smoke Producción"
for url in \
 "https://app.intaprd.com/admin/login" \
 "https://app.intaprd.com/admin/sponsored/select" \
 "https://app.intaprd.com/admin/sponsored"
do
 code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
 echo "✓ $url -> HTTP $code"
 [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done
code="$(curl -sS -o /dev/null -w '%{http_code}' https://app.intaprd.com/api/v1/me/sponsored-profiles)"
echo "✓ /api/v1/me/sponsored-profiles sin sesión -> HTTP $code"
[ "$code" = "401" ] || fail "Endpoint multiperfil no protegió autenticación"

echo; echo "▶ Promover release a main"
run git switch -C main github/main
run git merge --ff-only "github/$BRANCH"
run git push github main
PROD_SHA="$(git rev-parse HEAD)"
run git fetch github main
[ "$(git rev-parse github/main)" = "$PROD_SHA" ] || fail "main remoto no coincide con lo desplegado"

TAG="prod-sponsored-qa-multiprofile-v1-2026-09-18-$(date +%H%M%S)"
run git tag -a "$TAG" -m "Sponsored authorized multiprofile V1 production 2026-09-18"
run git push github "$TAG"

rm -rf "$LOG_DIR"

cat <<EOF
============================================================
✓ MULTIPERFIL AUTORIZADO DESPLEGADO EN PRODUCCIÓN
============================================================
Production SHA: $PROD_SHA
Release tag:    $TAG
Worker Version: ${WORKER_VERSION:-ver salida Wrangler}
App Pages:      ${APP_ORIGIN:-ver salida Pages}
D1:             0069 aplicada y trigger verificado
Web pública:    NO TOCADA
============================================================
EOF
