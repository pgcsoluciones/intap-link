#!/usr/bin/env bash
# Hotfix visual de identificador físico: Web pública + App, sin D1, Worker o R2.
set -euo pipefail
[[ "${KAWVO_WELCOME_PROD_APPROVED:-}" == "SI" ]] || { echo "No autorizado"; exit 1; }
cd "$HOME/Desktop/intap-link-universal-bilingual-audit"
[[ -z "$(git status --porcelain)" ]] || { echo "Hay cambios locales"; exit 1; }
git fetch github release/reconcile-approved-2026-10-29 main
git switch release/reconcile-approved-2026-10-29
git pull --ff-only github release/reconcile-approved-2026-10-29
git merge-base --is-ancestor c45d3495 HEAD || exit 1
git diff --check c45d3495..HEAD
while IFS= read -r p;do case "$p" in
web/src/components/sponsored/SponsoredAwareArtifactResolver.tsx|app/src/components/admin/SuperAdminSponsors.tsx|scripts/test-sponsored-physical-welcome-contract.mjs|scripts/run-production-sponsored-welcome-2026-10-29.sh) ;;
*) echo "Archivo inesperado: $p";exit 1;; esac;done < <(git diff --name-only c45d3495..HEAD)
LOG="$HOME/intap-release-logs/kawvo-sponsored-welcome-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$LOG"
git rev-parse HEAD | tee "$LOG/sha.txt"
node scripts/test-sponsored-physical-welcome-contract.mjs
node scripts/test-nfc-physical-identifier-release.mjs
node scripts/test-sponsor-commercial-contract.mjs
npm run build -w app
npm run build -w web
APP="$(grep -Eo '/assets/index-[A-Za-z0-9_-]+\.js' app/dist/index.html | head -1)"
WEB="$(grep -Eo '/assets/index-[A-Za-z0-9_-]+\.js' web/dist/index.html | head -1)"
[[ -n "$APP" && -n "$WEB" ]] || { echo "Bundle no identificado"; exit 1; }
echo "Deploy Web pública intap-link"
npx wrangler pages deploy web/dist --project-name intap-link --branch main 2>&1 | tee "$LOG/web.txt"
echo "Deploy App intap-web2"
npx wrangler pages deploy app/dist --project-name intap-web2 --branch main 2>&1 | tee "$LOG/app.txt"
for spec in "WEB|https://intaprd.com|web/dist|$WEB" "APP|https://app.intaprd.com|app/dist|$APP";do
 IFS="|" read -r label origin folder asset <<< "$spec"
 expected="$(shasum -a 256 "$folder$asset" | awk '{print $1}')"
 ok=0
 for n in 1 2 3 4 5 6;do
  html="$(curl -fsSL --max-time 25 "$origin/" || true)"
  if [[ "$html" == *"$asset"* ]];then
   got="$(curl -fsSL --max-time 25 "$origin$asset" | shasum -a 256 | awk '{print $1}')" || got=""
   if [[ "$got" == "$expected" ]];then ok=1;break;fi
  fi
  sleep 5
 done
 [[ "$ok" == 1 ]] || { echo "$label NO verificado tras deploy; no repetir automáticamente"; exit 1; }
 echo "$label $asset checksum OK" | tee -a "$LOG/verification.txt"
done
for url in https://intaprd.com/l/IHLVLVDME7X https://app.intaprd.com/admin/login https://api.intaprd.com/api/health;do
 status="$(curl -L -sS --max-time 25 -o /dev/null -w '%{http_code}' "$url" || true)"
 echo "$url HTTP $status" | tee -a "$LOG/verification.txt"
done
echo "Web/App servidos desde bundles correctos. Falta prueba humana del escaneo en navegador."
echo "$LOG"
