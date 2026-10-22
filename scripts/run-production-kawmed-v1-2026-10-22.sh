#!/usr/bin/env bash
set -euo pipefail
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="reconcile/kawmed-medical-profile-v1-2026-10-19-v2"
EXPECTED_MAIN="2391896286839528557066968ca4b8abe9831fb9"
BACKUPS="$HOME/kawmed-db-production-backups"
LOG_DIR="$ROOT/.kawmed-production-release"
fail(){ echo "✗ $*" >&2; exit 1; }
cd "$ROOT" || fail "Repositorio no encontrado"
git diff --quiet && git diff --cached --quiet || fail "Existen modificaciones de código locales"
git fetch github main "$BRANCH"
[ "$(git rev-parse github/main)" = "$EXPECTED_MAIN" ] || fail "main cambió: abortar"
git switch "$BRANCH"
git pull --ff-only github "$BRANCH"
git merge-base --is-ancestor github/main HEAD || fail "La rama no desciende de main"
SHA="$(git rev-parse HEAD)"
git merge-base --is-ancestor a0d56a6fb80b20ef6aa2febc64adab3082cd02c7 HEAD || fail "SHA de pruebas no es ancestro"
EXTRA="$(git diff --name-only a0d56a6fb80b20ef6aa2febc64adab3082cd02c7..HEAD | grep -v "^scripts/run-production-kawmed-v1-2026-10-22.sh$" || true)"
[ -z "$EXTRA" ] || fail "Cambios de producto no validados posteriores a preflight"
BACKUP="$(find "$BACKUPS" -type f -name 'intap_db_before_kawmed_*.sql' -size +0c -print | sort | tail -1)"
[ -n "$BACKUP" ] || fail "No hay respaldo de D1 productiva"
[ -f "$BACKUP.sha256" ] || fail "No hay hash del respaldo"
(cd "$(dirname "$BACKUP")" && shasum -a 256 -c "$(basename "$BACKUP").sha256") || fail "Hash respaldo incorrecto"
if command -v sqlite3 >/dev/null 2>&1; then
 TEST_DB="$(mktemp "$BACKUPS/recheck.XXXXXXXX")"; trap 'rm -f "$TEST_DB"' EXIT
 sqlite3 "$TEST_DB" < "$BACKUP" || fail "No puede restaurarse respaldo"
 [ "$(sqlite3 "$TEST_DB" 'PRAGMA integrity_check;')" = "ok" ] || fail "Respaldo corrupto"
else fail "Se necesita sqlite3 para verificar restauración"; fi
mkdir -p "$LOG_DIR"
git diff --check github/main...HEAD
node scripts/test-kawmed-medical-profile-v1-contract.mjs
node scripts/test-kawmed-access-codes-contract.mjs
node scripts/test-agenda-phone-normalization-contract.mjs
node scripts/test-bank-privacy-interaction-contract.mjs
node scripts/test-login-sponsor-release-hotfix-2026-10-05.mjs
node scripts/test-free-demo-master-v2-contract.mjs
node scripts/test-consolidated-fixes-2026-10-03.mjs
npm run build -w web
npm run build -w app
(cd api && npx tsc --noEmit)
# Allowlist estricta de migraciones para no ejecutar migraciones ajenas.
(cd api && npx wrangler d1 migrations list intap_db --remote --config wrangler.toml) 2>&1 | tee "$LOG_DIR/pending.txt"
PENDING="$(grep -Eo '[0-9]{4}_[a-zA-Z0-9._-]+\.sql' "$LOG_DIR/pending.txt" | sort -u || true)"
EXPECTED="$(printf '%s\n' 0090_kawmed_medical_profiles_v1.sql 0091_kawmed_insurance_exclusions.sql 0092_kawmed_shared_appointments.sql 0093_kawmed_medical_appointment_reasons.sql 0094_kawmed_private_sponsorship.sql 0095_kawmed_access_codes_programs.sql 0096_kawmed_representatives_traceability.sql 0097_kawmed_master_multiaccount.sql 0098_kawmed_accepted_insurances.sql 0099_kawmed_master_public_profile.sql 0150_kawmed_appearance_v2.sql | sort)"
[ "$PENDING" = "$EXPECTED" ] || fail "Migraciones pendientes no coinciden exactamente con las 11 esperadas"
# No introducir datos de demostración en DB real.
if grep -qE 'kawmed_demo_laura_mendez|kawmed_ins_ex_1|kawmed_ins_accept_1' api/migrations/009{0,1,2,3,8}_kawmed_*.sql; then fail "Datos de prueba en migraciones"; fi
echo "✓ Gates aprobados: backup, pruebas, builds, exactamente 11 migraciones. Iniciando promoción autorizada."
(cd api && npx wrangler d1 migrations apply intap_db --remote --config wrangler.toml) 2>&1 | tee "$LOG_DIR/migrations.txt"
# Implementar Web/App, después Worker. Guardar orígenes y reconfigurar el Worker de forma transitoria.
(npx wrangler pages deploy app/dist --project-name intap-web2 --branch main) 2>&1 | tee "$LOG_DIR/app.txt"
(npx wrangler pages deploy web/dist --project-name intap-link --branch main) 2>&1 | tee "$LOG_DIR/web.txt"
(cd api && npx wrangler deploy --config wrangler.toml) 2>&1 | tee "$LOG_DIR/worker.txt"
for url in https://intaprd.com/ https://app.intaprd.com/admin/medical https://app.intaprd.com/superadmin/kawmed https://intaprd.com/m/lauramendez; do
 code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
 echo "$url => $code" | tee -a "$LOG_DIR/smoke.txt"
 [ "$code" = "200" ] || fail "Smoke HTTP falló: $url"
done
# No forzar contenido falso en Producción; perfil demo puede no existir.
git fetch github main
[ "$(git rev-parse github/main)" = "$EXPECTED_MAIN" ] || fail "main cambió durante el despliegue"
git switch -C main github/main
git merge --ff-only "$BRANCH"
git push github main
echo "✓ KawMed publicado; main=$(git rev-parse HEAD)"
