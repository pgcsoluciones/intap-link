#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/sponsored-banner-per-code"
EXPECTED_MAIN_SHA="dc7758f9b70cb8117146860b19270ff973d822bc"
APPROVED_PRODUCT_SHA="ae72eb0ffb37f641996725fddfc843ec72954175"
RUNNER_PATH="scripts/run-production-sponsored-banner-quote-2026-09-29.sh"
PROD_DB="intap_db"
APP_PROJECT="intap-web2"
WEB_PROJECT="intap-link"
LOG_DIR="$ROOT/.production-sponsored-media-agenda-pwa-logs"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" && mkdir -p "$LOG_DIR"

cat <<EOF
================================================================
KAWVO LINK · PATROCINADO · MEDIA + AGENDA + PWA · PRODUCCIÓN
================================================================
Release aprobado en Preview:
- cintillo por código beneficiario
- cotización / información por WhatsApp o correo
- media temporal y galería de hasta 3 imágenes
- descarga individual móvil
- Agenda reutilizable con bloqueos, confirmación y rechazo
- controles Cotizar / Agendar
- notificaciones, PWA y Web Push
- cabecera patrocinada móvil compacta
- Agenda + Descargar aplicación dentro de Mi cuenta
- firma KawLink siempre visible

Main esperado:      $EXPECTED_MAIN_SHA
Producto aprobado:  $APPROVED_PRODUCT_SHA
================================================================
EOF

run git fetch github main "$BRANCH"

CURRENT_MAIN="$(git rev-parse github/main)"
[ "$CURRENT_MAIN" = "$EXPECTED_MAIN_SHA" ] || fail "main cambió: esperado $EXPECTED_MAIN_SHA, actual $CURRENT_MAIN. Detener y auditar."

run git switch "$BRANCH"
run git pull --ff-only github "$BRANCH"

git restore -- "$RUNNER_PATH" 2>/dev/null || true
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Árbol local no limpio"; }

git merge-base --is-ancestor "$APPROVED_PRODUCT_SHA" HEAD || fail "El SHA aprobado de Preview ya no es ancestro de la rama"
POST_FILES="$(git diff --name-only "$APPROVED_PRODUCT_SHA"..HEAD | grep -v "^$RUNNER_PATH$" || true)"
[ -z "$POST_FILES" ] || { echo "$POST_FILES"; fail "Hay cambios de producto posteriores al SHA aprobado"; }

git merge-base --is-ancestor github/main HEAD || fail "main y feature divergieron; no es seguro promover por fast-forward"

cat > "$LOG_DIR/allowed-files.txt" <<'EOF_ALLOWED'
api/migrations-preview/0075_sponsored_banner_per_artifact.sql
api/migrations-preview/0076_sponsored_profile_email.sql
api/migrations-preview/0077_sponsored_profile_email_repair.sql
api/migrations-preview/0078_sponsored_quote_media.sql
api/migrations-preview/0079_sponsored_quote_media_batch.sql
api/migrations-preview/0080_appointments_core.sql
api/migrations-preview/0081_sponsored_public_actions.sql
api/migrations-preview/0082_user_push_subscriptions.sql
api/migrations/0076_sponsored_banner_per_artifact.sql
api/migrations/0077_sponsored_profile_email.sql
api/migrations/0078_sponsored_quote_media.sql
api/migrations/0079_sponsored_quote_media_batch.sql
api/migrations/0080_appointments_core.sql
api/migrations/0081_sponsored_public_actions.sql
api/migrations/0082_user_push_subscriptions.sql
api/src/account-home-route.ts
api/src/appointments-core.ts
api/src/lib/admin-auth.ts
api/src/preview-free-entry.ts
api/src/preview-frontdoor-entry.ts
api/src/pwa-push.ts
api/src/sponsored-admin-extra.ts
api/src/sponsored-appointments.ts
api/src/sponsored-profiles.ts
api/src/sponsored-public.ts
api/src/sponsored-quote-media.ts
api/wrangler.preview.toml
api/wrangler.toml
app/public/sw.js
app/src/App.tsx
app/src/components/admin/SuperAdminSponsors.tsx
app/src/components/admin/free/FreePwaHome.tsx
app/src/components/admin/sponsored/SponsorDashboard.tsx
app/src/components/admin/sponsored/SponsoredAppointments.tsx
app/src/components/admin/sponsored/SponsoredDashboard.tsx
app/src/components/admin/sponsored/SponsoredExperienceTools.tsx
app/src/components/appointments/AppointmentManager.tsx
app/src/components/notifications/PwaNotificationBridge.tsx
functions/_middleware.ts
scripts/generate-vapid-jwk.mjs
scripts/run-preview-sponsored-banner-quote-2026-09-29.sh
scripts/run-preview-sponsored-quote-media-ux-2026-09-29.sh
scripts/run-production-sponsored-banner-quote-2026-09-29.sh
scripts/test-sponsored-profile-contract.mjs
web/src/components/PublicProfile.tsx
web/src/components/appointments/AppointmentOwnerBar.tsx
web/src/components/appointments/AppointmentRequestModal.tsx
web/src/components/sponsored/QuoteAudioRecorder.tsx
web/src/components/sponsored/QuoteMediaAttachments.tsx
web/src/components/sponsored/SponsoredAppointmentModal.tsx
web/src/components/sponsored/SponsoredProfile.tsx
web/src/components/sponsored/SponsoredQuoteMediaViewer.tsx
EOF_ALLOWED

