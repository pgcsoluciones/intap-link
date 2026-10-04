#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
REMOTE="github"
BRANCH="feature/free-demo-master-v2"
EXPECTED_MAIN_SHA="3bfb091146d7f8018ccf214afec4adb9245d8597"
PREVIEW_DB="intap_db_preview"
WEB_PROJECT="intap-link"
APP_PROJECT="intap-web2"
CFG="$ROOT/api/wrangler.preview.toml"
CFG_BAK="$ROOT/api/wrangler.preview.toml.free-demo-v2.bak"
LOG="$ROOT/.free-demo-v2-preview"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }
d1(){ (cd "$ROOT/api" && npx wrangler d1 execute "$PREVIEW_DB" --remote --config wrangler.preview.toml --command "$1"); }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG" "$CFG_BAK"; mkdir -p "$LOG"

cat <<'EOF'
================================================================
KAWVO LINK · FREE DEMO MASTER V2 · FORENSIC PREVIEW
================================================================
Arquitectura:
- SuperAdmin selecciona una plantilla base por rubro.
- La base usa Free Starter existente: texto + banco gráfico + paleta.
- Se crea un perfil Free canónico en borrador con owner interno aislado.
- El editor usa sesión SuperAdmin; NUNCA cambia a la sesión del owner interno.
- URL de edición: /free-demo/edit/:id
- Sin módulo Servicios.
- Límites reales: portafolio 10, botones 3, enlaces 3.
- Horario + Cotizar + Agenda usan el núcleo Free real.
- Primera publicación fija nombre + slug.
- Reclamo final = intapcard@gmail.com + slug + código de un solo uso.
- No toca Trial ni Perfil Patrocinado.
- D1 y R2 SOLO Preview.
- Producción NO se toca.
================================================================
EOF

run git fetch "$REMOTE" main "$BRANCH"
CURRENT_MAIN="$(git rev-parse "$REMOTE/main")"
[ "$CURRENT_MAIN" = "$EXPECTED_MAIN_SHA" ] || fail "main cambió: $CURRENT_MAIN. Detener y reauditar."
run git switch "$BRANCH"
run git pull --ff-only "$REMOTE" "$BRANCH"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Árbol local no limpio"; }
git merge-base --is-ancestor "$REMOTE/main" HEAD || fail "La rama no desciende de main"

cat > "$LOG/allowed.txt" <<'EOF_ALLOWED'
api/migrations-preview/0088_free_demo_master_v2.sql
api/migrations/0088_free_demo_master_v2.sql
api/src/free-demo-claim-core.ts
api/src/free-demo-v2.ts
api/src/index.ts
api/src/preview-free-entry.ts
app/src/App.tsx
app/src/components/admin/AdminLogin.tsx
app/src/components/admin/AuthCallback.tsx
app/src/components/admin/FreeDemoV2Claim.tsx
app/src/components/admin/SuperAdminFreeDemoV2.tsx
app/src/components/admin/SuperAdminLayout.tsx
scripts/run-preview-free-demo-master-v2.sh
scripts/test-free-demo-master-v2-contract.mjs
web/src/App.tsx
web/src/components/free-demo/FreeDemoEditor.css
web/src/components/free-demo/FreeDemoEditor.tsx
EOF_ALLOWED
git diff --name-only "$REMOTE/main"...HEAD | sort > "$LOG/actual.txt"
sort "$LOG/allowed.txt" > "$LOG/allowed.sorted.txt"
diff -u "$LOG/allowed.sorted.txt" "$LOG/actual.txt" || fail "Hay archivos fuera del alcance v2"

run git diff --check "$REMOTE/main"...HEAD
run npm ci

echo; echo "▶ Contratos nuevos y protegidos"
run node scripts/test-free-demo-master-v2-contract.mjs
run node scripts/test-trial-contract.mjs
run node scripts/test-sponsored-profile-contract.mjs
run node scripts/test-free-contact-agenda-contract.mjs
run node scripts/test-ai-profile-canonical-limits.mjs

