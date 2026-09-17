#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/account-access-methods-v1"
APP_PROJECT="intap-web2"
CFG="$ROOT/api/wrangler.preview.toml"
LOG_DIR="$ROOT/.preview-account-access-methods-v1-session-logs"
APP_LOG="$LOG_DIR/app-pages.log"
WORKER_LOG="$LOG_DIR/worker-preview.log"
CFG_BAK="$LOG_DIR/wrangler.preview.toml.bak"
STABLE_ALIAS="https://feature-account-access-metho.intap-web2.pages.dev"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" && mkdir -p "$LOG_DIR"

cat <<'EOF'
============================================================
KAWVO LINK · CREDENCIALES · VERIFICACIÓN LIGADA A SESIÓN
============================================================
Corrige de raíz el 403 posterior al OTP:
- la autorización ya no viaja como token temporal en React
- queda ligada server-side al usuario + sesión activa
- el OTP autoriza una acción por 10 minutos
- crear/cambiar contraseña consume esa autorización una sola vez
- cambio de correo usa el mismo modelo
- mantiene Google, correo seguro y Resend
- mantiene el front door Preview estable

SOLO PREVIEW
Producción NO se toca
============================================================
EOF

run git fetch github "$BRANCH" main
run git checkout "$BRANCH"
run git pull --ff-only github "$BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "El árbol de trabajo no está limpio"; }

PERSISTED_ORIGIN="$(python3 - "$CFG" <<'PY'
from pathlib import Path
import re,sys
s=Path(sys.argv[1]).read_text()
m=re.search(r'^APP_PAGES_ORIGIN\s*=\s*"([^"]+)"',s,re.M)
print(m.group(1) if m else '')
PY
)"
[ "$PERSISTED_ORIGIN" = "$STABLE_ALIAS" ] || fail "wrangler.preview.toml no usa el alias estable: $PERSISTED_ORIGIN"

grep -Fq "accountSessionId" api/src/account-access-methods.ts || fail "Falta enlace de autorización a sesión"
grep -Fq "session_id=? AND purpose=?" api/src/account-access-methods.ts || fail "Falta consumo server-side por sesión"
! grep -Fq "verification_token:verification" app/src/components/admin/free/FreeCredentials.tsx || fail "Frontend todavía transporta verification_token"
[ -f api/migrations-preview/0061_account_verified_actions_session.sql ] || fail "Falta migración Preview 0061"

run git diff --check
run npm run build:preview -w app
run bash -lc 'cd api && npx tsc --noEmit'

echo; echo "▶ Aplicar migración 0061 SOLO D1 Preview"
(
  cd api
  npx wrangler d1 migrations apply intap_db_preview --remote --config wrangler.preview.toml
) || fail "Migración D1 Preview"

SECRET_LIST="$(cd api && npx wrangler secret list --config wrangler.preview.toml 2>/dev/null || true)"
printf '%s\n' "$SECRET_LIST" | grep -Fq 'RESEND_API_KEY' || fail "Falta RESEND_API_KEY en Worker Preview"
echo "✓ RESEND_API_KEY presente"

run npm run build:preview -w app
(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch feature-account-access-methods-v1) 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App Preview"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$APP_LOG" | tail -1)"
[ -n "$APP_ORIGIN" ] || fail "No pude detectar App Pages origin"
echo "✓ App Pages actual: $APP_ORIGIN"

cp "$CFG" "$CFG_BAK"
restore_cfg(){ cp "$CFG_BAK" "$CFG" 2>/dev/null || true; }
trap restore_cfg EXIT
python3 - "$CFG" "$APP_ORIGIN" <<'PY'
from pathlib import Path
import re,sys
p=Path(sys.argv[1]); origin=sys.argv[2]
s=p.read_text()
s2,n=re.subn(r'^APP_PAGES_ORIGIN\s*=\s*"[^"]+"',f'APP_PAGES_ORIGIN = "{origin}"',s,count=1,flags=re.M)
if n != 1: raise SystemExit('No pude sincronizar APP_PAGES_ORIGIN')
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

AFTER_ORIGIN="$(python3 - "$CFG" <<'PY'
from pathlib import Path
import re,sys
s=Path(sys.argv[1]).read_text()
m=re.search(r'^APP_PAGES_ORIGIN\s*=\s*"([^"]+)"',s,re.M)
print(m.group(1) if m else '')
PY
)"
[ "$AFTER_ORIGIN" = "$STABLE_ALIAS" ] || fail "No se restauró APP_PAGES_ORIGIN estable"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "El runner dejó cambios locales"; }

sleep 4
for url in \
  "https://app.preview.intaprd.com/admin/login" \
  "https://app.preview.intaprd.com/admin/free" \
  "https://app.preview.intaprd.com/admin/free/account" \
  "https://app.preview.intaprd.com/admin/free/credentials"
do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

CODE="$(curl -sS -o /tmp/kawvo-credentials-check.json -w '%{http_code}' -X POST 'https://app.preview.intaprd.com/api/v1/me/account/credentials/verify/start' -H 'content-type: application/json' --data '{"purpose":"password"}')"
[ "$CODE" = "401" ] || { cat /tmp/kawvo-credentials-check.json 2>/dev/null || true; fail "API Credenciales respondió HTTP $CODE sin sesión, esperado 401"; }
rm -f /tmp/kawvo-credentials-check.json

WORKER_VERSION="$(grep -E 'Current Version ID:' "$WORKER_LOG" | tail -1 | sed -E 's/.*Current Version ID:[[:space:]]*//' || true)"
cat <<EOF
============================================================
✓ VERIFICACIÓN DE CREDENCIALES LIGADA A SESIÓN · PREVIEW
============================================================
Feature SHA: $(git rev-parse HEAD)
App Pages: $APP_ORIGIN
Worker Preview: ${WORKER_VERSION:-ver salida Wrangler}
RESEND_API_KEY: presente

Prueba desde cero:
1. Credenciales → Crear contraseña
2. Recibir OTP
3. Validar OTP
4. Crear contraseña
5. Cerrar sesión
6. Entrar con correo + contraseña Kawvo

Producción NO tocada
============================================================
EOF
