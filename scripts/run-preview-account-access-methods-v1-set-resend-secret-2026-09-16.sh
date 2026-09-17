#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/account-access-methods-v1"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }

cd "$ROOT" || fail "No existe $ROOT"

git fetch github "$BRANCH" >/dev/null 2>&1 || fail "git fetch"
git checkout "$BRANCH" >/dev/null || fail "git checkout"
git pull --ff-only github "$BRANCH" >/dev/null || fail "git pull"

cat <<'EOF'
============================================================
KAWVO LINK · CONFIGURAR RESEND · SOLO PREVIEW
============================================================
Actualiza únicamente el secreto RESEND_API_KEY del Worker Preview.
NO vuelve a desplegar el Worker ni reescribe APP_PAGES_ORIGIN.
Así la configuración de correo no puede regresar la App Preview a una UI vieja.

No se guarda la clave en archivos ni se imprime en pantalla.
Producción NO se toca.
============================================================
EOF

printf '\nPega la clave RESEND_API_KEY de Resend y presiona Enter: '
IFS= read -r -s RESEND_VALUE
echo
[ -n "$RESEND_VALUE" ] || fail "No se recibió ninguna clave"

printf '%s' "$RESEND_VALUE" | (cd api && npx wrangler secret put RESEND_API_KEY --config wrangler.preview.toml >/dev/null) || fail "No pude registrar RESEND_API_KEY en Preview"
unset RESEND_VALUE

echo "✓ Secreto actualizado en intap-api-preview"

echo
SECRET_LIST="$(cd api && npx wrangler secret list --config wrangler.preview.toml 2>/dev/null || true)"
printf '%s\n' "$SECRET_LIST" | grep -Fq 'RESEND_API_KEY' || fail "Cloudflare no lista RESEND_API_KEY después de actualizarlo"
echo "✓ RESEND_API_KEY confirmado en Preview"

echo
printf 'Verificando que la App Preview siga sirviendo la rama actual...\n'
for url in \
  "https://app.preview.intaprd.com/admin/login" \
  "https://app.preview.intaprd.com/admin/free" \
  "https://app.preview.intaprd.com/admin/free/credentials"
do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

printf 'Probando endpoint de Credenciales sin sesión (debe responder 401)...\n'
CODE="$(curl -sS -o /tmp/kawvo-credentials-check.json -w '%{http_code}' -X POST 'https://app.preview.intaprd.com/api/v1/me/account/credentials/verify/start' -H 'content-type: application/json' --data '{"purpose":"password"}')"
case "$CODE" in
  401) echo "✓ Endpoint activo (HTTP 401 esperado sin sesión)" ;;
  503) cat /tmp/kawvo-credentials-check.json 2>/dev/null || true; fail "El endpoint respondió 503" ;;
  *) echo "ℹ Endpoint respondió HTTP $CODE sin sesión" ;;
esac
rm -f /tmp/kawvo-credentials-check.json

cat <<'EOF'
============================================================
✓ RESEND PREVIEW CONFIGURADO SIN REDEPLOY DEL FRONT DOOR
============================================================
Ahora prueba:
Mi cuenta → Credenciales → Crear contraseña

Producción NO tocada.
============================================================
EOF
