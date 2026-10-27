#!/usr/bin/env bash
# INTAP · hotfix complementario multicuenta, patrocinado y Free (PR #121).
# PREPARAR no publica. DEPLOY exige PR integrado, QA y SHA aprobado.
# API -> Web (intap-link) -> App (intap-web2), sin migraciones.
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
REMOTE="github"
QA_BRANCH="release/sponsored-free-hotfix-2026-10-27"
EXPECTED_BASE_SHA="c9211e277c7643b069541f26732442916cdce49f"
MIN_QA_SHA="b7f1d7bc639bcd30848386c1e8855436a99b79f3"
RUNNER="scripts/run-production-sponsored-free-hotfix-2026-10-27.sh"
MODE="${1:-preflight}"
LOG_DIR="$HOME/intap-release-logs/sponsored-free-hotfix-$(date -u +%Y%m%dT%H%M%SZ)"

fail(){ printf '\n✗ ERROR: %s\n' "$*" >&2; exit 1; }
run(){ printf '\n▶'; printf ' %q' "$@"; printf '\n'; "$@"; }
[[ "$MODE" == "preflight" || "$MODE" == "deploy" ]] || fail "Uso: bash $RUNNER preflight|deploy"
cd "$ROOT" || fail "No existe el repositorio local esperado"
[[ -z "$(git status --porcelain)" ]] || fail "Hay cambios o archivos locales sin guardar; no se toca el checkout"
run git fetch "$REMOTE" main "$QA_BRANCH"

if [[ "$MODE" == "preflight" ]]; then
  # Preflight se ejecuta desde rama QA sin tocar main, D1 ni Cloudflare.
  if git show-ref --verify --quiet "refs/heads/$QA_BRANCH"; then
    run git switch "$QA_BRANCH"
  else
    run git switch --track -c "$QA_BRANCH" "$REMOTE/$QA_BRANCH"
  fi
  run git pull --ff-only "$REMOTE" "$QA_BRANCH"
  [[ "$(git rev-parse "$REMOTE/main")" == "d97168dbab8ddbc30f019361db1b915ff66f1807" ]] || fail "main se movió; revisar la comparación/PR antes del lanzamiento"
  git merge-base --is-ancestor "$REMOTE/main" HEAD || fail "La rama candidata no incluye main"
else
  # El despliegue SOLO usa main ya fusionado en GitHub: jamás push forzado ni merge por el runner.
  run git switch main
  run git pull --ff-only "$REMOTE" main
  [[ "$(git rev-parse HEAD)" == "$(git rev-parse "$REMOTE/main")" ]] || fail "El main local no coincide con remoto"
  git merge-base --is-ancestor "$MIN_QA_SHA" HEAD || fail "PR #121 todavía no está integrado como ancestro de main (merge no-squash)"
  [[ "${INTAP_QA_VERIFIED:-}" == "SPONSORED_FREE_HOTFIX_PREVIEW_OK" ]] || fail "Falta QA manual completo de perfiles y categorías"
  [[ "${INTAP_RELEASE_NO_MIGRATION:-}" == "CONFIRMO_SIN_MIGRACIONES" ]] || fail "Confirmar explícitamente que este release no aplica migraciones D1"
  INTAP_ENFORCE_PRODUCTION_APPROVAL=1 python3 scripts/production_approval_guard.py || fail "Falta aprobación explícita del SHA de Producción"
fi

[[ -z "$(git status --porcelain)" ]] || fail "Checkout sucio antes de verificaciones"
git merge-base --is-ancestor "$EXPECTED_BASE_SHA" HEAD || fail "Baseline no es ancestro del release"
git merge-base --is-ancestor "$MIN_QA_SHA" HEAD || fail "La integración QA aprobada no es ancestro del release"
run git diff --check "$EXPECTED_BASE_SHA"...HEAD

echo "▶ Verificando allowlist, base de release $EXPECTED_BASE_SHA"
while IFS= read -r path; do
  [[ -z "$path" ]] && continue
  case "$path" in
    api/src/index.ts|app/src/components/admin/IntapcardAccountSelector.tsx|app/src/components/admin/sponsored/SponsorDashboard.tsx|app/src/components/admin/sponsored/SponsoredDashboard.tsx|scripts/test-intapcard-active-account-contract.mjs|scripts/run-preview-sponsored-hotfix-2026-10-27.sh|scripts/run-production-sponsored-free-hotfix-2026-10-27.sh) ;;
    *) fail "Cambio inesperado desde baseline: $path" ;;
  esac
