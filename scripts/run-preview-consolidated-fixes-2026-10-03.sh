#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
REMOTE="github"
BRANCH="preview/consolidated-fixes-2026-10-03"
EXPECTED_MAIN_SHA="e7936177dc15ff2ab75563903464320b10be07fd"
WEB_PROJECT="intap-link"
APP_PROJECT="intap-web2"
PREVIEW_CFG="$ROOT/api/wrangler.preview.toml"
PREVIEW_CFG_BAK="$ROOT/api/wrangler.preview.toml.consolidated-fixes.bak"
LOG_DIR="$ROOT/.preview-consolidated-fixes-2026-10-03"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" "$PREVIEW_CFG_BAK"
mkdir -p "$LOG_DIR"

cat <<EOF
================================================================
KAWVO LINK · AJUSTES CONSOLIDADOS · PREVIEW
================================================================
Incluye en una sola corrida:

1. RNC/CÉDULA bancaria:
   - Cuenta copia la cuenta
   - RNC / CÉD. copia la identidad configurada
   - mantiene privacidad y compatibilidad móvil

2. Agenda:
   - teléfono mostrado normalizado, ej. 809-705-9802

3. Recorrido automático:
   - “Ya entendí” persiste en la cuenta
   - no reaparece al cerrar/iniciar sesión
   - Dashboard, Mi cuenta y Team respetan la preferencia
   - Recorrido manual sigue disponible

4. Cotización / información:
   - RNC opcional
   - orden: Nombre → RNC → Teléfono → Correo
   - RNC viaja en WhatsApp/correo solo si se completa
   - se elimina “opcional si adjuntas media”

5. Social card de cotización:
   - título contextual: “Solicita una cotización con [Negocio]”
   - descripción contextual del formulario
   - conserva la imagen social propia del perfil
   - Free/Team + Patrocinado

Preview solamente.
NO toca D1, R2 ni Producción.

Main esperado: $EXPECTED_MAIN_SHA
================================================================
EOF

run git fetch "$REMOTE" main "$BRANCH"
CURRENT_MAIN="$(git rev-parse "$REMOTE/main")"
[ "$CURRENT_MAIN" = "$EXPECTED_MAIN_SHA" ] || fail "main cambió: esperado $EXPECTED_MAIN_SHA, actual $CURRENT_MAIN. Detener y auditar."

run git switch "$BRANCH"
run git pull --ff-only "$REMOTE" "$BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Árbol local no limpio"; }
git merge-base --is-ancestor "$REMOTE/main" HEAD || fail "main y branch divergieron"

cat > "$LOG_DIR/allowed.txt" <<'EOF_ALLOWED'
api/src/free-appointments.ts
api/src/sponsored-appointments.ts
app/src/components/admin/free/FreeAccountGuidedTour.tsx
app/src/components/admin/free/FreeGuidedTour.tsx
app/src/components/admin/free/FreeTeamGuidedTour.tsx
app/src/components/admin/free/freeTourPersistence.ts
functions/_middleware.ts
scripts/run-preview-consolidated-fixes-2026-10-03.sh
scripts/test-consolidated-fixes-2026-10-03.mjs
web/src/components/free-profile/FreeContactActions.tsx
web/src/components/free-profile/PublicBankAccounts.tsx
web/src/components/sponsored/SponsoredBankAccounts.tsx
web/src/components/sponsored/SponsoredProfile.tsx
EOF_ALLOWED

git diff --name-only "$REMOTE/main"...HEAD | sort > "$LOG_DIR/actual.txt"
sort "$LOG_DIR/allowed.txt" > "$LOG_DIR/allowed.sorted.txt"
diff -u "$LOG_DIR/allowed.sorted.txt" "$LOG_DIR/actual.txt" || fail "Hay archivos fuera del alcance consolidado"

run git diff --check "$REMOTE/main"...HEAD
run npm ci
run node scripts/test-consolidated-fixes-2026-10-03.mjs
run npm run build:preview -w web
run npm run build:preview -w app
run bash -lc 'cd api && npx tsc --noEmit'

echo; echo "▶ Deploy Web Preview"
(npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch "$BRANCH") 2>&1 | tee "$LOG_DIR/web.log"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$LOG_DIR/web.log" | tail -1 || true)"
[ -n "$WEB_ORIGIN" ] || fail "No pude detectar Web Preview origin"

echo; echo "▶ Deploy App Preview"
(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch "$BRANCH") 2>&1 | tee "$LOG_DIR/app.log"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$LOG_DIR/app.log" | tail -1 || true)"

cp "$PREVIEW_CFG" "$PREVIEW_CFG_BAK"
restore_cfg(){
  if [ -f "$PREVIEW_CFG_BAK" ]; then
    cp "$PREVIEW_CFG_BAK" "$PREVIEW_CFG" 2>/dev/null || true
    rm -f "$PREVIEW_CFG_BAK"
  fi
}
trap restore_cfg EXIT

python3 - "$PREVIEW_CFG" "$WEB_ORIGIN" <<'PY'
from pathlib import Path
import re,sys
p=Path(sys.argv[1]); web=sys.argv[2]
s=p.read_text()
s,n=re.subn(r'WEB_PAGES_ORIGIN\s*=\s*"[^"]+"',f'WEB_PAGES_ORIGIN = "{web}"',s,count=1)
if n != 1: raise SystemExit("No pude fijar WEB_PAGES_ORIGIN Preview")
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

for url in "https://preview.intaprd.com" "https://preview.intaprd.com/demo" "https://app.preview.intaprd.com/admin/login"; do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

rm -rf "$LOG_DIR"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Runner dejó cambios locales"; }

cat <<EOF
================================================================
✓ AJUSTES CONSOLIDADOS · PREVIEW LISTO
================================================================
Feature SHA: $(git rev-parse HEAD)
Web origin:  $WEB_ORIGIN
App origin:  ${APP_ORIGIN:-ver salida Pages}

QA prioritario:
1. Banco: Cuenta y RNC/CÉD. copian valores diferentes/correctos.
2. Agenda: teléfono llega como 809-705-9802.
3. Recorrido: “Ya entendí” → cerrar sesión → entrar → NO reaparece.
4. Cotización: Nombre → RNC opcional → Teléfono → Correo.
5. Ya NO aparece “opcional si adjuntas media”.
6. Compartir formulario en Instagram/WhatsApp muestra:
   “Solicita una cotización con [Negocio]”
   y conserva la imagen social del perfil.
7. Revisar Free y Patrocinado.
8. Producción NO fue tocada.
================================================================
EOF
