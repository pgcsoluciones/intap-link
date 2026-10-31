#!/usr/bin/env bash
set -euo pipefail
[[ "${KAWVO_SPONSORED_LOADING_APPROVED:-}" == "SI" ]] || { echo "Se requiere aprobación"; exit 1; }
cd "$HOME/Desktop/intap-link-universal-bilingual-audit"
[[ -z "$(git status --porcelain)" ]] || { echo "Hay modificaciones locales. No desplegar."; exit 1; }
git fetch github fix/sponsored-dashboard-loading-state-2026-10-31
git switch fix/sponsored-dashboard-loading-state-2026-10-31
git pull --ff-only github fix/sponsored-dashboard-loading-state-2026-10-31
git merge-base --is-ancestor 91f2ef55 HEAD
git diff --check 91f2ef55..HEAD
while IFS= read -r p; do
  case "$p" in
    app/src/components/admin/sponsored/SponsoredDashboard.tsx|scripts/test-sponsored-dashboard-loading-2026-10-31.mjs|scripts/run-prod-sponsored-dashboard-loading-2026-10-31.sh) ;;
    *) echo "Archivo fuera del alcance App: $p"; exit 1 ;;
  esac
done < <(git diff --name-only 91f2ef55..HEAD)
node scripts/test-sponsored-dashboard-loading-2026-10-31.mjs
node scripts/test-sponsored-publish-readback-contract.mjs
node scripts/test-kawvo-publication-regression-contract.mjs
node scripts/test-intapcard-active-account-contract.mjs
npm run build -w app
asset="$(grep -Eo '/assets/index-[A-Za-z0-9_-]+\\.js' app/dist/index.html | head -1)"
[[ -n "$asset" ]] || exit 1
expected="$(shasum -a 256 "app/dist$asset" | awk '{print $1}')"
npx wrangler pages deploy app/dist --project-name intap-web2 --branch main
verified=0
for i in 1 2 3 4 5 6; do
  html="$(curl -fsSL --max-time 25 https://app.intaprd.com/ || true)"
  if [[ "$html" == *"$asset"* ]]; then
    actual="$(curl -fsSL --max-time 25 "https://app.intaprd.com$asset" | shasum -a 256 | awk '{print $1}')" || actual=""
    if [[ "$actual" == "$expected" ]]; then verified=1; break; fi
  fi
  sleep 5
done
[[ "$verified" == 1 ]] || { echo "App desplegada pero sin verificación completa; no repetir sin diagnóstico.";exit 1; }
echo "APP DESPLEGADA Y VERIFICADA: $asset"
echo "Verificar publicación + recarga sin pantalla vacía. API, D1 y Web sin cambios."
