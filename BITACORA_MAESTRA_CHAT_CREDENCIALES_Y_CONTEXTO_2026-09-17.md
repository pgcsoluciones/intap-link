# BITÁCORA MAESTRA COMPLETA DEL CHAT · KAWVO LINK

**Fecha de cierre de esta bitácora:** 2026-09-17  
**Repositorio principal:** `pgcsoluciones/intap-link`  
**Proyecto local habitual:** `$HOME/Desktop/intap-link-universal-bilingual-audit`  
**Estado general al cierre:** Credenciales V1 completada, validada en Preview y Producción. El resto del producto continúa sobre la base estable previa y con varios frentes del mapa de ruta pendientes.  
**Main validado en producción al cierre del módulo:** `b42da9b302a7cd297cfbbae5733a52e9a236405b`  
**Worker producción validado:** `2eb3c267-0be5-4eac-bb6b-5f7764b9af43`  
**App producción:** `https://app.intaprd.com`  
**Panel Credenciales:** `https://app.intaprd.com/admin/free/credentials`

---

# 1. PROPÓSITO DE ESTA BITÁCORA

Esta bitácora reúne el contexto completo trabajado en este chat alrededor de Kawvo Link / INTAP Link, incluyendo:

- contexto técnico del proyecto;
- metodología de trabajo aprobada;
- estado base antes de comenzar este frente;
- objetivos funcionales discutidos;
- cambios realizados;
- archivos creados y modificados;
- migraciones y tablas;
- endpoints y funciones;
- problemas detectados;
- investigación forense;
- correcciones aplicadas;
- despliegues Preview y Producción;
- resultados de QA;
- decisiones de arquitectura;
- restricciones que no deben romperse;
- mapa de ruta y pendientes conocidos para el próximo programador.

El objetivo es que otro programador pueda continuar sin reconstruir el contexto desde cero.

---

# 2. CONTEXTO GENERAL DEL PROYECTO

Kawvo Link es la evolución del proyecto anteriormente denominado INTAP Link. El producto es una presentación digital interactiva vinculable a productos físicos como llaveros NFC/QR, tarjetas, estaciones, pines y otros artículos de contacto.

La arquitectura principal relevante para este chat combina:

- **Admin App** en Cloudflare Pages, proyecto `intap-web2`;
- **API** en Cloudflare Worker, producción `intap-api`;
- **D1** para datos relacionales;
- **R2** para assets y recursos;
- autenticación histórica por Google OAuth y correo seguro/magic link;
- rutas públicas y de administración compartiendo el ecosistema `intaprd.com` / `app.intaprd.com`;
- Preview separado con D1/R2 de Preview y Worker `intap-api-preview`.

Nombres/comercial:

- Marca matriz actual: Kawvo.
- Producto: Kawvo Link / Kawlink.
- Terminología preferida: **Presentación interactiva**.

---

# 3. MÉTODO DE TRABAJO APROBADO

Este punto es crítico y debe respetarse en trabajos futuros.

El usuario dejó claro que el método aprobado es:

1. El programador/assistant analiza, diseña, modifica y escribe el código.
2. El usuario **no debe tener que crear archivos ni editar código manualmente**.
3. Cuando se necesita una ejecución local, se prepara un runner/script listo.
4. El usuario normalmente hace `git pull` y ejecuta el runner.
5. Primero se trabaja en Preview.
6. Solo después de validación funcional se prepara Producción.
7. Los runners deben incluir prechecks, typecheck/build, despliegue y QA.
8. No usar `git reset --hard` en instrucciones al usuario.
9. No mezclar frentes no relacionados.
10. No desplegar Web público o R2 si la tarea no lo requiere.
11. En producción se debe verificar el alcance antes de desplegar.
12. Si un error aparece, primero se busca causa raíz y evidencia antes de seguir parcheando a ciegas.

El usuario ya había rechazado explícitamente el patrón de “te paso código para que tú lo crees”.

---

# 4. BASELINE ESTABLE ANTES DE CREDENCIALES

Antes de comenzar Credenciales, el Admin principal ya tenía un release estable.

Referencia conocida:

`853daf7f00d3672dae973c40f2089927f858b655`

Incluía y no debía regresarse:

- Free UI aprobada;
- branding completo Kawlink;
- optimización de imágenes;
- entrada moderna cuando no hay perfil;
- flujo posterior a perfil eliminado;
- Account tour V3;
- Team tour V4;
- Team topbar aprobado;
- tours persistentes/manuales;
- correcciones de navegación de notificaciones;
- estructura diferenciada entre perfiles Plus/especiales y perfiles públicos;
- `/argenisg` y perfiles especiales existentes.

