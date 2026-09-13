#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
BRANCH="feature/free-guided-tour-v1"

fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
run(){ echo; echo "▶ $*"; "$@" || fail "$*"; }

cd "$ROOT" || fail "No existe $ROOT"

cat <<'EOF'
============================================================
KAWVO LINK · TEAM · RECORRIDO V4 · PREVIEW
============================================================
- un concepto por paso
- Master define la data variable
- cuentas bancarias separadas
- códigos separados de permisos
- primer Team guiado paso a paso
- producción NO se toca
============================================================
EOF

run git fetch github "$BRANCH" main
run git checkout "$BRANCH"
run git pull --ff-only github "$BRANCH"

[ -z "$(git status --porcelain)" ] || { git status --short; fail "El árbol de trabajo no está limpio"; }

run python3 scripts/apply-free-team-guided-tour-v4-2026-09-13.py
run git diff --check

CHANGED="$(git diff --name-only)"
if [ -n "$CHANGED" ]; then
  echo "$CHANGED"
  if echo "$CHANGED" | grep -Eq '^(api/|web/|functions/)'; then
    fail "El patch intentó tocar API/Web/Functions"
  fi
fi

run npm run build:preview -w app

if [ -n "$(git status --porcelain)" ]; then
  run git add app/src/components/admin/free/FreeTeamCorporate.tsx
  run git commit -m "fix: refine Team guided tour targets and copy"
  run git push github "$BRANCH"
fi

run bash scripts/run-preview-free-guided-tour-v1-auth-2026-09-12.sh

cat <<'EOF'
============================================================
✓ TEAM RECORRIDO V4 LISTO EN PREVIEW
============================================================
Prueba:
https://app.preview.intaprd.com/admin/free/account

Luego entra a Team y revisa:
- Primer Team automático si no hay miembros
- Botón Recorrido en Team
- Data variable
- Códigos
- Asignaciones
- Miembros

Producción NO tocada
============================================================
EOF