done < <(git diff --name-only "$EXPECTED_BASE_SHA"...HEAD)
if git diff --name-only "$EXPECTED_BASE_SHA"...HEAD | grep -Eq '^(api/migrations|api/migrations-preview|functions/|package(-lock)?\.json)';then
  fail "Detectada migración, Pages Functions o dependencia fuera del alcance: bloquear release"
fi
test -f docs/CLOUDFLARE_PAGES_ARCHITECTURE.md || fail "Falta contrato de proyectos Cloudflare"
grep -Fq '`web/` → Pages `intap-link`' docs/CLOUDFLARE_PAGES_ARCHITECTURE.md || fail "Destino Web no verificado"
grep -Fq '`app/` → Pages `intap-web2`' docs/CLOUDFLARE_PAGES_ARCHITECTURE.md || fail "Destino App no verificado"

run npm ci
# El conteo total de npm incluye devDependencies: exigir cero fallos CRÍTICOS en dependencias productivas.
run npm audit --omit=dev --audit-level=critical
run node scripts/test-intapcard-active-account-contract.mjs
run node scripts/test-kawmed-web-preview-route-contract.mjs
run node scripts/test-intapcard-multiaccount-contract.mjs
run node scripts/test-intapcard-kawmed-integrated-contract.mjs
run node scripts/test-kawmed-code-accordion-contract.mjs
run node scripts/test-kawmed-isolation-contract.mjs
run node scripts/test-kawmed-demo-invitations-contract.mjs
run npx tsc --noEmit -p api/tsconfig.json
# Vite también conserva constantes literales para ramas de Preview activadas
# solo en dominios Preview. Esas referencias NO definen el backend activo.
# Forzar las variables de build y verificar su configuración y salida real.
grep -Fxq 'VITE_API_URL=https://api.intaprd.com' app/.env.production || fail "App Production API no configurada"
grep -Fxq 'VITE_WEB_URL=https://intaprd.com' app/.env.production || fail "App Production Web no configurada"
grep -Fxq 'VITE_API_URL=https://api.intaprd.com' web/.env.production || fail "Web Production API no configurada"
grep -Fxq 'VITE_APP_URL=https://app.intaprd.com' web/.env.production || fail "Web Production App no configurada"
if grep -Eiq '(^|=).*https://(app\.)?preview\.intaprd\.com' app/.env.production web/.env.production;then
  fail "Una variable de entorno de Producción apunta a Preview"
