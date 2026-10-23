#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
fail(){ echo "ERROR: $*" >&2; exit 1; }
run(){ echo "▶ $*"; "$@"; }
REMOTE=github
BRANCH=feature/kawmed-header-publication-controls-2026-10-23
BASE=c4051b250f8dbbb9e944a430480c3856bd2b0392
echo "KAWMED: Vista previa / Publicar / Despublicar · solo API y App"
[ -z "$(git status --porcelain)" ] || fail "Hay cambios locales pendientes"
run git fetch "$REMOTE" main "$BRANCH"
[ "$(git rev-parse "$REMOTE/main")" = "$BASE" ] || fail "main cambió; reconciliar antes de publicar"
run git switch "$BRANCH"
run git pull --ff-only "$REMOTE" "$BRANCH"
[ "$(git merge-base "$REMOTE/main" HEAD)" = "$BASE" ] || fail "Rama fuera de base"
run git diff --check "$REMOTE/main...HEAD"
for p in $(git diff --name-only "$REMOTE/main...HEAD"); do case "$p" in api/src/medical-profile-owner.ts|app/src/components/admin/medical/MedicalDashboard.tsx|scripts/deploy-kawmed-header-controls-2026-10-23.sh) ;; *) fail "Archivo fuera de alcance: $p" ;; esac; done
run npm ci
run node scripts/test-kawmed-isolation-contract.mjs
run npx tsc --noEmit -p api/tsconfig.json
run npm run build -w app
run npx esbuild api/src/preview-free-entry.ts --bundle --platform=node --format=esm --target=node20 --external:cloudflare:* --outfile=/tmp/kawmed-header-api.mjs
echo "▶ Publicación API: sin migraciones ni cambios de estructura"
(cd api && npx wrangler deploy --config wrangler.toml)
HEALTH="$(curl -sSL -o /tmp/kawmed-header-health.json -w "%{http_code}" https://api.intaprd.com/api/health)"
[ "$HEALTH" = 200 ] && grep -q '"ok":true' /tmp/kawmed-header-health.json || fail "API health incorrecta"
UNAUTH="$(curl -sSL -o /dev/null -w "%{http_code}" -X POST https://api.intaprd.com/api/v1/me/medical-profile/publication || true)"
[ "$UNAUTH" = 401 ] || fail "Publicación requiere sesión ($UNAUTH)"
echo "▶ App Cloudflare Pages"
run npx wrangler pages deploy app/dist --project-name intap-web2 --branch main
for u in https://app.intaprd.com/admin/medical https://app.intaprd.com/admin/login; do code="$(curl -sSL -o /dev/null -w "%{http_code}" "$u")"; [ "$code" = 200 ] || fail "$u: $code"; done
[ "$(git ls-remote "$REMOTE" refs/heads/main | cut -f1)" = "$BASE" ] || fail "main cambió antes de integrar"
run git push "$REMOTE" HEAD:main
TAG="prod-kawmed-header-controls-$(date -u +%Y%m%dT%H%M%SZ)"
run git tag "$TAG"
run git push "$REMOTE" "$TAG"
echo "✓ Deploy finalizado: $(git rev-parse HEAD) / tag: $TAG"
echo "Verificar manualmente: Vista previa privada, confirmación de publicación y despublicación."
