#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawvo-pwa-install"
PUBLIC_CODE="DXVENXUTW5"
DB_NAME="intap_db"

fail() {
  echo ""
  echo "✗ ERROR: $1"
  exit 1
}

run_d1() {
  local sql="$1"
  (cd "$ROOT/api" && npx wrangler d1 execute "$DB_NAME" --remote --config wrangler.toml --command "$sql")
}

cd "$ROOT" || fail "No existe $ROOT"
[ "$(git branch --show-current)" = "$BRANCH" ] || fail "Rama incorrecta: $(git branch --show-current)"

echo "▶ Actualizando rama"
git pull --ff-only github "$BRANCH"

echo ""
echo "============================================================"
echo "REACTIVACIÓN CONTROLADA DE ARTEFACTO DE PRUEBA"
echo "Código público: $PUBLIC_CODE"
echo "Base D1:        $DB_NAME (PRODUCCIÓN)"
echo "============================================================"

echo ""
echo "▶ Estado ANTES"
run_d1 "SELECT a.id,a.public_code,a.product_type,a.status,a.owner_user_id,a.profile_id,a.activated_at, CASE WHEN a.owner_user_id IS NULL THEN 0 ELSE EXISTS(SELECT 1 FROM users u WHERE u.id=a.owner_user_id) END AS owner_exists, CASE WHEN a.profile_id IS NULL THEN 0 ELSE EXISTS(SELECT 1 FROM profiles p WHERE p.id=a.profile_id) END AS profile_exists FROM intap_artifacts a WHERE a.public_code='$PUBLIC_CODE';"
run_d1 "SELECT ac.id,ac.status,ac.expires_at,ac.used_at,ac.failed_attempts,ac.created_at FROM artifact_activation_codes ac JOIN intap_artifacts a ON a.id=ac.artifact_id WHERE a.public_code='$PUBLIC_CODE' ORDER BY ac.created_at DESC,ac.id DESC;"
run_d1 "SELECT COUNT(*) AS claim_count FROM artifact_activation_claims c JOIN intap_artifacts a ON a.id=c.artifact_id WHERE a.public_code='$PUBLIC_CODE';"

# Seguridad: solo permite liberar el artefacto si no existe ya un propietario vivo.
echo ""
echo "▶ Verificando que no esté asignado a un usuario existente"
GUARD_SQL="SELECT CASE WHEN EXISTS(SELECT 1 FROM intap_artifacts a JOIN users u ON u.id=a.owner_user_id WHERE a.public_code='$PUBLIC_CODE') THEN 'BLOCKED' WHEN EXISTS(SELECT 1 FROM intap_artifacts a WHERE a.public_code='$PUBLIC_CODE') THEN 'OK' ELSE 'MISSING' END AS guard_state;"
run_d1 "$GUARD_SQL"

# Si hubiera un propietario existente, el UPDATE del artefacto no hará cambios.
# Revocamos intents viejos y retiramos el receipt anterior para que la restricción
# UNIQUE de artifact_activation_claims no bloquee un nuevo claim del mismo artículo.
echo ""
echo "▶ Reactivando artefacto"
run_d1 "UPDATE artifact_activation_intents SET status='revoked', revoked_at=datetime('now') WHERE artifact_id=(SELECT id FROM intap_artifacts WHERE public_code='$PUBLIC_CODE') AND status='active';"
run_d1 "DELETE FROM artifact_activation_claims WHERE artifact_id=(SELECT id FROM intap_artifacts WHERE public_code='$PUBLIC_CODE') AND NOT EXISTS(SELECT 1 FROM users u JOIN intap_artifacts a ON a.owner_user_id=u.id WHERE a.public_code='$PUBLIC_CODE');"
run_d1 "UPDATE intap_artifacts SET owner_user_id=NULL, profile_id=NULL, status='available', activated_at=NULL, updated_at=datetime('now') WHERE public_code='$PUBLIC_CODE' AND NOT EXISTS(SELECT 1 FROM users u WHERE u.id=intap_artifacts.owner_user_id);"
run_d1 "UPDATE artifact_activation_codes SET status='active', used_at=NULL, failed_attempts=0, last_attempt_at=NULL, expires_at=NULL WHERE id=(SELECT ac.id FROM artifact_activation_codes ac JOIN intap_artifacts a ON a.id=ac.artifact_id WHERE a.public_code='$PUBLIC_CODE' ORDER BY ac.created_at DESC,ac.id DESC LIMIT 1) AND EXISTS(SELECT 1 FROM intap_artifacts a WHERE a.public_code='$PUBLIC_CODE' AND a.owner_user_id IS NULL AND a.profile_id IS NULL AND a.status='available');"

echo ""
echo "▶ Estado DESPUÉS"
run_d1 "SELECT a.id,a.public_code,a.product_type,a.status,a.owner_user_id,a.profile_id,a.activated_at FROM intap_artifacts a WHERE a.public_code='$PUBLIC_CODE';"
run_d1 "SELECT ac.id,ac.status,ac.expires_at,ac.used_at,ac.failed_attempts,ac.created_at FROM artifact_activation_codes ac JOIN intap_artifacts a ON a.id=ac.artifact_id WHERE a.public_code='$PUBLIC_CODE' ORDER BY ac.created_at DESC,ac.id DESC LIMIT 1;"
run_d1 "SELECT COUNT(*) AS claim_count FROM artifact_activation_claims c JOIN intap_artifacts a ON a.id=c.artifact_id WHERE a.public_code='$PUBLIC_CODE';"

echo ""
echo "▶ Validando flujo público"
STATUS="$(curl -fsS -X POST https://intaprd.com/api/v1/public/artifacts/scan/status -H 'content-type: application/json' --data \"{\\\"public_code\\\":\\\"$PUBLIC_CODE\\\"}\")" || fail "No respondió scan/status"
echo "$STATUS"
echo "$STATUS" | grep -q '"state":"pending_activation"' || fail "El artefacto no quedó pending_activation"

echo ""
echo "============================================================"
echo "✓ CÓDIGO $PUBLIC_CODE REACTIVADO EN PRODUCCIÓN"
echo "Estado esperado: pending_activation"
echo "============================================================"
