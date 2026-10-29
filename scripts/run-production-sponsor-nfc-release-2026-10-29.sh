#!/usr/bin/env bash
# KAWVO · Release producción patrocinio/NFC · SOLO ejecución explícita
set -euo pipefail
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawvo-sponsor-commercial-controls-2026-10-27"
EXPECTED_SHA="779e3e6470ac9061021535d1b3dadfac998bdadd"
LOG="$HOME/intap-release-logs/kawvo-production-$(date -u +%Y%m%dT%H%M%SZ)"
fail(){ echo "ERROR · DETENIDO: $*" >&2; exit 1; }
[[ "${KAWVO_RELEASE_PRODUCTION:-}" == "APROBADO" ]] || fail "Se requiere KAWVO_RELEASE_PRODUCTION=APROBADO"
cd "$ROOT" || fail "Repositorio no encontrado"
[[ -z "$(git status --porcelain)" ]] || fail "Hay cambios locales sin guardar"
git fetch github main "$BRANCH"
git switch "$BRANCH"
git pull --ff-only github "$BRANCH"
[[ "$(git rev-parse HEAD)" == "$EXPECTED_SHA" ]] || fail "La rama cambió después de la auditoría; revisar la revisión antes de publicar"
git merge-base --is-ancestor github/main HEAD || fail "La rama no contiene main actual"
git diff --check github/main...HEAD
grep -q '^ENVIRONMENT = "production"' api/wrangler.toml || fail "No está configurado ENVIRONMENT production"
grep -q '^database_name = "intap_db"$' api/wrangler.toml || fail "Base D1 no es intap_db"
grep -q '^database_id = "3a2d724d-5938-4777-a63e-423bb41862c0"$' api/wrangler.toml || fail "ID D1 producción inesperado"
grep -q '^name = "intap-api"$' api/wrangler.toml || fail "Worker incorrecto"
grep -q '^bucket_name = "intap-r2"$' api/wrangler.toml || fail "R2 inesperado"
echo "▶ Preflight"
node scripts/test-sponsor-commercial-contract.mjs
node scripts/test-nfc-physical-identifier-release.mjs
node scripts/test-intapcard-active-account-contract.mjs
node scripts/test-intapcard-kawmed-integrated-contract.mjs
npx tsc --noEmit -p api/tsconfig.json
npm run build -w web
npm run build -w app
mkdir -p "$LOG"
echo "$EXPECTED_SHA" > "$LOG/commit.txt"
echo "▶ Snapshot de bundles locales"
WEB_BUNDLE="$(find web/dist/assets -maxdepth 1 -name 'index-*.js' -type f | sort | tail -1)"
APP_BUNDLE="$(find app/dist/assets -maxdepth 1 -name 'index-*.js' -type f | sort | tail -1)"
[[ -n "$WEB_BUNDLE" && -n "$APP_BUNDLE" ]] || fail "No se encontraron bundles locales"
echo "web=$WEB_BUNDLE" | tee "$LOG/bundles.txt"
echo "app=$APP_BUNDLE" | tee -a "$LOG/bundles.txt"
echo "▶ RESPALDO REMOTO D1 PRODUCCIÓN ANTES DE TODA ESCRITURA"
(cd api && npx wrangler d1 export intap_db --remote --config wrangler.toml --output="$LOG/intap_db_before_release.sql")
[[ -s "$LOG/intap_db_before_release.sql" ]] || fail "No se produjo respaldo D1"
grep -qi 'CREATE TABLE' "$LOG/intap_db_before_release.sql" || fail "Respaldo SQL inválido"
shasum -a 256 "$LOG/intap_db_before_release.sql" > "$LOG/backup.sha256"
echo "✓ Respaldo: $LOG/intap_db_before_release.sql"
echo "▶ Migraciones aditivas 0153 y 0154 · Producción"
(cd api && npx wrangler d1 execute intap_db --remote --config wrangler.toml --file=migrations/0153_sponsor_sales_representatives.sql)
(cd api && npx wrangler d1 execute intap_db --remote --config wrangler.toml --file=migrations/0154_artifact_display_identifiers.sql)
echo "▶ Worker API Producción (dry-run y deploy)"
(cd api && npx wrangler deploy --config wrangler.toml --dry-run && npx wrangler deploy --config wrangler.toml) 2>&1 | tee "$LOG/api.log"
echo "▶ Web pública al proyecto propietario intap-link"
npx wrangler pages deploy web/dist --project-name intap-link --branch main 2>&1 | tee "$LOG/web.log"
echo "▶ Panel de administración al proyecto propietario intap-web2"
npx wrangler pages deploy app/dist --project-name intap-web2 --branch main 2>&1 | tee "$LOG/app.log"
echo "▶ Comprobación bundle en dominios canónicos"
for item in "https://intaprd.com|$WEB_BUNDLE" "https://app.intaprd.com|$APP_BUNDLE"; do
  origin="${item%%|*}"; bundle="${item#*|}"
  asset="/assets/$(basename "$bundle")"
  actual="$(curl --retry 4 --retry-delay 4 -fsSL --max-time 30 "$origin$asset" | shasum -a 256 | awk '{print $1}')" || fail "Bundle no disponible: $origin$asset"
  expected="$(shasum -a 256 "$bundle" | awk '{print $1}')"
  [[ "$actual" == "$expected" ]] || fail "Bundle remoto distinto: $origin$asset (se requiere revisar Pages)"
  printf '%s OK %s\n' "$origin" "$asset" | tee -a "$LOG/verification.txt"
done
for url in "https://intaprd.com/" "https://app.intaprd.com/admin/login" "https://api.intaprd.com/"; do
  status="$(curl -sSL --max-time 30 -o /dev/null -w '%{http_code}' "$url" || true)"
  echo "$url HTTP $status" | tee -a "$LOG/verification.txt"
  [[ "$status" != "000" && "$status" != "5"* ]] || fail "Dominio inaccesible $url HTTP $status"
done
echo "✓ Release finalizado. Ref: $EXPECTED_SHA"
echo "✓ Logs y respaldo: $LOG"
echo "ATENCIÓN: conservar este respaldo. No restaurar D1 encima de nuevos datos sin conciliación."
