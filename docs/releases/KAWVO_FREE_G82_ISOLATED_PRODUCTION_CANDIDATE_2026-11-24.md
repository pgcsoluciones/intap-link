# KAWVO G8.2 Free — candidato aislado para Producción

**Fecha:** 2026-11-24. **Estado:** PREPARACIÓN, NO DESPLEGADO, NO APROBADO POR SHA. No es el release integral G8.

## Baseline y procedencia
- Base de rama: `main` `d93f78c46e2d8593e82dfacdfb6e2b1266adaa7a` (capturado al preparar este lote).
- Fuente funcional aprobada en Preview: `1188010f37151b8d17778256c744403fa35522dc`, PR #190 (CI PASS `45318327529`), más corrección de sesión Preview solamente, PR #191 `ded38ef8a8580891f584c06b44bdbf93ce5316ca`.
- QA real aportada por propietario 2026-11-24: `https://preview.intaprd.com/intap3?preview=1#kawvo_shell=1&tab=profile&slug=intap3` renderizó y mostró barra y retorno. No acredita clic del retorno ni barra en URL pública sin `preview=1`.

## Delta runtime exacto
1. `app/src/components/admin/free/KawvoFreeShellPreview.tsx` — **solo** WhatsApp en ventana separada sin abandonar el editor y botones móviles legibles. Se conserva exactamente la cabecera productiva con `FreeNotificationBell`, accesos Perfil/Agenda, y el `previewHref` autenticado de `main`. Se descartó la sustitución completa del componente tras CI FAIL por pérdida de la campana.
2. `web/src/components/appointments/AppointmentOwnerBar.tsx` — retorno Free Multicuenta a `/admin/free/shell-preview?kawvo_shell=1&resume=profile&slug=...` **solo** cuando `public-context` ha verificado `allow_direct_actions===false` y `settings_url==='/admin/free'`; sin modificar servidor ni otras barras.
3. `web/src/components/free-profile/IntapLinkGratisProfile.tsx` — barra Free visible cuando `showOwnerBar && !editMode`, sin depender del campo `profile.experience`; comparte enlace limpio por WhatsApp.

**Prohibido incorporar:** `api/src/free-profile-preview.ts`, `api/src/preview-frontdoor-entry.ts`, `app/src/free-preview-link-fallback.ts` (Preview-only), deltas G3/G4/G5/G7.1, G6/G7.2, migraciones D1/R2, OAuth, bindings, cambios de permisos, Cloudflare Worker Production.

## Prueba y gates reales
- GitHub CI obligatoria: calidad, TypeScript y builds App/Web; ejecutar además `node scripts/test-kawvo-g82-free-isolated-production.mjs`.
- Estado productivo efectivo no se equipara automáticamente a `main`: exigir baseline read-only de App `app.intaprd.com`, Web `intaprd.com`, Worker `intap-api` y correspondencia de despliegues con commit/árboles protegidos. Si difieren, **BLOCKED** hasta reconciliar, sin sustituir Web entera sin comparación.
- QA de Preview restante: click real `Volver a edición`, Free público sin query, propietario con selección exacta, usuario con otro Free seleccionado, visitante/incógnito, independiente, borrador, WhatsApp, móvil y regresión Kawmed/Patrocinado en barra compartida.
- Publicación aislada solo si se acredita que App/Web completos no revierten los cambios productivos ajenos. Stage desde SHA fijado y posterior QA del mismo árbol.
- Recuperación previa: backups efectivos y versión productiva anterior retenidos; readback de Pages/Functions. No usar SHA de Git como sustituto del deployment en Cloudflare.
- `CONTRACT_PRODUCTION_PROFILES.md` exige: PR → QA → aprobación explícita de SHA exacto → merge autorizado a `main` → deploy **desde main** → QA productiva. El aprobado SHA debe coincidir con el commit de merge y con el guard. No aplicar `production_approval_guard.py` con variables inventadas.
- G8 integrado continúa **NO-GO** según `docs/releases/KAWVO_G8_FINAL_EXECUTIVE_2026-11-23.md`; este lote no lo desbloquea, no publica sus interfaces G3/G4/G5 ni la API G7.1.

## Resultado provisional
Código candidato aislado en rama de release. NO hay autorización de Producción ni correspondencia de los tres targets activos validada para este SHA. No desplegar por urgencia saltando los gates; reunir evidencia sin repetir QA ya aceptada.
