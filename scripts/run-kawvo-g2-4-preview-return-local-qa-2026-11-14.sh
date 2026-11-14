#!/usr/bin/env bash
# G2.4 strict local QA. Validates BOTH App and public Web Preview; no deployment.
set -euo pipefail
[[ "${KAWVO_G2_4_QA_APPROVED:-}" == "SI" ]] || { echo "BLOCKED: falta KAWVO_G2_4_QA_APPROVED=SI"; exit 1; }
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawvo-g2-free-preview-return-2026-11-14"
BASE_SHA="f1f998fba3a64514ff3113b3e58a87e80475259a"
fail(){ echo "BLOCKED: $*" >&2; exit 1; }
cd "$ROOT" || fail "Checkout local no encontrado"
[[ -z "$(git status --porcelain)" ]] || fail "Cambios locales presentes; NO tocar"
git fetch github "$BRANCH" "feature/kawvo-g2-free-route-continuity-2026-11-14" || fail "No se pudo consultar ramas GitHub"
git cat-file -e "$BASE_SHA^{commit}" || fail "No existe base exacta G2.3"
git switch "$BRANCH" || fail "Rama G2.4 no disponible"
git pull --ff-only github "$BRANCH" || fail "Divergencia local; NO forzar"
[[ "$(git branch --show-current)" == "$BRANCH" ]] || fail "Rama equivocada"
[[ "$(git rev-parse HEAD)" == "$(git rev-parse "github/$BRANCH")" ]] || fail "HEAD remoto diferente"
git merge-base --is-ancestor "$BASE_SHA" HEAD || fail "Rama no basada en G2.3 publicado"
EXPECTED="$(printf '%s\n' \
 app/src/components/admin/free/KawvoFreeShellPreview.tsx \
 app/src/free-preview-link-fallback.ts \
 web/src/components/free-profile/freeShellPreviewReturn.ts \
 web/src/components/free-profile/FreePreviewEditShortcut.tsx \
 web/src/components/free-profile/IntapLinkGratisProfile.tsx \
 web/src/components/appointments/AppointmentOwnerBar.tsx \
 scripts/test-kawvo-g2-free-preview-return-contract-2026-11-14.mjs \
 scripts/test-free-contact-agenda-contract.mjs \
 scripts/audit-kawvo-g2-web-pages-alias-readonly-2026-11-14.mjs \
 scripts/run-kawvo-g2-4-preview-return-local-qa-2026-11-14.sh \
 scripts/deploy-kawvo-g2-4-preview-return-pages-2026-11-14.sh \
 docs/architecture/KAWVO_G2_4_FREE_PUBLIC_PREVIEW_RETURN_HANDOFF_2026-11-14.md | LC_ALL=C sort)"
ACTUAL="$(git diff --name-only "$BASE_SHA" HEAD | LC_ALL=C sort)"
[[ "$EXPECTED" == "$ACTUAL" ]] || {
 printf 'ESPERADOS:\n%s\nACTUALES:\n%s\n' "$EXPECTED" "$ACTUAL"
 fail "Allowlist incorrecta"
}
git diff --check "$BASE_SHA" HEAD || fail "Diff inválido"
git diff --quiet "$BASE_SHA" HEAD -- api/ shared/ package.json package-lock.json app/src/App.tsx app/src/components/admin/AdminGuard.tsx app/src/components/admin/free/FreeDashboard.tsx app/src/components/admin/medical/ app/src/components/admin/sponsored/ web/src/components/medical-profile/ web/src/components/sponsored/ || fail "Zona protegida alterada"
bash -n scripts/run-kawvo-g2-4-preview-return-local-qa-2026-11-14.sh || fail "Bash QA inválido"
bash -n scripts/deploy-kawvo-g2-4-preview-return-pages-2026-11-14.sh || fail "Bash Pages inválido"
node --check scripts/test-kawvo-g2-free-preview-return-contract-2026-11-14.mjs || fail "Test G2.4 JS inválido"
node --check scripts/audit-kawvo-g2-web-pages-alias-readonly-2026-11-14.mjs || fail "Auditoría JS inválida"
node scripts/test-kawvo-free-shell-preview-isolation-2026-11-12.mjs || fail "G1 aislamiento"
node scripts/test-kawvo-free-shell-desktop-parity-2026-11-12.mjs || fail "G1 desktop/móvil"
node scripts/test-intapcard-active-account-contract.mjs || fail "Multicuenta/aislamiento"
node scripts/test-kawvo-g2-free-direct-access-contract-2026-11-13.mjs || fail "G2.1"
node scripts/test-kawvo-g2-free-return-list-contract-2026-11-13.mjs || fail "G2.2"
node scripts/test-kawvo-g2-free-route-continuity-contract-2026-11-14.mjs || fail "G2.3"
node scripts/test-kawvo-g2-free-preview-return-contract-2026-11-14.mjs || fail "G2.4 retorno público"
node scripts/test-free-contact-agenda-contract.mjs || fail "Regresión Web/Free/Agenda"
node scripts/test-sponsored-profile-contract.mjs || fail "Regresión patrocinado"
node scripts/test-kawmed-isolation-contract.mjs || fail "Regresión Kawmed"
mkdir -p "$HOME/intap-release-logs"
LOG="$(mktemp -d "$HOME/intap-release-logs/kawvo-g2-4-local-XXXXXXXX")" || fail "No se pudo crear log"
echo "LOG: $LOG"
npm ci > "$LOG/npm-ci.txt" 2>&1 || { tail -50 "$LOG/npm-ci.txt"; fail "npm ci"; }
npm run app:build:preview > "$LOG/app-build.txt" 2>&1 || { tail -60 "$LOG/app-build.txt"; fail "Build App Preview"; }
npm run web:build:preview > "$LOG/web-build.txt" 2>&1 || { tail -60 "$LOG/web-build.txt"; fail "Build Web Preview"; }
[[ -f app/dist/index.html && -f web/dist/index.html ]] || fail "No se crearon ambos artefactos"
[[ -z "$(git status --porcelain)" ]] || fail "Build alteró árbol Git"
git rev-parse HEAD > "$LOG/sha.txt"
echo "PASS G2.4 LOCAL: contratos G1-G2.4, Free/Medical/Sponsor, App+Web Preview builds."
echo "SIN DEPLOY: App G2.3 y Web Preview activos intactos."
echo "LOG: $LOG"
