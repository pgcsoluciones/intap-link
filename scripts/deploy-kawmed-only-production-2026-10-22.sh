#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
fail(){ echo "ERROR: $*" >&2; exit 1; }
run(){ echo "▶ $*"; "$@"; }
REMOTE=github
BRANCH=release/kawmed-only-production-2026-10-22
BASE=2391896286839528557066968ca4b8abe9831fb9
echo "KAWMED ONLY: INDEPENDIENTE + PATROCINADO / DEPLOY PRODUCCION"
command -v git >/dev/null && command -v npm >/dev/null && command -v curl >/dev/null || fail "Faltan herramientas"
[ -z "$(git status --porcelain)" ] || fail "Hay cambios locales"
run git fetch "$REMOTE" main "$BRANCH"
[ "$(git rev-parse "$REMOTE/main")" = "$BASE" ] || fail "main cambio; abortar"
run git switch "$BRANCH"
run git pull --ff-only "$REMOTE" "$BRANCH"
[ -z "$(git status --porcelain)" ] || fail "Directorio alterado"
[ "$(git merge-base "$REMOTE/main" HEAD)" = "$BASE" ] || fail "Rama fuera de base"
run git diff --check "$REMOTE/main...HEAD"
run npm ci
run node scripts/test-kawmed-isolation-contract.mjs
run node scripts/test-ai-profile-assistant-contract.mjs
run node scripts/test-ai-profile-assistant-integration.mjs
run npm run build -w web
run npm run build -w app
run npx tsc --noEmit -p api/tsconfig.json
run npx esbuild api/src/preview-free-entry.ts --bundle --platform=node --format=esm --target=node20 --external:cloudflare:* --outfile=/tmp/kawmed-production-api-check.mjs
SCHEMA="$(cd api && npx wrangler d1 execute intap_db --remote --config wrangler.toml --json --command "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('medical_profiles','medical_access_codes','medical_sponsor_masters');")"
if echo "$SCHEMA" | grep -Eq '"name"[[:space:]]*:[[:space:]]*"medical_'; then fail "Esquema KawMed parcialmente o totalmente presente. Detener para recuperación segura."; fi
mkdir -p "$HOME/kawmed-db-production-backups"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP="$HOME/kawmed-db-production-backups/intap_db_before_kawmed_$STAMP.sql"
echo "▶ Respaldo remoto: $BACKUP"
(cd api && npx wrangler d1 export intap_db --remote --config wrangler.toml --output "$BACKUP")
[ -s "$BACKUP" ] || fail "Respaldo ausente o vacio"
(cd "$(dirname "$BACKUP")" && shasum -a 256 "$(basename "$BACKUP")" > "$(basename "$BACKUP").sha256")
MIGRATIONS=(0090_kawmed_medical_profiles_v1.sql 0091_kawmed_insurance_exclusions.sql 0092_kawmed_shared_appointments.sql 0093_kawmed_medical_appointment_reasons.sql 0094_kawmed_private_sponsorship.sql 0095_kawmed_access_codes_programs.sql 0096_kawmed_representatives_traceability.sql 0097_kawmed_master_multiaccount.sql 0098_kawmed_accepted_insurances.sql 0099_kawmed_master_public_profile.sql 0150_kawmed_appearance_v2.sql)
for file in "${MIGRATIONS[@]}"; do
  [ -f "api/migrations/$file" ] || fail "Migracion ausente: $file"
  if grep -Eq "kawmed_demo_laura_mendez|kawmed_ins_ex_1|kawmed_ins_accept_1" "api/migrations/$file"; then fail "Demo fixture prohibido: $file"; fi
  echo "▶ D1 remoto: $file"
  (cd api && npx wrangler d1 execute intap_db --remote --config wrangler.toml --file "migrations/$file")
done
POST="$(cd api && npx wrangler d1 execute intap_db --remote --config wrangler.toml --json --command "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('medical_profiles','medical_access_codes','medical_sponsor_programs','medical_sponsor_masters','medical_profile_appearance');")"
for t in medical_profiles medical_access_codes medical_sponsor_programs medical_sponsor_masters medical_profile_appearance; do echo "$POST" | grep -q "\"$t\"" || fail "Falta tabla $t"; done
echo "▶ Worker API"
(cd api && npx wrangler deploy --config wrangler.toml)
CODE="$(curl -sSL -o /tmp/kawmed-health.json -w "%{http_code}" https://api.intaprd.com/api/health)"
[ "$CODE" = 200 ] && grep -q '"ok":true' /tmp/kawmed-health.json || fail "Health API fallo"
echo "▶ Web Pages"
run npx wrangler pages deploy web/dist --project-name intap-link --branch main
echo "▶ App Pages"
run npx wrangler pages deploy app/dist --project-name intap-web2 --branch main
for url in https://intaprd.com/api/health https://app.intaprd.com/api/health https://app.intaprd.com/admin/login https://app.intaprd.com/admin/medical https://app.intaprd.com/admin/sponsor; do
 code="$(curl -sSL -o /dev/null -w "%{http_code}" "$url" || true)"
 [ "$code" = 200 ] || fail "$url -> $code"
 echo "✓ $url -> $code"
done
[ "$(git ls-remote "$REMOTE" refs/heads/main | cut -f1)" = "$BASE" ] || fail "main cambio antes de publicar commit"
run git push "$REMOTE" HEAD:main
TAG="prod-kawmed-only-$(date -u +%Y%m%dT%H%M%SZ)"
run git tag "$TAG"
run git push "$REMOTE" "$TAG"
echo "✓ Deploy completado, SHA: $(git rev-parse HEAD), tag: $TAG, backup: $BACKUP"
echo "Validar flujos autenticados de KawMed independiente y patrocinado."
