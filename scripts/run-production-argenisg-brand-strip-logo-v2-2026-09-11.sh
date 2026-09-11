#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
VENV="$ROOT/.venv-adonisg-assets"
ASSET_SOURCE="$ROOT/assets-source"
GEN_SRC="$ASSET_SOURCE/logo-ngro-hero-sin-fondo.png"
GEN_DEST="$ROOT/web/public/assets/adonisg/brand/logo-black-transparent-v2.png"
R2_KEY="profile-assets/argenisg/v1/brand/logo-black-transparent-v2.png"
PROFILE_ID="profile-managed-argenisg"
COMP="$ROOT/web/src/components/profile-templates/IntapProfileAdonisgV1.tsx"
WEB_PROJECT="intap-link"
TMP_SQL="/tmp/argenisg-logo-v2-$$.sql"

fail(){ echo "✗ ERROR: $*" >&2; exit 1; }
run(){ echo "▶ $*"; "$@"; }
cleanup(){ rm -f "$TMP_SQL"; rm -rf "$ASSET_SOURCE"; rm -f "$GEN_DEST"; }
trap cleanup EXIT

cd "$ROOT"

echo '============================================================'
echo 'KAWVO LINK · /argenisg · LOGO BRAND STRIP V2'
echo '============================================================'
echo '- Regenera logo desde identidad oficial con detección de fondo'
echo '- Usa una URL nueva para saltar caché anterior'
echo '- Registra el nuevo asset en D1 y R2'
echo '- Actualiza componente, build, commit, deploy y smoke'
echo '============================================================'

run git checkout main
run git pull --ff-only github main
[ -z "$(git status --porcelain)" ] || fail 'El árbol de trabajo no está limpio.'

[ -x "$VENV/bin/python" ] || run python3 -m venv "$VENV"
run "$VENV/bin/python" -m pip install --quiet --upgrade pip Pillow
run "$VENV/bin/python" scripts/ensure-adonisg-black-logo.py
[ -s "$GEN_SRC" ] || fail 'No se generó el logo fuente corregido.'
mkdir -p "$(dirname "$GEN_DEST")"
cp "$GEN_SRC" "$GEN_DEST"

run "$VENV/bin/python" - "$GEN_DEST" <<'PY'
from PIL import Image
import sys
p=sys.argv[1]
with Image.open(p).convert('RGBA') as im:
    a=im.getchannel('A')
    lo,hi=a.getextrema()
    nz=sum(1 for px in a.getdata() if px>8)
    cov=nz/(im.width*im.height)
    print(f'✓ PNG V2 {im.width}x{im.height} · alpha {lo}..{hi} · cobertura {cov:.1%}')
    if hi == 0 or cov <= .01 or cov >= .92:
        raise SystemExit('Logo V2 inválido')
PY

# New R2 key avoids stale CDN/browser cache from the old URL.
echo
echo '▶ Subir logo V2 a R2'
(
  cd api
  npx wrangler r2 object put "intap-r2/$R2_KEY" --file "$GEN_DEST" --content-type image/png >/dev/null
)

cat > "$TMP_SQL" <<SQL
INSERT INTO profile_assets (profile_id,asset_key,r2_key,kind,content_type,sort_order,is_active,metadata_json,updated_at)
VALUES ('$PROFILE_ID','brand/logo-black-transparent-v2.png','$R2_KEY','image','image/png',4,1,'{"purpose":"brand-strip","version":2}',datetime('now'))
ON CONFLICT(profile_id,asset_key) DO UPDATE SET
  r2_key=excluded.r2_key,
  kind=excluded.kind,
  content_type=excluded.content_type,
  is_active=1,
  metadata_json=excluded.metadata_json,
  updated_at=datetime('now');
SQL
(
  cd api
  npx wrangler d1 execute intap_db --remote --config wrangler.toml --file "$TMP_SQL"
)

run python3 - "$COMP" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1])
s=p.read_text(encoding='utf-8')
old='/assets/adonisg/brand/logo-black-transparent.png'
new='/assets/adonisg/brand/logo-black-transparent-v2.png'
if new in s:
    print('✓ Componente ya usa logo V2')
elif old in s:
    s=s.replace(old,new,1)
    p.write_text(s,encoding='utf-8')
    print('✓ Brand strip actualizado a logo V2')
else:
    raise SystemExit('No encontré referencia del brand strip para parchear')
PY

run git diff --check
run npm run build -w web

run git add "$COMP"
if ! git diff --cached --quiet; then
  run git commit -m 'fix: use cache-busted argenis brand strip logo'
  run git push github main
fi

# Remove generated local public asset before final deploy to prove runtime persistence.
rm -f "$GEN_DEST"
rm -rf "$ASSET_SOURCE"
[ -z "$(git status --porcelain)" ] || fail 'Quedaron cambios locales inesperados.'

run npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch main

URL="https://intaprd.com/assets/adonisg/brand/logo-black-transparent-v2.png"
code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$URL?cb=$(date +%s)")"
[ "$code" = 200 ] || fail "Logo V2 respondió HTTP $code"
source_header="$(curl -sSI "$URL?cb=$(date +%s)" | tr -d '\r' | awk -F': ' 'tolower($1)=="x-kawvo-asset-source"{print $2}' | tail -1)"
[ "$source_header" = 'r2+d1' ] || fail "Logo V2 no reporta R2+D1: $source_header"

echo '============================================================'
echo '✓ LOGO BRAND STRIP V2 PUBLICADO Y CACHE-BUSTED'
echo '============================================================'
echo "$URL"
echo 'Ahora /argenisg usa una URL nueva; no puede reutilizar el rectángulo negro cacheado.'
echo '============================================================'
