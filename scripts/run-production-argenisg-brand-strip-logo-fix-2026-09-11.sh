#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
VENV="$ROOT/.venv-adonisg-assets"
SOURCE="$ROOT/assets-source/logo-ngro-hero-sin-fondo.png"
TARGET="$ROOT/web/public/assets/adonisg/brand/logo-black-transparent.png"
BUCKET="intap-r2"
R2_KEY="profile-assets/argenisg/v1/brand/logo-black-transparent.png"

fail(){ echo "✗ ERROR: $*" >&2; exit 1; }
run(){ echo "▶ $*"; "$@"; }
cleanup(){
  rm -rf "$ROOT/assets-source" 2>/dev/null || true
  rm -rf "$ROOT/web/public/assets/adonisg/brand" 2>/dev/null || true
}
trap cleanup EXIT

cd "$ROOT" || exit 1

echo '============================================================'
echo 'KAWVO LINK · /argenisg · LOGO DEBAJO DEL HERO'
echo '============================================================'
echo '- Corrige fallback que producía rectángulo negro'
echo '- Regenera PNG negro con transparencia real'
echo '- Reemplaza únicamente ese objeto en R2'
echo '============================================================'

run git checkout main
run git pull --ff-only github main
[ -z "$(git status --porcelain)" ] || fail 'El árbol de trabajo no está limpio.'

if [ ! -x "$VENV/bin/python" ]; then
  run python3 -m venv "$VENV"
fi
run "$VENV/bin/python" -m pip install --quiet --upgrade pip Pillow

# Force regeneration so a stale broken fallback can never be reused.
rm -rf "$ROOT/assets-source"
mkdir -p "$(dirname "$TARGET")"
run "$VENV/bin/python" scripts/ensure-adonisg-black-logo.py
[ -s "$SOURCE" ] || fail 'No se generó el logo fuente corregido.'
cp "$SOURCE" "$TARGET"

# Validate that transparency is real and that the file is not an opaque rectangle.
run "$VENV/bin/python" - "$TARGET" <<'PY'
from pathlib import Path
from PIL import Image
import sys
p = Path(sys.argv[1])
with Image.open(p) as im:
    rgba = im.convert('RGBA')
    a = rgba.getchannel('A')
    lo, hi = a.getextrema()
    bbox = a.getbbox()
    total = rgba.width * rgba.height
    nonzero = sum(1 for v in a.getdata() if v)
    coverage = nonzero / total if total else 1
    print(f'✓ PNG {rgba.width}x{rgba.height} · alpha {lo}..{hi} · cobertura {coverage:.1%}')
    if lo != 0 or hi == 0:
        raise SystemExit('ERROR: el PNG no tiene transparencia útil')
    if coverage > 0.70:
        raise SystemExit('ERROR: demasiada cobertura opaca; posible rectángulo negro')
    if not bbox:
        raise SystemExit('ERROR: logo completamente transparente')
PY

# Replace only the persistent R2 object. D1 key remains unchanged.
echo
echo '▶ Actualizar logo persistente en R2'
(
  cd api
  npx wrangler r2 object put "$BUCKET/$R2_KEY" --file "$TARGET" --content-type image/png >/dev/null
)

echo '✓ Objeto R2 actualizado'

# Verify production public route. Retry because Cloudflare edge may retain prior object briefly.
echo
echo '▶ Verificar producción'
for i in $(seq 1 12); do
  headers="$(curl -sSI "https://intaprd.com/assets/adonisg/brand/logo-black-transparent.png?fix=20260911-$i" | tr -d '\r')"
  code="$(printf '%s\n' "$headers" | awk 'toupper($1) ~ /^HTTP\// {c=$2} END{print c}')"
  source="$(printf '%s\n' "$headers" | awk -F': ' 'tolower($1)=="x-kawvo-asset-source"{print $2}' | tail -1)"
  ctype="$(printf '%s\n' "$headers" | awk -F': ' 'tolower($1)=="content-type"{print $2}' | tail -1)"
  if [ "$code" = '200' ] && [ "$source" = 'r2+d1' ] && [[ "$ctype" == image/png* ]]; then
    echo "✓ Producción: HTTP 200 · $ctype · source=$source"
    echo
    echo '============================================================'
    echo '✓ LOGO /argenisg DEBAJO DEL HERO CORREGIDO EN R2'
    echo '============================================================'
    exit 0
  fi
  sleep 3
done

fail 'El logo no respondió correctamente desde producción después de los reintentos.'
