#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/account-access-methods-v1"
APP_PROJECT="intap-web2"
LOG_DIR="$ROOT/.preview-account-access-methods-v1-fix-email-logs"
APP_LOG="$LOG_DIR/app-pages.log"
WORKER_LOG="$LOG_DIR/worker-preview.log"
PREVIEW_CFG="$ROOT/api/wrangler.preview.toml"
PREVIEW_CFG_BAK="$LOG_DIR/wrangler.preview.toml.bak"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" && mkdir -p "$LOG_DIR"

cat <<'EOF'
============================================================
KAWVO LINK · CREDENCIALES · FIX EMAIL OTP · PREVIEW
============================================================
Corrige el error 500 al solicitar código de verificación.
- valida que Preview tenga RESEND_API_KEY
- si falta, intenta cargarla desde variable local o .env sin mostrarla
- evita dejar retos OTP inválidos si el envío falla
- devuelve error controlado si el proveedor de correo no está disponible

SOLO PREVIEW
Producción NO se toca
============================================================
EOF

run git fetch github "$BRANCH" main
run git checkout "$BRANCH"
run git pull --ff-only github "$BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "El árbol de trabajo no está limpio"; }

run python3 scripts/apply-account-access-methods-v1-fix-email-2026-09-16.py
run git diff --check

grep -Fq "verification email failed" api/src/account-access-methods.ts || fail "No quedó aplicado el manejo del error de correo"
grep -Fq "result.status || 500" api/src/account-access-methods.ts || fail "No quedó aplicada la respuesta HTTP controlada"

run npm run build:preview -w app
run bash -lc 'cd api && npx tsc --noEmit'

git add api/src/account-access-methods.ts
if ! git diff --cached --quiet; then
  git commit -m "fix: handle verification email failures in credentials"
  git push github "$BRANCH"
fi

# Verificar que el Worker Preview tenga el secreto de Resend.
echo
echo "▶ Verificar servicio de correo en Worker Preview"
SECRET_LIST="$(cd api && npx wrangler secret list --config wrangler.preview.toml 2>/dev/null || true)"
if ! printf '%s\n' "$SECRET_LIST" | grep -Fq 'RESEND_API_KEY'; then
  echo "⚠ RESEND_API_KEY no está registrado en intap-api-preview."

  RESEND_VALUE="${RESEND_API_KEY:-}"
  if [ -z "$RESEND_VALUE" ]; then
    for candidate in "$ROOT/.env" "$ROOT/api/.env" "$ROOT/api/.dev.vars"; do
      if [ -f "$candidate" ]; then
        RESEND_VALUE="$(python3 - "$candidate" <<'PY'
from pathlib import Path
import re,sys
s=Path(sys.argv[1]).read_text(errors='ignore')
m=re.search(r'(?m)^\s*RESEND_API_KEY\s*=\s*["\x27]?([^"\x27\n\r]+)',s)
print((m.group(1).strip() if m else ''))
PY
)"
        [ -n "$RESEND_VALUE" ] && break
      fi
    done
  fi

  if [ -n "$RESEND_VALUE" ]; then
    echo "✓ Encontré RESEND_API_KEY localmente; configurando SOLO Worker Preview."
    (cd api && printf '%s' "$RESEND_VALUE" | npx wrangler secret put RESEND_API_KEY --config wrangler.preview.toml >/dev/null) || fail "No pude configurar RESEND_API_KEY en Preview"
    unset RESEND_VALUE
  else
    fail "Falta RESEND_API_KEY en Worker Preview y no existe una copia local segura para configurarla automáticamente. No se modificó Producción."
  fi
else
  echo "✓ RESEND_API_KEY ya existe en Worker Preview"
fi

# Rebuild y despliegue App Preview para mantener origen inmutable sincronizado.
run npm run build:preview -w app
(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch feature-account-access-methods-v1) 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App Preview"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$APP_LOG" | tail -1)"
[ -n "$APP_ORIGIN" ] || fail "No pude detectar origin inmutable de App Pages"
echo "✓ App Pages Preview: $APP_ORIGIN"

cp "$PREVIEW_CFG" "$PREVIEW_CFG_BAK"
restore_cfg(){ cp "$PREVIEW_CFG_BAK" "$PREVIEW_CFG" 2>/dev/null || true; }
trap restore_cfg EXIT
python3 - "$PREVIEW_CFG" "$APP_ORIGIN" <<'PY'
from pathlib import Path
import re,sys
p=Path(sys.argv[1]); origin=sys.argv[2]
s=p.read_text()
s2,n=re.subn(r'APP_PAGES_ORIGIN\s*=\s*"[^"]+"',f'APP_PAGES_ORIGIN = "{origin}"',s,count=1)
if n != 1: raise SystemExit('No pude actualizar APP_PAGES_ORIGIN')
p.write_text(s2)
PY

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
for url in \
  "https://app.preview.intaprd.com/admin/login" \
  "https://app.preview.intaprd.com/admin/free/credentials"
do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

[ -z "$(git status --porcelain)" ] || { git status --short; fail "El runner dejó cambios locales"; }

cat <<EOF
============================================================
✓ FIX EMAIL OTP LISTO EN PREVIEW
============================================================
Feature SHA: $(git rev-parse HEAD)
App Pages: $APP_ORIGIN
Preview: https://app.preview.intaprd.com/admin/free/credentials

Prueba nuevamente:
Mi cuenta → Credenciales → Crear contraseña

Producción NO tocada
============================================================
EOF
