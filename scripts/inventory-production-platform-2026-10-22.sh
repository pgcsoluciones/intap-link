#!/usr/bin/env bash
set -uo pipefail
ROOT="${1:-$HOME/Desktop/intap-link-universal-bilingual-audit}"
cd "$ROOT" || exit 2
mkdir -p .kawvo-release-inventory
OUT=".kawvo-release-inventory/inventory-2026-10-22.txt"
: > "$OUT"
record(){ printf '\n===== %s =====\n' "$1" | tee -a "$OUT"; }
run(){ "$@" 2>&1 | tee -a "$OUT"; }
record "Git version and main/QA refs"
run git log -1 --format='%h %ad %s' --date=iso HEAD
run git rev-parse github/main
run git rev-parse github/reconcile/kawmed-medical-profile-v1-2026-10-19-v2
record "Cloudflare Pages web intap-link (read-only)"
run npx --no-install wrangler pages deployment list --project-name intap-link
record "Cloudflare Pages app intap-web2 (read-only)"
run npx --no-install wrangler pages deployment list --project-name intap-web2
record "Production D1 pending migrations (read-only)"
(cd api && npx --no-install wrangler d1 migrations list intap_db --remote --config wrangler.toml) 2>&1 | tee -a "$OUT"
record "Preview D1 pending migrations (read-only)"
(cd api && npx --no-install wrangler d1 migrations list intap_db_preview --remote --config wrangler.preview.toml) 2>&1 | tee -a "$OUT"
record "Public HTTP reachability (read-only)"
for url in https://intaprd.com/ https://app.intaprd.com/ https://api.intaprd.com/ https://preview.intaprd.com/ https://app.preview.intaprd.com/; do
  printf '%s => ' "$url" | tee -a "$OUT"
  curl -sSL --max-time 15 -o /dev/null -w '%{http_code}\n' "$url" | tee -a "$OUT"
done
echo "Inventario guardado en $OUT"
echo "REVISAR ANTES DE COMPARTIR: las salidas pueden contener IDs de cuenta/despliegue, aunque el script no solicita secretos."
