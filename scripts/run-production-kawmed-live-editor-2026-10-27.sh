#!/usr/bin/env bash
# KawMed invitado real · publicación productiva controlada.
# preflight: sin escrituras Cloudflare; deploy: requiere merge a main y aprobación explícita.
set -euo pipefail
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
MODE="${1:-preflight}"
BRANCH="feature/kawmed-live-guest-editor-2026-10-27"
LOG_DIR="$HOME/intap-release-logs/kawmed-live-prod-$(date -u +%Y%m%dT%H%M%SZ)"
fail(){ echo "ERROR: $*" >&2; exit 1; }
[[ "$MODE" == preflight || "$MODE" == deploy ]] || fail "Usar preflight o deploy"
cd "$ROOT" || fail "Checkout ausente"
[[ -z "$(git status --porcelain)" ]] || fail "Cambios locales; abortando"
git fetch github main "$BRANCH"
if [[ "$MODE" == preflight ]]; then
  git switch "$BRANCH"
  git pull --ff-only github "$BRANCH"
  git merge-base --is-ancestor github/main HEAD || fail "El candidato no contiene main"
  DIFF_BASE=github/main
else
  [[ "${KAWMED_PRODUCTION_APPROVED:-}" == "KAWMED_PR125_QA_APROBADO" ]] || fail "Falta autorización explícita"
  git switch main
  git pull --ff-only github main
  [[ "$(git rev-parse HEAD)" == "$(git rev-parse github/main)" ]] || fail "main diverge"
  git merge-base --is-ancestor github/"$BRANCH" HEAD || fail "La rama QA no está integrada en main. NO publicar."
  DIFF_BASE="$(git merge-base HEAD github/"$BRANCH")"
fi
git diff --check
[[ -z "$(git status --porcelain)" ]] || fail "Checkout sucio"
node scripts/test-kawmed-live-guest-contract.mjs
node scripts/test-kawmed-claim-resume-ux-contract.mjs
node scripts/test-intapcard-active-account-contract.mjs
node scripts/test-kawmed-demo-invitations-contract.mjs
node scripts/test-kawmed-isolation-contract.mjs
node scripts/test-intapcard-kawmed-integrated-contract.mjs
npx tsc --noEmit -p api/tsconfig.json
env VITE_API_URL=https://api.intaprd.com VITE_APP_URL=https://app.intaprd.com VITE_PUBLIC_ORIGIN=https://intaprd.com VITE_ENVIRONMENT=production npm run build -w web
env VITE_API_URL=https://api.intaprd.com VITE_WEB_URL=https://intaprd.com VITE_ENVIRONMENT=production npm run build -w app
grep -RlF https://api.intaprd.com app/dist/assets --include='*.js' >/dev/null || fail "App no apunta a API Producción"
grep -RlF https://api.intaprd.com web/dist/assets --include='*.js' >/dev/null || fail "Web no apunta a API Producción"
(cd api && npx wrangler deploy --config wrangler.toml --dry-run)
echo "✓ Preflight local y Worker dry-run correctos"
if [[ "$MODE" == preflight ]]; then echo "✓ PREPARADO. Sin escrituras a Producción."; exit 0; fi
[[ "$(git ls-remote github refs/heads/main | cut -f1)" == "$(git rev-parse HEAD)" ]] || fail "main cambió: abortar"
mkdir -p "$LOG_DIR"
echo "▶ Backup completo D1 Producción"
(cd api && npx wrangler d1 export intap_db --remote --config wrangler.toml --output="$LOG_DIR/intap_db_before_kawmed_pr125.sql")
[[ -s "$LOG_DIR/intap_db_before_kawmed_pr125.sql" ]] || fail "Backup vacío"
echo "▶ Migración 0152 aditiva en Producción"
(cd api && npx wrangler d1 execute intap_db --remote --config wrangler.toml --file=../api/migrations/0152_kawmed_live_guest_access.sql)
echo "▶ API Producción"
(cd api && npx wrangler deploy --config wrangler.toml 2>&1 | tee "$LOG_DIR/api-deploy.log")
HTTP="$(curl -sSL --max-time 30 -o "$LOG_DIR/health.json" -w '%{http_code}' https://api.intaprd.com/api/health)"
[[ "$HTTP" == 200 ]] || fail "API health HTTP $HTTP; no publicar Web ni App"
echo "▶ Web Producción"
npx wrangler pages deploy web/dist --project-name intap-link --branch main 2>&1 | tee "$LOG_DIR/web-deploy.log"
echo "▶ App Producción"
npx wrangler pages deploy app/dist --project-name intap-web2 --branch main 2>&1 | tee "$LOG_DIR/app-deploy.log"
for url in https://intaprd.com/m/med-intapcard https://app.intaprd.com/admin/medical; do
  HTTP="$(curl -sSL --max-time 30 -o /dev/null -w '%{http_code}' "$url")"
  [[ "$HTTP" == 200 ]] || fail "Smoke HTTP $HTTP: $url"
done
echo "✓ PRODUCCIÓN PUBLICADA: $(git rev-parse HEAD)"
echo "✓ Respaldo: $LOG_DIR/intap_db_before_kawmed_pr125.sql"
echo "✓ Logs: $LOG_DIR"
