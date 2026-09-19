#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="main"
WEB_PROJECT="intap-link"
APP_PROJECT="intap-web2"
PROD_DB="intap_db"
LOG_DIR="$ROOT/.production-kawlink-trial-logs"
HISTORY_BEFORE="$LOG_DIR/d1-history-before.log"
PENDING_BEFORE="$LOG_DIR/d1-pending-before.log"
HISTORY_AFTER="$LOG_DIR/d1-history-after.log"
TABLES_AFTER="$LOG_DIR/d1-tables-after.log"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR"
mkdir -p "$LOG_DIR"

cat <<'EOF'
============================================================
KAWVO LINK · TRIAL V1 · PRODUCCIÓN
============================================================
- despliega únicamente desde main sincronizado con github/main
- valida Trial + Sponsored antes de tocar Producción
- valida la secuencia D1 0070 → 0073
- aplica migraciones D1 Producción
- despliega Web + App + Worker/API
- ejecuta smoke tests de Producción
============================================================
EOF

run git fetch github main
run git checkout "$BRANCH"
run git pull --ff-only github main

DIRTY="$(git status --porcelain | grep -v '^?? web/public/assets/welcome/' || true)"
[ -z "$DIRTY" ] || {
  printf '%s\n' "$DIRTY"
  fail "El árbol de trabajo tiene cambios no permitidos"
}
if git status --porcelain | grep -q '^?? web/public/assets/welcome/'; then
  echo "✓ Ignorando recurso local pausado: web/public/assets/welcome/"
fi

LOCAL_SHA="$(git rev-parse HEAD)"
REMOTE_SHA="$(git rev-parse github/main)"
[ "$LOCAL_SHA" = "$REMOTE_SHA" ] || fail "main local no coincide con github/main"

echo "✓ Release SHA: $LOCAL_SHA"

run git diff --check

echo
echo "▶ Verificar secuencia local de migraciones 0070–0073"
RELEASE_MIGRATIONS="$(find api/migrations -maxdepth 1 -type f -name '007[0-3]_*.sql' -exec basename {} \; | sort)"
EXPECTED_MIGRATIONS="$(printf '%s\n' \
  '0070_sponsored_bank_free_parity.sql' \
  '0071_trial_profiles_72h.sql' \
  '0072_trial_crm_traceability.sql' \
  '0073_trial_lifecycle_analytics.sql')"

[ "$RELEASE_MIGRATIONS" = "$EXPECTED_MIGRATIONS" ] || {
  echo "Migraciones encontradas:"
  printf '%s\n' "$RELEASE_MIGRATIONS"
  fail "La secuencia local 0070–0073 no coincide con la aprobada"
}
printf '✓ %s\n' "$RELEASE_MIGRATIONS"

run npm ci
run node scripts/test-trial-contract.mjs
run node scripts/test-sponsored-profile-contract.mjs
run npm run build -w web
run npm run build -w app
run bash -lc 'cd api && npx tsc --noEmit'
run bash -lc 'npx esbuild api/src/preview-free-entry.ts --bundle --platform=node --format=esm --target=node20 --external:cloudflare:* --outfile=/tmp/kawvo-trial-production-api.mjs'

echo
echo "▶ Historial D1 Producción ANTES"
(
  cd api
  npx wrangler d1 execute "$PROD_DB" --remote --config wrangler.toml     --command "SELECT id, name, applied_at FROM d1_migrations ORDER BY id DESC LIMIT 12;"
) | tee "$HISTORY_BEFORE"
grep -q '0070_sponsored_bank_free_parity.sql' "$HISTORY_BEFORE" || fail "Producción no registra 0070_sponsored_bank_free_parity.sql"

echo
echo "▶ Migraciones pendientes ANTES"
(
  cd api
  npx wrangler d1 migrations list "$PROD_DB" --remote --config wrangler.toml
) | tee "$PENDING_BEFORE"

echo
echo "▶ Aplicar migraciones D1 Producción"
(
  cd api
  npx wrangler d1 migrations apply "$PROD_DB" --remote --config wrangler.toml
) || fail "Falló la aplicación de migraciones D1 Producción"

