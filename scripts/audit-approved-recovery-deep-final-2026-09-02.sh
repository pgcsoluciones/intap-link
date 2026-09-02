#!/usr/bin/env bash
set -euo pipefail
fail(){ echo "✗ $1"; exit 1; }
check(){ grep -Fq "$2" "$1" || fail "$3"; }

APP='app/src/App.tsx'; ACCOUNT='app/src/components/admin/free/FreeAccount.tsx'; NOTIFS='app/src/components/admin/free/FreeNotifications.tsx'; EDITOR='app/src/components/admin/free/FreeVisualEditor.tsx'; IDENTITY='app/src/components/admin/free/onboarding/FreeOnboardingIdentity.tsx'; BUILDER='app/src/components/admin/free/onboarding/FreeOnboardingBuilder.tsx'; STARTER='app/src/components/admin/free/onboarding/FreeStarterNativePreview.tsx'; LOCATION='app/src/components/admin/free/FreeLocation.tsx'; QUICK='app/src/components/admin/free/FreeQuickActions.tsx'; DANGER='app/src/components/admin/free/FreeProfileDangerZone.tsx'; ACTIVATION='app/src/components/admin/free/onboarding/FreeArtifactActivation.tsx'; GUARD='app/src/components/admin/AdminGuard.tsx'; AI='app/src/components/admin/free/FreeAiProfileAssistant.tsx'; AIAPI='api/src/ai-profile-assistant.ts'; APIINDEX='api/src/index.ts'; PROFILE='web/src/components/free-profile/IntapLinkGratisProfile.tsx'; ADAPTER='web/src/components/free-profile/IntapLinkGratis.adapter.ts'; BANK='web/src/components/free-profile/PublicBankAccounts.tsx'; MW='functions/_middleware.ts'; DISC='functions/profile-discovery.ts'; REG='web/src/components/profile-templates/registry.tsx'

for r in '/admin/free/home' '/admin/free/account' '/admin/free/notifications' '/superadmin/resources' '/admin/free/editor' '/admin/free/ai-profile'; do check "$APP" "path=\"$r\"" "Falta ruta $r"; done

[ -f app/public/manifest.webmanifest ] || fail 'Falta manifest PWA'; [ -f app/public/sw.js ] || fail 'Falta SW PWA'
check app/public/manifest.webmanifest '"start_url": "/admin/free/home?source=pwa"' 'start_url PWA incorrecto'
check "$ACCOUNT" 'Instalar app Kawvo' 'Falta instalar Kawvo'; check "$ACCOUNT" 'pwaInstallUrl' 'Falta URL PWA'; check "$ACCOUNT" 'Agregar a pantalla de inicio' 'Faltan instrucciones iOS'; check "$ACCOUNT" 'tres puntos (⋮)' 'Faltan instrucciones Android'

check "$EDITOR" 'function showPreview()' 'Falta Vista previa móvil'; check "$EDITOR" 'editScrollRef.current = window.scrollY' 'Preview no memoriza scroll'; check "$EDITOR" 'function showEdit()' 'Falta Editar móvil'; check "$EDITOR" 'onClick={showPreview}' 'CTA Vista previa incorrecto'; check "$EDITOR" 'onClick={showEdit}' 'CTA Editar incorrecto'; check "$EDITOR" 'Guardar y actualizar' 'Falta Guardar y actualizar'; check "$EDITOR" 'Abrir perfil completo' 'Falta abrir perfil completo'; check "$EDITOR" '/admin/free/onboarding/identity?from=panel' 'Foto y portada abre como onboarding'; check "$IDENTITY" 'editingFromPanel' 'Identidad no reconoce modo edición'

! grep -Fq 'feature-intap-link-approved-v9ix.intap-link.pages.dev' "$BUILDER" "$STARTER" || fail 'Quedó origin Preview histórico'; check "$BUILDER" "'https://preview.intaprd.com'" 'Builder no usa Preview canónico'; check "$STARTER" "'https://preview.intaprd.com'" 'Starter no usa Preview canónico'

check "$ACCOUNT" 'const invitationUrl = `https://nfc.kawvoia.com/invitacion?de=' 'Falta invitación personalizada'; check "$ACCOUNT" '{invitationUrl}</span>' 'Preview invitación no muestra URL real'; check "$ACCOUNT" '?share=bancos#bancos' 'Mi cuenta no comparte bancos'; check "$ACCOUNT" 'Descargar QR de mi perfil' 'Falta QR'; check "$ACCOUNT" '/admin/artifacts?from=account' 'Falta Mis productos'; check "$ACCOUNT" 'FreeSupportPanel' 'Falta soporte'; check "$ACCOUNT" 'Cerrar sesión' 'Falta logout'

check "$NOTIFS" "filter === 'unread'" 'Falta filtro notificaciones'; check "$NOTIFS" 'image_url' 'Faltan imágenes notificaciones'; check "$NOTIFS" 'markAllRead' 'Falta marcar todas'; check "$NOTIFS" 'removeSelected' 'Falta eliminar'; check "$NOTIFS" "source_type === 'support_ticket'" 'Falta ticket inline'

