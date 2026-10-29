#!/usr/bin/env bash
# QA aislado del fix publicación patrocinado. Solo App Pages Preview; sin Worker, D1, R2 o Producción.
set -euo pipefail
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawvo-sponsor-commercial-controls-2026-10-27"
cd "$ROOT"
[[ -z "$(git status --porcelain)" ]] || { echo "ERROR: árbol local con cambios. No se modifica."; exit 1; }
git fetch github "$BRANCH"
git switch "$BRANCH"
git pull --ff-only github "$BRANCH"
[[ "$(git branch --show-current)" == "$BRANCH" ]] || exit 1
git diff --check
node scripts/test-kawvo-publication-regression-contract.mjs
node scripts/test-intapcard-active-account-contract.mjs
npx tsc --noEmit -p api/tsconfig.json
npm run build:preview -w app
echo "Publicando exclusivamente App Preview en Pages intap-web2, rama QA aislada."
npx wrangler pages deploy app/dist --project-name intap-web2 --branch qa-sponsored-publication-2026-10-29
echo "QA Preview listo. Verificar con sesión de prueba: guardar > publicar > despublicar > republicar."
echo "Sin migraciones, sin Worker, sin Web pública ni cambios en Producción."
