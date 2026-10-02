#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
REMOTE="github"
FEATURE_BRANCH="feature/bank-privacy-collapse-v1"
EXPECTED_MAIN_SHA="29946fda4d9b06d2b10dbd6b3ba711043f5391a9"
APPROVED_PREVIEW_SHA="a89ca27d2bba6711d73f3afe24e004cae8c7a084"
RUNNER_PATH="scripts/run-production-bank-privacy-collapse-v1-2026-10-02.sh"
WEB_PROJECT="intap-link"
PROD_DB="intap_db"
LOG_DIR="$ROOT/.production-bank-privacy-collapse-v1-logs"
WEB_LOG="$LOG_DIR/web-pages-production.log"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR"
mkdir -p "$LOG_DIR"

cat <<EOF
================================================================
KAWVO LINK · PRIVACIDAD DE CUENTAS · PRODUCCIÓN
================================================================
Promueve únicamente el Preview aprobado:
- sección bancaria contraída bajo “Cuentas”
- icono bancario monocromático
- botones sensibles “Cuenta” y “RNC / CÉD.”
- sin mensajes ni colores de copiado
- scroll NO cierra el módulo
- cierre por clic fuera o 8 s de inactividad
- compartir bancos como enlaces de texto
- WhatsApp conserva Graph Card/social card DEL USUARIO
- Free/Team/Trial + Patrocinado + Demo

Main esperado:    $EXPECTED_MAIN_SHA
Preview aprobado: $APPROVED_PREVIEW_SHA
================================================================
EOF

run git fetch "$REMOTE" main "$FEATURE_BRANCH"
CURRENT_MAIN="$(git rev-parse "$REMOTE/main")"
[ "$CURRENT_MAIN" = "$EXPECTED_MAIN_SHA" ] || fail "main cambió: esperado $EXPECTED_MAIN_SHA, actual $CURRENT_MAIN. Detener y auditar."

run git switch "$FEATURE_BRANCH"
run git pull --ff-only "$REMOTE" "$FEATURE_BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Árbol local no limpio"; }

FEATURE_SHA="$(git rev-parse HEAD)"
echo "Feature release: $FEATURE_SHA"

git merge-base --is-ancestor "$APPROVED_PREVIEW_SHA" HEAD || fail "El Preview aprobado ya no es ancestro"
POST_APPROVAL="$(git diff --name-only "$APPROVED_PREVIEW_SHA"..HEAD | grep -Ev "^(scripts/test-bank-privacy-interaction-contract\.mjs|${RUNNER_PATH})$" || true)"
[ -z "$POST_APPROVAL" ] || { echo "$POST_APPROVAL"; fail "Hay cambios de producto posteriores al Preview aprobado"; }

git merge-base --is-ancestor "$REMOTE/main" HEAD || fail "main y feature divergieron"
[ "$(git rev-list --count HEAD.."$REMOTE/main")" = "0" ] || fail "La feature está detrás de main"

cat > "$LOG_DIR/expected-files.txt" <<'EOF_FILES'
scripts/run-production-bank-privacy-collapse-v1-2026-10-02.sh
EOF_FILES

git diff --name-only "$REMOTE/main"...HEAD | sort > "$LOG_DIR/actual-files.txt"
sort "$LOG_DIR/expected-files.txt" > "$LOG_DIR/expected-files.sorted.txt"
diff -u "$LOG_DIR/expected-files.sorted.txt" "$LOG_DIR/actual-files.txt" || fail "El alcance no coincide exactamente con el Preview aprobado"

run git diff --check "$REMOTE/main"...HEAD

echo; echo "▶ Verificar contrato de privacidad + social card"
run node scripts/test-bank-privacy-interaction-contract.mjs
grep -Fq '?share=bancos&card=3#bancos' web/src/components/free-profile/PublicBankAccounts.tsx || fail "Free no conserva URL bancaria canónica"
grep -Fq '?share=bancos&card=3#bancos' web/src/components/sponsored/SponsoredBankAccounts.tsx || fail "Patrocinado no conserva URL bancaria canónica"
grep -Fq 'share=bancos: social card bancaria' functions/_middleware.ts || fail "Falta Graph Card bancaria server-side"
grep -Fq 'profileShareImage(profile)' functions/_middleware.ts || fail "Graph Card bancaria no usa imagen social del perfil"
grep -Fq 'normalizeSocialImage(profile.hero_url)' functions/_middleware.ts || fail "Social card patrocinada no usa hero del perfil"

