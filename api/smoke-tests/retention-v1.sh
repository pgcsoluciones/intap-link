#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# smoke-tests/retention-v1.sh
# Smoke tests para la subetapa de Retención Inteligente (V1 backend-only)
#
# Prerrequisitos:
#   - Worker corriendo localmente:  cd api && npx wrangler dev
#   - Variable BASE: URL base del API (default: http://localhost:8787)
#   - Variable SESSION: cookie session_id válida de un usuario de prueba
#
# Uso:
#   SESSION="<raw-session-token>" bash smoke-tests/retention-v1.sh
#   SESSION="..." BASE="https://intaprd.com" bash smoke-tests/retention-v1.sh
#
# ─────────────────────────────────────────────────────────────────────────────

BASE="${BASE:-http://localhost:8787}"
COOKIE="session_id=${SESSION}"
PASS=0
FAIL=0

# ── helpers ──────────────────────────────────────────────────────────────────

assert_ok() {
  local label="$1"
  local response="$2"
  local ok
  ok=$(echo "$response" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('ok',''))" 2>/dev/null)
  if [ "$ok" = "True" ] || [ "$ok" = "true" ]; then
    echo "  ✓  $label"
    PASS=$((PASS + 1))
  else
    echo "  ✗  $label"
    echo "     Response: $response" | head -c 300
    FAIL=$((FAIL + 1))
  fi
}

assert_field() {
  local label="$1"
  local response="$2"
  local jq_expr="$3"
  local val
  val=$(echo "$response" | python3 -c "import json,sys; d=json.load(sys.stdin); ${jq_expr}" 2>/dev/null)
  if [ -n "$val" ] && [ "$val" != "None" ] && [ "$val" != "null" ]; then
    echo "  ✓  $label (value=$val)"
    PASS=$((PASS + 1))
  else
    echo "  ✗  $label (got: $val)"
    echo "     Response: $response" | head -c 400
    FAIL=$((FAIL + 1))
  fi
}

assert_value() {
  local label="$1"
  local response="$2"
  local jq_expr="$3"
  local expected="$4"
  local val
  val=$(echo "$response" | python3 -c "import json,sys; d=json.load(sys.stdin); ${jq_expr}" 2>/dev/null)
  if [ "$val" = "$expected" ]; then
    echo "  ✓  $label (= $expected)"
    PASS=$((PASS + 1))
  else
    echo "  ✗  $label (expected=$expected, got=$val)"
    FAIL=$((FAIL + 1))
  fi
}

req_get() {
  curl -s -H "Cookie: ${COOKIE}" "${BASE}$1"
}

req_post() {
  curl -s -X POST -H "Cookie: ${COOKIE}" -H "Content-Type: application/json" -d "$2" "${BASE}$1"
}

req_patch() {
  curl -s -X PATCH -H "Cookie: ${COOKIE}" -H "Content-Type: application/json" -d "$2" "${BASE}$1"
}

# ─────────────────────────────────────────────────────────────────────────────

echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  INTAP LINK — Smoke Tests: Retención Inteligente V1"
echo "  BASE: $BASE"
echo "══════════════════════════════════════════════════════════════"

if [ -z "$SESSION" ]; then
  echo ""
  echo "  ERROR: Debes setear SESSION=<raw-session-token>"
  echo "  Ejemplo: SESSION='abc123' bash smoke-tests/retention-v1.sh"
  exit 1
fi

# ─────────────────────────────────────────────────────────────────────────────
# BLOQUE 1 — GET /api/v1/me (campo plan_code y trial_status)
# Valida que /me retorna los nuevos campos del resumen de plan.
# ─────────────────────────────────────────────────────────────────────────────

echo ""
echo "────────────────────────────────────────────────────────────"
echo "  Bloque 1: GET /api/v1/me — resumen de plan y trial"
echo "────────────────────────────────────────────────────────────"

