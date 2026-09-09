#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
FEATURE_BRANCH="feature/kawvo-onboarding-product-flow-v1"
EXPECTED_MAIN="f180d3055395072e62b70de364e75aae714789df"
PRODUCT_SHA="2d608bc4722b438638cb00a02adec5c7d39db8e4"
WEB_PROJECT="intap-link"
APP_PROJECT="intap-web2"
LOG_DIR="/tmp/kawvo-production-team-authority-release-2026-09-09-logs"
OLD_LOG_DIR="$ROOT/.production-team-authority-release-2026-09-09-logs"
OLD_PREVIEW_LOG_DIR="$ROOT/.preview-team-flow-deep-audit-2026-09-09-logs"
OLD_PROD_AUDIT_LOG_DIR="$ROOT/.prod-team-source-truth-readonly-2026-09-09"
WORKER_LOG="$LOG_DIR/worker.log"
WEB_LOG="$LOG_DIR/web.log"
APP_LOG="$LOG_DIR/app.log"
D1_LOG="$LOG_DIR/d1-readonly.log"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
# El runner no debe ensuciar el working tree. Limpiamos únicamente directorios
# de logs generados por nuestros runners/auditorías y escribimos el release log en /tmp.
rm -rf "$OLD_LOG_DIR" "$OLD_PREVIEW_LOG_DIR" "$OLD_PROD_AUDIT_LOG_DIR" "$LOG_DIR"
mkdir -p "$LOG_DIR"

cat <<EOF
============================================================
KAWVO LINK · TEAM AUTHORITY · RELEASE PRODUCCION
============================================================
Main esperado:     $EXPECTED_MAIN
Producto auditado: $PRODUCT_SHA
Objetivo: promover EXACTAMENTE el producto, sin QA Preview posterior.
============================================================
EOF

run git fetch github main "$FEATURE_BRANCH"
CURRENT_MAIN="$(git rev-parse github/main)"
[ "$CURRENT_MAIN" = "$EXPECTED_MAIN" ] || fail "main cambió: esperado $EXPECTED_MAIN, actual $CURRENT_MAIN"

git merge-base --is-ancestor "$EXPECTED_MAIN" "$PRODUCT_SHA" || fail "PRODUCT_SHA no desciende de main esperado"
[ "$(git rev-list --count "$EXPECTED_MAIN..$PRODUCT_SHA")" = "12" ] || fail "Delta inesperado entre main y producto"

EXPECTED_FILES=$(cat <<'FILES'
api/src/preview-free-entry.ts
api/src/team-corporate.ts
api/src/team-join-authority.ts
app/src/App.tsx
app/src/components/admin/ActivationAuthorityEntry.tsx
app/src/components/admin/AdminGuard.tsx
app/src/components/admin/AdminLogin.tsx
app/src/components/admin/AuthCallback.tsx
app/src/components/admin/free/FreeTeamAssign.tsx
app/src/components/admin/free/FreeTeamJoin.tsx
scripts/audit-team-flow-invariants.mjs
FILES
)
ACTUAL_FILES="$(git diff --name-only "$EXPECTED_MAIN...$PRODUCT_SHA" | sort)"
EXPECTED_SORTED="$(printf '%s\n' "$EXPECTED_FILES" | sort)"
[ "$ACTUAL_FILES" = "$EXPECTED_SORTED" ] || {
  echo "Archivos esperados:"; printf '%s\n' "$EXPECTED_SORTED"
  echo "Archivos reales:"; printf '%s\n' "$ACTUAL_FILES"
  fail "El delta de producción cambió"
}

echo "✓ Delta exacto confirmado: 12 commits / 11 archivos"
echo "✓ No incluye migrations-preview ni infraestructura QA posterior"

# Antes de separar HEAD, el repo debe estar limpio. Los logs conocidos ya fueron retirados.
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Working tree contiene cambios ajenos a nuestros logs; no se toca Producción"; }

# Validar exactamente el árbol que será promovido.
run git checkout --detach "$PRODUCT_SHA"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Working tree no está limpio después del checkout exacto"; }
run git diff --check "$EXPECTED_MAIN...$PRODUCT_SHA"
run node scripts/audit-team-flow-invariants.mjs
run npm ci
run npm run build -w web
run npm run build -w app
run npx tsc --noEmit -p api/tsconfig.json
run npx esbuild api/src/preview-free-entry.ts --bundle --platform=node --format=esm --target=node20 --external:cloudflare:* --outfile=/tmp/kawvo-team-authority-prod.mjs
run bash -lc 'cd api && npx wrangler deploy --config wrangler.toml --dry-run'

