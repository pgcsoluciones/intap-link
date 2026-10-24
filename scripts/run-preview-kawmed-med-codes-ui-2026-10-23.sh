#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawmed-med-codes-accordion-pagination-2026-10-23"
DEPLOY_BRANCH="feature-kawmed-med-codes-accordion-pagination-2026-10-23"
PREVIEW_CONFIG="api/wrangler.preview.toml"
APP_PROJECT="intap-web2"
LOG_DIR="${TMPDIR:-/tmp}/kawmed-med-code-ui-preview-$(date +%Y%m%d-%H%M%S)"
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
run git switch "$BRANCH"
run git pull --ff-only github "$BRANCH"
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || fail "Checkout con modificaciones locales"
git merge-base --is-ancestor github/main HEAD || fail "La rama no incluye el main actual; revisar antes de publicar"

echo "▶ Validando alcance del PR"
while IFS= read -r path; do
  [[ -z "$path" ]] && continue
  case "$path" in
    app/src/components/admin/SuperAdminKawMed.tsx|scripts/test-kawmed-code-accordion-contract.mjs|scripts/test-kawmed-demo-invitations-contract.mjs|scripts/run-preview-kawmed-med-codes-ui-2026-10-23.sh|.github/workflows/quality.yml) ;;
    *) fail "Archivo fuera de alcance: $path" ;;
  esac
done < <(git diff --name-only github/main...HEAD)

run git diff --check github/main...HEAD
run npm ci
run node scripts/test-kawmed-code-accordion-contract.mjs
run node scripts/test-kawmed-isolation-contract.mjs
run node scripts/test-kawmed-demo-invitations-contract.mjs
run npm run build:preview -w app

mkdir -p "$LOG_DIR"
echo "▶ Publicando solo Admin App en Cloudflare Pages Preview"
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
status="$(curl -sSL -o /dev/null -w '%{http_code}' 'https://app.preview.intaprd.com/superadmin/kawmed')"
[[ "$status" = "200" ]] || fail "La ruta de Preview respondió HTTP $status"

echo "✓ Preview App: https://app.preview.intaprd.com/superadmin/kawmed"
echo "✓ SHA: $(git rev-parse --short HEAD)"
echo "✓ Logs: $LOG_DIR"
echo "✓ Producción no modificada. Falta QA visual y funcional autenticado."
