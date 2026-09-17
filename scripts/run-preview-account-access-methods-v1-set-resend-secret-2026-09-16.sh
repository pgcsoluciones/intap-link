#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/account-access-methods-v1"
CFG="$ROOT/api/wrangler.preview.toml"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }

cd "$ROOT" || fail "No existe $ROOT"

git fetch github "$BRANCH" >/dev/null 2>&1 || fail "git fetch"
git checkout "$BRANCH" >/dev/null || fail "git checkout"
git pull --ff-only github "$BRANCH" >/dev/null || fail "git pull"

cat <<'EOF'
============================================================
KAWVO LINK · CONFIGURAR RESEND · SOLO PREVIEW
============================================================
Este paso solicita la clave RESEND_API_KEY de forma oculta.
No se guarda en archivos ni se imprime en pantalla.
Producción NO se toca.
============================================================
EOF

printf '\nPega la clave RESEND_API_KEY de Resend y presiona Enter: '
IFS= read -r -s RESEND_VALUE
echo
[ -n "$RESEND_VALUE" ] || fail "No se recibió ninguna clave"

printf '%s' "$RESEND_VALUE" | (cd api && npx wrangler secret put RESEND_API_KEY --config wrangler.preview.toml >/dev/null) || fail "No pude registrar RESEND_API_KEY en Preview"
unset RESEND_VALUE

echo "✓ Secreto regrabado en intap-api-preview"

(
  cd api
  npx wrangler deploy --config wrangler.preview.toml
) || fail "Deploy Worker Preview"

echo
SECRET_LIST="$(cd api && npx wrangler secret list --config wrangler.preview.toml 2>/dev/null || true)"
printf '%s\n' "$SECRET_LIST" | grep -Fq 'RESEND_API_KEY' || fail "Cloudflare no lista RESEND_API_KEY después de regrabarlo"

echo "✓ RESEND_API_KEY confirmado en Preview"

echo
printf 'Probando endpoint de Credenciales (sin sesión debe responder 401, no 503)...\n'
CODE="$(curl -sS -o /tmp/kawvo-credentials-check.json -w '%{http_code}' -X POST 'https://app.preview.intaprd.com/api/v1/me/account/credentials/verify/start' -H 'content-type: application/json' --data '{"purpose":"password"}')"
case "$CODE" in
  401) echo "✓ Endpoint activo y Worker actualizado (HTTP 401 esperado sin sesión)" ;;
  503) cat /tmp/kawvo-credentials-check.json 2>/dev/null || true; fail "El Worker sigue respondiendo 503" ;;
  *) echo "ℹ Endpoint respondió HTTP $CODE sin sesión; continúa con prueba autenticada en navegador" ;;
esac
rm -f /tmp/kawvo-credentials-check.json

cat <<'EOF'
============================================================
✓ RESEND PREVIEW CONFIGURADO
============================================================
Ahora prueba:
Mi cuenta → Credenciales → Crear contraseña

Producción NO tocada.
============================================================
EOF
