# G1 — Control de activación autenticada y reversión Preview (2026-11-12)

**Estado: NO APROBADO PARA CORTAR TRÁFICO.** PR #158 en borrador. No merge. No producción.

## Evidencia verificada por ejecución del usuario
- Worker frontdoor **intap-api-preview**, versión activa al 100%: `23405a5b-e9ca-4247-843d-28cc4f236eaa`.
- `APP_PAGES_ORIGIN=https://qa-kawmed-guest-current-2026.intap-web2.pages.dev`
- `WEB_PAGES_ORIGIN=https://qa-sponsor-scan-1104.intap-link.pages.dev`
- Entrypoint activo tanto por dominio `app.preview.intaprd.com` como por Pages de origen: `/assets/index-RcRZc-jm.js`; SHA-256 `7f281abc65a31f922fbc09a17d3efa1644757c9ced18afe84af18a5dc20d3dcb`.
- QA de integración Free desde `main`: commit `76545a4ff35130d13adcfec1d03b89b06b8f8553`, Pages inmutable `https://ec6dcb72.intap-web2.pages.dev`, JS `/assets/index-DuDCnp-A.js`; SHA-256 local `5dde278649efb45b5f69dc72b4a621339c0f406e2964a1dce78e3420eb85e2e9`.
- 76 rutas administrativas examinadas mediante comparación estática: 75 en ambos, 0 presentes solo en activo, 1 presente solo en candidato (`/admin/free/shell-preview`).
- Pruebas de contratos estáticos, TypeScript/build Preview y staging del JS exacto: PASS.
- **No está verificada** identidad entre código de GitHub `main` y build KawMed Guest activo, ni pruebas funcionales autenticadas de KawMed, Sponsor, Free. No equiparar cadenas de rutas a funcionalidad.

## Riesgos bloqueantes
1. **Divergencia de configuración**: `api/wrangler.preview.toml` en el commit actual declara orígenes APP/WEB que no corresponden a los valores vivos. Está **prohibido ejecutar `wrangler deploy` con ese archivo**: puede reescribir bindings, triggers, configuración o código del Worker Preview además de reemplazar App.
2. Worker actual sirve ambos dominios y la API; una reversión de versión del Worker afecta **todas** las rutas de ese Worker, no solo Kawlink Free. Cloudflare no revierte D1/R2 ni el estado generado durante el canary.
3. `.pages.dev` no está autorizado para login de Google; no modificar OAuth/cookies ni probar sesiones allí. El nuevo shell requiere `import.meta.env.MODE==='preview'`, `hostname==='app.preview.intaprd.com'` y `kawvo_shell=1`.
4. No se ha establecido una técnica **App-only** de cambio de origen en el Worker vivo conservando intactos otros bindings/triggers/API/crons. No improvisar un corte por `wrangler deploy`.

## Condiciones explícitas antes de autorizar promoción
- [x] Build y contratos estáticos Free PASS.
- [x] Artefacto QA aislado exacto, verificable.
- [x] Snapshot de ID de Worker, bindings y JS actual.
- [x] Auditoría estática de rutas admin/superadmin sin omisiones.
- [ ] Auditar la técnica concreta de cambiar **solo** `APP_PAGES_ORIGIN`, preservando por lectura de vuelta todos los bindings, secretos, rutas, D1/R2, crons y versión de código de Worker; o sustituir por otra técnica de feature flag/preview sin modificar el frontdoor estable.
- [ ] Evidencia de KawMed Guest (rutas, claims de invitación, agenda, medios, permisos guest), patrocinador Master/beneficiario y Free multicuenta con cuentas reales, sin exponer datos personales. Una lista de rutas en bundle **no basta**.
- [ ] Freeze temporal de Preview durante canary, autorizaciones explícitas de responsable y ventana de reversión.
- [ ] Plan de rollback probado para **origen App y Worker** en caso de error, con validación inmediata del bundle antiguo. Revisar que la versión guardada sigue en el historial disponible de Cloudflare.
- [ ] QA móvil/escritorio con Google OAuth en dominio estable y `/admin/free/shell-preview?kawvo_shell=1`; módulo original `/admin/free` intacto.

## Reversión: referencia, NO ejecutar sin incidente y autorización
La versión previa conocida es `23405a5b-e9ca-4247-843d-28cc4f236eaa`. Cloudflare documenta el comando `wrangler rollback <VERSION_ID> --name <WORKER>` para restaurar una versión exacta del Worker. **No ejecutar este comando preventivamente**. Es un cambio de tráfico sobre ambos dominios y la API, y su operación depende de que la versión permanezca disponible. Referencia: https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/ .

```bash
# REFERENCIA PARA PLAN DE INCIDENTES, NO EJECUTAR DURANTE PREFLIGHT:
# npx --no-install wrangler rollback 23405a5b-e9ca-4247-843d-28cc4f236eaa --name intap-api-preview
```

**Punto importante**: revertir el Worker devolvería la referencia a `qa-kawmed-guest-current-2026.intap-web2.pages.dev`, pero si la URL/alias Pages desaparece o cambia su contenido, el rollback no recupera por sí mismo un artefacto Pages. Conservar disponibilidad de Pages y cotejar JS antes de una ventana.

## Criterio de salida de G1
No declarar G1 cerrado hasta evidencia registrada de login real con Google en Preview, shell Free activado por opt-in, navegación/permisos de tres roles, publicación Free original, datos de cuenta, QA móvil/escritorio y reversión viable. **Producción intocable.**
