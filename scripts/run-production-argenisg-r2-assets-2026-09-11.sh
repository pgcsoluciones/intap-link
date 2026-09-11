#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
ASSET_ROOT="$ROOT/web/public/assets/adonisg"
VENV="$ROOT/.venv-adonisg-assets"
TMP_SQL="/tmp/argenisg-profile-assets-$$.sql"
BUCKET="intap-r2"
R2_PREFIX="profile-assets/argenisg/v1"
PROFILE_ID="profile-managed-argenisg"
WEB_PROJECT="intap-link"

fail(){ echo "✗ ERROR: $*" >&2; exit 1; }
run(){ echo "▶ $*"; "$@"; }
cleanup(){ rm -f "$TMP_SQL" 2>/dev/null || true; }
trap cleanup EXIT

cd "$ROOT" || exit 1

echo '============================================================'
echo 'KAWVO LINK · /argenisg · ASSETS PERSISTENTES R2 + D1'
echo '============================================================'
echo '- Binarios gráficos: Cloudflare R2'
echo '- Inventario y relación lógica: D1 profile_assets'
echo '- /assets/adonisg/*: proxy estable, no depende del bundle Pages'
echo '- Elimina dependencia de recursos temporales del deploy'
echo '============================================================'

run git checkout main
run git pull --ff-only github main
[ -z "$(git status --porcelain)" ] || fail 'El árbol de trabajo no está limpio. No se tocará producción.'

[ -f api/migrations/0046_argenisg_r2_assets.sql ] || fail 'Falta migración 0046_argenisg_r2_assets.sql'
[ -f functions/assets/adonisg/'[[path]].ts' ] || fail 'Falta proxy Pages /assets/adonisg/*'
[ -f scripts/prepare-adonisg-assets.py ] || fail 'Falta preparador de assets de Argenis'
[ -f scripts/patch-profile-assets-api-v1.py ] || fail 'Falta patch API de assets por perfil'

if [ ! -x "$VENV/bin/python" ]; then
  run python3 -m venv "$VENV"
fi
run "$VENV/bin/python" -m pip install --quiet --upgrade pip Pillow

if [ -f scripts/ensure-adonisg-black-logo.py ]; then
  run "$VENV/bin/python" scripts/ensure-adonisg-black-logo.py
fi
run "$VENV/bin/python" scripts/prepare-adonisg-assets.py
if [ -f scripts/prepare-argenisg-footer-banner.py ]; then
  run python3 scripts/prepare-argenisg-footer-banner.py
fi

COUNT="$(find "$ASSET_ROOT" -type f ! -name README.md ! -name asset-manifest.json | wc -l | tr -d ' ')"
[ "$COUNT" -ge 30 ] || fail "Se generaron solo $COUNT recursos; esperaba al menos 30."
echo "✓ Recursos preparados: $COUNT"

# 1) Crear/actualizar esquema D1 y configuración persistente del perfil.
echo
echo '▶ Aplicar registro persistente D1'
(
  cd api
  npx wrangler d1 execute intap_db --remote --config wrangler.toml --file migrations/0046_argenisg_r2_assets.sql
)

# 2) Subir todos los binarios a R2 con keys estables.
# En Wrangler 3, `r2 object put` ya opera contra R2 remoto por defecto y no acepta --remote.
echo
echo '▶ Subir recursos a R2'
while IFS= read -r -d '' file; do
  rel="${file#$ASSET_ROOT/}"
  key="$R2_PREFIX/$rel"
  case "${file##*.}" in
    png) ctype='image/png' ;;
    jpg|jpeg) ctype='image/jpeg' ;;
    webp) ctype='image/webp' ;;
    gif) ctype='image/gif' ;;
    mp4) ctype='video/mp4' ;;
    mov) ctype='video/quicktime' ;;
    m4v) ctype='video/x-m4v' ;;
    *) ctype='application/octet-stream' ;;
  esac
  echo "  R2 ← $rel"
  (
    cd api
    npx wrangler r2 object put "$BUCKET/$key" --file "$file" --content-type "$ctype" >/dev/null
  )
done < <(find "$ASSET_ROOT" -type f ! -name README.md ! -name asset-manifest.json -print0 | sort -z)

echo "✓ R2: $COUNT recursos persistidos bajo $R2_PREFIX"

# 3) Registrar cada asset en D1. D1 guarda la relación lógica; no guardamos binarios BLOB.
# Wrangler/D1 remoto no admite BEGIN/COMMIT SQL en este flujo de importación, por eso
# generamos un archivo idempotente sin transacción explícita.
python3 - "$ASSET_ROOT" "$TMP_SQL" "$PROFILE_ID" "$R2_PREFIX" <<'PY'
from pathlib import Path
import mimetypes, sys
root = Path(sys.argv[1])
out = Path(sys.argv[2])
profile_id = sys.argv[3]
prefix = sys.argv[4]

def q(v: str) -> str:
    return "'" + v.replace("'", "''") + "'"

