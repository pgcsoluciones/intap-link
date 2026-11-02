#!/usr/bin/env bash
# QA read-only de código para barra básica de propietario; NO despliega ni edita D1.
set -euo pipefail
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BASE="5cc143fe870f0ccea0b92903824594b5084dd29d"
BRANCH="fix/owner-bar-api-origin-multicuenta-2026-11-01"
cd "$ROOT"
[[ -z "$(git status --porcelain)" ]] || { echo "CAMBIOS LOCALES DETECTADOS: abortando."; exit 1; }
git fetch github "$BRANCH"
git switch "$BRANCH"
git pull --ff-only github "$BRANCH"
git merge-base --is-ancestor "$BASE" HEAD
git diff --check "$BASE"..HEAD
while IFS= read -r path; do
  case "$path" in
    web/src/components/appointments/AppointmentOwnerBar.tsx|scripts/test-owner-bar-api-origin-multicuenta-2026-11-01.mjs|scripts/verify-owner-bar-api-origin-multicuenta-2026-11-01.sh) ;;
    *) echo "Archivo fuera del alcance: $path"; exit 1 ;;
  esac
done < <(git diff --name-only "$BASE"..HEAD)
[[ "$(git diff --name-only "$BASE"..HEAD -- api app web)" == "web/src/components/appointments/AppointmentOwnerBar.tsx" ]] || {
  echo "El único cambio runtime autorizado es la barra Web. Abortando."
  exit 1
}
echo "===== QA de contrato del dominio de sesión ====="
node scripts/test-owner-bar-api-origin-multicuenta-2026-11-01.mjs
echo "===== QA de aislamiento de propietario ====="
node scripts/test-sponsored-owner-context-denial-2026-11-01.mjs
echo "===== Build Web Production (sin publicar) ====="
(cd web && npm run build)
echo "QA COMPLETA. NO se desplegó Web, App ni API. NO se alteró D1."
