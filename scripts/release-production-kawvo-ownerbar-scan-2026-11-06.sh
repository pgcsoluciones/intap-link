#!/usr/bin/env bash
# Confirmed release runner, API Worker first, Web public Pages second, App untouched.
# No migration, D1/R2 write or automatic rollback.
set -euo pipefail
[[ "${KAWVO_OWNERBAR_SCAN_PRODUCTION_APPROVED:-}" == "SI" ]] || { echo "DETENIDO: solicita aprobación explícita KAWVO_OWNERBAR_SCAN_PRODUCTION_APPROVED=SI"; exit 1; }
ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="release/kawvo-production-guarded-ownerbar-scan-2026-11-06"
OLD_API="a74d6e25-63c6-4c84-beac-3ad39ba723de"
OLD_WEB_SHA="444f3da79a85a87baa739f1eafac87891607885d"
OLD_WEB_DEPLOY="f0dc59ed-f341-4d3d-ae77-f6588bcc4eb8"
OLD_APP_SHA="bd1b99ac3462ed772ad36dfdaa667f1da5fbb93e"
SOURCE_LOCK="b5daca23716230341af0cff63f6b07a501ed0c73"
fail(){ echo "DETENIDO: $*" >&2; exit 1; }
cd "$ROOT" || fail "Repositorio no disponible."
[[ -z "$(git status --porcelain)" ]] || fail "Existen cambios no guardados."
git fetch github "$BRANCH"
git switch "$BRANCH"
git pull --ff-only github "$BRANCH"
# Pin this single release revision: disallow an accidental later commit.
git merge-base --is-ancestor "$SOURCE_LOCK" HEAD || fail "Origen de release no aprobado."
RELEASE_CHANGES="$(git diff --name-only "$SOURCE_LOCK"..HEAD)"
[[ "$RELEASE_CHANGES" == "scripts/release-production-kawvo-ownerbar-scan-2026-11-06.sh" ]] || fail "Se cambiaron archivos fuera del runner desde el preflight aprobado."
grep -Fxq 'keep_vars = true' api/wrangler.toml || fail "No está activa la protección de variables."

echo "===== Preflight estricto desde el commit EXACTO ====="
bash scripts/preflight-production-kawvo-ownerbar-scan-2026-11-06.sh
[[ "$(git diff --name-only "$SOURCE_LOCK"..HEAD)" == "scripts/release-production-kawvo-ownerbar-scan-2026-11-06.sh" ]] || fail "Cambió código de producto durante preflight."
MAIN_JS="$(grep -Eo '/assets/index-[A-Za-z0-9_-]+\.js' web/dist/index.html | head -n1 || true)"
[[ -n "$MAIN_JS" && -f "web/dist$MAIN_JS" ]] || fail "No existe el JS compilado y verificado."

mkdir -p "$HOME/intap-release-logs"
LOG_DIR="$(mktemp -d "$HOME/intap-release-logs/kawvo-prod-release-2026-11-06-XXXXXXXX")"
printf '%s\n' "$OLD_API" > "$LOG_DIR/previous-api-version.txt"
printf '%s\n' "$OLD_WEB_DEPLOY" > "$LOG_DIR/previous-web-deployment.txt"
printf '%s\n' "$OLD_WEB_SHA" > "$LOG_DIR/previous-web-source.txt"
printf '%s\n' "$OLD_APP_SHA" > "$LOG_DIR/unchanged-app-source.txt"
git rev-parse HEAD > "$LOG_DIR/release-source.txt"

check_api_version(){
  local expected="$1" last
  (cd api && npx --no-install wrangler deployments list --name intap-api) > "$LOG_DIR/api-current-list.txt" 2>&1
  last="$(grep -Eo 'Version\(s\):[[:space:]]+\(100%\)[[:space:]]+[a-f0-9-]{36}' "$LOG_DIR/api-current-list.txt" | tail -n1 | grep -Eo '[a-f0-9-]{36}$' || true)"
  [[ "$last" == "$expected" ]] || fail "La API Producción cambió: $last (esperada $expected)."
}
check_web_version(){
  local expected="$1" first
  npx --no-install wrangler pages deployment list --project-name intap-link --environment production > "$LOG_DIR/web-current-list.txt" 2>&1
  first="$(grep -F '│ Production' "$LOG_DIR/web-current-list.txt" | head -n1 || true)"
  [[ "$first" == *"$expected"* ]] || fail "La Web Producción cambió desde $expected."
}
check_app_unchanged(){
  local first
  npx --no-install wrangler pages deployment list --project-name intap-web2 --environment production > "$LOG_DIR/app-current-list.txt" 2>&1
  first="$(grep -F '│ Production' "$LOG_DIR/app-current-list.txt" | head -n1 || true)"
  [[ "$first" == *'bd1b99a'* ]] || fail "La App cambió, detener para no mezclar versiones."
}
check_private_api(){
  local code
  code="$(curl -sS --max-time 30 -o /dev/null -w '%{http_code}' 'https://api.intaprd.com/api/v1/me/free/appointments/public-context?username=intap3' || true)"
  [[ "$code" == "401" || "$code" == "403" ]] || fail "API privada abierta o caída: HTTP $code."
  echo "API privada sin sesión: HTTP $code"
}
echo "===== Última confirmación de versiones: sin sobreescribir cambios ajenos ====="
check_api_version "$OLD_API"
check_web_version '444f3da'
check_app_unchanged
check_private_api

