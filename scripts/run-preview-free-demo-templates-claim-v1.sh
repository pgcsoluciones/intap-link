#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
REMOTE="github"
BRANCH="feature/free-demo-templates-claim-v1"
EXPECTED_MAIN_SHA="3bfb091146d7f8018ccf214afec4adb9245d8597"
APP_PROJECT="intap-web2"
PREVIEW_DB="intap_db_preview"
PREVIEW_CFG="$ROOT/api/wrangler.preview.toml"
PREVIEW_CFG_BAK="$ROOT/api/wrangler.preview.toml.free-demo.bak"
LOG_DIR="$ROOT/.preview-free-demo-templates-claim-v1"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" "$PREVIEW_CFG_BAK"
mkdir -p "$LOG_DIR"

cat <<'EOF'
================================================================
KAWVO LINK · FREE DEMO TEMPLATES + CLAIM V1 · PREVIEW
================================================================
Alcance:
- NO mezcla Free con Trial.
- NO cambia límites de perfiles/correos normales.
- excepción exacta: intapcard@gmail.com
- cada Demo Free usa un owner interno independiente
- SuperAdmin crea plantillas por rubro y genera Demos
- Demos usan interfaz Free actual
- incluye Horario + Cotizar + Agenda
- flujo Borrador → Publicado → Reclamo
- claim = correo especial + slug + código de un solo uso
- primer acceso de claim exige correo y contraseña definitivos
- al reclamar se desvincula de Demo y pasa a Free independiente
- D1 SOLO Preview
- NO toca Producción, R2 ni Web público
================================================================
EOF

run git fetch "$REMOTE" main "$BRANCH"
CURRENT_MAIN="$(git rev-parse "$REMOTE/main")"
[ "$CURRENT_MAIN" = "$EXPECTED_MAIN_SHA" ] || fail "main cambió: esperado $EXPECTED_MAIN_SHA, actual $CURRENT_MAIN. Detener y auditar."

run git switch "$BRANCH"
run git pull --ff-only "$REMOTE" "$BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Árbol local no limpio"; }
git merge-base --is-ancestor "$REMOTE/main" HEAD || fail "main y feature divergieron"

cat > "$LOG_DIR/allowed.txt" <<'EOF_ALLOWED'
api/migrations-preview/0085_free_demo_templates_claim.sql
api/migrations/0085_free_demo_templates_claim.sql
api/src/free-demo-core.ts
api/src/free-demo-routes.ts
api/src/preview-free-entry.ts
api/src/scan-to-claim.ts
app/src/App.tsx
app/src/components/admin/AdminGuard.tsx
app/src/components/admin/AdminLogin.tsx
app/src/components/admin/FreeDemoClaim.tsx
app/src/components/admin/SuperAdminFreeDemos.tsx
app/src/components/admin/SuperAdminLayout.tsx
app/src/components/admin/free/FreeDemoManager.tsx
app/src/components/admin/free/onboarding/FreeArtifactActivation.tsx
scripts/run-preview-free-demo-templates-claim-v1.sh
scripts/test-free-demo-templates-claim-v1.mjs
EOF_ALLOWED

git diff --name-only "$REMOTE/main"...HEAD | sort > "$LOG_DIR/actual.txt"
sort "$LOG_DIR/allowed.txt" > "$LOG_DIR/allowed.sorted.txt"
diff -u "$LOG_DIR/allowed.sorted.txt" "$LOG_DIR/actual.txt" || fail "Hay archivos fuera del alcance aprobado"

run git diff --check "$REMOTE/main"...HEAD
run npm ci
run node scripts/test-free-demo-templates-claim-v1.mjs
run npm run build:preview -w app
run bash -lc 'cd api && npx tsc --noEmit'

echo; echo "▶ Confirmar D1 Preview antes de migrar"
TABLE_CHECK="$(cd api && npx wrangler d1 execute "$PREVIEW_DB" --remote --config wrangler.preview.toml --command "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('free_demo_templates','free_demo_profiles','free_demo_claims','free_demo_claim_sessions') ORDER BY name;" 2>/dev/null || true)"
printf '%s
' "$TABLE_CHECK"

if ! echo "$TABLE_CHECK" | grep -Fq "free_demo_templates"; then
  echo; echo "▶ Aplicar migraciones pendientes SOLO en D1 Preview"
  (cd api && npx wrangler d1 migrations apply "$PREVIEW_DB" --remote --config wrangler.preview.toml) 2>&1 | tee "$LOG_DIR/d1-migrations.log"
fi

echo; echo "▶ Verificar tablas nuevas en Preview"
TABLES="$(cd api && npx wrangler d1 execute "$PREVIEW_DB" --remote --config wrangler.preview.toml --command "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('free_demo_templates','free_demo_profiles','free_demo_claims','free_demo_claim_sessions') ORDER BY name;" 2>/dev/null || true)"
for table in free_demo_templates free_demo_profiles free_demo_claims free_demo_claim_sessions; do
  echo "$TABLES" | grep -Fq "$table" || fail "Falta tabla Preview $table"
