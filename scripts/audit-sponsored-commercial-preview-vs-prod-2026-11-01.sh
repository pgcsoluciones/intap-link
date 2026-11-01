#!/usr/bin/env bash
# Auditoría remota estrictamente SELECT. No despliega ni exporta PII.
set -euo pipefail
cd "$HOME/Desktop/intap-link-universal-bilingual-audit"
[[ -z "$(git status --porcelain)" ]] || { echo "Hay cambios locales; no cambiar de rama."; exit 1; }
git fetch github audit/sponsored-commercial-preview-vs-prod-2026-11-01
git switch audit/sponsored-commercial-preview-vs-prod-2026-11-01
git pull --ff-only github audit/sponsored-commercial-preview-vs-prod-2026-11-01
git merge-base --is-ancestor 951d9976 HEAD
git diff --check 951d9976..HEAD
while IFS= read -r changed; do
  case "$changed" in
    scripts/audit-sponsored-commercial-preview-vs-prod-2026-11-01.sh) ;;
    *) echo "Archivo inesperado: $changed. Abortando."; exit 1 ;;
  esac
done < <(git diff --name-only 951d9976..HEAD)

SCHEMA_SQL="SELECT name AS tabla_presente FROM sqlite_master WHERE type='table' AND name IN ('sponsor_tenants','sponsored_profiles','sponsor_module_grants','sponsor_sales_representatives','sponsor_sales_assignments','sponsor_artifacts','sponsor_commercial_resources','users') ORDER BY name"

GRANTS_SQL=$(cat <<'SQL'
SELECT st.slug AS patrocinador,
 CASE WHEN EXISTS(SELECT 1 FROM sponsor_module_grants g WHERE g.sponsor_id=st.id AND g.module_code='commercial_seller' AND g.enabled=1) THEN 'SI' ELSE 'NO' END AS permiso_vendedor,
 CASE WHEN EXISTS(SELECT 1 FROM sponsor_module_grants g WHERE g.sponsor_id=st.id AND g.module_code='commercial_visitor' AND g.enabled=1) THEN 'SI' ELSE 'NO' END AS permiso_visitador,
 CASE WHEN EXISTS(SELECT 1 FROM sponsor_module_grants g WHERE g.sponsor_id=st.id AND g.module_code='commercial_catalog' AND g.enabled=1) THEN 'SI' ELSE 'NO' END AS permiso_catalogo,
 CASE WHEN EXISTS(SELECT 1 FROM sponsor_module_grants g WHERE g.sponsor_id=st.id AND g.module_code='commercial_vademecum' AND g.enabled=1) THEN 'SI' ELSE 'NO' END AS permiso_vademecum,
 (SELECT COUNT(*) FROM sponsor_sales_representatives r WHERE r.sponsor_id=st.id AND r.active=1) AS representantes_activos,
 (SELECT COUNT(*) FROM sponsor_sales_assignments a WHERE a.sponsor_id=st.id AND a.active=1) AS asignaciones_activas,
 CASE WHEN EXISTS(SELECT 1 FROM sponsor_commercial_resources cr WHERE cr.sponsor_id=st.id AND LENGTH(TRIM(COALESCE(cr.resource_url,'')))>0) THEN 'SI' ELSE 'NO' END AS recurso_configurado
FROM sponsor_tenants st
WHERE LOWER(st.slug) IN ('dapsa','f','laboratorios-doctores-mallen')
ORDER BY st.slug
SQL
)

PROFILES_SQL=$(cat <<'SQL'
SELECT st.slug AS patrocinador, sp.username AS usuario_publico,
 CASE WHEN COALESCE(sp.profile_role,'beneficiary')='sponsor_owner' THEN 'MASTER' ELSE 'BENEFICIARIO' END AS tipo_perfil,
 CASE WHEN LOWER(COALESCE(u.email,''))='intapcard@gmail.com' THEN 'MULTICUENTA' ELSE 'INDIVIDUAL' END AS tipo_acceso,
 CASE WHEN sp.artifact_id IS NOT NULL THEN 'SI' ELSE 'NO' END AS codigo_fisico_vinculado,
 CASE WHEN EXISTS(
  SELECT 1 FROM sponsor_sales_assignments a
  JOIN sponsor_sales_representatives r ON r.id=a.representative_id AND r.sponsor_id=a.sponsor_id AND r.active=1
  JOIN sponsor_artifacts sa ON sa.artifact_id=a.artifact_id AND sa.sponsor_id=a.sponsor_id
  WHERE a.sponsor_id=sp.sponsor_id AND sa.artifact_id=sp.artifact_id AND a.active=1
    AND LENGTH(TRIM(COALESCE(r.whatsapp,'')))>0
 ) THEN 'SI' ELSE 'NO' END AS representante_activo_con_contacto,
 CASE WHEN EXISTS(SELECT 1 FROM sponsor_module_grants g WHERE g.sponsor_id=sp.sponsor_id AND g.enabled=1 AND g.module_code IN ('commercial_seller','commercial_visitor')) THEN 'SI' ELSE 'NO' END AS modulo_contacto_autorizado,
 CASE WHEN EXISTS(SELECT 1 FROM sponsor_module_grants g JOIN sponsor_commercial_resources cr ON cr.sponsor_id=g.sponsor_id WHERE g.sponsor_id=sp.sponsor_id AND g.enabled=1 AND g.module_code IN ('commercial_catalog','commercial_vademecum') AND LENGTH(TRIM(COALESCE(cr.resource_url,'')))>0) THEN 'SI' ELSE 'NO' END AS documento_comercial_disponible
FROM sponsored_profiles sp
JOIN sponsor_tenants st ON st.id=sp.sponsor_id
JOIN users u ON u.id=sp.user_id
WHERE LOWER(sp.username) IN ('robles','josem','dapsa')
ORDER BY st.slug,sp.username
SQL
)

run_select(){
 local db="$1" config="$2" query="$3"
 # SQL viene de constantes SELECT de este archivo. Nunca usar entradas de usuario.
 (cd api && npx --no-install wrangler d1 execute "$db" --remote --config "$config" --command "$query")
}

for environment in PREVIEW PRODUCCION; do
 if [[ "$environment" == PREVIEW ]]; then
  db=intap_db_preview
  config=wrangler.preview.toml
 else
  db=intap_db
  config=wrangler.toml
 fi
 printf '\n========== %s · ESTRUCTURA (solo nombres de tabla) ==========\n' "$environment"
 run_select "$db" "$config" "$SCHEMA_SQL"
 printf '\n========== %s · PERMISOS Y ASIGNACIONES (sin PII) ==========\n' "$environment"
 run_select "$db" "$config" "$GRANTS_SQL"
 printf '\n========== %s · PERFILES DE PRUEBA (sin IDs, teléfonos o correos) ==========\n' "$environment"
 run_select "$db" "$config" "$PROFILES_SQL"
done
printf '\nFIN. Consulta únicamente SELECT; ningún dato modificado.\n'
printf 'Si no aparece un perfil en uno de los entornos, NO implica que tenga el mismo ID en ambos.\n'
