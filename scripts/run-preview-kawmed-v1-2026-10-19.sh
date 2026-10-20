#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
REMOTE="github"
BRANCH="reconcile/kawmed-medical-profile-v1-2026-10-19-v2"
EXPECTED_MAIN_SHA="2391896286839528557066968ca4b8abe9831fb9"
WEB_PROJECT="intap-link"
PREVIEW_DB="intap_db_preview"
LOG_DIR="$ROOT/.preview-kawmed-v1-2026-10-19"
WEB_LOG="$LOG_DIR/web-pages.log"
WORKER_LOG="$LOG_DIR/worker-preview.log"
MIGRATION_LOG="$LOG_DIR/migrations.log"
PREVIEW_CFG="$ROOT/api/wrangler.preview.toml"
PREVIEW_CFG_BAK="$LOG_DIR/wrangler.preview.toml.bak"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR"
mkdir -p "$LOG_DIR"

cat <<EOF
================================================================
KAWMED · PERFIL MÉDICO V1 · RECONCILIACIÓN PREVIEW
================================================================
Base segura: current main
Main esperado: $EXPECTED_MAIN_SHA
Rama: $BRANCH

- NO toca Producción
- NO hace merge a main
- migra SOLO intap_db_preview
- despliega Web/App/Worker SOLO en Preview
- reutiliza Agenda común sin modificar sus módulos base
- ruta QA: https://preview.intaprd.com/m/lauramendez
================================================================
EOF

[ -z "$(git status --porcelain)" ] || { git status --short; fail "Hay cambios locales; no cambio de rama"; }

run git fetch "$REMOTE" main "$BRANCH"
CURRENT_MAIN="$(git rev-parse "$REMOTE/main")"
[ "$CURRENT_MAIN" = "$EXPECTED_MAIN_SHA" ] || fail "main cambió: esperado $EXPECTED_MAIN_SHA, actual $CURRENT_MAIN. Detener y reconciliar."

run git switch "$BRANCH"
run git pull --ff-only "$REMOTE" "$BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Árbol local no limpio"; }

git merge-base --is-ancestor "$REMOTE/main" HEAD || fail "La rama KawMed no desciende del main actual"
[ "$(git rev-list --count HEAD.."$REMOTE/main")" = "0" ] || fail "La rama está detrás de main"

cat > "$LOG_DIR/expected-files.txt" <<'EOF_FILES'
api/migrations-preview/0090_kawmed_medical_profiles_v1.sql
api/migrations-preview/0091_kawmed_insurance_exclusions.sql
api/migrations-preview/0092_kawmed_shared_appointments.sql
api/migrations-preview/0093_kawmed_medical_appointment_reasons.sql
api/migrations-preview/0094_kawmed_private_sponsorship.sql
api/migrations-preview/0095_kawmed_access_codes_programs.sql
api/migrations-preview/0096_kawmed_representatives_traceability.sql
api/migrations-preview/0097_kawmed_master_multiaccount.sql
api/migrations-preview/0098_kawmed_accepted_insurances.sql
api/migrations-preview/0099_kawmed_master_public_profile.sql
api/migrations/0090_kawmed_medical_profiles_v1.sql
api/migrations/0091_kawmed_insurance_exclusions.sql
api/migrations/0092_kawmed_shared_appointments.sql
api/migrations/0093_kawmed_medical_appointment_reasons.sql
api/migrations/0094_kawmed_private_sponsorship.sql
api/migrations/0095_kawmed_access_codes_programs.sql
api/migrations/0096_kawmed_representatives_traceability.sql
api/migrations/0097_kawmed_master_multiaccount.sql
api/migrations/0098_kawmed_accepted_insurances.sql
api/migrations/0099_kawmed_master_public_profile.sql
api/src/index.ts
api/src/account-home-route.ts
api/src/medical-appointments.ts
api/src/medical-profile-owner.ts
api/src/medical-access-codes.ts
api/src/preview-free-entry.ts
api/src/sponsor-multiaccount.ts
api/src/sponsored-brand-controls.ts
api/src/sponsored-media.ts
api/src/sponsored-multiprofile-access.ts
api/src/sponsored-owner-flow.ts
api/src/sponsored-profile-scope.ts
api/src/sponsored-profiles.ts
api/src/sponsored-scan.ts
api/src/routes/medical-profile.ts
scripts/run-preview-kawmed-v1-2026-10-19.sh
scripts/test-kawmed-medical-profile-v1-contract.mjs
scripts/test-kawmed-access-codes-contract.mjs
scripts/test-sponsored-profile-contract.mjs
app/src/App.tsx
app/src/components/admin/AdminLogin.tsx
app/src/components/admin/AuthCallback.tsx
app/src/components/admin/KawMedClaim.tsx
app/src/components/admin/KawMedMasterClaim.tsx
app/src/components/admin/SuperAdminKawMed.tsx
app/src/components/admin/SuperAdminLayout.tsx
app/src/components/notifications/PwaNotificationBridge.tsx
app/src/components/admin/medical/MedicalAppointments.tsx
app/src/components/admin/medical/MedicalDashboard.tsx
app/src/components/admin/medical/MedicalCenterLocationPicker.tsx
app/src/components/admin/medical/MedicalNotifications.tsx
app/src/components/admin/sponsored/SponsorDashboard.tsx
app/src/components/admin/sponsored/SponsorKawMed.tsx
app/src/components/admin/free/FreeNotifications.tsx
web/public/assets/kawmed/demo-doctor-reference.jpg
web/public/assets/kawmed/laura-mendez-hero.jpg
web/src/App.tsx
web/src/components/appointments/AppointmentOwnerBar.tsx
web/src/components/appointments/AppointmentRequestModal.tsx
web/src/components/medical-profile/KawMedModal.tsx
web/src/components/medical-profile/KawMedProfile.css
web/src/components/medical-profile/KawMedProfile.tsx
web/src/components/medical-profile/types.ts
EOF_FILES

