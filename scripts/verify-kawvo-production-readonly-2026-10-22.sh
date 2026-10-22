#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-$HOME/Desktop/intap-link-universal-bilingual-audit}"
cd "$ROOT"
echo "=== Kawvo Link: comprobación SOLO LECTURA ==="
echo "Se preservan Pages, Worker, D1 y datos."
git fetch github main reconcile/kawmed-medical-profile-v1-2026-10-19-v2
echo "MAIN: $(git rev-parse github/main)"
echo "CANDIDATO: $(git rev-parse github/reconcile/kawmed-medical-profile-v1-2026-10-19-v2)"
echo "=== Producción: API real ==="
for host in intaprd.com app.intaprd.com api.intaprd.com; do
  body="$(mktemp)"
  code="$(curl -sS --max-time 20 --output "$body" --write-out '%{http_code}' "https://$host/api/health")"
  printf '%s => %s\n' "$host" "$code"
  if [ "$code" != 200 ] || ! grep -q '"status":"healthy"' "$body" || ! grep -q '"environment":"production"' "$body"; then
    rm -f "$body"; echo "ERROR: health productivo inesperado"; exit 1
  fi
  rm -f "$body"
done
echo "=== Cloudflare Pages: deployments de Producción (sin cambios) ==="
npx --no-install wrangler pages deployment list --project-name intap-link --environment production
npx --no-install wrangler pages deployment list --project-name intap-web2 --environment production
echo "=== Esquema D1 productivo pendiente (sin cambios) ==="
(cd api && npx --no-install wrangler d1 migrations list intap_db --remote --config wrangler.toml)
echo "OK: inventario solicitado sin ejecutar ninguna modificación productiva."
