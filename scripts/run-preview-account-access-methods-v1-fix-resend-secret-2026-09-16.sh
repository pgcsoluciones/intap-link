#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/account-access-methods-v1"
CFG="api/wrangler.preview.toml"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }

cd "$ROOT" || fail "No existe $ROOT"

echo "============================================================"
echo "KAWVO LINK · REPARAR RESEND PREVIEW"
echo "============================================================"
echo "SOLO Worker Preview. Producción NO se toca."
echo "============================================================"

git fetch github "$BRANCH" >/dev/null
git checkout "$BRANCH" >/dev/null
git pull --ff-only github "$BRANCH" >/dev/null
[ -z "$(git status --porcelain)" ] || fail "El árbol de trabajo no está limpio"

echo
echo "▶ Verificando nombre exacto del secreto en intap-api-preview"
SECRET_JSON="$(cd api && npx wrangler secret list --config wrangler.preview.toml 2>/dev/null || true)"
EXACT_PRESENT="$(printf '%s' "$SECRET_JSON" | python3 -c 'import json,sys; s=sys.stdin.read();
try:
 d=json.loads(s); print("1" if any((isinstance(x,dict) and x.get("name")=="RESEND_API_KEY") for x in d) else "0")
except Exception:
 print("1" if any(line.strip()=="RESEND_API_KEY" for line in s.splitlines()) else "0")')"

echo "Secreto exacto RESEND_API_KEY registrado: $([ "$EXACT_PRESENT" = "1" ] && echo sí || echo no)"

RESEND_VALUE="${RESEND_API_KEY:-}"
SOURCE="variable de entorno"
if [ -z "$RESEND_VALUE" ]; then
  for candidate in "$ROOT/.env" "$ROOT/api/.env" "$ROOT/api/.dev.vars"; do
    [ -f "$candidate" ] || continue
    value="$(python3 - "$candidate" <<'PY'
from pathlib import Path
import re,sys
s=Path(sys.argv[1]).read_text(errors='ignore')
m=re.search(r'(?m)^\s*RESEND_API_KEY\s*=\s*["\x27]?([^"\x27\n\r]+)',s)
print((m.group(1).strip() if m else ''))
PY
)"
    if [ -n "$value" ]; then RESEND_VALUE="$value"; SOURCE="$candidate"; break; fi
  done
fi

if [ -n "$RESEND_VALUE" ]; then
  echo "✓ Encontré una copia local segura en $SOURCE; regrabando el secreto SOLO en Preview."
  (cd api && printf '%s' "$RESEND_VALUE" | npx wrangler secret put RESEND_API_KEY --config wrangler.preview.toml >/dev/null) || fail "No pude regrabar RESEND_API_KEY"
  unset RESEND_VALUE value
else
  if [ "$EXACT_PRESENT" = "1" ]; then
    fail "Cloudflare lista RESEND_API_KEY, pero no hay copia local para regrabarlo y el runtime no lo está recibiendo. Necesitamos reconfigurar ese secreto de Preview con el valor real."
  else
    fail "RESEND_API_KEY no existe exactamente en Preview y no encontré una copia local segura."
  fi
fi

echo
echo "▶ Redeploy Worker Preview para cargar el secreto actual"
(cd api && npx wrangler deploy --config wrangler.preview.toml) || fail "Deploy Worker Preview"

sleep 4

echo
echo "▶ Verificación de configuración runtime"
# Endpoint autenticado no puede probarse por curl sin sesión, pero el deploy ya debe heredar el secreto regrabado.
# Verificamos que el secreto exacto siga registrado después del deploy.
SECRET_JSON2="$(cd api && npx wrangler secret list --config wrangler.preview.toml 2>/dev/null || true)"
EXACT_PRESENT2="$(printf '%s' "$SECRET_JSON2" | python3 -c 'import json,sys; s=sys.stdin.read();
try:
 d=json.loads(s); print("1" if any((isinstance(x,dict) and x.get("name")=="RESEND_API_KEY") for x in d) else "0")
except Exception:
 print("1" if any(line.strip()=="RESEND_API_KEY" for line in s.splitlines()) else "0")')"
[ "$EXACT_PRESENT2" = "1" ] || fail "El secreto exacto no quedó registrado después del deploy"

echo "✓ RESEND_API_KEY regrabado y Worker Preview redesplegado"
echo ""
echo "Prueba otra vez: Mi cuenta → Credenciales → Crear contraseña"
echo "Producción NO tocada"
