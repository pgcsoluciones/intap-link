#!/usr/bin/env bash
# Build and contract-test the new protected Free shell; NEVER deploy or mutate Cloudflare.
set -euo pipefail
[[ "$(printenv KAWVO_FREE_SHELL_LOCAL_QA_APPROVED 2>/dev/null || true)" == "SI" ]] || {
  echo "DETENIDO: requiere KAWVO_FREE_SHELL_LOCAL_QA_APPROVED=SI"
  exit 1
}
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawvo-unified-shell-free-preview-2026-11-12"
BASE="b089bcdc1c82dce9c4e87e08ddee003503e0bd0c"
fail(){ echo "DETENIDO: $*" >&2; exit 1; }
cd "$ROOT" || fail "Repositorio no disponible"
[[ -z "$(git status --porcelain)" ]] || fail "Cambios sin guardar; no cambiar rama"
git fetch github "$BRANCH"
git switch "$BRANCH"
git pull --ff-only github "$BRANCH"
git merge-base --is-ancestor "$BASE" HEAD || fail "Rama base distinta de la aprobada"
git diff --check "$BASE"..HEAD
CHANGED="$(git diff --name-only "$BASE"..HEAD)"
EXPECTED="$(printf '%s\n' \
 app/src/App.tsx \
 app/src/components/admin/free/KawvoFreeShellPreview.tsx \
 app/src/components/admin/shared/KawvoPagedList.tsx \
 docs/architecture/KAWVO_LARGE_LIST_SEARCH_FILTER_PAGINATION_CONTRACT_2026-11-12.md \
 scripts/run-kawvo-free-shell-preview-qa-2026-11-12.sh \
 scripts/test-kawvo-free-shell-preview-isolation-2026-11-12.mjs)"
[[ "$CHANGED" == "$EXPECTED" ]] || { printf '%s\n' "$CHANGED"; fail "Archivos fuera del alcance"; }
[[ -z "$(git diff --name-only "$BASE"..HEAD -- web/ api/ app/.env.preview app/.env.production app/src/components/admin/free/FreeDashboard.tsx app/src/components/admin/AdminGuard.tsx)" ]] || fail "Áreas protegidas alteradas"
grep -Fxq 'VITE_API_URL=https://app.preview.intaprd.com' app/.env.preview || fail "API Preview incorrecta"
grep -Fxq 'VITE_WEB_URL=https://preview.intaprd.com' app/.env.preview || fail "Web Preview incorrecta"
mkdir -p "$HOME/intap-release-logs"
LOG="$(mktemp -d "$HOME/intap-release-logs/kawvo-free-shell-qa-2026-11-12-XXXXXXXX")"
echo "LOG: $LOG"
echo "===== Contratos del nuevo shell ====="
node scripts/test-kawvo-free-shell-preview-isolation-2026-11-12.mjs
echo "===== Contratos previamente aprobados ====="
node scripts/test-kawvo-sponsor-shell-prototype-2026-11-12.mjs
node scripts/test-free-ownerbar-mi-perfil-to-panel-2026-11-11.mjs
node scripts/test-free-multicuenta-ownerbar-preview-slot-2026-11-04.mjs
node scripts/test-free-preview-canonical-session-origin-2026-11-06.mjs
node scripts/test-intapcard-active-account-contract.mjs
echo "===== Dependencias y compilación App Preview, SIN deploy ====="
npm ci
npm run app:build:preview 2>&1 | tee "$LOG/app-preview-build.txt"
[[ -f app/dist/index.html ]] || fail "No se generó dist de App"
[[ -z "$(git status --porcelain)" ]] || fail "Compilación dejó archivos versionados modificados"
printf '%s\n' "$(git rev-parse HEAD)" > "$LOG/source-commit.txt"
echo
echo "PASS: pruebas de regresión y compilación Preview. Ningún deploy ni cambio a cuentas, Worker, D1, R2 o Web pública."
echo "La nueva URL /admin/free/shell-preview?kawvo_shell=1 sólo funcionará cuando se apruebe su incorporación al origen app.preview.intaprd.com."
echo "No intentar QA autenticada vía pages.dev: la sesión no comparte cookies cross-site."
echo "LOG: $LOG"
