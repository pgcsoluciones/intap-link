#!/usr/bin/env bash
set -euo pipefail
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
cd "$ROOT"

echo '============================================================'
echo 'KAWVO LINK · PANEL PRINCIPAL · GUÍA → RECORRIDO · PREVIEW'
echo '============================================================'

git fetch github feature/free-guided-tour-v1 main
git checkout feature/free-guided-tour-v1
git pull --ff-only github feature/free-guided-tour-v1
python3 scripts/apply-free-dashboard-relabel-recorrido-2026-09-13.py
git diff --check
npm run build:preview -w app
git add app/src/components/admin/free/FreeDashboard.tsx
git commit -m 'fix: rename dashboard guide button to recorrido' || true
git push github feature/free-guided-tour-v1
bash scripts/run-preview-free-guided-tour-v1-auth-2026-09-12.sh

echo '============================================================'
echo '✓ PANEL PRINCIPAL: RECORRIDO LISTO EN PREVIEW'
echo 'Producción NO tocada'
echo '============================================================'
