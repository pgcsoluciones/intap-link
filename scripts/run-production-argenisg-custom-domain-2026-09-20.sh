#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feat/argenisg-custom-domain"
EXPECTED_MAIN="6eef430f2f427aef587c7ed64fbbced2f63fcdda"
APPROVED_SHA="65ec431484dc8f90a70636074c202c7ff1ee2c12"
RUNNER="scripts/run-production-argenisg-custom-domain-2026-09-20.sh"
LOG_DIR="$ROOT/.production-argenisg-custom-domain-logs"
fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }
cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" && mkdir -p "$LOG_DIR"
git remote get-url github >/dev/null 2>&1 && REMOTE=github || REMOTE=origin
run git fetch "$REMOTE" main "$BRANCH"
CURRENT_MAIN="$(git rev-parse "$REMOTE/main")"
[ "$CURRENT_MAIN" = "$EXPECTED_MAIN" ] || fail "main cambió: esperado $EXPECTED_MAIN actual $CURRENT_MAIN"
run git checkout "$BRANCH"
run git pull --ff-only "$REMOTE" "$BRANCH"
[ -z "$(git status --porcelain)" ] || fail "Árbol local no limpio"
git merge-base --is-ancestor "$EXPECTED_MAIN" HEAD || fail "La rama no parte del main esperado"
git merge-base --is-ancestor "$APPROVED_SHA" HEAD || fail "El SHA aprobado ya no es ancestro"
POST="$(git diff --name-only "$APPROVED_SHA"..HEAD | grep -v "^${RUNNER}$" || true)"
[ -z "$POST" ] || { echo "$POST"; fail "Hay cambios posteriores al código aprobado"; }
run git diff --check "$REMOTE/main"...HEAD

echo "▶ Verificar alcance"
CHANGED="$(git diff --name-only "$REMOTE/main"...HEAD | grep -v "^${RUNNER}$" | sort)"
EXPECTED_FILES="$(printf "%s\n" functions/_middleware.ts functions/assets/adonisg/[[path]].ts functions/profile-discovery.ts web/src/App.tsx web/src/components/PublicProfile.tsx web/src/components/free-profile/PublicBankAccounts.tsx | sort)"
[ "$CHANGED" = "$EXPECTED_FILES" ] || { echo "$CHANGED"; fail "Hay archivos fuera del alcance aprobado"; }

echo "▶ Preflight dominios Cloudflare"
for host in argenisgrullon.com www.argenisgrullon.com alestilodeargenis.com www.alestilodeargenis.com; do
  if ! curl -sSIL --max-time 15 "https://$host/" >/dev/null 2>&1; then
    fail "$host todavía no responde por HTTPS. Adjunta ese dominio al proyecto Pages intap-link en Cloudflare antes de continuar."
  fi
  echo "✓ $host responde por HTTPS"
done

run npm ci
run npm run build -w web
grep -R "argenisgrullon.com" web/dist/assets >/dev/null || fail "El bundle Web no contiene el dominio personalizado"
grep -Fq "argenisgrullon.com" functions/_middleware.ts || fail "Middleware sin dominio personalizado"
grep -Fq "customProfileSlug" functions/profile-discovery.ts || fail "Discovery sin mapeo de perfil personalizado"

echo "▶ Deploy SOLO Web Producción"
(npx wrangler pages deploy web/dist --project-name intap-link --branch main) 2>&1 | tee "$LOG_DIR/web.log"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Web Producción"
sleep 8

echo "▶ QA dominio principal"
ROOT_HTML="$(curl -fsSL --max-time 20 https://argenisgrullon.com/)" || fail "No abre argenisgrullon.com"
printf "%s" "$ROOT_HTML" | grep -Fq "Argenis Grullón" || fail "La raíz no contiene metadata de Argenis"
printf "%s" "$ROOT_HTML" | grep -Fq 'rel="canonical" href="https://argenisgrullon.com"' || fail "Canonical principal incorrecto"
printf "%s" "$ROOT_HTML" | grep -Fq 'property="og:url" content="https://argenisgrullon.com"' || fail "OG URL principal incorrecta"
echo "✓ raíz + canonical + OG correctos"

echo "▶ QA recursos SEO/IA"
AI_CODE="$(curl -sS -o "$LOG_DIR/ai.md" -w '%{http_code}' https://argenisgrullon.com/ai.md)"
[ "$AI_CODE" = "200" ] || fail "ai.md respondió HTTP $AI_CODE"
FACTS_CODE="$(curl -sS -o "$LOG_DIR/facts.json" -w '%{http_code}' https://argenisgrullon.com/facts.json)"
[ "$FACTS_CODE" = "200" ] || fail "facts.json respondió HTTP $FACTS_CODE"
SITEMAP="$(curl -fsSL https://argenisgrullon.com/sitemap.xml)" || fail "No abre sitemap"
printf "%s" "$SITEMAP" | grep -Fq "<loc>https://argenisgrullon.com</loc>" || fail "Sitemap no contiene canonical de Argenis"
printf "%s" "$SITEMAP" | grep -Fq "intaprd.com/jlprince" && fail "Sitemap personalizado está filtrando mal" || true
echo "✓ ai.md + facts.json + sitemap correctos"

echo "▶ QA redirecciones"
location_of(){ curl -sSI --max-time 15 "$1" | tr -d "\r" | awk -F": " 'tolower($1)=="location"{print $2; exit}'; }
STATUS_OLD="$(curl -sS -o /dev/null -w '%{http_code}' https://intaprd.com/argenisg)"
[ "$STATUS_OLD" = "308" ] || fail "intaprd.com/argenisg no devuelve 308 (HTTP $STATUS_OLD)"
[ "$(location_of https://intaprd.com/argenisg)" = "https://argenisgrullon.com/" ] || [ "$(location_of https://intaprd.com/argenisg)" = "https://argenisgrullon.com" ] || fail "Redirect /argenisg incorrecto"
STATUS_ALIAS="$(curl -sS -o /dev/null -w '%{http_code}' https://alestilodeargenis.com/)"
[ "$STATUS_ALIAS" = "308" ] || fail "alestilodeargenis.com no devuelve 308 (HTTP $STATUS_ALIAS)"
echo "✓ redirecciones permanentes correctas"

echo "▶ Promover a main"
run git checkout -B main "$REMOTE/main"
run git merge --ff-only "$REMOTE/$BRANCH"
run git push "$REMOTE" main
PROD_SHA="$(git rev-parse HEAD)"
TAG="prod-argenisg-custom-domain-2026-09-20-$(date +%H%M%S)"
run git tag -a "$TAG" -m "Argenis custom canonical domain 2026-09-20"
run git push "$REMOTE" "$TAG"
rm -rf "$LOG_DIR"
echo "============================================================"
echo "✓ DOMINIO PERSONALIZADO ARGENIS EN PRODUCCIÓN"
echo "Production SHA: $PROD_SHA"
echo "Release tag: $TAG"
echo "Canonical: https://argenisgrullon.com"
echo "============================================================"
