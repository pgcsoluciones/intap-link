#!/usr/bin/env bash
# G2.1 Free: local QA only. No Cloudflare, no migrations, no production or remote writes.
set -euo pipefail
[[ "${KAWVO_G2_LOCAL_QA_APPROVED:-}" == "SI" ]] || { echo "DETENIDO: se requiere KAWVO_G2_LOCAL_QA_APPROVED=SI" >&2; exit 1; }

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawvo-g2-free-direct-access-2026-11-13"
BASE_SHA="b7861f9da35ade3cdd7864184a30e79fd5bcf163"
fail(){ echo "DETENIDO: $*" >&2; exit 1; }
cd "$ROOT" || fail "No existe checkout local"
[[ -z "$(git status --porcelain)" ]] || fail "Checkout tiene cambios locales; no se alteraron"

# Explicitly fetch only the approved branch and its G1 base. Never reset, merge or check out main.
git fetch github "$BRANCH" "feature/kawvo-free-g1-current-main-integration-2026-11-12" || fail "No se pudo consultar GitHub"
git cat-file -e "$BASE_SHA^{commit}" || fail "No existe el commit exacto G1"
git switch "$BRANCH" || fail "No se pudo entrar en la rama G2"
git pull --ff-only github "$BRANCH" || fail "La rama local diverge; no se forzó"
[[ "$(git branch --show-current)" == "$BRANCH" ]] || fail "Rama incorrecta"
git merge-base --is-ancestor "$BASE_SHA" HEAD || fail "G2 no desciende de la base G1 aprobada"

EXPECTED="$(printf '%s\n' \
  app/src/components/admin/free/KawvoFreeShellPreview.tsx \
  app/src/components/admin/free/FreePanelUi.tsx \
  app/src/components/admin/free/FreeAppointments.tsx \
  docs/architecture/KAWVO_G2_1_FREE_NAVIGATION_AUDIT_2026-11-13.md \
  scripts/test-kawvo-g2-free-direct-access-contract-2026-11-13.mjs \
  scripts/run-kawvo-g2-free-direct-access-local-qa-2026-11-13.sh | LC_ALL=C sort)"
CHANGED="$(git diff --name-only "$BASE_SHA" HEAD | LC_ALL=C sort)"
[[ "$CHANGED" == "$EXPECTED" ]] || {
  printf 'ESPERADOS:\n%s\nENCONTRADOS:\n%s\n' "$EXPECTED" "$CHANGED"
  fail "Allowlist de G2.1 no coincide"
}
git diff --check "$BASE_SHA" HEAD || fail "Diff tiene errores de espacios o conflictos"
git diff --quiet "$BASE_SHA" HEAD -- api/ web/ shared/ app/src/App.tsx app/src/components/admin/AdminGuard.tsx app/src/components/admin/free/FreeDashboard.tsx app/src/components/admin/medical/ app/src/components/admin/sponsored/ package.json package-lock.json || fail "Archivo o zona protegida modificada"
bash -n "scripts/run-kawvo-g2-free-direct-access-local-qa-2026-11-13.sh" || fail "Runner Bash inválido"
node --check "scripts/test-kawvo-g2-free-direct-access-contract-2026-11-13.mjs" || fail "Test JS inválido"
node scripts/test-kawvo-free-shell-preview-isolation-2026-11-12.mjs || fail "Regresión aislamiento G1"
node scripts/test-kawvo-free-shell-desktop-parity-2026-11-12.mjs || fail "Regresión escritorio/móvil G1"
node scripts/test-intapcard-active-account-contract.mjs || fail "Regresión multicuenta existente"
node scripts/test-kawvo-g2-free-direct-access-contract-2026-11-13.mjs || fail "Contrato de accesos G2.1"

mkdir -p "$HOME/intap-release-logs"
LOG="$(mktemp -d "$HOME/intap-release-logs/kawvo-g2-free-qa-XXXXXXXX")" || fail "No se pudo crear log"
echo "LOG: $LOG"
npm ci > "$LOG/npm-ci.txt" 2>&1 || { tail -50 "$LOG/npm-ci.txt"; fail "npm ci"; }
npm run app:build:preview > "$LOG/app-build-preview.txt" 2>&1 || { tail -65 "$LOG/app-build-preview.txt"; fail "App Preview build"; }
[[ -f app/dist/index.html ]] || fail "No existe app/dist/index.html"
[[ -z "$(git status --porcelain)" ]] || fail "El build modificó archivos versionados/no controlados"
git rev-parse HEAD > "$LOG/commit.txt"
echo "PASS G2.1 LOCAL: contratos G1/G2, allowlist y App Preview build."
echo "NO SE DESPLEGÓ Preview ni Producción. No se cambiaron Workers, API, OAuth ni datos."
echo "FALTA: QA autenticada móvil, rutas, Team/Multicuenta y paso App-only a Preview con preflight."
echo "LOG: $LOG"
