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
node scripts/test-sponsored-profile-contract.mjs
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
for entry in "intap_db_preview|wrangler.preview.toml|PREVIEW" "intap_db|wrangler.toml|PRODUCCION"; do
  IFS='|' read -r db config label <<< "$entry"
  printf '\n===== %s: validar SQL sin leer filas =====\n' "$label"
  (cd api && npx --no-install wrangler d1 execute "$db" --remote --config "$config" --command "$SQL_COUNT")
  (cd api && npx --no-install wrangler d1 execute "$db" --remote --config "$config" --command "$SQL_DETAIL")
done
echo "VALIDACION COMPLETA. No se desplegó ni se modificaron datos."
