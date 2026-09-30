#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
REMOTE="github"
BRANCH="feature/free-contact-agenda-experience"
EXPECTED_MAIN_SHA="f2dc1bfb52e2367d5b32d5b58609d18ce83024ae"
RUNNER_PATH="scripts/run-preview-free-contact-agenda-2026-09-30.sh"
APP_PROJECT="intap-web2"
WEB_PROJECT="intap-link"
PREVIEW_CFG="$ROOT/api/wrangler.preview.toml"
PREVIEW_CFG_BAK="$ROOT/api/wrangler.preview.toml.free-contact-agenda.bak"
LOG_DIR="$ROOT/.preview-free-contact-agenda-logs"
APP_LOG="$LOG_DIR/app-pages.log"
WEB_LOG="$LOG_DIR/web-pages.log"
WORKER_LOG="$LOG_DIR/worker.log"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" "$PREVIEW_CFG_BAK"
mkdir -p "$LOG_DIR"

cat <<EOF
================================================================
KAWVO LINK · FREE · HORARIO + COTIZACIÓN + AGENDA · PREVIEW
================================================================
Alcance aprobado:
- nombre/cargo + botones destacados/rápidos NO se mueven
- Quién soy se conserva
- Horario debajo de Quién soy
- Cotizar activo por defecto
- Agenda inactiva por defecto y configurable en Mi cuenta
- Catálogo/Portafolio después de Cotizar/Agenda
- Cuentas bancarias después de Catálogo/Portafolio
- Mis enlaces después de bancos
- Servicios sale de la experiencia Free visible
- paleta y lenguaje visual propios de Free
- motor de Agenda reutilizable existente
- Producción NO se toca

Main esperado: $EXPECTED_MAIN_SHA
================================================================
EOF

run git fetch "$REMOTE" main "$BRANCH"

CURRENT_MAIN="$(git rev-parse "$REMOTE/main")"
[ "$CURRENT_MAIN" = "$EXPECTED_MAIN_SHA" ] || fail "main cambió: esperado $EXPECTED_MAIN_SHA, actual $CURRENT_MAIN. Detener y auditar."

run git switch "$BRANCH"
run git pull --ff-only "$REMOTE" "$BRANCH"

git restore -- "$RUNNER_PATH" 2>/dev/null || true
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Árbol local no limpio"; }
git merge-base --is-ancestor "$REMOTE/main" HEAD || fail "main y feature divergieron"

cat > "$LOG_DIR/allowed-files.txt" <<'EOF_ALLOWED'
api/src/account-home-route.ts
api/src/free-appointments.ts
api/src/preview-free-entry.ts
app/src/App.tsx
app/src/components/admin/free/FreeAccount.tsx
app/src/components/admin/free/FreeAppointments.tsx
app/src/components/admin/free/FreeDashboard.tsx
app/src/components/admin/free/FreeExperienceSettings.tsx
app/src/components/admin/free/FreePwaHome.tsx
app/src/components/notifications/PwaNotificationBridge.tsx
scripts/create-preview-free-activation-code.mjs
scripts/run-preview-free-contact-agenda-2026-09-30.sh
scripts/test-free-contact-agenda-contract.mjs
web/src/components/free-profile/FreeContactActions.tsx
web/src/components/free-profile/IntapLinkGratis.adapter.ts
web/src/components/free-profile/IntapLinkGratisProfile.tsx
web/src/components/free-profile/PublicBankAccounts.tsx
EOF_ALLOWED

git diff --name-only "$REMOTE/main"...HEAD | sort > "$LOG_DIR/actual-files.txt"
sort "$LOG_DIR/allowed-files.txt" > "$LOG_DIR/allowed-files.sorted.txt"
UNEXPECTED="$(comm -23 "$LOG_DIR/actual-files.txt" "$LOG_DIR/allowed-files.sorted.txt" || true)"
[ -z "$UNEXPECTED" ] || { echo "$UNEXPECTED"; fail "Hay archivos fuera del alcance aprobado"; }

run git diff --check "$REMOTE/main"...HEAD
run npm ci