echo; echo "▶ Builds y TypeScript"
run npm run build:preview -w web
run npm run build:preview -w app
run bash -lc 'cd api && npx tsc --noEmit'
run bash -lc 'npx esbuild api/src/preview-frontdoor-entry.ts --bundle --platform=node --format=esm --target=node20 --external:cloudflare:* --outfile=/tmp/kawvo-free-demo-v2-preview-api.mjs'

echo; echo "▶ Migración SOLO D1 Preview"
(cd api && npx wrangler d1 migrations apply "$PREVIEW_DB" --remote --config wrangler.preview.toml) 2>&1 | tee "$LOG/migrations.log"

echo; echo "▶ Verificar schema v2 + contrato Free normal"
SCHEMA="$(d1 "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('free_demo_v2_profiles','free_demo_v2_claims') ORDER BY name; SELECT name,sql FROM sqlite_master WHERE type='index' AND name='idx_profiles_user_unique';")"
printf '%s\n' "$SCHEMA" | tee "$LOG/schema.log"
echo "$SCHEMA" | grep -Fq "free_demo_v2_profiles" || fail "Falta free_demo_v2_profiles"
echo "$SCHEMA" | grep -Fq "free_demo_v2_claims" || fail "Falta free_demo_v2_claims"
echo "$SCHEMA" | grep -Fq "idx_profiles_user_unique" || fail "Se perdió unique user normal Free"

echo; echo "▶ Deploy Web Preview"
(npx wrangler pages deploy web/dist --project-name "$WEB_PROJECT" --branch "$BRANCH") 2>&1 | tee "$LOG/web.log"
WEB_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-link\.pages\.dev' "$LOG/web.log" | tail -1 || true)"
[ -n "$WEB_ORIGIN" ] || fail "No pude detectar Web origin"

echo; echo "▶ Deploy App Preview"
(npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch "$BRANCH") 2>&1 | tee "$LOG/app.log"
APP_ORIGIN="$(grep -Eo 'https://[0-9a-f]{8,}\.intap-web2\.pages\.dev' "$LOG/app.log" | tail -1 || true)"
[ -n "$APP_ORIGIN" ] || fail "No pude detectar App origin"

cp "$CFG" "$CFG_BAK"
restore_cfg(){
  if [ -f "$CFG_BAK" ]; then cp "$CFG_BAK" "$CFG" 2>/dev/null || true; rm -f "$CFG_BAK"; fi
}
trap restore_cfg EXIT
python3 - "$CFG" "$APP_ORIGIN" "$WEB_ORIGIN" <<'PY'
from pathlib import Path
import re,sys
p=Path(sys.argv[1]); app=sys.argv[2]; web=sys.argv[3]
s=p.read_text()
s,na=re.subn(r'APP_PAGES_ORIGIN\s*=\s*"[^"]+"',f'APP_PAGES_ORIGIN = "{app}"',s,count=1)
s,nw=re.subn(r'WEB_PAGES_ORIGIN\s*=\s*"[^"]+"',f'WEB_PAGES_ORIGIN = "{web}"',s,count=1)
if na!=1 or nw!=1: raise SystemExit("No pude fijar origins Preview")
p.write_text(s)
PY

echo; echo "▶ Deploy Worker Preview"
(cd api && npx wrangler deploy --config wrangler.preview.toml --dry-run && npx wrangler deploy --config wrangler.preview.toml) 2>&1 | tee "$LOG/worker.log"
restore_cfg; trap - EXIT
sleep 5

echo; echo "▶ Smoke de rutas"
for url in \
  "https://preview.intaprd.com/free-demo/edit/route-smoke" \
  "https://app.preview.intaprd.com/superadmin/free-demos" \
  "https://app.preview.intaprd.com/claim/free-demo"
do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> $code"
  [ "$code" = "200" ] || fail "$url respondió $code"
done
PROTECTED="$(curl -sS -o "$LOG/protected.json" -w '%{http_code}' https://app.preview.intaprd.com/api/v1/superadmin/free-demo-v2/templates)"
[ "$PROTECTED" = "401" ] || fail "La API v2 no está protegida correctamente: HTTP $PROTECTED"
echo "✓ API SuperAdmin v2 responde 401 sin sesión"

