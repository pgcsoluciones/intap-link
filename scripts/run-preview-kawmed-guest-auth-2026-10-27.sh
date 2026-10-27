#!/usr/bin/env bash
# KawMed Guest auth PR #124: Preview only. Does not run migrations.
set -euo pipefail
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="fix/kawmed-demo-guest-auth-return-2026-10-27"
CONFIG="api/wrangler.preview.toml"
APP_BRANCH="qa-intapcard-kawmed-combined-preview-2026-10-24"
LOG_DIR="${TMPDIR:-/tmp}/kawmed-guest-auth-preview-$(date +%Y%m%d-%H%M%S)"
BACKUP=""
fail(){ echo "ERROR: $*" >&2; exit 1; }
restore(){ if [[ -n "$BACKUP" && -f "$BACKUP" ]]; then cp "$BACKUP" "$CONFIG"; rm -f "$BACKUP"; fi; }
trap restore EXIT
cd "$ROOT" || fail "No existe checkout local"
[[ -z "$(git status --porcelain)" ]] || fail "Hay cambios locales"
git fetch github main "$BRANCH"
git switch "$BRANCH"
git pull --ff-only github "$BRANCH"
git merge-base --is-ancestor github/main HEAD || fail "La rama no incluye main actual"
git diff --check github/main...HEAD
while IFS= read -r file; do
  case "$file" in
    api/src/index.ts|api/src/kawmed-demo-invitations.ts|app/src/components/admin/AdminLogin.tsx|app/src/components/admin/AuthCallback.tsx|app/src/components/admin/medical/KawMedDemoGuest.tsx|app/src/components/admin/free/onboarding/FreeOnboardingWelcome.tsx|scripts/test-kawmed-demo-invitations-contract.mjs|scripts/run-preview-kawmed-guest-auth-2026-10-27.sh) ;;
    *) fail "Archivo fuera de alcance: $file" ;;
  esac
done < <(git diff --name-only github/main...HEAD)
node scripts/test-kawmed-demo-invitations-contract.mjs
node scripts/test-kawmed-isolation-contract.mjs
npx tsc --noEmit -p api/tsconfig.json
npm run build:preview -w app
mkdir -p "$LOG_DIR"
npx wrangler pages deploy app/dist --project-name intap-web2 --branch "$APP_BRANCH" 2>&1 | tee "$LOG_DIR/pages.log"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$LOG_DIR/pages.log" | tail -1)"
[[ -n "$APP_ORIGIN" ]] || fail "No se obtuvo URL inmutable de Pages"
HTTP="$(curl -sSL --max-time 30 -o "$LOG_DIR/app.html" -w '%{http_code}' "$APP_ORIGIN/admin/login")"
[[ "$HTTP" == 200 ]] || fail "App Pages Preview no responde: $HTTP"
BACKUP="$(mktemp)"
cp "$CONFIG" "$BACKUP"
APP_ORIGIN="$APP_ORIGIN" python3 - <<'PY'
from pathlib import Path
import os,re
p=Path('api/wrangler.preview.toml')
s=p.read_text()
s,n=re.subn(r'^APP_PAGES_ORIGIN = ".*"$','APP_PAGES_ORIGIN = "'+os.environ['APP_ORIGIN']+'"',s,count=1,flags=re.M)
if n!=1: raise SystemExit('APP_PAGES_ORIGIN not found')
p.write_text(s)
PY
(cd api && npx wrangler deploy --config wrangler.preview.toml --dry-run && npx wrangler deploy --config wrangler.preview.toml) 2>&1 | tee "$LOG_DIR/worker.log"
restore
BACKUP=""
[[ -z "$(git status --porcelain)" ]] || fail "Runner left modifications"
for route in /admin/login /superadmin/kawmed; do
  code="$(curl -sSL --max-time 30 -o /dev/null -w '%{http_code}' "https://app.preview.intaprd.com$route")"
  [[ "$code" == 200 ]] || fail "Preview $route HTTP $code"
done
unauth="$(curl -sSL --max-time 30 -o /dev/null -w '%{http_code}' -X POST https://app.preview.intaprd.com/api/v1/superadmin/kawmed/demo-invitations -H 'Content-Type: application/json' --data '{}')"
[[ "$unauth" == 401 || "$unauth" == 403 ]] || fail "Admin invitation endpoint improperly open: $unauth"
echo "✓ Guest auth Preview published; no migrations and no Production changes."
echo "✓ App: $APP_ORIGIN"
echo "✓ Logs: $LOG_DIR"
