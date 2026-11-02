#!/usr/bin/env bash
# KawMed #134 — ONLY API Preview Worker. No Production deploy / D1 writes / Pages deploy.
# Preview Worker is also App/Web frontdoor; keep stable aliases unchanged.
set -euo pipefail
[[ "${KAWMED_PENDING_PREVIEW_DEPLOY_APPROVED:-}" == "SI" ]] || {
 echo "Se requiere autorización: KAWMED_PENDING_PREVIEW_DEPLOY_APPROVED=SI"
 exit 1
}
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="fix/kawmed-live-invitation-pending-activation-2026-11-02"
BASE="444f3da79a85a87baa739f1eafac87891607885d"
cd "$ROOT"
[[ -z "$(git status --porcelain)" ]] || { echo "Cambios locales presentes. NO desplegar."; exit 1; }
git fetch github "$BRANCH"
git switch "$BRANCH"
git pull --ff-only github "$BRANCH"
git merge-base --is-ancestor "$BASE" HEAD
git diff --check "$BASE"..HEAD
while IFS= read -r f; do
 case "$f" in
   api/src/kawmed-live-guest.ts|scripts/test-kawmed-pending-live-invitation-2026-11-02.mjs|scripts/verify-kawmed-pending-live-invitation-2026-11-02.sh|scripts/deploy-preview-kawmed-pending-invitation-2026-11-02.sh) ;;
   *) echo "Archivo inesperado: $f"; exit 1;;
 esac
done < <(git diff --name-only "$BASE"..HEAD)
[[ "$(git diff --name-only "$BASE"..HEAD -- api)" == "api/src/kawmed-live-guest.ts" ]] || { echo "Cambio API fuera de alcance."; exit 1; }
[[ -z "$(git diff --name-only "$BASE"..HEAD -- app web)" ]] || { echo "Cambios App/Web inesperados."; exit 1; }
EXPECTED_DIFF="$(printf '2\t1\tapi/src/kawmed-live-guest.ts')"
[[ "$(git diff --numstat "$BASE"..HEAD -- api/src/kawmed-live-guest.ts)" == "$EXPECTED_DIFF" ]] || { echo "Cambio runtime distinto del aprobado."; exit 1; }

grep -Fxq 'name = "intap-api-preview"' api/wrangler.preview.toml
grep -Fxq 'main = "src/preview-frontdoor-entry.ts"' api/wrangler.preview.toml
grep -Fxq 'APP_URL = "https://app.preview.intaprd.com"' api/wrangler.preview.toml
grep -Fxq 'WEB_URL = "https://preview.intaprd.com"' api/wrangler.preview.toml
grep -Fxq 'APP_PAGES_ORIGIN = "https://feature-account-access-metho.intap-web2.pages.dev"' api/wrangler.preview.toml
grep -Fxq 'WEB_PAGES_ORIGIN = "https://qa-kawmed-web-1025.intap-web2.pages.dev"' api/wrangler.preview.toml
grep -Fxq 'database_name = "intap_db_preview"' api/wrangler.preview.toml

echo "===== Pruebas de invitación KawMed y aislamiento ====="
node scripts/test-kawmed-pending-live-invitation-2026-11-02.mjs
node scripts/test-kawmed-live-guest-contract.mjs
node scripts/test-kawmed-demo-invitations-contract.mjs
node scripts/test-kawmed-isolation-contract.mjs
node scripts/test-intapcard-active-account-contract.mjs
echo "===== TypeScript y Worker Preview dry-run ====="
(cd api && npx --no-install tsc --noEmit && npx --no-install wrangler deploy --config wrangler.preview.toml --dry-run)

# Probe unauthenticated endpoint: no token, session cookie or medical records included.
PREVIEW_CHECK='https://app.preview.intaprd.com/api/v1/me/kawmed/live-access/invalid-invitation'
status="$(curl --silent --show-error --max-time 25 -o /dev/null -w '%{http_code}' "$PREVIEW_CHECK" || true)"
[[ "$status" == "401" ]] || {
 echo "Preview pre-deploy: endpoint sin sesión respondió HTTP $status (esperado 401). No desplegar."
 exit 1
}
echo "===== Publicando SOLO Worker API Preview, no Pages ====="
(cd api && npx --no-install wrangler deploy --config wrangler.preview.toml)
status_after="$(curl --silent --show-error --max-time 25 -o /dev/null -w '%{http_code}' "$PREVIEW_CHECK" || true)"
[[ "$status_after" == "401" ]] || {
 echo "ATENCIÓN: Preview desplegado pero acceso anónimo respondió HTTP $status_after; revisar, NO repetir deploy automáticamente."
 exit 1
}
echo "WORKER PREVIEW PUBLICADO. Acceso sin sesión sigue protegido (401)."
echo "Producción, App/Web Pages y D1 permanecen sin cambios."
echo "QA funcional aún pendiente: generar/probar una invitación LIVE en Preview con usuario autenticado y validar MedicalDashboard, Agenda y bloqueo de acciones prohibidas."
