#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawvo-onboarding-product-flow-v1"
LOG_DIR="$ROOT/.prod-team-source-truth-readonly-2026-09-09"
mkdir -p "$LOG_DIR"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
section(){ echo; echo "============================================================"; echo "$1"; echo "============================================================"; }

cd "$ROOT" || fail "No existe $ROOT"

section "AUDITORIA PRODUCCION · SOLO LECTURA"
echo "Este script NO despliega, NO aplica migraciones y NO modifica D1."

git fetch github main "$BRANCH" >/dev/null
MAIN_SHA="$(git rev-parse github/main)"
FEATURE_SHA="$(git rev-parse github/$BRANCH)"
echo "main:    $MAIN_SHA"
echo "feature: $FEATURE_SHA"

git diff --check github/main..."github/$BRANCH" || true

section "SUPERFICIES PRODUCCION"
for url in \
  "https://intaprd.com/" \
  "https://app.intaprd.com/admin/login" \
  "https://app.intaprd.com/admin/free/team" \
  "https://api.intaprd.com/api/health" \
  "https://app.intaprd.com/api/health"; do
  echo "--- $url"
  curl -sS -D - -o /tmp/kawvo-prod-body.$$ --connect-timeout 10 --max-time 20 "$url" | sed -n '1,20p' || true
  echo "BODY:"
  head -c 500 /tmp/kawvo-prod-body.$$ 2>/dev/null || true
  echo
  rm -f /tmp/kawvo-prod-body.$$
done

section "DEPLOYMENTS CLOUDFLARE · SOLO LECTURA"
echo "--- Worker intap-api"
(cd api && npx wrangler deployments list --name intap-api 2>&1 | tee "$LOG_DIR/worker-deployments.txt") || true

echo
for project in intap-link intap-web2; do
  echo "--- Pages $project"
  npx wrangler pages deployment list --project-name "$project" 2>&1 | tee "$LOG_DIR/pages-$project.txt" || true
  echo
done

section "D1 PRODUCCION · INTEGRIDAD GLOBAL"
read_sql(){
  local label="$1"; shift
  local sql="$1"
  echo "--- $label"
  (cd api && npx wrangler d1 execute intap_db --remote --config wrangler.toml --command="$sql") || fail "Falló consulta read-only: $label"
}

read_sql "Team members ↔ artifacts" "SELECT COUNT(*) AS broken_member_artifact FROM team_members tm JOIN intap_artifacts a ON a.id=tm.artifact_id WHERE tm.status='active' AND (COALESCE(a.profile_id,'')<>COALESCE(tm.profile_id,'') OR a.status NOT IN('activated','suspended'));"

read_sql "Team used codes ↔ members" "SELECT COUNT(*) AS broken_used_code FROM team_link_codes tc LEFT JOIN team_members tm ON tm.invite_code_id=tc.id WHERE tc.status='used' AND (tm.id IS NULL OR COALESCE(tc.member_profile_id,'')<>COALESCE(tm.profile_id,'') OR COALESCE(tc.artifact_id,'')<>COALESCE(tm.artifact_id,''));"

read_sql "Team profiles missing marker" "SELECT COUNT(*) AS missing_team_marker FROM team_members tm JOIN profiles p ON p.id=tm.profile_id WHERE COALESCE(json_extract(p.template_data,'$.team_member'),0)<>1;"

read_sql "Artifacts activated without matching Team row" "SELECT COUNT(*) AS activated_without_team FROM intap_artifacts a LEFT JOIN team_members tm ON tm.artifact_id=a.id WHERE a.status='activated' AND a.profile_id IS NOT NULL AND tm.id IS NULL;"

read_sql "Team members on available/unassigned artifacts" "SELECT COUNT(*) AS team_on_unclaimed_artifact FROM team_members tm JOIN intap_artifacts a ON a.id=tm.artifact_id WHERE tm.status='active' AND a.status IN('available','unassigned');"

section "ULTIMAS TRANSICIONES TEAM EN PRODUCCION"
read_sql "Últimos 25 Team members" "SELECT tm.id member_id,tm.team_id,tm.profile_id,tm.artifact_id,tm.invite_code_id,tm.status,tm.admin_role,tm.joined_at,p.slug,a.public_code,a.status artifact_status,tc.status code_status,tc.used_at FROM team_members tm LEFT JOIN profiles p ON p.id=tm.profile_id LEFT JOIN intap_artifacts a ON a.id=tm.artifact_id LEFT JOIN team_link_codes tc ON tc.id=tm.invite_code_id ORDER BY tm.joined_at DESC LIMIT 25;"

read_sql "Últimos 25 códigos Team usados" "SELECT tc.id,tc.team_id,tc.code,tc.status,tc.artifact_id,tc.member_profile_id,tc.used_at,a.public_code,a.status artifact_status,p.slug FROM team_link_codes tc LEFT JOIN intap_artifacts a ON a.id=tc.artifact_id LEFT JOIN profiles p ON p.id=tc.member_profile_id WHERE tc.status='used' ORDER BY tc.used_at DESC LIMIT 25;"

read_sql "Últimos 25 artifacts cambiados" "SELECT id,public_code,status,owner_user_id,profile_id,activated_at,updated_at FROM intap_artifacts ORDER BY updated_at DESC LIMIT 25;"

section "CASO ESPECIFICO OPCIONAL"
echo "Si conoces el código público del producto defectuoso, vuelve a ejecutar así:"
echo "  PRODUCT_CODE=XXXXXXXX bash $0"
if [ -n "${PRODUCT_CODE:-}" ]; then
  SAFE_CODE="$(printf '%s' "$PRODUCT_CODE" | tr '[:lower:]' '[:upper:]' | tr -cd 'A-Z2-9')"
  [ -n "$SAFE_CODE" ] || fail "PRODUCT_CODE inválido"
  echo "Auditando PRODUCT_CODE=$SAFE_CODE"
  read_sql "Producto + Team + código + perfil" "SELECT a.id artifact_id,a.public_code,a.status artifact_status,a.owner_user_id,a.profile_id artifact_profile_id,a.activated_at,a.updated_at,tm.id member_id,tm.team_id,tm.user_id member_user_id,tm.profile_id member_profile_id,tm.invite_code_id,tm.status member_status,tm.admin_role,tm.joined_at,tc.code team_code,tc.status team_code_status,tc.used_at team_code_used_at,tc.member_profile_id code_profile_id,tc.artifact_id code_artifact_id,p.slug,p.name,p.is_published,json_extract(p.template_data,'$.team_member') team_marker,json_extract(p.template_data,'$.team_master_profile_id') master_profile_marker FROM intap_artifacts a LEFT JOIN team_members tm ON tm.artifact_id=a.id LEFT JOIN team_link_codes tc ON tc.id=tm.invite_code_id LEFT JOIN profiles p ON p.id=a.profile_id WHERE a.public_code='$SAFE_CODE' LIMIT 5;"
fi

section "FIN AUDITORIA READ-ONLY"
echo "No se modificó Producción."
echo "Logs locales: $LOG_DIR"
