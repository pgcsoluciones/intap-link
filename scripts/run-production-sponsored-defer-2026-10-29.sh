#!/usr/bin/env bash
set -euo pipefail
[[ "${KAWVO_FIX_ACTIVATION_APPROVED:-}" == "SI" ]] || { echo "Falta aprobación del hotfix";exit 1; }
cd "$HOME/Desktop/intap-link-universal-bilingual-audit"
[[ -z "$(git status --porcelain)" ]] || { echo "Cambios locales: detenido";exit 1; }
git fetch github fix/sponsored-activation-defer-loop-2026-10-29
git switch fix/sponsored-activation-defer-loop-2026-10-29
git pull --ff-only github fix/sponsored-activation-defer-loop-2026-10-29
git merge-base --is-ancestor 76de144a HEAD || exit 1
git diff --check 76de144a..HEAD
while IFS= read -r p;do case "$p" in
app/src/components/admin/sponsored/SponsoredActivation.tsx|scripts/test-sponsored-activation-defer-contract.mjs|scripts/run-production-sponsored-defer-2026-10-29.sh) ;;
*) echo "Cambio fuera de alcance: $p";exit 1;; esac;done < <(git diff --name-only 76de144a..HEAD)
LOG="$HOME/intap-release-logs/kawvo-sponsored-defer-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$LOG"
git rev-parse HEAD | tee "$LOG/commit.txt"
node scripts/test-sponsored-activation-defer-contract.mjs
node scripts/test-kawvo-publication-regression-contract.mjs
node scripts/test-intapcard-active-account-contract.mjs
npm run build -w app
ASSET="$(grep -Eo '/assets/index-[A-Za-z0-9_-]+\.js' app/dist/index.html | head -1)"
[[ -n "$ASSET" ]] || exit 1
EXPECTED="$(shasum -a 256 "app/dist$ASSET" | awk '{print $1}')"
npx wrangler pages deploy app/dist --project-name intap-web2 --branch main 2>&1 | tee "$LOG/pages.txt"
FOUND=0
for n in 1 2 3 4 5 6;do
 HTML="$(curl -fsSL --max-time 25 https://app.intaprd.com/ || true)"
 if [[ "$HTML" == *"$ASSET"* ]];then
  ACTUAL="$(curl -fsSL --max-time 25 "https://app.intaprd.com$ASSET" | shasum -a 256 | awk '{print $1}')" || ACTUAL=""
  if [[ "$ACTUAL" == "$EXPECTED" ]];then FOUND=1;break;fi
 fi
 sleep 5
done
[[ "$FOUND" == 1 ]] || { echo "DEPLOY EJECUTADO, pero bundle no confirmado. No repetir deploy sin diagnóstico";exit 1; }
echo "OK: nuevo bundle exacto servido en app.intaprd.com"
echo "Verificación funcional pendiente: abrir código nuevo, activar luego, volver con enlace y activar voluntariamente."
echo "No se modificaron API, D1, R2 ni Web."
echo "$LOG"
