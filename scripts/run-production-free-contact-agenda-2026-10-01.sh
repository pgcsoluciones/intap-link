#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
REMOTE="github"
FEATURE_BRANCH="feature/free-contact-agenda-experience"
EXPECTED_MAIN_SHA="f2dc1bfb52e2367d5b32d5b58609d18ce83024ae"
APPROVED_PREVIEW_SHA="43fa642bdedfe109007439ef86f96d7859f84513"
RUNNER_PATH="scripts/run-production-free-contact-agenda-2026-10-01.sh"
APP_PROJECT="intap-web2"
WEB_PROJECT="intap-link"
PROD_DB="intap_db"
LOG_DIR="$ROOT/.production-free-contact-agenda-2026-10-01-logs"
APP_LOG="$LOG_DIR/app-pages-production.log"
WEB_LOG="$LOG_DIR/web-pages-production.log"
WORKER_LOG="$LOG_DIR/worker-production.log"
MIGRATION_LOG="$LOG_DIR/d1-production-migrations.log"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" "$ROOT/.preview-free-contact-agenda-logs" "$ROOT/.production-free-contact-agenda-2026-10-01-logs"
rm -f "$ROOT/api/wrangler.preview.toml.free-contact-agenda.bak"
mkdir -p "$LOG_DIR"

cat <<EOF
================================================================
KAWVO LINK · FREE · HORARIO + COTIZACIÓN + AGENDA · PRODUCCIÓN
================================================================
Promueve únicamente el Preview aprobado y se detiene ante cualquier deriva.
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
api/migrations-preview/0083_free_quote_media.sql
api/migrations/0083_free_quote_media.sql
api/src/account-home-route.ts
api/src/free-appointments.ts
api/src/index.ts
api/src/preview-free-entry.ts
api/src/sponsored-quote-media.ts
app/src/App.tsx
app/src/components/admin/free/FreeAccount.tsx
app/src/components/admin/free/FreeAppointments.tsx
app/src/components/admin/free/FreeDashboard.tsx
app/src/components/admin/free/FreeExperienceSettings.tsx
app/src/components/admin/free/FreePwaHome.tsx
app/src/components/appointments/AppointmentManager.tsx
app/src/components/notifications/PwaNotificationBridge.tsx
scripts/create-preview-free-activation-code.mjs
scripts/run-preview-free-contact-agenda-2026-09-30.sh
scripts/run-production-free-contact-agenda-2026-10-01.sh
scripts/test-free-contact-agenda-contract.mjs
scripts/test-sponsored-profile-contract.mjs
web/src/components/PublicProfile.tsx
web/src/components/appointments/AppointmentOwnerBar.tsx
web/src/components/free-profile/FreeContactActions.tsx
web/src/components/free-profile/FreePreviewEditShortcut.tsx
web/src/components/free-profile/IntapLinkGratis.adapter.ts
web/src/components/free-profile/IntapLinkGratis.types.ts
web/src/components/free-profile/IntapLinkGratisProfile.tsx
web/src/components/free-profile/PublicBankAccounts.tsx
EOF_FILES

git diff --name-only "$REMOTE/main"...HEAD | sort > "$LOG_DIR/actual-files.txt"
sort "$LOG_DIR/expected-files.txt" > "$LOG_DIR/expected-files.sorted.txt"
diff -u "$LOG_DIR/expected-files.sorted.txt" "$LOG_DIR/actual-files.txt" || fail "El alcance del release no coincide exactamente con lo aprobado"

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
run npm run build -w web
run npm run build -w app
run bash -lc 'cd api && npx tsc --noEmit'
run bash -lc 'npx esbuild api/src/preview-free-entry.ts --bundle --platform=node --format=esm --target=node20 --external:cloudflare:* --outfile=/tmp/kawvo-free-contact-agenda-production-api.mjs'
run bash -lc 'cd api && npx wrangler deploy --config wrangler.toml --dry-run'

echo; echo "▶ Consultar migraciones D1 Producción"
(
  cd api
  npx wrangler d1 migrations list "$PROD_DB" --remote --config wrangler.toml
) 2>&1 | tee "$MIGRATION_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "No pude consultar migraciones"

PENDING_FILES="$(grep -Eo '[0-9]{4}_[A-Za-z0-9._-]+\.sql' "$MIGRATION_LOG" | sort -u || true)"
if [ -n "$PENDING_FILES" ]; then
  while IFS= read -r migration; do
    [ -z "$migration" ] && continue
    [ "$migration" = "0083_free_quote_media.sql" ] || fail "Migración pendiente fuera del release: $migration"
  done <<< "$PENDING_FILES"
  echo "✓ Única migración pendiente permitida: 0083_free_quote_media.sql"
  (
    cd api
    npx wrangler d1 migrations apply "$PROD_DB" --remote --config wrangler.toml
  ) 2>&1 | tee -a "$MIGRATION_LOG"
  [ "${PIPESTATUS[0]}" -eq 0 ] || fail "Migración D1 Producción"
else
  echo "✓ No hay migraciones pendientes"
fi

