#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
cd "$ROOT"

echo "============================================================"
echo "KAWVO LINK · RECORRIDO FREE + BRANDING + OPTIMIZACIÓN · PRODUCCIÓN"
echo "============================================================"
echo "- despliega SOLO Admin App de producción"
echo "- no toca API, Web público, D1 ni R2 directamente"
echo "- incluye recorridos Dashboard / Mi cuenta / Team"
echo "- incluye wordmark Kawlink en paneles"
echo "- incluye optimización de imágenes en navegador"
echo "============================================================"

EXPECTED_BASE="e3179ca328e63b1e82ff041a7e6e67b4ca135133"

git fetch github main

git checkout main
git pull --ff-only github main

HEAD_SHA="$(git rev-parse HEAD)"
echo "Main SHA: $HEAD_SHA"

# Seguridad: esta liberación solo puede contener cambios en app/ y scripts/.
CHANGED="$(git diff --name-only "$EXPECTED_BASE"...HEAD)"
echo "▶ Verificación de alcance"
printf '%s\n' "$CHANGED"

if printf '%s\n' "$CHANGED" | grep -E '^(api/|web/)' >/dev/null; then
  echo "ERROR: se detectaron cambios fuera del Admin App. Se cancela producción."
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "ERROR: hay cambios locales sin guardar. Se cancela producción."
  git status --short
  exit 1
fi

echo "▶ Build Admin App producción"
npm run build -w app

echo "▶ Deploy Admin App producción → intap-web2 / main"
npx wrangler pages deploy app/dist --project-name intap-web2 --branch main

echo "▶ Verificación básica"
STATUS_LOGIN="$(curl -sS -o /dev/null -w '%{http_code}' https://app.intaprd.com/admin/login || true)"
STATUS_FREE="$(curl -sS -o /dev/null -w '%{http_code}' https://app.intaprd.com/admin/free || true)"

echo "app.intaprd.com/admin/login -> HTTP $STATUS_LOGIN"
echo "app.intaprd.com/admin/free  -> HTTP $STATUS_FREE"

if [[ "$STATUS_LOGIN" != "200" || "$STATUS_FREE" != "200" ]]; then
  echo "ERROR: verificación HTTP de producción falló."
  exit 1
fi

echo "============================================================"
echo "✓ RELEASE PRODUCCIÓN COMPLETADO"
echo "============================================================"
echo "Main SHA: $HEAD_SHA"
echo "Producción: https://app.intaprd.com/admin/free"
echo "API: no desplegada"
echo "Web público: no desplegado"
echo "D1/R2: no modificados por este runner"
echo "============================================================"
