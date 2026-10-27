#!/usr/bin/env bash
# KawMed live guest · Preview only, additive D1 migration 0152.
set -euo pipefail
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawmed-live-guest-editor-2026-10-27"
CONFIG="api/wrangler.preview.toml"
APP_BRANCH="qa-intapcard-kawmed-combined-preview-2026-10-24"
WEB_BRANCH="qa-kawmed-web-1025"
LOG_DIR="$HOME/intap-release-logs/kawmed-live-editor-preview-$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP=""
fail(){ echo "ERROR: $*" >&2; exit 1; }
restore(){ if [[ -n "$BACKUP" && -f "$BACKUP" ]]; then cp "$BACKUP" "$CONFIG"; rm -f "$BACKUP"; fi; }
trap restore EXIT
cd "$ROOT" || fail "Repositorio local no disponible"
[[ -z "$(git status --porcelain)" ]] || fail "Hay cambios locales; no desplegar"
git fetch github main "$BRANCH"
if git show-ref --verify --quiet "refs/heads/$BRANCH";then
 git switch "$BRANCH"
else
 git switch --track "github/$BRANCH"
fi
git pull --ff-only github "$BRANCH"
git merge-base --is-ancestor github/main HEAD || fail "Rama no incluye main actual"
git diff --check github/main...HEAD
echo "▶ Verificando que no se cambió Simular/Reclamar ni otros módulos"
while IFS= read -r file; do
 [[ -z "$file" ]] && continue
 case "$file" in
  api/migrations/0152_kawmed_live_guest_access.sql|api/src/kawmed-live-guest.ts|api/src/kawmed-demo-invitations.ts|api/src/sponsored-multiprofile-access.ts|api/src/medical-profile-owner.ts|api/src/medical-appointments.ts|web/src/components/appointments/AppointmentOwnerBar.tsx|api/src/index.ts|app/src/components/admin/KawMedClaim.tsx|app/src/components/admin/sponsored/SponsorKawMed.tsx|app/src/components/admin/medical/KawMedDemoGuest.tsx|app/src/components/admin/medical/MedicalDashboard.tsx|app/src/components/admin/SuperAdminKawMed.tsx|app/src/components/admin/free/onboarding/FreeOnboardingWelcome.tsx|app/src/components/admin/AdminLogin.tsx|app/src/components/admin/AuthCallback.tsx|app/src/lib/api.ts|app/src/App.tsx|scripts/test-kawmed-live-guest-contract.mjs|scripts/test-kawmed-claim-resume-ux-contract.mjs|scripts/test-kawmed-isolation-contract.mjs|scripts/test-intapcard-active-account-contract.mjs|scripts/test-kawmed-demo-invitations-contract.mjs|scripts/run-preview-kawmed-guest-auth-2026-10-27.sh|scripts/run-preview-kawmed-live-editor-2026-10-27.sh) ;;
  *) fail "Cambio fuera de alcance: $file" ;;
 esac
done < <(git diff --name-only github/main...HEAD)
if git diff --name-only github/main...HEAD | grep -E '^(package(-lock)?\.json)' >/dev/null; then
 fail "Dependencias o Web fuera de alcance"
fi
if git diff --name-only github/main...HEAD | grep '^api/migrations/' | grep -v '^api/migrations/0152_kawmed_live_guest_access\.sql$' >/dev/null; then
 fail "Migración fuera de alcance"
