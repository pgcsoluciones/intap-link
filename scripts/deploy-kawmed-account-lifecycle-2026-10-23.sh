#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
fail(){ echo "ERROR: $*" >&2; exit 1; }
run(){ echo "▶ $*"; "$@"; }
BRANCH=feature/kawmed-account-lifecycle-2026-10-23
BASE=876fc9b2952a8066f123857ea4304719fb5c80fc
REMOTE=github
echo "KAWMED CUENTA: suspender, reactivar y eliminar / API + App"
[ -z "$(git status --porcelain)" ] || fail "Hay cambios locales; guardar antes del despliegue"
run git fetch "$REMOTE" main "$BRANCH"
[ "$(git rev-parse "$REMOTE/main")" = "$BASE" ] || fail "main cambió: revisar antes de publicar"
run git switch "$BRANCH"
run git pull --ff-only "$REMOTE" "$BRANCH"
[ "$(git merge-base "$REMOTE/main" HEAD)" = "$BASE" ] || fail "Base incorrecta"
run git diff --check "$REMOTE/main...HEAD"
for p in $(git diff --name-only "$REMOTE/main...HEAD"); do case "$p" in api/src/medical-profile-owner.ts|app/src/components/admin/medical/MedicalDashboard.tsx|scripts/test-kawmed-isolation-contract.mjs|scripts/deploy-kawmed-account-lifecycle-2026-10-23.sh) ;; *) fail "Fuera del alcance: $p" ;; esac; done
run npm ci
run node scripts/test-kawmed-isolation-contract.mjs
run npx tsc --noEmit -p api/tsconfig.json
run npm run build -w app
run npx esbuild api/src/preview-free-entry.ts --bundle --platform=node --format=esm --target=node20 --external:cloudflare:* --outfile=/tmp/kawmed-lifecycle-api.mjs
echo "▶ Deploy API (sin cambios de esquema ni migraciones)"
(cd api && npx wrangler deploy --config wrangler.toml)
CODE="$(curl -sSL -o /tmp/kawmed-lifecycle-health.json -w "%{http_code}" https://api.intaprd.com/api/health)"
[ "$CODE" = 200 ] && grep -q '"ok":true' /tmp/kawmed-lifecycle-health.json || fail "Fallo de health API"
UNAUTH="$(curl -sSL -o /dev/null -w "%{http_code}" -X POST https://api.intaprd.com/api/v1/me/medical-profile/delete-account || true)"
[ "$UNAUTH" = 401 ] || fail "Eliminar cuenta debe exigir sesión: $UNAUTH"
echo "▶ Deploy App únicamente"
run npx wrangler pages deploy app/dist --project-name intap-web2 --branch main
for url in https://app.intaprd.com/admin/medical https://app.intaprd.com/admin/login https://app.intaprd.com/admin/sponsor/kawmed; do code="$(curl -sSL -o /dev/null -w "%{http_code}" "$url" || true)"; [ "$code" = 200 ] || fail "$url: HTTP $code"; done
[ "$(git ls-remote "$REMOTE" refs/heads/main | cut -f1)" = "$BASE" ] || fail "main cambió antes del push"
run git push "$REMOTE" HEAD:main
TAG="prod-kawmed-lifecycle-$(date -u +%Y%m%dT%H%M%SZ)"
run git tag "$TAG"
run git push "$REMOTE" "$TAG"
echo "✓ Deploy KawMed cuenta finalizado: $(git rev-parse HEAD) tag=$TAG"
echo "No se ejecutaron eliminaciones; requieren confirmación dentro del panel de cada cuenta."
