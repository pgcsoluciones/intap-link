#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawvo-pwa-install"
DB="intap_db"
CODE="DXVENXUTW5"
EXPECTED_USER_ID="395057f6-b40b-4beb-ba5d-1c41377806b1"
EXPECTED_EMAIL="intapcard@gmail.com"

fail(){ echo ""; echo "✗ ERROR: $1"; exit 1; }
run_sql(){ (cd "$ROOT/api" && npx wrangler d1 execute "$DB" --remote --command "$1"); }

cd "$ROOT" || fail "No existe $ROOT"
[ "$(git branch --show-current)" = "$BRANCH" ] || fail "Rama incorrecta"
git pull --ff-only github "$BRANCH"

echo "============================================================"
echo "REACTIVACIÓN FINAL CONTROLADA · $CODE"
echo "Base: $DB (PRODUCCIÓN)"
echo "============================================================"

# Guardas exactas: artefacto, owner esperado, email esperado y ausencia de perfil.
ART_GUARD=$(run_sql "SELECT CASE WHEN EXISTS(SELECT 1 FROM intap_artifacts WHERE public_code='$CODE' AND owner_user_id='$EXPECTED_USER_ID' AND status='activated' AND profile_id IS NULL) THEN 'OK' ELSE 'NO' END AS g;" 2>&1)
echo "$ART_GUARD"
echo "$ART_GUARD" | grep -q 'OK' || fail "El artefacto ya no coincide con el estado esperado"

USER_GUARD=$(run_sql "SELECT CASE WHEN EXISTS(SELECT 1 FROM users WHERE id='$EXPECTED_USER_ID' AND lower(email)=lower('$EXPECTED_EMAIL')) AND NOT EXISTS(SELECT 1 FROM profiles WHERE user_id='$EXPECTED_USER_ID') THEN 'OK' ELSE 'NO' END AS g;" 2>&1)
echo "$USER_GUARD"
echo "$USER_GUARD" | grep -q 'OK' || fail "El usuario residual no coincide con la cuenta de prueba esperada"

echo "▶ Revocando sesiones residuales de la cuenta de prueba"
run_sql "UPDATE auth_sessions SET revoked_at=datetime('now') WHERE user_id='$EXPECTED_USER_ID' AND revoked_at IS NULL;"

echo "▶ Revocando intents antiguos"
run_sql "UPDATE artifact_activation_intents SET status='revoked', revoked_at=COALESCE(revoked_at, datetime('now')) WHERE artifact_id=(SELECT id FROM intap_artifacts WHERE public_code='$CODE') AND status='active';"

echo "▶ Eliminando receipt de claim anterior del artefacto"
run_sql "DELETE FROM artifact_activation_claims WHERE artifact_id=(SELECT id FROM intap_artifacts WHERE public_code='$CODE');"

echo "▶ Reactivando exclusivamente el código de activación más reciente"
run_sql "UPDATE artifact_activation_codes SET status='revoked' WHERE artifact_id=(SELECT id FROM intap_artifacts WHERE public_code='$CODE'); UPDATE artifact_activation_codes SET status='active', used_at=NULL, failed_attempts=0, last_attempt_at=NULL WHERE id=(SELECT id FROM artifact_activation_codes WHERE artifact_id=(SELECT id FROM intap_artifacts WHERE public_code='$CODE') ORDER BY created_at DESC, id DESC LIMIT 1);"

echo "▶ Liberando artefacto"
run_sql "UPDATE intap_artifacts SET status='available', owner_user_id=NULL, profile_id=NULL, activated_at=NULL, updated_at=datetime('now') WHERE public_code='$CODE' AND owner_user_id='$EXPECTED_USER_ID' AND profile_id IS NULL;"

echo "▶ Estado final"
run_sql "SELECT id, public_code, product_type, status, owner_user_id, profile_id, activated_at FROM intap_artifacts WHERE public_code='$CODE';"
run_sql "SELECT id,status,expires_at,used_at,failed_attempts,created_at FROM artifact_activation_codes WHERE artifact_id=(SELECT id FROM intap_artifacts WHERE public_code='$CODE') ORDER BY created_at DESC;"
run_sql "SELECT COUNT(*) AS claim_count FROM artifact_activation_claims WHERE artifact_id=(SELECT id FROM intap_artifacts WHERE public_code='$CODE');"
run_sql "SELECT COUNT(*) AS active_sessions FROM auth_sessions WHERE user_id='$EXPECTED_USER_ID' AND revoked_at IS NULL AND expires_at > datetime('now');"

FINAL_GUARD=$(run_sql "SELECT CASE WHEN EXISTS(SELECT 1 FROM intap_artifacts a WHERE a.public_code='$CODE' AND a.status='available' AND a.owner_user_id IS NULL AND a.profile_id IS NULL AND EXISTS(SELECT 1 FROM artifact_activation_codes ac WHERE ac.artifact_id=a.id AND ac.status='active' AND (ac.expires_at IS NULL OR ac.expires_at > datetime('now')))) AND NOT EXISTS(SELECT 1 FROM artifact_activation_claims c WHERE c.artifact_id=a.id) THEN 'READY' ELSE 'NOT_READY' END AS state FROM intap_artifacts a WHERE a.public_code='$CODE';" 2>&1)
echo "$FINAL_GUARD"
echo "$FINAL_GUARD" | grep -q 'READY' || fail "El artefacto no quedó completamente reactivado"

echo ""
echo "✓ $CODE quedó disponible para una nueva activación"
