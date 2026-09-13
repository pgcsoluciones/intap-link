#!/usr/bin/env bash
set -euo pipefail
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/free-guided-tour-v1"
cd "$ROOT" || exit 1

echo "============================================================"
echo "KAWVO LINK · MI CUENTA · RECORRIDO V3 · PREVIEW"
echo "============================================================"
echo "- separa Instalar app de Mis productos"
echo "- separa QR de transferencias"
echo "- separa Notificaciones de Cuotas de IA"
echo "- separa Recursos de Centro de ayuda"
echo "- producción NO se toca"
echo "============================================================"

git fetch github "$BRANCH" main
git checkout "$BRANCH"
git pull --ff-only github "$BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; echo "✗ Working tree no limpio"; exit 1; }

python3 scripts/apply-free-account-guided-tour-v3-2026-09-13.py
git diff --check

BASE_SHA="$(git merge-base HEAD github/main)"
CHANGED="$(git diff --name-only "$BASE_SHA...HEAD"; git diff --name-only)"
if echo "$CHANGED" | grep -Eq '^(api/src/|web/src/|functions/)'; then
  echo "✗ Cambio fuera del Admin App; abortado"
  exit 1
fi

npm run build:preview -w app

git add app/src/components/admin/free/FreeAccount.tsx
if ! git diff --cached --quiet; then
  git commit -m "fix: separate account guided tour concepts"
  git push github "$BRANCH"
fi

bash scripts/run-preview-free-guided-tour-v1-auth-2026-09-12.sh

echo "============================================================"
echo "✓ RECORRIDO MI CUENTA V3 LISTO EN PREVIEW"
echo "Prueba: https://app.preview.intaprd.com/admin/free/account"
echo "Producción NO tocada"
echo "============================================================"