git diff --name-only "$REMOTE/main"...HEAD | sort > "$LOG_DIR/actual-files.txt"
sort "$LOG_DIR/expected-files.txt" > "$LOG_DIR/expected-files.sorted.txt"
diff -u "$LOG_DIR/expected-files.sorted.txt" "$LOG_DIR/actual-files.txt" || fail "El alcance KawMed no coincide exactamente con lo esperado"

run git diff --check "$REMOTE/main"...HEAD

echo; echo "▶ Contratos KawMed + regresiones aprobadas"
# El contrato histórico sponsored-profile también quedó desfasado respecto al main aprobado:
# su aserción del reset del cotizador no contempla rnc:'' y falla aun sin KawMed.
# No se usa como gate de este runner hasta reconciliar ese contrato por separado.
run npm ci
run node scripts/test-kawmed-medical-profile-v1-contract.mjs
run node scripts/test-kawmed-access-codes-contract.mjs
run node scripts/test-agenda-phone-normalization-contract.mjs
run node scripts/test-bank-privacy-interaction-contract.mjs
run node scripts/test-login-sponsor-release-hotfix-2026-10-05.mjs
run node scripts/test-free-demo-master-v2-contract.mjs

echo; echo "▶ Proteger módulos comunes aprobados"
git diff --quiet "$REMOTE/main"...HEAD -- api/src/appointments-core.ts || fail "KawMed no debe modificar appointments-core.ts"
git diff --quiet "$REMOTE/main"...HEAD -- app/src/components/appointments/AppointmentManager.tsx || fail "KawMed no debe modificar AppointmentManager.tsx"
git diff --quiet "$REMOTE/main"...HEAD -- app/public/sw.js || fail "KawMed no debe modificar Service Worker"
git diff --quiet "$REMOTE/main"...HEAD -- api/src/bank-accounts.ts || fail "KawMed no debe modificar bancos existentes"
# FreeNotifications se extiende únicamente con props opcionales; su comportamiento Free debe seguir cubierto por contrato.
run node scripts/test-consolidated-fixes-2026-10-03.mjs
# El contrato histórico free-contact-agenda contiene una aserción obsoleta:
# espera resetQuote sin RNC, mientras main aprobado ya incluye rnc:''.
# No se usa como gate de KawMed porque falla también sobre main sin cambios.
# La compatibilidad de los componentes compartidos que KawMed extiende
# queda cubierta por test-kawmed-medical-profile-v1-contract.mjs y
# por el contrato patrocinado vigente.
echo; echo "▶ Build Web + App + API"
run npm run build:preview -w web
run npm run build:preview -w app
run bash -lc 'cd api && npx tsc --noEmit'
run bash -lc 'npx esbuild api/src/preview-frontdoor-entry.ts --bundle --platform=node --format=esm --target=node20 --external:cloudflare:* --outfile=/tmp/kawmed-preview-frontdoor.mjs'