fi
# Evitar contaminación accidental por VITE_* exportadas en la terminal.
run env VITE_API_URL=https://api.intaprd.com VITE_APP_URL=https://app.intaprd.com VITE_PUBLIC_ORIGIN=https://intaprd.com VITE_ENVIRONMENT=production npm run build -w web
run env VITE_API_URL=https://api.intaprd.com VITE_WEB_URL=https://intaprd.com VITE_ENVIRONMENT=production npm run build -w app
grep -RlF 'https://api.intaprd.com' app/dist/assets --include='*.js' >/dev/null || fail "El bundle App no contiene el API de Producción"
grep -RlF 'https://api.intaprd.com' web/dist/assets --include='*.js' >/dev/null || fail "El bundle Web no contiene el API de Producción"
grep -RlF 'https://app.intaprd.com' web/dist/assets --include='*.js' >/dev/null || fail "El bundle Web no contiene el destino App de Producción"
echo "✓ Entornos y destinos efectivos de Producción validados; se permiten ramas Preview condicionadas por hostname"
grep -RlF '/m/:slug' web/dist/assets --include='*.js' >/dev/null || fail "El bundle Web no incluye /m/:slug"
find web/dist/assets -maxdepth 1 -name '*KawMedProfile*.js' | grep -q . || fail "Falta el bundle KawMed"
run bash -n "$RUNNER"
(
  cd api
  run npx wrangler deploy --config wrangler.toml --dry-run
)
echo "▶ Preflight SQL solo lectura: esquema real de D1 Producción"
# Compilar cada subconsulta falla si faltan tablas/columnas que usa el directorio,
# sin leer datos de perfiles ni cambiar la base.
(
  cd api
  run npx wrangler d1 execute intap_db --remote --config wrangler.toml --command "SELECT (SELECT id FROM users LIMIT 0) AS users_ok,(SELECT plan_id FROM profiles LIMIT 0) AS profiles_ok,(SELECT profile_role FROM sponsored_profiles LIMIT 0) AS sponsored_ok,(SELECT sponsor_id FROM sponsor_members LIMIT 0) AS sponsor_members_ok,(SELECT id FROM sponsor_tenants LIMIT 0) AS sponsors_ok,(SELECT sponsor_id FROM sponsor_user_context LIMIT 0) AS sponsor_context_ok,(SELECT owner_user_id FROM trial_profiles LIMIT 0) AS trial_ok,(SELECT user_id FROM medical_profiles LIMIT 0) AS med_ok,(SELECT medical_profile_id FROM medical_access_codes LIMIT 0) AS medical_codes_ok,(SELECT medical_profile_id FROM medical_profile_sponsors LIMIT 0) AS medical_sponsor_ok,(SELECT claimed_by_user_id FROM medical_sponsor_masters LIMIT 0) AS med_master_ok,(SELECT medical_profile_id FROM medical_sponsor_master_profiles LIMIT 0) AS med_master_profile_ok,(SELECT session_hash FROM auth_sessions LIMIT 0) AS session_hash_ok,(SELECT revoked_at FROM auth_sessions LIMIT 0) AS session_revocation_ok;"
)
echo "✓ Código candidato: $(git rev-parse HEAD)"
if [[ "$MODE" == "preflight" ]]; then
  echo "✓ PREFLIGHT únicamente. No hubo modificaciones de Cloudflare, main ni D1."
  echo "PENDIENTE: QA autenticado de cada cuenta y promoción del PR #119 a main."
  echo "NO ejecutar modo deploy antes del QA y de comprobar el SHA de main integrado."
  exit 0
fi

# Protección final de carrera: no publicar si main cambió durante las pruebas.
[[ "$(git ls-remote "$REMOTE" refs/heads/main | cut -f1)" == "$(git rev-parse HEAD)" ]] || fail "main remoto cambió durante el build"
mkdir -p "$LOG_DIR"
echo "▶ Respaldo no destructivo de la D1 de Producción (NO se aplican migraciones)"
BACKUP="$LOG_DIR/intap_db_before_release.sql"
(
  cd api
  run npx wrangler d1 export intap_db --remote --config wrangler.toml --output="$BACKUP"
)
[[ -s "$BACKUP" ]] || fail "No se generó el respaldo D1; abortado"
# API antes que App para evitar que App solicite endpoints ausentes
echo "▶ Publicando Worker API Producción"
(
  cd api
  npx wrangler deploy --config wrangler.toml 2>&1 | tee "$LOG_DIR/api-deploy.log"
)
API_HEALTH="$LOG_DIR/api-health.json"
HTTP="$(curl -sSL -o "$API_HEALTH" -w '%{http_code}' https://api.intaprd.com/api/health)"
[[ "$HTTP" == "200" ]] && grep -Eq '"ok"[[:space:]]*:[[:space:]]*true' "$API_HEALTH" || fail "Health API falló; NO publicar App. Revisar Worker y recuperación."
for endpoint in /api/v1/me/intapcard/accounts /api/v1/me/home-route; do
  http="$(curl -sSL -o /dev/null -w '%{http_code}' "https://app.intaprd.com$endpoint")"
  [[ "$http" == "401" ]] || fail "El endpoint $endpoint no protegió sesión: HTTP $http"
done
http="$(curl -sSL -o /dev/null -w '%{http_code}' -X POST 'https://app.intaprd.com/api/v1/me/intapcard/medical-context' -H 'Content-Type: application/json' --data '{"profile_id":"00000000-0000-0000-0000-000000000000"}')"
[[ "$http" == "401" ]] || fail "El cambio de contexto médico no exigió sesión: HTTP $http"