git diff --name-only github/main...HEAD | sort > "$LOG_DIR/actual-files.txt"
sort "$LOG_DIR/allowed-files.txt" > "$LOG_DIR/allowed-files.sorted.txt"

UNEXPECTED="$(comm -23 "$LOG_DIR/actual-files.txt" "$LOG_DIR/allowed-files.sorted.txt" || true)"
MISSING="$(comm -13 "$LOG_DIR/actual-files.txt" "$LOG_DIR/allowed-files.sorted.txt" || true)"
[ -z "$UNEXPECTED" ] || { echo "$UNEXPECTED"; fail "Hay archivos fuera del alcance aprobado"; }
[ -z "$MISSING" ] || { echo "$MISSING"; fail "La rama ya no coincide con el alcance aprobado"; }

run git diff --check github/main...HEAD

echo; echo "▶ Verificar configuración de Producción"
grep -Fq 'name = "intap-api"' api/wrangler.toml || fail "Worker de Producción incorrecto"
grep -Fq 'database_name = "intap_db"' api/wrangler.toml || fail "D1 de Producción incorrecta"
grep -Fq 'bucket_name = "intap-r2"' api/wrangler.toml || fail "R2 de Producción incorrecto"
grep -Fq 'APP_URL = "https://app.intaprd.com"' api/wrangler.toml || fail "APP_URL de Producción incorrecta"
grep -Fq 'WEB_URL = "https://intaprd.com"' api/wrangler.toml || fail "WEB_URL de Producción incorrecta"
grep -Fq 'VAPID_SUBJECT = "mailto:noreply@intaprd.com"' api/wrangler.toml || fail "VAPID_SUBJECT de Producción incorrecto"
grep -Fq 'VITE_API_URL=https://api.intaprd.com' web/.env.production || fail "Web API de Producción incorrecta"
grep -Fq 'VITE_APP_URL=https://app.intaprd.com' web/.env.production || fail "Web App de Producción incorrecta"
grep -Fq 'VITE_API_URL=https://api.intaprd.com' app/.env.production || fail "App API de Producción incorrecta"
grep -Fq 'VITE_WEB_URL=https://intaprd.com' app/.env.production || fail "App Web de Producción incorrecta"

run npm ci
run node scripts/test-sponsored-profile-contract.mjs
run npm run build -w app
run npm run build -w web
run bash -lc 'cd api && npx tsc --noEmit'
run bash -lc 'npx esbuild api/src/preview-free-entry.ts --bundle --platform=node --format=esm --target=node20 --external:cloudflare:* --outfile=/tmp/kawvo-sponsored-media-agenda-production-api.mjs'
run bash -lc 'cd api && npx wrangler deploy --config wrangler.toml --dry-run'

echo; echo "▶ Preflight D1 Producción"
(
  cd api
  npx wrangler d1 migrations list "$PROD_DB" --remote --config wrangler.toml
) 2>&1 | tee "$LOG_DIR/prod-migrations.log"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "No se pudieron listar migraciones Producción"

PENDING_PROD="$(grep -Eo '[0-9]{4}_[A-Za-z0-9._-]+\.sql' "$LOG_DIR/prod-migrations.log" | sort -u || true)"
EXPECTED_PENDING="$(printf '%s\n' \
  '0076_sponsored_banner_per_artifact.sql' \
  '0077_sponsored_profile_email.sql' \
  '0078_sponsored_quote_media.sql' \
  '0079_sponsored_quote_media_batch.sql' \
  '0080_appointments_core.sql' \
  '0081_sponsored_public_actions.sql' \
  '0082_user_push_subscriptions.sql')"