Rutas/estructuras importantes conocidas:

- perfiles Plus como `novi` tienen estructura distinta;
- perfiles públicos como `/jlprince` y `/rosmeryaltamar` usan otra estructura;
- evitar unificar estructuras sin análisis.

---

# 5. MAPA DE RUTA / IDEAS DISCUTIDAS EN EL CHAT ANTES O ALREDEDOR DEL FRENTE DE CREDENCIALES

Aunque el foco de esta sesión terminó siendo Credenciales, quedaron varios frentes del producto en el mapa.

## 5.1 Perfil patrocinado

Se discutió una modalidad para profesionales independientes patrocinados por una empresa, por ejemplo una ferretería.

Concepto visual/funcional acordado:

- perfil limpio y centralizado;
- avatar centrado;
- foto/portada;
- botones de contacto en grid 2x2;
- sección de redes con título “Contáctame”;
- separadores visuales finos entre secciones;
- galería tipo slider con miniaturas rectangulares;
- capacidad de hasta 10 fotos, pero mostrar 3 cards visibles a la vez;
- botón vCard / “Guarda mi Contacto”;
- cintillo/banner inferior discreto “Impulsado por…”;
- no mostrar “Profesional verificado”;
- no usar internamente en UI la frase “perfil promocional”;
- foco visual limpio, editorial y ordenado.

Este frente quedó como idea aprobada/conceptual, no como implementación final en este chat.

## 5.2 MED / perfiles médicos

Se había planteado un plan separado para salud con categorías y subplantillas:

- odontología;
- cirujanos estéticos;
- médicos;
- campos mínimos profesionales;
- hasta 2 centros;
- horarios;
- aseguradoras;
- sponsor strip interno.

No se implementó en este chat.

## 5.3 Plantilla editorial para marcas personales

Se habló de una plantilla orientada a artistas, influencers y marcas personales.

Pendiente de diseño/implementación.

## 5.4 Onboarding / activación de producto

Hay requerimientos previos importantes todavía relevantes:

- si un producto se confirma y hay usuario logueado, no asumir que es para ese usuario;
- preguntar si es para el mismo usuario u otro;
- si es otro, permitir cerrar sesión y continuar;
- si es el mismo, avisar que se vinculará al perfil actual;
- permitir activar/desactivar un producto en “Mis productos”;
- permitir desvincular;
- si un llavero ya está vinculado a un perfil publicado, redirigir directo al perfil sin aviso intermedio;
- si está en borrador, mostrar estado de construcción;
- mantener la experiencia de dueño/nuevo producto según corresponda.

Este frente no fue ejecutado aquí, pero forma parte del mapa.

---

# 6. OBJETIVO PRINCIPAL DEL CHAT: CREDENCIALES / MÉTODOS DE ACCESO

Se definió que Kawvo debía permitir múltiples métodos de acceso sobre una misma cuenta.

Requerimientos funcionales acordados:

1. Google OAuth debía seguir funcionando.
2. Correo seguro/OTP existente debía continuar.
3. Agregar **Contraseña Kawvo** independiente del password de Google o correo.
4. Permitir crear contraseña después de validar OTP al correo actual.
5. Permitir cambiar contraseña con OTP.
6. Permitir login con correo + contraseña Kawvo.
7. Permitir cambiar correo principal con verificación.
8. Mantener identidad de Google vinculada correctamente.
9. Agregar “Olvidé mi contraseña” en login.
10. Recuperación también mediante OTP.
11. No revelar si un correo está registrado.
12. Revocar sesiones anteriores después de un password reset.

---

# 7. RAMA DE TRABAJO Y EVOLUCIÓN DE COMMITS

Rama principal de feature:

`feature/account-access-methods-v1`

Commits relevantes en orden aproximado:

