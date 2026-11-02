#!/usr/bin/env bash
# KawMed invitación: auditoría SOLO SELECT en Producción y Preview.
# INVITATION_ID se pasa por entorno; nunca se almacena en Git ni se imprime.
# No aplica migraciones, no escribe D1, no hace deploy ni cambios de código.
set -euo pipefail
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="audit/kawmed-live-invitation-prod-preview-2026-11-01"
BASE="444f3da79a85a87baa739f1eafac87891607885d"
ID="${INVITATION_ID:-}"
[[ "$ID" =~ ^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$ ]] || {
  echo "Falta INVITATION_ID con formato UUID. No se hicieron consultas."
  exit 1
}
cd "$ROOT"
[[ -z "$(git status --porcelain)" ]] || { echo "Hay cambios locales; abortando."; exit 1; }
git fetch github "$BRANCH"
git switch "$BRANCH"
git pull --ff-only github "$BRANCH"
git merge-base --is-ancestor "$BASE" HEAD
git diff --check "$BASE"..HEAD
[[ "$(git diff --name-only "$BASE"..HEAD)" == "scripts/audit-kawmed-live-invitation-prod-preview-2026-11-01.sh" ]] || {
  echo "La rama de auditoría incluye cambios inesperados. Abortando."
  exit 1
}
SCHEMA_SQL="SELECT name AS tabla_relevante FROM sqlite_master WHERE type='table' AND name IN ('kawmed_demo_invitations','kawmed_demo_live_access') ORDER BY name"
# The input UUID is validated, then used only inside a WHERE equality; no identifying
# columns are selected (no email, profile ID, invitation ID, token or patient data).
INVITE_SQL="SELECT
 CASE WHEN i.id IS NULL THEN 'NO_EXISTE' ELSE i.status END AS estado_invitacion,
 CASE WHEN g.invitation_id IS NULL THEN 'NO' ELSE 'SI' END AS acceso_editor_completo_vinculado,
 CASE WHEN i.id IS NULL THEN 'NO_APLICA' WHEN datetime(i.expires_at)>datetime('now') THEN 'SI' ELSE 'NO' END AS vigente
 FROM (SELECT 1) x
 LEFT JOIN kawmed_demo_invitations i ON i.id='$ID'
 LEFT JOIN kawmed_demo_live_access g ON g.invitation_id=i.id"
# A 7403 on remote D1 is sometimes transient; retry only 7403, max 3 times.
query(){
 local db="$1" config="$2" statement="$3" caption="$4" attempt=1 response=''
 while [ "$attempt" -le 3 ]; do
   if response=$(cd api && npx --no-install wrangler d1 execute "$db" --remote --config "$config" --command "$statement" 2>&1); then
     echo "$caption:"
     printf '%s\n' "$response" | sed -n '/Results:/,$p'
     # Wrangler versions may not print 'Results:'; then show only row-like lines.
     if ! printf '%s\n' "$response" | grep -q 'Results:'; then
       printf '%s\n' "$response" | grep -E 'tabla_relevante|estado_invitacion|acceso_editor_completo_vinculado|vigente|kawmed_demo_invitations|kawmed_demo_live_access|NO_EXISTE|pending|active|revoked|expired|NO_APLICA|NO|SI' || true
     fi
     return 0
   fi
   if [[ "$response" != *"[code: 7403]"* ]]; then
     echo "$caption: FALLÓ. $(printf '%s\n' "$response" | grep -m1 -E 'no such table|no such column|\[code: [0-9]+\]|ERROR' || echo 'Consulta no realizada')."
     return 1
   fi
   if [ "$attempt" -eq 3 ]; then echo "$caption: Cloudflare 7403 persistente (no se puede concluir).";return 1;fi
   echo "$caption: Cloudflare 7403, reintento $attempt/3..."
   sleep "$attempt"
   attempt=$((attempt+1))
 done
}
errors=0
for entry in "intap_db|wrangler.toml|PRODUCCION" "intap_db_preview|wrangler.preview.toml|PREVIEW"; do
 IFS='|' read -r db config env <<< "$entry"
 echo "===== $env: tablas y tipo de invitación (solo lectura) ====="
 query "$db" "$config" "$SCHEMA_SQL" "$env/TABLAS" || errors=$((errors+1))
 query "$db" "$config" "$INVITE_SQL" "$env/INVITACION" || errors=$((errors+1))
done
echo "AUDITORIA SOLO LECTURA FINALIZADA. Sin cambios en Producción ni Preview."
if [ "$errors" -gt 0 ];then echo "Algunas consultas fallaron. No asumir la causa ni desplegar sin revisar esos errores.";exit 1;fi