ME=$(req_get "/api/v1/me")
assert_ok "GET /api/v1/me responde ok" "$ME"
assert_field "me.data.plan_id existe" "$ME" "print(d['data']['plan_id'])"
# plan_code es un alias de plan_id en el contexto de retención
# (si el perfil existe, también deben estar trial_status y paused_features_count)
assert_value "me.trial_status es 'active', 'expired' o 'none'" "$ME" \
  "print(d['data'].get('trial_status','') in ['active','expired','none'])" "True"

echo ""
echo "────────────────────────────────────────────────────────────"
echo "  Bloque 2: GET /api/v1/entitlements — límites + retención"
echo "────────────────────────────────────────────────────────────"

ENT=$(req_get "/api/v1/entitlements")
assert_ok "GET /api/v1/entitlements responde ok" "$ENT"
assert_field "data.limits.max_links existe" "$ENT" "print(d['data']['limits']['max_links'])"
assert_field "data.limits.max_photos existe" "$ENT" "print(d['data']['limits']['max_photos'])"
assert_field "data.limits.max_faqs existe" "$ENT" "print(d['data']['limits']['max_faqs'])"
assert_field "data.limits.max_products existe" "$ENT" "print(d['data']['limits']['max_products'])"
assert_field "data.limits.max_videos existe" "$ENT" "print(d['data']['limits']['max_videos'])"
assert_value "data.limits.can_use_vcard es bool" "$ENT" \
  "print(isinstance(d['data']['limits']['can_use_vcard'], bool))" "True"
assert_value "data.paused_modules es lista" "$ENT" \
  "print(isinstance(d['data']['paused_modules'], list))" "True"
assert_value "data.requires_selection es bool" "$ENT" \
  "print(isinstance(d['data']['requires_selection'], bool))" "True"
assert_value "data.trial_status es 'active', 'expired' o 'none'" "$ENT" \
  "print(d['data']['trial_status'] in ['active','expired','none'])" "True"

echo ""
echo "────────────────────────────────────────────────────────────"
echo "  Bloque 3: recursos en /entitlements (si el perfil tiene data)"
echo "────────────────────────────────────────────────────────────"

assert_value "data.resources es dict o null" "$ENT" \
  "r=d['data']['resources']; print(isinstance(r,dict) or r is None)" "True"