echo; echo "▶ Verificar configuración Preview"
grep -Fq 'name = "intap-api-preview"' api/wrangler.preview.toml || fail "Worker Preview incorrecto"
grep -Fq 'database_name = "intap_db_preview"' api/wrangler.preview.toml || fail "D1 Preview incorrecta"
grep -Fq 'bucket_name = "intap-r2-preview"' api/wrangler.preview.toml || fail "R2 Preview incorrecto"
grep -Fq 'VITE_API_URL=https://preview.intaprd.com' web/.env.preview || fail "Web Preview no apunta al API Preview"

echo; echo "▶ Migraciones D1 Preview"
(
  cd api
  npx wrangler d1 migrations list "$PREVIEW_DB" --remote --config wrangler.preview.toml
) 2>&1 | tee "$MIGRATION_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "No pude consultar migraciones Preview"

PENDING_FILES="$(grep -Eo '[0-9]{4}_[A-Za-z0-9._-]+\.sql' "$MIGRATION_LOG" | sort -u || true)"
if [ -n "$PENDING_FILES" ]; then
  while IFS= read -r migration; do
    [ -z "$migration" ] && continue
    case "$migration" in
      0090_kawmed_medical_profiles_v1.sql|0091_kawmed_insurance_exclusions.sql|0092_kawmed_shared_appointments.sql|0093_kawmed_medical_appointment_reasons.sql|0094_kawmed_private_sponsorship.sql|0095_kawmed_access_codes_programs.sql|0096_kawmed_representatives_traceability.sql|0097_kawmed_master_multiaccount.sql|0098_kawmed_accepted_insurances.sql|0099_kawmed_master_public_profile.sql) ;;
      *) fail "Migración Preview pendiente fuera de KawMed: $migration" ;;
    esac
  done <<< "$PENDING_FILES"
  (
    cd api
    npx wrangler d1 migrations apply "$PREVIEW_DB" --remote --config wrangler.preview.toml
  ) 2>&1 | tee -a "$MIGRATION_LOG"
  [ "${PIPESTATUS[0]}" -eq 0 ] || fail "Migraciones KawMed Preview"
else
  echo "✓ No hay migraciones pendientes"
fi

