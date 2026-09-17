#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/account-access-methods-v1"
CFG="$ROOT/api/wrangler.preview.toml"
LOG_DIR="$ROOT/.preview-account-access-forensic-live"
TAIL_LOG="$LOG_DIR/worker-tail-full.log"
BEFORE_LOG="$LOG_DIR/d1-before.log"
AFTER_LOG="$LOG_DIR/d1-after.log"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" && mkdir -p "$LOG_DIR"

cat <<'EOF'
============================================================
KAWVO LINK · FORENSE EN VIVO · PASSWORD POST-OTP · PREVIEW
============================================================
NO modifica código
NO despliega
NO aplica migraciones
NO toca Producción
NO modifica D1/R2

Objetivo: capturar exactamente el request POST /api/v1/me/account/password
que devuelve Internal server error, junto al estado D1 antes/después.
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

IMPORTANTE
1. Abre primero en el navegador:
   https://app.preview.intaprd.com/admin/free/credentials
2. Déjala lista, pero NO pulses Crear contraseña todavía.
3. Vuelve a esta Terminal y presiona Enter.
EOF
read -r _

echo
cat <<'EOF'
============================================================
CAPTURA ACTIVA DURANTE 120 SEGUNDOS
============================================================
AHORA reproduce UNA sola vez:
Crear contraseña → recibir OTP → validar OTP → guardar contraseña.
No repitas el flujo aunque falle.
============================================================
EOF

(
  cd api
  timeout 120 npx wrangler tail intap-api-preview --format json > "$TAIL_LOG" 2>&1 || true
) &
TAIL_PID=$!
sleep 4
echo "✓ Tail conectado. Haz la prueba AHORA."
wait "$TAIL_PID" || true

echo; echo "===== ESTADO D1 DESPUÉS =====" | tee "$AFTER_LOG"
(
  cd api
  npx wrangler d1 execute intap_db_preview --remote --config wrangler.preview.toml --command \
  "SELECT datetime('now') db_now; SELECT purpose,created_at,expires_at,consumed_at,attempts FROM account_verification_challenges ORDER BY created_at DESC LIMIT 5; SELECT purpose,created_at,expires_at,consumed_at,CASE WHEN session_id IS NULL THEN 'missing' ELSE 'present' END session_id FROM account_verified_actions ORDER BY created_at DESC LIMIT 5; SELECT COUNT(*) password_rows FROM user_password_credentials;"
) 2>&1 | tee -a "$AFTER_LOG"

echo; echo "===== REQUEST PASSWORD / STATUS / OUTCOME ====="
python3 - "$TAIL_LOG" <<'PY'
from pathlib import Path
import json,sys,re
p=Path(sys.argv[1])
text=p.read_text(errors='replace') if p.exists() else ''
shown=0
for line in text.splitlines():
    if '/api/v1/me/account/password' in line or '[onError]' in line or 'Internal server error' in line or 'exceeded' in line.lower():
        print(line)
        shown+=1
if not shown:
    print('NO_SE_CAPTURO_PASSWORD_POST')
print('\n===== RESUMEN DE EVENTOS JSON =====')
for line in text.splitlines():
    try: obj=json.loads(line)
    except: continue
    s=json.dumps(obj,ensure_ascii=False)
    if '/api/v1/me/account/password' in s or '[onError]' in s:
        # No imprimir cookies/headers completos.
        s=re.sub(r'(?i)"cookie"\s*:\s*"[^"]*"','"cookie":"[REDACTED]"',s)
        print(s[:6000])
PY

cat <<EOF
============================================================
✓ FORENSE EN VIVO TERMINADA
============================================================
Worker completo: $TAIL_LOG
D1 antes:         $BEFORE_LOG
D1 después:       $AFTER_LOG

Pásame toda esta salida.
NO se modificó Preview ni Producción.
============================================================
EOF
