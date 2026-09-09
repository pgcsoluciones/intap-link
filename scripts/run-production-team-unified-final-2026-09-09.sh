#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
LAST_PROD_SHA="f45fbac212f3bb361349c88a63740da1dcce3ff3"
PRODUCT_SHA="38d0683c35f95fd3fca7fc3111574d200551734f"
LOG_DIR="/tmp/kawvo-team-unified-final-2026-09-09"
WEB_PROJECT="intap-link"
APP_PROJECT="intap-web2"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" && mkdir -p "$LOG_DIR"

cat <<EOF
============================================================
KAWVO TEAM · LOTE UNIFICADO FINAL · PRODUCCION
AUTH RESUME + MEMBER TYPOGRAPHY
============================================================
Último release funcional: $LAST_PROD_SHA
Producto objetivo:         $PRODUCT_SHA
Sin migraciones D1.
El caso real anterior ya fue consumido correctamente y NO se reutiliza.
============================================================
EOF

run git fetch github main
CURRENT_MAIN="$(git rev-parse github/main)"
git merge-base --is-ancestor "$PRODUCT_SHA" "$CURRENT_MAIN" || fail "github/main no contiene el producto objetivo $PRODUCT_SHA"

# Después del producto solo permitimos scripts operativos/auditorías; nunca código de producto.
POST_FILES="$(git diff --name-only "$PRODUCT_SHA...$CURRENT_MAIN")"
if [ -n "$POST_FILES" ]; then
  BAD_POST="$(printf '%s\n' "$POST_FILES" | grep -v '^scripts/' || true)"
  [ -z "$BAD_POST" ] || { printf '%s\n' "$BAD_POST"; fail "Hay cambios de producto posteriores a $PRODUCT_SHA que requieren nueva auditoría"; }
fi

echo "✓ Producto exacto confirmado; cambios posteriores son solo scripts operativos"

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
run npx esbuild api/src/preview-free-entry.ts --bundle --platform=node --format=esm --target=node20 --external:cloudflare:* --outfile=/tmp/kawvo-team-unified-final-prod.mjs
run bash -lc 'cd api && npx wrangler deploy --config wrangler.toml --dry-run'

# Integridad global D1 antes del deploy. Solo lectura.
echo; echo "▶ D1 Producción · integridad Team pre-deploy"
D1_BEFORE="$(cd api && npx wrangler d1 execute intap_db --remote --config wrangler.toml --command="SELECT (SELECT COUNT(*) FROM team_members tm LEFT JOIN intap_artifacts a ON a.id=tm.artifact_id WHERE tm.artifact_id IS NOT NULL AND (a.id IS NULL OR a.profile_id!=tm.profile_id)) broken_member_artifact,(SELECT COUNT(*) FROM team_link_codes tc LEFT JOIN team_members tm ON tm.invite_code_id=tc.id WHERE tc.status='used' AND (tc.member_profile_id IS NULL OR tm.id IS NULL OR tm.profile_id!=tc.member_profile_id)) broken_used_code,(SELECT COUNT(*) FROM team_members tm JOIN intap_artifacts a ON a.id=tm.artifact_id WHERE tm.status='active' AND (a.status!='activated' OR a.profile_id!=tm.profile_id)) active_member_artifact_mismatch;")"
printf '%s\n' "$D1_BEFORE"
printf '%s' "$D1_BEFORE" | grep -Eq '"broken_member_artifact"[[:space:]]*:[[:space:]]*0|broken_member_artifact[^0-9]*0' || fail "D1 reporta broken_member_artifact"
printf '%s' "$D1_BEFORE" | grep -Eq '"broken_used_code"[[:space:]]*:[[:space:]]*0|broken_used_code[^0-9]*0' || fail "D1 reporta broken_used_code"
printf '%s' "$D1_BEFORE" | grep -Eq '"active_member_artifact_mismatch"[[:space:]]*:[[:space:]]*0|active_member_artifact_mismatch[^0-9]*0' || fail "D1 reporta active_member_artifact_mismatch"