check "$DANGER" "apiPost('/me/profile/delete'" 'Falta delete mobile-safe'; check "$DANGER" "apiGet('/me')" 'Falta verificar eliminación'; check api/src/preview-free-entry.ts "import './preview-profile-delete-mobile'" 'Endpoint delete no ensamblado'

for t in 'Usar mi ubicación actual' 'Usar esta ubicación' 'navigator.geolocation' 'Buscar ubicación'; do check "$LOCATION" "$t" "Falta Ubicación: $t"; done
check "$QUICK" "apiGet('/me/contact')" 'Quick actions no sincroniza ubicación'; check "$ADAPTER" "const realLocation = readString(contact, 'map_url')" 'Perfil no prioriza map_url'

check "$ACTIVATION" "apiGet('/me/artifacts/scan/pending')" 'Falta scan pending'; check "$ACTIVATION" "apiPost('/me/artifacts/scan/confirm'" 'Falta scan confirm'; check "$GUARD" 'const scanCode = readScanCode()' 'Guard no condiciona scan'; check "$GUARD" "apiPost('/public/artifacts/scan/start'" 'Guard no recupera scan'

check "$PROFILE" 'function canonicalProfileUrl()' 'Compartir perfil no usa URL canónica'; check "$PROFILE" 'isMobileContactFlow' 'Falta vCard móvil'; check "$PROFILE" 'Código QR' 'Falta QR público'; check "$BANK" '?share=bancos#bancos' 'Bancos no usa URL canónica'; check "$BANK" 'Enviar por WhatsApp' 'Falta WhatsApp bancos'; check "$MW" 'share=bancos: social card bancaria' 'Falta Graph Card bancaria'; check "$MW" "url.pathname === '/invitacion'" 'Falta Graph Card invitación'; check "$MW" 'getDynamicProfileSeoBundle' 'Falta Graph Card perfil'

check "$AIAPI" 'const MAX_OUTPUT_TOKENS = 2400' 'IA perdió output aprobado'; check "$AIAPI" 'internalRetryUsed' 'IA perdió retry'; check "$AIAPI" 'ai_incomplete_after_retry' 'IA perdió fail-safe'; check "$AI" '✨ Kawvo prepara una propuesta con la información de tu perfil.' 'IA UI final no está'; check "$AI" '🧩 Completar lo que falta' 'IA perdió completar faltantes'; check "$AI" '✨ Mejorar mi contenido' 'IA perdió mejorar contenido'; check "$AI" 'Cambios confirmados y aplicados' 'IA perdió confirmación final'

check web/src/App.tsx 'path="/demo/ia"' 'Falta Demo IA'; check api/src/preview-free-entry.ts 'registerDemoAiRoutes(app)' 'Demo IA API no ensamblada'; check scripts/qa-demo-ai-preview.mjs 'assert.equal(result.json.data.demo.services.length, 3' 'QA Demo IA no exige exactamente 3 servicios'; check api/src/routes/demo-viral.ts 'demo/s/' 'Falta snapshot viral'

# GEO/SEO/LLM discovery vive en profile-discovery.ts y _middleware solo delega a handleDiscoveryRequest.
check "$MW" 'handleDiscoveryRequest' 'Middleware no delega discovery'
check "$DISC" "normalized === '/llms.txt'" 'Falta discovery /llms.txt'
check "$DISC" "normalized === '/robots.txt'" 'Falta discovery /robots.txt'
check "$DISC" "sitemap.xml" 'Falta discovery /sitemap.xml'
check "$DISC" "resource: 'ai.md' | 'facts.json'" 'Faltan recursos ai.md/facts.json'
check "$DISC" 'getDynamicProfileSeoBundle' 'Falta SEO dinámico de perfiles'

for id in automotive_jason_v3 real_estate_novi_v4 events_1a_v1 car_rental_rentao_v1 industrial_aycdom_v1; do check "$REG" "$id" "Falta plantilla $id"; done
# El endpoint público R2 pertenece al API principal; Preview/Producción lo ensamblan desde index.ts.
check "$APIINDEX" "app.get('/api/v1/public/assets/*'" 'Falta endpoint público de assets R2'
check "$APIINDEX" 'c.env.BUCKET.get(key)' 'Endpoint assets R2 no lee del bucket'

[ -f api/migrations/0041_free_portfolio_limit_5.sql ] || fail 'Falta límite portafolio 5'; check "$QUICK" 'const MAX_SELECTED = 3' 'Quick actions no limita 3'; check api/wrangler.toml 'FREE_MAX_SERVICES = "3"' 'Servicios Free no limita 3'
check scripts/run-preview-reconcile-approved-releases-2026-09-01.sh 'APP_PROJECT="intap-web2"' 'App Preview proyecto incorrecto'; check scripts/run-preview-reconcile-approved-releases-2026-09-01.sh 'WEB_PROJECT="intap-link"' 'Web Preview proyecto incorrecto'

echo '============================================================'; echo '✓ AUDITORÍA ESTÁTICA PROFUNDA FINAL: APROBADA'; echo '============================================================'