- `ad1a5bfa9e6be1f0e81acfca1d8f12927f9938d7` — dual account access methods patch.
- `29a8bd32bd4363b0df63c2b6a1e2645c74a74040` — preview runner inicial.
- `b4523f7683b58db2115b78fc44a0a142969fca1d` — flexible Kawvo account access methods.
- `eb20f7089b3c56a7c59ac2e933b9f0c6317c580d` — hardening de verificación email.
- `68b05acac90a69386b900b9a356db4e9e71ed704` — manejo de fallos de envío.
- `85faf636c39409b92d4330f8226126191c49976e` — runner de reparación Resend.
- `e30ccde8a83efe497c7d08093584e58dd29199a3` — setup seguro Resend Preview.
- `49e43e3b16920092915599ac5c440990b782ccf7` — restore app preview origin.
- `02d372cdacb225e5cd9d23384b64d051e338216c` — origin Preview resiliente.
- `c6b5eef2b3ec62272d05bdf4b016582eb6afaacd` — secret Resend sin redeploy stale frontdoor.
- `63c8df53cb9c7078b0bd23e95bc2161b69b3e08c` — stable Preview deploy.
- `7fb72fc6a73d2f8370321ab02c91f02c4ea3f2fa` — verified actions ligadas a sesión.
- `b6891aadca617ebb16b2b53a597639767288bfa9` — verificación server-side.
- `261a5e339e8daa00e98c5b0108117a0f55e2c89b` — session binding.
- `be9065667b58ea9edc177d1a63de61a58e3a37bc` — session binding Preview.
- `816152f4f4e3a9d67cfeeffd8fd67e409e61cab1` — runner session-bound.
- `d4a088179e482afb1d18ebc12e8c737cd33c32ac` — HttpOnly secure action cookie.
- `19dff9b053e9d73c9edf065858d4e1684abb1e6c` — canonical preview deploy action cookie.
- `b3316f799a63bad21bfb9e0b4a9b3d6b2ecdf214` — forensic diagnostics.
- `92180f148b2fc302b5e6f9a61cb57a00edc641f5` — live forensic capture.
- `358e0379650f169b5ba8d1b732de2017d3b0e37a` — forensic capture interactivo V2.
- `3b9103957439ae7feb2435dc38cae9e04fda6528` — forensic extractor V3.
- `3fe40049eefdbd9ee7e1199922edf11b2414794d` — fix KDF + consumo autorización.
- `629367ff07d0081aca21b2bca241bfdfdebeb366` — runner del root fix.
- `c30042254dd81accff43f045fd4c15e46e0a1084` — password recovery patch.
- `58160ea836dcb775e4b1e555e8f89d11a67c2267` — preview runner recovery.
- `6fceef2b20c2567b14fbe397b8cb7b42bbcb706f` — secure password recovery.
- `6e30fc1ac49866d210eaddac0c2950e886dd321d` — production release runner.
- `4a838a3c91c6388eb302a510a7c7c7fdf4ffb26f` — ignore generated Preview artifacts in prod precheck.
- `b42da9b302a7cd297cfbbae5733a52e9a236405b` — production resume runner y cierre.

---

# 8. ARCHIVOS DE PRODUCTO CREADOS O MODIFICADOS

## API

### `api/src/account-access-methods.ts`

Archivo central del módulo.

Contiene:

- password hashing;
- OTP challenges;
- verified actions;
- cambio de correo;
- login por password;
- password reset;
- gestión de cookies sensibles;
- rate limits y lockout.

Funciones importantes:

- `sha256Hex()`
- `hex()`
- `parseCookie()`
- `token()`
- `code6()`
- `appUrl()`
- `sessionCookie()`
- `credentialActionCookieName()`
- `credentialActionCookie()`
- `clearCredentialActionCookie()`
- `passwordResetCookieName()`
- `passwordResetCookie()`
- `clearPasswordResetCookie()`
- `passwordHash()`
- `newPasswordRecord()`
- `constantTimeEqual()`
- `currentUser()`
- `requireAccount()`
- `sendVerificationCode()`
- `createChallenge()`
- `verifyChallenge()`
- `createVerifiedAction()`
- `getVerifiedAction()`
- `markVerifiedActionConsumed()`
- `getPasswordResetAction()`

Constantes finales:

```ts
const KDF_ITERATIONS = 100000
const MAX_PASSWORD_ATTEMPTS = 5
```

### `api/src/preview-free-entry.ts`

Se agregó:

```ts
import './account-access-methods'
```

Importante: aunque el nombre diga Preview, `api/wrangler.toml` de producción usa este entry point actualmente.

### `api/src/index.ts`

Modificado para compatibilidad con el nuevo módulo, autenticación y helpers compartidos.

Contiene gran parte del auth histórico:

- magic link;
- Google OAuth;
- session creation;
- requireAuth / requireAdmin;
- CORS;
- cookies.

Cambiar con cautela.

### `api/wrangler.preview.toml`

Modificado durante desarrollo para estabilizar frontdoor Preview.

