#!/usr/bin/env bash
set -euo pipefail
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
cd "$ROOT"
git diff --quiet && git diff --cached --quiet || { echo "ERROR: archivos versionados modificados"; exit 1; }
# Los reportes sin seguimiento generados por preflight no bloquean la exportación.
grep -Fq 'database_name = "intap_db"' api/wrangler.toml
grep -Fq 'ENVIRONMENT = "production"' api/wrangler.toml
umask 077
DIR="$HOME/kawmed-db-production-backups"
mkdir -p "$DIR"
BACKUP="$DIR/intap_db_before_kawmed_$(date -u +%Y%m%dT%H%M%SZ).sql"
echo "Exportando base de datos de producción; NO se aplican migraciones..."
(cd api && npx wrangler d1 export intap_db --remote --config wrangler.toml --output "$BACKUP")
[ -s "$BACKUP" ] || { echo "ERROR: respaldo vacío"; exit 1; }
if command -v sqlite3 >/dev/null 2>&1; then
  RESTORE="$DIR/restore_check_$$.sqlite"
  trap 'rm -f "$RESTORE"' EXIT
  sqlite3 "$RESTORE" < "$BACKUP"
  RESULT="$(sqlite3 "$RESTORE" 'PRAGMA integrity_check;')"
  [ "$RESULT" = "ok" ] || { echo "ERROR: integridad de respaldo: $RESULT"; exit 1; }
  echo "Restauración local e integridad: OK"
else
  echo "AVISO: sqlite3 no disponible; restauración local no comprobada"
fi
shasum -a 256 "$BACKUP" > "$BACKUP.sha256"
chmod 600 "$BACKUP" "$BACKUP.sha256"
echo "Respaldo: $BACKUP"
echo "SHA256: $BACKUP.sha256"
echo "NO se modificó la base de datos remota."
