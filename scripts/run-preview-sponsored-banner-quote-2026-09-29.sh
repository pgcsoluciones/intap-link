#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/sponsored-banner-per-code"
EXPECTED_MAIN_SHA="dc7758f9b70cb8117146860b19270ff973d822bc"
APP_PROJECT="intap-web2"
WEB_PROJECT="intap-link"
LOG_DIR="$ROOT/.preview-sponsored-quote-banner-logs"
APP_LOG="$LOG_DIR/app-pages.log"
WEB_LOG="$LOG_DIR/web-pages.log"
WORKER_LOG="$LOG_DIR/worker-preview.log"
PREVIEW_CFG="$ROOT/api/wrangler.preview.toml"
PREVIEW_CFG_BAK="$LOG_DIR/wrangler.preview.toml.bak"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" && mkdir -p "$LOG_DIR"

cat <<'EOF'
============================================================
KAWVO LINK · PERFIL PATROCINADO · PREVIEW QA
============================================================
Incluye:
- cintillo patrocinado activable/desactivable por código beneficiario
- CTA Solicitar cotización debajo del horario
- formulario universal con envío por WhatsApp o correo
- footer KawLink siempre visible
Producción NO se toca
============================================================
EOF

run git fetch github main "$BRANCH"
[ "$(git rev-parse github/main)" = "$EXPECTED_MAIN_SHA" ] || fail "main cambió; detener y auditar antes de desplegar"
run git switch "$BRANCH"
run git pull --ff-only github "$BRANCH"
# Si el usuario ejecutó chmod +x, Git puede marcar solo el bit ejecutable del propio runner.
# Bash ya está ejecutando el archivo, así que restauramos únicamente ese cambio de modo antes del control de limpieza.
git restore -- scripts/run-preview-sponsored-banner-quote-2026-09-29.sh 2>/dev/null || true
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Árbol local no limpio"; }

ALLOWED='^(api/migrations-preview/0075_sponsored_banner_per_artifact\.sql|api/migrations-preview/0076_sponsored_profile_email\.sql|api/migrations-preview/0077_sponsored_profile_email_repair\.sql|api/migrations/0076_sponsored_banner_per_artifact\.sql|api/migrations/0077_sponsored_profile_email\.sql|api/src/sponsored-profiles\.ts|api/src/sponsored-public\.ts|api/src/sponsored-admin-extra\.ts|functions/_middleware\.ts|app/src/components/admin/SuperAdminSponsors\.tsx|app/src/components/admin/sponsored/SponsoredDashboard\.tsx|app/src/components/admin/sponsored/SponsorDashboard\.tsx|web/src/components/sponsored/SponsoredProfile\.tsx|scripts/test-sponsored-profile-contract\.mjs|scripts/run-preview-sponsored-banner-quote-2026-09-29\.sh)$'
UNEXPECTED="$(git diff --name-only github/main...HEAD | grep -Ev "$ALLOWED" || true)"
[ -z "$UNEXPECTED" ] || { echo "$UNEXPECTED"; fail "Hay archivos fuera del alcance"; }

run git diff --check github/main...HEAD
run npm ci
run node scripts/test-sponsored-profile-contract.mjs
run npm run build:preview -w app
run npm run build -w web
run bash -lc 'cd api && npx tsc --noEmit'

if [ "${SKIP_MIGRATIONS:-0}" = "1" ]; then
  echo; echo "▶ Migraciones D1 Preview omitidas por SKIP_MIGRATIONS=1"
else
  echo; echo "▶ Aplicar migraciones SOLO D1 Preview"
  (
    cd api
    npx wrangler d1 migrations apply intap_db_preview --remote --config wrangler.preview.toml
  ) || fail "Migraciones D1 Preview"
fi

echo; echo "▶ Deploy App Pages Preview"
(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch "$BRANCH") 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App Preview"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$APP_LOG" | tail -1)"
[ -n "$APP_ORIGIN" ] || fail "No pude detectar App origin"

echo; echo "▶ Deploy Web Pages Preview"
(npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch "$BRANCH") 2>&1 | tee "$WEB_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Web Preview"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$WEB_LOG" | tail -1)"
[ -n "$WEB_ORIGIN" ] || fail "No pude detectar Web origin"

cp "$PREVIEW_CFG" "$PREVIEW_CFG_BAK"
restore_cfg(){ cp "$PREVIEW_CFG_BAK" "$PREVIEW_CFG" 2>/dev/null || true; }
trap restore_cfg EXIT

python3 - "$PREVIEW_CFG" "$APP_ORIGIN" "$WEB_ORIGIN" <<'PY'
from pathlib import Path
import re,sys
p=Path(sys.argv[1]); app=sys.argv[2]; web=sys.argv[3]
s=p.read_text()
s,n1=re.subn(r'APP_PAGES_ORIGIN\s*=\s*"[^"]+"',f'APP_PAGES_ORIGIN = "{app}"',s,count=1)
s,n2=re.subn(r'WEB_PAGES_ORIGIN\s*=\s*"[^"]+"',f'WEB_PAGES_ORIGIN = "{web}"',s,count=1)
if n1 != 1 or n2 != 1:
    raise SystemExit(f"No pude fijar origins Preview: APP={n1} WEB={n2}")
p.write_text(s)
PY

echo; echo "▶ Deploy Worker Preview"
(
  cd api
  npx wrangler deploy --config wrangler.preview.toml --dry-run
  npx wrangler deploy --config wrangler.preview.toml
) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Preview"
restore_cfg
trap - EXIT

sleep 4
echo; echo "▶ Smoke HTTP Preview"
for url in   "https://app.preview.intaprd.com/admin/login"   "https://app.preview.intaprd.com/superadmin/sponsors"   "https://preview.intaprd.com"
do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

rm -rf "$LOG_DIR"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Runner dejó cambios locales"; }

cat <<EOF
============================================================
✓ PERFIL PATROCINADO LISTO EN PREVIEW
============================================================
Feature SHA: $(git rev-parse HEAD)
App origin:  $APP_ORIGIN
Web origin:  $WEB_ORIGIN

QA Super Admin:
https://app.preview.intaprd.com/superadmin/sponsors

Validar:
1. Código beneficiario muestra Cintillo Activo/Inactivo.
2. Master muestra "No aplica".
3. Desactivar cintillo oculta solo patrocinio del perfil público.
4. "Desarrollado por KawLink" permanece visible.
5. Debajo del horario aparece "Solicitar cotización / información".
6. No aparecen botones para compartir el formulario de cotización.
7. Modal pide nombre, teléfono, correo opcional y cotización / información.
8. Entrega, sector y forma de pago son opcionales.
9. Al completar nombre, teléfono y cotización / información aparece el selector de envío.
10. Si el negocio tiene WhatsApp y correo, permite elegir; si solo tiene uno, usa ese canal.
11. Correo abre la aplicación predeterminada con destinatario, asunto y solicitud precargados.
12. Al enviar, el navegador vuelve al home limpio del perfil.
13. CRM del patrocinador muestra el correo del patrocinado.
14. Super Admin muestra el correo del patrocinado.
15. Producción NO tocada.
============================================================
EOF