echo; echo "▶ Verificar configuración Web Producción"
grep -Fq 'VITE_API_URL=https://api.intaprd.com' web/.env.production || fail "Web API incorrecta"
grep -Fq 'VITE_APP_URL=https://app.intaprd.com' web/.env.production || fail "Web App incorrecta"

run npm ci
run npm run build -w web
run bash -lc 'cd api && npx tsc --noEmit'

echo; echo "▶ Producción ya fue desplegada en la corrida anterior"
echo "✓ Se omite redeploy redundante; se valida directamente el estado vivo."
WEB_ORIGIN="ya desplegado"

echo; echo "▶ Smoke Producción base"
for url in "https://intaprd.com/" "https://intaprd.com/demo"; do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

extract_meta(){
  python3 - "$1" "$2" <<'PY'
import re,sys,html as h
text=open(sys.argv[1],encoding='utf-8',errors='ignore').read()
prop=sys.argv[2]
patterns=[
 rf'<meta[^>]+property=["\x27]{re.escape(prop)}["\x27][^>]+content=["\x27]([^"\x27]+)',
 rf'<meta[^>]+content=["\x27]([^"\x27]+)["\x27][^>]+property=["\x27]{re.escape(prop)}["\x27]',
]
for p in patterns:
    m=re.search(p,text,re.I)
    if m:
        print(h.unescape(m.group(1).strip())); raise SystemExit
print('')
PY
}

echo; echo "▶ Smoke Graph Card bancaria Free/Team · jlprince"
FREE_BANK_SLUG="jlprince"

BANK_API_JSON="$LOG_DIR/jlprince-bank-api.json"
curl -sS "https://api.intaprd.com/api/v1/public/profiles/$FREE_BANK_SLUG/bank-accounts" -o "$BANK_API_JSON"
python3 - "$BANK_API_JSON" <<'PY'
import json,sys
data=json.load(open(sys.argv[1],encoding='utf-8'))
if data.get('ok') is not True:
    raise SystemExit('API bancaria jlprince no respondió ok=true')
payload=data.get('data') or {}
if payload.get('enabled') is not True:
    raise SystemExit('API bancaria jlprince no está habilitada')
items=payload.get('items') or []
if not items:
    raise SystemExit('API bancaria jlprince no devolvió cuentas activas')
print(f"✓ jlprince expone {len(items)} cuenta(s) bancaria(s) activas")
PY

PROFILE_HTML="$LOG_DIR/free-profile.html"
BANK_HTML="$LOG_DIR/free-bank-share.html"
curl -sS "https://intaprd.com/$FREE_BANK_SLUG?share=perfil&card=3" -o "$PROFILE_HTML"
curl -sS "https://intaprd.com/$FREE_BANK_SLUG?share=bancos&card=3" -o "$BANK_HTML"

PROFILE_IMAGE="$(extract_meta "$PROFILE_HTML" "og:image")"
BANK_IMAGE="$(extract_meta "$BANK_HTML" "og:image")"
BANK_TITLE="$(extract_meta "$BANK_HTML" "og:title")"

[ -n "$PROFILE_IMAGE" ] || fail "Perfil jlprince no expone og:image"
[ -n "$BANK_IMAGE" ] || fail "Compartir bancos jlprince no expone og:image"
[ "$PROFILE_IMAGE" = "$BANK_IMAGE" ] || {
  echo "Perfil image: $PROFILE_IMAGE"
  echo "Banco image:  $BANK_IMAGE"
  fail "La Graph Card bancaria de jlprince no usa la misma imagen social del usuario"
}
printf '%s' "$BANK_TITLE" | grep -qi 'bancari' || fail "La Graph Card bancaria de jlprince no identifica el contenido bancario"
echo "✓ jlprince: bank share usa la social card del usuario"