# Fuente de verdad Producción antes de tocar código: SOLO SELECT.
echo
echo "▶ D1 Producción · auditoría pre-release (solo lectura)"
{
  (cd api && npx wrangler d1 execute intap_db --remote --config wrangler.toml --command="SELECT COUNT(*) AS broken_member_artifact FROM team_members tm JOIN intap_artifacts a ON a.id=tm.artifact_id WHERE tm.status='active' AND (COALESCE(a.profile_id,'')<>COALESCE(tm.profile_id,'') OR a.status NOT IN('activated','suspended'));" )
  (cd api && npx wrangler d1 execute intap_db --remote --config wrangler.toml --command="SELECT COUNT(*) AS broken_used_code FROM team_link_codes tc LEFT JOIN team_members tm ON tm.invite_code_id=tc.id WHERE tc.status='used' AND (tm.id IS NULL OR COALESCE(tc.member_profile_id,'')<>COALESCE(tm.profile_id,'') OR COALESCE(tc.artifact_id,'')<>COALESCE(tm.artifact_id,''));" )
  (cd api && npx wrangler d1 execute intap_db --remote --config wrangler.toml --command="SELECT COUNT(*) AS team_on_unclaimed_artifact FROM team_members tm JOIN intap_artifacts a ON a.id=tm.artifact_id WHERE a.status IN('available','unassigned');" )
} 2>&1 | tee "$D1_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "No se pudo auditar D1 Producción"
grep -Eq 'broken_member_artifact[^0-9]*0' "$D1_LOG" || fail "D1 tiene relaciones member↔artifact rotas"
grep -Eq 'broken_used_code[^0-9]*0' "$D1_LOG" || fail "D1 tiene códigos Team usados inconsistentes"
grep -Eq 'team_on_unclaimed_artifact[^0-9]*0' "$D1_LOG" || fail "D1 tiene Team members sobre artifacts no reclamados"

echo "✓ D1 Producción consistente antes del release"

# Promover SOLO PRODUCT_SHA. No se promueve el HEAD posterior de la feature.
echo
echo "▶ Promover exactamente $PRODUCT_SHA → main"
run git push github "$PRODUCT_SHA:refs/heads/main"
run git fetch github main
REMOTE_MAIN="$(git rev-parse github/main)"
[ "$REMOTE_MAIN" = "$PRODUCT_SHA" ] || fail "main remoto no quedó exactamente en PRODUCT_SHA"

# No hay migraciones de producción en este delta. Desplegar API y superficies desde el árbol exacto.
echo
echo "▶ Deploy Worker Producción"
(
  cd api
  npm run deploy:production
) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Producción"
WORKER_VERSION="$(grep -E 'Current Version ID:' "$WORKER_LOG" | tail -1 | sed -E 's/.*Current Version ID:[[:space:]]*//' || true)"

echo
echo "▶ Deploy Web Producción"
(npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch main) 2>&1 | tee "$WEB_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Web Producción"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$WEB_LOG" | tail -1 || true)"

echo
echo "▶ Deploy App Producción"
(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch main) 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App Producción"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$APP_LOG" | tail -1 || true)"

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

# El endpoint retirado debe permanecer protegido. Sin sesión, /me exige 401; eso es correcto.
JOIN_HTTP="$(curl -sS -o /tmp/kawvo-prod-legacy-team-join.json -w '%{http_code}' -X POST 'https://app.intaprd.com/api/v1/me/team/join' -H 'content-type: application/json' --data '{}')"
[ "$JOIN_HTTP" = "401" ] || fail "Legacy /me/team/join sin sesión debía responder 401, respondió $JOIN_HTTP"
echo "✓ legacy /me/team/join no es públicamente invocable (401 sin sesión)"

# Auditoría D1 post-deploy, de nuevo SOLO SELECT.
echo
echo "▶ D1 Producción · auditoría post-release (solo lectura)"
POST_D1="$(cd api && npx wrangler d1 execute intap_db --remote --config wrangler.toml --command="SELECT (SELECT COUNT(*) FROM team_members tm JOIN intap_artifacts a ON a.id=tm.artifact_id WHERE tm.status='active' AND (COALESCE(a.profile_id,'')<>COALESCE(tm.profile_id,'') OR a.status NOT IN('activated','suspended'))) AS broken_member_artifact, (SELECT COUNT(*) FROM team_link_codes tc LEFT JOIN team_members tm ON tm.invite_code_id=tc.id WHERE tc.status='used' AND (tm.id IS NULL OR COALESCE(tc.member_profile_id,'')<>COALESCE(tm.profile_id,'') OR COALESCE(tc.artifact_id,'')<>COALESCE(tm.artifact_id,''))) AS broken_used_code;")"
printf '%s\n' "$POST_D1"
printf '%s' "$POST_D1" | grep -Eq 'broken_member_artifact[^0-9]*0' || fail "Post-release: relaciones Team rotas"
printf '%s' "$POST_D1" | grep -Eq 'broken_used_code[^0-9]*0' || fail "Post-release: códigos Team inconsistentes"

TAG="prod-team-authority-source-truth-2026-09-09-$(date +%H%M%S)"
run git tag -a "$TAG" "$PRODUCT_SHA" -m "Kawvo Team authority/source-truth release 2026-09-09"
run git push github "$TAG"

# Volver a main local alineado con remoto.
run git checkout -B main github/main

cat <<EOF

============================================================
✓ TEAM AUTHORITY · PRODUCCION DESPLEGADA
============================================================
Production SHA: $PRODUCT_SHA
Release tag:    $TAG
Worker Version: ${WORKER_VERSION:-ver log}
Web Pages:      ${WEB_ORIGIN:-ver log}
App Pages:      ${APP_ORIGIN:-ver log}
D1:             solo lectura; sin migraciones en este delta
Invariant audit: 22/22 antes del release
QA Preview posterior: NO PROMOVIDO
Logs:           $LOG_DIR
============================================================
EOF
