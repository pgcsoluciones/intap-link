#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
LAST_PROD_SHA="f45fbac212f3bb361349c88a63740da1dcce3ff3"
PRODUCT_SHA="38d0683c35f95fd3fca7fc3111574d200551734f"
LOG_DIR="/tmp/kawvo-team-unified-auth-resume-font-2026-09-09"
WEB_PROJECT="intap-link"
APP_PROJECT="intap-web2"
PUBLIC_CODE="4BXYMTNSK5"
TEAM_CODE="TEAM-2X7G-SHPJ"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" && mkdir -p "$LOG_DIR"

cat <<EOF
============================================================
KAWVO TEAM · LOTE UNIFICADO PRODUCCION
AUTH RESUME + MEMBER TYPOGRAPHY
============================================================
Último release funcional: $LAST_PROD_SHA
Producto objetivo:         $PRODUCT_SHA
Incluye:
  1) Retomar vinculación Team después del login
  2) Handoff HttpOnly 15 min, revalidado contra Master + D1
  3) Jerarquía tipográfica Team: empresa secundaria, miembro principal
Sin migraciones D1.
============================================================
EOF

run git fetch github main
CURRENT_MAIN="$(git rev-parse github/main)"
git merge-base --is-ancestor "$PRODUCT_SHA" "$CURRENT_MAIN" || fail "github/main no contiene el producto objetivo $PRODUCT_SHA"

# Todo lo posterior al producto debe ser únicamente este runner operativo.
POST_FILES="$(git diff --name-only "$PRODUCT_SHA...$CURRENT_MAIN")"
if [ -n "$POST_FILES" ]; then
  BAD_POST="$(printf '%s\n' "$POST_FILES" | grep -v '^scripts/run-production-team-unified-auth-resume-font-2026-09-09.sh$' || true)"
  [ -z "$BAD_POST" ] || { printf '%s\n' "$BAD_POST"; fail "Hay cambios posteriores al producto que requieren nueva auditoría"; }
fi

echo "✓ main contiene el producto objetivo; cambios posteriores permitidos: solo runner operativo"

run git checkout --detach "$PRODUCT_SHA"
run git reset --hard "$PRODUCT_SHA"
run git diff --check "$LAST_PROD_SHA...$PRODUCT_SHA"

# Gates exactos del lote.
grep -Fq "const TEAM_RESUME_COOKIE = 'kawvo_team_resume'" api/src/team-browser-authority.ts || fail "Falta handoff HttpOnly Team"
grep -Fq "app.get('/api/v1/me/team/browser-resume'" api/src/team-browser-authority.ts || fail "Falta endpoint de reanudación autenticada"
grep -Fq "apiGet('/me/team/browser-resume')" app/src/components/admin/AdminGuard.tsx || fail "AdminGuard no recupera el handoff Team"
grep -Fq "company.style.fontSize = 'clamp(1.05rem, 3.2vw, 1.3rem)'" web/src/team-public-access-policy.ts || fail "Falta tamaño secundario de empresa"
grep -Fq "memberName.style.fontSize = 'clamp(1.75rem, 7vw, 2.15rem)'" web/src/team-public-access-policy.ts || fail "Falta tamaño principal del miembro"
grep -Fq "memberName.style.fontWeight = '800'" web/src/team-public-access-policy.ts || fail "Falta peso principal del miembro"

echo "✓ Auth resume persistente confirmado"
echo "✓ Autoridad Master revalidada en backend confirmada"
echo "✓ Jerarquía tipográfica Team confirmada"

run npm ci
run npm run build -w web
run npm run build -w app
run npx tsc --noEmit -p api/tsconfig.json
run npx esbuild api/src/preview-free-entry.ts --bundle --platform=node --format=esm --target=node20 --external:cloudflare:* --outfile=/tmp/kawvo-team-unified-prod.mjs
run bash -lc 'cd api && npx wrangler deploy --config wrangler.toml --dry-run'

