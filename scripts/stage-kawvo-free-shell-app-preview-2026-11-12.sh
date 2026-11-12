#!/usr/bin/env bash
# STAGE ONLY: App Pages QA project branch, do NOT change the active Preview Worker front door.
set -euo pipefail
[[ "$(printenv KAWVO_FREE_SHELL_STAGE_APPROVED 2>/dev/null || true)" == "SI" ]] || {
  echo "DETENIDO: KAWVO_FREE_SHELL_STAGE_APPROVED=SI requerido"
  exit 1
}
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawvo-unified-shell-free-preview-2026-11-12"
BASE="b089bcdc1c82dce9c4e87e08ddee003503e0bd0c"
APP_BRANCH="qa-kawvo-free-shell-1112"
fail(){ echo "DETENIDO: $*" >&2; exit 1; }
cd "$ROOT" || fail "Repo inexistente"
[[ -z "$(git status --porcelain)" ]] || fail "Hay cambios locales; no se cambiará rama"
git fetch github "$BRANCH"
git switch "$BRANCH"
git pull --ff-only github "$BRANCH"
git merge-base --is-ancestor "$BASE" HEAD || fail "No coincide rama base"
git diff --check "$BASE"..HEAD
CHANGED="$(git diff --name-only "$BASE"..HEAD)"
EXPECTED="$(printf '%s\n' \
 app/src/App.tsx \
 app/src/components/admin/free/KawvoFreeShellPreview.tsx \
 app/src/components/admin/shared/KawvoPagedList.tsx \
 docs/architecture/KAWVO_LARGE_LIST_SEARCH_FILTER_PAGINATION_CONTRACT_2026-11-12.md \
 scripts/audit-kawvo-dependencies-readonly-2026-11-12.sh \
 scripts/run-kawvo-free-shell-preview-qa-2026-11-12.sh \
 scripts/stage-kawvo-free-shell-app-preview-2026-11-12.sh \
 scripts/test-kawvo-free-shell-preview-isolation-2026-11-12.mjs)"
[[ "$CHANGED" == "$EXPECTED" ]] || { printf '%s\n' "$CHANGED"; fail "Diff fuera de allowlist"; }
[[ -z "$(git diff --name-only "$BASE"..HEAD -- web/ api/ package.json package-lock.json app/src/components/admin/free/FreeDashboard.tsx app/src/components/admin/AdminGuard.tsx)" ]] || fail "Módulo protegido modificado"
grep -Fxq 'VITE_API_URL=https://app.preview.intaprd.com' app/.env.preview || fail "API destino no es Preview"
grep -Fxq 'VITE_WEB_URL=https://preview.intaprd.com' app/.env.preview || fail "Web destino no es Preview"
node scripts/test-kawvo-free-shell-preview-isolation-2026-11-12.mjs
node scripts/test-intapcard-active-account-contract.mjs
node scripts/test-free-ownerbar-mi-perfil-to-panel-2026-11-11.mjs
node scripts/test-free-multicuenta-ownerbar-preview-slot-2026-11-04.mjs
node scripts/test-free-preview-canonical-session-origin-2026-11-06.mjs
mkdir -p "$HOME/intap-release-logs"
LOG="$(mktemp -d "$HOME/intap-release-logs/kawvo-free-shell-stage-2026-11-12-XXXXXXXX")"
echo "LOG: $LOG"
npm run app:build:preview 2>&1 | tee "$LOG/build.log"
[[ -f app/dist/index.html ]] || fail "Falta App construida"
grep -q 'assets/index-' app/dist/index.html || fail "Falta bundle JS de App"
echo "Preflight del Preview actualmente activo (solo lectura)."
curl -sS -L --max-time 30 -o "$LOG/current-preview-login.html" -w 'App Preview actual: HTTP %{http_code}\n' "https://app.preview.intaprd.com/admin/login" | tee "$LOG/current-preview-http.txt"
[[ "$(tail -n1 "$LOG/current-preview-http.txt" | sed 's/.*HTTP //')" == "200" ]] || fail "Preview actual no es saludable; abortar stage"
npx --no-install wrangler deployments list --name intap-api-preview --json > "$LOG/active-worker-deployments.json" 2> "$LOG/active-worker-stderr.log" || fail "No se pudo identificar versión de Worker Preview actual"
[[ -s "$LOG/active-worker-deployments.json" ]] || fail "No hay snapshot del Worker Preview"
echo "Snapshot read-only de deployments Preview: $LOG/active-worker-deployments.json"
echo "STAGING: App Pages independiente. No se toca Preview actual ni ningún Worker."
npx --no-install wrangler pages deploy app/dist --project-name intap-web2 --branch "$APP_BRANCH" --commit-hash "$(git rev-parse HEAD)" 2>&1 | tee "$LOG/deploy-pages.txt"
ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$LOG/deploy-pages.txt" | tail -1 || true)"
[[ -n "$ORIGIN" ]] || fail "Origen Pages no confirmado; no repetir sin revisar log"
printf '%s\n' "$ORIGIN" > "$LOG/staged-app-url.txt"
STATUS="$(curl -sS -L --max-time 30 -o "$LOG/index.remote.html" -w '%{http_code}' "$ORIGIN/admin/free/shell-preview?kawvo_shell=1" || true)"
[[ "$STATUS" == "200" ]] || fail "Origen Stage HTTP $STATUS"
LOCAL_JS="$(grep -Eo '/assets/index-[^"]+\.js' app/dist/index.html | head -1 || true)"
[[ -n "$LOCAL_JS" ]] || fail "Bundle JS no identificado"
grep -Fq "$LOCAL_JS" "$LOG/index.remote.html" || fail "Remote Pages no sirve mismo index local"
STATUS_JS="$(curl -sS -L --max-time 30 -o /dev/null -w '%{http_code}' "$ORIGIN$LOCAL_JS" || true)"
[[ "$STATUS_JS" == "200" ]] || fail "Bundle remoto HTTP $STATUS_JS"
[[ -z "$(git status --porcelain)" ]] || fail "Archivos versionados alterados"
echo "PASS: Pages App staged, immutable $ORIGIN, bundle JS HTTP $STATUS_JS"
echo "NO CORTAR TRÁFICO: app.preview.intaprd.com continúa sin cambios. Páginas .pages.dev no sirven para QA de sesión real."
echo "No se tocó Web, Worker, D1, R2, Prod o API Preview."
echo "LOG: $LOG"
