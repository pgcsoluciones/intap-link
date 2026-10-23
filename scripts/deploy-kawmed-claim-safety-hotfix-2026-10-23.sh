#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
fail(){ echo "ERROR: $*" >&2; exit 1; }
run(){ echo "▶ $*"; "$@"; }
BRANCH="hotfix/kawmed-claim-account-safety-2026-10-23"
BASE="adf4f29e5aad08cc29ebbce18533149869467ac4"
REMOTE=github
echo "KAWMED HOTFIX: CUENTAS, CONFIRMACION Y LOGIN (SOLO API + APP)"
[ -z "$(git status --porcelain)" ] || fail "Hay cambios locales pendientes"
run git fetch "$REMOTE" main "$BRANCH"
[ "$(git rev-parse "$REMOTE/main")" = "$BASE" ] || fail "main cambio; reconciliar antes de desplegar"
run git switch "$BRANCH"
run git pull --ff-only "$REMOTE" "$BRANCH"
[ -z "$(git status --porcelain)" ] || fail "Rama con archivos modificados"
[ "$(git merge-base "$REMOTE/main" HEAD)" = "$BASE" ] || fail "Base inesperada"
run git diff --check "$REMOTE/main...HEAD"
for changed in $(git diff --name-only "$REMOTE/main...HEAD"); do
  case "$changed" in
    api/src/medical-access-codes.ts|api/src/account-home-route.ts|app/src/components/admin/KawMedClaim.tsx|app/src/components/admin/KawMedMasterClaim.tsx|app/src/components/admin/AdminLogin.tsx|app/src/components/admin/AuthCallback.tsx|scripts/test-kawmed-isolation-contract.mjs|scripts/deploy-kawmed-claim-safety-hotfix-2026-10-23.sh) ;;
    *) fail "Archivo ajeno a KawMed: $changed" ;;
  esac
done
run npm ci
run node scripts/test-kawmed-isolation-contract.mjs
run node scripts/test-ai-profile-assistant-contract.mjs
run npx esbuild api/src/preview-free-entry.ts --bundle --platform=node --format=esm --target=node20 --external:cloudflare:* --outfile=/tmp/kawvo-ai-api.mjs
run node scripts/test-ai-profile-assistant-integration.mjs
run npx tsc --noEmit -p api/tsconfig.json
run npm run build -w app
echo "▶ Solo despliegue API - sin migraciones D1"
(cd api && npx wrangler deploy --config wrangler.toml)
API_CODE="$(curl -sSL -o /tmp/kawmed-claim-health.json -w "%{http_code}" https://api.intaprd.com/api/health)"
[ "$API_CODE" = "200" ] && grep -q '"ok":true' /tmp/kawmed-claim-health.json || fail "API health incorrecta"
UNAUTH_CODE="$(curl -sSL -o /dev/null -w "%{http_code}" https://api.intaprd.com/api/v1/me/kawmed/claim-check/MED-ABC-123 || true)"
[ "$UNAUTH_CODE" = "401" ] || fail "La API MED debe exigir autenticacion: $UNAUTH_CODE"
echo "▶ Solo despliegue Admin App - Web sin modificaciones"
run npx wrangler pages deploy app/dist --project-name intap-web2 --branch main
for url in https://app.intaprd.com/admin/login https://app.intaprd.com/claim/kawmed https://app.intaprd.com/claim/kawmed-master https://app.intaprd.com/admin/medical https://app.intaprd.com/admin/sponsor/kawmed; do
  code="$(curl -sSL -o /dev/null -w "%{http_code}" "$url" || true)"
  [ "$code" = "200" ] || fail "$url devolvio $code"
  echo "✓ $url -> HTTP 200"
done
[ "$(git ls-remote "$REMOTE" refs/heads/main | cut -f1)" = "$BASE" ] || fail "main se movio: abortar push"
run git push "$REMOTE" HEAD:main
TAG="prod-kawmed-claim-safety-$(date -u +%Y%m%dT%H%M%SZ)"
run git tag "$TAG"
run git push "$REMOTE" "$TAG"
echo "✓ KAWMED HOTFIX DEPLOY TERMINADO"
echo "SHA: $(git rev-parse HEAD) / TAG: $TAG"
echo "Verificar manualmente: MED independiente, MED patrocinado Master, login, cambio de cuenta y confirmacion; no consumir codigos de prueba reales."
