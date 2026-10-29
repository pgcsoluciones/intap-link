#!/usr/bin/env bash
set -euo pipefail
[[ "${KAWMED_IDENTITY_RELEASE_APPROVED:-}" == "SI" ]] || { echo "Falta aprobación explícita"; exit 1; }
cd "$HOME/Desktop/intap-link-universal-bilingual-audit"
[[ -z "$(git status --porcelain)" ]] || { echo "Cambios locales sin guardar: no continuar"; exit 1; }
git fetch github fix/kawmed-scan-identification-first-2026-10-29
git switch fix/kawmed-scan-identification-first-2026-10-29
git pull --ff-only github fix/kawmed-scan-identification-first-2026-10-29
git merge-base --is-ancestor 9ee71fef HEAD
git diff --check 9ee71fef..HEAD
while IFS= read -r p; do
  case "$p" in
    app/src/components/admin/KawMedClaim.tsx|scripts/test-kawmed-scan-identity-first-contract.mjs|scripts/run-prod-kawmed-identification-first-2026-10-29.sh) ;;
    *) echo "Fuera de alcance: $p"; exit 1 ;;
  esac
done < <(git diff --name-only 9ee71fef..HEAD)
node scripts/test-kawmed-scan-identity-first-contract.mjs
node scripts/test-med-physical-display-read-contract.mjs
npm run build -w app
asset="$(grep -Eo '/assets/index-[A-Za-z0-9_-]+\.js' app/dist/index.html | head -1)"
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
[[ "$verified" == 1 ]] || { echo "App desplegada pero no verificada. No repetir sin diagnóstico."; exit 1; }
echo "APP PUBLICADA Y VERIFICADA: $asset"
echo "Comprobar identificación M0A9/MED-6B2-RRK, después conflicto de cuenta, sin activar."
