#!/usr/bin/env bash
# Solo App Pages Preview: no Worker, D1, Web pública ni Producción.
set -euo pipefail
cd "$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="fix/sponsored-confirm-publish-2026-10-29"
[[ -z "$(git status --porcelain)" ]] || { echo "DETENIDO: cambios locales"; exit 1; }
git fetch github "$BRANCH"
git switch "$BRANCH"
git pull --ff-only github "$BRANCH"
git diff --check
node scripts/test-kawvo-publication-regression-contract.mjs
node scripts/test-intapcard-active-account-contract.mjs
node scripts/test-sponsor-commercial-contract.mjs
npx tsc --noEmit -p api/tsconfig.json
npm run build:preview -w app
npx wrangler pages deploy app/dist --project-name intap-web2 --branch qa-sponsored-confirm-2026-10-29
echo "Preview publicado. Verificar perfil de prueba: publicar, despublicar, republicar y comparar status."
echo "Ningún servicio de Producción modificado."
