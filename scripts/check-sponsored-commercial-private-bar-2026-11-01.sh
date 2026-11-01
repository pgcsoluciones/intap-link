#!/usr/bin/env bash
set -euo pipefail
cd "$HOME/Desktop/intap-link-universal-bilingual-audit"
[[ -z "$(git status --porcelain)" ]] || { echo "Cambios locales detectados: no continuar."; exit 1; }
git fetch github fix/sponsored-commercial-private-public-bar-2026-11-01
git switch fix/sponsored-commercial-private-public-bar-2026-11-01
git pull --ff-only github fix/sponsored-commercial-private-public-bar-2026-11-01
git merge-base --is-ancestor 951d9976 HEAD
git diff --check 951d9976..HEAD
while IFS= read -r file; do
 case "$file" in
  api/src/sponsor-commercial-sales.ts|web/src/components/sponsored/SponsoredProfile.tsx|web/src/components/sponsored/SponsoredCommercialOwnerBar.tsx|scripts/test-sponsored-commercial-private-bar-2026-11-01.mjs|scripts/check-sponsored-commercial-private-bar-2026-11-01.sh) ;;
  *) echo "Archivo fuera del alcance: $file"; exit 1 ;;
 esac
done < <(git diff --name-only 951d9976..HEAD)
node scripts/test-sponsored-commercial-private-bar-2026-11-01.mjs
node scripts/test-intapcard-active-account-contract.mjs
node scripts/test-sponsored-owner-context-denial-2026-11-01.mjs
node scripts/test-sponsored-single-publish-handler-2026-10-29.mjs
npm run web:build:preview
(cd api && npx tsc --noEmit && npx wrangler deploy --config wrangler.preview.toml --dry-run)
echo "CÓDIGO PREPARADO Y VALIDADO PARA QA PREVIEW; NO SE DESPLEGÓ PRODUCCIÓN NI PREVIEW."
echo "Mantener Master DAPSA sin vendedor ficticio: necesita asignación/configuración comercial explícita."
