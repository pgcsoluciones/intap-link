#!/usr/bin/env bash
# G1 Free UI: local-only QA of approved desktop sidebar and mobile navigation.
# No deploy, Worker, API, DB, production, publishing, or authentication changes.
set -euo pipefail
[[ "${KAWVO_G1_LOCAL_QA_APPROVED:-}" == "SI" ]] || { echo "DETENIDO: falta KAWVO_G1_LOCAL_QA_APPROVED=SI"; exit 1; }
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawvo-free-shell-approved-desktop-2026-11-12"
BASE="142d26a515bd7eeaeea6b8ef6cfdf16658953d5b"
fail(){ echo "DETENIDO: $*" >&2; exit 1; }
cd "$ROOT" || fail "No existe repositorio"
[[ -z "$(git status --porcelain)" ]] || fail "Hay cambios locales. No se cambia de rama."
git fetch github "$BRANCH"
git switch "$BRANCH"
git pull --ff-only github "$BRANCH"
git merge-base --is-ancestor "$BASE" HEAD || fail "Base de G1 distinta de la aprobada"
git diff --check "$BASE" HEAD
CHANGED="$(git diff --name-only "$BASE" HEAD)"
EXPECTED="$(printf '%s\n' app/src/components/admin/free/KawvoFreeShellPreview.tsx scripts/run-kawvo-free-shell-approved-desktop-qa-2026-11-12.sh scripts/test-kawvo-free-shell-desktop-parity-2026-11-12.mjs)"
[[ "$CHANGED" == "$EXPECTED" ]] || { echo "$CHANGED"; fail "Diff fuera del alcance G1"; }
git diff --quiet "$BASE" HEAD -- api/ web/ app/src/App.tsx app/src/components/admin/AdminGuard.tsx app/src/components/admin/free/FreeDashboard.tsx app/package.json package-lock.json || fail "Se alteraron áreas protegidas"
node scripts/test-kawvo-free-shell-desktop-parity-2026-11-12.mjs
node scripts/test-kawvo-free-shell-preview-isolation-2026-11-12.mjs
node scripts/test-free-ownerbar-mi-perfil-to-panel-2026-11-11.mjs
node scripts/test-free-multicuenta-ownerbar-preview-slot-2026-11-04.mjs
node scripts/test-free-preview-canonical-session-origin-2026-11-06.mjs
node scripts/test-intapcard-active-account-contract.mjs
mkdir -p "$HOME/intap-release-logs"
LOG="$(mktemp -d "$HOME/intap-release-logs/kawvo-free-g1-desktop-2026-11-12-XXXXXXXX")"
echo "LOG: $LOG"
npm ci > "$LOG/npm-ci.txt" 2>&1 || { tail -40 "$LOG/npm-ci.txt"; fail "npm ci"; }
npm run app:build:preview > "$LOG/build.txt" 2>&1 || { tail -60 "$LOG/build.txt"; fail "App build"; }
[[ -f app/dist/index.html ]] || fail "No existe app/dist/index.html"
[[ -z "$(git status --porcelain)" ]] || fail "Se modificaron archivos versionados"
git rev-parse HEAD > "$LOG/commit.txt"
echo "PASS: shell Free con menú lateral desktop, navegación móvil, regresiones y build Preview."
echo "SIN DEPLOY: no se ha publicado la interfaz en el dominio autenticado."
echo "LOG: $LOG"