# ── E2E real sobre Preview ───────────────────────────────────────────────────
echo; echo "▶ E2E real: base → borrador → editor → publicación → claim → ownership"

STAMP="$(date +%s)"
QA_ADMIN_ID="qa-admin-v2-$STAMP"
QA_ADMIN_EMAIL="qa-free-demo-admin-$STAMP@example.invalid"
QA_RAW="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
QA_HASH="$(printf '%s' "$QA_RAW" | shasum -a 256 | awk '{print $1}')"
QA_SLUG="qa-free-demo-v2-$STAMP"
QA_OWNER_EMAIL="qa-free-demo-owner-$STAMP@example.invalid"
QA_DEMO_ID=""
QA_PROFILE_ID=""
QA_SYNTH_ID=""
QA_OWNER_ID=""
QA_COOKIE="intap_preview_session_id=$QA_RAW"
CLAIM_JAR="$LOG/claim.cookies"

cleanup_e2e(){
  set +e
  if [ -n "$QA_DEMO_ID" ]; then
    ROW="$(d1 "SELECT profile_id,synthetic_owner_user_id,claimed_by_user_id FROM free_demo_v2_profiles WHERE id='$QA_DEMO_ID' LIMIT 1;" 2>/dev/null || true)"
    QA_PROFILE_ID="$(printf '%s' "$ROW" | python3 -c "import sys,json,re; s=sys.stdin.read(); m=re.search(r'\"profile_id\"\\s*:\\s*\"([^\"]+)\"',s); print(m.group(1) if m else '')" 2>/dev/null)"
    QA_SYNTH_ID="$(printf '%s' "$ROW" | python3 -c "import sys,re; s=sys.stdin.read(); m=re.search(r'\"synthetic_owner_user_id\"\\s*:\\s*\"([^\"]+)\"',s); print(m.group(1) if m else '')" 2>/dev/null)"
    QA_OWNER_ID="$(printf '%s' "$ROW" | python3 -c "import sys,re; s=sys.stdin.read(); m=re.search(r'\"claimed_by_user_id\"\\s*:\\s*\"([^\"]+)\"',s); print(m.group(1) if m else '')" 2>/dev/null)"
  fi
  if [ -n "$QA_PROFILE_ID" ]; then
    d1 "DELETE FROM appointment_requests WHERE subject_type='free' AND subject_id='$QA_PROFILE_ID'; DELETE FROM appointment_blocks WHERE subject_type='free' AND subject_id='$QA_PROFILE_ID'; DELETE FROM appointment_reasons WHERE subject_type='free' AND subject_id='$QA_PROFILE_ID'; DELETE FROM appointment_availability WHERE subject_type='free' AND subject_id='$QA_PROFILE_ID'; DELETE FROM appointment_settings WHERE subject_type='free' AND subject_id='$QA_PROFILE_ID'; DELETE FROM admin_audit_log WHERE target_id='$QA_PROFILE_ID'; DELETE FROM free_demo_v2_claims WHERE demo_id='$QA_DEMO_ID'; DELETE FROM free_demo_v2_profiles WHERE id='$QA_DEMO_ID'; DELETE FROM profiles WHERE id='$QA_PROFILE_ID';" >/dev/null 2>&1 || true
  fi
  [ -n "$QA_OWNER_ID" ] && d1 "DELETE FROM auth_sessions WHERE user_id='$QA_OWNER_ID'; DELETE FROM user_auth_identities WHERE user_id='$QA_OWNER_ID'; DELETE FROM auth_identities WHERE user_id='$QA_OWNER_ID'; DELETE FROM user_password_credentials WHERE user_id='$QA_OWNER_ID'; DELETE FROM users WHERE id='$QA_OWNER_ID';" >/dev/null 2>&1 || true
  d1 "DELETE FROM auth_magic_links WHERE email='$QA_OWNER_EMAIL';" >/dev/null 2>&1 || true
  [ -n "$QA_SYNTH_ID" ] && d1 "DELETE FROM auth_sessions WHERE user_id='$QA_SYNTH_ID'; DELETE FROM users WHERE id='$QA_SYNTH_ID';" >/dev/null 2>&1 || true
  d1 "DELETE FROM admin_audit_log WHERE admin_user_id='$QA_ADMIN_ID'; DELETE FROM auth_sessions WHERE user_id='$QA_ADMIN_ID'; DELETE FROM admin_users WHERE user_id='$QA_ADMIN_ID'; DELETE FROM users WHERE id='$QA_ADMIN_ID';" >/dev/null 2>&1 || true
}
trap cleanup_e2e EXIT

