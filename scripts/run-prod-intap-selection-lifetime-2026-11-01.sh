#!/usr/bin/env bash
set -euo pipefail
[[ "${KAWVO_SELECTION_LIFETIME_APPROVED:-}" == "SI" ]] || { echo "Falta aprobación para desplegar API"; exit 1; }
cd "$HOME/Desktop/intap-link-universal-bilingual-audit"
[[ -z "$(git status --porcelain)" ]] || { echo "Hay cambios locales sin registrar. Abortando."; exit 1; }
git fetch github fix/intap-selection-session-lifetime-2026-11-01
git switch fix/intap-selection-session-lifetime-2026-11-01
git pull --ff-only github fix/intap-selection-session-lifetime-2026-11-01
git merge-base --is-ancestor 951d9976 HEAD
git diff --check 951d9976..HEAD
while IFS= read -r p; do
  case "$p" in
    api/src/intap-active-account.ts|scripts/test-intap-selection-session-lifetime-2026-11-01.mjs|scripts/run-prod-intap-selection-lifetime-2026-11-01.sh) ;;
    *) echo "Fuera del alcance: $p"; exit 1 ;;
  esac
done < <(git diff --name-only 951d9976..HEAD)
node scripts/test-intap-selection-session-lifetime-2026-11-01.mjs
node scripts/test-intapcard-active-account-contract.mjs
node scripts/test-sponsored-owner-context-denial-2026-11-01.mjs
node scripts/test-sponsored-single-publish-handler-2026-10-29.mjs
node scripts/test-sponsored-publish-readback-contract.mjs
(cd api && npx tsc --noEmit && npx wrangler deploy --config wrangler.toml --dry-run)
(cd api && npm run deploy:production)
echo "API PRODUCCIÓN DESPLEGADA. D1, App, Web y Preview SIN CAMBIOS."
echo "Selecciona otra vez DAPSA Master desde /admin/accounts (necesario porque la cookie anterior expiró)."
echo "Abre el perfil público /p/dapsa y verifica la barra; si persiste error, reporta únicamente code."