[ "$PENDING_PROD" = "$EXPECTED_PENDING" ] || {
  echo "Pendientes detectadas:"
  echo "$PENDING_PROD"
  echo
  echo "Pendientes esperadas:"
  echo "$EXPECTED_PENDING"
  fail "El estado de migraciones Producción no coincide con el release aprobado"
}

echo; echo "▶ Verificar secreto VAPID Producción"
if (cd api && npx wrangler secret list --config wrangler.toml 2>/dev/null | grep -F 'VAPID_PRIVATE_JWK' >/dev/null); then
  echo "✓ VAPID_PRIVATE_JWK ya existe en Producción"
else
  echo "  VAPID_PRIVATE_JWK no existe; se creará antes del deploy del Worker."
fi

echo; echo "▶ Aplicar migraciones 0076–0082 en D1 Producción"
(
  cd api
  npx wrangler d1 migrations apply "$PROD_DB" --remote --config wrangler.toml
) || fail "Migraciones Producción"

echo; echo "▶ Verificar esquema completo en Producción"
BANNER_COL="$(cd api && npx wrangler d1 execute "$PROD_DB" --remote --config wrangler.toml --command "SELECT name FROM pragma_table_info('sponsor_artifacts') WHERE name='banner_enabled';" 2>/dev/null || true)"
EMAIL_COL="$(cd api && npx wrangler d1 execute "$PROD_DB" --remote --config wrangler.toml --command "SELECT name FROM pragma_table_info('sponsored_profiles') WHERE name='email';" 2>/dev/null || true)"
QUOTE_MEDIA_TABLE="$(cd api && npx wrangler d1 execute "$PROD_DB" --remote --config wrangler.toml --command "SELECT name FROM sqlite_master WHERE type='table' AND name='sponsored_quote_media';" 2>/dev/null || true)"
QUOTE_MEDIA_BATCH="$(cd api && npx wrangler d1 execute "$PROD_DB" --remote --config wrangler.toml --command "SELECT name FROM pragma_table_info('sponsored_quote_media') WHERE name='batch_id';" 2>/dev/null || true)"
APPOINTMENT_TABLES="$(cd api && npx wrangler d1 execute "$PROD_DB" --remote --config wrangler.toml --command "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('appointment_settings','appointment_availability','appointment_reasons','appointment_blocks','appointment_requests') ORDER BY name;" 2>/dev/null || true)"
PUBLIC_ACTION_COLUMNS="$(cd api && npx wrangler d1 execute "$PROD_DB" --remote --config wrangler.toml --command "SELECT name FROM pragma_table_info('sponsored_profiles') WHERE name IN ('quote_button_visible','appointment_button_visible') ORDER BY name;" 2>/dev/null || true)"
PUSH_TABLE="$(cd api && npx wrangler d1 execute "$PROD_DB" --remote --config wrangler.toml --command "SELECT name FROM sqlite_master WHERE type='table' AND name='user_push_subscriptions';" 2>/dev/null || true)"

echo "$BANNER_COL" | grep -F 'banner_enabled' >/dev/null || fail "Falta sponsor_artifacts.banner_enabled"
echo "$EMAIL_COL" | grep -F 'email' >/dev/null || fail "Falta sponsored_profiles.email"
echo "$QUOTE_MEDIA_TABLE" | grep -F 'sponsored_quote_media' >/dev/null || fail "Falta sponsored_quote_media"
echo "$QUOTE_MEDIA_BATCH" | grep -F 'batch_id' >/dev/null || fail "Falta sponsored_quote_media.batch_id"
for table in appointment_settings appointment_availability appointment_reasons appointment_blocks appointment_requests; do
  echo "$APPOINTMENT_TABLES" | grep -F "$table" >/dev/null || fail "Falta tabla $table"
done
echo "$PUBLIC_ACTION_COLUMNS" | grep -F 'quote_button_visible' >/dev/null || fail "Falta sponsored_profiles.quote_button_visible"
echo "$PUBLIC_ACTION_COLUMNS" | grep -F 'appointment_button_visible' >/dev/null || fail "Falta sponsored_profiles.appointment_button_visible"
echo "$PUSH_TABLE" | grep -F 'user_push_subscriptions' >/dev/null || fail "Falta user_push_subscriptions"
echo "✓ Esquema Producción verificado"

