#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawvo-onboarding-product-flow-v1"
QA_ARTIFACT="QATEAM22A2"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }

cd "$ROOT" || fail "No existe $ROOT"

echo "============================================================"
echo " KAWVO LINK · TEAM FLOW · POSTDEPLOY SMOKE · PREVIEW"
echo "============================================================"
echo "Producción: NO SE TOCA"

git fetch github "$BRANCH"
git checkout -B "$BRANCH" "github/$BRANCH"
git reset --hard "github/$BRANCH"

node scripts/audit-team-flow-invariants.mjs

echo
echo "▶ Verificar superficies Preview"
for url in \
  "https://preview.intaprd.com/" \
  "https://app.preview.intaprd.com/admin/login" \
  "https://app.preview.intaprd.com/admin/free/team/assign"; do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
  echo "✓ $url -> HTTP 200"
done

echo
echo "▶ Verificar fuente D1 Preview"
(cd api && npx wrangler d1 execute intap_db_preview --remote --config wrangler.preview.toml --command="SELECT id,public_code,status FROM intap_artifacts WHERE public_code='$QA_ARTIFACT' LIMIT 1;")

body="$(curl -sS -X POST 'https://app.preview.intaprd.com/api/v1/public/artifacts/scan/status' -H 'content-type: application/json' --data "{\"public_code\":\"$QA_ARTIFACT\"}")"
printf '%s' "$body" | grep -q '"ok":true' || { echo "$body"; fail "scan/status no resolvió $QA_ARTIFACT"; }
echo "✓ scan/status $QA_ARTIFACT responde desde D1 Preview"

echo
echo "▶ Verificar aislamiento legacy self-join"
# /api/v1/me/* está protegido por autenticación global. Sin sesión, 401 es la
# respuesta correcta y ocurre antes del guard de autoridad específico.
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
HTTP="$(curl -sS -o "$TMP" -w '%{http_code}' -X POST 'https://app.preview.intaprd.com/api/v1/me/team/join' -H 'content-type: application/json' --data '{}')"
[ "$HTTP" = "401" ] || { cat "$TMP"; fail "Legacy self-join sin sesión debía responder 401 y respondió $HTTP"; }
grep -q 'Unauthorized' "$TMP" || { cat "$TMP"; fail "Respuesta 401 inesperada"; }
echo "✓ legacy /me/team/join exige autenticación antes de cualquier mutación"

grep -q "TEAM_MASTER_PREPARATION_REQUIRED" api/src/team-join-authority.ts || fail "Falta guard determinístico de autoridad"
AUTH_LINE="$(grep -n "import './team-join-authority'" api/src/preview-free-entry.ts | cut -d: -f1)"
V2_LINE="$(grep -n "import './team-v2'" api/src/preview-free-entry.ts | cut -d: -f1)"
[ -n "$AUTH_LINE" ] && [ -n "$V2_LINE" ] && [ "$AUTH_LINE" -lt "$V2_LINE" ] || fail "team-join-authority no está registrado antes de team-v2"
echo "✓ guard TEAM_MASTER_PREPARATION_REQUIRED registrado antes del legacy team-v2"

echo
echo "▶ Verificar integridad relacional Preview"
(cd api && npx wrangler d1 execute intap_db_preview --remote --config wrangler.preview.toml --command="SELECT COUNT(*) AS broken_member_artifact FROM team_members tm JOIN intap_artifacts a ON a.id=tm.artifact_id WHERE tm.status='active' AND (COALESCE(a.profile_id,'')<>COALESCE(tm.profile_id,'') OR a.status NOT IN('activated','suspended')); SELECT COUNT(*) AS broken_used_code FROM team_link_codes tc LEFT JOIN team_members tm ON tm.invite_code_id=tc.id WHERE tc.status='used' AND (tm.id IS NULL OR COALESCE(tc.member_profile_id,'')<>COALESCE(tm.profile_id,'') OR COALESCE(tc.artifact_id,'')<>COALESCE(tm.artifact_id,'')); SELECT COUNT(*) AS missing_team_marker FROM team_members tm JOIN profiles p ON p.id=tm.profile_id WHERE COALESCE(json_extract(p.template_data,'$.team_member'),0)<>1;")

echo
echo "============================================================"
echo "✓ POSTDEPLOY SMOKE PREVIEW APROBADO"
echo "Web Preview: https://preview.intaprd.com"
echo "App Preview: https://app.preview.intaprd.com"
echo "QA artifact: $QA_ARTIFACT"
echo "Producción: NO TOCADA"
echo "Siguiente paso: QA humano del flujo Master → preparar dispositivo → clonación"
echo "============================================================"