fi
echo "▶ Contratos"
node scripts/test-kawmed-live-guest-contract.mjs
node scripts/test-kawmed-claim-resume-ux-contract.mjs
node scripts/test-intapcard-active-account-contract.mjs
node scripts/test-kawmed-demo-invitations-contract.mjs
node scripts/test-kawmed-isolation-contract.mjs
npx tsc --noEmit -p api/tsconfig.json
npm run build:preview -w app
npm run build:preview -w web
mkdir -p "$LOG_DIR"
echo "▶ Respaldo completo D1 Preview previo a migración"
(cd api && npx wrangler d1 export intap_db_preview --remote --config wrangler.preview.toml --output="$LOG_DIR/intap_db_preview_before_live_guest.sql")
[[ -s "$LOG_DIR/intap_db_preview_before_live_guest.sql" ]] || fail "Backup D1 Preview falló"
echo "▶ Migración 0152 aditiva, solo Preview"
(cd api && npx wrangler d1 execute intap_db_preview --remote --config wrangler.preview.toml --file=migrations/0152_kawmed_live_guest_access.sql)
echo "▶ Pages Preview App y Web pública"
npx wrangler pages deploy web/dist --project-name intap-web2 --branch "$WEB_BRANCH" 2>&1 | tee "$LOG_DIR/web-pages.log"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$LOG_DIR/web-pages.log" | tail -1)"
[[ -n "$WEB_ORIGIN" ]] || fail "URL de Web pública no obtenida"
grep -Fq "https://qa-kawmed-web-1025.intap-web2.pages.dev" "$LOG_DIR/web-pages.log" || fail "Alias de Web no coincide"
npx wrangler pages deploy app/dist --project-name intap-web2 --branch "$APP_BRANCH" 2>&1 | tee "$LOG_DIR/pages.log"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$LOG_DIR/pages.log" | tail -1)"
[[ -n "$APP_ORIGIN" ]] || fail "URL de Pages no obtenida"
verify_pages(){
 local url="$1" target="$2" status=""
 for attempt in 1 2 3 4 5 6 7 8 9 10;do
   status="$(curl -sSL --max-time 30 -o "$target" -w '%{http_code}' "$url" || true)"
   if [[ "$status" == "200" ]] && grep -Eiq '<!doctype html|<html[[:space:]>]' "$target";then return 0;fi
   [[ "$attempt" == 10 ]] || sleep 5
 done
 fail "Pages no sirvió HTML correcto: $url HTTP $status"
}
verify_pages "$APP_ORIGIN/admin/login" "$LOG_DIR/app-check.html"
verify_pages "$WEB_ORIGIN/m/med-intapcard" "$LOG_DIR/web-check.html"
BACKUP="$(mktemp)"
cp "$CONFIG" "$BACKUP"
APP_ORIGIN="$APP_ORIGIN" WEB_ORIGIN="$WEB_ORIGIN" python3 - <<'PY'
from pathlib import Path
import os,re
p=Path('api/wrangler.preview.toml')
s=p.read_text()
for key,env in [('APP_PAGES_ORIGIN','APP_ORIGIN'),('WEB_PAGES_ORIGIN','WEB_ORIGIN')]:
 s,count=re.subn('^'+key+' = '+chr(34)+'.*'+chr(34)+'$',key+' = '+chr(34)+os.environ[env]+chr(34),s,count=1,flags=re.M)
 if count!=1:raise SystemExit(key+' no encontrado')
p.write_text(s)
PY
echo "▶ Worker API Preview"
(cd api && npx wrangler deploy --config wrangler.preview.toml --dry-run && npx wrangler deploy --config wrangler.preview.toml) 2>&1 | tee "$LOG_DIR/api.log"
restore
BACKUP=""
[[ -z "$(git status --porcelain)" ]] || fail "El runner dejó cambios locales"
for route in /admin/login /superadmin/kawmed; do
 HTTP="$(curl -sSL --max-time 30 -o /dev/null -w '%{http_code}' "https://app.preview.intaprd.com$route")"
 [[ "$HTTP" == 200 ]] || fail "Ruta Preview $route HTTP $HTTP"
done
HTTP="$(curl -sSL --max-time 30 -o /dev/null -w '%{http_code}' "https://app.preview.intaprd.com/api/v1/me/kawmed/live-access/i-00000000-0000-0000-0000-000000000000")"
[[ "$HTTP" == 401 ]] || fail "Acceso delegado no exige sesión: $HTTP"
echo "✓ Preview actualizado, sin cambios en Producción ni Simular/Reclamar"
echo "✓ App $APP_ORIGIN"
echo "✓ Web publicada $WEB_ORIGIN"
echo "✓ D1 backup: $LOG_DIR/intap_db_preview_before_live_guest.sql"
