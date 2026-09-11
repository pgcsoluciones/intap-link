#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
cd "$ROOT"

fail(){ echo "✗ ERROR: $*" >&2; exit 1; }
run(){ echo; echo "▶ $*"; "$@"; }

printf '\n============================================================\n'
printf 'KAWVO LINK · /argenisg · SOCIAL CARD FIX · PRODUCCIÓN\n'
printf '============================================================\n'
printf '%s\n' '- Fija metadata server-side para crawlers sociales'
printf '%s\n' '- OG/Twitter: imagen dedicada 1200×630 de Argenis'
printf '%s\n' '- No modifica D1, API ni contenido visual del perfil'
printf '============================================================\n'

run git checkout main
run git pull --ff-only github main

[ -z "$(git status --porcelain)" ] || fail "El árbol de trabajo no está limpio. Guarda o descarta cambios locales antes de continuar."

run python3 scripts/fix-argenisg-social-card-v1.py
run git diff --check

echo
echo '▶ Validar cambios esperados'
grep -Fq "Argenis Grullón | Asesor de Imagen y Estilista de Moda" functions/profile-discovery.ts || fail 'Falta título social fijo'
grep -Fq "/assets/adonisg/og/adonisg-og.jpg" functions/profile-discovery.ts || fail 'Falta imagen OG en discovery'
grep -Fq "/assets/adonisg/og/adonisg-og.jpg" functions/_middleware.ts || fail 'Falta imagen OG en middleware'

echo '✓ Metadata social /argenisg preparada.'

run npm run build -w web

run git add functions/profile-discovery.ts functions/_middleware.ts
if git diff --cached --quiet; then
  echo '✓ No hay cambios nuevos que commitear; el fix ya estaba aplicado.'
else
  run git commit -m "fix: restore argenisg social preview metadata"
  run git push github main
fi

run npx wrangler pages deploy web/dist --project-name intap-link --branch main

printf '\n▶ Smoke social crawler en producción\n'
HTML="$(curl -fsSL -A 'Twitterbot/1.0' 'https://intaprd.com/argenisg?social_card_probe=20260911')" || fail 'No pude consultar /argenisg como crawler'
printf '%s' "$HTML" | grep -Fq 'Argenis Grullón | Asesor de Imagen y Estilista de Moda' || fail 'El HTML crawler no contiene el título esperado'
printf '%s' "$HTML" | grep -Fq 'https://intaprd.com/assets/adonisg/og/adonisg-og.jpg' || fail 'El HTML crawler no contiene la imagen OG esperada'
printf '%s' "$HTML" | grep -Fq 'summary_large_image' || fail 'Falta Twitter large card'
printf '%s' "$HTML" | grep -Fq 'rel="canonical" href="https://intaprd.com/argenisg"' || fail 'Canonical incorrecto'

printf '\n============================================================\n'
printf '✓ /argenisg · TARJETA SOCIAL CORREGIDA EN PRODUCCIÓN\n'
printf '============================================================\n'
printf 'Canonical: https://intaprd.com/argenisg\n'
printf 'OG image: https://intaprd.com/assets/adonisg/og/adonisg-og.jpg\n'
printf '============================================================\n'
