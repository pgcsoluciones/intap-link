#!/usr/bin/env bash
# Kawvo sponsored commercial links #132 — API-only production release.
# Explicit approval required; changes neither App/Web/Preview nor D1 data/schema.
set -euo pipefail
[[ "${KAWVO_COMMERCIAL_API_DEPLOY_APPROVED:-}" == "SI" ]] || {
  echo "Se requiere aprobación: KAWVO_COMMERCIAL_API_DEPLOY_APPROVED=SI."
  exit 1
}
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/sponsored-owner-commercial-links-2026-11-02"
BASE="e230ee4d85f38b17e19c2ae92508d120ea8aad27"
cd "$ROOT"
[[ -z "$(git status --porcelain)" ]] || { echo "Hay cambios locales. No desplegar."; exit 1; }
git fetch github "$BRANCH"
git switch "$BRANCH"
git pull --ff-only github "$BRANCH"
git merge-base --is-ancestor "$BASE" HEAD
git diff --check "$BASE"..HEAD
while IFS= read -r file; do
  case "$file" in
    api/src/sponsored-commercial-links-core.ts|api/src/sponsored-appointments.ts|api/src/sponsor-commercial-sales.ts|scripts/test-sponsored-owner-commercial-links-2026-11-02.mjs|scripts/verify-sponsored-owner-commercial-links-2026-11-02.sh|scripts/deploy-production-sponsored-commercial-links-2026-11-02.sh) ;;
    *) echo "Archivo inesperado en la rama: $file"; exit 1 ;;
  esac
done < <(git diff --name-only "$BASE"..HEAD)
[[ -z "$(git diff --name-only "$BASE"..HEAD -- web app)" ]] || {
  echo "Cambios Web/App no autorizados; abortando."
  exit 1
}
EXPECTED_API_FILES="$(printf '%s\n' api/src/sponsor-commercial-sales.ts api/src/sponsored-appointments.ts api/src/sponsored-commercial-links-core.ts)"
ACTUAL_API_FILES="$(git diff --name-only "$BASE"..HEAD -- api | sort)"
[[ "$ACTUAL_API_FILES" == "$EXPECTED_API_FILES" ]] || {
  echo "Cambios API fuera del alcance. No desplegar."
  exit 1
}
echo "===== Pruebas comerciales y aislamiento ====="
node scripts/test-sponsored-owner-commercial-links-2026-11-02.mjs
node scripts/test-sponsored-owner-context-denial-2026-11-01.mjs
node scripts/test-owner-bar-api-origin-multicuenta-2026-11-01.mjs
echo "===== TypeScript y dry-run API ====="
(cd api && npx --no-install tsc --noEmit && npx --no-install wrangler deploy --config wrangler.toml --dry-run)

# Check unauthenticated privacy before AND after publishing.
unauth_status="$(curl -sS --max-time 25 -o /dev/null -w '%{http_code}' 'https://api.intaprd.com/api/v1/me/sponsored-profile/appointments/public-context?username=dapsa' || true)"
[[ "$unauth_status" == "401" ]] || {
  echo "Endpoint sin sesión respondió HTTP $unauth_status (esperado 401); NO desplegar."
  exit 1
}
echo "Validaciones correctas. Publicando SOLO intap-api en Producción..."
(cd api && npm run deploy:production)
echo "Worker API publicado. Verificando acceso privado..."
unauth_after="$(curl -sS --max-time 25 -o /dev/null -w '%{http_code}' 'https://api.intaprd.com/api/v1/me/sponsored-profile/appointments/public-context?username=dapsa' || true)"
[[ "$unauth_after" == "401" ]] || {
  echo "ATENCIÓN: despliegue completado, pero endpoint sin sesión respondió HTTP $unauth_after. NO repetir deploy; revisar incidencia."
  exit 1
}
echo "API COMERCIAL PUBLICADA Y PROTEGIDA. App, Web, D1 y Preview sin cambios."
echo "QA VISUAL: seleccionar DAPSA Master en Multicuenta y abrir https://intaprd.com/p/dapsa"
echo "Esperado: Configuración + Catálogo general + Agenda + notificaciones."
echo "No cerrar GitHub #132 hasta verificar Master y un beneficiario con asignación real."
