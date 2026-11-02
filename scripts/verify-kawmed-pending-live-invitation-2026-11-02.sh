#!/usr/bin/env bash
# KawMed #134 — QA only. No deployments, D1 writes or production changes.
set -euo pipefail
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="fix/kawmed-live-invitation-pending-activation-2026-11-02"
BASE="444f3da79a85a87baa739f1eafac87891607885d"
cd "$ROOT"
[[ -z "$(git status --porcelain)" ]] || { echo "Hay cambios locales. No continuar."; exit 1; }
git fetch github "$BRANCH"
git switch "$BRANCH"
git pull --ff-only github "$BRANCH"
git merge-base --is-ancestor "$BASE" HEAD
git diff --check "$BASE"..HEAD
while IFS= read -r file; do
  case "$file" in
    api/src/kawmed-live-guest.ts|scripts/test-kawmed-pending-live-invitation-2026-11-02.mjs|scripts/verify-kawmed-pending-live-invitation-2026-11-02.sh) ;;
    *) echo "Archivo fuera de alcance: $file"; exit 1 ;;
  esac
done < <(git diff --name-only "$BASE"..HEAD)
[[ "$(git diff --name-only "$BASE"..HEAD -- api)" == "api/src/kawmed-live-guest.ts" ]] || {
  echo "Cambio en API fuera de alcance"; exit 1;
}
[[ -z "$(git diff --name-only "$BASE"..HEAD -- web app)" ]] || {
  echo "Se modificó App/Web inesperadamente."; exit 1;
}
printf "===== Pruebas de invitación y seguridad =====\n"
node scripts/test-kawmed-pending-live-invitation-2026-11-02.mjs
node scripts/test-kawmed-live-guest-contract.mjs
node scripts/test-kawmed-demo-invitations-contract.mjs
node scripts/test-kawmed-isolation-contract.mjs
node scripts/test-intapcard-active-account-contract.mjs
printf "===== Compilación TS y Worker dry-run, ambos ambientes =====\n"
(cd api && npx --no-install tsc --noEmit)
(cd api && npx --no-install wrangler deploy --config wrangler.preview.toml --dry-run)
(cd api && npx --no-install wrangler deploy --config wrangler.toml --dry-run)
printf "QA KAWMED APROBADA. No se desplegó ni se alteraron D1, App, Web o API remota.\n"
