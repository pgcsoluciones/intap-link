#!/usr/bin/env bash
set -euo pipefail

fail(){ echo "✗ $1"; exit 1; }

EDITOR='app/src/components/admin/free/FreeVisualEditor.tsx'
IDENTITY='app/src/components/admin/free/onboarding/FreeOnboardingIdentity.tsx'
STARTER='app/src/components/admin/free/onboarding/FreeStarterNativePreview.tsx'
BUILDER='app/src/components/admin/free/onboarding/FreeOnboardingBuilder.tsx'

# Editor móvil aprobado: Editar | Vista previa, preview real y retorno al scroll de edición.
grep -Fq 'function showPreview()' "$EDITOR" || fail 'Falta showPreview móvil'
grep -Fq 'editScrollRef.current = window.scrollY' "$EDITOR" || fail 'Vista previa no recuerda posición de edición'
grep -Fq 'function showEdit()' "$EDITOR" || fail 'Falta showEdit móvil'
grep -Fq 'window.scrollTo({ top: editScrollRef.current' "$EDITOR" || fail 'Editar no recupera posición anterior'
grep -Fq 'onClick={showPreview}' "$EDITOR" || fail 'Botón Vista previa no usa flujo aprobado'
grep -Fq 'onClick={showEdit}' "$EDITOR" || fail 'Botón Editar no usa flujo aprobado'
grep -Fq 'title="Vista previa del perfil"' "$EDITOR" || fail 'Falta vista previa real del perfil'
grep -Fq 'Guardar y actualizar' "$EDITOR" || fail 'Falta Guardar y actualizar en preview'
grep -Fq 'Abrir perfil completo' "$EDITOR" || fail 'Falta Abrir perfil completo'

# Foto/portada desde el panel/editor es edición, no onboarding.
grep -Fq "/admin/free/onboarding/identity?from=panel" "$EDITOR" || fail 'Foto y portada no abre como edición desde editor'
grep -Fq "editingFromPanel" "$IDENTITY" || fail 'Presentación no reconoce edición desde panel'
grep -Fq "Guardar cambios" "$IDENTITY" || fail 'Falta CTA Guardar cambios en edición'

# No permitir deployments Preview históricos hardcodeados.
if grep -R -Fq 'feature-intap-link-approved-v9ix.intap-link.pages.dev' "$STARTER" "$BUILDER"; then
  fail 'Quedó un origin Preview histórico hardcodeado'
fi
grep -Fq "'https://preview.intaprd.com'" "$STARTER" || fail 'Starter Preview no usa origin canónico'
grep -Fq "'https://preview.intaprd.com'" "$BUILDER" || fail 'Builder Preview no usa origin canónico'

echo '✓ UI móvil/editor/origins reconciliados'
