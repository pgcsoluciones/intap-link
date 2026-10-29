#!/usr/bin/env bash
set -euo pipefail
[[ "${SPONSORED_PUBLISH_VERIFY_APPROVED:-}" == "SI" ]] || { echo "Aprobación requerida"; exit 1; }
cd "$HOME/Desktop/intap-link-universal-bilingual-audit"
[[ -z "$(git status --porcelain)" ]] || { echo "Hay cambios locales";exit 1; }
git fetch github fix/sponsored-publish-verify-2026-10-29
git switch fix/sponsored-publish-verify-2026-10-29
git pull --ff-only github fix/sponsored-publish-verify-2026-10-29
git merge-base --is-ancestor fcb4bdcc HEAD
git diff --check fcb4bdcc..HEAD
while IFS= read -r p;do case "$p" in
app/src/components/admin/sponsored/SponsoredDashboard.tsx|scripts/test-sponsored-publish-readback-contract.mjs|docs/handoffs/QA_PUBLICACION_PATROCINADA_RECONCILIACION_2026-10-29.md|scripts/run-prod-sponsored-publish-verify-2026-10-29.sh) ;;
*) echo "Fuera de alcance: $p";exit 1;;esac;done < <(git diff --name-only fcb4bdcc..HEAD)
node scripts/test-sponsored-publish-readback-contract.mjs
node scripts/test-kawvo-publication-regression-contract.mjs
npm run build -w app
asset="$(grep -Eo '/assets/index-[A-Za-z0-9_-]+\.js' app/dist/index.html | head -1)"
[[ -n "$asset" ]] || exit 1
expected="$(shasum -a 256 "app/dist$asset" | awk '{print $1}')"
npx wrangler pages deploy app/dist --project-name intap-web2 --branch main
verified=0
for i in 1 2 3 4 5 6;do
 html="$(curl -fsSL --max-time 25 https://app.intaprd.com/ || true)"
 if [[ "$html" == *"$asset"* ]];then
  actual="$(curl -fsSL --max-time 25 "https://app.intaprd.com$asset" | shasum -a 256 | awk '{print $1}')" || actual=""
  if [[ "$actual" == "$expected" ]];then verified=1;break;fi
 fi
 sleep 5
done
[[ "$verified" == 1 ]] || { echo "Deploy hecho, verificación pendiente. No repetir.";exit 1; }
echo "App publicada y verificada: $asset"