### `api/wrangler.toml`

No se transformó para usar APP_PAGES_ORIGIN. Producción mantiene arquitectura distinta.

---

# 9. FRONTEND / PANELES

### `app/src/components/admin/free/FreeCredentials.tsx`

Panel nuevo de Credenciales.

Ruta:

`/admin/free/credentials`

Permite:

- visualizar correo principal;
- conocer estado de Google;
- conocer estado de password Kawvo;
- crear password;
- cambiar password;
- iniciar OTP;
- validar OTP;
- cambiar correo.

### `app/src/components/admin/free/FreeAccount.tsx`

Se añadió acceso al panel Credenciales desde Mi Cuenta.

### `app/src/components/admin/AdminLogin.tsx`

Modificado para soportar:

- Correo seguro;
- Contraseña Kawvo;
- Google;
- “Olvidé mi contraseña”;
- recuperación OTP;
- nueva contraseña;
- contextos Team / scan / activación existentes.

No romper:

- `activation=scan`;
- `resume_profile=1`;
- `switch_user=1`;
- flujo Team;
- persistencia de `public_code` / `team_code` en storage cuando corresponda.

### `app/src/App.tsx`

Modificado para registrar routing del panel.

---

# 10. MIGRACIONES

Producción:

- `api/migrations/0060_account_access_methods.sql`
- `api/migrations/0061_account_verified_actions_session.sql`

Preview:

- `api/migrations-preview/0060_account_access_methods.sql`
- `api/migrations-preview/0061_account_verified_actions_session.sql`

## Tablas creadas en 0060

### `user_auth_identities`

Campos:

- `id`
- `user_id`
- `provider`
- `provider_subject`
- `provider_email`
- `linked_at`
- `last_used_at`

Constraint:

`UNIQUE(provider, provider_subject)`

Índice:

`idx_user_auth_identities_user`

### `user_password_credentials`

Campos:

- `user_id` PK/FK
- `password_salt`
- `password_hash`
- `failed_attempts`
- `locked_until`
- `created_at`
- `updated_at`

### `account_verification_challenges`

Campos:

- `id`
- `user_id`
- `email`
- `purpose`
- `code_hash`
- `attempts`
- `expires_at`
- `consumed_at`
- `created_at`

Índice:

`idx_account_verification_active`

### `account_verified_actions`

Campos iniciales:

- `id`
- `user_id`
- `purpose`
- `token_hash`
- `target_email`
- `expires_at`
- `consumed_at`
- `created_at`

Índice:

`idx_account_verified_actions_user`

## 0061

Agrega:

`session_id TEXT`

a `account_verified_actions`.

Índice:

`idx_account_verified_actions_session`

---

# 11. ENDPOINTS FINALES

```text
GET  /api/v1/me/account/credentials
POST /api/v1/me/account/credentials/verify/start
POST /api/v1/me/account/credentials/verify/confirm
POST /api/v1/me/account/password
POST /api/v1/me/account/email/change/start
POST /api/v1/me/account/email/change/confirm
POST /api/v1/auth/password/login
POST /api/v1/auth/password/reset/start
POST /api/v1/auth/password/reset/confirm
POST /api/v1/auth/password/reset/complete
```

---

# 12. SEGURIDAD IMPLEMENTADA

## OTP

- 6 dígitos.
- `crypto.getRandomValues`.
- hash SHA-256 ligado al challenge id.
- no se persiste OTP plano.
- expira en 10 min.
- tiempo validado por D1 `datetime('now')`.
- 5 intentos máximo por challenge.
- 5 retos recientes máximo por usuario/propósito en 10 min.
- successful OTP marca `consumed_at`.

## Password Kawvo

- PBKDF2-SHA256.
- 100000 iteraciones.
- salt aleatorio 16 bytes.
- longitud 8–128.
- hash/salt separados.

## Login password

- error genérico para credenciales incorrectas.
- contador de fallos.
- bloqueo temporal de 15 min al llegar a 5 intentos.
- reset de contador al login exitoso.
- sesión 30 días.

## Verified actions

- token random.
- DB almacena token hash.
- cookie HttpOnly/Secure.
- TTL 10 min.
- single-use.

Cookies:

- Preview: `kawvo_preview_credential_action`
- Prod: `kawvo_credential_action`
- Preview reset: `kawvo_preview_password_reset`
- Prod reset: `kawvo_password_reset`

## Recovery anti-enumeration

`reset/start` responde igual exista o no exista cuenta:

