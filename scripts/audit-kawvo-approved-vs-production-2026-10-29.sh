#!/usr/bin/env bash
# Diagnóstico de diferencias versionadas; no despliega, no migra, no hace merge.
set -euo pipefail
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
RELEASE="0994d9e5463c3f05588ff782b8fdac07299cbab8"
BRANCH="feature/kawvo-sponsor-commercial-controls-2026-10-27"
cd "$ROOT" || exit 1
if [[ -n "$(git status --porcelain)" ]]; then echo "ERROR: hay cambios locales. No continuar."; exit 1; fi
git fetch github main "$BRANCH"
git switch "$BRANCH"
git pull --ff-only github "$BRANCH"
git merge-base --is-ancestor "$RELEASE" HEAD || { echo "ERROR: release no es ancestro"; exit 1; }
OUT="$HOME/intap-release-logs/audit-approved-vs-production-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$OUT"
{
 echo "=== IDENTIDAD ==="
 git rev-parse HEAD
 git rev-parse github/main
 git rev-parse "$RELEASE"
 echo "=== DIFERENCIAS MAIN -> RELEASE ==="
 git diff --name-status github/main "$RELEASE"
 echo "=== DIFERENCIAS RELEASE -> CANDIDATO ==="
 git diff --name-status "$RELEASE" HEAD
 echo "=== COMMITS NO LANZADOS ==="
 git log --format='%h %s' "$RELEASE"..HEAD
 echo "=== APP POST-RELEASE ==="
 git diff --stat "$RELEASE" HEAD -- app/src/components/admin/free/FreeDashboard.tsx app/src/components/admin/medical/MedicalDashboard.tsx app/src/components/admin/sponsored/SponsoredDashboard.tsx
 echo "=== NOTA ==="
 echo "Las diferencias de código NO prueban cuál bundle está sirviendo Cloudflare."
} | tee "$OUT/comparacion.txt"
echo "=== CONTRATOS ===" | tee "$OUT/validacion.txt"
node scripts/test-kawvo-publication-regression-contract.mjs 2>&1 | tee -a "$OUT/validacion.txt"
node scripts/test-intapcard-active-account-contract.mjs 2>&1 | tee -a "$OUT/validacion.txt"
node scripts/test-sponsor-commercial-contract.mjs 2>&1 | tee -a "$OUT/validacion.txt"
npx tsc --noEmit -p api/tsconfig.json 2>&1 | tee -a "$OUT/validacion.txt"
npm run build:preview -w app 2>&1 | tee -a "$OUT/validacion.txt"
npm run build:preview -w web 2>&1 | tee -a "$OUT/validacion.txt"
echo "=== SMOKE PÚBLICO NO AUTENTICADO ===" | tee "$OUT/health.txt"
for url in https://api.intaprd.com/api/health https://app.intaprd.com/api/health https://intaprd.com/api/health; do
  printf '%s ' "$url" | tee -a "$OUT/health.txt"
  curl -sS -L --max-time 15 -o /dev/null -w '%{http_code}\n' "$url" | tee -a "$OUT/health.txt"
done
echo "Auditoría completada: $OUT"
echo "NO se cambió Producción, Preview, D1, R2 ni Worker."
