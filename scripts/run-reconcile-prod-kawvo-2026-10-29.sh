#!/usr/bin/env bash
# Release integrado API+App MED, sin migraciones ni cambios de datos.
set -euo pipefail
cd "$HOME/Desktop/intap-link-universal-bilingual-audit"
[[ "$KAWVO_RECONCILE_PROD_APPROVED" == "SI" ]] || exit 1
[[ -z "$(git status --porcelain)" ]] || { echo "Cambios locales: detenido"; exit 1; }
git fetch github release/reconcile-approved-2026-10-29 main
git switch release/reconcile-approved-2026-10-29
git pull --ff-only github release/reconcile-approved-2026-10-29
git merge-base --is-ancestor 14915fe6 HEAD || exit 1
git diff --check 14915fe6..HEAD
while IFS= read -r p; do case "$p" in
 api/src/medical-access-codes.ts|app/src/components/admin/SuperAdminKawMed.tsx|scripts/test-med-physical-display-read-contract.mjs|scripts/run-reconcile-prod-kawvo-2026-10-29.sh) ;;
 *) echo "Cambio ajeno: $p";exit 1;;
esac; done < <(git diff --name-only 14915fe6..HEAD)
LOG="$HOME/intap-release-logs/kawvo-med-recovery-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$LOG"
git rev-parse HEAD | tee "$LOG/revision.txt"
node scripts/test-med-physical-display-read-contract.mjs
node scripts/test-kawvo-publication-regression-contract.mjs
node scripts/test-intapcard-active-account-contract.mjs
node scripts/test-intapcard-kawmed-integrated-contract.mjs
node scripts/test-sponsor-commercial-contract.mjs
npx tsc --noEmit -p api/tsconfig.json
npm run build -w app
# Compara permisos por slug y nombre de módulo; no muestra usuarios ni escribe permisos.
SQL="SELECT st.slug, g.module_code, g.enabled FROM sponsor_module_grants g JOIN sponsor_tenants st ON st.id=g.sponsor_id WHERE g.module_code IN ('commercial_seller','commercial_visitor','commercial_catalog','commercial_vademecum') ORDER BY st.slug, g.module_code"
(cd api && npx wrangler d1 execute intap_db_preview --remote --config wrangler.preview.toml --command="$SQL") > "$LOG/commercial-preview.txt" 2>&1 || { echo "No se pudo auditar grants en Preview"; exit 1; }
(cd api && npx wrangler d1 execute intap_db --remote --config wrangler.toml --command="$SQL") > "$LOG/commercial-production.txt" 2>&1 || { echo "No se pudo auditar grants en Producción"; exit 1; }
echo "Auditoría comercial de ambos entornos guardada en $LOG. No se transfirieron permisos."
SQL="SELECT name FROM sqlite_master WHERE type='table' AND name='medical_display_identifiers'"
(cd api && npx wrangler d1 execute intap_db --remote --config wrangler.toml --command="$SQL") > "$LOG/med-schema.txt" 2>&1
grep -q medical_display_identifiers "$LOG/med-schema.txt" || { echo "Tabla MED falta; detenido";exit 1; }
(cd api && npx wrangler d1 export intap_db --remote --config wrangler.toml --output="$LOG/backup.sql")
[[ -s "$LOG/backup.sql" ]] || exit 1
shasum -a 256 "$LOG/backup.sql" > "$LOG/backup.sha256"
(cd api && npx wrangler deploy --config wrangler.toml --dry-run) || exit 1
(cd api && npx wrangler deploy --config wrangler.toml) 2>&1 | tee "$LOG/api.txt"
npx wrangler pages deploy app/dist --project-name intap-web2 --branch main 2>&1 | tee "$LOG/app.txt"
ASSET="$(grep -Eo '/assets/index-[A-Za-z0-9_-]+\.js' app/dist/index.html | head -1)"
[[ -n "$ASSET" ]] || exit 1
EXPECTED="$(shasum -a 256 "app/dist$ASSET" | awk '{print $1}')"
VERIFIED=0
for n in 1 2 3 4 5 6; do
 HTML="$(curl -fsSL --max-time 30 https://app.intaprd.com/ || true)"
 if [[ "$HTML" == *"$ASSET"* ]]; then
  GOT="$(curl -fsSL --max-time 30 "https://app.intaprd.com$ASSET" | shasum -a 256 | awk '{print $1}')" || GOT=""
  if [[ "$GOT" == "$EXPECTED" ]]; then VERIFIED=1;break;fi
 fi
 sleep 5
done
[[ "$VERIFIED" == 1 ]] || { echo "No se verificó bundle productivo";exit 1; }
for u in https://api.intaprd.com/api/health https://app.intaprd.com/admin/login; do
 CODE="$(curl -sSL --max-time 30 -o /dev/null -w '%{http_code}' "$u" || true)"
 echo "$u: $CODE" | tee -a "$LOG/checks.txt"
 [[ "$CODE" == 200 ]] || exit 1
done
echo "Release API + App comprobado; pruebas autenticadas de negocio siguen pendientes."
echo "$LOG"
