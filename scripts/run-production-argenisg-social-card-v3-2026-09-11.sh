#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
VENV="$ROOT/.venv-adonisg-assets"
OG_LOCAL="$ROOT/web/public/assets/adonisg/og/adonisg-og-v3.jpg"
BUCKET="intap-r2"
R2_KEY="profile-assets/argenisg/v1/og/adonisg-og-v3.jpg"
PROFILE_ID="profile-managed-argenisg"
WEB_PROJECT="intap-link"
TMP_SQL="/tmp/argenisg-og-v3-$$.sql"

fail(){ echo "✗ ERROR: $*" >&2; exit 1; }
run(){ echo "▶ $*"; "$@"; }
cleanup(){ rm -f "$TMP_SQL"; rm -rf "$ROOT/web/public/assets/adonisg/og"; rm -rf "$ROOT/assets-source"; }
trap cleanup EXIT

cd "$ROOT"

echo '============================================================'
echo 'KAWVO LINK · /argenisg · SOCIAL CARD V3 EDITORIAL'
echo '============================================================'
echo '- 1200x630'
echo '- composición editorial crema + retrato contenido'
echo '- texto de marca y profesión dentro de zona segura'
echo '- URL nueva para evitar reutilizar V1/V2'
echo '============================================================'

run git checkout main
run git pull --ff-only github main

# Solo limpiamos residuos generados conocidos de intentos anteriores.
rm -rf "$ROOT/assets-source" "$ROOT/web/public/assets/adonisg/og"
[ -z "$(git status --porcelain)" ] || fail 'El árbol de trabajo contiene cambios ajenos al runner.'

if [ ! -x "$VENV/bin/python" ]; then run python3 -m venv "$VENV"; fi
run "$VENV/bin/python" -m pip install --quiet --upgrade pip Pillow
run "$VENV/bin/python" scripts/prepare-argenisg-og-v3.py

run "$VENV/bin/python" - "$OG_LOCAL" <<'PY'
from PIL import Image
import sys
p=sys.argv[1]
with Image.open(p) as im:
    assert im.size == (1200,630), im.size
    assert im.format == 'JPEG', im.format
    # Evita publicar una tarjeta accidentalmente casi negra o casi blanca.
    thumb=im.convert('L').resize((64,34))
    avg=sum(thumb.getdata())/(64*34)
    assert 35 < avg < 235, avg
print('✓ OG V3 validada 1200x630 JPEG y rango visual correcto')
PY

echo '▶ Subir OG V3 a R2'
(
  cd api
  npx wrangler r2 object put "$BUCKET/$R2_KEY" --file "$OG_LOCAL" --content-type image/jpeg >/dev/null
)

cat > "$TMP_SQL" <<SQL
INSERT INTO profile_assets (profile_id,asset_key,r2_key,kind,content_type,sort_order,is_active,metadata_json,updated_at)
VALUES ('$PROFILE_ID','og/adonisg-og-v3.jpg','$R2_KEY','image','image/jpeg',1000,1,'{"purpose":"social-card-v3-editorial"}',datetime('now'))
ON CONFLICT(profile_id,asset_key) DO UPDATE SET r2_key=excluded.r2_key,content_type=excluded.content_type,is_active=1,metadata_json=excluded.metadata_json,updated_at=datetime('now');
UPDATE profiles
SET template_data=json_set(CASE WHEN json_valid(template_data) THEN template_data ELSE '{}' END,
  '$.social_image_url','https://intaprd.com/assets/adonisg/og/adonisg-og-v3.jpg'),
  updated_at=datetime('now')
WHERE id='$PROFILE_ID';
SQL
(
  cd api
  npx wrangler d1 execute intap_db --remote --config wrangler.toml --file "$TMP_SQL"
)

