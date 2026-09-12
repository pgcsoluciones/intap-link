#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
VENV="$ROOT/.venv-adonisg-assets"
OG_LOCAL="$ROOT/web/public/assets/adonisg/og/adonisg-og-v6.png"
BUCKET="intap-r2"
R2_KEY="profile-assets/argenisg/v1/og/adonisg-og-v6.png"
PROFILE_ID="profile-managed-argenisg"
WEB_PROJECT="intap-link"
TMP_SQL="/tmp/argenisg-og-v6-$$.sql"

fail(){ echo "✗ ERROR: $*" >&2; exit 1; }
run(){ echo "▶ $*"; "$@"; }
cleanup(){ rm -f "$TMP_SQL"; rm -rf "$ROOT/web/public/assets/adonisg/og"; }
trap cleanup EXIT

cd "$ROOT"

echo '============================================================'
echo 'KAWVO LINK · /argenisg · SOCIAL CARD V6 · FORMATO EXACTO'
echo '============================================================'
echo '- usa la portada exacta aprobada por el usuario'
echo '- conserva relación de aspecto original'
echo '- sin crop, sin resize, sin relleno, sin texto añadido'
echo '- nueva URL para romper caché social anterior'
echo '============================================================'

run git checkout main
run git pull --ff-only github main
[ -z "$(git status --porcelain)" ] || fail 'El árbol de trabajo no está limpio.'

if [ ! -x "$VENV/bin/python" ]; then run python3 -m venv "$VENV"; fi
run "$VENV/bin/python" -m pip install --quiet --upgrade pip Pillow
run "$VENV/bin/python" scripts/prepare-argenisg-og-v6.py

read OG_W OG_H <<<"$($VENV/bin/python - "$OG_LOCAL" <<'PY'
from PIL import Image
import sys
with Image.open(sys.argv[1]) as im:
    assert im.format == 'PNG', im.format
    print(im.width, im.height)
PY
)"

echo "✓ OG V6 validada PNG ${OG_W}x${OG_H}"

echo '▶ Subir OG V6 a R2'
(
  cd api
  npx wrangler r2 object put "$BUCKET/$R2_KEY" --file "$OG_LOCAL" --content-type image/png >/dev/null
)

cat > "$TMP_SQL" <<SQL
INSERT INTO profile_assets (profile_id,asset_key,r2_key,kind,content_type,sort_order,is_active,metadata_json,updated_at)
VALUES ('$PROFILE_ID','og/adonisg-og-v6.png','$R2_KEY','image','image/png',1002,1,'{"purpose":"social-card-v6-exact-format","width":$OG_W,"height":$OG_H}',datetime('now'))
ON CONFLICT(profile_id,asset_key) DO UPDATE SET r2_key=excluded.r2_key,content_type=excluded.content_type,is_active=1,metadata_json=excluded.metadata_json,updated_at=datetime('now');
UPDATE profiles
SET template_data=json_set(CASE WHEN json_valid(template_data) THEN template_data ELSE '{}' END,
  '$.social_image_url','https://intaprd.com/assets/adonisg/og/adonisg-og-v6.png'),
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
    updated=text
    for old in ['adonisg-og-v5.jpg','adonisg-og-v4.jpg','adonisg-og-v3.jpg','adonisg-og-v2.jpg','adonisg-og.jpg']:
        updated=updated.replace(old,'adonisg-og-v6.png')
    if 'adonisg-og-v6.png' not in updated:
        raise SystemExit(f'No pude dejar OG V6 en {p}')
    if updated != text:
        p.write_text(updated,encoding='utf-8')
        print(f'✓ {p}: OG -> V6')
    else:
        print(f'✓ {p}: ya usa V6')
PY

run git diff --check
run npm run build -w web

run git add functions/_middleware.ts functions/profile-discovery.ts web/src/components/profile-templates/IntapProfileAdonisgV1.tsx api/migrations/0046_argenisg_r2_assets.sql api/migrations-preview/0047_argenisg_r2_assets.sql
if ! git diff --cached --quiet; then
  run git commit -m 'fix: use exact-format argenisg social card v6'
  run git push github main
fi

# El OG vive en R2, no en Pages.
rm -rf "$ROOT/web/public/assets/adonisg/og"
run npm run build -w web
run npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch main

BASE='https://intaprd.com'
code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$BASE/assets/adonisg/og/adonisg-og-v6.png?check=$(date +%s)")"
[ "$code" = 200 ] || fail "OG V6 respondió HTTP $code"

html="$(curl -sS -A 'WhatsApp/2.26' "$BASE/argenisg?og=v6&ts=$(date +%s)")"
printf '%s' "$html" | grep -Fq 'https://intaprd.com/assets/adonisg/og/adonisg-og-v6.png' || fail 'Crawler no recibe OG V6'
printf '%s' "$html" | grep -Fq 'summary_large_image' || fail 'Falta summary_large_image'

echo '============================================================'
echo '✓ SOCIAL CARD /argenisg V6 PUBLICADA'
echo "✓ FORMATO ORIGINAL PRESERVADO: ${OG_W}x${OG_H}"
echo '✓ SIN CROP · SIN RELLENO · SIN TEXTO AÑADIDO'
echo '============================================================'
