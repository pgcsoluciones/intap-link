#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/account-access-methods-v1"
CFG="$ROOT/api/wrangler.preview.toml"
STABLE_ALIAS="https://feature-account-access-metho.intap-web2.pages.dev"
LOG_DIR="$ROOT/.preview-account-access-kdf-root-fix"
WORKER_LOG="$LOG_DIR/worker-preview.log"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" && mkdir -p "$LOG_DIR"

cat <<'EOF'
============================================================
KAWVO LINK · CREDENCIALES · ROOT FIX PBKDF2 · PREVIEW
============================================================
Corrige la causa forense confirmada:
- Workers rechaza PBKDF2 > 100000 iteraciones
- KDF queda en 100000 para crear y validar contraseña
- la autorización OTP ya NO se consume antes del hash/escritura
- password + consumo de autorización se guardan en un batch D1
- cambio de correo consume autorización solo después de crear el reto nuevo

SOLO API Preview
NO modifica D1/R2
NO toca Producción
NO redepliega App Pages
============================================================
EOF

run git fetch github "$BRANCH" main
run git checkout "$BRANCH"
run git pull --ff-only github "$BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Árbol local con cambios"; }

SRC="api/src/account-access-methods.ts"
grep -Fq 'const KDF_ITERATIONS = 100000' "$SRC" || fail "KDF no está en 100000"
if grep -Fq 'const KDF_ITERATIONS = 210000' "$SRC"; then fail "KDF antiguo 210000 todavía presente"; fi
grep -Fq "const action = await getVerifiedAction(c,userId,'password')" "$SRC" || fail "Password no valida autorización antes del hash"
grep -Fq 'c.env.DB.batch([' "$SRC" || fail "Falta batch atómico de password/autorización"
grep -Fq 'UPDATE account_verified_actions SET consumed_at=datetime' "$SRC" || fail "Falta consumo posterior de autorización"

PERSISTED_ORIGIN="$(python3 - "$CFG" <<'PY'
from pathlib import Path
import re,sys
s=Path(sys.argv[1]).read_text()
m=re.search(r'^APP_PAGES_ORIGIN\s*=\s*"([^"]+)"',s,re.M)
print(m.group(1) if m else '')
PY
)"
[ "$PERSISTED_ORIGIN" = "$STABLE_ALIAS" ] || fail "APP_PAGES_ORIGIN persistido no usa alias estable: $PERSISTED_ORIGIN"

run git diff --check
run bash -lc 'cd api && npx tsc --noEmit'

SECRET_LIST="$(cd api && npx wrangler secret list --config wrangler.preview.toml 2>/dev/null || true)"
printf '%s\n' "$SECRET_LIST" | grep -Fq 'RESEND_API_KEY' || fail "Falta RESEND_API_KEY en Preview"
echo "✓ RESEND_API_KEY presente"

(
  cd api
  npx wrangler deploy --config wrangler.preview.toml --dry-run
  npx wrangler deploy --config wrangler.preview.toml
) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Preview"

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

CODE="$(curl -sS -o /tmp/kawvo-credentials-root-fix.json -w '%{http_code}' -X POST 'https://app.preview.intaprd.com/api/v1/me/account/credentials/verify/start' -H 'content-type: application/json' --data '{"purpose":"password"}')"
[ "$CODE" = "401" ] || { cat /tmp/kawvo-credentials-root-fix.json 2>/dev/null || true; fail "API sin sesión respondió HTTP $CODE; esperado 401"; }
rm -f /tmp/kawvo-credentials-root-fix.json

WORKER_VERSION="$(grep -E 'Current Version ID:' "$WORKER_LOG" | tail -1 | sed -E 's/.*Current Version ID:[[:space:]]*//' || true)"

cat <<EOF
============================================================
✓ ROOT FIX PBKDF2 DESPLEGADO EN PREVIEW
============================================================
Feature SHA: $(git rev-parse HEAD)
Worker Preview: ${WORKER_VERSION:-ver salida Wrangler}
KDF: PBKDF2-SHA256 · 100000 iteraciones
Autorización: se consume después de persistir contraseña
App Preview: alias estable conservado
RESEND_API_KEY: presente

Prueba desde cero:
1. Credenciales → Crear contraseña
2. Recibir OTP
3. Validar OTP
4. Guardar contraseña
5. Cerrar sesión
6. Entrar con correo + contraseña Kawvo

Producción NO tocada
D1/R2 NO modificados
============================================================
EOF