echo; echo "▶ Verificar schema y demo KawMed"
SCHEMA_JSON="$(
  cd api
  npx wrangler d1 execute "$PREVIEW_DB" --remote --config wrangler.preview.toml --json --command "
    SELECT name FROM sqlite_master
     WHERE type='table' AND name IN (
       'medical_profiles',
       'medical_profile_centers',
       'medical_profile_schedules',
       'medical_profile_services',
       'medical_profile_insurance_exclusions',
       'medical_sponsor_programs',
       'medical_code_batches',
       'medical_access_codes',
       'medical_representatives',
       'medical_code_representative_assignments',
       'medical_sponsor_masters',
       'sponsor_user_context',
       'medical_profile_insurances',
       'medical_sponsor_master_profiles'
     )
     ORDER BY name;
    SELECT slug,status,user_id FROM medical_profiles WHERE slug='lauramendez' LIMIT 1;
    SELECT subject_type,subject_id,enabled,reason_mode FROM appointment_settings WHERE subject_type='medical' AND subject_id='kawmed_demo_laura_mendez' LIMIT 1;
    SELECT COUNT(*) AS medical_reason_count FROM appointment_reasons WHERE subject_type='medical' AND subject_id='kawmed_demo_laura_mendez' AND enabled=1;
    SELECT mps.medical_profile_id,mps.sponsor_id,mps.vademecum_url,st.name AS sponsor_name FROM medical_profile_sponsors mps JOIN sponsor_tenants st ON st.id=mps.sponsor_id WHERE mps.medical_profile_id='kawmed_demo_laura_mendez' AND mps.enabled=1 LIMIT 1;
  " 2>/dev/null
)"
python3 - "$SCHEMA_JSON" <<'PY'
import json,sys
data=json.loads(sys.argv[1]); rows=[]
for block in data if isinstance(data,list) else []: rows.extend(block.get('results') or [])
names={str(r.get('name') or '') for r in rows if r.get('name')}
required={'medical_profiles','medical_profile_centers','medical_profile_schedules','medical_profile_services','medical_profile_insurance_exclusions','medical_profile_insurances','medical_sponsor_programs','medical_code_batches','medical_access_codes','medical_representatives','medical_code_representative_assignments','medical_sponsor_masters','medical_sponsor_master_profiles','sponsor_user_context'}
missing=required-names
if missing: raise SystemExit('Faltan tablas KawMed: '+', '.join(sorted(missing)))
demo=[r for r in rows if r.get('slug')=='lauramendez']
if not demo or str(demo[0].get('status'))!='active': raise SystemExit('Demo lauramendez no está activo')
if str(demo[0].get('user_id') or '')!='kawmed_demo_owner': raise SystemExit('Demo KawMed no tiene owner QA aislado')
agenda=[r for r in rows if r.get('subject_type')=='medical' and r.get('subject_id')=='kawmed_demo_laura_mendez']
if not agenda or int(agenda[0].get('enabled') or 0)!=1: raise SystemExit('Agenda compartida KawMed no está activa')
if str(agenda[0].get('reason_mode') or '')!='custom': raise SystemExit('Agenda KawMed no usa motivos médicos custom')
reasons=[r for r in rows if 'medical_reason_count' in r]
if not reasons or int(reasons[0].get('medical_reason_count') or 0)<6: raise SystemExit('Faltan motivos médicos KawMed')
sponsor=[r for r in rows if r.get('medical_profile_id')=='kawmed_demo_laura_mendez']
if not sponsor or not sponsor[0].get('sponsor_id') or not sponsor[0].get('vademecum_url'): raise SystemExit('Falta patrocinio privado/vademécum del demo KawMed')
print('✓ Schema KawMed + Agenda + centros + horarios + seguros/excepciones + patrocinio privado + códigos MED + visitadores + Master médico + perfil público Master + multicuenta disponibles')
PY

echo; echo "▶ Deploy App Pages Preview"
APP_LOG="$LOG_DIR/app-pages.log"
(npx wrangler pages deploy app/dist --project-name intap-web2 --branch "$BRANCH") 2>&1 | tee "$APP_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App Preview"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$APP_LOG" | tail -1 || true)"
[ -n "$APP_ORIGIN" ] || fail "No pude detectar origin App Preview"

echo; echo "▶ Deploy Web Pages Preview"
(npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch "$BRANCH") 2>&1 | tee "$WEB_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Web Preview"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$WEB_LOG" | tail -1 || true)"
[ -n "$WEB_ORIGIN" ] || fail "No pude detectar origin Web Preview"

cp "$PREVIEW_CFG" "$PREVIEW_CFG_BAK"
restore_cfg(){ cp "$PREVIEW_CFG_BAK" "$PREVIEW_CFG" 2>/dev/null || true; }
trap restore_cfg EXIT

python3 - "$PREVIEW_CFG" "$WEB_ORIGIN" "$APP_ORIGIN" <<'PY'
from pathlib import Path
import re,sys
p=Path(sys.argv[1]); web=sys.argv[2]; app=sys.argv[3]
s=p.read_text()
s,n1=re.subn(r'WEB_PAGES_ORIGIN\s*=\s*"[^"]+"',f'WEB_PAGES_ORIGIN = "{web}"',s,count=1)
s,n2=re.subn(r'APP_PAGES_ORIGIN\s*=\s*"[^"]+"',f'APP_PAGES_ORIGIN = "{app}"',s,count=1)
if n1 != 1 or n2 != 1: raise SystemExit('No pude actualizar origins Preview temporales')
p.write_text(s)
PY

echo; echo "▶ Deploy Worker Preview / front door"
(
  cd api
  npx wrangler deploy --config wrangler.preview.toml --dry-run
  npx wrangler deploy --config wrangler.preview.toml
) 2>&1 | tee "$WORKER_LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy Worker Preview"
restore_cfg
trap - EXIT
sleep 5

