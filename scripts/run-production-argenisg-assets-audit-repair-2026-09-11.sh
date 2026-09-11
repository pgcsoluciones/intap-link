#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
ASSET_ROOT="$ROOT/web/public/assets/adonisg"
VENV="$ROOT/.venv-adonisg-assets"
BUCKET="intap-r2"
R2_PREFIX="profile-assets/argenisg/v1"
PROFILE_ID="profile-managed-argenisg"
WEB_PROJECT="intap-link"
TMP_SQL="/tmp/argenisg-assets-repair-$$.sql"
REFS="/tmp/argenisg-asset-refs-$$.txt"
REV="20260911-r2-v2"

fail(){ echo "✗ ERROR: $*" >&2; exit 1; }
run(){ echo "▶ $*"; "$@"; }
cleanup(){
  rm -f "$TMP_SQL" "$REFS" 2>/dev/null || true
  rm -rf "$ROOT/assets-source"
  for d in brand hero portraits portfolio media testimonials certifications videos og; do rm -rf "$ASSET_ROOT/$d"; done
}
trap cleanup EXIT

cd "$ROOT"

echo '============================================================'
echo 'KAWVO LINK · /argenisg · AUDITORÍA + REPARACIÓN DE ASSETS'
echo '============================================================'
echo '- Regenera desde ZIPs fuente'
echo '- Sincroniza binarios a R2'
echo '- Sincroniza inventario a D1'
echo '- Fuerza URLs versionadas en el template para romper 404 cacheados'
echo '- Audita GET real de todas las rutas usadas por el perfil'
echo '============================================================'

run git checkout main
run git pull --ff-only github main

# Limpiar únicamente residuos generados conocidos antes de validar el árbol.
rm -rf "$ROOT/assets-source"
for d in brand hero portraits portfolio media testimonials certifications videos og; do rm -rf "$ASSET_ROOT/$d"; done
[ -z "$(git status --porcelain)" ] || fail 'Hay cambios locales ajenos al proceso; no se tocará producción.'

if [ ! -x "$VENV/bin/python" ]; then run python3 -m venv "$VENV"; fi
run "$VENV/bin/python" -m pip install --quiet --upgrade pip Pillow
if [ -f scripts/ensure-adonisg-black-logo.py ]; then run "$VENV/bin/python" scripts/ensure-adonisg-black-logo.py; fi
run "$VENV/bin/python" scripts/prepare-adonisg-assets.py
if [ -f scripts/prepare-argenisg-footer-banner.py ]; then run python3 scripts/prepare-argenisg-footer-banner.py; fi

COUNT="$(find "$ASSET_ROOT" -type f ! -name README.md ! -name asset-manifest.json | wc -l | tr -d ' ')"
[ "$COUNT" -ge 70 ] || fail "Solo se generaron $COUNT recursos; esperaba al menos 70."
echo "✓ Recursos regenerados: $COUNT"

