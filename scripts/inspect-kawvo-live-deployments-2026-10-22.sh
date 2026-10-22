#!/usr/bin/env bash
set -uo pipefail
cd "${1:-$HOME/Desktop/intap-link-universal-bilingual-audit}" || exit 2
echo "=== CONSULTA READ-ONLY CLOUDFLARE ==="
echo "Worker actual: lista de deployments del intap-api (sin publicar)"
(cd api && npx --no-install wrangler deployments list --name intap-api --config wrangler.toml) 2>&1
echo "=== Web: deployment production más reciente, solo lectura ==="
npx --no-install wrangler pages deployment list --project-name intap-link --environment production 2>&1 | head -n 24
echo "=== App: deployment production más reciente, solo lectura ==="
npx --no-install wrangler pages deployment list --project-name intap-web2 --environment production 2>&1 | head -n 24
echo "=== Aplicación HTTP, sin autenticación ==="
for url in https://intaprd.com/ https://app.intaprd.com/ https://intaprd.com/api/health https://app.intaprd.com/api/health; do
  printf '%s ' "$url"
  curl --silent --show-error --location --max-time 15 --output /dev/null --write-out 'HTTP %{http_code}\n' "$url"
done
echo "NOTA: Status Failure/Idle no establece por sí solo qué deployment es activo. Consultar dashboard si ambiguo."