echo; echo "▶ Asegurar VAPID_PRIVATE_JWK en Producción"
if ! (cd api && npx wrangler secret list --config wrangler.toml 2>/dev/null | grep -F 'VAPID_PRIVATE_JWK' >/dev/null); then
  node scripts/generate-vapid-jwk.mjs | (cd api && npx wrangler secret put VAPID_PRIVATE_JWK --config wrangler.toml) >/dev/null || fail "Configurar VAPID_PRIVATE_JWK Producción"
  echo "✓ VAPID_PRIVATE_JWK creada en Producción"
else
  echo "✓ VAPID_PRIVATE_JWK conservada"
fi

echo; echo "▶ Deploy API Producción"
(
  cd api
  npm run deploy:production
) 2>&1 | tee "$LOG_DIR/worker.log"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy API Producción"
WORKER_VERSION="$(grep -E 'Current Version ID:' "$LOG_DIR/worker.log" | tail -1 | sed -E 's/.*Current Version ID:[[:space:]]*//' || true)"

echo; echo "▶ Smoke API antes de UI"
code="$(curl -sS -o /dev/null -w '%{http_code}' https://intaprd.com/api/v1/public/sponsored/kawvo-release-smoke-no-existe)"
echo "✓ perfil patrocinado inexistente -> HTTP $code"
[ "$code" = "404" ] || fail "Ruta patrocinada esperaba HTTP 404, recibió $code"

code="$(curl -sS -o /dev/null -w '%{http_code}' https://intaprd.com/api/v1/public/sponsored/kawvo-release-smoke-no-existe/appointments)"
echo "✓ agenda patrocinada inexistente -> HTTP $code"
[ "$code" = "404" ] || fail "Ruta Agenda esperaba HTTP 404, recibió $code"

code="$(curl -sS -o /dev/null -w '%{http_code}' https://intaprd.com/api/v1/me/push/public-key)"
echo "✓ Web Push sin sesión -> HTTP $code"
[ "$code" = "401" ] || fail "Push public-key sin sesión esperaba HTTP 401, recibió $code"

echo; echo "▶ Deploy Web Producción"
(npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch main) 2>&1 | tee "$LOG_DIR/web.log"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Web Producción"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$LOG_DIR/web.log" | tail -1 || true)"

echo; echo "▶ Deploy App Producción"
(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch main) 2>&1 | tee "$LOG_DIR/app.log"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App Producción"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$LOG_DIR/app.log" | tail -1 || true)"

sleep 5
echo; echo "▶ Smoke Producción"
for url in \
  "https://intaprd.com/" \
  "https://app.intaprd.com/admin/login" \
  "https://app.intaprd.com/superadmin/sponsors" \
  "https://app.intaprd.com/admin/sponsor" \
  "https://app.intaprd.com/admin/sponsored" \
  "https://app.intaprd.com/admin/sponsored/agenda"
do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

echo; echo "▶ Promover release validado a main"
run git switch -C main github/main
run git merge --ff-only "github/$BRANCH"
run git push github main
PROD_SHA="$(git rev-parse HEAD)"
run git fetch github main
[ "$(git rev-parse github/main)" = "$PROD_SHA" ] || fail "main remoto no coincide con lo desplegado"

TAG="prod-sponsored-media-agenda-pwa-2026-09-30-$(date +%H%M%S)"
run git tag -a "$TAG" -m "Sponsored media agenda PWA production 2026-09-30"
run git push github "$TAG"

rm -rf "$LOG_DIR"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Runner dejó cambios locales"; }

cat <<EOF
================================================================
✓ KAWVO LINK PATROCINADO DESPLEGADO EN PRODUCCIÓN
================================================================
Production SHA: $PROD_SHA
Release tag:    $TAG
Worker Version: $WORKER_VERSION
Web Pages:      $WEB_ORIGIN
App Pages:      $APP_ORIGIN

Incluye:
✓ Cintillo por código beneficiario
✓ Cotización / información + media temporal
✓ Galería y descarga individual móvil
✓ Agenda con bloqueos, confirmación, rechazo y liberación
✓ Cotizar / Agendar configurables
✓ Notificaciones + PWA + Web Push
✓ Agenda y Descargar aplicación dentro de Mi cuenta
✓ Cabecera patrocinada móvil compacta
✓ Firma KawLink siempre visible
✓ main promovido y release etiquetado
================================================================
EOF
