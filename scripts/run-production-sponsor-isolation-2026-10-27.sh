#!/usr/bin/env bash
# Kawvo · Sponsor isolation PR #123 · producción controlada
set -euo pipefail
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
MODE="${1:-preflight}"
REMOTE=github
BRANCH=hotfix/sponsor-account-isolation-2026-10-27
PR_BASE=4cf35f9b1fca7e3282621813dbf3a34c3df1444f
REQUIRED=065f682e7bccde7ff2e5e4ceba1583703b946ce4
LOG_DIR="$HOME/intap-release-logs/sponsor-isolation-$(date -u +%Y%m%dT%H%M%SZ)"
fail(){ echo "ERROR: $*" >&2; exit 1; }
run(){ printf '▶'; printf ' %q' "$@"; printf '\n'; "$@"; }
[[ "$MODE" == preflight || "$MODE" == deploy ]] || fail "Usar preflight|deploy"
cd "$ROOT" || fail "Repositorio local no encontrado"
[[ -z "$(git status --porcelain)" ]] || fail "Checkout contiene cambios locales; detener"
run git fetch "$REMOTE" main "$BRANCH"
if [[ "$MODE" == preflight ]]; then
  run git switch "$BRANCH"
  run git pull --ff-only "$REMOTE" "$BRANCH"
else
  [[ "${KAWVO_SPONSOR_PROD_APPROVED:-}" == "DAPSA_MICM_RELEASE_AUTORIZADO" ]] || fail "Falta aprobación explícita para despliegue productivo"
  run git switch main
  run git pull --ff-only "$REMOTE" main
  git merge-base --is-ancestor "$REQUIRED" HEAD || fail "PR #123 no incorporado en main o merge no preservó historial"
fi
[[ -z "$(git status --porcelain)" ]] || fail "Checkout sucio"
git merge-base --is-ancestor "$PR_BASE" HEAD || fail "Base PR #123 no es ancestro"
git diff --check "$PR_BASE"...HEAD
if [[ "$MODE" == preflight ]]; then
  git merge-base --is-ancestor "$REMOTE/main" HEAD || fail "Candidato no basado en main actual"
  DIFF_BASE="$REMOTE/main"
else
  [[ "$(git rev-parse HEAD)" == "$(git rev-parse "$REMOTE/main")" ]] || fail "main diverge del remoto"
  DIFF_BASE="$PR_BASE"
fi
echo "▶ Validando alcance sponsor"
while IFS= read -r file; do
  [[ -z "$file" ]] && continue
  case "$file" in
    api/src/sponsored-media.ts|api/src/sponsored-profiles.ts|app/src/components/admin/IntapcardAccountSelector.tsx|app/src/components/admin/sponsored/SponsorDashboard.tsx|docs/handoffs/BITACORA_MAESTRA_INTAP_KAWMED_MULTICUENTA_PATROCINIO_2026-10-27.md|scripts/run-preview-sponsor-isolation-2026-10-27.sh|scripts/test-intapcard-active-account-contract.mjs|scripts/run-production-sponsor-isolation-2026-10-27.sh) ;;
    *) fail "Archivo inesperado en cambio de sponsor: $file" ;;
  esac
done < <(git diff --name-only "$DIFF_BASE"...HEAD)
if git diff --name-only "$DIFF_BASE"...HEAD | grep -Eq '^(api/migrations/|api/migrations-preview/|package(-lock)?\.json|api/wrangler.toml|web/|functions/)'; then
  fail "Cambios de esquema, dependencias, Web o infraestructura fuera de alcance"
fi
run npm ci
run npm audit --omit=dev --audit-level=critical
run node scripts/test-intapcard-active-account-contract.mjs
run node scripts/test-intapcard-multiaccount-contract.mjs
run node scripts/test-intapcard-kawmed-integrated-contract.mjs
run npx tsc --noEmit -p api/tsconfig.json
run env VITE_API_URL=https://api.intaprd.com VITE_WEB_URL=https://intaprd.com VITE_ENVIRONMENT=production npm run build -w app
grep -RlF 'https://api.intaprd.com' app/dist/assets --include='*.js' >/dev/null || fail "App build no usa API productiva"
( cd api && run npx wrangler deploy --config wrangler.toml --dry-run )
echo "✓ Contratos, build, auditoría y Worker dry-run correctos"
if [[ "$MODE" == preflight ]]; then
 echo "✓ PREFLIGHT finalizado sin deploy, sin cambios de D1"
 exit 0
fi
[[ "$(git ls-remote "$REMOTE" refs/heads/main | cut -f1)" == "$(git rev-parse HEAD)" ]] || fail "main cambió durante preflight"
mkdir -p "$LOG_DIR"
echo "▶ Exportando D1 antes del hotfix; sin migraciones"
( cd api && run npx wrangler d1 export intap_db --remote --config wrangler.toml --output="$LOG_DIR/intap_db_before_sponsor_hotfix.sql" )
[[ -s "$LOG_DIR/intap_db_before_sponsor_hotfix.sql" ]] || fail "Backup D1 falló"
echo "▶ API Producción"
( cd api && npx wrangler deploy --config wrangler.toml 2>&1 | tee "$LOG_DIR/api-deploy.log" )
HEALTH="$(curl -sSL --max-time 30 -o "$LOG_DIR/api-health.json" -w '%{http_code}' https://api.intaprd.com/api/health)"
[[ "$HEALTH" == 200 ]] || fail "Health API productivo HTTP $HEALTH; NO desplegar App"
echo "▶ App Producción"
npx wrangler pages deploy app/dist --project-name intap-web2 --branch main 2>&1 | tee "$LOG_DIR/app-deploy.log"
for path in /admin/accounts /admin/sponsor; do
  HTTP="$(curl -sSL --max-time 30 -o /dev/null -w '%{http_code}' "https://app.intaprd.com$path")"
  [[ "$HTTP" == 200 ]] || fail "App $path HTTP $HTTP"
done
echo "✓ Hotfix Producción publicado: $(git rev-parse HEAD)"
echo "✓ Backup D1: $LOG_DIR/intap_db_before_sponsor_hotfix.sql"
echo "✓ Logs: $LOG_DIR"
echo "✓ Ninguna migración aplicada; Web pública no desplegada"
