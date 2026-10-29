#!/usr/bin/env bash
set -euo pipefail
cd "$HOME/Desktop/intap-link-universal-bilingual-audit"
OUT="$HOME/intap-release-logs/kawvo-grants-identity-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$OUT"
SQL="SELECT st.id,st.slug,st.name,st.is_active,COALESCE(sm.role,'') AS role,g.module_code,g.enabled FROM sponsor_tenants st LEFT JOIN sponsor_module_grants g ON g.sponsor_id=st.id AND g.module_code IN ('commercial_seller','commercial_visitor','commercial_catalog','commercial_vademecum') LEFT JOIN sponsor_members sm ON sm.sponsor_id=st.id AND sm.role='owner' WHERE st.slug IN ('f','laboratorios-doctores-mallen','dapsa') ORDER BY st.slug,g.module_code"
(cd api && npx wrangler d1 execute intap_db_preview --remote --config wrangler.preview.toml --command="$SQL") > "$OUT/preview.txt" 2>&1
(cd api && npx wrangler d1 execute intap_db --remote --config wrangler.toml --command="$SQL") > "$OUT/production.txt" 2>&1
echo "Auditoría de identidad sin escrituras: $OUT"
echo "=== PREVIEW ==="
grep -E '"(id|slug|name|is_active|role|module_code|enabled)"' "$OUT/preview.txt" || true
echo "=== PRODUCCIÓN ==="
grep -E '"(id|slug|name|is_active|role|module_code|enabled)"' "$OUT/production.txt" || true
echo "NO se modificaron datos, asignaciones ni permisos."
