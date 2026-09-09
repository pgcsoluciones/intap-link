#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
APP_PROJECT="intap-web2"
LOG_DIR="/tmp/kawvo-team-editor-ui-unified-2026-09-09"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" && mkdir -p "$LOG_DIR"

cat <<'EOF'
============================================================
KAWVO TEAM · LOTE UI UNIFICADO · PRODUCCION
============================================================
Incluye de una vez:
  1) Login Master simplificado
  2) Recorte/ajuste de foto de miembro Team
  3) Contador de miembros coherente
  4) Vista Editor limpia, sin datos técnicos internos
Solo App. Sin cambios D1, API ni Web pública.
============================================================
EOF

run git fetch github main
run git checkout main
run git reset --hard github/main

# Confirmar que los dos ajustes anteriores están en source truth antes de continuar.
grep -Fq "Confirma tu acceso" app/src/components/admin/AdminLogin.tsx || fail "Falta el login Master simplificado en main"
grep -Fq "ImageCropModal" app/src/components/admin/free/FreeTeamAssign.tsx || fail "Falta el recorte de foto Team en main"
grep -Fq "setCropFile(file)" app/src/components/admin/free/FreeTeamAssign.tsx || fail "El flujo Team no abre el recorte de foto"

echo "✓ Ajustes anteriores confirmados en main"

python3 - <<'PY'
from pathlib import Path
p = Path('app/src/components/admin/free/FreeTeamCorporate.tsx')
s = p.read_text()

repls = [
(
"  const memberCount=basic?.member_count??manage?.member_count??0",
"  const memberCount=Math.max(Number(basic?.member_count||0),Number(manage?.member_count||0),Number(manage?.member_pagination?.total||0),manage?.members?.length||0)"
),
(
"<div className=\"mt-3 flex flex-wrap items-end justify-between gap-3\"><div><p className=\"text-[11px] font-black uppercase tracking-[0.18em] text-cyan-600\">KAWVO LINK · TEAM</p><h1 className=\"mt-1 text-3xl font-black\">Equipo de trabajo</h1><p className=\"mt-2 max-w-2xl text-sm leading-6 text-slate-500\">Administra los perfiles de las personas vinculadas a tu equipo.</p></div>",
"<div className=\"mt-3 flex flex-wrap items-end justify-between gap-3\"><div><p className=\"text-[11px] font-black uppercase tracking-[0.18em] text-cyan-600\">KAWVO LINK · TEAM</p><h1 className=\"mt-1 text-3xl font-black\">Equipo de trabajo</h1><p className=\"mt-2 max-w-2xl text-sm leading-6 text-slate-500\">{isMaster?'Administra los perfiles y la configuración de tu equipo.':currentRole==='editor'?'Edita los perfiles del equipo dentro de los campos autorizados.':'Administra los perfiles según las funciones permitidas por tu rol.'}</p></div>"
),
(
"<p className=\"mt-1 text-xs text-slate-500\">{member.role||'Cargo pendiente'} · {member.email||'Sin correo de contacto'}</p><p className=\"mt-1 text-xs text-slate-400\">Producto: {member.product_code||'—'} · Desde {formatDate(member.joined_at)}</p>{member.slug&&<p className=\"mt-1 font-mono text-[11px] font-bold text-cyan-700\">/{member.slug}</p>}",
"<p className=\"mt-1 text-xs text-slate-500\">{member.role||'Cargo pendiente'}</p>{member.email&&<p className=\"mt-1 text-xs text-slate-500\">{member.email}</p>}{isMaster&&<p className=\"mt-1 text-xs text-slate-400\">Producto: {member.product_code||'—'} · Vinculado {formatDate(member.joined_at)}</p>}{isMaster&&member.slug&&<p className=\"mt-1 font-mono text-[11px] font-bold text-cyan-700\">/{member.slug}</p>}"
),
(
"<div><h2 className=\"text-xl font-black\">Perfiles del equipo</h2><p className=\"mt-1 text-xs text-slate-500\">Consulta y administra los perfiles según las funciones permitidas por tu rol.</p></div>",
"<div><h2 className=\"text-xl font-black\">Perfiles del equipo</h2><p className=\"mt-1 text-xs text-slate-500\">{isMaster?'Consulta y administra los perfiles vinculados.':currentRole==='editor'?'Selecciona un perfil para verlo o editar únicamente los campos autorizados.':'Consulta los perfiles según las funciones permitidas por tu rol.'}</p></div>"
),
]

for old,new in repls:
    if old not in s:
        raise SystemExit(f'No se encontró bloque esperado para reemplazo:\n{old[:180]}')
    s = s.replace(old,new,1)

p.write_text(s)
PY

run git diff --check

grep -Fq "Math.max(Number(basic?.member_count||0),Number(manage?.member_count||0),Number(manage?.member_pagination?.total||0),manage?.members?.length||0)" app/src/components/admin/free/FreeTeamCorporate.tsx || fail "No quedó el contador robusto"
grep -Fq "Edita los perfiles del equipo dentro de los campos autorizados." app/src/components/admin/free/FreeTeamCorporate.tsx || fail "No quedó el copy Editor"

echo "✓ Contador robusto confirmado"
echo "✓ Vista Editor simplificada confirmada"
echo "✓ Producto/fecha/slug quedan restringidos a Master"

run npm ci
run npm run build -w app

# Source truth: guardar el ajuste funcional antes de desplegar.
run git add app/src/components/admin/free/FreeTeamCorporate.tsx
if git diff --cached --quiet; then
  echo "✓ El ajuste ya estaba aplicado; no hace falta nuevo commit"
else
  run git commit -m "fix: align Team editor member count and presentation"
  run git push github HEAD:main
fi

PRODUCT_SHA="$(git rev-parse HEAD)"
echo "✓ SHA funcional a desplegar: $PRODUCT_SHA"

echo
echo "▶ Deploy App Producción"
npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch main 2>&1 | tee "$LOG_DIR/app.log"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "Deploy App"

sleep 5
for url in \
  "https://app.intaprd.com/admin/login" \
  "https://app.intaprd.com/admin/free/team"
do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "✓ $url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

TAG="prod-team-editor-ui-unified-2026-09-09-$(date +%H%M%S)"
run git tag -a "$TAG" "$PRODUCT_SHA" -m "Team login crop and editor UI unified release"
run git push github "$TAG"

cat <<EOF

============================================================
✓ KAWVO TEAM · LOTE UI UNIFICADO DESPLEGADO
============================================================
SHA: $PRODUCT_SHA
Tag: $TAG
App: Producción
Incluye:
  ✓ Login Master simplificado
  ✓ Ajuste/recorte de foto Team
  ✓ Contador coherente de miembros
  ✓ Editor sin producto/fecha/slug técnicos
D1/API/Web: sin cambios
Logs: $LOG_DIR
============================================================
EOF