echo; echo "▶ Verificar D1 Producción"
TABLE_FREE_MEDIA="$(cd api && npx wrangler d1 execute "$PROD_DB" --remote --config wrangler.toml --command "SELECT name FROM sqlite_master WHERE type='table' AND name='free_quote_media';" 2>/dev/null || true)"
echo "$TABLE_FREE_MEDIA" | grep -F "free_quote_media" >/dev/null || fail "free_quote_media no existe en Producción"
TABLES="$(cd api && npx wrangler d1 execute "$PROD_DB" --remote --config wrangler.toml --command "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('appointment_settings','appointment_availability','appointment_reasons','appointment_blocks','appointment_requests','user_notifications') ORDER BY name;" 2>/dev/null || true)"
for table in appointment_settings appointment_availability appointment_reasons appointment_blocks appointment_requests user_notifications; do
  echo "$TABLES" | grep -F "$table" >/dev/null || fail "D1 Producción no tiene $table"
done

PREVIOUS_MAIN="$CURRENT_MAIN"

echo; echo "▶ Deploy Worker Producción"
(
  cd api
  npm run deploy:production
) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Producción"
WORKER_VERSION="$(grep -E 'Current Version ID:' "$WORKER_LOG" | tail -1 | sed -E 's/.*Current Version ID:[[:space:]]*//' || true)"

echo; echo "▶ Smoke API antes de UI"
code="$(curl -sS -o /dev/null -w '%{http_code}' https://app.intaprd.com/api/v1/me/free/appointments)"
[ "$code" = "401" ] || fail "Agenda Free privada esperaba 401, recibió $code"
echo "✓ Agenda Free privada sin sesión -> HTTP $code"

echo; echo "▶ Deploy Web Producción"
(npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch main) 2>&1 | tee "$WEB_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Web"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$WEB_LOG" | tail -1 || true)"

echo; echo "▶ Deploy App Producción"
(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch main) 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$APP_LOG" | tail -1 || true)"

sleep 5

echo; echo "▶ Smoke Producción"
for url in "https://intaprd.com/" "https://app.intaprd.com/admin/login" "https://app.intaprd.com/admin/free/agenda"; do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

echo; echo "▶ Smoke de perfil Free real"
FREE_SLUG="$(
  cd api
  npx wrangler d1 execute "$PROD_DB" --remote --config wrangler.toml --json --command "SELECT slug FROM profiles WHERE lower(COALESCE(plan_id,'free'))='free' AND COALESCE(is_published,0)=1 ORDER BY updated_at DESC, created_at DESC LIMIT 1;" 2>/dev/null |
  python3 -c "import json,sys; d=json.load(sys.stdin); rows=((d[0].get('results') if isinstance(d,list) and d else []) or []); print((rows[0].get('slug') if rows else '') or '')"
)"
[ -n "$FREE_SLUG" ] || fail "No existe perfil Free publicado para smoke"
echo "✓ Perfil Free Producción: /$FREE_SLUG"

curl -sS -f "https://intaprd.com/api/v1/public/profiles/$FREE_SLUG" -o "$LOG_DIR/free-profile.json" || fail "Perfil Free canónico no responde"
python3 - "$LOG_DIR/free-profile.json" "$FREE_SLUG" <<'PY'
import json,sys
p=json.load(open(sys.argv[1]))
slug=sys.argv[2]
d=p.get('data') or {}
assert d.get('slug')==slug
assert d.get('planId')=='free'
x=d.get('freeExperience')
assert isinstance(x,dict)
assert isinstance(x.get('schedule_visible'),bool)
assert isinstance(x.get('schedule'),list)
if x.get('schedule_visible'):
    assert len(x.get('schedule'))>0
else:
    assert len(x.get('schedule'))==0
assert isinstance(x.get('quote_button_visible'),bool)
print(f"✓ Payload Free /{slug}: experiencia integrada y horario coherente")
PY

code="$(curl -sS -o "$LOG_DIR/free-media-empty.json" -w '%{http_code}' -X POST "https://intaprd.com/api/v1/public/profiles/$FREE_SLUG/quote-media")"
[ "$code" = "400" ] || fail "quote-media esperaba HTTP 400, recibió $code"
grep -F "Adjunta una imagen, PDF o audio." "$LOG_DIR/free-media-empty.json" >/dev/null || fail "Contrato quote-media inesperado"
echo "✓ quote-media Free activo"

echo; echo "▶ Promover release validado a main"
run git switch -C main "$REMOTE/main"
run git merge --ff-only "$REMOTE/$FEATURE_BRANCH"
run git push "$REMOTE" main
PROD_SHA="$(git rev-parse HEAD)"
run git fetch "$REMOTE" main
[ "$(git rev-parse "$REMOTE/main")" = "$PROD_SHA" ] || fail "main remoto no coincide con el SHA desplegado"

TAG="prod-free-contact-agenda-2026-10-01-$(date +%H%M%S)"
run git tag -a "$TAG" -m "Kawvo Link Free contact agenda production 2026-10-01"
run git push "$REMOTE" "$TAG"

rm -rf "$LOG_DIR"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Runner dejó cambios locales"; }

cat <<EOF
================================================================
✓ FREE CONTACTO + AGENDA DESPLEGADO EN PRODUCCIÓN
================================================================
Production SHA: $PROD_SHA
Release tag:    $TAG
Previous main:  $PREVIOUS_MAIN
Worker Version: ${WORKER_VERSION:-ver salida Wrangler}
Web Pages:      ${WEB_ORIGIN:-ver salida Pages}
App Pages:      ${APP_ORIGIN:-ver salida Pages}
================================================================
EOF
