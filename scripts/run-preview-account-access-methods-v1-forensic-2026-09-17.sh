#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/account-access-methods-v1"
LOG_DIR="$ROOT/.preview-account-access-forensic-logs"
D1_LOG="$LOG_DIR/d1-forensic.log"
TAIL_LOG="$LOG_DIR/worker-tail.log"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" && mkdir -p "$LOG_DIR"

cat <<'EOF'
============================================================
KAWVO LINK · FORENSE CREDENCIALES · SOLO PREVIEW
============================================================
NO modifica código
NO despliega
NO aplica migraciones
NO toca Producción

Audita:
- tablas y columnas reales en D1 Preview
- almacenamiento de OTP y autorizaciones
- reloj SQLite y TTL efectivos
- consumo/expiración de retos y acciones
- existencia de credencial de contraseña
- excepciones reales del Worker mientras reproduces el fallo
============================================================
EOF

run git fetch github "$BRANCH" main
run git checkout "$BRANCH"
run git pull --ff-only github "$BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "El árbol de trabajo no está limpio"; }

{
  echo "===== SHA ====="
  git rev-parse HEAD
  echo
  echo "===== MIGRACIONES APLICADAS ====="
  (cd api && npx wrangler d1 migrations list intap_db_preview --remote --config wrangler.preview.toml) || true
  echo
  echo "===== RELOJ D1 ====="
  (cd api && npx wrangler d1 execute intap_db_preview --remote --config wrangler.preview.toml --command "SELECT datetime('now') AS db_now, strftime('%s','now') AS epoch_now;")
  echo
  echo "===== SCHEMA account_verification_challenges ====="
  (cd api && npx wrangler d1 execute intap_db_preview --remote --config wrangler.preview.toml --command "PRAGMA table_info(account_verification_challenges);")
  echo
  echo "===== SCHEMA account_verified_actions ====="
  (cd api && npx wrangler d1 execute intap_db_preview --remote --config wrangler.preview.toml --command "PRAGMA table_info(account_verified_actions);")
  echo
  echo "===== SCHEMA user_password_credentials ====="
  (cd api && npx wrangler d1 execute intap_db_preview --remote --config wrangler.preview.toml --command "PRAGMA table_info(user_password_credentials);")
  echo
  echo "===== ÍNDICES ====="
  (cd api && npx wrangler d1 execute intap_db_preview --remote --config wrangler.preview.toml --command "PRAGMA index_list(account_verification_challenges);")
  (cd api && npx wrangler d1 execute intap_db_preview --remote --config wrangler.preview.toml --command "PRAGMA index_list(account_verified_actions);")
  (cd api && npx wrangler d1 execute intap_db_preview --remote --config wrangler.preview.toml --command "PRAGMA index_list(user_password_credentials);")
  echo
  echo "===== ÚLTIMOS RETOS OTP (SIN HASH/CÓDIGO) ====="
  (cd api && npx wrangler d1 execute intap_db_preview --remote --config wrangler.preview.toml --command "SELECT purpose, substr(email,1,3)||'***' AS email_mask, attempts, created_at, expires_at, consumed_at, CAST((julianday(expires_at)-julianday('now'))*86400 AS INTEGER) AS ttl_seconds FROM account_verification_challenges ORDER BY created_at DESC LIMIT 12;")
  echo
  echo "===== ÚLTIMAS AUTORIZACIONES (SIN TOKEN) ====="
  (cd api && npx wrangler d1 execute intap_db_preview --remote --config wrangler.preview.toml --command "SELECT purpose, CASE WHEN session_id IS NULL OR session_id='' THEN 'missing' ELSE 'present' END AS session_id, created_at, expires_at, consumed_at, CAST((julianday(expires_at)-julianday('now'))*86400 AS INTEGER) AS ttl_seconds FROM account_verified_actions ORDER BY created_at DESC LIMIT 12;")
  echo
  echo "===== ESTADO DE CONTRASEÑA PARA USUARIOS CON RETOS RECIENTES ====="
  (cd api && npx wrangler d1 execute intap_db_preview --remote --config wrangler.preview.toml --command "SELECT substr(u.email,1,3)||'***' AS email_mask, CASE WHEN pc.user_id IS NULL THEN 0 ELSE 1 END AS password_enabled, pc.created_at, pc.updated_at FROM users u LEFT JOIN user_password_credentials pc ON pc.user_id=u.id WHERE u.id IN (SELECT user_id FROM account_verification_challenges ORDER BY created_at DESC LIMIT 10) GROUP BY u.id ORDER BY max((SELECT created_at FROM account_verification_challenges c WHERE c.user_id=u.id)) DESC;") || true
} 2>&1 | tee "$D1_LOG"

echo
cat <<'EOF'
============================================================
AHORA HAREMOS CAPTURA FORENSE DEL WORKER
============================================================
Durante los próximos 75 segundos:
1. Abre https://app.preview.intaprd.com/admin/free/credentials
2. Inicia Crear contraseña desde cero
3. Ingresa el OTP
4. Intenta Guardar contraseña hasta provocar el error

NO cierres esta Terminal durante la captura.
============================================================
EOF

python3 - "$ROOT/api" "$TAIL_LOG" <<'PY'
import subprocess,sys,time,signal,os
cwd=sys.argv[1]; log=sys.argv[2]
with open(log,'w') as f:
    p=subprocess.Popen(['npx','wrangler','tail','--config','wrangler.preview.toml','--format','json'],cwd=cwd,stdout=f,stderr=subprocess.STDOUT,text=True)
    try:
        time.sleep(75)
    finally:
        p.terminate()
        try:
            p.wait(timeout=5)
        except subprocess.TimeoutExpired:
            p.kill(); p.wait()
print('✓ Captura Worker terminada')
PY

echo
echo "===== ERRORES / EXCEPCIONES DEL WORKER ====="
python3 - "$TAIL_LOG" <<'PY'
from pathlib import Path
import sys,re
p=Path(sys.argv[1])
text=p.read_text(errors='ignore') if p.exists() else ''
lines=text.splitlines()
keep=[]
for line in lines:
    low=line.lower()
    if any(k in low for k in ['exception','error','internal','account/password','credentials/verify','pbkdf2','d1','sql','cpu','1102']):
        keep.append(line)
if keep:
    print('\n'.join(keep[-120:]))
else:
    print('No se detectaron líneas filtradas; revisar log completo:', p)
PY

echo
cat <<EOF
============================================================
✓ FORENSE COMPLETADA · SIN CAMBIOS DE ESTADO
============================================================
D1:     $D1_LOG
Worker: $TAIL_LOG

Pásame la salida de esta ejecución. Con esto podremos identificar exactamente
si el fallo ocurre en cookie/autorización, TTL, PBKDF2, D1 o escritura final.

Producción NO tocada
Preview NO redeployado
D1/R2 NO modificados
============================================================
EOF
