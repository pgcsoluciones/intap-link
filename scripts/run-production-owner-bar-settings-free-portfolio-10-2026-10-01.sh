#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
REMOTE="github"
FEATURE_BRANCH="feature/owner-bar-settings-link"
EXPECTED_MAIN_SHA="85877fa021e3dab0dbda9ec40280121652beb68e"
APPROVED_PREVIEW_SHA="7a8ca906daba5d9eb3c4993f95602bb056926511"
RUNNER_PATH="scripts/run-production-owner-bar-settings-free-portfolio-10-2026-10-01.sh"
APP_PROJECT="intap-web2"
WEB_PROJECT="intap-link"
PROD_DB="intap_db"
LOG_DIR="$ROOT/.production-owner-bar-portfolio10-logs"
APP_LOG="$LOG_DIR/app-pages-production.log"
WEB_LOG="$LOG_DIR/web-pages-production.log"
WORKER_LOG="$LOG_DIR/worker-production.log"
MIGRATION_LOG="$LOG_DIR/d1-production-migrations.log"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" "$ROOT/.preview-owner-bar-portfolio10-logs"
rm -f "$ROOT/api/wrangler.preview.toml.owner-bar-portfolio10.bak"
mkdir -p "$LOG_DIR"

cat <<EOF
================================================================
KAWVO LINK · CONFIGURACIÓN + PORTAFOLIO FREE 10 · PRODUCCIÓN
================================================================
Promueve únicamente el Preview aprobado:
- Mi presentación -> Configuración
- Free Configuración -> /admin/free/account
- Patrocinado Configuración -> /admin/sponsored
- Portafolio Free: 10 imágenes
- altas/reemplazos con optimización WebP
- D1 Free max_photos = 10

Main esperado:    $EXPECTED_MAIN_SHA
Preview aprobado: $APPROVED_PREVIEW_SHA
================================================================
EOF

run git fetch "$REMOTE" main "$FEATURE_BRANCH"
CURRENT_MAIN="$(git rev-parse "$REMOTE/main")"
[ "$CURRENT_MAIN" = "$EXPECTED_MAIN_SHA" ] || fail "main cambió: esperado $EXPECTED_MAIN_SHA, actual $CURRENT_MAIN. Detener y auditar."

run git switch "$FEATURE_BRANCH"
run git pull --ff-only "$REMOTE" "$FEATURE_BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Árbol local no limpio"; }

FEATURE_SHA="$(git rev-parse HEAD)"
echo "Feature release: $FEATURE_SHA"

git merge-base --is-ancestor "$APPROVED_PREVIEW_SHA" HEAD || fail "El SHA aprobado ya no es ancestro"
POST_APPROVAL="$(git diff --name-only "$APPROVED_PREVIEW_SHA"..HEAD | grep -v "^${RUNNER_PATH}$" || true)"
[ -z "$POST_APPROVAL" ] || { echo "$POST_APPROVAL"; fail "Hay cambios de producto posteriores al Preview aprobado"; }

git merge-base --is-ancestor "$REMOTE/main" HEAD || fail "main y feature divergieron"
[ "$(git rev-list --count HEAD.."$REMOTE/main")" = "0" ] || fail "La feature está detrás de main"

cat > "$LOG_DIR/expected-files.txt" <<'EOF_FILES'
api/migrations-preview/0084_free_portfolio_limit_10.sql
api/migrations/0084_free_portfolio_limit_10.sql
api/src/ai-profile-assistant.ts
app/src/components/admin/free/FreeDashboard.tsx
app/src/components/admin/free/FreePortfolio.tsx
scripts/run-preview-owner-bar-settings-free-portfolio-10-2026-10-01.sh
scripts/run-production-owner-bar-settings-free-portfolio-10-2026-10-01.sh
scripts/test-ai-profile-canonical-limits.mjs
scripts/test-free-contact-agenda-contract.mjs
scripts/test-sponsored-profile-contract.mjs
web/src/components/appointments/AppointmentOwnerBar.tsx
web/src/components/free-profile/IntapLinkGratis.types.ts
web/src/components/free-profile/IntapLinkGratisProfile.tsx
web/src/components/sponsored/SponsoredProfile.tsx
EOF_FILES

git diff --name-only "$REMOTE/main"...HEAD | sort > "$LOG_DIR/actual-files.txt"
sort "$LOG_DIR/expected-files.txt" > "$LOG_DIR/expected-files.sorted.txt"
diff -u "$LOG_DIR/expected-files.sorted.txt" "$LOG_DIR/actual-files.txt" || fail "El alcance no coincide exactamente con el Preview aprobado"

run git diff --check "$REMOTE/main"...HEAD

echo; echo "▶ Verificar configuración de Producción"
grep -Fq 'name = "intap-api"' api/wrangler.toml || fail "Worker incorrecto"
grep -Fq 'database_name = "intap_db"' api/wrangler.toml || fail "D1 incorrecta"
grep -Fq 'bucket_name = "intap-r2"' api/wrangler.toml || fail "R2 incorrecto"
grep -Fq 'APP_URL = "https://app.intaprd.com"' api/wrangler.toml || fail "APP_URL incorrecta"
grep -Fq 'WEB_URL = "https://intaprd.com"' api/wrangler.toml || fail "WEB_URL incorrecta"
grep -Fq 'VITE_API_URL=https://api.intaprd.com' web/.env.production || fail "Web API incorrecta"
grep -Fq 'VITE_APP_URL=https://app.intaprd.com' web/.env.production || fail "Web App incorrecta"
grep -Fq 'VITE_API_URL=https://api.intaprd.com' app/.env.production || fail "App API incorrecta"
grep -Fq 'VITE_WEB_URL=https://intaprd.com' app/.env.production || fail "App Web incorrecta"