echo
echo "▶ Verificar historial D1 DESPUÉS"
(
  cd api
  npx wrangler d1 execute "$PROD_DB" --remote --config wrangler.toml     --command "SELECT id, name, applied_at FROM d1_migrations ORDER BY id DESC LIMIT 8;"
) | tee "$HISTORY_AFTER"

for migration in   0070_sponsored_bank_free_parity.sql   0071_trial_profiles_72h.sql   0072_trial_crm_traceability.sql   0073_trial_lifecycle_analytics.sql
do
  grep -q "$migration" "$HISTORY_AFTER" || fail "No aparece aplicada $migration"
done

echo
echo "▶ Verificar tablas Trial"
(
  cd api
  npx wrangler d1 execute "$PROD_DB" --remote --config wrangler.toml     --command "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('trial_profiles','trial_events','trial_analytics_events') ORDER BY name;"
) | tee "$TABLES_AFTER"
for table in trial_profiles trial_events trial_analytics_events; do
  grep -q "$table" "$TABLES_AFTER" || fail "No existe tabla $table después de migrar"
done

echo
echo "▶ Deploy Web Producción"
npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch main

echo
echo "▶ Deploy App Producción"
npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch main

echo
echo "▶ Deploy Worker/API Producción"
(
  cd api
  npx wrangler deploy --config wrangler.toml --dry-run
  npx wrangler deploy --config wrangler.toml
)

sleep 7

echo
echo "▶ Smoke Producción"

code="$(curl -sS -L -o /dev/null -w '%{http_code}' https://intaprd.com/trial)"
[ "$code" = "200" ] || fail "https://intaprd.com/trial respondió HTTP $code"
echo "✓ https://intaprd.com/trial -> HTTP 200"

code="$(curl -sS -L -o /dev/null -w '%{http_code}' https://app.intaprd.com/admin/login)"
[ "$code" = "200" ] || fail "https://app.intaprd.com/admin/login respondió HTTP $code"
echo "✓ Login Admin -> HTTP 200"

code="$(curl -sS -o "$LOG_DIR/trial-master.json" -w '%{http_code}' https://intaprd.com/api/v1/public/trials/master)"
[ "$code" = "200" ] || {
  cat "$LOG_DIR/trial-master.json"
  fail "Trial Master API respondió HTTP $code"
}
grep -q '"ok":true' "$LOG_DIR/trial-master.json" || {
  cat "$LOG_DIR/trial-master.json"
  fail "Trial Master API no devolvió ok:true"
}
echo "✓ Trial Master API -> OK"

code="$(curl -sS -o "$LOG_DIR/trial-admin.json" -w '%{http_code}' https://intaprd.com/api/v1/superadmin/trials/context)"
[ "$code" = "401" ] || {
  cat "$LOG_DIR/trial-admin.json"
  fail "Super Admin sin sesión debe responder 401; respondió $code"
}
echo "✓ Super Admin protegido -> HTTP 401"

code="$(curl -sS -o "$LOG_DIR/trial-notfound.json" -w '%{http_code}' https://intaprd.com/api/v1/public/trials/__qa_no_trial__)"
[ "$code" = "404" ] || {
  cat "$LOG_DIR/trial-notfound.json"
  fail "Trial inexistente debe responder 404; respondió $code"
}
echo "✓ Trial inexistente -> HTTP 404"

echo
echo "▶ Confirmar que no quedan migraciones Trial pendientes"
(
  cd api
  npx wrangler d1 migrations list "$PROD_DB" --remote --config wrangler.toml
)

DIRTY_END="$(git status --porcelain | grep -v '^?? web/public/assets/welcome/' || true)"
[ -z "$DIRTY_END" ] || {
  printf '%s\n' "$DIRTY_END"
  fail "El runner dejó cambios locales no permitidos"
}

rm -rf "$LOG_DIR"

cat <<EOF
============================================================
✓ KAWVO LINK · TRIAL V1 · PRODUCCIÓN COMPLETADA
============================================================
Release SHA: $LOCAL_SHA
Web:   https://intaprd.com/trial
Admin: https://app.intaprd.com/superadmin/trials
============================================================
EOF
