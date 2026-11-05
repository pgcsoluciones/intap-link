#!/usr/bin/env bash
# Fix Free multicuenta ownerbar and editor preview shortcut. Deploy API + public Web to Preview only.
# Based on the already deployed #141 icon release; no changes to App or Production.
set -euo pipefail

[[ "${KAWVO_FREE_BAR_PREVIEW_APPROVED:-}" == "SI" ]] || { echo "Falta KAWVO_FREE_BAR_PREVIEW_APPROVED=SI"; exit 1; }
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="fix/free-multicuenta-ownerbar-preview-slot-2026-11-04"
BASE="f7cb4dd0038abfe28d0cc3068d96323c42c740a7"
WEB_BRANCH="qa-sponsor-scan-1104"
WEB_ALIAS="https://qa-sponsor-scan-1104.intap-link.pages.dev"
PUBLIC_PREVIEW="https://preview.intaprd.com"
SAMPLE_CODE="KVFWC2S2CQ"
fail(){ echo "DETENIDO: $*" >&2; exit 1; }

cd "$ROOT" || fail "No existe el repositorio en el escritorio."
[[ -z "$(git status --porcelain)" ]] || fail "Hay cambios locales sin guardar."
git remote get-url github >/dev/null || fail "No existe el remoto github."
git fetch github "$BRANCH"
git switch "$BRANCH"
git pull --ff-only github "$BRANCH"
git merge-base --is-ancestor "$BASE" HEAD || fail "La rama no incluye el release L/P/M aprobado."
git diff --check "$BASE"..HEAD

CHANGED="$(git diff --name-only "$BASE"..HEAD)"
while IFS= read -r file; do
  [[ -z "$file" ]] && continue
  case "$file" in
    api/src/free-appointments.ts|web/src/components/appointments/AppointmentOwnerBar.tsx|web/src/components/free-profile/IntapLinkGratisProfile.tsx|web/src/components/free-profile/FreePreviewEditShortcut.tsx|scripts/test-free-multicuenta-ownerbar-preview-slot-2026-11-04.mjs|scripts/run-preview-free-multicuenta-ownerbar-2026-11-04.sh) ;;
    *) fail "Cambio fuera de alcance: $file" ;;
  esac
done <<< "$CHANGED"
for file in api/src/free-appointments.ts web/src/components/appointments/AppointmentOwnerBar.tsx web/src/components/free-profile/IntapLinkGratisProfile.tsx web/src/components/free-profile/FreePreviewEditShortcut.tsx scripts/test-free-multicuenta-ownerbar-preview-slot-2026-11-04.mjs scripts/run-preview-free-multicuenta-ownerbar-2026-11-04.sh; do
  grep -Fxq "$file" <<< "$CHANGED" || fail "Falta archivo de release: $file"
done
[[ -z "$(git diff --name-only "$BASE"..HEAD -- app api/migrations api/migrations-preview web/functions package-lock.json)" ]] || fail "Archivos prohibidos en release API/Web."

CFG="api/wrangler.preview.toml"
grep -Fxq 'name = "intap-api-preview"' "$CFG" || fail "Worker equivocado."
grep -Fxq 'main = "src/preview-frontdoor-entry.ts"' "$CFG" || fail "Frontdoor equivocado."
grep -Fxq 'ENVIRONMENT = "preview"' "$CFG" || fail "Entorno equivocado."
grep -Fxq 'database_name = "intap_db_preview"' "$CFG" || fail "D1 equivocado."
grep -Fxq 'bucket_name = "intap-r2-preview"' "$CFG" || fail "R2 equivocado."
grep -Fxq 'APP_URL = "https://app.preview.intaprd.com"' "$CFG" || fail "App URL equivocado."
grep -Fxq 'WEB_URL = "https://preview.intaprd.com"' "$CFG" || fail "Web URL equivocado."
grep -Fxq 'APP_PAGES_ORIGIN = "https://qa-kawmed-guest-current-2026.intap-web2.pages.dev"' "$CFG" || fail "No mover la App Preview."
grep -Fxq "WEB_PAGES_ORIGIN = \"$WEB_ALIAS\"" "$CFG" || fail "El origen Web no corresponde a intap-link."
grep -Fxq 'VITE_APP_URL=https://app.preview.intaprd.com' web/.env.preview || fail "La Web usa App incorrecta."
grep -Fxq 'VITE_PUBLIC_ORIGIN=https://preview.intaprd.com' web/.env.preview || fail "La Web no usa Preview."

echo "===== Tests y builds sin modificar datos ====="
npm ci
node scripts/test-free-multicuenta-ownerbar-preview-slot-2026-11-04.mjs
node scripts/test-owner-toolbar-contextual-icons-2026-11-04.mjs
node scripts/test-owner-toolbar-icons-multivariant-2026-11-04.mjs
node scripts/test-sponsored-activation-landing-cleanup-2026-11-04.mjs
node scripts/test-all-master-physical-station-parity-2026-11-02.mjs
node scripts/test-lp-superadmin-physical-label-visibility-2026-11-04.mjs
node scripts/test-superadmin-sponsor-tenant-switch-2026-11-04.mjs
node scripts/test-nfc-physical-identifier-release.mjs
(cd api && npx --no-install tsc --noEmit && npx --no-install wrangler deploy --config wrangler.preview.toml --dry-run)
npm run build:preview -w web
grep -RFl 'Volver a edición' web/dist/assets >/dev/null || fail "No está el acceso de retorno a edición en el build."
grep -RFl 'Mi perfil' web/dist/assets >/dev/null || fail "No está Mi perfil en el build."
grep -RFl 'Activa tu presentación digital' web/dist/assets >/dev/null || fail "Se perdió la pantalla patrocinada del build."
grep -RFl 'Identificación del dispositivo' web/dist/assets >/dev/null || fail "No está la pantalla Master en el build."
grep -RFl 'Activar después' web/dist/assets >/dev/null || fail "No está la salida del beneficiario."