# Sincronizar todos los generados a R2 y reconstruir inventario D1.
: > "$TMP_SQL"
echo "DELETE FROM profile_assets WHERE profile_id='$PROFILE_ID' AND asset_key NOT LIKE 'og/adonisg-og-v3.jpg' AND asset_key NOT LIKE 'brand/logo-black-transparent-v2.png';" >> "$TMP_SQL"
idx=0
while IFS= read -r -d '' file; do
  idx=$((idx+1))
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
  kind='file'; [[ "$ctype" == image/* ]] && kind='image'; [[ "$ctype" == video/* ]] && kind='video'
  echo "  R2 ← $rel"
  (cd api && npx wrangler r2 object put "$BUCKET/$key" --file "$file" --content-type "$ctype" >/dev/null)
  esc_rel="${rel//\'/\'\'}"; esc_key="${key//\'/\'\'}"
  printf "INSERT INTO profile_assets (profile_id,asset_key,r2_key,kind,content_type,sort_order,is_active,metadata_json,updated_at) VALUES ('%s','%s','%s','%s','%s',%d,1,'{}',datetime('now')) ON CONFLICT(profile_id,asset_key) DO UPDATE SET r2_key=excluded.r2_key,kind=excluded.kind,content_type=excluded.content_type,sort_order=excluded.sort_order,is_active=1,updated_at=datetime('now');\n" "$PROFILE_ID" "$esc_rel" "$esc_key" "$kind" "$ctype" "$idx" >> "$TMP_SQL"
done < <(find "$ASSET_ROOT" -type f ! -name README.md ! -name asset-manifest.json -print0 | sort -z)

(cd api && npx wrangler d1 execute intap_db --remote --config wrangler.toml --file "$TMP_SQL")
echo "✓ R2 + D1 resincronizados: $COUNT recursos"

# Versionar todas las URLs del template/CSS para que Safari no reutilice 404/imágenes rotas previas.
run python3 - "$REV" <<'PY'
from pathlib import Path
import re, sys
rev=sys.argv[1]
files=[
    Path('web/src/components/profile-templates/IntapProfileAdonisgV1.tsx'),
    Path('web/src/components/profile-templates/IntapProfileAdonisgV1.css'),
    Path('web/src/components/profile-templates/IntapProfileAdonisgV1.mobile.css'),
    Path('web/src/components/profile-templates/IntapProfileAdonisgV1.refinements.css'),
    Path('web/src/components/profile-templates/IntapProfileAdonisgV1.argenisg-ready.css'),
]
pat=re.compile(r'(/assets/adonisg/[A-Za-z0-9_./-]+\.(?:png|jpe?g|webp|gif|mp4|mov|m4v))(?:\?v=[A-Za-z0-9_.-]+)?')
for p in files:
    if not p.exists():
        continue
    text=p.read_text(encoding='utf-8')
    # OG metadata URL and versioned brand-strip v2 remain independently versioned; query is harmless there too.
    new=pat.sub(lambda m: f"{m.group(1)}?v={rev}", text)
    if new != text:
        p.write_text(new,encoding='utf-8')
        print(f'✓ cache-bust: {p}')
PY

run git diff --check
run npm run build -w web
run git add web/src/components/profile-templates/IntapProfileAdonisgV1.tsx web/src/components/profile-templates/IntapProfileAdonisgV1.css web/src/components/profile-templates/IntapProfileAdonisgV1.mobile.css web/src/components/profile-templates/IntapProfileAdonisgV1.refinements.css web/src/components/profile-templates/IntapProfileAdonisgV1.argenisg-ready.css
if ! git diff --cached --quiet; then
  run git commit -m 'fix: refresh argenisg persistent asset urls after R2 migration'
  run git push github main
fi

# No assets locales en Pages: probar que todo dependa de R2+D1.
for d in brand hero portraits portfolio media testimonials certifications videos og; do rm -rf "$ASSET_ROOT/$d"; done
rm -rf "$ROOT/assets-source"
run npm run build -w web
run npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch main

# Extraer referencias de producción desde el código ya versionado.
python3 - "$REFS" <<'PY'
from pathlib import Path
import re, sys
out=Path(sys.argv[1])
files=[
    Path('web/src/components/profile-templates/IntapProfileAdonisgV1.tsx'),
    Path('web/src/components/profile-templates/IntapProfileAdonisgV1.css'),
    Path('web/src/components/profile-templates/IntapProfileAdonisgV1.mobile.css'),
    Path('web/src/components/profile-templates/IntapProfileAdonisgV1.refinements.css'),
    Path('web/src/components/profile-templates/IntapProfileAdonisgV1.argenisg-ready.css'),
]
refs=set()
for p in files:
    if not p.exists(): continue
    text=p.read_text(encoding='utf-8')
    refs.update(re.findall(r'/assets/adonisg/[A-Za-z0-9_./-]+\.(?:png|jpe?g|webp|gif|mp4|mov|m4v)(?:\?v=[A-Za-z0-9_.-]+)?',text,re.I))
out.write_text('\n'.join(sorted(refs))+'\n',encoding='utf-8')
print(f'✓ Rutas únicas a auditar: {len(refs)}')
PY

BASE='https://intaprd.com'
FAILS=0
while IFS= read -r path; do
  [ -n "$path" ] || continue
  sep='?'; [[ "$path" == *'?'* ]] && sep='&'
  url="$BASE$path${sep}audit=$(date +%s%N)"
  hdr="$(mktemp)"; body="$(mktemp)"
  code="$(curl -sS -L --max-time 35 -D "$hdr" -o "$body" -w '%{http_code}' -H 'Range: bytes=0-2047' "$url" 2>/dev/null || true)"
  ctype="$(tr -d '\r' < "$hdr" | awk -F': ' 'tolower($1)=="content-type"{print tolower($2)}' | tail -1)"
  source="$(tr -d '\r' < "$hdr" | awk -F': ' 'tolower($1)=="x-kawvo-asset-source"{print tolower($2)}' | tail -1)"
  size="$(wc -c < "$body" | tr -d ' ')"
  rm -f "$hdr" "$body"
  if { [ "$code" = 200 ] || [ "$code" = 206 ]; } && [ "$size" -gt 0 ] && { [[ "$ctype" == image/* ]] || [[ "$ctype" == video/* ]]; } && [ "$source" = 'r2+d1' ]; then
    echo "✓ $code · $ctype · $path"
  else
    echo "✗ $code · type=$ctype · source=$source · bytes=$size · $path"
    FAILS=$((FAILS+1))
  fi
done < "$REFS"

[ "$FAILS" -eq 0 ] || fail "$FAILS rutas gráficas siguen fallando en producción."

echo '============================================================'
echo '✓ AUDITORÍA /argenisg COMPLETA: 0 ASSETS ROTOS'
echo '✓ Todos los recursos usados por el template salen de R2 + D1'
echo '✓ URLs versionadas para evitar caché móvil de errores anteriores'
echo '============================================================'
