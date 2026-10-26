#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="qa/intapcard-kawmed-combined-preview-2026-10-24"
DEPLOY_BRANCH="qa-intapcard-kawmed-combined-preview-2026-10-24"
PREVIEW_CONFIG="api/wrangler.preview.toml"
APP_PROJECT="intap-web2"
LOG_DIR="${TMPDIR:-/tmp}/intapcard-kawmed-integrated-$(date +%Y%m%d-%H%M%S)"
ORIGINAL_CONFIG=""

fail(){ echo "ERROR: $*" >&2; exit 1; }
run(){ echo "▶ $*"; "$@"; }
restore_preview_config(){
  if [[ -n "$ORIGINAL_CONFIG" && -f "$ORIGINAL_CONFIG" ]]; then
    cp "$ORIGINAL_CONFIG" "$PREVIEW_CONFIG"
    rm -f "$ORIGINAL_CONFIG"
  fi
}
trap restore_preview_config EXIT

cd "$ROOT" || fail "No se encontró el checkout local"
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || fail "Hay cambios rastreados sin guardar"
run git fetch github main "$BRANCH"
if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  run git switch "$BRANCH"
else
  run git switch --track -c "$BRANCH" "github/$BRANCH"
fi
run git pull --ff-only github "$BRANCH"
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || fail "Checkout con modificaciones locales"
git merge-base --is-ancestor github/main HEAD || fail "La rama no incluye el main actual; revisar antes de publicar"

echo "▶ Validando alcance del PR"
while IFS= read -r path; do
  [[ -z "$path" ]] && continue
  case "$path" in
    .github/workflows/quality.yml|api/wrangler.preview.toml|api/src/account-home-route.ts|api/src/index.ts|api/src/intap-active-account.ts|api/src/medical-access-codes.ts|api/src/medical-appointments.ts|api/src/medical-profile-owner.ts|api/src/medical-appointments.ts|api/src/sponsored-account-controls.ts|api/src/sponsored-profile-scope.ts|api/src/routes/medical-profile.ts|api/src/sponsored-multiprofile-access.ts|web/src/components/medical-profile/KawMedProfile.tsx|web/src/components/medical-profile/KawMedProfile.css|web/src/components/medical-profile/types.ts|web/src/components/appointments/AppointmentOwnerBar.tsx|app/src/App.tsx|app/src/components/admin/AdminGuard.tsx|app/src/components/admin/AuthCallback.tsx|app/src/components/admin/IntapcardAccountSelector.tsx|app/src/components/admin/sponsored/SponsorKawMed.tsx|app/src/components/admin/sponsored/SponsorDashboard.tsx|app/src/components/admin/KawMedClaim.tsx|app/src/components/admin/SuperAdminKawMed.tsx|app/src/components/admin/medical/MedicalDashboard.tsx|app/src/components/admin/sponsored/SponsoredResumeGate.tsx|scripts/run-preview-intapcard-multiaccount-2026-10-24.sh|scripts/run-preview-kawmed-med-codes-ui-2026-10-23.sh|scripts/run-preview-intapcard-kawmed-integrated-2026-10-24.sh|scripts/run-production-intapcard-kawmed-2026-10-25.sh|scripts/run-preview-kawmed-public-web-2026-10-25.sh|scripts/test-kawmed-web-preview-route-contract.mjs|scripts/test-intapcard-active-account-contract.mjs|scripts/test-intapcard-multiaccount-contract.mjs|scripts/test-intapcard-kawmed-integrated-contract.mjs|scripts/test-kawmed-code-accordion-contract.mjs|scripts/test-kawmed-demo-invitations-contract.mjs) ;;
    *) fail "Archivo fuera de alcance: $path" ;;
  esac
done < <(git diff --name-only github/main...HEAD)

run git diff --check github/main...HEAD
run npm ci
run bash -n scripts/run-preview-intapcard-kawmed-integrated-2026-10-24.sh
run node scripts/test-intapcard-active-account-contract.mjs
run node scripts/test-intapcard-multiaccount-contract.mjs
run node scripts/test-intapcard-kawmed-integrated-contract.mjs
run node scripts/test-kawmed-code-accordion-contract.mjs
run node scripts/test-kawmed-isolation-contract.mjs
run node scripts/test-kawmed-demo-invitations-contract.mjs
run npx tsc --noEmit -p api/tsconfig.json
run npm run build:preview -w app

mkdir -p "$LOG_DIR"
echo "▶ Publicando App integrada en Cloudflare Pages Preview; sin migraciones de D1 ni R2"
npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch "$DEPLOY_BRANCH" 2>&1 | tee "$LOG_DIR/app-pages.log"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$LOG_DIR/app-pages.log" | tail -1)"
[[ -n "$APP_ORIGIN" ]] || fail "No se identificó el origen inmutable de App Pages"

ORIGINAL_CONFIG="$(mktemp)"
cp "$PREVIEW_CONFIG" "$ORIGINAL_CONFIG"
APP_ORIGIN="$APP_ORIGIN" python3 - <<'PY'
from pathlib import Path
import os, re
p = Path('api/wrangler.preview.toml')
text = p.read_text()
new, count = re.subn(r'^APP_PAGES_ORIGIN = ".*"$', 'APP_PAGES_ORIGIN = "' + os.environ['APP_ORIGIN'] + '"', text, count=1, flags=re.M)
if count != 1:
    raise SystemExit('Falta APP_PAGES_ORIGIN en Wrangler Preview')
p.write_text(new)
PY

echo "▶ Actualizando solo el front door del Worker Preview"
(
  cd api
  npx wrangler deploy --config wrangler.preview.toml --dry-run
  npx wrangler deploy --config wrangler.preview.toml
) 2>&1 | tee "$LOG_DIR/worker-preview.log"

restore_preview_config
ORIGINAL_CONFIG=""
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || fail "El runner dejó modificaciones rastreadas"
status="$(curl -sSL -o /dev/null -w '%{http_code}' 'https://app.preview.intaprd.com/admin/accounts')"
[[ "$status" = "200" ]] || fail "La ruta de Preview respondió HTTP $status"
for endpoint in /api/v1/me/intapcard/accounts /api/v1/sponsor/accounts /api/v1/me/home-route; do
  unauth="$(curl -sSL -o /dev/null -w '%{http_code}' "https://app.preview.intaprd.com$endpoint")"
  [[ "$unauth" = "401" ]] || fail "$endpoint sin sesión debería devolver 401, respondió $unauth"
done
code_med="$(curl -sSL -o /dev/null -w '%{http_code}' 'https://app.preview.intaprd.com/superadmin/kawmed')"
[[ "$code_med" = "200" ]] || fail "SuperAdmin KawMed Preview no está accesible (HTTP $code_med)"

echo "✓ Preview selector: https://app.preview.intaprd.com/admin/accounts"
echo "✓ Preview SuperAdmin MED: https://app.preview.intaprd.com/superadmin/kawmed"
echo "✓ SHA: $(git rev-parse --short HEAD)"
echo "✓ Logs: $LOG_DIR"
echo "✓ Producción no modificada. Falta QA visual y funcional autenticado."
