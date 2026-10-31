#!/usr/bin/env bash
set -euo pipefail
[[ "${KAWVO_MASTER_TOOLBAR_APPROVED:-}" == "SI" ]] || { echo "Aprobación requerida para App"; exit 1; }
cd "$HOME/Desktop/intap-link-universal-bilingual-audit"
[[ -z "$(git status --porcelain)" ]] || { echo "Hay cambios locales; no desplegar."; exit 1; }
git fetch github fix/sponsored-master-profile-toolbar-2026-10-31
git switch fix/sponsored-master-profile-toolbar-2026-10-31
git pull --ff-only github fix/sponsored-master-profile-toolbar-2026-10-31
git merge-base --is-ancestor 71005035 HEAD
git diff --check 71005035..HEAD
while IFS= read -r p; do
  case "$p" in
    app/src/components/admin/sponsored/SponsoredDashboard.tsx|scripts/test-sponsored-master-toolbar-2026-10-31.mjs|scripts/test-kawvo-publication-regression-contract.mjs|scripts/run-prod-sponsored-master-toolbar-2026-10-31.sh) ;;
    *) echo "Fuera de alcance: $p"; exit 1 ;;
  esac
done < <(git diff --name-only 71005035..HEAD)
node scripts/test-sponsored-master-toolbar-2026-10-31.mjs
node scripts/test-sponsored-dashboard-loading-2026-10-31.mjs
node scripts/test-sponsored-publish-readback-contract.mjs
node scripts/test-kawvo-publication-regression-contract.mjs
node scripts/test-intapcard-active-account-contract.mjs
npm run build -w app
asset="$(grep -Eo '/assets/index-[A-Za-z0-9_-]+\.js' app/dist/index.html | head -1)"
[[ -n "$asset" ]] || { echo "Archivo JS principal no encontrado"; exit 1; }
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
[[ "$verified" == 1 ]] || { echo "Despliegue enviado, verificación pendiente; no repetir automáticamente."; exit 1; }
echo "APP MASTER VERIFICADA: $asset"
echo "Sin cambios en API, D1 ni Web. QA real pendiente: Master y multicuenta."
