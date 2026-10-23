#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
command -v sqlite3 >/dev/null || { echo "ERROR: sqlite3 requerido para ensayo de eliminación" >&2; exit 1; }
BACKUPS="$HOME/kawmed-db-production-backups"
BACKUP="$(find "$BACKUPS" -maxdepth 1 -name "intap_db_before_kawmed_*.sql" -type f -size +0c | sort | tail -1)"
[ -n "$BACKUP" ] || { echo "ERROR: no existe respaldo D1 pre-KawMed" >&2; exit 1; }
(cd "$BACKUPS" && shasum -a 256 -c "$(basename "$BACKUP").sha256")
TMP="$(mktemp -d "${TMPDIR:-/tmp}/kawmed-account-delete.XXXXXXXX")"
trap 'rm -rf "$TMP"' EXIT
DB="$TMP/rehearsal.sqlite"
sqlite3 "$DB" < "$BACKUP"
[ "$(sqlite3 "$DB" "PRAGMA integrity_check;")" = ok ] || { echo "ERROR: respaldo no íntegro" >&2; exit 1; }
for name in 0090_kawmed_medical_profiles_v1.sql 0091_kawmed_insurance_exclusions.sql 0092_kawmed_shared_appointments.sql 0093_kawmed_medical_appointment_reasons.sql 0094_kawmed_private_sponsorship.sql 0095_kawmed_access_codes_programs.sql 0096_kawmed_representatives_traceability.sql 0097_kawmed_master_multiaccount.sql 0098_kawmed_accepted_insurances.sql 0099_kawmed_master_public_profile.sql 0150_kawmed_appearance_v2.sql; do
 sqlite3 -bail "$DB" < "$ROOT/api/migrations/$name"
done
ID="kawmed-delete-check-$(date -u +%s)-$$"
PROFILE="kawmed-profile-delete-check-$(date -u +%s)-$$"
EMAIL="kawmed-delete-check-$(date -u +%s)-$$@example.invalid"
cat > "$TMP/delete.sql" <<SQL
PRAGMA foreign_keys = ON;
.bail on
INSERT INTO users(id,email) VALUES('$ID','$EMAIL');
INSERT INTO medical_profiles(id,user_id,slug,name,specialty,email,status) VALUES('$PROFILE','$ID','$ID','Prueba de eliminación','Medicina','$EMAIL','draft');
BEGIN TRANSACTION;
UPDATE medical_profiles SET status='inactive' WHERE id='$PROFILE' AND user_id='$ID';
UPDATE medical_access_codes SET status='inactive',claimed_by_user_id=NULL,medical_profile_id=NULL,updated_at=datetime('now') WHERE claimed_by_user_id='$ID';
DELETE FROM appointment_requests WHERE subject_type='medical' AND subject_id='$PROFILE';
DELETE FROM appointment_blocks WHERE subject_type='medical' AND subject_id='$PROFILE';
DELETE FROM appointment_reasons WHERE subject_type='medical' AND subject_id='$PROFILE';
DELETE FROM appointment_availability WHERE subject_type='medical' AND subject_id='$PROFILE';
DELETE FROM appointment_settings WHERE subject_type='medical' AND subject_id='$PROFILE';
DELETE FROM medical_profiles WHERE id='$PROFILE' AND user_id='$ID';
DELETE FROM auth_sessions WHERE user_id='$ID';
DELETE FROM users WHERE id='$ID';
COMMIT;
SELECT CASE WHEN EXISTS(SELECT 1 FROM users WHERE email='$EMAIL') THEN 'FAIL: email retained' ELSE 'PASS: email released' END;
SQL
RESULT="$(sqlite3 -bail "$DB" < "$TMP/delete.sql")" || { echo "ERROR: ensayo de eliminación falló (FK o tabla incompatible)" >&2; exit 1; }
[ "$RESULT" = "PASS: email released" ] || { echo "ERROR: $RESULT" >&2; exit 1; }
echo "✓ Eliminación ensayada en copia local con FK habilitadas; correo sintético liberado. Producción sin cambios."