run npm ci
run node scripts/test-sponsored-profile-contract.mjs
run node scripts/test-free-contact-agenda-contract.mjs
run node scripts/test-ai-profile-canonical-limits.mjs
run npm run build -w app
run npm run build -w web
run bash -lc 'cd api && npx tsc --noEmit'
run bash -lc 'cd api && npx wrangler deploy --config wrangler.toml --dry-run'

echo; echo "▶ Consultar migraciones D1 Producción"
(
  cd api
  npx wrangler d1 migrations list "$PROD_DB" --remote --config wrangler.toml
) 2>&1 | tee "$MIGRATION_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "No pude consultar migraciones D1"

PENDING_FILES="$(grep -Eo '[0-9]{4}_[A-Za-z0-9._-]+\.sql' "$MIGRATION_LOG" | sort -u || true)"
if [ -n "$PENDING_FILES" ]; then
  while IFS= read -r migration; do
    [ -z "$migration" ] && continue
    [ "$migration" = "0084_free_portfolio_limit_10.sql" ] || fail "Migración pendiente fuera del release: $migration"
  done <<< "$PENDING_FILES"
  echo "✓ Única migración pendiente permitida: 0084_free_portfolio_limit_10.sql"
  (
    cd api
    npx wrangler d1 migrations apply "$PROD_DB" --remote --config wrangler.toml
  ) 2>&1 | tee -a "$MIGRATION_LOG"
  [ "${PIPESTATUS[0]}" -eq 0 ] || fail "Migración D1 Producción"
else
  echo "✓ No hay migraciones pendientes"
fi

echo; echo "▶ Verificar límite Free en D1 Producción"
LIMIT="$(cd api && npx wrangler d1 execute "$PROD_DB" --remote --config wrangler.toml --json --command "SELECT max_photos FROM plan_limits WHERE plan_id='free' LIMIT 1;" 2>/dev/null | python3 -c "import json,sys;d=json.load(sys.stdin);r=((d[0].get('results') if isinstance(d,list) and d else []) or []);print((r[0].get('max_photos') if r else '') or '')")"
[ "$LIMIT" = "10" ] || fail "D1 Producción Free max_photos esperado 10, actual $LIMIT"
echo "✓ D1 Producción Free max_photos = 10"

PREVIOUS_MAIN="$CURRENT_MAIN"

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

echo; echo "▶ Deploy Web Producción"
(npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch main) 2>&1 | tee "$WEB_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Web Producción"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$WEB_LOG" | tail -1 || true)"

sleep 5

echo; echo "▶ Smoke Producción"
for url in   "https://intaprd.com/"   "https://app.intaprd.com/admin/login"   "https://app.intaprd.com/admin/free/account"   "https://app.intaprd.com/admin/sponsored"
do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

echo; echo "▶ Smoke perfil Free real"
FREE_SLUG="$(
  cd api
  npx wrangler d1 execute "$PROD_DB" --remote --config wrangler.toml --json --command "SELECT slug FROM profiles WHERE lower(COALESCE(plan_id,'free'))='free' AND COALESCE(is_published,0)=1 ORDER BY updated_at DESC, created_at DESC LIMIT 1;" 2>/dev/null |
  python3 -c "import json,sys;d=json.load(sys.stdin);r=((d[0].get('results') if isinstance(d,list) and d else []) or []);print((r[0].get('slug') if r else '') or '')"
)"
[ -n "$FREE_SLUG" ] || fail "No existe perfil Free publicado para smoke"
code="$(curl -sS -L -o /dev/null -w '%{http_code}' "https://intaprd.com/$FREE_SLUG")"
echo "✓ https://intaprd.com/$FREE_SLUG -> HTTP $code"
[ "$code" = "200" ] || fail "Perfil Free real respondió HTTP $code"

echo; echo "▶ Promover release validado a main"
run git switch -C main "$REMOTE/main"
run git merge --ff-only "$REMOTE/$FEATURE_BRANCH"
run git push "$REMOTE" main
PROD_SHA="$(git rev-parse HEAD)"

run git fetch "$REMOTE" main
[ "$(git rev-parse "$REMOTE/main")" = "$PROD_SHA" ] || fail "main remoto no coincide con el SHA desplegado"

TAG="prod-owner-bar-settings-free-portfolio10-2026-10-01-$(date +%H%M%S)"
run git tag -a "$TAG" -m "Kawvo Link settings bar and Free portfolio 10 production"
run git push "$REMOTE" "$TAG"

rm -rf "$LOG_DIR"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Runner dejó cambios locales"; }

cat <<EOF
================================================================
✓ CONFIGURACIÓN + PORTAFOLIO FREE 10 · PRODUCCIÓN DESPLEGADA
================================================================
Production SHA: $PROD_SHA
Release tag:    $TAG
Previous main:  $PREVIOUS_MAIN
Worker Version: ${WORKER_VERSION:-ver salida Wrangler}
App Pages:      ${APP_ORIGIN:-ver salida Pages}
Web Pages:      ${WEB_ORIGIN:-ver salida Pages}

Incluye:
✓ Barra logueada: Configuración
✓ Free -> /admin/free/account
✓ Patrocinado -> /admin/sponsored
✓ Portafolio Free hasta 10 imágenes
✓ optimización WebP preservada
✓ D1 Free max_photos = 10
================================================================
EOF
