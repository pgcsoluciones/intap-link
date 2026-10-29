#!/usr/bin/env bash
# Kawvo sponsor commercial · SOLO Preview. Nunca toca Producción.
set -euo pipefail
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawvo-sponsor-commercial-controls-2026-10-27"
CONFIG="api/wrangler.preview.toml"
LOG="$HOME/intap-release-logs/sponsor-commercial-preview-$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP=""
fail(){ echo "ERROR: $*" >&2; exit 1; }
restore(){ if [[ -n "$BACKUP" && -f "$BACKUP" ]];then cp "$BACKUP" "$CONFIG";rm -f "$BACKUP";fi; }
trap restore EXIT
cd "$ROOT" || fail "Repositorio ausente"
[[ -z "$(git status --porcelain)" ]] || fail "Cambios locales sin guardar"
git fetch github main "$BRANCH"
git switch "$BRANCH"
git pull --ff-only github "$BRANCH"
git merge-base --is-ancestor github/main HEAD || fail "Rama no contiene main"
git diff --check github/main...HEAD
while IFS= read -r file;do
 [[ -z "$file" ]]&&continue
 case "$file" in
  api/migrations/0153_sponsor_sales_representatives.sql|api/migrations/0154_artifact_display_identifiers.sql|api/src/sponsored-code-generation.ts|api/src/medical-access-codes.ts|api/src/index.ts|api/src/scan-status.ts|api/src/sponsored-profiles.ts|api/src/preview-free-entry.ts|api/src/sponsored-scan.ts|api/src/sponsor-commercial-sales.ts|app/src/components/admin/SuperAdminSponsors.tsx|web/src/components/ArtifactLinkResolver.tsx|app/src/components/admin/sponsored/SponsorDashboard.tsx|app/src/components/admin/sponsored/SponsorCommercialSellers.tsx|app/src/components/admin/sponsored/SponsoredDashboard.tsx|scripts/run-preview-sponsor-commercial-2026-10-27.sh|scripts/test-nfc-physical-identifier-release.mjs|scripts/test-sponsor-commercial-contract.mjs|scripts/test-intapcard-active-account-contract.mjs) ;;
  *) fail "Archivo fuera de alcance: $file";;
 esac
done < <(git diff --name-only github/main...HEAD)
echo "▶ Pruebas y build"
node scripts/test-sponsor-commercial-contract.mjs
node scripts/test-nfc-physical-identifier-release.mjs
node scripts/test-intapcard-active-account-contract.mjs
node scripts/test-intapcard-kawmed-integrated-contract.mjs
npx tsc --noEmit -p api/tsconfig.json
npm run build:preview -w web
npm run build:preview -w app
mkdir -p "$LOG"
echo "▶ Respaldo completo D1 Preview"
(cd api && npx wrangler d1 export intap_db_preview --remote --config wrangler.preview.toml --output="$LOG/intap_db_preview_before_sponsor_commercial.sql")
[[ -s "$LOG/intap_db_preview_before_sponsor_commercial.sql" ]] || fail "No hay respaldo válido"
echo "▶ Migración aditiva 0153 SOLO Preview"
(cd api && npx wrangler d1 execute intap_db_preview --remote --config wrangler.preview.toml --file=migrations/0153_sponsor_sales_representatives.sql)
echo "▶ Migración aditiva 0154 SOLO Preview"
(cd api && npx wrangler d1 execute intap_db_preview --remote --config wrangler.preview.toml --file=migrations/0154_artifact_display_identifiers.sql)
echo "▶ Web de escaneo Preview (rama aislada)"
npx wrangler pages deploy web/dist --project-name intap-web2 --branch qa-kawvo-sponsor-scan-2026-10-28 2>&1 | tee "$LOG/web-pages.log"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$LOG/web-pages.log" | tail -1)"
[[ -n "$WEB_ORIGIN" ]] || fail "No se obtuvo URL de Web"
echo "▶ App Pages Preview"
npx wrangler pages deploy app/dist --project-name intap-web2 --branch qa-intapcard-kawmed-combined-preview-2026-10-24 2>&1 | tee "$LOG/app-pages.log"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$LOG/app-pages.log" | tail -1)"
[[ -n "$APP_ORIGIN" ]] || fail "No se obtuvo URL de App"
HTTP="$(curl -sSL --max-time 30 -o /dev/null -w '%{http_code}' "$APP_ORIGIN/")"
[[ "$HTTP" == 200 ]] || fail "App Preview raíz HTTP $HTTP"
LOGIN_HTTP="$(curl -sSL --max-time 30 -o /dev/null -w '%{http_code}' "$APP_ORIGIN/admin/login" || true)"
if [[ "$LOGIN_HTTP" != 200 ]]; then echo "⚠️ Enlace directo /admin/login HTTP $LOGIN_HTTP; comprobar rutas SPA durante QA (la raíz responde 200)."; fi
BACKUP="$(mktemp)"
cp "$CONFIG" "$BACKUP"
APP_ORIGIN="$APP_ORIGIN" WEB_ORIGIN="$WEB_ORIGIN" python3 - <<'PY'
from pathlib import Path
import os,re
p=Path('api/wrangler.preview.toml')
s=p.read_text()
for key in ('APP_PAGES_ORIGIN','WEB_PAGES_ORIGIN'):
    value=os.environ['APP_ORIGIN' if key=='APP_PAGES_ORIGIN' else 'WEB_ORIGIN']
    s,n=re.subn(r'^'+key+r' = ".*"$',key+' = "'+value+'"',s,count=1,flags=re.M)
    if n!=1:raise SystemExit(key+' no encontrado')
p.write_text(s)
PY
echo "▶ API Worker Preview"
(cd api && npx wrangler deploy --config wrangler.preview.toml --dry-run && npx wrangler deploy --config wrangler.preview.toml) 2>&1 | tee "$LOG/api.log"
restore
BACKUP=""
[[ -z "$(git status --porcelain)" ]] || fail "Configuración no restaurada"
echo "✓ Comercial Preview desplegado; Producción y KawMed sin cambios"
echo "✓ App: $APP_ORIGIN"
echo "✓ Web escaneo: $WEB_ORIGIN"
echo "✓ Backup: $LOG/intap_db_preview_before_sponsor_commercial.sql"
