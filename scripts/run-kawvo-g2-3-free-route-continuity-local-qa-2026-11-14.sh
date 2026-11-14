#!/usr/bin/env bash
# G2.2 Free: QA local only. Never deploy Pages, Worker, API or production.
set -euo pipefail
[[ "${KAWVO_G2_3_LOCAL_QA_APPROVED:-}" == "SI" ]] || { echo "DETENIDO: falta KAWVO_G2_3_LOCAL_QA_APPROVED=SI" >&2; exit 1; }
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawvo-g2-free-route-continuity-2026-11-14"
BASE_SHA="8f763f4ad44704f3c27e6d111bc06c3b6b930b5f"
fail(){ echo "DETENIDO: $*" >&2; exit 1; }
cd "$ROOT" || fail "Checkout local no disponible"
[[ -z "$(git status --porcelain)" ]] || fail "Hay cambios locales. No se hizo checkout ni borrado."
git fetch github "$BRANCH" "feature/kawvo-g2-free-direct-access-2026-11-13" || fail "GitHub no disponible"
git cat-file -e "$BASE_SHA^{commit}" || fail "Falta commit exacto G2.1"
git switch "$BRANCH" || fail "Rama G2.3 no disponible"
git pull --ff-only github "$BRANCH" || fail "Rama divergente, no se forzó"
[[ "$(git branch --show-current)" == "$BRANCH" ]] || fail "Rama incorrecta"
git merge-base --is-ancestor "$BASE_SHA" HEAD || fail "G2.3 no desciende del G2.2 publicado"
[[ "$(git rev-parse HEAD)" == "$(git rev-parse "github/$BRANCH")" ]] || fail "GitHub/HEAD no coinciden"

EXPECTED="$(printf '%s\n' \
  app/src/components/admin/free/KawvoShellReturn.ts \
  app/src/components/admin/free/FreePanelUi.tsx \
  app/src/components/admin/free/FreeCredentials.tsx \
  app/src/components/admin/free/FreeAccount.tsx \
  app/src/components/admin/free/FreeNotifications.tsx \
  app/src/components/admin/free/FreeAiProfileAssistant.tsx \
  app/src/components/admin/free/FreeIdentifier.tsx \
  app/src/components/admin/free/onboarding/FreeOnboardingIdentity.tsx \
  app/src/components/admin/free/onboarding/FreeOnboardingContact.tsx \
  docs/architecture/KAWVO_G2_3_FREE_ROUTE_CONTINUITY_HANDOFF_2026-11-14.md \
  scripts/test-kawvo-g2-free-route-continuity-contract-2026-11-14.mjs \
  scripts/run-kawvo-g2-3-free-route-continuity-local-qa-2026-11-14.sh \
  scripts/deploy-kawvo-g2-3-free-app-pages-preview-2026-11-14.sh | LC_ALL=C sort)"
CHANGED="$(git diff --name-only "$BASE_SHA" HEAD | LC_ALL=C sort)"
[[ "$CHANGED" == "$EXPECTED" ]] || {
  printf 'ESPERADOS:\n%s\nACTUALES:\n%s\n' "$EXPECTED" "$CHANGED"
  fail "Diferencia con allowlist. No ejecutar sin auditoría."
}
git diff --check "$BASE_SHA" HEAD || fail "Diff con errores"
git diff --quiet "$BASE_SHA" HEAD -- api/ web/ shared/ app/src/App.tsx app/src/components/admin/AdminGuard.tsx app/src/components/admin/free/FreeDashboard.tsx app/src/components/appointments/ app/src/components/admin/medical/ app/src/components/admin/sponsored/ package.json package-lock.json || fail "Zona protegida alterada"
bash -n scripts/run-kawvo-g2-3-free-route-continuity-local-qa-2026-11-14.sh || fail "Sintaxis Bash inválida"
bash -n scripts/deploy-kawvo-g2-3-free-app-pages-preview-2026-11-14.sh || fail "Sintaxis script Pages inválida"
node --check scripts/test-kawvo-g2-free-direct-access-contract-2026-11-13.mjs || fail "Sintaxis test G2.1"
node --check scripts/test-kawvo-g2-free-return-list-contract-2026-11-13.mjs || fail "Sintaxis test G2.2"
node --check scripts/test-kawvo-g2-free-route-continuity-contract-2026-11-14.mjs || fail "Sintaxis test G2.3"
node scripts/test-kawvo-free-shell-preview-isolation-2026-11-12.mjs || fail "Regresión opt-in G1"
node scripts/test-kawvo-free-shell-desktop-parity-2026-11-12.mjs || fail "Regresión menú G1"
node scripts/test-intapcard-active-account-contract.mjs || fail "Regresión aislamiento cuentas"
node scripts/test-kawvo-g2-free-direct-access-contract-2026-11-13.mjs || fail "Regresión G2.1"
node scripts/test-kawvo-g2-free-return-list-contract-2026-11-13.mjs || fail "Contrato G2.2"
node scripts/test-kawvo-g2-free-route-continuity-contract-2026-11-14.mjs || fail "Contrato G2.3"
node scripts/test-kawmed-demo-invitations-contract.mjs || fail "Regresión invitados médicos"
node scripts/test-kawmed-isolation-contract.mjs || fail "Regresión aislamiento Kawmed"
mkdir -p "$HOME/intap-release-logs"
LOG="$(mktemp -d "$HOME/intap-release-logs/kawvo-g2-3-free-qa-XXXXXXXX")" || fail "No se puede crear log"
echo "LOG: $LOG"
npm ci > "$LOG/npm-ci.txt" 2>&1 || { tail -55 "$LOG/npm-ci.txt"; fail "npm ci"; }
npm run app:build:preview > "$LOG/build.txt" 2>&1 || { tail -80 "$LOG/build.txt"; fail "App Preview build"; }
[[ -f app/dist/index.html ]] || fail "No se generó app/dist/index.html"
[[ -z "$(git status --porcelain)" ]] || fail "El build dejó cambios en árbol versionado/no controlado"
git rev-parse HEAD > "$LOG/git-sha.txt"
echo "PASS G2.3 LOCAL: test G1/G2.1/G2.2/G2.3, aislamiento, allowlist, App Preview build."
echo "SIN DEPLOY: Preview G2.2 se mantiene intacto. NO se cambiaron Worker/API/OAuth/D1/R2/Producción."
echo "PENDIENTE: stage y preflight App Pages-only para QA autenticada de G2.3."
echo "LOG: $LOG"