echo; echo "▶ Smoke social card bancaria Patrocinado"
SPONSORED_BANK_USER="$(
  cd api
  npx wrangler d1 execute "$PROD_DB" --remote --config wrangler.toml --json --command "
    SELECT sp.username
      FROM sponsored_profiles sp
      LEFT JOIN sponsored_bank_settings s ON s.sponsored_profile_id=sp.id
      JOIN sponsored_bank_accounts b ON b.sponsored_profile_id=sp.id AND b.is_active=1
     WHERE sp.status='published'
       AND COALESCE(s.is_enabled,1)=1
       AND NULLIF(TRIM(sp.username),'') IS NOT NULL
     GROUP BY sp.id,sp.username,sp.updated_at
     ORDER BY sp.updated_at DESC
     LIMIT 1;
  " 2>/dev/null |
  python3 -c "import json,sys;d=json.load(sys.stdin);r=((d[0].get('results') if isinstance(d,list) and d else []) or []);print((r[0].get('username') if r else '') or '')"
)"

if [ -n "$SPONSORED_BANK_USER" ]; then
  SP_PROFILE_HTML="$LOG_DIR/sponsored-profile.html"
  SP_BANK_HTML="$LOG_DIR/sponsored-bank-share.html"
  curl -sS "https://intaprd.com/p/$SPONSORED_BANK_USER" -o "$SP_PROFILE_HTML"
  curl -sS "https://intaprd.com/p/$SPONSORED_BANK_USER?share=bancos&card=3" -o "$SP_BANK_HTML"
  SP_PROFILE_IMAGE="$(extract_meta "$SP_PROFILE_HTML" "og:image")"
  SP_BANK_IMAGE="$(extract_meta "$SP_BANK_HTML" "og:image")"
  [ -n "$SP_PROFILE_IMAGE" ] || fail "Perfil patrocinado no expone og:image"
  [ -n "$SP_BANK_IMAGE" ] || fail "Compartir bancos patrocinado no expone og:image"
  [ "$SP_PROFILE_IMAGE" = "$SP_BANK_IMAGE" ] || fail "Patrocinado: compartir bancos no conserva la social card del usuario"
  echo "✓ Patrocinado bank share usa social card del usuario: $SPONSORED_BANK_USER"
else
  echo "ℹ No hay perfil patrocinado publicado con bancos para smoke vivo; contrato estático sí quedó validado."
fi

echo; echo "▶ Promover release validado a main"
PREVIOUS_MAIN="$CURRENT_MAIN"
run git switch -C main "$REMOTE/main"
run git merge --ff-only "$REMOTE/$FEATURE_BRANCH"
run git push "$REMOTE" main
PROD_SHA="$(git rev-parse HEAD)"

run git fetch "$REMOTE" main
[ "$(git rev-parse "$REMOTE/main")" = "$PROD_SHA" ] || fail "main remoto no coincide con el SHA desplegado"

TAG="prod-bank-privacy-collapse-v1-2026-10-02-$(date +%H%M%S)"
run git tag -a "$TAG" -m "Kawvo Link bank privacy interaction production"
run git push "$REMOTE" "$TAG"

rm -rf "$LOG_DIR"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Runner dejó cambios locales"; }

cat <<EOF
================================================================
✓ PRIVACIDAD DE CUENTAS · PRODUCCIÓN VALIDADA Y CERRADA
================================================================
Production SHA: $PROD_SHA
Release tag:    $TAG
Previous main:  $PREVIOUS_MAIN
Web Pages:      ${WEB_ORIGIN:-ya desplegado}

Incluye:
✓ Cuentas contraído por defecto
✓ icono bancario monocromático
✓ Cuenta / RNC / CÉD. discretos
✓ sin feedback visual de copiado
✓ scroll libre sin cierre
✓ cierre por clic fuera o 8 s
✓ compartir por WhatsApp / copiar enlace como texto
✓ Graph Card bancaria usa social card del usuario
✓ Free/Team/Trial + Patrocinado + Demo
================================================================
EOF
