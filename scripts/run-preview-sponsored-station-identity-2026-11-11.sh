#!/usr/bin/env bash
# QA-only build + isolated Web Pages preview. Never changes Production or the approved Preview custom domain.
set -euo pipefail
[[ "$(printenv KAWVO_STATION_WEB_QA_APPROVED 2>/dev/null || true)" == "SI" ]] || {
  echo "DETENIDO: requiere KAWVO_STATION_WEB_QA_APPROVED=SI para un deployment Web Pages aislado"
  exit 1
}
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="fix/sponsored-beneficiary-scan-station-identification-2026-11-11"
BASE="3896cc5bcd21105506f29477ba7baac35c09b94e"
PAGES_BRANCH="qa-sponsor-station-1111"
fail(){ echo "DETENIDO: $*" >&2; exit 1; }
cd "$ROOT" || fail "Repositorio no encontrado"
[[ -z "$(git status --porcelain)" ]] || fail "Hay cambios locales, no modificar el checkout"
git fetch github "$BRANCH"
git switch "$BRANCH"
git pull --ff-only github "$BRANCH"
git merge-base --is-ancestor "$BASE" HEAD || fail "La rama no está basada en el Worker actualmente publicado"
git diff --check "$BASE"..HEAD
CHANGED="$(git diff --name-only "$BASE"..HEAD)"
EXPECTED="$(printf '%s\n' \
 scripts/run-preview-sponsored-station-identity-2026-11-11.sh \
 scripts/test-sponsored-activation-landing-cleanup-2026-11-04.mjs \
 scripts/test-sponsored-public-station-identity-2026-11-11.mjs \
 web/src/components/sponsored/SponsoredAwareArtifactResolver.tsx)"
[[ "$CHANGED" == "$EXPECTED" ]] || { printf '%s\n' "$CHANGED"; fail "Archivos fuera de alcance"; }
[[ -z "$(git diff --name-only "$BASE"..HEAD -- api/ app/ web/.env.preview web/.env.production)" ]] || fail "API/App/configuración no autorizada"
grep -Fxq 'VITE_API_URL=https://preview.intaprd.com' web/.env.preview || fail "Vite API no apunta a Preview"
grep -Fxq 'VITE_APP_URL=https://app.preview.intaprd.com' web/.env.preview || fail "Vite App no apunta a Preview"
mkdir -p "$HOME/intap-release-logs"
LOG="$(mktemp -d "$HOME/intap-release-logs/sponsor-station-web-qa-2026-11-11-XXXXXXXX")"
echo "Log: $LOG"
echo "===== Contratos públicos, roles, NFC y KawMed ====="
npm ci
node scripts/test-sponsored-activation-landing-cleanup-2026-11-04.mjs
node scripts/test-sponsored-public-station-identity-2026-11-11.mjs
node scripts/test-all-master-physical-station-parity-2026-11-02.mjs
node scripts/test-nfc-physical-identifier-release.mjs
echo "===== Compilar Web modo Preview; NO publicar Workers ====="
npm run web:build:preview
[[ -f web/dist/index.html ]] || fail "Web dist no compilado"
[[ -z "$(git status --porcelain)" ]] || fail "La compilación cambió los archivos versionados"
echo "===== Publicar SOLO un deployment Web Pages de rama QA ====="
echo "No se cambiará la rama main de Pages ni WEB_PAGES_ORIGIN del Worker Preview."
npx --no-install wrangler pages deploy web/dist --project-name intap-link --branch "$PAGES_BRANCH" --commit-hash "$(git rev-parse HEAD)" 2>&1 | tee "$LOG/pages-qa-deploy.txt"
URL="$(grep -Eo 'https://[0-9a-z]{8,}\.intap-link\.pages\.dev' "$LOG/pages-qa-deploy.txt" | tail -n1 || true)"
[[ -n "$URL" ]] || fail "Puede haberse desplegado QA, pero no pude recuperar URL. NO repetir sin revisar log"
printf '%s\n' "$URL" > "$LOG/qa-url.txt"
CODE="$(curl -sS --max-time 30 -L -o /dev/null -w '%{http_code}' "$URL/" || true)"
[[ "$CODE" == "200" ]] || fail "La Web aislada respondió HTTP $CODE; NO repetir sin revisar"
echo "PASS: Web QA aislada $URL (HTTP $CODE). API Worker/Pages main/Web Preview estable/App/D1/R2 sin modificaciones directas."
echo "Para prueba funcional usa dispositivo o código de QA autorizado: $URL/l/<codigo>"
echo "NO usar códigos comerciales para activar ni compartir códigos públicamente."
echo "Log: $LOG"
