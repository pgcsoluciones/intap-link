#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
VENV="$ROOT/.venv-adonisg-assets"
OG_LOCAL="$ROOT/web/public/assets/adonisg/og/adonisg-og-v4.jpg"
BUCKET="intap-r2"
R2_KEY="profile-assets/argenisg/v1/og/adonisg-og-v4.jpg"
PROFILE_ID="profile-managed-argenisg"
WEB_PROJECT="intap-link"
TMP_SQL="/tmp/argenisg-og-v4-$$.sql"

fail(){ echo "✗ ERROR: $*" >&2; exit 1; }
run(){ echo "▶ $*"; "$@"; }
cleanup(){ rm -f "$TMP_SQL"; rm -rf "$ROOT/web/public/assets/adonisg/og"; }
trap cleanup EXIT

cd "$ROOT"

echo '============================================================'
echo 'KAWVO LINK · /argenisg · SOCIAL CARD V4 OFICIAL'
echo '============================================================'
echo '- usa la foto oficial indicada por el usuario'
echo '- 1200x630'
echo '- sin dirección web impresa'
echo '- nueva URL para evitar caché social anterior'
echo '============================================================'

run git checkout main
run git pull --ff-only github main
rm -rf "$ROOT/web/public/assets/adonisg/og"
[ -z "$(git status --porcelain)" ] || fail 'El árbol de trabajo contiene cambios ajenos al runner.'

if [ ! -x "$VENV/bin/python" ]; then run python3 -m venv "$VENV"; fi
run "$VENV/bin/python" -m pip install --quiet --upgrade pip Pillow
run "$VENV/bin/python" scripts/prepare-argenisg-og-v4.py

run "$VENV/bin/python" - "$OG_LOCAL" <<'PY'
from PIL import Image
import sys
p=sys.argv[1]
with Image.open(p) as im:
    assert im.size == (1200,630), im.size
    assert im.format == 'JPEG', im.format
print('✓ OG V4 validada 1200x630 JPEG')
PY

echo '▶ Subir OG V4 a R2'
(
  cd api
  npx wrangler r2 object put "$BUCKET/$R2_KEY" --file "$OG_LOCAL" --content-type image/jpeg >/dev/null
)

cat > "$TMP_SQL" <<SQL
INSERT INTO profile_assets (profile_id,asset_key,r2_key,kind,content_type,sort_order,is_active,metadata_json,updated_at)
VALUES ('$PROFILE_ID','og/adonisg-og-v4.jpg','$R2_KEY','image','image/jpeg',1001,1,'{"purpose":"social-card-v4-official-photo"}',datetime('now'))
ON CONFLICT(profile_id,asset_key) DO UPDATE SET r2_key=excluded.r2_key,content_type=excluded.content_type,is_active=1,metadata_json=excluded.metadata_json,updated_at=datetime('now');
UPDATE profiles
SET template_data=json_set(CASE WHEN json_valid(template_data) THEN template_data ELSE '{}' END,
  '$.social_image_url','https://intaprd.com/assets/adonisg/og/adonisg-og-v4.jpg'),
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
    for old in ('adonisg-og-v3.jpg','adonisg-og-v2.jpg','adonisg-og.jpg'):
        text=text.replace(old,'adonisg-og-v4.jpg')
    if 'adonisg-og-v4.jpg' not in text:
        raise SystemExit(f'No pude dejar OG V4 en {p}')
    p.write_text(text,encoding='utf-8')
    print(f'✓ {p}: OG -> V4')
PY

run git diff --check
run npm run build -w web
run git add functions/_middleware.ts functions/profile-discovery.ts web/src/components/profile-templates/IntapProfileAdonisgV1.tsx api/migrations/0046_argenisg_r2_assets.sql api/migrations-preview/0047_argenisg_r2_assets.sql
if ! git diff --cached --quiet; then
  run git commit -m 'fix: use official argenisg social card v4'
  run git push github main
fi

rm -rf "$ROOT/web/public/assets/adonisg/og"
run npm run build -w web
run npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch main

BASE='https://intaprd.com'
for _ in $(seq 1 15); do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$BASE/assets/adonisg/og/adonisg-og-v4.jpg?ts=$(date +%s)")"
  [ "$code" = 200 ] && break
  sleep 4
done
[ "$code" = 200 ] || fail "OG V4 respondió HTTP $code"

html="$(curl -sS -A 'WhatsApp/2.26' "$BASE/argenisg?og=v4&ts=$(date +%s)")"
printf '%s' "$html" | grep -Fq 'https://intaprd.com/assets/adonisg/og/adonisg-og-v4.jpg' || fail 'Crawler no recibe OG V4'
printf '%s' "$html" | grep -Fq 'summary_large_image' || fail 'Falta summary_large_image'

echo '============================================================'
echo '✓ SOCIAL CARD /argenisg V4 OFICIAL PUBLICADA'
echo '✓ FOTO OFICIAL + DATOS + SIN DIRECCIÓN WEB IMPRESA'
echo '============================================================'