# Si hay resources, validar estructura de un recurso
RESOURCES_OK=$(echo "$ENT" | python3 -c "
import json,sys
d=json.load(sys.stdin)
r=d['data']['resources']
if r is None:
    print('null_skip')
else:
    links=r.get('links',{})
    keys={'used','allowed','exceeded','active_ids','exceeded_ids','requires_selection'}
    print('ok' if keys.issubset(links.keys()) else 'missing:'+str(keys-links.keys()))
" 2>/dev/null)

if [ "$RESOURCES_OK" = "null_skip" ]; then
  echo "  ℹ  resources=null (perfil sin data — skip validación de campos)"
elif [ "$RESOURCES_OK" = "ok" ]; then
  echo "  ✓  resources.links tiene todos los campos requeridos"
  PASS=$((PASS + 1))
else
  echo "  ✗  resources.links campos faltantes: $RESOURCES_OK"
  FAIL=$((FAIL + 1))
fi

echo ""
echo "────────────────────────────────────────────────────────────"
echo "  Bloque 4: GET /api/v1/me/plan-impact-preview?target=free"
echo "────────────────────────────────────────────────────────────"

PREVIEW=$(req_get "/api/v1/me/plan-impact-preview?target=free")
assert_ok "GET /plan-impact-preview?target=free responde ok" "$PREVIEW"
assert_value "data.target_plan = 'free'" "$PREVIEW" "print(d['data']['target_plan'])" "free"
assert_field "data.current_plan existe" "$PREVIEW" "print(d['data']['current_plan'])"
assert_value "data.resources tiene links" "$PREVIEW" \
  "print('links' in d['data']['resources'])" "True"
assert_value "links.active es lista" "$PREVIEW" \
  "print(isinstance(d['data']['resources']['links']['active'], list))" "True"
assert_value "links.paused es lista" "$PREVIEW" \
  "print(isinstance(d['data']['resources']['links']['paused'], list))" "True"
assert_value "data.summary.items_to_pause es int" "$PREVIEW" \
  "print(isinstance(d['data']['summary']['items_to_pause'], int))" "True"

# Plan inválido debe retornar error
PREVIEW_BAD=$(req_get "/api/v1/me/plan-impact-preview?target=nonexistent")
assert_value "plan-impact-preview target inválido → ok:false" "$PREVIEW_BAD" \
  "print(d['ok'])" "False"

echo ""
echo "────────────────────────────────────────────────────────────"
echo "  Bloque 5: POST /api/v1/me/retention/selection"
echo "────────────────────────────────────────────────────────────"

# Primero obtener los IDs de links del usuario
LINKS=$(req_get "/api/v1/me/links")
LINK_IDS=$(echo "$LINKS" | python3 -c "
import json,sys
d=json.load(sys.stdin)
items=d.get('data',[])
print(json.dumps([i['id'] for i in items[:3]]))" 2>/dev/null)

if [ -z "$LINK_IDS" ] || [ "$LINK_IDS" = "[]" ]; then
  echo "  ℹ  No hay links para testear retention/selection — skip"
else
  # Caso: keep_ids válidos (primeros ítems existentes)
  SEL_BODY="{\"resource\":\"links\",\"keep_ids\":${LINK_IDS}}"
  SEL=$(req_post "/api/v1/me/retention/selection" "$SEL_BODY")
  assert_ok "POST /retention/selection con keep_ids válidos → ok" "$SEL"
  assert_field "selection.data.resource = links" "$SEL" "print(d['data']['resource'])"
  assert_value "selection.data.active_ids es lista" "$SEL" \
    "print(isinstance(d['data']['active_ids'], list))" "True"
  assert_value "selection.data.paused_ids es lista" "$SEL" \
    "print(isinstance(d['data']['paused_ids'], list))" "True"

  # Caso: resource inválido debe fallar
  SEL_BAD=$(req_post "/api/v1/me/retention/selection" '{"resource":"invalid","keep_ids":["x"]}')
  assert_value "retention/selection resource inválido → ok:false" "$SEL_BAD" "print(d['ok'])" "False"

  # Caso: keep_ids con ID que no existe → debe fallar
  SEL_BADID=$(req_post "/api/v1/me/retention/selection" '{"resource":"links","keep_ids":["00000000-0000-0000-0000-000000000000"]}')
  assert_value "retention/selection ID inválido → ok:false" "$SEL_BADID" "print(d['ok'])" "False"
fi

echo ""
echo "────────────────────────────────────────────────────────────"
echo "  Bloque 6: Sin sesión → 401 en todos los endpoints"
echo "────────────────────────────────────────────────────────────"

NO_COOKIE_ENT=$(curl -s "${BASE}/api/v1/entitlements")
assert_value "GET /entitlements sin sesión → ok:false" "$NO_COOKIE_ENT" "print(d['ok'])" "False"

NO_COOKIE_PREV=$(curl -s "${BASE}/api/v1/me/plan-impact-preview?target=free")
assert_value "GET /plan-impact-preview sin sesión → ok:false" "$NO_COOKIE_PREV" "print(d['ok'])" "False"

NO_COOKIE_SEL=$(curl -s -X POST -H "Content-Type: application/json" -d '{"resource":"links","keep_ids":[]}' "${BASE}/api/v1/me/retention/selection")
assert_value "POST /retention/selection sin sesión → ok:false" "$NO_COOKIE_SEL" "print(d['ok'])" "False"

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  Resultado: ${PASS} passed / $((PASS + FAIL)) total"
if [ "$FAIL" -gt 0 ]; then
  echo "  ✗ ${FAIL} tests fallaron"
  echo "════════════════════════════════════════════════════════════"
  exit 1
else
  echo "  ✓ Todos los smoke tests pasaron"
  echo "════════════════════════════════════════════════════════════"
  exit 0
fi
