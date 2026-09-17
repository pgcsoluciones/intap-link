#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/account-access-methods-v1"
APP_PROJECT="intap-web2"
CFG="$ROOT/api/wrangler.preview.toml"
LOG_DIR="$ROOT/.preview-account-access-methods-v1-stable-logs"
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
KAWVO LINK · ACCESS METHODS V1 · PREVIEW ESTABLE
============================================================
Este es el flujo canónico de despliegue Preview para Credenciales.

Garantías:
- compila la rama actual
- despliega una App Pages nueva
- captura su origin inmutable
- despliega el Worker Preview apuntando SOLO a ese origin
- restaura wrangler.preview.toml al alias estable de la rama
- conserva RESEND_API_KEY ya registrado
- evita que un cambio de secreto vuelva a una UI antigua
- Producción NO se toca
- D1/R2 NO se modifican
============================================================
EOF

run git fetch github "$BRANCH" main
run git checkout "$BRANCH"
run git pull --ff-only github "$BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "El árbol de trabajo no está limpio"; }

# La configuración persistida nunca debe contener un deployment inmutable viejo.
PERSISTED_ORIGIN="$(python3 - "$CFG" <<'PY'
from pathlib import Path
import re,sys
s=Path(sys.argv[1]).read_text()
m=re.search(r'^APP_PAGES_ORIGIN\s*=\s*"([^"]+)"',s,re.M)
print(m.group(1) if m else '')
PY
)"
[ "$PERSISTED_ORIGIN" = "$STABLE_ALIAS" ] || fail "wrangler.preview.toml no usa el alias estable esperado: $PERSISTED_ORIGIN"

run git diff --check
run npm run build:preview -w app
run bash -lc 'cd api && npx tsc --noEmit'

# Confirmar que el secreto existe antes del deploy; no se reescribe ni se imprime.
SECRET_LIST="$(cd api && npx wrangler secret list --config wrangler.preview.toml 2>/dev/null || true)"
printf '%s\n' "$SECRET_LIST" | grep -Fq 'RESEND_API_KEY' || fail "Falta RESEND_API_KEY en Worker Preview"
echo "✓ RESEND_API_KEY presente en Preview"

# Desplegar App actual y capturar origin inmutable.
(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch feature-account-access-methods-v1) 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App Preview"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$APP_LOG" | tail -1)"
[ -n "$APP_ORIGIN" ] || fail "No pude detectar el origin inmutable de App Pages"
echo "✓ App Pages actual: $APP_ORIGIN"

# Para el Worker se usa un config temporalmente sincronizado con el App recién desplegado.
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
print('✓ Worker Preview se desplegará contra:', origin)
PY

(
  cd api
  npx wrangler deploy --config wrangler.preview.toml --dry-run
  npx wrangler deploy --config wrangler.preview.toml
) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Preview"

restore_cfg
trap - EXIT

# Comprobar que el archivo volvió a la referencia estable y no quedó contaminado.
AFTER_ORIGIN="$(python3 - "$CFG" <<'PY'
from pathlib import Path
import re,sys
s=Path(sys.argv[1]).read_text()
m=re.search(r'^APP_PAGES_ORIGIN\s*=\s*"([^"]+)"',s,re.M)
print(m.group(1) if m else '')
PY
)"
[ "$AFTER_ORIGIN" = "$STABLE_ALIAS" ] || fail "No se restauró el alias estable de APP_PAGES_ORIGIN"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "El runner dejó cambios locales"; }

sleep 4

echo; echo "▶ QA técnico del front door"
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
[ "$CODE" = "401" ] || { cat /tmp/kawvo-credentials-check.json 2>/dev/null || true; fail "Endpoint de credenciales sin sesión respondió HTTP $CODE, esperado 401"; }
rm -f /tmp/kawvo-credentials-check.json
echo "✓ API Credenciales activa (401 esperado sin sesión)"

WORKER_VERSION="$(grep -E 'Current Version ID:' "$WORKER_LOG" | tail -1 | sed -E 's/.*Current Version ID:[[:space:]]*//' || true)"

cat <<EOF
============================================================
✓ PREVIEW ESTABLE Y SIN REGRESIÓN DE RUTA
============================================================
Feature SHA: $(git rev-parse HEAD)
App Pages: $APP_ORIGIN
Worker Preview: ${WORKER_VERSION:-ver salida Wrangler}
Config persistida: $STABLE_ALIAS
RESEND_API_KEY: presente

Abrir:
https://app.preview.intaprd.com/admin/free
https://app.preview.intaprd.com/admin/free/credentials

Producción NO tocada
D1/R2 NO tocados
============================================================
EOF