done
echo "✓ D1 Preview listo"

echo; echo "▶ Guardia: Trial sigue aislado"
TRIAL_TABLES="$(cd api && npx wrangler d1 execute "$PREVIEW_DB" --remote --config wrangler.preview.toml --command "SELECT name FROM sqlite_master WHERE type='table' AND name='trial_profiles';" 2>/dev/null || true)"
echo "$TRIAL_TABLES" | grep -Fq "trial_profiles" || fail "La tabla Trial histórica no está disponible para comprobar aislamiento"
grep -Eq "trial_profiles|trial_leads|/trial/" api/src/free-demo-core.ts api/src/free-demo-routes.ts && fail "Free Demo contiene dependencia Trial"
echo "✓ Free Demo no depende de Trial"

echo; echo "▶ Deploy App Preview"
(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch "$BRANCH") 2>&1 | tee "$LOG_DIR/app.log"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$LOG_DIR/app.log" | tail -1 || true)"
[ -n "$APP_ORIGIN" ] || fail "No pude detectar App Preview origin"

cp "$PREVIEW_CFG" "$PREVIEW_CFG_BAK"
restore_cfg(){
  if [ -f "$PREVIEW_CFG_BAK" ]; then
    cp "$PREVIEW_CFG_BAK" "$PREVIEW_CFG" 2>/dev/null || true
    rm -f "$PREVIEW_CFG_BAK"
  fi
}
trap restore_cfg EXIT

python3 - "$PREVIEW_CFG" "$APP_ORIGIN" <<'PY'
from pathlib import Path
import re,sys
p=Path(sys.argv[1]); app=sys.argv[2]
s=p.read_text()
s,n=re.subn(r'APP_PAGES_ORIGIN\s*=\s*"[^"]+"',f'APP_PAGES_ORIGIN = "{app}"',s,count=1)
if n != 1: raise SystemExit("No pude fijar APP_PAGES_ORIGIN Preview")
p.write_text(s)
PY

echo; echo "▶ Deploy Worker Preview"
(
  cd api
  npx wrangler deploy --config wrangler.preview.toml --dry-run
  npx wrangler deploy --config wrangler.preview.toml
) 2>&1 | tee "$LOG_DIR/worker.log"

restore_cfg
trap - EXIT
sleep 5

echo; echo "▶ Smoke HTTP Preview"
for url in   "https://app.preview.intaprd.com/admin/login"   "https://app.preview.intaprd.com/superadmin/free-demos"   "https://app.preview.intaprd.com/admin/free/demos"   "https://app.preview.intaprd.com/claim/free-demo"
do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

echo; echo "▶ Guardas de DB: tablas normales NO alteradas"
PROFILE_SQL="$(cd api && npx wrangler d1 execute "$PREVIEW_DB" --remote --config wrangler.preview.toml --command "SELECT sql FROM sqlite_master WHERE type='table' AND name='profiles';" 2>/dev/null || true)"
echo "$PROFILE_SQL" | grep -Fq "profiles" || fail "No pude verificar tabla profiles"
echo "✓ profiles sigue siendo la tabla canónica Free"

rm -rf "$LOG_DIR"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Runner dejó cambios locales"; }

cat <<EOF
================================================================
✓ FREE DEMO TEMPLATES + CLAIM V1 · PREVIEW LISTO
================================================================
Feature SHA: $(git rev-parse HEAD)
App origin:  $APP_ORIGIN

QA MANUAL:
1. SuperAdmin → Plantillas Demo Free.
2. Crear plantilla, por ejemplo:
   - Nombre: Demo Ferretería
   - Rubro: Ferretería
   - Correo plantilla: ferreteria-demo@kawvo.local
   - Preset: Ferretería
   - marcar como predeterminada.
3. Generar Demo con slug propio.
4. Confirmar que nace en Borrador.
5. Abrir perfil: debe usar interfaz Free actual.
6. Confirmar Horario, Cotizar / información y Agendar.
7. Publicar desde SuperAdmin.
8. Generar código de reclamo.
9. En login usar:
   Correo: intapcard@gmail.com
   Contraseña: código de reclamo.
10. Debe abrir SOLO la pantalla de credenciales del slug reclamado.
11. Colocar correo definitivo nuevo + contraseña nueva.
12. Debe entrar como dueño del perfil Free independiente.
13. El código anterior ya NO debe volver a funcionar.
14. El perfil reclamado debe desaparecer de Mis perfiles Demo Free.
15. Probar una cuenta normal: debe seguir limitada a su único perfil normal.
16. Confirmar que Trial no cambió.
17. Producción NO fue tocada.
================================================================
EOF
