#!/usr/bin/env bash
set -euo pipefail
cd "$HOME/Desktop/intap-link-universal-bilingual-audit"
echo "=== DAPSA: últimos 5 productos, solo lectura ==="
SQL="SELECT ia.public_code,COALESCE(di.display_code,'SIN_ID') AS display_code,ia.product_type,ia.status,ia.created_at FROM intap_artifacts ia JOIN sponsor_artifacts sa ON sa.artifact_id=ia.id JOIN sponsor_tenants st ON st.id=sa.sponsor_id LEFT JOIN artifact_display_identifiers di ON di.artifact_id=ia.id WHERE st.slug='dapsa' AND COALESCE(sa.artifact_role,'beneficiary')='beneficiary' ORDER BY ia.created_at DESC,ia.rowid DESC LIMIT 5"
(cd api && npx wrangler d1 execute intap_db --remote --config wrangler.toml --command="$SQL")
echo "=== API pública: inspector de los dos productos recién creados (solo lectura) ==="
echo "Introduce el primer código NFC largo de tu lote (no el ID físico):"
read -r CODE
[[ "$CODE" =~ ^[A-Za-z0-9]{8,20}$ ]] || { echo "Código inválido";exit 1; }
curl -fsS --max-time 30 'https://app.intaprd.com/api/v1/public/artifacts/scan/status' -H 'Content-Type: application/json' --data "{\"public_code\":\"$CODE\"}" | python3 -c 'import json,sys;v=json.load(sys.stdin);a=v.get("artifact") or {};print(json.dumps({"ok":v.get("ok"),"state":v.get("state"),"artifact":{"public_code":a.get("public_code"),"display_code":a.get("display_code"),"product_type":a.get("product_type")}},ensure_ascii=False,indent=2))'
echo "=== Pantalla ==="
echo "Abre https://intaprd.com/l/$CODE en ventana privada y confirma número físico, tipo y código NFC."