`Si el correo está registrado, recibirás un código de verificación.`

## Revocación de sesiones

Al completar password reset:

- se guarda nueva credencial;
- se consume acción;
- se revocan sesiones activas previas.

---

# 13. PROBLEMA 1: RESEND / ENVÍO OTP

Síntoma inicial:

- `verify/start` retornó 500/503.

Causa:

- `RESEND_API_KEY` faltante/mal configurada en Preview.

Correcciones:

- setup seguro del secret;
- precheck de secret en runners;
- `sendVerificationCode()` valida configuración;
- `createChallenge()` elimina challenge si falla el envío;
- error 503 controlado cuando provider no está disponible.

Lección:

No dejar retos OTP huérfanos si email provider falla.

---

# 14. PROBLEMA 2: REGRESIÓN DE UI PREVIEW POR APP_PAGES_ORIGIN

Síntoma:

Después de tocar secret/redeploy, Preview mostró UI vieja.

Causa:

`APP_PAGES_ORIGIN` estaba fijado a un deployment Pages inmutable anterior.

Arquitectura Preview:

Worker actúa como front-door de:

- `app.preview.intaprd.com/*`
- `preview.intaprd.com/*`

Solución:

Config persistente con alias estable:

`https://feature-account-access-metho.intap-web2.pages.dev`

Durante deploy completo:

1. desplegar Pages;
2. obtener deployment actual;
3. apuntar Worker al deployment recién publicado;
4. restaurar config persistente al alias estable.

Para cambios de secret:

**no redeploy Worker innecesariamente**.

Producción no usa este mismo patrón de proxy de App.

---

# 15. PROBLEMA 3: 403 POST-OTP

Se probaron varias estrategias.

### Intento inicial

Frontend llevaba un verification token.

Problema:

- 403;
- exposición innecesaria del token al cliente.

### Segundo enfoque

Verified action ligada a sesión server-side.

Aún hubo 403 en iteraciones intermedias.

### Diseño final

Cookie de acción sensible:

- HttpOnly;
- Secure;
- scoped path;
- token random;
- token hash en D1;
- TTL;
- single use.

Frontend no maneja token sensible.

---

# 16. INVESTIGACIÓN FORENSE DEL PASSWORD

Después de resolver el 403, el flujo llegaba a OTP válido pero al guardar password aparecía:

`Internal server error`

Se decidió no seguir parcheando a ciegas.

Se crearon runners forenses:

- `scripts/run-preview-account-access-methods-v1-forensic-2026-09-17.sh`
- `scripts/run-preview-account-access-methods-v1-forensic-live-2026-09-17.sh`
- `scripts/run-preview-account-access-methods-v1-forensic-live-v2-2026-09-17.sh`
- `scripts/run-preview-account-access-methods-v1-forensic-extract-v3-2026-09-17.sh`

Hallazgos D1:

- challenge OTP creado;
- challenge expiración correcta;
- OTP consumido;
- attempts = 0;
- verified action creada;
- verified action consumida;
- no existía fila en `user_password_credentials`.

Esto probó que:

- Resend funcionaba;
- OTP funcionaba;
- DB challenge funcionaba;
- verified action funcionaba;
- el fallo ocurría después de autorización y antes de persistir password.

El extractor V3 recuperó la excepción real del Worker.

---

# 17. PROBLEMA 4: PBKDF2 210000 NO SOPORTADO

Error exacto:

`Pbkdf2 failed: iteration counts above 100000 are not supported (requested 210000)`

La implementación usaba inicialmente:

`KDF_ITERATIONS = 210000`

Cloudflare Workers WebCrypto rechazó ese valor.

Corrección final:

```ts
const KDF_ITERATIONS = 100000
```

Debe ser idéntico para:

- creación password;
- cambio password;
- login password;
- password reset.

No cambiar sin prueba específica del runtime.

---

# 18. PROBLEMA 5: VERIFIED ACTION SE CONSUMÍA DEMASIADO PRONTO

Diseño inicial:

1. validar action;
2. marcar action consumida;
3. generar hash;
4. guardar password.

Con el error PBKDF2, la acción se consumía aunque no se hubiera guardado el password.

Corrección:

- usar `getVerifiedAction()` para validar sin consumir;
- generar hash;
- persistir password y consumir acción dentro de `DB.batch()`.

En reset:

- password upsert;
- action consume;
- session revoke;

van juntos en batch.

Principio a conservar:

**una autorización no debe consumirse antes de completar la operación protegida.**