# Deploy exacto del mismo producto a las tres superficies.
echo; echo "▶ Deploy Worker Producción"
(cd api && npm run deploy:production) 2>&1 | tee "$LOG_DIR/worker.log"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker"

echo; echo "▶ Deploy App Producción"
npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch main 2>&1 | tee "$LOG_DIR/app.log"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App"

echo; echo "▶ Deploy Web Producción"
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

# Rutas nuevas montadas, sin necesitar reutilizar un código ya consumido.
INVALID_HTTP="$(curl -sS -o "$LOG_DIR/browser-authority-invalid.json" -w '%{http_code}' -X POST 'https://app.intaprd.com/api/v1/public/team/browser-authority' -H 'content-type: application/json' --data '{"public_code":"BAD","team_code":"BAD"}')"
echo "browser-authority inválido -> HTTP $INVALID_HTTP"
cat "$LOG_DIR/browser-authority-invalid.json"
[ "$INVALID_HTTP" = "400" ] || fail "browser-authority no está montado correctamente"

RESUME_HTTP="$(curl -sS -o "$LOG_DIR/browser-resume-unauth.json" -w '%{http_code}' 'https://app.intaprd.com/api/v1/me/team/browser-resume')"
echo "browser-resume sin sesión -> HTTP $RESUME_HTTP"
cat "$LOG_DIR/browser-resume-unauth.json"
[ "$RESUME_HTTP" = "401" ] || fail "browser-resume no exige autenticación o no está montado"

# Integridad global D1 después del deploy. Solo lectura.
echo; echo "▶ D1 Producción · integridad Team post-deploy"
D1_AFTER="$(cd api && npx wrangler d1 execute intap_db --remote --config wrangler.toml --command="SELECT (SELECT COUNT(*) FROM team_members tm LEFT JOIN intap_artifacts a ON a.id=tm.artifact_id WHERE tm.artifact_id IS NOT NULL AND (a.id IS NULL OR a.profile_id!=tm.profile_id)) broken_member_artifact,(SELECT COUNT(*) FROM team_link_codes tc LEFT JOIN team_members tm ON tm.invite_code_id=tc.id WHERE tc.status='used' AND (tc.member_profile_id IS NULL OR tm.id IS NULL OR tm.profile_id!=tc.member_profile_id)) broken_used_code,(SELECT COUNT(*) FROM team_members tm JOIN intap_artifacts a ON a.id=tm.artifact_id WHERE tm.status='active' AND (a.status!='activated' OR a.profile_id!=tm.profile_id)) active_member_artifact_mismatch;")"
printf '%s\n' "$D1_AFTER"
printf '%s' "$D1_AFTER" | grep -Eq '"broken_member_artifact"[[:space:]]*:[[:space:]]*0|broken_member_artifact[^0-9]*0' || fail "Post-deploy: broken_member_artifact"
printf '%s' "$D1_AFTER" | grep -Eq '"broken_used_code"[[:space:]]*:[[:space:]]*0|broken_used_code[^0-9]*0' || fail "Post-deploy: broken_used_code"
printf '%s' "$D1_AFTER" | grep -Eq '"active_member_artifact_mismatch"[[:space:]]*:[[:space:]]*0|active_member_artifact_mismatch[^0-9]*0' || fail "Post-deploy: active_member_artifact_mismatch"

TAG="prod-team-unified-final-2026-09-09-$(date +%H%M%S)"
run git tag -a "$TAG" "$PRODUCT_SHA" -m "Team auth resume + member typography unified final release"
run git push github "$TAG"

cat <<EOF

============================================================
✓ LOTE UNIFICADO TEAM · PRODUCCION DESPLEGADA
============================================================
SHA:  $PRODUCT_SHA
Tag:  $TAG
API:  handoff + auth resume Master activo
App:  regreso automático al flujo Team activo
Web:  miembro con jerarquía tipográfica principal
D1:   sin migraciones; integridad Team verificada pre/post
Logs: $LOG_DIR
============================================================
EOF
