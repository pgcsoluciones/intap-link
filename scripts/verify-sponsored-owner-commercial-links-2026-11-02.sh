#!/usr/bin/env bash
# QA read-only: integra enlaces comerciales en la barra privada ya recuperada.
# No despliega API/Web/App ni cambia D1, permisos, módulos o representantes.
set -euo pipefail
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/sponsored-owner-commercial-links-2026-11-02"
BASE="e230ee4d85f38b17e19c2ae92508d120ea8aad27"
cd "$ROOT"
[[ -z "$(git status --porcelain)" ]] || { echo "Hay cambios locales. Abortando."; exit 1; }
git fetch github "$BRANCH"
git switch "$BRANCH"
git pull --ff-only github "$BRANCH"
git merge-base --is-ancestor "$BASE" HEAD
git diff --check "$BASE"..HEAD
while IFS= read -r file; do
  case "$file" in
    api/src/sponsored-commercial-links-core.ts|api/src/sponsored-appointments.ts|api/src/sponsor-commercial-sales.ts|scripts/test-sponsored-owner-commercial-links-2026-11-02.mjs|scripts/verify-sponsored-owner-commercial-links-2026-11-02.sh) ;;
    *) echo "ARCHIVO NO AUTORIZADO EN QA: $file"; exit 1 ;;
  esac
done < <(git diff --name-only "$BASE"..HEAD)
[[ -z "$(git diff --name-only "$BASE"..HEAD -- web app)" ]] || { echo "Modificación Web/App inesperada."; exit 1; }

echo "===== Pruebas de enlaces comerciales + aislamiento ====="
node scripts/test-sponsored-owner-commercial-links-2026-11-02.mjs
node scripts/test-sponsored-owner-context-denial-2026-11-01.mjs
node scripts/test-owner-bar-api-origin-multicuenta-2026-11-01.mjs
echo "===== TypeScript y simulación API Producción (sin deploy) ====="
(cd api && npx --no-install tsc --noEmit && npx --no-install wrangler deploy --config wrangler.toml --dry-run)

SQL_GRANTS=$(cat <<'SQL'
SELECT mg.module_code,mg.enabled,scr.resource_url,scr.resource_label
FROM sponsor_module_grants mg
LEFT JOIN sponsor_commercial_resources scr ON scr.sponsor_id=mg.sponsor_id
WHERE 1=0 LIMIT 0
SQL
)
SQL_SELLERS=$(cat <<'SQL'
SELECT r.whatsapp
FROM sponsor_sales_assignments a
JOIN sponsor_sales_representatives r ON r.id=a.representative_id AND r.sponsor_id=a.sponsor_id AND r.active=1
JOIN sponsor_artifacts sa ON sa.artifact_id=a.artifact_id AND sa.sponsor_id=a.sponsor_id
WHERE a.active=1 AND 1=0 LIMIT 0
SQL
)
d1_query(){
  local db="$1" config="$2" sql="$3" title="$4" attempt=1 output=''
  while [ "$attempt" -le 3 ]; do
    if output=$(cd api && npx --no-install wrangler d1 execute "$db" --remote --config "$config" --command "$sql" 2>&1); then
      echo "$title: OK (intento $attempt)"
      return 0
    fi
    if [[ "$output" != *"[code: 7403]"* ]]; then
      echo "$title: ERROR diferente de Cloudflare 7403; abortando." >&2
      printf '%s\n' "$output" >&2
      return 1
    fi
    [[ "$attempt" -lt 3 ]] || { echo "$title: Cloudflare 7403 persistente, NO desplegar." >&2; return 1; }
    echo "$title: Cloudflare 7403, reintentando solo consulta SELECT ..."
    sleep "$attempt"
    attempt=$((attempt+1))
  done
}
for entry in "intap_db_preview|wrangler.preview.toml|PREVIEW" "intap_db|wrangler.toml|PRODUCCION"; do
  IFS='|' read -r db config label <<< "$entry"
  echo "===== $label: validar SQL comercial sin leer registros ====="
  d1_query "$db" "$config" "$SQL_GRANTS" "$label/GRANTS"
  d1_query "$db" "$config" "$SQL_SELLERS" "$label/ASIGNACIONES"
done
echo "QA COMERCIAL COMPLETA. Sin deploy ni cambios D1. Configuración/Agenda intactas."
