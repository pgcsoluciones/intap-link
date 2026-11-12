#!/usr/bin/env bash
# KawMed XLSX: read-only release gate for authenticated App Preview.
# Does NOT deploy, switch origins, write D1/R2, change Worker secrets, or touch Production.
set -euo pipefail
[[ "${KAWVO_KAWMED_XLSX_PREFLIGHT_APPROVED:-}" == "SI" ]] || { echo "DETENIDO: falta KAWVO_KAWMED_XLSX_PREFLIGHT_APPROVED=SI"; exit 1; }
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="qa/kawmed-xlsx-import-2026-11-12"
BASE="635da3d2281bf8478e315852c55a070c782309e2"
fail(){ echo "DETENIDO: $*" >&2; exit 1; }
cd "$ROOT" || fail "Checkout no existe"
[[ -z "$(git status --porcelain)" ]] || fail "Checkout tiene cambios locales; no cambiar ramas"
mkdir -p "$HOME/intap-release-logs"
LOG="$(mktemp -d "$HOME/intap-release-logs/kawmed-xlsx-preview-preflight-2026-11-12-XXXXXXXX")"
echo "LOG: $LOG"
git fetch github "$BRANCH" "security/kawmed-xlsx-parser-hardening-2026-11-12" "feature/kawvo-unified-shell-free-preview-2026-11-12"
git switch "$BRANCH"
git pull --ff-only github "$BRANCH"
[[ -z "$(git status --porcelain)" ]] || fail "Checkout modificado"
git merge-base --is-ancestor "$BASE" HEAD || fail "Falta el commit XLSX 0.20.3 aprobado"
[[ "$(git rev-parse "$BASE:app/package.json")" == "$(git rev-parse HEAD:app/package.json")" ]] || fail "Dependencias App distintas del fix aprobado"
[[ "$(git rev-parse "$BASE:package-lock.json")" == "$(git rev-parse HEAD:package-lock.json")" ]] || fail "Lockfile distinto al fix aprobado"
[[ "$(git diff --name-only "$BASE"..HEAD)" == "scripts/generate-kawmed-xlsx-qa-fixtures-2026-11-12.mjs"$'\n'"scripts/preflight-kawmed-xlsx-app-preview-2026-11-12.sh" ]] || fail "Rama QA contiene cambios fuera del alcance previsto"
git diff --check "$BASE"..HEAD
echo "===== Refs para revisar posible desfase de interfaces ====="
git rev-parse HEAD > "$LOG/qa-head.txt"
git log -1 --format='%H %s' "github/feature/kawvo-unified-shell-free-preview-2026-11-12" > "$LOG/free-shell-head.txt"
git diff --name-status HEAD "github/feature/kawvo-unified-shell-free-preview-2026-11-12" -- app/ > "$LOG/diff-vs-free-shell-app.txt"
echo "Comparación App contra rama Free guardada: $LOG/diff-vs-free-shell-app.txt"
echo "===== Contratos y build (sin despliegue) ====="
npm ci > "$LOG/npm-ci.txt" 2>&1 || { tail -45 "$LOG/npm-ci.txt"; fail "npm ci"; }
node scripts/test-kawmed-xlsx-parser-safety-2026-11-12.mjs 2>&1 | tee "$LOG/xlsx-parser.txt"
node scripts/test-kawmed-isolation-contract.mjs 2>&1 | tee "$LOG/isolation.txt"
node scripts/test-intapcard-active-account-contract.mjs 2>&1 | tee "$LOG/multicuenta.txt"
node scripts/test-sponsored-profile-contract.mjs 2>&1 | tee "$LOG/sponsors.txt"
npm run app:build:preview > "$LOG/build.txt" 2>&1 || { tail -70 "$LOG/build.txt"; fail "Build Preview"; }
echo "===== Cloudflare Preview activo (solo lectura) ====="
npx --no-install wrangler deployments list --name intap-api-preview --json > "$LOG/worker-deployments.json" 2> "$LOG/wrangler-stderr.txt" || fail "No se pudo leer historial del Worker Preview; no promover"
[[ -s "$LOG/worker-deployments.json" ]] || fail "Historial Worker vacío"
for url in "https://app.preview.intaprd.com/admin/login" "https://app.preview.intaprd.com/admin/sponsor/kawmed"; do
  code="$(curl -sSL --connect-timeout 10 --max-time 30 -o /dev/null -w '%{http_code}' "$url" || true)"
  echo "$url -> HTTP $code" | tee -a "$LOG/http.txt"
  [[ "$code" == "200" ]] || fail "App Preview actual no saludable: $url"
done
[[ -z "$(git status --porcelain)" ]] || fail "Build alteró archivos versionados"
echo
echo "PASS: preflight local, parser corregido, contratos y App Preview activa HTTP 200."
echo "NO SE HA CAMBIADO EL ORIGEN DE APP PREVIEW NI SE HA DESPLEGADO."
echo "IMPORTANTE: los datos obtenidos NO certifican cuál deployment Pages recibe tráfico ni su compatibilidad con esta rama."
echo "NO realizar promoción hasta revisar $LOG/worker-deployments.json y $LOG/diff-vs-free-shell-app.txt."
echo "LOG: $LOG"