# Caso real debe seguir intacto antes del deploy.
echo
echo "▶ D1 Producción · caso real intacto antes del lote"
CASE_BEFORE="$(cd api && npx wrangler d1 execute intap_db --remote --config wrangler.toml --command="SELECT a.public_code,a.status artifact_status,a.owner_user_id,a.profile_id,tc.code team_code,tc.status team_code_status,tc.used_at,ac.status activation_status FROM intap_artifacts a JOIN team_link_codes tc ON tc.code='$TEAM_CODE' LEFT JOIN artifact_activation_codes ac ON ac.artifact_id=a.id AND ac.status='active' WHERE a.public_code='$PUBLIC_CODE' LIMIT 1;")"
printf '%s\n' "$CASE_BEFORE"
printf '%s' "$CASE_BEFORE" | grep -q 'available' || fail "El artifact de prueba ya no está available"
printf '%s' "$CASE_BEFORE" | grep -q "$TEAM_CODE" || fail "No aparece el Team code esperado"
printf '%s' "$CASE_BEFORE" | grep -q 'active' || fail "Código Team/activation ya no está activo"

# Deploy exacto del mismo producto a las tres superficies.
echo
echo "▶ Deploy Worker Producción"
(cd api && npm run deploy:production) 2>&1 | tee "$LOG_DIR/worker.log"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker"

echo
echo "▶ Deploy App Producción"
npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch main 2>&1 | tee "$LOG_DIR/app.log"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App"

echo
echo "▶ Deploy Web Producción"
npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch main 2>&1 | tee "$LOG_DIR/web.log"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Web"

sleep 5
for url in \
  "https://intaprd.com/" \
  "https://app.intaprd.com/admin/login" \
  "https://app.intaprd.com/admin/free/team/assign" \
  "https://api.intaprd.com/api/health"
do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

# Validar handoff Team real sin consumir código.
echo
echo "▶ Preflight navegador · debe crear cookie HttpOnly de reanudación"
curl -sS -D "$LOG_DIR/browser-authority.headers" -c "$LOG_DIR/team.cookies" \
  -o "$LOG_DIR/browser-authority.json" \
  -X POST 'https://app.intaprd.com/api/v1/public/team/browser-authority' \
  -H 'content-type: application/json' \
  --data "{\"public_code\":\"$PUBLIC_CODE\",\"team_code\":\"$TEAM_CODE\"}"
cat "$LOG_DIR/browser-authority.json"
grep -qi 'set-cookie: kawvo_team_resume=' "$LOG_DIR/browser-authority.headers" || fail "El preflight no creó kawvo_team_resume"
grep -q '"session_state":"signed_out"' "$LOG_DIR/browser-authority.json" || fail "Preflight no reportó signed_out para navegador limpio"

echo "✓ Cookie kawvo_team_resume emitida"

RESUME_HTTP="$(curl -sS -b "$LOG_DIR/team.cookies" -o "$LOG_DIR/browser-resume.json" -w '%{http_code}' 'https://app.intaprd.com/api/v1/me/team/browser-resume')"
echo "browser-resume sin sesión Master -> HTTP $RESUME_HTTP"
cat "$LOG_DIR/browser-resume.json"
[ "$RESUME_HTTP" = "401" ] || fail "browser-resume sin sesión debe exigir autenticación"

# El preflight/handoff no puede consumir el producto.
echo
echo "▶ D1 Producción · caso real intacto después del handoff"
CASE_AFTER="$(cd api && npx wrangler d1 execute intap_db --remote --config wrangler.toml --command="SELECT a.public_code,a.status artifact_status,a.owner_user_id,a.profile_id,tc.code team_code,tc.status team_code_status,tc.used_at,ac.status activation_status FROM intap_artifacts a JOIN team_link_codes tc ON tc.code='$TEAM_CODE' LEFT JOIN artifact_activation_codes ac ON ac.artifact_id=a.id AND ac.status='active' WHERE a.public_code='$PUBLIC_CODE' LIMIT 1;")"
printf '%s\n' "$CASE_AFTER"
printf '%s' "$CASE_AFTER" | grep -q 'available' || fail "Handoff cambió el artifact"
printf '%s' "$CASE_AFTER" | grep -q 'active' || fail "Handoff consumió código Team/activation"

TAG="prod-team-unified-auth-resume-font-2026-09-09-$(date +%H%M%S)"
run git tag -a "$TAG" "$PRODUCT_SHA" -m "Team auth resume + member typography unified release"
run git push github "$TAG"

cat <<EOF

============================================================
✓ LOTE UNIFICADO TEAM · PRODUCCION DESPLEGADA
============================================================
SHA:  $PRODUCT_SHA
Tag:  $TAG
API:  auth resume/handoff Master activo
App:  reanudación automática Team activa
Web:  nombre del miembro con jerarquía principal
D1:   sin migraciones; caso $PUBLIC_CODE permanece sin consumir
Logs: $LOG_DIR
============================================================
EOF