d1 "INSERT INTO users(id,email) VALUES('$QA_ADMIN_ID','$QA_ADMIN_EMAIL'); INSERT INTO admin_users(user_id,role,notes) VALUES('$QA_ADMIN_ID','super_admin','Free Demo v2 automated Preview QA'); INSERT INTO auth_sessions(id,user_id,session_hash,expires_at,ip,user_agent,created_at) VALUES('qa-session-v2-$STAMP','$QA_ADMIN_ID','$QA_HASH',datetime('now','+2 hours'),'127.0.0.1','free-demo-v2-e2e',datetime('now'));" >/dev/null

curl -fsS -H "Cookie: $QA_COOKIE" https://app.preview.intaprd.com/api/v1/superadmin/free-demo-v2/templates > "$LOG/templates.json"
python3 - "$LOG/templates.json" <<'PY'
import json,sys
j=json.load(open(sys.argv[1]))
assert j["ok"] and any(x["key"]=="ferreteria" for x in j["data"])
f=next(x for x in j["data"] if x["key"]=="ferreteria")
assert f["hero_url"] and f["portfolio"] and f["bio"]
print("✓ Plantilla Ferretería trae texto + imágenes del Free Starter")
PY

curl -fsS -H "Cookie: $QA_COOKIE" -H 'Content-Type: application/json' \
  -d '{"template_key":"ferreteria"}' \
  https://app.preview.intaprd.com/api/v1/superadmin/free-demo-v2 > "$LOG/create.json"
QA_DEMO_ID="$(python3 - "$LOG/create.json" <<'PY'
import json,sys
j=json.load(open(sys.argv[1])); assert j["ok"] and j["data"]["status"]=="draft"; print(j["data"]["id"])
PY
)"
[ -n "$QA_DEMO_ID" ] || fail "No se creó Demo QA"
echo "✓ Borrador creado: $QA_DEMO_ID"

curl -fsS -H "Cookie: $QA_COOKIE" "https://app.preview.intaprd.com/api/v1/superadmin/free-demo-v2/$QA_DEMO_ID/editor" > "$LOG/editor.json"
python3 - "$LOG/editor.json" <<'PY'
import json,sys
j=json.load(open(sys.argv[1])); d=j["data"]
assert j["ok"] and d["status"]=="draft"
assert d["limits"]=={"portfolio":10,"quick_actions":3,"links":3,"services":0}
assert len(d["quick_actions"])<=3 and len(d["portfolio"])<=10 and d["experience"]["appointment_enabled"] is True
assert d["profile"]["is_published"] is False
print("✓ Editor: límites Free + Agenda + borrador no publicado")
PY

curl -fsS -H "Cookie: $QA_COOKIE" -H 'Content-Type: application/json' -X PATCH \
  -d '{"name":"QA Ferretería V2","bio":"Borrador E2E Free Demo v2","role":"Ferretería y soluciones para tu proyecto","portfolio_title":"Nuestros trabajos","layout_id":"impacto","free_palette_id":"oceano","schedule_visible":true,"quote_button_visible":true,"contact":{"whatsapp":"18095550123","phone":"18095550123","email":"qa@example.invalid","address":"Santo Domingo","map_url":"https://www.google.com/maps/search/?api=1&query=Santo+Domingo"}}' \
  "https://app.preview.intaprd.com/api/v1/superadmin/free-demo-v2/$QA_DEMO_ID/profile" > "$LOG/profile-save.json"