---

# 19. CAMBIO DE CORREO

Flujo final:

1. usuario autenticado inicia cambio;
2. OTP al correo actual (`email_change`);
3. verificación genera action cookie;
4. usuario introduce nuevo correo;
5. backend comprueba que no esté ligado a otra cuenta;
6. OTP al nuevo correo (`email_new`);
7. action anterior se consume después de crear correctamente el nuevo challenge;
8. confirmación del nuevo OTP;
9. `users.email` se actualiza.

No permitir cambio a un email ya usado por otra cuenta.

---

# 20. PASSWORD RESET / “OLVIDÉ MI CONTRASEÑA”

Se agregó después de validar creación/cambio/login.

Flujo:

1. Login → Contraseña Kawvo.
2. “Olvidé mi contraseña”.
3. usuario introduce correo.
4. endpoint devuelve mensaje genérico.
5. si existe cuenta, se envía OTP.
6. usuario confirma OTP.
7. backend crea action `password_reset` y cookie HttpOnly.
8. usuario define nueva contraseña.
9. se genera PBKDF2 con 100000.
10. se actualiza credencial.
11. se consume action.
12. se revocan sesiones previas.
13. cookie reset se limpia.

Validado por usuario:

- contraseña anterior deja de funcionar;
- nueva funciona;
- Google continúa funcionando.

---

# 21. SCRIPTS / RUNNERS CREADOS

Entre otros:

- `scripts/apply-account-access-methods-v1-2026-09-16.py`
- `scripts/apply-account-access-methods-v1-fix-email-2026-09-16.py`
- `scripts/apply-account-password-recovery-v1-2026-09-17.py`
- `scripts/run-preview-account-access-methods-v1-2026-09-16.sh`
- `scripts/run-preview-account-access-methods-v1-fix-email-2026-09-16.sh`
- `scripts/run-preview-account-access-methods-v1-fix-resend-secret-2026-09-16.sh`
- `scripts/run-preview-account-access-methods-v1-set-resend-secret-2026-09-16.sh`
- `scripts/run-preview-account-access-methods-v1-stable-2026-09-17.sh`
- `scripts/run-preview-account-access-methods-v1-restore-app-origin-2026-09-17.sh`
- `scripts/run-preview-account-access-methods-v1-session-verification-2026-09-17.sh`
- `scripts/run-preview-account-access-methods-v1-action-cookie-2026-09-17.sh`
- `scripts/run-preview-account-access-methods-v1-forensic-2026-09-17.sh`
- `scripts/run-preview-account-access-methods-v1-forensic-live-2026-09-17.sh`
- `scripts/run-preview-account-access-methods-v1-forensic-live-v2-2026-09-17.sh`
- `scripts/run-preview-account-access-methods-v1-forensic-extract-v3-2026-09-17.sh`
- `scripts/run-preview-account-access-methods-v1-kdf-root-fix-2026-09-17.sh`
- `scripts/run-preview-account-password-recovery-v1-2026-09-17.sh`
- `scripts/run-production-account-access-methods-v1-2026-09-17.sh`
- `scripts/run-production-account-access-methods-v1-resume-2026-09-17.sh`

Muchos de estos scripts son históricos de diagnóstico. No deben ejecutarse indiscriminadamente en producción.

---

# 22. PREVIEW · ENTORNO Y DATOS

Preview Worker:

`intap-api-preview`

Preview D1:

- nombre: `intap_db_preview`
- ID: `e9f46214-623f-48da-af13-74198e12b222`

Preview R2:

`intap-r2-preview`

Preview App canónica:

`https://app.preview.intaprd.com`

Alias Pages estable de la feature durante trabajo:

`https://feature-account-access-metho.intap-web2.pages.dev`

---

# 23. VALIDACIÓN PREVIEW

Luego del root fix PBKDF2:

- crear password: OK;
- login password: OK;
- Google: OK.

Luego se validó cambio de password:

- OTP;
- cambio;
- nuevo login;
- OK.

Luego password reset:

- Olvidé mi contraseña;
- OTP;
- nueva password;
- old password inválida;
- new password válida;
- Google OK.

El usuario confirmó explícitamente que todo el flujo funcionaba.

---

# 24. RELEASE A PRODUCCIÓN

Se preparó release controlado.

Runner inicial:

`scripts/run-production-account-access-methods-v1-2026-09-17.sh`

Incluía:

