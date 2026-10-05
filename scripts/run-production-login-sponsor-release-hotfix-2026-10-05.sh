#!/usr/bin/env bash
set -euo pipefail

BRANCH="hotfix/login-sponsor-release-2026-10-05"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

fail(){ echo "✗ ERROR: $*" >&2; exit 1; }
run(){ echo; echo "▶ $*"; "$@"; }

echo "================================================================"
echo "KAWVO LINK · PRODUCTION HOTFIX · LOGIN + SPONSOR OWNER RELEASE"
echo "================================================================"
echo "- Corrige loop por scan local obsoleto."
echo "- Un sponsor_owner inactivo ya no secuestra el home-route."
echo "- Cambiar correo propietario transfiere membership + perfil Master."
echo "- Repara DAPSA: intapcard@gmail.com owner; beatocotizaciones liberado."
echo "================================================================"

run git fetch github main "$BRANCH"
run git switch "$BRANCH"
run git pull --ff-only github "$BRANCH"
run git diff --check github/main...HEAD

CHANGED="$(git diff --name-only github/main...HEAD | sort)"
ALLOWED="$(cat <<'EOF'
api/src/account-home-route.ts
api/src/sponsored-owner-flow.ts
app/public/sw.js
app/src/components/admin/AdminGuard.tsx
scripts/run-production-login-sponsor-release-hotfix-2026-10-05.sh
scripts/test-login-sponsor-release-hotfix-2026-10-05.mjs
EOF
)"
[ "$CHANGED" = "$ALLOWED" ] || { echo "$CHANGED"; fail "Hay archivos fuera del alcance aprobado"; }

run npm ci
run node scripts/test-login-sponsor-release-hotfix-2026-10-05.mjs
run npm run build -w app
run bash -lc "cd api && npx tsc --noEmit"
run npx esbuild api/src/preview-free-entry.ts --bundle --platform=node --format=esm --target=node20 --external:cloudflare:* --outfile=/tmp/kawvo-login-sponsor-hotfix-api.mjs

echo
echo "▶ Preflight D1 Producción"
CHECK="$(cd api && npx wrangler d1 execute intap_db --remote --config wrangler.toml --json --command "
SELECT id,email FROM users WHERE lower(email) IN ('intapcard@gmail.com','beatocotizaciones@gmail.com') ORDER BY email;
SELECT id,name,contact_email FROM sponsor_tenants WHERE id='b5aac44a-3e97-48a9-9917-11980996b283';
")"
echo "$CHECK" | grep -qi 'intapcard@gmail.com' || fail "No existe la cuenta intapcard@gmail.com en Producción"
echo "$CHECK" | grep -qi 'beatocotizaciones@gmail.com' || fail "No existe la cuenta beatocotizaciones@gmail.com en Producción"
echo "$CHECK" | grep -q 'b5aac44a-3e97-48a9-9917-11980996b283' || fail "No existe sponsor DAPSA esperado"
echo "✓ Preflight D1 OK"

echo
echo "▶ Deploy Worker/API Producción"
(cd api && npx wrangler deploy --config wrangler.toml)

