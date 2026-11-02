#!/usr/bin/env bash
# QA Web-only; NO deploy ni modificación de API/App/D1/Preview.
set -euo pipefail
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BASE="17e00516852e7492aba90a51b357c21b792a3d40"
BRANCH="fix/sponsored-owner-edit-mobile-menu-2026-11-02"
cd "$ROOT"
[[ -z "$(git status --porcelain)" ]] || { echo "Cambios locales detectados. Abortando."; exit 1; }
git fetch github "$BRANCH"
git switch "$BRANCH"
git pull --ff-only github "$BRANCH"
git merge-base --is-ancestor "$BASE" HEAD
git diff --check "$BASE"..HEAD
while IFS= read -r file; do
  case "$file" in
    web/src/components/sponsored/SponsoredProfile.tsx|web/src/components/appointments/AppointmentOwnerBar.tsx|web/src/components/appointments/AppointmentOwnerBar.mobile.css|scripts/test-sponsored-owner-mobile-navigation-2026-11-02.mjs|scripts/verify-sponsored-owner-mobile-navigation-2026-11-02.sh) ;;
    *) echo "Archivo no autorizado en QA: $file"; exit 1 ;;
  esac
done < <(git diff --name-only "$BASE"..HEAD)
[[ -z "$(git diff --name-only "$BASE"..HEAD -- api app)" ]] || { echo "Se modificó API o App; no continuar."; exit 1; }

echo "===== Contrato UX móvil y propietario ====="
node scripts/test-sponsored-owner-mobile-navigation-2026-11-02.mjs
node scripts/test-owner-bar-api-origin-multicuenta-2026-11-01.mjs
node scripts/test-sponsored-owner-commercial-links-2026-11-02.mjs
node scripts/test-sponsored-owner-context-denial-2026-11-01.mjs
echo "===== Compilación Web ====="
(cd web && npm run build)
grep -R -Fq '.kawmed-owner-header__mobile-menu' web/dist/assets --include='*.css' || {
  echo "No se publicó CSS hamburguesa en build; abortando."
  exit 1
}
echo "QA WEB COMPLETA. Etiqueta y menú móvil listos; NO se desplegó ni se alteró D1."