run python3 - <<'PY'
from pathlib import Path
files = [
    Path('functions/_middleware.ts'),
    Path('functions/profile-discovery.ts'),
    Path('web/src/components/profile-templates/IntapProfileAdonisgV1.tsx'),
    Path('api/migrations/0046_argenisg_r2_assets.sql'),
    Path('api/migrations-preview/0047_argenisg_r2_assets.sql'),
]
for p in files:
    text=p.read_text(encoding='utf-8')
    updated=text.replace('adonisg-og-v2.jpg','adonisg-og-v3.jpg').replace('adonisg-og.jpg','adonisg-og-v3.jpg')
    if 'adonisg-og-v3.jpg' not in updated:
        raise SystemExit(f'No pude dejar OG V3 en {p}')
    if updated != text:
        p.write_text(updated,encoding='utf-8')
        print(f'✓ {p}: OG -> V3')
    else:
        print(f'✓ {p}: ya usa V3')
PY

# Los crawlers deben recibir siempre el HTML de metadata fresco.
run python3 - <<'PY'
from pathlib import Path
p=Path('functions/_middleware.ts')
text=p.read_text(encoding='utf-8')
needle="    headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');\n"
insert="""    headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    const ua = context.request.headers.get('user-agent') || '';
    const isSocialCrawler = /(WhatsApp|Twitterbot|facebookexternalhit|Facebot|LinkedInBot|TelegramBot|Slackbot)/i.test(ua);
    if (requestUrl.pathname === '/argenisg' && isSocialCrawler) {
      headers.set('Cache-Control', 'no-store, no-cache, max-age=0, must-revalidate');
      headers.set('Surrogate-Control', 'no-store');
    }
"""
if 'const isSocialCrawler =' not in text:
    if needle not in text:
        raise SystemExit('No encontré ancla de headers en middleware')
    text=text.replace(needle,insert,1)
    p.write_text(text,encoding='utf-8')
    print('✓ Middleware: no-cache para crawlers sociales en /argenisg')
else:
    print('✓ Middleware: política crawler ya presente')
PY

run git diff --check
run npm run build -w web

run git add functions/_middleware.ts functions/profile-discovery.ts web/src/components/profile-templates/IntapProfileAdonisgV1.tsx api/migrations/0046_argenisg_r2_assets.sql api/migrations-preview/0047_argenisg_r2_assets.sql
if ! git diff --cached --quiet; then
  run git commit -m 'fix: publish editorial argenisg social card v3'
  run git push github main
fi

# El OG vive en R2; nunca lo empaquetamos como estático Pages.
rm -rf "$ROOT/web/public/assets/adonisg/og" "$ROOT/assets-source"
run npm run build -w web
run npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch main

BASE='https://intaprd.com'
for _ in $(seq 1 15); do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$BASE/assets/adonisg/og/adonisg-og-v3.jpg?check=$(date +%s)")"
  [ "$code" = 200 ] && break
  sleep 4
done
[ "$code" = 200 ] || fail "OG V3 respondió HTTP $code"

# Primero validamos con query de cache-bust; luego informamos el estado de la URL limpia.
html="$(curl -sS -A 'WhatsApp/2.26' "$BASE/argenisg?og=v3&ts=$(date +%s)")"
printf '%s' "$html" | grep -Fq 'https://intaprd.com/assets/adonisg/og/adonisg-og-v3.jpg' || fail 'Crawler cache-busted no recibe OG V3'
printf '%s' "$html" | grep -Fq 'summary_large_image' || fail 'Falta summary_large_image'

clean_html="$(curl -sS -A 'WhatsApp/2.26' "$BASE/argenisg" || true)"
if printf '%s' "$clean_html" | grep -Fq 'adonisg-og-v3.jpg'; then
  echo '✓ URL limpia /argenisg ya entrega OG V3'
else
  echo '⚠️ URL limpia aún puede estar propagando metadata anterior; la versión cache-busted ya entrega V3.'
fi

echo '============================================================'
echo '✓ SOCIAL CARD /argenisg V3 EDITORIAL PUBLICADA'
echo '✓ R2 + D1 + metadata server-side actualizados'
echo '============================================================'