python3 - "$LOG/profile-save.json" <<'PY'
import json,sys; assert json.load(open(sys.argv[1]))["ok"]; print("✓ Datos del borrador guardados")
PY

# Confirma que la sesión SuperAdmin sigue siendo la misma y operativa.
curl -fsS -H "Cookie: $QA_COOKIE" https://app.preview.intaprd.com/api/v1/superadmin/free-demo-v2/templates > "$LOG/admin-still.json"
python3 - "$LOG/admin-still.json" <<'PY'
import json,sys; assert json.load(open(sys.argv[1]))["ok"]; print("✓ Sesión SuperAdmin intacta; no hubo impersonación")
PY

curl -fsS -H "Cookie: $QA_COOKIE" -H 'Content-Type: application/json' \
  -d "{\"name\":\"QA Ferretería V2\",\"slug\":\"$QA_SLUG\"}" \
  "https://app.preview.intaprd.com/api/v1/superadmin/free-demo-v2/$QA_DEMO_ID/publish" > "$LOG/publish.json"
python3 - "$LOG/publish.json" "$QA_SLUG" <<'PY'
import json,sys
j=json.load(open(sys.argv[1])); assert j["ok"] and j["data"]["slug"]==sys.argv[2] and j["data"]["status"]=="published"
print("✓ Primera publicación fijó slug")
PY

PUBLIC_CODE="$(curl -sS -L -o "$LOG/public.html" -w '%{http_code}' "https://preview.intaprd.com/$QA_SLUG")"
[ "$PUBLIC_CODE" = "200" ] || fail "Perfil público QA respondió $PUBLIC_CODE"
curl -fsS "https://preview.intaprd.com/api/v1/public/profiles/$QA_SLUG" > "$LOG/public-api.json"
python3 - "$LOG/public-api.json" <<'PY'
import json,sys
j=json.load(open(sys.argv[1])); assert j.get("ok") is True
print("✓ Perfil Free público resuelve por slug")
PY

# El slug no puede mutar después de publicar.
LOCK_CODE="$(curl -sS -o "$LOG/slug-lock.json" -w '%{http_code}' -H "Cookie: $QA_COOKIE" -H 'Content-Type: application/json' -d '{"name":"QA Ferretería V2","slug":"otro-slug-qa"}' "https://app.preview.intaprd.com/api/v1/superadmin/free-demo-v2/$QA_DEMO_ID/publish")"
[ "$LOCK_CODE" = "409" ] || fail "El slug publicado no quedó bloqueado"
grep -Fq 'slug_locked' "$LOG/slug-lock.json" || fail "Falta code slug_locked"
echo "✓ Slug bloqueado después de primera publicación"

curl -fsS -H "Cookie: $QA_COOKIE" -H 'Content-Type: application/json' -d '{}' \
  "https://app.preview.intaprd.com/api/v1/superadmin/free-demo-v2/$QA_DEMO_ID/claim-code" > "$LOG/claim-code.json"
QA_CLAIM="$(python3 - "$LOG/claim-code.json" "$QA_SLUG" <<'PY'
import json,sys
j=json.load(open(sys.argv[1])); d=j["data"]
assert j["ok"] and d["special_email"]=="intapcard@gmail.com" and d["slug"]==sys.argv[2] and d["claim_code"].startswith("CLM-")
print(d["claim_code"])
PY
)"
echo "✓ Reclamo vincula correo especial + slug + código"

curl -fsS -c "$CLAIM_JAR" -H 'Content-Type: application/json' \
  -d "{\"email\":\"intapcard@gmail.com\",\"password\":\"$QA_CLAIM\"}" \
  https://app.preview.intaprd.com/api/v1/auth/free-demo-v2-claim/login > "$LOG/claim-login.json"
python3 - "$LOG/claim-login.json" <<'PY'
import json,sys; j=json.load(open(sys.argv[1])); assert j["ok"] and j["data"]["next_url"]=="/claim/free-demo"; print("✓ Código abre contexto de reclamo")
PY

