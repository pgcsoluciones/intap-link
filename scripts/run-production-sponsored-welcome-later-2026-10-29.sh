#!/usr/bin/env bash
set -euo pipefail
[[ "${KAWVO_WELCOME_LATER_APPROVED:-}" == "SI" ]] || exit 1
cd "$HOME/Desktop/intap-link-universal-bilingual-audit"
[[ -z "$(git status --porcelain)" ]] || exit 1
git fetch github fix/sponsored-welcome-activate-later-2026-10-29
git switch fix/sponsored-welcome-activate-later-2026-10-29
git pull --ff-only github fix/sponsored-welcome-activate-later-2026-10-29
git merge-base --is-ancestor 4915d66b HEAD || exit 1
git diff --check 4915d66b..HEAD
while IFS= read -r p;do case "$p" in
web/src/components/sponsored/SponsoredAwareArtifactResolver.tsx|scripts/test-sponsored-welcome-defer-contract.mjs|scripts/run-production-sponsored-welcome-later-2026-10-29.sh) ;;
*) echo "Archivo no permitido: $p";exit 1;; esac;done < <(git diff --name-only 4915d66b..HEAD)
node scripts/test-sponsored-welcome-defer-contract.mjs
npm run build -w web
ASSET="$(grep -Eo '/assets/index-[A-Za-z0-9_-]+\.js' web/dist/index.html | head -1)"
[[ -n "$ASSET" ]] || exit 1
EXPECTED="$(shasum -a 256 "web/dist$ASSET" | awk '{print $1}')"
npx wrangler pages deploy web/dist --project-name intap-link --branch main
OK=0
for i in 1 2 3 4 5 6;do
 HTML="$(curl -fsSL https://intaprd.com/ || true)"
 if [[ "$HTML" == *"$ASSET"* ]];then
  ACTUAL="$(curl -fsSL "https://intaprd.com$ASSET" | shasum -a 256 | awk '{print $1}')" || ACTUAL=""
  if [[ "$ACTUAL" == "$EXPECTED" ]];then OK=1;break;fi
 fi
 sleep 5
done
[[ "$OK" == 1 ]] || { echo "Web desplegada pero verificación pendiente. No repetir despliegue.";exit 1; }
echo "Web verificada. Probar Activar luego en bienvenida pública y en consentimiento."