- verify branch main;
- verify clean tree;
- strict scope;
- KDF invariant;
- endpoint invariant;
- Resend secret check;
- build App;
- tsc API;
- D1 migrations;
- schema validation;
- API deploy;
- Admin Pages deploy;
- canonical HTTP QA;
- anti-enumeration reset check.

---

# 25. PROBLEMA 6: PRECHECK PRODUCCIÓN BLOQUEADO POR .preview-*

Primer intento se detuvo porque existía:

`.preview-account-password-recovery-v1/`

Era un artefacto local generado por pruebas, no código fuente.

Corrección del runner:

- ignorar de manera segura solo carpetas `.preview-*`;
- seguir bloqueando cualquier otro cambio tracked/untracked no permitido.

Commit:

`4a838a3c91c6388eb302a510a7c7c7fdf4ffb26f`

---

# 26. PROBLEMA 7: MIGRACIONES PENDIENTES INCLUYERON 0046

Al listar migraciones, Wrangler mostró:

- `0046_argenisg_r2_assets.sql`
- `0060_account_access_methods.sql`
- `0061_account_verified_actions_session.sql`

`wrangler d1 migrations apply` aplica todas las pendientes, no solo las de la feature.

Por tanto también se aplicó 0046.

0046:

- crea/asegura `profile_assets`;
- agrega índices;
- actualiza metadata/template_data para `argenisg`;
- no sube binarios a R2.

Lección:

Antes de aplicar migraciones en producción, siempre listar pendientes y revisar si existen migraciones antiguas no aplicadas.

---

# 27. PROBLEMA 8: ERROR DE SHELL EN VALIDACIÓN DE ESQUEMA PROD

Después de aplicar migraciones, el primer runner falló en una command substitution por quoting del SQL con paréntesis.

Importante:

A ese punto:

- D1 ya había aplicado 0046/0060/0061;
- API todavía no se había desplegado;
- App todavía no se había desplegado.

Se evitó repetir migraciones.

Se creó runner de reanudación:

`scripts/run-production-account-access-methods-v1-resume-2026-09-17.sh`

Ese runner:

- NO aplica migraciones;
- verifica que 0060 y 0061 consten en `d1_migrations`;
- verifica las 4 tablas;
- verifica `session_id`;
- verifica Resend;
- build/typecheck;
- deploy API;
- deploy App;
- QA.

---

# 28. RESULTADO FINAL EN PRODUCCIÓN

El runner de reanudación confirmó:

- `migrations_ok = 2` para 0060/0061;
- `tables_ok = 4`;
- `session_col = 1`;
- Resend secret presente;
- build App OK;
- tsc API OK;
- Worker producción desplegado;
- Pages producción desplegado;
- rutas canónicas HTTP 200;
- password reset anti-enumeration HTTP 200.

Worker producción final del release:

`2eb3c267-0be5-4eac-bb6b-5f7764b9af43`

Pages deployment observado:

`https://55220770.intap-web2.pages.dev`

Canónico:

`https://app.intaprd.com`

Main SHA del cierre:

`b42da9b302a7cd297cfbbae5733a52e9a236405b`

El usuario confirmó manualmente que quedó bien en producción.

---

# 29. RUTAS QA FINALES

Confirmadas HTTP 200:

- `https://app.intaprd.com/admin/login`
- `https://app.intaprd.com/admin/free`
- `https://app.intaprd.com/admin/free/account`
- `https://app.intaprd.com/admin/free/credentials`

Además:

- reset público probado con email inexistente;
- respuesta genérica 200 confirmada.

---

# 30. QUÉ NO SE DESPLEGÓ / QUÉ NO SE TOCÓ EN EL RELEASE

- Web público no se desplegó.
- R2 no se modificó por el release de Credenciales.
- No se hizo migración manual de binarios.
- No se alteró el modelo visual de perfiles públicos.
- No se ejecutaron cambios del perfil patrocinado.
- No se ejecutó MED.
- No se ejecutó onboarding nuevo de productos en este frente.

---

# 31. ADVERTENCIAS DE HERRAMIENTAS OBSERVADAS

Entorno local del usuario mostró repetidamente:

- macOS 12.6 no soportado oficialmente por algunas versiones del runtime local Cloudflare;
- Wrangler 3.114.17 desactualizado;
- warning de Pages porque existe `/Users/juanluis/Desktop/wrangler.toml` sin `pages_build_output_dir`;
- warning de chunks >500k;
- browserslist/caniuse-lite desactualizado.

Hasta ahora estos warnings no bloquearon los deploys.

