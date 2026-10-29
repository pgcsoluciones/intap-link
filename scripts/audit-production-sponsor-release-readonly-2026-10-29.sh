#!/usr/bin/env bash
# Kawvo production readiness - READ ONLY. No migrations, deploys, exports or writes.
set -euo pipefail
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
cd "$ROOT"
fail(){ echo "NO APTO: $*" >&2; exit 1; }
[[ -z "$(git status --porcelain)" ]] || fail "Hay cambios locales sin guardar"
[[ "$(git branch --show-current)" == "feature/kawvo-sponsor-commercial-controls-2026-10-27" ]] || fail "Rama incorrecta"
git diff --check
node scripts/test-sponsor-commercial-contract.mjs
node scripts/test-nfc-physical-identifier-release.mjs
node scripts/test-intapcard-active-account-contract.mjs
node scripts/test-intapcard-kawmed-integrated-contract.mjs
[[ -f api/wrangler.toml && -f api/wrangler.preview.toml ]] || fail "Configuración ausente"
grep -q '^ENVIRONMENT = "production"' api/wrangler.toml || fail "Configuración no es Producción"
grep -q '^database_name = "intap_db"$' api/wrangler.toml || fail "Base de Producción inesperada"
grep -q '^database_name = "intap_db_preview"$' api/wrangler.preview.toml || fail "Preview inesperado"
echo "VERIFICACIÓN DE ESQUEMA PROD · CONSULTAS DE SOLO LECTURA"
(cd api && npx wrangler d1 execute intap_db --remote --config wrangler.toml --command="SELECT name FROM sqlite_master WHERE type='table' AND name IN ('intap_artifacts','sponsor_artifacts','sponsor_sales_representatives','artifact_display_identifiers','medical_display_identifiers','medical_access_codes') ORDER BY name;")
echo "VERIFICACIÓN DE CONTEOS PROD (SIN DATOS PERSONALES)"
(cd api && npx wrangler d1 execute intap_db --remote --config wrangler.toml --command="SELECT 'intap_artifacts' AS table_name, COUNT(*) AS total FROM intap_artifacts UNION ALL SELECT 'sponsor_artifacts', COUNT(*) FROM sponsor_artifacts UNION ALL SELECT 'medical_access_codes', COUNT(*) FROM medical_access_codes;")
echo "FIN auditoría solo lectura: NO se ha desplegado, migrado ni modificado Producción."