MAIN_JS="$(grep -Eo '/assets/index-[A-Za-z0-9_-]+\.js' web/dist/index.html | head -1 || true)"
[[ -n "$MAIN_JS" && -f "web/dist$MAIN_JS" ]] || fail "No hay bundle Web principal."
mkdir -p "$HOME/intap-release-logs"
LOG_DIR="$(mktemp -d "$HOME/intap-release-logs/free-multicuenta-ownerbar-preview-XXXXXXXX")"
git rev-parse HEAD > "$LOG_DIR/commit.txt"

verify_html(){
  local url="$1" file="$2" tries
  for tries in 1 2 3 4 5 6 7 8; do
    if curl -fsSL --max-time 30 -H 'Cache-Control: no-cache' "$url" -o "$file" &&
      grep -Fq "$MAIN_JS" "$file"; then return 0; fi
    sleep 5
  done
  fail "No se verificó el bundle Web correcto en $url; logs: $LOG_DIR"
}

echo "===== Pages Web Preview: proyecto correcto intap-link ====="
npx --no-install wrangler pages deploy web/dist --project-name intap-link --branch "$WEB_BRANCH" --commit-hash "$(git rev-parse HEAD)" 2>&1 | tee "$LOG_DIR/pages.log"
grep -Fq "$WEB_ALIAS" "$LOG_DIR/pages.log" || fail "Cloudflare no reportó el alias Web esperado; no tocar Worker."
verify_html "$WEB_ALIAS/l/$SAMPLE_CODE" "$LOG_DIR/pages.html"
verify_html "$WEB_ALIAS/m/med-intapcard" "$LOG_DIR/pages-medical.html"
verify_html "$WEB_ALIAS/" "$LOG_DIR/pages-root.html"
curl -fsSL --max-time 35 "$WEB_ALIAS$MAIN_JS" -o "$LOG_DIR/pages.js"
cmp -s "web/dist$MAIN_JS" "$LOG_DIR/pages.js" || fail "JS de Pages no coincide con el compilado; no tocar Worker."

echo "===== Worker API/frontdoor Preview (preserva App L/P/M) ====="
(cd api && npx --no-install wrangler deploy --config wrangler.preview.toml) 2>&1 | tee "$LOG_DIR/worker.log"
verify_html "$PUBLIC_PREVIEW/l/$SAMPLE_CODE" "$LOG_DIR/domain.html"
# A Free draft preview requires a signed editor session; unauthenticated curl MUST NOT
# expect the public SPA HTML. Validate the public Free route instead.
verify_html "$PUBLIC_PREVIEW/intap3" "$LOG_DIR/free-public.html"
# Un usuario sin sesión de vista previa recibe 302 hacia autorización del editor.
# No seguir ese redirect con -L: el endpoint final requiere sesión y su host difiere.
DRAFT_PREVIEW_STATUS="$(curl -sS --max-time 30 -o "$LOG_DIR/free-draft-no-session.txt" -w '%{http_code}' "$PUBLIC_PREVIEW/intap3?preview=1" || true)"
[[ "$DRAFT_PREVIEW_STATUS" == "302" || "$DRAFT_PREVIEW_STATUS" == "401" || "$DRAFT_PREVIEW_STATUS" == "403" ]] || fail "Vista previa Free sin sesión respondió HTTP $DRAFT_PREVIEW_STATUS; se esperaba redirección 302 o rechazo 401/403."
verify_html "$PUBLIC_PREVIEW/m/med-intapcard" "$LOG_DIR/domain-medical.html"
verify_html "$PUBLIC_PREVIEW/" "$LOG_DIR/domain-root.html"
curl -fsSL --max-time 35 "$PUBLIC_PREVIEW$MAIN_JS" -o "$LOG_DIR/domain.js"
cmp -s "web/dist$MAIN_JS" "$LOG_DIR/domain.js" || fail "La Web pública Preview todavía sirve JS anterior."
PUBLIC_CONTEXT_STATUS="$(curl -sS --max-time 25 -o /dev/null -w '%{http_code}' "https://app.preview.intaprd.com/api/v1/me/free/appointments/public-context?username=intap3" || true)"
[[ "$PUBLIC_CONTEXT_STATUS" == "401" || "$PUBLIC_CONTEXT_STATUS" == "403" ]] || fail "Endpoint owner Free sin sesión respondió HTTP $PUBLIC_CONTEXT_STATUS."
curl -fsSL --max-time 35 "https://app.preview.intaprd.com/admin/login" -o "$LOG_DIR/app-login.html" || fail "La App Preview no responde."
MED_STATUS="$(curl -sS --max-time 25 -o /dev/null -w '%{http_code}' https://app.preview.intaprd.com/api/v1/sponsor/kawmed/overview || true)"
[[ "$MED_STATUS" == "401" || "$MED_STATUS" == "403" ]] || fail "KawMed privado responde HTTP $MED_STATUS sin sesión."
[[ -z "$(git status --porcelain)" ]] || fail "Quedaron cambios locales inesperados."

echo "FREE MULTICUENTA BARRA Y VISTA PREVIA ACTUALIZADAS EN PREVIEW: $PUBLIC_PREVIEW/intap3?preview=1"
echo "API y Web Preview verificadas byte a byte; App, Producción, D1/R2 sin cambios."
echo "Próximo paso: probar Free normal / multicuenta / ?preview=1 y regreso a edición, escritorio y móvil."
echo "Logs: $LOG_DIR"