curl -fsS -b "$CLAIM_JAR" https://app.preview.intaprd.com/api/v1/auth/free-demo-v2-claim/context > "$LOG/claim-context.json"
python3 - "$LOG/claim-context.json" "$QA_SLUG" <<'PY'
import json,sys; j=json.load(open(sys.argv[1])); assert j["ok"] and j["data"]["slug"]==sys.argv[2]; print("✓ Contexto de reclamo identifica el slug exacto")
PY

# Google usa el OAuth normal y solo añade el contexto temporal de reclamo.
curl -sS -b "$CLAIM_JAR" -c "$CLAIM_JAR" -D "$LOG/google-start.headers" -o /dev/null \
  "https://app.preview.intaprd.com/api/v1/auth/google/start?flow=free_demo_claim"
grep -Eq '^HTTP/.* 302' "$LOG/google-start.headers" || fail "Google claim no inicia OAuth con 302"
grep -qi '^location: https://accounts.google.com/' "$LOG/google-start.headers" || fail "Google claim no reutiliza OAuth oficial"
grep -qi 'kawvo_free_demo_claim_oauth_flow=' "$LOG/google-start.headers" || fail "Google claim no conserva contexto temporal"
echo "✓ Google OAuth normal recibe contexto de reclamo sin cambiar su contrato"

# Simula el enlace seguro ya verificado por Resend usando el endpoint NORMAL
# magic-link/verify. El token crudo solo existe en esta prueba; D1 recibe su hash,
# igual que el flujo real enviado por correo.
QA_MAGIC_RAW="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
QA_MAGIC_HASH="$(printf '%s' "$QA_MAGIC_RAW" | shasum -a 256 | awk '{print $1}')"
d1 "INSERT INTO auth_magic_links(id,email,token_hash,expires_at,requested_ip,user_agent,created_at) VALUES('qa-magic-v2-$STAMP','$QA_OWNER_EMAIL','$QA_MAGIC_HASH',datetime('now','+10 minutes'),'127.0.0.1','free-demo-v2-e2e',datetime('now'));" >/dev/null

curl -fsS -b "$CLAIM_JAR" -c "$CLAIM_JAR" \
  "https://app.preview.intaprd.com/api/v1/auth/magic-link/verify?token=$QA_MAGIC_RAW&flow=free_demo_claim" > "$LOG/claim-complete.json"
python3 - "$LOG/claim-complete.json" "$QA_SLUG" <<'PY'
import json,sys
j=json.load(open(sys.argv[1]))
assert j["ok"] and j["data"]["next_url"].startswith("/admin/free/credentials") and j["data"]["slug"]==sys.argv[2]
print("✓ Correo seguro normal verificó identidad y transfirió ownership")
PY

# La sesión resultante ya es la del propietario Free normal.
curl -fsS -b "$CLAIM_JAR" https://app.preview.intaprd.com/api/v1/me > "$LOG/owner-me.json"
grep -Fq "$QA_OWNER_EMAIL" "$LOG/owner-me.json" || fail "La sesión final no pertenece al dueño verificado"
grep -Fq "$QA_SLUG" "$LOG/owner-me.json" || fail "La cuenta final no resuelve el slug reclamado"
echo "✓ Propietario entra por el contrato normal Free"

VERIFY="$(d1 "SELECT d.status,p.slug,p.plan_id,p.is_published,u.email,(SELECT COUNT(*) FROM profile_products pp WHERE pp.profile_id=p.id) services_count,(SELECT COUNT(*) FROM profile_gallery g WHERE g.profile_id=p.id) portfolio_count FROM free_demo_v2_profiles d JOIN profiles p ON p.id=d.profile_id JOIN users u ON u.id=p.user_id WHERE d.id='$QA_DEMO_ID'; SELECT status claim_status FROM free_demo_v2_claims WHERE demo_id='$QA_DEMO_ID' ORDER BY created_at DESC LIMIT 1;")"
printf '%s\n' "$VERIFY" | tee "$LOG/e2e-db.log"
echo "$VERIFY" | grep -Fq '"status": "claimed"' || echo "$VERIFY" | grep -Fq '"status":"claimed"' || fail "Demo no quedó claimed"
echo "$VERIFY" | grep -Fq "$QA_OWNER_EMAIL" || fail "Owner definitivo no coincide"
echo "$VERIFY" | grep -Eq '"services_count"[[:space:]]*:[[:space:]]*0' || fail "Aparecieron Servicios"
echo "$VERIFY" | grep -Fq '"claim_status": "used"' || echo "$VERIFY" | grep -Fq '"claim_status":"used"' || fail "Claim no quedó used"
echo "✓ E2E DB: Free independiente, sin Servicios, claim usado"

