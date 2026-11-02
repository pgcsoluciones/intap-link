#!/usr/bin/env bash
# KawMed #134 — production API-only release of already QA-approved Preview fix.
# Does not deploy App/Web/Preview, modify D1, migrations, or Google credentials.
set -euo pipefail
[[ "${KAWMED_PENDING_PRODUCTION_API_DEPLOY_APPROVED:-}" == "SI" ]] || {
 echo "Aprobación explícita requerida: KAWMED_PENDING_PRODUCTION_API_DEPLOY_APPROVED=SI"
 exit 1
}
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="fix/kawmed-live-invitation-pending-activation-2026-11-02"
BASE="444f3da79a85a87baa739f1eafac87891607885d"
cd "$ROOT"
[[ -z "$(git status --porcelain)" ]] || { echo "Cambios locales presentes. No desplegar."; exit 1; }
git fetch github "$BRANCH"
git switch "$BRANCH"
git pull --ff-only github "$BRANCH"
git merge-base --is-ancestor "$BASE" HEAD
git diff --check "$BASE"..HEAD

echo "===== Gate: solo cambio de invitación + config de Preview (no usada por Producción) ====="
while IFS= read -r file; do
 case "$file" in
   api/src/kawmed-live-guest.ts|api/wrangler.preview.toml|scripts/test-kawmed-pending-live-invitation-2026-11-02.mjs|scripts/verify-kawmed-pending-live-invitation-2026-11-02.sh|scripts/deploy-preview-kawmed-pending-invitation-2026-11-02.sh|scripts/stage-current-kawmed-app-preview-2026-11-02.sh|scripts/connect-kawmed-app-authorized-preview-2026-11-02.sh|scripts/deploy-production-kawmed-pending-invitation-2026-11-02.sh) ;;
   *) echo "Archivo fuera del alcance aprobado: $file"; exit 1 ;;
 esac
done < <(git diff --name-only "$BASE"..HEAD)
EXPECTED_API_FILES="$(printf '%s\n' api/src/kawmed-live-guest.ts api/wrangler.preview.toml)"
ACTUAL_API_FILES="$(git diff --name-only "$BASE"..HEAD -- api | sort)"
[[ "$ACTUAL_API_FILES" == "$EXPECTED_API_FILES" ]] || { echo "Cambios inesperados en API. Abortando."; exit 1; }
[[ -z "$(git diff --name-only "$BASE"..HEAD -- app web)" ]] || { echo "Se modificó App/Web; abortando."; exit 1; }
[[ "$(git diff --numstat "$BASE"..HEAD -- api/src/kawmed-live-guest.ts)" == "$(printf '2\t1\tapi/src/kawmed-live-guest.ts')" ]] || {
 echo "La lógica de invitación cambió fuera del alcance probado."; exit 1;
}
[[ "$(git diff --numstat "$BASE"..HEAD -- api/wrangler.preview.toml)" == "$(printf '1\t1\tapi/wrangler.preview.toml')" ]] || {
 echo "La configuración Preview cambió fuera de alcance."; exit 1;
}
# Production uses a different and UNMODIFIED config; never include Preview aliases.
[[ -z "$(git diff --name-only "$BASE"..HEAD -- api/wrangler.toml)" ]] || { echo "Config Producción alterada."; exit 1; }
grep -Fxq 'name = "intap-api"' api/wrangler.toml
grep -Fxq 'ENVIRONMENT = "production"' api/wrangler.toml
grep -Fxq 'APP_URL = "https://app.intaprd.com"' api/wrangler.toml
grep -Fxq 'database_name = "intap_db"' api/wrangler.toml
grep -Fxq 'APP_PAGES_ORIGIN = "https://qa-kawmed-guest-current-2026.intap-web2.pages.dev"' api/wrangler.preview.toml

echo "===== Seguridad KawMed, Multicuenta y módulos comerciales aprobados ====="
node scripts/test-kawmed-pending-live-invitation-2026-11-02.mjs
node scripts/test-kawmed-live-guest-contract.mjs
node scripts/test-kawmed-demo-invitations-contract.mjs
node scripts/test-kawmed-isolation-contract.mjs
node scripts/test-intapcard-active-account-contract.mjs
node scripts/test-sponsored-owner-commercial-links-2026-11-02.mjs
node scripts/test-sponsored-owner-context-denial-2026-11-01.mjs

echo "===== TypeScript y dry-run API Production (NO publish yet) ====="
(cd api && npx --no-install tsc --noEmit && npx --no-install wrangler deploy --config wrangler.toml --dry-run)

PROD_CHECK="https://api.intaprd.com/api/v1/me/kawmed/live-access/invalid-invitation"
private_status(){
 local result
 result="$(curl -sS --max-time 25 -o /dev/null -w '%{http_code}' "$PROD_CHECK" || true)"
 [[ "$result" == "401" ]] || {
   echo "Privacidad de API en Producción: HTTP $result (se requiere 401). NO continuar."
   return 1
 }
}
echo "===== Verificar protección de invitaciones ANTES de publicar ====="
private_status
echo "Checks aprobados. Publicando SOLAMENTE el Worker intap-api de Producción..."
(cd api && npm run deploy:production)
echo "===== Verificar protección DESPUÉS de publicar ====="
if ! private_status; then
 echo "ATENCIÓN: Worker ya publicado; revisar incidente, NO repetir el deploy automáticamente."
 exit 1
fi
echo "API KAWMED PRODUCCIÓN DESPLEGADA Y PROTEGIDA."
echo "Sin despliegue App/Web/Preview, sin modificaciones D1 o credenciales Google."
echo "QA USUARIO PENDIENTE: abrir la MISMA invitación original, autenticarse con el correo invitado en app.intaprd.com y comprobar MedicalDashboard completo y Agenda."
echo "No cerrar #134 hasta validación funcional en Producción."
