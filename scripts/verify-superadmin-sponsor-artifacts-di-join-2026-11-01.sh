#!/usr/bin/env bash
set -euo pipefail
cd "$HOME/Desktop/intap-link-universal-bilingual-audit"
[[ -z "$(git status --porcelain)" ]] || { echo "Hay cambios locales; abortando."; exit 1; }
git fetch github fix/superadmin-sponsor-artifacts-di-join-2026-11-01
git switch fix/superadmin-sponsor-artifacts-di-join-2026-11-01
git pull --ff-only github fix/superadmin-sponsor-artifacts-di-join-2026-11-01
git merge-base --is-ancestor 951d9976 HEAD
git diff --check 951d9976..HEAD
while IFS= read -r p; do
  case "$p" in
    api/src/sponsored-profiles.ts|scripts/test-superadmin-sponsor-artifacts-di-join-2026-11-01.mjs|scripts/verify-superadmin-sponsor-artifacts-di-join-2026-11-01.sh) ;;
    *) echo "Archivo fuera del alcance: $p"; exit 1 ;;
  esac
done < <(git diff --name-only 951d9976..HEAD)
node scripts/test-superadmin-sponsor-artifacts-di-join-2026-11-01.mjs
node scripts/test-sponsored-owner-context-denial-2026-11-01.mjs
(cd api && npx --no-install tsc --noEmit && npx --no-install wrangler deploy --config wrangler.toml --dry-run)
# Validate exact table/column references against BOTH remote D1 databases without reading rows.
SQL_DETAIL=$(cat <<'SQL'
SELECT a.public_code,di.display_code,a.product_type,a.status AS artifact_status,
sa.status,sa.artifact_role,sa.banner_enabled,sa.activated_at,sa.created_at,
sp.username,sp.business_name,u.email AS email,sp.status AS profile_status,
b.name AS batch_name,b.city,b.zone
FROM sponsor_artifacts sa
JOIN intap_artifacts a ON a.id=sa.artifact_id
LEFT JOIN artifact_display_identifiers di ON di.artifact_id=a.id
LEFT JOIN sponsored_profiles sp ON sp.id=sa.sponsored_profile_id
LEFT JOIN users u ON u.id=COALESCE(sp.user_id,sa.beneficiary_user_id)
LEFT JOIN sponsor_batches b ON b.id=sa.batch_id
WHERE 1=0 LIMIT 0
SQL
)
SQL_COUNT=$(cat <<'SQL'
SELECT COUNT(*) AS total FROM sponsor_artifacts sa
JOIN intap_artifacts a ON a.id=sa.artifact_id
LEFT JOIN artifact_display_identifiers di ON di.artifact_id=a.id
LEFT JOIN sponsored_profiles sp ON sp.id=sa.sponsored_profile_id
LEFT JOIN users u ON u.id=COALESCE(sp.user_id,sa.beneficiary_user_id)
LEFT JOIN sponsor_batches b ON b.id=sa.batch_id
WHERE 1=0
SQL
)
# Cloudflare D1 has intermittently returned HTTP 7403 to the same authenticated
# account despite successful SELECT 1 queries. Retry ONLY this transient code;
# schema errors and all other errors fail closed immediately.
d1_select_with_retry(){
  local db="$1" config="$2" statement="$3" label="$4"
  local attempt=1 output=''
  while [ "$attempt" -le 3 ]; do
    if output=$(cd api && npx --no-install wrangler d1 execute "$db" --remote --config "$config" --command "$statement" 2>&1); then
      printf '%s: consulta de esquema OK (intento %s).\n' "$label" "$attempt"
      return 0
    fi
    if [[ "$output" != *"[code: 7403]"* ]]; then
      echo "$label: fallo distinto de 7403; verificación detenida." >&2
      printf '%s\n' "$output" >&2
      return 1
    fi
    if [ "$attempt" -eq 3 ]; then
      echo "$label: Cloudflare 7403 persiste tras 3 intentos; NO desplegar." >&2
      return 1
    fi
    echo "$label: Cloudflare 7403, reintento controlado $attempt/3..."
    sleep "$attempt"
    attempt=$((attempt+1))
  done
  return 1
}
for entry in "intap_db_preview|wrangler.preview.toml|PREVIEW" "intap_db|wrangler.toml|PRODUCCION"; do
  IFS='|' read -r db config label <<< "$entry"
  printf '\n===== %s: validar SQL sin leer filas =====\n' "$label"
  d1_select_with_retry "$db" "$config" "$SQL_COUNT" "$label/COUNT"
  d1_select_with_retry "$db" "$config" "$SQL_DETAIL" "$label/DETALLE"
done
echo "VALIDACION COMPLETA. No se desplegó ni se modificaron datos."
