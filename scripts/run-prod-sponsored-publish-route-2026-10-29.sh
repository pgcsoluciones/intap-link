#!/usr/bin/env bash
set -euo pipefail
[[ "${SPONSORED_API_ROUTE_APPROVED:-}" == "SI" ]] || { echo "Aprobación requerida";exit 1; }
cd "$HOME/Desktop/intap-link-universal-bilingual-audit"
[[ -z "$(git status --porcelain)" ]] || { echo "Cambios locales detectados";exit 1; }
git fetch github fix/sponsored-publish-route-collision-2026-10-29
git switch fix/sponsored-publish-route-collision-2026-10-29
git pull --ff-only github fix/sponsored-publish-route-collision-2026-10-29
git merge-base --is-ancestor 5ebfb09a HEAD
git diff --check 5ebfb09a..HEAD
while IFS= read -r p;do case "$p" in
api/src/sponsored-owner-flow.ts|api/src/sponsored-profiles.ts|scripts/test-sponsored-single-publish-handler-2026-10-29.mjs|scripts/test-sponsored-profile-contract.mjs|scripts/run-prod-sponsored-publish-route-2026-10-29.sh) ;;
*) echo "Fuera de alcance: $p";exit 1;;esac;done < <(git diff --name-only 5ebfb09a..HEAD)
node scripts/test-sponsored-single-publish-handler-2026-10-29.mjs
node scripts/test-sponsored-publish-readback-contract.mjs
node scripts/test-sponsored-profile-contract.mjs
(cd api && npx tsc --noEmit && npx wrangler deploy --config wrangler.toml --dry-run)
(cd api && npm run deploy:production)
echo "API Worker desplegado. Verificar publicación solo con perfiles de prueba; no repetir deploy si se produce un error."
