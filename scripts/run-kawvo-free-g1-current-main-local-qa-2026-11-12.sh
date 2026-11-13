#!/usr/bin/env bash
# G1 integration: local read/build only. Current GitHub main + approved Free shell.
# NEVER deploy to Preview or Production; never change Cloudflare, API, data, OAuth or cookies.
set -euo pipefail
[[ "${KAWVO_G1_INTEGRATION_QA_APPROVED:-}" == "SI" ]] || { echo "DETENIDO: falta aprobación de QA local"; exit 1; }
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawvo-free-g1-current-main-integration-2026-11-12"
fail(){ echo "DETENIDO: $*" >&2; exit 1; }
cd "$ROOT" || fail "No existe checkout"
[[ -z "$(git status --porcelain)" ]] || fail "Hay cambios sin guardar; no se cambió la rama"
git fetch github main "$BRANCH"
git switch "$BRANCH"
git pull --ff-only github "$BRANCH"
git diff --check github/main HEAD
CHANGED="$(git diff --name-only github/main HEAD)"
EXPECTED="$(printf '%s\n' \
 app/src/App.tsx \
 app/src/components/admin/free/KawvoFreeShellPreview.tsx \
 app/src/components/admin/shared/KawvoPagedList.tsx \
 docs/architecture/KAWVO_LARGE_LIST_SEARCH_FILTER_PAGINATION_CONTRACT_2026-11-12.md \
 scripts/preflight-kawvo-g1-active-origin-readonly-2026-11-12.sh \
 scripts/run-kawvo-free-g1-current-main-local-qa-2026-11-12.sh \
 scripts/stage-kawvo-free-g1-current-main-isolated-2026-11-12.sh \
 scripts/compare-kawvo-g1-live-app-routes-2026-11-12.mjs \
 scripts/run-kawvo-g1-route-audit-readonly-2026-11-12.sh \
 scripts/test-kawvo-free-shell-desktop-parity-2026-11-12.mjs \
 scripts/test-kawvo-free-shell-preview-isolation-2026-11-12.mjs)"
[[ "$CHANGED" == "$EXPECTED" ]] || { printf '%s\n' "$CHANGED"; fail "Archivos adicionales inesperados"; }
git diff --quiet github/main HEAD -- api/ web/ package.json package-lock.json app/src/components/admin/AdminGuard.tsx app/src/components/admin/free/FreeDashboard.tsx app/src/components/admin/medical/ app/src/components/admin/sponsored/ || fail "Alteración área protegida"
node scripts/test-kawvo-free-shell-preview-isolation-2026-11-12.mjs
node scripts/test-kawvo-free-shell-desktop-parity-2026-11-12.mjs
node scripts/test-intapcard-active-account-contract.mjs
mkdir -p "$HOME/intap-release-logs"
LOG="$(mktemp -d "$HOME/intap-release-logs/kawvo-g1-current-main-integration-XXXXXXXX")"
echo "LOG: $LOG"
npm ci > "$LOG/npm-ci.txt" 2>&1 || { tail -45 "$LOG/npm-ci.txt"; fail "npm ci"; }
npm run app:build:preview > "$LOG/build.txt" 2>&1 || { tail -65 "$LOG/build.txt"; fail "App Preview build"; }
[[ -f app/dist/index.html ]] || fail "No se generó App"
[[ -z "$(git status --porcelain)" ]] || fail "El build modificó archivos versionados"
git rev-parse HEAD > "$LOG/commit.txt"
echo "PASS: compilación y contratos de G1 sobre main actual. NO SE HA DESPLEGADO."
echo "IMPORTANTE: GitHub main NO prueba identidad con el Pages KawMed Guest activo."
echo "LOG: $LOG"
