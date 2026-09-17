#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/account-access-methods-v1"
APP_PROJECT="intap-web2"
CFG="$ROOT/api/wrangler.preview.toml"
PATCH="$ROOT/scripts/apply-account-password-recovery-v1-2026-09-17.py"
LOG_DIR="$ROOT/.preview-account-password-recovery-v1"
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
KAWVO LINK · OLVIDÉ MI CONTRASEÑA · PREVIEW V1
============================================================
Agrega recuperación segura desde Login:
- enlace "Olvidé mi contraseña"
- OTP al correo principal
- OTP expira en 10 minutos
- máximo 5 intentos por reto
- respuesta uniforme para no revelar si existe una cuenta
- autorización de restablecimiento en cookie HttpOnly/Secure
- nueva contraseña PBKDF2-SHA256 · 100000 iteraciones
- al restablecer, revoca sesiones activas anteriores
- Google y Correo seguro continúan disponibles

Preview completo sincronizado App + API.
Producción NO se toca.
D1/R2 NO se modifican.
============================================================
EOF

run git fetch github "$BRANCH" main
run git checkout "$BRANCH"
run git pull --ff-only github "$BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Árbol local con cambios"; }

run python3 "$PATCH"

# Invariantes de arquitectura y seguridad.
grep -Fq "password/reset/start" api/src/account-access-methods.ts || fail "Falta reset/start"
grep -Fq "password/reset/confirm" api/src/account-access-methods.ts || fail "Falta reset/confirm"
grep -Fq "password/reset/complete" api/src/account-access-methods.ts || fail "Falta reset/complete"
grep -Fq "purpose='password_reset'" api/src/account-access-methods.ts || fail "Falta autorización password_reset"
grep -Fq "UPDATE auth_sessions SET revoked_at=datetime('now')" api/src/account-access-methods.ts || fail "Reset no revoca sesiones previas"
grep -Fq "Olvidé mi contraseña" app/src/components/admin/AdminLogin.tsx || fail "Falta CTA Olvidé mi contraseña"
grep -Fq "recoveryStage === 'code'" app/src/components/admin/AdminLogin.tsx || fail "Falta etapa OTP"
grep -Fq "recoveryStage === 'new'" app/src/components/admin/AdminLogin.tsx || fail "Falta nueva contraseña"
grep -Fq "const KDF_ITERATIONS = 100000" api/src/account-access-methods.ts || fail "KDF incorrecto"

run git diff --check
run npm run build:preview -w app
run bash -lc 'cd api && npx tsc --noEmit'

SECRET_LIST="$(cd api && npx wrangler secret list --config wrangler.preview.toml 2>/dev/null || true)"
printf '%s\n' "$SECRET_LIST" | grep -Fq 'RESEND_API_KEY' || fail "Falta RESEND_API_KEY en Preview"
echo "✓ RESEND_API_KEY presente"

# Commit del código funcional antes del deploy.
git add api/src/account-access-methods.ts app/src/components/admin/AdminLogin.tsx
if ! git diff --cached --quiet; then
  run git commit -m "feat: add secure password recovery"
  run git push github "$BRANCH"
fi

# Build ya generado: desplegar App Preview de esta rama.
(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch feature-account-access-methods-v1) 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App Preview"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$APP_LOG" | tail -1)"
[ -n "$APP_ORIGIN" ] || fail "No pude detectar App Pages origin"
echo "✓ App Pages actual: $APP_ORIGIN"

# El config persistido debe quedar siempre en alias estable.
PERSISTED_ORIGIN="$(python3 - "$CFG" <<'PY'
from pathlib import Path
import re,sys
s=Path(sys.argv[1]).read_text()
m=re.search(r'^APP_PAGES_ORIGIN\s*=\s*"([^"]+)"',s,re.M)
print(m.group(1) if m else '')
PY
)"
[ "$PERSISTED_ORIGIN" = "$STABLE_ALIAS" ] || fail "wrangler.preview.toml no usa alias estable: $PERSISTED_ORIGIN"

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
print('✓ Worker Preview apuntará temporalmente a:', origin)
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
[ "$AFTER_ORIGIN" = "$STABLE_ALIAS" ] || fail "No se restauró alias estable"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Runner dejó cambios locales"; }

sleep 4
for url in \
  "https://app.preview.intaprd.com/admin/login" \
  "https://app.preview.intaprd.com/admin/free" \
  "https://app.preview.intaprd.com/admin/free/credentials"
do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

# QA público sin revelar existencia: correo inexistente debe devolver 200 genérico.
RESET_CODE="$(curl -sS -o "$LOG_DIR/reset-start.json" -w '%{http_code}' -X POST 'https://app.preview.intaprd.com/api/v1/auth/password/reset/start' -H 'content-type: application/json' --data '{"email":"qa-nonexistent-20260917@example.invalid"}')"
[ "$RESET_CODE" = "200" ] || { cat "$LOG_DIR/reset-start.json"; fail "reset/start respondió HTTP $RESET_CODE"; }
grep -Fq '"ok":true' "$LOG_DIR/reset-start.json" || fail "reset/start no devolvió respuesta uniforme"
echo "✓ Password reset público activo y anti-enumeración (HTTP 200 genérico)"

WORKER_VERSION="$(grep -E 'Current Version ID:' "$WORKER_LOG" | tail -1 | sed -E 's/.*Current Version ID:[[:space:]]*//' || true)"
cat <<EOF
============================================================
✓ OLVIDÉ MI CONTRASEÑA LISTO EN PREVIEW
============================================================
Feature SHA: $(git rev-parse HEAD)
App Pages: $APP_ORIGIN
Worker Preview: ${WORKER_VERSION:-ver salida Wrangler}
RESEND_API_KEY: presente
KDF: PBKDF2-SHA256 · 100000

Prueba:
1. Cierra sesión.
2. Acceder → Contraseña Kawvo.
3. Pulsa "Olvidé mi contraseña".
4. Confirma correo → OTP → nueva contraseña.
5. Verifica que la contraseña anterior ya no funcione.
6. Verifica que la nueva contraseña sí funcione.
7. Verifica que Google siga funcionando.

Producción NO tocada.
D1/R2 NO modificados.
============================================================
EOF
