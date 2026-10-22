#!/usr/bin/env bash
set -euo pipefail
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="reconcile/kawmed-medical-profile-v1-2026-10-19-v2"
EXPECTED_MAIN="2391896286839528557066968ca4b8abe9831fb9"
REPORT_DIR="$ROOT/.kawmed-prod-preflight"
fail(){ printf '\n✗ %s\n' "$1"; exit 1; }
cd "$ROOT" || fail "No encuentro el repositorio local"
[ -z "$(git status --porcelain)" ] || fail "Árbol local con cambios; detener sin modificar"
git fetch github main "$BRANCH"
[ "$(git rev-parse github/main)" = "$EXPECTED_MAIN" ] || fail "main cambió; hace falta reconciliar"
git switch "$BRANCH"
git pull --ff-only github "$BRANCH"
[ -z "$(git status --porcelain)" ] || fail "Árbol local sucio"
git merge-base --is-ancestor github/main HEAD || fail "Rama divergente"
git diff --check github/main...HEAD
mkdir -p "$REPORT_DIR"
printf 'main=%s\nfeature=%s\n' "$(git rev-parse github/main)" "$(git rev-parse HEAD)" | tee "$REPORT_DIR/refs.txt"
echo "▶ Alcance de cambios respecto a Producción"
git diff --name-status github/main...HEAD | tee "$REPORT_DIR/files.txt"
echo "▶ Rechazar datos ficticios en migraciones de Producción"
if grep -nE 'kawmed_demo_laura_mendez|kawmed_ins_ex_1|kawmed_ins_accept_1|kawmed_appt_avail_1|kawmed_reason_1' api/migrations/009{0,1,2,3,8}_kawmed_*.sql; then
 fail "Fixture de Preview detectado en Producción"
fi
echo "▶ Contratos y pruebas de regresión"
npm ci
node scripts/test-kawmed-medical-profile-v1-contract.mjs
node scripts/test-kawmed-access-codes-contract.mjs
node scripts/test-agenda-phone-normalization-contract.mjs
node scripts/test-bank-privacy-interaction-contract.mjs
node scripts/test-login-sponsor-release-hotfix-2026-10-05.mjs
node scripts/test-free-demo-master-v2-contract.mjs
node scripts/test-consolidated-fixes-2026-10-03.mjs
echo "▶ Compilar Web / App / API sin publicar"
npm run build -w web
npm run build -w app
(cd api && npx tsc --noEmit)
echo "▶ Auditoría de dependencias (reporte; no modifica versiones)"
npm audit --json > "$REPORT_DIR/npm-audit.json" || true
echo "▶ Consultar exclusivamente migraciones pendientes de D1 Producción"
(cd api && npx wrangler d1 migrations list intap_db --remote --config wrangler.toml) 2>&1 | tee "$REPORT_DIR/production-migrations.txt"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "No pude consultar migraciones de Producción"
echo "▶ Revisar configuración para evitar apuntar a Preview"
grep -Fq 'name = "intap-api"' api/wrangler.toml || fail "Worker Producción no reconocido"
grep -Fq 'database_name = "intap_db"' api/wrangler.toml || fail "D1 Producción no reconocida"
grep -Fq 'bucket_name = "intap-r2"' api/wrangler.toml || fail "R2 Producción no reconocido"
echo "✓ PRE-FLIGHT SOLO LECTURA COMPLETO. NINGÚN DEPLOY NI MIGRACIÓN EJECUTADOS."
echo "Reportes: $REPORT_DIR"
