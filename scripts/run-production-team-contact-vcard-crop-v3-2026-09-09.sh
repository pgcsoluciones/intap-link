#!/usr/bin/env bash
set -euo pipefail

ROOT="$HOME/Desktop/intap-link-universal-bilingual-audit"
LOG_DIR="/tmp/kawvo-team-contact-vcard-crop-v3-2026-09-09"
fail(){ echo; echo "✗ ERROR: $1"; exit 1; }
step(){ echo; echo "▶ $1"; }

cd "$ROOT" || fail "No existe $ROOT"
rm -rf "$LOG_DIR" && mkdir -p "$LOG_DIR"

echo "============================================================"
echo "KAWVO TEAM · CONTACTOS + VCARD + CROP · PRODUCCION · V3"
echo "============================================================"
echo "Corrige además los dos errores de compilación detectados en V2:"
echo "  • Demo FreeProfileData incorpora whatsapp + email"
echo "  • CTA modal usa hasWhatsapp en lugar de hasPhone"
echo "============================================================"

step "Ejecutar lote V2 hasta su punto de validación"
set +e
bash scripts/run-production-team-contact-vcard-crop-v2-2026-09-09.sh 2>&1 | tee "$LOG_DIR/v2.log"
V2_STATUS=${PIPESTATUS[0]}
set -e

if [[ "$V2_STATUS" -eq 0 ]]; then
  echo "✓ V2 ya completó correctamente; no hay nada adicional que desplegar."
  exit 0
fi

step "Confirmar que V2 dejó aplicados los cambios funcionales antes de corregir TypeScript"
grep -q "whatsapp: string" web/src/components/free-profile/IntapLinkGratis.types.ts || fail "V2 no dejó aplicado whatsapp en FreeProfileData"
grep -q "email: string" web/src/components/free-profile/IntapLinkGratis.types.ts || fail "V2 no dejó aplicado email en FreeProfileData"
grep -q "ImageCropModal" app/src/components/admin/free/FreeTeamMemberEdit.tsx || fail "V2 no dejó conectado el crop Team"
grep -q "const hasWhatsapp = Boolean(profile.whatsapp)" web/src/components/free-profile/IntapLinkGratisProfile.tsx || fail "V2 no dejó aplicado hasWhatsapp"

step "Corregir los dos errores exactos del build Web"
python3 <<'PY'
from pathlib import Path

def replace_once(path, old, new):
    p=Path(path)
    s=p.read_text()
    if old not in s:
        raise SystemExit(f"Patrón no encontrado en {path}: {old!r}")
    if s.count(old)!=1:
        raise SystemExit(f"Patrón ambiguo en {path}: {s.count(old)} coincidencias")
    p.write_text(s.replace(old,new,1))

# 1) El demo ahora debe cumplir el nuevo contrato FreeProfileData.
path='web/src/components/demo/KawvoLinkDemo.tsx'
replace_once(
    path,
    "      bio: form.bio.trim() || 'Aquí aparecerá una descripción breve sobre ti o tu negocio.', phone: whatsapp,\n      whatsappGreetingName: form.name.trim() || 'Hola', whatsappCtaLabel: 'Hablar por WhatsApp', instagram,",
    "      bio: form.bio.trim() || 'Aquí aparecerá una descripción breve sobre ti o tu negocio.', phone: callPhone, whatsapp, email,\n      whatsappGreetingName: form.name.trim() || 'Hola', whatsappCtaLabel: 'Hablar por WhatsApp', instagram,"
)

# 2) Quedaba una segunda referencia al nombre antiguo dentro del modal de Servicios.
path='web/src/components/free-profile/IntapLinkGratisProfile.tsx'
replace_once(
    path,
    "{hasPhone && <a className=\"ilx-modal-cta\" href={whatsappUrl(profile, modal.item.title)}",
    "{hasWhatsapp && <a className=\"ilx-modal-cta\" href={whatsappUrl(profile, modal.item.title)}"
)

print('✓ Errores TypeScript V2 corregidos')
PY

git diff --check

grep -q "phone: callPhone, whatsapp, email" web/src/components/demo/KawvoLinkDemo.tsx || fail "Demo no quedó alineado con FreeProfileData"
if grep -q "hasPhone" web/src/components/free-profile/IntapLinkGratisProfile.tsx; then
  fail "Todavía queda una referencia hasPhone en el perfil público"
fi

step "Build App"
npm run build -w app 2>&1 | tee "$LOG_DIR/app-build.log"

step "Build Web"
npm run build -w web 2>&1 | tee "$LOG_DIR/web-build.log"

step "Typecheck API"
(cd api && npx tsc --noEmit) 2>&1 | tee "$LOG_DIR/api-tsc.log"

step "Commit funcional"
git add \
  app/src/components/admin/free/FreeTeamMemberEdit.tsx \
  web/src/components/free-profile/IntapLinkGratis.types.ts \
  web/src/components/free-profile/IntapLinkGratis.adapter.ts \
  web/src/components/free-profile/IntapLinkGratisProfile.tsx \
  web/src/components/demo/KawvoLinkDemo.tsx

git commit -m "fix: Team contact channels vCard and member photo crop"
PRODUCT_SHA="$(git rev-parse HEAD)"
echo "✓ SHA funcional: $PRODUCT_SHA"

step "Push main"
git push github HEAD:main

step "Deploy API Producción"
(cd api && npx wrangler deploy) 2>&1 | tee "$LOG_DIR/api-deploy.log"

step "Deploy App Producción"
npx wrangler pages deploy app/dist --project-name intap-web2 --branch main 2>&1 | tee "$LOG_DIR/app-deploy.log"

step "Deploy Web Producción"
npx wrangler pages deploy web/dist --project-name intap-link --branch main 2>&1 | tee "$LOG_DIR/web-deploy.log"

step "Smoke"
for url in "https://app.intaprd.com/admin/free/team" "https://intaprd.com/" "https://api.intaprd.com/api/health"; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' "$url")"
  [[ "$code" == "200" ]] || fail "$url -> HTTP $code"
  echo "✓ $url -> HTTP 200"
done

TAG="prod-team-contact-vcard-crop-v3-2026-09-09-$(date +%H%M%S)"
git tag -a "$TAG" "$PRODUCT_SHA" -m "Team contact vCard and avatar crop release v3"
git push github "$TAG"

echo
echo "============================================================"
echo "✓ KAWVO TEAM · CONTACTOS + VCARD + CROP V3 DESPLEGADO"
echo "============================================================"
echo "SHA: $PRODUCT_SHA"
echo "Tag: $TAG"
echo "  ✓ Crop al editar foto Team"
echo "  ✓ Teléfono independiente de WhatsApp"
echo "  ✓ Email público del miembro"
echo "  ✓ vCard con teléfono/WhatsApp/email separados"
echo "  ✓ Demo compatible con el nuevo contrato de contacto"
echo "Servicios: pendiente de la referencia visual del usuario"
echo "Logs: $LOG_DIR"
echo "============================================================"