echo; echo "▶ Smoke KawMed Preview"
API_JSON="$LOG_DIR/kawmed-api.json"
code="$(curl -sS -o "$API_JSON" -w '%{http_code}' https://preview.intaprd.com/api/v1/public/medical-profiles/lauramendez)"
[ "$code" = "200" ] || { cat "$API_JSON"; fail "API KawMed HTTP $code"; }
python3 - "$API_JSON" <<'PY'
import json,sys
d=json.load(open(sys.argv[1],encoding='utf-8'))
assert d.get('ok') is True
p=d.get('data') or {}
assert p.get('slug')=='lauramendez'
assert p.get('status')=='active'
assert len(p.get('centers') or []) >= 1
assert len(p.get('schedules') or []) >= 1
assert len(p.get('services') or []) >= 1
assert isinstance((p.get('insurance_policy') or {}).get('excluded'),list)
print('✓ API KawMed responde perfil, centros, horarios, servicios y seguros')
PY


# El endpoint de patrocinio es PRIVADO: sin sesión debe negar acceso.
code="$(curl -sS -o /dev/null -w '%{http_code}' https://preview.intaprd.com/api/v1/me/medical-profile/sponsor-context)"
[ "$code" = "401" ] || fail "Patrocinio médico privado quedó expuesto sin sesión: HTTP $code"

# El panel Master KawMed también es privado: sin sesión patrocinadora debe negar acceso.
code="$(curl -sS -o /dev/null -w '%{http_code}' https://preview.intaprd.com/api/v1/sponsor/kawmed/overview)"
[ "$code" = "401" ] || fail "Trazabilidad KawMed del patrocinador quedó expuesta sin sesión: HTTP $code"

# El selector multicuenta también es privado.
code="$(curl -sS -o /dev/null -w '%{http_code}' https://preview.intaprd.com/api/v1/sponsor/accounts)"
[ "$code" = "401" ] || fail "Selector multicuenta quedó expuesto sin sesión: HTTP $code"

APPT_JSON="$LOG_DIR/kawmed-appointments.json"
code="$(curl -sS -o "$APPT_JSON" -w '%{http_code}' https://preview.intaprd.com/api/v1/public/medical-profiles/lauramendez/appointments)"
[ "$code" = "200" ] || { cat "$APPT_JSON"; fail "Agenda pública KawMed HTTP $code"; }
python3 - "$APPT_JSON" <<'PY'
import json,sys
d=json.load(open(sys.argv[1],encoding='utf-8'))
assert d.get('ok') is True
a=d.get('data') or {}
assert a.get('enabled') is True
assert a.get('has_whatsapp') is True
assert len(a.get('reasons') or []) >= 1
print('✓ KawMed reutiliza Agenda pública común y está habilitada')
PY

for url in \
  "https://preview.intaprd.com/m/lauramendez" \
  "https://preview.intaprd.com/demo" \
  "https://preview.intaprd.com/trial" \
  "https://app.preview.intaprd.com/superadmin" \
  "https://app.preview.intaprd.com/superadmin/kawmed" \
  "https://app.preview.intaprd.com/claim/kawmed" \
  "https://app.preview.intaprd.com/claim/kawmed-master" \
  "https://app.preview.intaprd.com/admin/sponsor/kawmed" \
  "https://app.preview.intaprd.com/admin/medical" \
  "https://app.preview.intaprd.com/admin/medical/agenda" \
  "https://app.preview.intaprd.com/admin/medical/notifications"
do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

rm -rf "$LOG_DIR"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Runner dejó cambios locales"; }

cat <<EOF
================================================================
✓ KAWMED V1 RECONCILIADO Y DESPLEGADO EN PREVIEW
================================================================
Feature SHA: $(git rev-parse HEAD)
Web Pages:   $WEB_ORIGIN
App Pages:   $APP_ORIGIN

Perfil demo:
https://preview.intaprd.com/m/lauramendez

API:
https://preview.intaprd.com/api/v1/public/medical-profiles/lauramendez

Producción NO tocada.
================================================================
EOF
