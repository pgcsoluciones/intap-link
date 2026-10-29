#!/usr/bin/env bash
# Auditoría de versiones Preview/Producción, sin deploy, mutaciones ni credenciales exportadas.
set -euo pipefail
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/kawvo-sponsor-commercial-controls-2026-10-27"
LOG="$HOME/intap-release-logs/kawvo-global-sync-$(date -u +%Y%m%dT%H%M%SZ)"
cd "$ROOT"
[[ -z "$(git status --porcelain)" ]] || { echo "ABORTADO: git contiene cambios locales."; exit 1; }
git fetch github main "$BRANCH" feature/kawmed-med-codes-accordion-pagination-2026-10-23
git switch "$BRANCH"
git pull --ff-only github "$BRANCH"
mkdir -p "$LOG"
{
 echo "=== HEAD ==="; git show -s --format='%H %ci %s' HEAD
 echo "=== BASE PROD APP DEL 29 OCT ==="; git show -s --format='%H %ci %s' 14915fe6
 echo "=== EXCLUSIVOS DE RAMA MED DIVERGENTE ==="
 git log --format='%h %ci %s' HEAD..github/feature/kawmed-med-codes-accordion-pagination-2026-10-23
 echo "=== DIFERENCIAS MED ADMIN ==="
 git diff --stat HEAD..github/feature/kawmed-med-codes-accordion-pagination-2026-10-23 -- app/src/components/admin/SuperAdminKawMed.tsx
 echo "=== RUTAS IMPLEMENTADAS ==="
 git grep -n -E 'display_code|station_number|commercialConfig.contact' -- app/src/components/admin/SuperAdminKawMed.tsx app/src/components/admin/sponsored/SponsorDashboard.tsx api/src/medical-access-codes.ts | cut -c1-250 | head -70 || true
} | tee "$LOG/git.txt"
for target in 'app-prod|https://app.intaprd.com' 'app-preview|https://app.preview.intaprd.com' 'web-prod|https://intaprd.com' 'web-preview|https://preview.intaprd.com'; do
 label="${target%%|*}"; host="${target#*|}"
 http="$(curl -L -sS --max-time 25 -o "$LOG/$label.html" -w '%{http_code}' "$host/" || true)"
 echo "$label HTTP=$http" | tee -a "$LOG/frontends.txt"
 [[ "$http" != 200 ]] && continue
 grep -Eo '/assets/index-[A-Za-z0-9_-]+\.js' "$LOG/$label.html" | head -3 | tee -a "$LOG/frontends.txt" || true
done
for target in 'api-prod|https://api.intaprd.com/api/health' 'api-preview|https://app.preview.intaprd.com/api/health'; do
 label="${target%%|*}"; url="${target#*|}"
 echo "$label HTTP=$(curl -L -sS --max-time 25 -o /dev/null -w '%{http_code}' "$url" || true)" | tee -a "$LOG/api.txt"
done
echo "=== DEPLOYMENTS PAGES ACTUALES (solo lectura) ==="
(npx wrangler pages deployment list --project-name intap-link || true) > "$LOG/web-deployments.txt" 2>&1
(npx wrangler pages deployment list --project-name intap-web2 || true) > "$LOG/app-deployments.txt" 2>&1
echo "Reportes: $LOG"
echo "Sin despliegues, migraciones, modificaciones de bases de datos o archivos del repositorio."