echo; echo "▶ Contratos aprobados"
run node scripts/test-sponsored-profile-contract.mjs
run node scripts/test-free-contact-agenda-contract.mjs

echo; echo "▶ Build App Preview"
run npm run build:preview -w app

echo; echo "▶ Build Web"
run npm run build -w web

echo; echo "▶ TypeScript API"
run bash -lc 'cd api && npx tsc --noEmit'

echo; echo "▶ Confirmar que Agenda reutilizable ya existe en D1 Preview"
TABLES="$(cd api && npx wrangler d1 execute intap_db_preview --remote --config wrangler.preview.toml --command "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('appointment_settings','appointment_availability','appointment_reasons','appointment_blocks','appointment_requests','user_notifications') ORDER BY name;" 2>/dev/null || true)"
for table in appointment_settings appointment_availability appointment_reasons appointment_blocks appointment_requests user_notifications; do
  echo "$TABLES" | grep -F "$table" >/dev/null || fail "D1 Preview no tiene $table"
done
echo "✓ Esquema Agenda existente verificado; este cambio no requiere migración nueva"

echo; echo "▶ Verificar que no hay migraciones Preview pendientes"
(
  cd api
  npx wrangler d1 migrations list intap_db_preview --remote --config wrangler.preview.toml
) 2>&1 | tee "$LOG_DIR/migrations.log"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "No se pudieron listar migraciones Preview"
if grep -Eq '[0-9]{4}_[A-Za-z0-9._-]+\.sql' "$LOG_DIR/migrations.log"; then
  cat "$LOG_DIR/migrations.log"
  fail "Hay migraciones pendientes no relacionadas con esta entrega"
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
restore_cfg(){
  if [ -f "$PREVIEW_CFG_BAK" ]; then
    cp "$PREVIEW_CFG_BAK" "$PREVIEW_CFG" 2>/dev/null || true
    rm -f "$PREVIEW_CFG_BAK"
  fi
}
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

echo; echo "▶ Smoke Preview"
for url in   "https://app.preview.intaprd.com/admin/login"   "https://app.preview.intaprd.com/admin/free/agenda"   "https://preview.intaprd.com"
do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

echo; echo "▶ Smoke API Free inexistente"
code="$(curl -sS -o "$LOG_DIR/free404.json" -w '%{http_code}' "https://preview.intaprd.com/api/v1/public/profiles/kawvo-release-smoke-no-existe/free-experience")"
echo "✓ Free inexistente -> HTTP $code"
[ "$code" = "404" ] || fail "Endpoint Free experience respondió HTTP $code; esperaba 404"

rm -rf "$LOG_DIR"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Runner dejó cambios locales"; }

cat <<EOF
================================================================
✓ FREE HORARIO + COTIZACIÓN + AGENDA LISTO EN PREVIEW
================================================================
Feature SHA: $(git rev-parse HEAD)
App origin:  $APP_ORIGIN
Web origin:  $WEB_ORIGIN

QA:
1. Nombre/cargo, botón destacado y botones rápidos conservan su posición.
2. Quién soy permanece debajo de esos botones.
3. Horario aparece debajo de Quién soy después de configurarlo.
4. Cotizar / información aparece activo por defecto.
5. Agenda está inactiva por defecto.
6. Mi cuenta permite activar/desactivar Cotizar y Agenda sin dejar ambas apagadas.
7. Mi cuenta abre Configurar horario y agenda.
8. Horarios, bloqueos, motivos, confirmar/rechazar/liberar funcionan con el motor reutilizable.
9. Compartir formulario abre ?cotizar=1.
10. Compartir agendar abre ?agendar=1.
11. Catálogo/Portafolio aparece después de los botones y conserva su galería.
12. El nombre Catálogo/Portafolio se puede cambiar desde Mi cuenta.
13. Cuentas bancarias aparecen debajo de Catálogo/Portafolio.
14. Mis enlaces aparecen debajo de cuentas bancarias.
15. Servicios no aparece en el perfil público ni como opción del panel Free.
16. Colores de las nuevas secciones siguen la paleta del perfil Free.
17. PWA/Home muestra Agenda y solicitudes Free.
18. Producción NO fue tocada.
================================================================
EOF