Recomendación: no mezclar actualización grande de Wrangler/Vite con una feature funcional sin hacerla en rama separada y con QA completo.

---

# 32. RECOMENDACIONES PARA PRÓXIMOS PROGRAMADORES

1. Tratar `api/src/account-access-methods.ts` como módulo sensible de auth.
2. No cambiar KDF sin validar Cloudflare Workers.
3. No exponer action tokens al frontend.
4. Mantener cookies HttpOnly/Secure.
5. No almacenar OTP plano.
6. No revelar existencia de cuentas en reset.
7. Mantener lockout de password.
8. Al cambiar email, revisar interacción con Google identities antes de rediseñar.
9. Revisar migraciones pendientes antes de `d1 migrations apply`.
10. En Preview, cuidar APP_PAGES_ORIGIN.
11. En producción, no introducir APP_PAGES_ORIGIN sin decisión arquitectónica explícita.
12. Mantener separación entre perfiles Plus/especiales y perfiles públicos.
13. No romper activación Scan/Team al modificar AdminLogin.
14. Continuar usando runners reproducibles.

---

# 33. PENDIENTES CONOCIDOS / PRÓXIMOS PASOS DEL MAPA

## Prioridad producto

### A. Onboarding / productos

Pendiente retomar:

- usuario logueado: mismo usuario vs otro usuario;
- cierre de sesión controlado para otro usuario;
- vinculación explícita al usuario actual;
- activar/desactivar producto;
- desvincular producto;
- escaneo de producto ya vinculado → redirect directo a perfil publicado;
- comportamiento específico para borrador.

### B. Perfil patrocinado

Pendiente convertir concepto aprobado en feature real:

- estructura de perfil Lite patrocinado;
- galería slider;
- vCard;
- grid botones;
- sponsor strip;
- permisos/ownership;
- modelo de datos;
- onboarding patrocinador → beneficiario.

### C. MED

Pendiente arquitectura y desarrollo del plan médico.

### D. Plantilla editorial

Pendiente para artistas/marcas personales/influencers.

### E. QA técnico futuro

- considerar username hidden/autocomplete en form password para warning de browser;
- revisar bundle size con code splitting en un trabajo separado;
- planificar upgrade de Wrangler en rama específica;
- revisar lifecycle de auth identities si se agregan más providers.

---

# 34. ESTADO FINAL DE ESTE CHAT

**Completado y cerrado:**

- Credenciales V1.
- Google + Correo seguro + Password Kawvo.
- creación/cambio de password.
- login password.
- cambio de email.
- password reset OTP.
- lockout.
- verified action cookies.
- anti-enumeration.
- migraciones.
- Preview QA.
- Producción QA.

**Pendiente según roadmap:**

- onboarding avanzado de productos;
- perfil patrocinado;
- MED;
- plantilla editorial;
- mejoras técnicas no críticas listadas arriba.

---

# 35. COMANDOS DE REFERENCIA DEL PROYECTO

Repositorio local habitual:

```bash
cd "$HOME/Desktop/intap-link-universal-bilingual-audit"
```

Producción Admin build:

```bash
npm run build -w app
```

Producción API typecheck:

```bash
cd api && npx tsc --noEmit
```

Producción API deploy habitual:

```bash
cd api && npx wrangler deploy --config wrangler.toml
```

Producción Admin Pages deploy habitual:

```bash
npx wrangler pages deploy app/dist --project-name intap-web2 --branch main
```

No ejecutar estos comandos de forma aislada para una feature sensible sin repetir prechecks y QA equivalentes a los runners aprobados.

---

# 36. NOTA FINAL DE HANDOFF

El próximo programador debe comenzar leyendo, en este orden:

1. esta bitácora;
2. `api/src/account-access-methods.ts`;
3. `app/src/components/admin/AdminLogin.tsx`;
4. `app/src/components/admin/free/FreeCredentials.tsx`;
5. `api/migrations/0060_account_access_methods.sql`;
6. `api/migrations/0061_account_verified_actions_session.sql`;
7. `api/src/index.ts`;
8. `api/src/preview-free-entry.ts`;
9. runners de producción y Preview más recientes.

Antes de modificar auth, reproducir el flujo en Preview y confirmar que siguen funcionando:

- Google;
- Correo seguro;
- Password Kawvo;
- cambio password;
- cambio correo;
- password reset;
- Team/scan login contexts.

**No considerar una modificación de autenticación terminada hasta validar Preview y Producción por separado.**
