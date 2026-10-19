#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
REMOTE="github"
BRANCH="fix/agenda-phone-normalization-2026-10-18"
EXPECTED_MAIN_SHA="477e6be240e83af8cfffbb395af676134810e0e8"
WEB_PROJECT="intap-link"
APP_PROJECT="intap-web2"
PREVIEW_CFG="$ROOT/api/wrangler.preview.toml"
PREVIEW_CFG_BAK="$ROOT/api/wrangler.preview.toml.agenda-phone.bak"
LOG_DIR="$ROOT/.preview-agenda-phone-normalization"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" "$PREVIEW_CFG_BAK"
mkdir -p "$LOG_DIR"

cat <<EOF
================================================================
KAWVO LINK · AGENDA · NORMALIZACIÓN TELÉFONO/WHATSAPP · PREVIEW
================================================================
Corrige:
- El teléfono del solicitante ya no conserva @ ni símbolos ajenos.
- Números RD 809/829/849 de 10 dígitos se guardan como 1XXXXXXXXXX.
- El gestor muestra el teléfono limpio.
- Los botones de respuesta por WhatsApp usan el número normalizado.
- Solicitudes históricas se normalizan al leerlas.
- Aplica a Agenda Free y Patrocinada porque comparten appointments-core.
- Sin migraciones D1.
- Producción NO se toca.

Main esperado: $EXPECTED_MAIN_SHA
================================================================
EOF

run git fetch "$REMOTE" main "$BRANCH"
CURRENT_MAIN="$(git rev-parse "$REMOTE/main")"
[ "$CURRENT_MAIN" = "$EXPECTED_MAIN_SHA" ] || fail "main cambió: esperado $EXPECTED_MAIN_SHA, actual $CURRENT_MAIN"

run git switch "$BRANCH"
run git pull --ff-only "$REMOTE" "$BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Árbol local no limpio"; }
git merge-base --is-ancestor "$REMOTE/main" HEAD || fail "main y feature divergieron"

cat > "$LOG_DIR/allowed.txt" <<'EOF_ALLOWED'
api/src/appointments-core.ts
app/src/components/appointments/AppointmentManager.tsx
scripts/run-preview-agenda-phone-normalization-2026-10-18.sh
scripts/test-agenda-phone-normalization-contract.mjs
web/src/components/appointments/AppointmentRequestModal.tsx
EOF_ALLOWED
git diff --name-only "$REMOTE/main"...HEAD | sort > "$LOG_DIR/actual.txt"
sort "$LOG_DIR/allowed.txt" > "$LOG_DIR/allowed.sorted.txt"
diff -u "$LOG_DIR/allowed.sorted.txt" "$LOG_DIR/actual.txt" || fail "Hay archivos fuera del alcance aprobado"

run git diff --check "$REMOTE/main"...HEAD
run npm ci
run node scripts/test-sponsored-profile-contract.mjs
run npm run build:preview -w app
run bash -lc 'cd web && npm run build:preview'
if grep -R -Fq 'https://api.intaprd.com' web/dist/assets; then fail "Bundle Web Preview contiene API productiva"; fi
grep -R -Fq 'https://preview.intaprd.com' web/dist/assets || fail "Bundle Web Preview no apunta al API Preview"
run bash -lc 'cd api && npx tsc --noEmit'

echo; echo "▶ Deploy Web Preview"
(npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch "$BRANCH") 2>&1 | tee "$LOG_DIR/web.log"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$LOG_DIR/web.log" | tail -1)"
[ -n "$WEB_ORIGIN" ] || fail "No pude detectar Web origin"

echo; echo "▶ Deploy App Preview"
(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch "$BRANCH") 2>&1 | tee "$LOG_DIR/app.log"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$LOG_DIR/app.log" | tail -1)"
[ -n "$APP_ORIGIN" ] || fail "No pude detectar App origin"

cp "$PREVIEW_CFG" "$PREVIEW_CFG_BAK"
restore_cfg(){
  if [ -f "$PREVIEW_CFG_BAK" ]; then
    cp "$PREVIEW_CFG_BAK" "$PREVIEW_CFG" 2>/dev/null || true
    rm -f "$PREVIEW_CFG_BAK"
  fi
}
trap restore_cfg EXIT

python3 - "$PREVIEW_CFG" "$WEB_ORIGIN" "$APP_ORIGIN" <<'PY'
from pathlib import Path
import re,sys
p=Path(sys.argv[1]); web=sys.argv[2]; app=sys.argv[3]
s=p.read_text()
s,n1=re.subn(r'WEB_PAGES_ORIGIN\s*=\s*"[^"]+"',f'WEB_PAGES_ORIGIN = "{web}"',s,count=1)
s,n2=re.subn(r'APP_PAGES_ORIGIN\s*=\s*"[^"]+"',f'APP_PAGES_ORIGIN = "{app}"',s,count=1)
if n1 != 1 or n2 != 1: raise SystemExit("No pude fijar origins Preview")
p.write_text(s)
PY

echo; echo "▶ Deploy Worker Preview"
(
  cd api
  npx wrangler deploy --config wrangler.preview.toml --dry-run
  npx wrangler deploy --config wrangler.preview.toml
) 2>&1 | tee "$LOG_DIR/worker.log"

restore_cfg
trap - EXIT
sleep 4

for url in "https://preview.intaprd.com" "https://app.preview.intaprd.com/superadmin"; do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

rm -rf "$LOG_DIR"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Runner dejó cambios locales"; }

cat <<EOF
================================================================
✓ AGENDA TELÉFONO/WHATSAPP NORMALIZADO EN PREVIEW
================================================================
Feature SHA: $(git rev-parse HEAD)
Web origin:  $WEB_ORIGIN
App origin:  $APP_ORIGIN

QA:
1. Abre un perfil Preview con Agenda.
2. En teléfono intenta escribir: @809-555-1234
3. El campo no debe conservar @.
4. Envía la solicitud.
5. En Agenda del propietario debe verse 809-555-1234, nunca @809...
6. "Responder por WhatsApp" debe abrir wa.me/18095551234.
7. Repite con Agenda patrocinada si está disponible.
8. Producción NO fue tocada.
================================================================
EOF
