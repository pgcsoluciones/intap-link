#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/account-access-methods-v1"
LOG_DIR="$ROOT/.preview-account-access-forensic-live-v2"
TAIL_LOG="$LOG_DIR/worker-tail-full.log"
BEFORE_LOG="$LOG_DIR/d1-before.log"
AFTER_LOG="$LOG_DIR/d1-after.log"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

if [ ! -r /dev/tty ] || [ ! -w /dev/tty ]; then
  fail "Este forense necesita una Terminal interactiva con /dev/tty disponible"
fi

prompt_tty(){
  local prompt="$1"
  local answer=""
  printf '%s' "$prompt" > /dev/tty
  IFS= read -r answer < /dev/tty || fail "No pude leer respuesta desde /dev/tty"
  printf '%s' "$answer"
}

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" && mkdir -p "$LOG_DIR"

cat <<'EOF'
============================================================
KAWVO LINK · FORENSE EN VIVO V2 · PASSWORD POST-OTP · PREVIEW
============================================================
NO modifica código
NO despliega
NO aplica migraciones
NO toca Producción
NO modifica D1/R2

Esta versión NO avanza sola:
- usa /dev/tty, no STDIN del bloque de comandos pegado
- exige escribir LISTO antes de conectar el tail
- una vez conectado, exige escribir INICIAR
- después de reproducir el error, tú escribes TERMINAR
============================================================
EOF

run git fetch github "$BRANCH" main
run git checkout "$BRANCH"
run git pull --ff-only github "$BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Árbol local con cambios"; }

echo; echo "===== ESTADO D1 ANTES =====" | tee "$BEFORE_LOG"
(
  cd api
  npx wrangler d1 execute intap_db_preview --remote --config wrangler.preview.toml --command \
  "SELECT datetime('now') db_now; SELECT purpose,created_at,expires_at,consumed_at,attempts FROM account_verification_challenges ORDER BY created_at DESC LIMIT 3; SELECT purpose,created_at,expires_at,consumed_at,CASE WHEN session_id IS NULL THEN 'missing' ELSE 'present' END session_id FROM account_verified_actions ORDER BY created_at DESC LIMIT 3; SELECT COUNT(*) password_rows FROM user_password_credentials;"
) 2>&1 | tee -a "$BEFORE_LOG"

cat <<'EOF'

PASO 1 · PREPARAR NAVEGADOR
Abre:
https://app.preview.intaprd.com/admin/free/credentials

Déjala lista en Credenciales. NO pulses Crear contraseña todavía.
EOF

while true; do
  answer="$(prompt_tty 'Cuando el navegador esté listo, escribe LISTO y presiona Enter: ')"
  [ "$answer" = "LISTO" ] && break
  echo "Esperando exactamente: LISTO"
done

echo
cat <<'EOF'
PASO 2 · CONECTANDO TAIL DEL WORKER
Todavía NO hagas la prueba.
EOF

(
  cd api
  npx wrangler tail intap-api-preview --format json > "$TAIL_LOG" 2>&1
) &
TAIL_PID=$!
cleanup(){
  if kill -0 "$TAIL_PID" 2>/dev/null; then
    kill "$TAIL_PID" 2>/dev/null || true
    wait "$TAIL_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

sleep 5
if ! kill -0 "$TAIL_PID" 2>/dev/null; then
  cat "$TAIL_LOG" 2>/dev/null || true
  fail "wrangler tail terminó antes de iniciar la prueba"
fi

echo "✓ Tail conectado y esperando eventos."

while true; do
  answer="$(prompt_tty 'Escribe INICIAR cuando estés listo para hacer la prueba: ')"
  [ "$answer" = "INICIAR" ] && break
  echo "Esperando exactamente: INICIAR"
done

cat <<'EOF'

============================================================
CAPTURA ACTIVA AHORA
============================================================
Haz UNA sola vez:
Crear contraseña → recibir OTP → validar OTP → guardar contraseña.

Cuando veas éxito o el error, vuelve a esta Terminal.
NO repitas el flujo.
============================================================
EOF

while true; do
  answer="$(prompt_tty 'Después de reproducir el resultado, escribe TERMINAR y presiona Enter: ')"
  [ "$answer" = "TERMINAR" ] && break
  echo "Esperando exactamente: TERMINAR"
done

sleep 3
cleanup
trap - EXIT INT TERM

echo; echo "===== ESTADO D1 DESPUÉS =====" | tee "$AFTER_LOG"
(
  cd api
  npx wrangler d1 execute intap_db_preview --remote --config wrangler.preview.toml --command \
  "SELECT datetime('now') db_now; SELECT purpose,created_at,expires_at,consumed_at,attempts FROM account_verification_challenges ORDER BY created_at DESC LIMIT 5; SELECT purpose,created_at,expires_at,consumed_at,CASE WHEN session_id IS NULL THEN 'missing' ELSE 'present' END session_id FROM account_verified_actions ORDER BY created_at DESC LIMIT 5; SELECT COUNT(*) password_rows FROM user_password_credentials;"
) 2>&1 | tee -a "$AFTER_LOG"

echo; echo "===== REQUEST PASSWORD / STATUS / OUTCOME ====="
python3 - "$TAIL_LOG" <<'PY'
from pathlib import Path
import json,re,sys
p=Path(sys.argv[1])
text=p.read_text(errors='replace') if p.exists() else ''
interesting=[]
for line in text.splitlines():
    if ('/api/v1/me/account/password' in line or
        '/api/v1/me/account/credentials/verify/' in line or
        '[onError]' in line or
        'Internal server error' in line or
        'exception' in line.lower() or
        'exceeded' in line.lower()):
        interesting.append(line)
if not interesting:
    print('NO_SE_CAPTURARON_EVENTOS_RELEVANTES')
else:
    for line in interesting:
        # redact possible cookie header values before printing
        line=re.sub(r'(?i)(cookie["\s:=>]+)[^"\n,}]+',r'\1[REDACTED]',line)
        print(line[:8000])

print('\n===== RESUMEN JSON RELEVANTE =====')
count=0
for line in text.splitlines():
    try: obj=json.loads(line)
    except: continue
    s=json.dumps(obj,ensure_ascii=False)
    if ('/api/v1/me/account/password' in s or
        '/api/v1/me/account/credentials/verify/' in s or
        '[onError]' in s):
        s=re.sub(r'(?i)"cookie"\s*:\s*"[^"]*"','"cookie":"[REDACTED]"',s)
        print(s[:12000])
        count+=1
if count==0:
    print('SIN_JSON_RELEVANTE')
PY

cat <<EOF
============================================================
✓ FORENSE EN VIVO V2 TERMINADA
============================================================
Worker completo: $TAIL_LOG
D1 antes:         $BEFORE_LOG
D1 después:       $AFTER_LOG

Pásame toda esta salida.
NO se modificó Preview ni Producción.
============================================================
EOF
