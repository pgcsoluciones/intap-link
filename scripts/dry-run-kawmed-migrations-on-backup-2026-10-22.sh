#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-$HOME/Desktop/intap-link-universal-bilingual-audit}"
BACKUPS="$HOME/kawmed-db-production-backups"
cd "$ROOT" || exit 2
command -v sqlite3 >/dev/null || { echo "ERROR: sqlite3 no disponible"; exit 2; }
BACKUP="$(find "$BACKUPS" -maxdepth 1 -type f -name 'intap_db_before_kawmed_*.sql' -size +0c | sort | tail -1)"
[ -n "$BACKUP" ] || { echo "ERROR: respaldo D1 no encontrado"; exit 2; }
(cd "$(dirname "$BACKUP")" && shasum -a 256 -c "$(basename "$BACKUP").sha256")
TMP="$(mktemp -d "${TMPDIR:-/tmp}/kawmed-d1-dryrun.XXXXXXXX")"
trap 'rm -rf "$TMP"' EXIT
DB="$TMP/rehearsal.sqlite"
sqlite3 "$DB" < "$BACKUP"
[ "$(sqlite3 "$DB" 'PRAGMA integrity_check;')" = "ok" ] || { echo "ERROR: respaldo invalido"; exit 1; }
PRE_FK="$(sqlite3 "$DB" 'PRAGMA foreign_key_check;' | sort)"
echo "Respaldo restaurado; ensayo en archivo temporal."
if [ -n "$PRE_FK" ]; then
 echo "AVISO: infracciones de FK presentes ANTES de migrar:"
 printf '%s\n' "$PRE_FK"
fi
MIGRATIONS=(
  0090_kawmed_medical_profiles_v1.sql
  0091_kawmed_insurance_exclusions.sql
  0092_kawmed_shared_appointments.sql
  0093_kawmed_medical_appointment_reasons.sql
  0094_kawmed_private_sponsorship.sql
  0095_kawmed_access_codes_programs.sql
  0096_kawmed_representatives_traceability.sql
  0097_kawmed_master_multiaccount.sql
  0098_kawmed_accepted_insurances.sql
  0099_kawmed_master_public_profile.sql
  0150_kawmed_appearance_v2.sql
)
for name in "${MIGRATIONS[@]}"; do
 file="api/migrations/$name"
 [ -f "$file" ] || { echo "Falta $file"; exit 1; }
 if grep -qE 'kawmed_demo_laura_mendez|kawmed_ins_ex_1|kawmed_ins_accept_1' "$file"; then
   echo "ERROR: fixture de demostración en $name"; exit 1
 fi
 echo "Aplicando en copia temporal: $name"
 sqlite3 -bail "$DB" < "$file" || { echo "ERROR aplicando $name"; exit 1; }
done
[ "$(sqlite3 "$DB" 'PRAGMA integrity_check;')" = "ok" ] || { echo "ERROR de integridad"; exit 1; }
echo "Comparando infracciones FK antes y después..."
POST_FK="$(sqlite3 "$DB" 'PRAGMA foreign_key_check;' | sort)"
NEW_FK="$(comm -13 <(printf '%s\n' "$PRE_FK" | sed '/^$/d') <(printf '%s\n' "$POST_FK" | sed '/^$/d'))"
if [ -n "$NEW_FK" ]; then
 echo "ERROR: nuevas infracciones FK introducidas:"; printf '%s\n' "$NEW_FK"; exit 1
fi
if [ -n "$POST_FK" ]; then
 echo "AVISO: hay relaciones inconsistentes heredadas; requieren revisión separada."
 printf '%s\n' "$POST_FK"
fi
echo "OK: 11 migraciones aplicadas localmente sin nuevas infracciones FK."
echo "La DB de Producción NO ha sido modificada."
