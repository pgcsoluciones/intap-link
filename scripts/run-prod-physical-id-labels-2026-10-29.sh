#!/usr/bin/env bash
set -euo pipefail
[[ "${KAWVO_LABELS_PROD_APPROVED:-}" == "SI" ]] || { echo "Falta aprobación";exit 1; }
cd "$HOME/Desktop/intap-link-universal-bilingual-audit"
[[ -z "$(git status --porcelain)" ]] || { echo "Hay cambios locales";exit 1; }
git fetch github fix/physical-id-terminology-2026-10-29
git switch fix/physical-id-terminology-2026-10-29
git pull --ff-only github fix/physical-id-terminology-2026-10-29
git merge-base --is-ancestor 4e838bb2 HEAD
git diff --check 4e838bb2..HEAD
while IFS= read -r p;do case "$p" in
app/src/components/admin/SuperAdminKawMed.tsx|app/src/components/admin/SuperAdminSponsors.tsx|web/src/components/sponsored/SponsoredAwareArtifactResolver.tsx|scripts/test-med-physical-display-read-contract.mjs|scripts/test-physical-id-ui-labels-2026-10-29.mjs|scripts/run-prod-physical-id-labels-2026-10-29.sh) ;;
*) echo "Fuera de alcance: $p";exit 1;; esac;done < <(git diff --name-only 4e838bb2..HEAD)
node scripts/test-med-physical-display-read-contract.mjs
node scripts/test-physical-id-ui-labels-2026-10-29.mjs
node scripts/test-sponsored-physical-welcome-contract.mjs
npm run build -w app
npm run build -w web
for target in "app|app/dist|intap-web2|https://app.intaprd.com" "web|web/dist|intap-link|https://intaprd.com";do
 IFS='|' read -r label folder project domain <<< "$target"
 asset="$(grep -Eo '/assets/index-[A-Za-z0-9_-]+\.js' "$folder/index.html" | head -1)"
 [[ -n "$asset" ]] || exit 1
 expected="$(shasum -a 256 "$folder$asset" | awk '{print $1}')"
 npx wrangler pages deploy "$folder" --project-name "$project" --branch main
 verified=0
 for i in 1 2 3 4 5 6;do
  html="$(curl -fsSL --max-time 25 "$domain/" || true)"
  if [[ "$html" == *"$asset"* ]];then
    actual="$(curl -fsSL --max-time 25 "$domain$asset" | shasum -a 256 | awk '{print $1}')" || actual=""
    if [[ "$actual" == "$expected" ]];then verified=1;break;fi
  fi
  sleep 5
 done
 [[ "$verified" == 1 ]] || { echo "$label: desplegado, no verificado: NO repetir deploy sin diagnóstico";exit 1; }
 echo "$label: verificado $asset"
done
echo "Solo App y Web. Sin cambios Worker, D1, NFC ni migraciones."