# Trazabilidad histórica en Demos Free + aparición automática en tenant/usuarios Free.
curl -fsS -H "Cookie: $QA_COOKIE" "https://app.preview.intaprd.com/api/v1/superadmin/free-demo-v2" > "$LOG/demo-history.json"
grep -Fq "$QA_OWNER_EMAIL" "$LOG/demo-history.json" || fail "Histórico Demo no muestra correo del dueño reclamante"
grep -Fq '"status":"claimed"' "$LOG/demo-history.json" || grep -Fq '"status": "claimed"' "$LOG/demo-history.json" || fail "Histórico Demo no quedó reclamado"
curl -fsS -H "Cookie: $QA_COOKIE" "https://app.preview.intaprd.com/api/v1/superadmin/subscribers?q=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$QA_OWNER_EMAIL'))")&limit=10" > "$LOG/subscribers.json"
grep -Fq "$QA_OWNER_EMAIL" "$LOG/subscribers.json" || fail "Dueño reclamante no aparece en listado normal de suscriptores/tenants"
grep -Fq "$QA_SLUG" "$LOG/subscribers.json" || fail "Slug reclamado no aparece asociado al usuario normal Free"
echo "✓ Trazabilidad Demo + tenant Free normal verificados"

# El mismo código no puede iniciar otro claim.
REUSE="$(curl -sS -o "$LOG/reuse.json" -w '%{http_code}' -H 'Content-Type: application/json' -d "{\"email\":\"intapcard@gmail.com\",\"password\":\"$QA_CLAIM\"}" https://app.preview.intaprd.com/api/v1/auth/free-demo-v2-claim/login)"
[ "$REUSE" = "404" ] || fail "El código de reclamo pudo reutilizarse"
echo "✓ Código de reclamo de un solo uso"

cleanup_e2e
trap - EXIT

rm -rf "$LOG"
[ -z "$(git status --porcelain)" ] || { git status --short; fail "Runner dejó cambios locales"; }

cat <<EOF
================================================================
✓ FREE DEMO MASTER V2 · PREVIEW + E2E REAL APROBADO
================================================================
Feature SHA: $(git rev-parse HEAD)
Web origin:   $WEB_ORIGIN
App origin:   $APP_ORIGIN

Probado de punta a punta en Preview:
✓ plantilla base Ferretería
✓ creación de Free real en borrador
✓ URL/editor SuperAdmin sin cambiar sesión
✓ límites Free: 10 portafolio / 3 quick / 3 links / 0 Servicios
✓ Agenda real activa
✓ edición de datos
✓ publicación en /slug
✓ slug permanente
✓ perfil público HTTP 200 + API pública
✓ código de reclamo = intapcard@gmail.com + slug + código
✓ correo seguro normal (magic-link/Resend) como identidad definitiva
✓ Google OAuth preservado por contrato
✓ transferencia de ownership
✓ claim usado una sola vez
✓ histórico Demo conserva dueño reclamante
✓ dueño aparece en listado normal de tenants/usuarios Free
✓ datos QA limpiados
✓ contratos Trial/Sponsored/Free Agenda intactos
✓ Producción NO tocada

QA VISUAL:
1. SuperAdmin → Demos Free.
2. Selecciona Diseño / Serigrafía / Impresión → Usar plantilla base.
3. Se abrirá /free-demo/edit/:id.
4. Revisa imágenes/textos, edita y guarda.
5. Finaliza con nombre + slug.
6. Genera código de reclamo desde SuperAdmin.
================================================================
EOF
