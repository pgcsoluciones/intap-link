#!/usr/bin/env bash
set -euo pipefail
[[ "${KAWVO_OWNER_CONTEXT_DIAGNOSTIC_APPROVED:-}" == "SI" ]] || { echo "Falta aprobación del diagnóstico API"; exit 1; }
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
cd "$ROOT"
[[ -z "$(git status --porcelain)" ]] || { echo "Hay cambios locales; abortando"; exit 1; }
git fetch github fix/sponsored-owner-context-denial-diagnostic-2026-11-01
git switch fix/sponsored-owner-context-denial-diagnostic-2026-11-01
git pull --ff-only github fix/sponsored-owner-context-denial-diagnostic-2026-11-01
git merge-base --is-ancestor ee466727 HEAD
git diff --check ee466727..HEAD
while IFS= read -r file; do
  case "$file" in
    api/src/sponsored-appointments.ts|scripts/test-sponsored-owner-context-denial-2026-11-01.mjs|scripts/run-prod-sponsored-owner-context-diagnostic-2026-11-01.sh) ;;
    *) echo "Cambio no autorizado: $file"; exit 1 ;;
  esac
done < <(git diff --name-only ee466727..HEAD)
node scripts/test-sponsored-owner-context-denial-2026-11-01.mjs
node scripts/test-intapcard-active-account-contract.mjs
node scripts/test-sponsored-publish-readback-contract.mjs
node scripts/test-sponsored-single-publish-handler-2026-10-29.mjs
(cd api && npx tsc --noEmit && npx wrangler deploy --config wrangler.toml --dry-run)
echo "Pruebas y verificación de compilación API correctas."
(cd api && npm run deploy:production)
echo "Diagnóstico API desplegado. Sin migraciones ni cambios App/Web."
echo "Abrir con Master DAPSA seleccionado: https://app.intaprd.com/api/v1/me/sponsored-profile/appointments/public-context?username=dapsa"
echo "Compartir únicamente el campo code, o confirmar ok:true/is_owner:true. No copiar otros datos."
