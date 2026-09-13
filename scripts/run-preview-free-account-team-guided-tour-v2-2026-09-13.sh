#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/free-guided-tour-v1"
cd "$ROOT" || exit 1

echo "============================================================"
echo "KAWVO LINK · RECORRIDOS MI CUENTA + TEAM · PREVIEW V2"
echo "============================================================"
echo "- producción NO se toca"
echo "- agrega recorrido en Mi cuenta"
echo "- agrega recorrido propio en Team"
echo "- CTA Crear mi primer Team"
echo "- Master define data variable"
echo "- corrige copy bancario/privacidad"
echo "============================================================"

git fetch github "$BRANCH" main
git checkout "$BRANCH"
git pull --ff-only github "$BRANCH"

if [ -n "$(git status --porcelain)" ]; then
  git status --short
  echo "✗ El árbol de trabajo no está limpio."
  exit 1
fi

python3 scripts/apply-free-account-team-guided-tour-v2-2026-09-13.py

git diff --check

CHANGED="$(git diff --name-only)"
echo "$CHANGED"
if echo "$CHANGED" | grep -Eq '^(api/src/|web/src/|functions/)'; then
  echo "✗ Cambios fuera de Admin App. Se cancela."
  exit 1
fi

npm run build:preview -w app

git add \
  app/src/components/admin/free/FreeGuidedTour.tsx \
  app/src/components/admin/free/FreeAccount.tsx \
  app/src/components/admin/free/FreeTeamCorporate.tsx

git commit -m "feat: expand guided tours to account and Team"
git push github "$BRANCH"

bash scripts/run-preview-free-guided-tour-v1-auth-2026-09-12.sh

echo "============================================================"
echo "✓ PREVIEW V2 LISTO"
echo "Prueba: https://app.preview.intaprd.com/admin/free"
echo "Luego: Mi cuenta → Recorrido"
echo "Y: Mi cuenta → Crear mi primer Team / Team → Recorrido"
echo "Producción NO tocada"
echo "============================================================"
