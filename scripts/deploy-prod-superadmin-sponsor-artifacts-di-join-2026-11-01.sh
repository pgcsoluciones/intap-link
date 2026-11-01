#!/usr/bin/env bash
# Producción: reparación exclusiva del listado de códigos patrocinados (#131).
# No modifica D1, App, Web ni Preview. Requiere autorización explícita.
set -euo pipefail
[[ "${KAWVO_SPONSOR_CODES_DEPLOY_APPROVED:-}" == "SI" ]] || {
  echo "Falta autorización explícita KAWVO_SPONSOR_CODES_DEPLOY_APPROVED=SI."
  exit 1
}
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
cd "$ROOT"
[[ -z "$(git status --porcelain)" ]] || { echo "Hay cambios locales: no desplegar."; exit 1; }
git fetch github fix/superadmin-sponsor-artifacts-di-join-2026-11-01
git switch fix/superadmin-sponsor-artifacts-di-join-2026-11-01
git pull --ff-only github fix/superadmin-sponsor-artifacts-di-join-2026-11-01
git merge-base --is-ancestor 951d9976aa00e87a03b9cc63c40c9d0e1257c187 HEAD
git diff --check 951d9976aa00e87a03b9cc63c40c9d0e1257c187..HEAD
while IFS= read -r path; do
  case "$path" in
    api/src/sponsored-profiles.ts|scripts/test-superadmin-sponsor-artifacts-di-join-2026-11-01.mjs|scripts/verify-superadmin-sponsor-artifacts-di-join-2026-11-01.sh|scripts/deploy-prod-superadmin-sponsor-artifacts-di-join-2026-11-01.sh) ;;
    *) echo "Archivo fuera del alcance autorizado: $path"; exit 1 ;;
  esac
done < <(git diff --name-only 951d9976aa00e87a03b9cc63c40c9d0e1257c187..HEAD)

EXPECTED_RUNTIME_DIFF=$(printf '1\t0\tapi/src/sponsored-profiles.ts')
ACTUAL_RUNTIME_DIFF=$(git diff --numstat 951d9976aa00e87a03b9cc63c40c9d0e1257c187..HEAD -- api/src/sponsored-profiles.ts)
[[ "$ACTUAL_RUNTIME_DIFF" == "$EXPECTED_RUNTIME_DIFF" ]] || {
  echo "Diferencia runtime inesperada. Esperada exactamente una línea agregada. Abortando."
  exit 1
}
node scripts/test-superadmin-sponsor-artifacts-di-join-2026-11-01.mjs
node scripts/test-sponsored-owner-context-denial-2026-11-01.mjs
(cd api && npx --no-install tsc --noEmit && npx --no-install wrangler deploy --config wrangler.toml --dry-run)
echo "Validaciones de despliegue API aprobadas. Publicando SOLO Worker API Producción..."
(cd api && npm run deploy:production)
echo "API PRODUCCIÓN DESPLEGADA. D1, App, Web y Preview sin cambios."
echo "QA MANUAL: https://app.intaprd.com/superadmin/sponsors"
echo "Abrir DAPSA > Códigos del patrocinador; verificar listado y ausencia de error HTTP 500."
echo "La barra Configuración/Agenda sigue pendiente en GitHub #130; este cambio NO la modifica."