echo
echo "▶ Reparación idempotente DAPSA en D1 Producción"
(cd api && npx wrangler d1 execute intap_db --remote --config wrangler.toml --command "
INSERT INTO sponsor_members(sponsor_id,user_id,role,status,created_at)
SELECT 'b5aac44a-3e97-48a9-9917-11980996b283',id,'owner','active',datetime('now')
FROM users WHERE lower(email)='intapcard@gmail.com'
ON CONFLICT(sponsor_id,user_id) DO UPDATE SET role='owner',status='active';

UPDATE sponsor_members
SET status='inactive'
WHERE sponsor_id='b5aac44a-3e97-48a9-9917-11980996b283'
  AND user_id<>(SELECT id FROM users WHERE lower(email)='intapcard@gmail.com' LIMIT 1)
  AND role='owner';

UPDATE sponsored_profiles
SET user_id=(SELECT id FROM users WHERE lower(email)='intapcard@gmail.com' LIMIT 1),
    updated_at=datetime('now')
WHERE sponsor_id='b5aac44a-3e97-48a9-9917-11980996b283'
  AND profile_role='sponsor_owner';

UPDATE sponsor_tenants
SET contact_email='intapcard@gmail.com',updated_at=datetime('now')
WHERE id='b5aac44a-3e97-48a9-9917-11980996b283';
")

echo
echo "▶ Verificación D1 post-repair"
VERIFY="$(cd api && npx wrangler d1 execute intap_db --remote --config wrangler.toml --json --command "
SELECT u.email,sm.role,sm.status FROM sponsor_members sm JOIN users u ON u.id=sm.user_id WHERE sm.sponsor_id='b5aac44a-3e97-48a9-9917-11980996b283' ORDER BY u.email;
SELECT sp.username,sp.profile_role,u.email FROM sponsored_profiles sp LEFT JOIN users u ON u.id=sp.user_id WHERE sp.sponsor_id='b5aac44a-3e97-48a9-9917-11980996b283' AND sp.profile_role='sponsor_owner';
SELECT u.email,p.id,p.slug,p.plan_id FROM users u LEFT JOIN profiles p ON p.user_id=u.id WHERE lower(u.email)='beatocotizaciones@gmail.com';
")"
echo "$VERIFY"
echo "$VERIFY" | grep -qi 'intapcard@gmail.com' || fail "DAPSA no quedó en intapcard"
echo "$VERIFY" | grep -qi 'beatocotizaciones@gmail.com' || fail "No pude verificar cuenta liberada"
echo "$VERIFY" | grep -qi '"status": "inactive"' || echo "ℹ️ Revisa visualmente el estado inactive del dueño anterior"
echo "✓ D1 reparado"

echo
echo "▶ Deploy Admin App Producción"
APP_LOG="$(mktemp)"
(npx wrangler pages deploy app/dist --project-name intap-web2 --branch main) 2>&1 | tee "$APP_LOG"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$APP_LOG" | tail -1 || true)"
[ -n "$APP_ORIGIN" ] || fail "No pude detectar deployment App Producción"

echo
echo "▶ Smoke canónico"
for url in   "https://app.intaprd.com/admin/login"   "https://app.intaprd.com/admin"   "https://app.intaprd.com/admin/sponsor"
do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url" || true)"
  [ "$code" = "200" ] || fail "$url respondió $code"
  echo "✓ $url → 200"
done

ME_CODE="$(curl -sS -o /dev/null -w '%{http_code}' https://app.intaprd.com/api/v1/me/home-route || true)"
[ "$ME_CODE" = "401" ] || fail "home-route sin sesión debería responder 401, respondió $ME_CODE"
echo "✓ API auth boundary intacta"

echo
echo "▶ Publicar código fuente aprobado en main"
run git push github HEAD:main
TAG="prod-login-sponsor-release-hotfix-2026-10-05-$(date +%H%M%S)"
run git tag "$TAG"
run git push github "$TAG"

echo
echo "================================================================"
echo "✓ HOTFIX PRODUCCIÓN APROBADO"
echo "================================================================"
echo "SHA:        $(git rev-parse HEAD)"
echo "App Pages:  $APP_ORIGIN"
echo "Tag:        $TAG"
echo
echo "Validar manualmente:"
echo "1. Abrir app.intaprd.com/admin/login en una ventana normal."
echo "2. Entrar con SuperAdmin y confirmar que ya no cae en /admin/artifacts/activate."
echo "3. Entrar con beatocotizaciones@gmail.com: ya no debe ir a /admin/sponsor."
echo "4. Esa cuenta queda disponible para crear/usar su Perfil Free."
echo "5. DAPSA debe quedar administrado por intapcard@gmail.com."
echo "================================================================"