echo "▶ Publicando Web pública Producción en su proyecto propietario intap-link (rama main)"
npx wrangler pages deploy web/dist --project-name intap-link --branch main 2>&1 | tee "$LOG_DIR/web-deploy.log"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$LOG_DIR/web-deploy.log" | tail -1 || true)"
[[ -n "$WEB_ORIGIN" ]] || fail "No se obtuvo el deployment inmutable de Web"

echo "▶ Publicando Admin App Producción en intap-web2 (rama main)"
npx wrangler pages deploy app/dist --project-name intap-web2 --branch main 2>&1 | tee "$LOG_DIR/app-deploy.log"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$LOG_DIR/app-deploy.log" | tail -1 || true)"
[[ -n "$APP_ORIGIN" ]] || fail "No se obtuvo el deployment inmutable de App"

# Verificar assets, no solo status 200 de una SPA que puede entregar bundle anterior.
verify_frontend(){
  local label="$1" origin="$2" url="$3" dist="$4" expected="" attempts=0
  expected="$(grep -Eo '/assets/[^" ]+\.js' "$dist/index.html" | head -1)"
  [[ -n "$expected" ]] || fail "No se encontró el bundle principal de $label"
  local output="$LOG_DIR/$label-home.html" status=""
  for attempts in 1 2 3 4 5 6 7 8 9 10 11 12; do
    status="$(curl -sSL --max-time 25 -H 'Accept: text/html' -o "$output" -w '%{http_code}' "$url" || true)"
    if [[ "$status" == "200" ]] && grep -Fq "$expected" "$output";then
      echo "✓ $label sirve el bundle aprobado $expected desde $url (intento $attempts)"
      # El asset es absoluto (/assets/...), no relativo al path /admin/... o /m/...
      local custom_root="${url#*://}"
      custom_root="${url%%/${custom_root#*/}}"
      # El URL del deployment inmutable y el dominio custom deben servir el mismo asset.
      curl -fsSL --max-time 25 "$origin$expected" -o "$LOG_DIR/$label-bundle-origin.js" || fail "El deployment inmutable $label no sirve $expected"
      curl -fsSL --max-time 25 "$custom_root$expected" -o "$LOG_DIR/$label-bundle-custom.js" || fail "El dominio $label no sirve $expected"
      cmp -s "$LOG_DIR/$label-bundle-origin.js" "$LOG_DIR/$label-bundle-custom.js" || fail "El bundle $label servido por el dominio custom difiere del deployment aprobado"
      return 0
    fi
    [[ "$attempts" == "12" ]] || sleep 5
  done
  fail "$label no sirve el bundle aprobado después de 12 intentos. HTTP $status; revisar $output y Cloudflare antes de cerrar release"
}
verify_frontend web "$WEB_ORIGIN" "https://intaprd.com/m/laboratorios-doctores-mallen-med" web/dist
verify_frontend app "$APP_ORIGIN" "https://app.intaprd.com/admin/accounts" app/dist

for url in https://intaprd.com/m/laboratorios-doctores-mallen-med https://app.intaprd.com/admin/login https://app.intaprd.com/admin/accounts https://app.intaprd.com/superadmin/kawmed https://app.intaprd.com/claim/kawmed; do
  http="$(curl -sSL -o /dev/null -w '%{http_code}' "$url")"
  [[ "$http" == "200" ]] || fail "$url respondió HTTP $http"
done
for endpoint in /api/v1/me/intapcard/active-account /api/v1/me/intapcard/accounts /api/v1/me/medical-profile;do
  code="$(curl -sSL -o /dev/null -w '%{http_code}' "https://app.intaprd.com$endpoint")"
  [[ "$code" == "401" ]] || fail "$endpoint no exige sesión: HTTP $code"
done

TAG="prod-sponsored-free-hotfix-$(date -u +%Y%m%dT%H%M%SZ)"
run git tag -a "$TAG" -m "Multicuenta + sponsored + Free hotfix production release"
run git push "$REMOTE" "$TAG"
echo "✓ DESPLIEGUE COMPLETADO: $(git rev-parse HEAD)"
echo "✓ Tag: $TAG"
echo "✓ Logs y respaldo D1: $LOG_DIR"
echo "✓ Hotfix multicuenta/sponsored/Free publicado; migraciones D1 no modificadas"
echo "QA POST-RELEASE OBLIGATORIO: login, selector, Free, 2 sponsors, master, médicos y agenda."
