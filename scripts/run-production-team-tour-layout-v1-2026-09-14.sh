#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
APP_PROJECT="intap-web2"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"

cat <<'EOF'
============================================================
KAWVO LINK · TEAM · RECORRIDO LAYOUT V1 · PRODUCCIÓN
============================================================
- despliega SOLO Admin App de producción
- incluye barra superior sticky con Recorrido
- corrige superposición de pasos 3/9, 4/9, 5/9 y 6/9
- no toca API, Web público, D1 ni R2
============================================================
EOF

run git fetch github main
run git checkout main
run git pull --ff-only github main

[ -z "$(git status --porcelain)" ] || { git status --short; fail "El árbol de trabajo no está limpio"; }

MAIN_SHA="$(git rev-parse HEAD)"
echo "Main SHA: $MAIN_SHA"

run git diff --check

# Verifica que los únicos cambios funcionales desde la última release sean del Admin App Team.
BASE="a3a588a420ed1c398ab09c050226eb5a664a287b"
CHANGED="$(git diff --name-only "$BASE...HEAD")"
echo
echo "▶ Alcance desde última release"
echo "$CHANGED"
if echo "$CHANGED" | grep -Eq '^(api/|web/|functions/)'; then
  fail "Se detectaron cambios fuera del Admin App; se cancela el deploy"
fi

run npm run build -w app

cat <<'EOF'

▶ Deploy Admin App producción → intap-web2 / main
EOF
npx wrangler pages deploy app/dist --project-name "$APP_PROJECT" --branch main || fail "Deploy Admin App producción"

sleep 3
for url in \
  "https://app.intaprd.com/admin/login" \
  "https://app.intaprd.com/admin/free/team"
do
  code="$(curl -sS -L -o /dev/null -w '%{http_code}' "$url")"
  echo "$url -> HTTP $code"
  [ "$code" = "200" ] || fail "$url respondió HTTP $code"
done

cat <<EOF
============================================================
✓ TEAM TOUR LAYOUT V1 EN PRODUCCIÓN
============================================================
Main SHA: $MAIN_SHA
Producción: https://app.intaprd.com/admin/free/team
API: no desplegada
Web público: no desplegado
D1/R2: no modificados
============================================================
EOF
