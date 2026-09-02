#!/usr/bin/env bash
set -euo pipefail

fail(){ echo "✗ $1"; exit 1; }
check(){ grep -Fq "$2" "$1" || fail "$3"; }

ART='app/src/components/admin/ArtifactActivation.tsx'
PANEL='app/src/components/admin/free/FreePanelUi.tsx'
ROUTE='app/src/components/admin/free/FreeRouteUx.tsx'
PROFILE='web/src/components/free-profile/IntapLinkGratisProfile.tsx'
BANK='web/src/components/free-profile/PublicBankAccounts.tsx'
MW='functions/_middleware.ts'
APP_HTML='app/index.html'
WEB_HTML='web/index.html'
DEMO_QA='scripts/qa-demo-ai-preview.mjs'
SOCIAL_QA='scripts/qa-post-release-social-seo-preview.mjs'

check "$ART" 'to="/admin/artifacts/activate"' 'Agregar producto todavía entra al flujo legacy /activate'
check "$PANEL" "'Regresar a edición'" 'Falta retorno contextual al editor'
check "$PANEL" 'window.history.back()' 'Retorno contextual no conserva historial del editor'
check "$ROUTE" "kawvo_visual_editor_scroll_y" 'Falta memoria de scroll del editor'
check "$ROUTE" "window.scrollTo({ top: stored" 'Falta restauración de scroll del editor'
check "$PROFILE" '?share=perfil&card=3' 'Compartir perfil no usa URL social versionada'
check "$BANK" '?share=bancos&card=3#bancos' 'Compartir bancos público no usa URL social versionada'
check "$MW" 'profileShareImage' 'Falta resolución explícita de imagen social del perfil'
check "$MW" 'profile?.avatarUrl' 'Graph Card no prioriza avatar del usuario'
check "$MW" 'profile?.portrait' 'Graph Card Demo no usa retrato de la demo'
check "$MW" 'schema.hasOfferCatalog' 'SEO dinámico no expone catálogo de servicios'
check "$MW" 'data-kawvo-profile-discovery="dynamic"' 'Falta fallback semántico dinámico'
check "$MW" '/ai.md' 'Falta señal AI Discovery en metadata dinámica'
check "$APP_HTML" 'background: #f7f9fc' 'App no fija fondo inicial antes de hidratar'
check "$WEB_HTML" 'background: #ffffff' 'Web no fija fondo inicial antes de hidratar'
check "$DEMO_QA" 'demo compartida no debe usar imagen genérica' 'QA Demo no comprueba Graph Card real'
check "$SOCIAL_QA" 'no puede usar favicon' 'QA social no bloquea favicon genérico'
check "$SOCIAL_QA" 'Datos bancarios' 'QA social no valida Graph Card bancaria'

if grep -Fq 'to="/activate" className="rounded-xl bg-slate-950' "$ART"; then
  fail 'El CTA visible de Mis productos todavía apunta al activador legacy'
fi

echo '✓ Auditoría post-release: guards estáticos aprobados'