files = sorted(p for p in root.rglob('*') if p.is_file() and p.name not in {'README.md','asset-manifest.json'})
lines = [f"DELETE FROM profile_assets WHERE profile_id={q(profile_id)};"]
for idx, p in enumerate(files, 1):
    rel = p.relative_to(root).as_posix()
    ctype = mimetypes.guess_type(p.name)[0] or 'application/octet-stream'
    kind = 'video' if ctype.startswith('video/') else 'image' if ctype.startswith('image/') else 'file'
    r2 = f'{prefix}/{rel}'
    lines.append(
        'INSERT INTO profile_assets (profile_id,asset_key,r2_key,kind,content_type,sort_order,is_active,metadata_json,updated_at) VALUES ('
        f'{q(profile_id)},{q(rel)},{q(r2)},{q(kind)},{q(ctype)},{idx},1,\'{{}}\',datetime(\'now\')) '
        'ON CONFLICT(profile_id,asset_key) DO UPDATE SET r2_key=excluded.r2_key,kind=excluded.kind,content_type=excluded.content_type,sort_order=excluded.sort_order,is_active=1,updated_at=datetime(\'now\');'
    )
out.write_text('\n'.join(lines) + '\n', encoding='utf-8')
print(f'✓ SQL de inventario generado: {len(files)} assets')
PY
(
  cd api
  npx wrangler d1 execute intap_db --remote --config wrangler.toml --file "$TMP_SQL"
)

# 4) API pública: slug + asset_key -> D1 -> R2.
run python3 scripts/patch-profile-assets-api-v1.py
run git diff --check

echo
echo '▶ Verificar API TypeScript'
run npx tsc -p api/tsconfig.json --noEmit

# 5) Quitar los binarios locales generados ANTES del build. El perfil debe sobrevivir sin ellos.
for d in brand hero portraits portfolio media testimonials certifications videos og; do
  rm -rf "$ASSET_ROOT/$d"
done
git checkout -- web/public/assets/adonisg/asset-manifest.json 2>/dev/null || true

echo "✓ Assets locales temporales retirados antes del build; R2 queda como almacenamiento real."

run npm run build -w web

# 6) Persistir el cambio de código del endpoint API, si el patch lo introdujo.
if ! git diff --quiet; then
  run git add api/src/index.ts web/src/components/profile-templates/IntapProfileAdonisgV1.tsx
  run git commit -m 'feat: serve argenisg graphics from D1 registry and R2'
  run git push github main
fi

[ -z "$(git status --porcelain)" ] || fail 'El runner dejó cambios locales inesperados.'

# 7) Deploy API (nuevo resolver D1 -> R2) y Pages (proxy estable /assets/adonisg/*).
echo
echo '▶ Deploy API producción'
(
  cd api
  npx wrangler deploy --config wrangler.toml
)

echo
echo '▶ Deploy Web/Pages producción'
run npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch main

# 8) Smoke real sobre intaprd.com: los recursos deben llegar desde R2+D1.
wait200(){
  local url="$1" label="$2" code='000'
  for _ in $(seq 1 12); do
    code="$(curl -sS -L --max-time 30 -o /dev/null -w '%{http_code}' "$url" 2>/dev/null || true)"
    [ "$code" = '200' ] && { echo "✓ $label -> HTTP 200"; return 0; }
    sleep 4
  done
  fail "$label respondió HTTP $code"
}

BASE='https://intaprd.com'
wait200 "$BASE/argenisg" 'Perfil /argenisg'
wait200 "$BASE/assets/adonisg/hero/argenis-hero.webp" 'Hero'
wait200 "$BASE/assets/adonisg/brand/logo-white.png" 'Logo blanco'
wait200 "$BASE/assets/adonisg/brand/logo-black-transparent.png" 'Logo negro'
wait200 "$BASE/assets/adonisg/portfolio/beauty-fragrance/beauty-cover.webp" 'Portafolio'
wait200 "$BASE/assets/adonisg/media/appearance-01.webp" 'Aparición'
wait200 "$BASE/assets/adonisg/testimonials/brachy.webp" 'Testimonio'
wait200 "$BASE/assets/adonisg/certifications/cert-01.webp" 'Certificación'
wait200 "$BASE/assets/adonisg/og/adonisg-og.jpg" 'OG social'

SOURCE_HEADER="$(curl -sSI "$BASE/assets/adonisg/hero/argenis-hero.webp" | tr -d '\r' | awk -F': ' 'tolower($1)=="x-kawvo-asset-source"{print $2}' | tail -1)"
[ "$SOURCE_HEADER" = 'r2+d1' ] || fail "Hero no reporta R2+D1; header=$SOURCE_HEADER"

echo
echo '============================================================'
echo '✓ /argenisg RESTAURADO Y MIGRADO A ALMACENAMIENTO PERSISTENTE'
echo '============================================================'
echo "Assets: $COUNT"
echo 'Binarios: R2 intap-r2'
echo 'Inventario: D1 profile_assets'
echo 'Ruta pública estable: /assets/adonisg/*'
echo 'Ya no depende de archivos generados dentro de web/public.'
echo '============================================================'