echo "===== Publicando solo Worker API PRODUCCIÓN intap-api ====="
(cd api && npx --no-install wrangler deploy --config wrangler.toml) 2>&1 | tee "$LOG_DIR/api-deploy.txt"
grep -Fq 'Uploaded intap-api (' "$LOG_DIR/api-deploy.txt" || fail "Worker API no confirmado."
NEW_API="$(grep -Eo 'Current Version ID: [a-f0-9-]{36}' "$LOG_DIR/api-deploy.txt" | tail -n1 | awk '{print $4}' || true)"
[[ "$NEW_API" =~ ^[a-f0-9-]{36}$ ]] || fail "Worker API se publicó pero no se pudo recuperar su versión; revisar antes de tocar Web."
printf '%s\n' "$NEW_API" > "$LOG_DIR/new-api-version.txt"
check_api_version "$NEW_API"
check_private_api
# The scan status endpoint has to remain public but cannot reveal any owner data for an invalid code.
SCAN_CODE="$(curl -sS --max-time 30 -o "$LOG_DIR/scan-invalid.json" -w '%{http_code}' -X POST -H 'Content-Type: application/json' --data '{"public_code":"BAD"}' 'https://api.intaprd.com/api/v1/public/artifacts/scan/status' || true)"
[[ "$SCAN_CODE" == "400" ]] || fail "Ruta de escaneo inválido devolvió HTTP $SCAN_CODE; detener antes de publicar Web."

echo "===== Versiones Pages sin cambios justo antes de publicar Web ====="
check_web_version '444f3da'
check_app_unchanged
echo "===== Publicando únicamente Web pública intap-link, no App ====="
npx --no-install wrangler pages deploy web/dist --project-name intap-link --branch main --commit-hash "$(git rev-parse HEAD)" 2>&1 | tee "$LOG_DIR/web-deploy.txt"
grep -Fq 'Deployment complete!' "$LOG_DIR/web-deploy.txt" || fail "Cloudflare no confirmó la publicación Web."
printf '%s\n' "$(git rev-parse HEAD)" > "$LOG_DIR/new-web-source.txt"
echo "===== Verificación de bundle real publicado en dominio final ====="
verified=0
for try in 1 2 3 4 5 6 7 8; do
  if curl -fsSL --max-time 30 -H 'Cache-Control: no-cache' 'https://intaprd.com/intap3' -o "$LOG_DIR/prod-free.html" \
    && grep -Fq "$MAIN_JS" "$LOG_DIR/prod-free.html" \
    && curl -fsSL --max-time 30 "https://intaprd.com$MAIN_JS" -o "$LOG_DIR/prod-main.js" \
    && cmp -s "web/dist$MAIN_JS" "$LOG_DIR/prod-main.js"; then
      verified=1
      break
  fi
  sleep 5
done
[[ "$verified" -eq 1 ]] || fail "La Web se publicó pero no se verificó el JS nuevo en intaprd.com."
check_api_version "$NEW_API"
check_private_api
check_app_unchanged
[[ -z "$(git status --porcelain)" ]] || fail "Cambios locales inesperados."
echo
echo "PRODUCCIÓN PUBLICADA: API $NEW_API + Web $(git rev-parse --short HEAD)."
echo "APP sin desplegar; D1, R2 y migraciones sin modificaciones directas."
echo "QA inmediato requerido: Free, patrocinado/beneficiario, Master/estación, KawMed, NFC/QR, desktop/móvil."
echo "Rollback manual Worker: cd api && npx --no-install wrangler rollback $OLD_API --name intap-api --message 'rollback kawvo ownerbar scan 2026-11-06'"
echo "Rollback manual Web: Cloudflare Pages > intap-link > Deployments > $OLD_WEB_DEPLOY > Rollback."
echo "Logs: $LOG_DIR"
