# BITÁCORA / HANDOFF TÉCNICO — KAWVO LINK · CREDENCIALES V1

**Fecha de cierre:** 2026-09-17  
**Repositorio:** `pgcsoluciones/intap-link`  
**Rama de trabajo principal usada durante desarrollo:** `feature/account-access-methods-v1`  
**Rama de producción al cierre:** `main`  
**Estado:** COMPLETADO, VALIDADO EN PREVIEW Y VALIDADO EN PRODUCCIÓN  
**Último SHA funcional validado en producción antes de esta bitácora:** `b42da9b302a7cd297cfbbae5733a52e9a236405b`  
**Worker producción desplegado:** `2eb3c267-0be5-4eac-bb6b-5f7764b9af43`  
**Admin App producción:** `https://app.intaprd.com`  

---

## 1. OBJETIVO DEL TRABAJO

El objetivo de este bloque fue ampliar el sistema de acceso de Kawvo Link sin romper los métodos existentes. El usuario debía poder mantener simultáneamente varios métodos de autenticación vinculados a la misma cuenta:

1. Google OAuth existente.
2. Acceso por correo seguro / magic link existente.
3. Nueva contraseña propia de Kawvo, independiente de la contraseña de Google o del proveedor de correo.
4. Crear y cambiar esa contraseña desde `Mi Cuenta > Credenciales`, siempre con verificación OTP al correo principal.
5. Cambiar el correo principal mediante verificación del correo actual y del correo nuevo.
6. Recuperar una contraseña olvidada desde el Login mediante OTP, sin necesidad de sesión iniciada.
7. Mantener la misma cuenta y el mismo `user_id` al alternar entre Google, correo seguro y contraseña Kawvo.

El alcance fue deliberadamente limitado a autenticación/credenciales, Admin App y API. No se debía desplegar el Web público ni modificar recursos binarios en R2.

---

## 2. MÉTODO DE TRABAJO APROBADO

Este proyecto tiene un método operativo ya acordado y debe preservarse para los próximos programadores:

- El programador/IA construye, modifica y prepara el código.
- Se trabaja en rama feature para Preview.
- Se crean runners reproducibles en `scripts/` para evitar instrucciones manuales largas y reducir errores humanos.
- El usuario solo hace `git pull` y ejecuta el runner indicado.
- Preview se valida funcionalmente antes de tocar producción.
- Producción solo se toca después de validación explícita del usuario.
- No usar `git reset --hard` en instrucciones al usuario.
- Para despliegues sensibles se verifica primero el alcance del diff, secretos requeridos, compilación, migraciones pendientes y rutas canónicas.
- No introducir trabajo no relacionado dentro de un release de credenciales.

Ruta local habitual del usuario:

```bash
$HOME/Desktop/intap-link-universal-bilingual-audit
```

---

## 3. ARQUITECTURA RELEVANTE

### Admin App

Proyecto Cloudflare Pages:

- Proyecto: `intap-web2`
- Producción: `https://app.intaprd.com`
- Build producción: `npm run build -w app`
- Deploy producción: `npx wrangler pages deploy app/dist --project-name intap-web2 --branch main`

### API

Worker producción:

- Nombre: `intap-api`
- Config: `api/wrangler.toml`
- Entry point producción: `src/preview-free-entry.ts`
- Deploy: `cd api && npx wrangler deploy --config wrangler.toml`

Worker Preview:

- Nombre: `intap-api-preview`
- Config: `api/wrangler.preview.toml`
- Rutas front-door: `app.preview.intaprd.com/*` y `preview.intaprd.com/*`

### D1

Producción:

- Binding: `DB`
- Base: `intap_db`
- ID: `3a2d724d-5938-4777-a63e-423bb41862c0`

Preview:

- Base: `intap_db_preview`
- ID: `e9f46214-623f-48da-af13-74198e12b222`

### R2

Producción:

- Bucket `intap-r2`

Preview:

- Bucket `intap-r2-preview`

Este bloque no modificó binarios de R2.

---

## 4. PANEL / UI CREADO Y MODIFICADO

### `app/src/components/admin/free/FreeCredentials.tsx`

Se creó el panel de Credenciales dentro de Mi Cuenta.

Ruta:

```text
/admin/free/credentials
```

Capacidades del panel:

- Mostrar correo principal actual.
- Mostrar si Google está vinculado.
- Mostrar email del proveedor Google cuando existe.
- Mostrar si contraseña Kawvo está habilitada.
- Crear contraseña Kawvo.
- Cambiar contraseña Kawvo.
- Solicitar OTP para operaciones sensibles.
- Flujo para cambio de correo.
- Mensajes de éxito/error.

### `app/src/components/admin/free/FreeAccount.tsx`

Se modificó para incluir acceso hacia Credenciales desde Mi Cuenta.

### `app/src/components/admin/AdminLogin.tsx`

Se amplió el Login para incluir:

- Selector `Correo seguro` / `Contraseña Kawvo`.
- Login con email + contraseña Kawvo.
- Conservación del login Google.
- Conservación del flujo de correo seguro / magic link.
- Enlace `Olvidé mi contraseña`.
- Flujo público de recuperación:
  - ingresar correo;
  - recibir OTP;
  - confirmar OTP;
  - establecer nueva contraseña.

Se tuvo cuidado de no interferir con contextos especiales de activación por producto, scan o Team.

### `app/src/App.tsx`

Se agregó/ajustó la ruta para Credenciales.

---

## 5. API NUEVA DE CREDENCIALES

### Archivo principal

`api/src/account-access-methods.ts`

Este archivo concentra la lógica del nuevo módulo.

Funciones/áreas principales implementadas:

### Hash y utilidades

- `sha256Hex()`
- `hex()`
- `parseCookie()`
- `token()`
- `code6()`
- `passwordHash()`
- `newPasswordRecord()`
- `constantTimeEqual()`

### Contexto de cuenta

- `currentUser()`
- `requireAccount()`

La sesión se valida contra `auth_sessions`, usando hash de cookie, expiración y `revoked_at IS NULL`.

### OTP / verificación

- `sendVerificationCode()`
- `createChallenge()`
- `verifyChallenge()`

Características:

- OTP de 6 dígitos.
- OTP almacenado como hash, no en texto plano.
- Expira en 10 minutos.
- Máximo 5 intentos por reto.
- Rate limit de solicitudes recientes.
- Tiempo autoritativo tomado desde D1 mediante `datetime('now')`.
- Envío por Resend.
- Si Resend falla, el challenge recién creado se elimina para no dejar un reto imposible de completar.

### Acciones verificadas posteriores al OTP

- `createVerifiedAction()`
- `getVerifiedAction()`
- `markVerifiedActionConsumed()`

Se usa una autorización de corta duración separada del OTP.

Cookie de acción:

- Preview: `kawvo_preview_credential_action`
- Producción: `kawvo_credential_action`

La cookie se construye mediante `buildScopedCookie`, con propiedades HttpOnly/Secure y path restringido a `/api/v1/me/account` para operaciones autenticadas.

### Endpoints autenticados

```text
GET  /api/v1/me/account/credentials
POST /api/v1/me/account/credentials/verify/start
POST /api/v1/me/account/credentials/verify/confirm
POST /api/v1/me/account/password
POST /api/v1/me/account/email/change/start
POST /api/v1/me/account/email/change/confirm
```

### Login con contraseña

```text
POST /api/v1/auth/password/login
```

Características:

- Busca usuario por email normalizado.
- Verifica hash PBKDF2.
- Respuesta uniforme de credenciales incorrectas.
- Cuenta intentos fallidos.
- Bloqueo temporal después de 5 fallos.
- `locked_until` por 15 minutos.
- Al login correcto:
  - reinicia contador de fallos;
  - crea sesión en `auth_sessions`;
  - usa la misma infraestructura de cookie de sesión existente.

### Recuperación pública de contraseña

```text
POST /api/v1/auth/password/reset/start
POST /api/v1/auth/password/reset/confirm
```

Diseño:

- No requiere sesión.
- Respuesta de inicio anti-enumeración: no revela si el correo existe.
- Si existe cuenta válida, se envía OTP.
- Confirmación OTP habilita restablecimiento.
- Nueva contraseña se guarda con el mismo KDF usado en login.
- Al restablecer contraseña se revocan sesiones anteriores para reducir riesgo en caso de cuenta comprometida.
- Google y correo seguro siguen disponibles.

---

## 6. KDF DE CONTRASEÑAS

Diseño final:

```text
PBKDF2-SHA256
100000 iteraciones
salt aleatorio de 16 bytes
hash derivado de 256 bits
```

Constante:

```ts
const KDF_ITERATIONS = 100000
```

### Problema crítico detectado

Inicialmente se configuró:

```text
210000 iteraciones
```

El flujo llegaba correctamente hasta después del OTP, pero la contraseña nunca se persistía.

El error forense real extraído del Worker fue:

```text
NotSupportedError: Pbkdf2 failed: iteration counts above 100000 are not supported (requested 210000).
```

Esto era una limitación concreta del runtime WebCrypto de Cloudflare Workers usado por el proyecto.

### Corrección

Se bajó el KDF a `100000`, manteniendo exactamente el mismo valor para:

- creación/cambio de contraseña;
- login;
- recuperación de contraseña.

No deben cambiarse las iteraciones en un solo lado sin estrategia explícita de versionado/migración de hashes.

---

## 7. ERROR DE AUTORIZACIÓN POST-OTP Y CORRECCIÓN DE DISEÑO

Durante la depuración se identificó otro problema importante de diseño.

La primera implementación hacía:

1. validar OTP;
2. consumir la autorización verificada;
3. calcular hash;
4. guardar contraseña.

Si el hash o la escritura fallaban, la autorización quedaba consumida aunque la contraseña no se hubiera guardado.

Esto ocurrió realmente durante el fallo de PBKDF2.

### Evidencia forense

D1 mostraba:

- OTP challenge creado;
- OTP challenge consumido con `attempts = 0`;
- verified action creada;
- verified action consumida;
- `user_password_credentials`: 0 filas para el usuario.

Esto demostró que el OTP estaba funcionando y que el fallo era posterior a la autorización.

### Corrección final

La lógica se cambió para:

1. obtener/verificar la acción sin consumirla;
2. calcular el hash;
3. persistir contraseña;
4. consumir acción verificada dentro del bloque de persistencia D1.

En password se usa `DB.batch()` para guardar credencial y marcar la acción consumida como una unidad de escritura.

También se corrigió el cambio de correo para no consumir prematuramente la autorización del correo actual antes de que se haya creado correctamente el reto para el correo nuevo.

---

## 8. BASE DE DATOS / MIGRACIONES CREADAS

### `api/migrations/0060_account_access_methods.sql`

También existe equivalente Preview:

`api/migrations-preview/0060_account_access_methods.sql`

Crea:

### Tabla `user_auth_identities`

Campos:

- `id`
- `user_id`
- `provider`
- `provider_subject`
- `provider_email`
- `linked_at`
- `last_used_at`

Restricción:

```text
UNIQUE(provider, provider_subject)
```

Índice:

```text
idx_user_auth_identities_user
```

Uso principal: mantener identidad de proveedores como Google asociada al mismo usuario interno.

### Tabla `user_password_credentials`

Campos:

- `user_id` PK/FK a users
- `password_salt`
- `password_hash`
- `failed_attempts`
- `locked_until`
- `created_at`
- `updated_at`

No se guarda contraseña en texto plano.

### Tabla `account_verification_challenges`

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

```text
idx_account_verification_active
```

### Tabla `account_verified_actions`

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

```text
idx_account_verified_actions_user
```

### `api/migrations/0061_account_verified_actions_session.sql`

También existe equivalente Preview.

Agrega:

```text
session_id TEXT
```

Y el índice:

```text
idx_account_verified_actions_session
```

Objetivo: poder vincular acciones verificadas sensibles a contexto de sesión cuando aplica.

---

## 9. ENSAMBLAJE DEL API

### `api/src/preview-free-entry.ts`

Se agregó:

```ts
import './account-access-methods'
```

Importante: aunque el nombre del archivo diga `preview-free-entry`, en `api/wrangler.toml` este archivo es actualmente el entry point de producción. No cambiar esta suposición sin revisar antes la configuración real de Wrangler.

### `api/src/index.ts`

Fue modificado durante este bloque para ajustes relacionados a infraestructura de auth/cookies/error handling e integración necesaria del módulo.

El error handler global relevante sigue registrando:

```text
[onError]
```

sin exponer el detalle técnico al cliente final.

---

## 10. RESEND / OTP

Dependencia usada en API:

```json
"resend": "^6.9.2"
```

Variable:

```text
RESEND_FROM = noreply@intaprd.com
```

Secret requerido:

```text
RESEND_API_KEY
```

Se confirmó el secret tanto en Preview como en producción antes de release.

### Error inicial de correo

Al principio `verify/start` devolvió errores 500/503 por configuración de Resend. Se endureció el manejo de fallos para:

- detectar proveedor no configurado;
- devolver mensaje controlado;
- borrar challenge si no pudo enviarse el correo;
- no dejar OTP huérfanos.

---

## 11. PROBLEMA DE FRONT-DOOR EN PREVIEW

Preview tiene una particularidad que no debe olvidarse.

El Worker de Preview actúa como front-door de:

```text
app.preview.intaprd.com/*
preview.intaprd.com/*
```

Y usa:

```text
APP_PAGES_ORIGIN
```

Durante la configuración del secret de Resend, un redeploy con un `APP_PAGES_ORIGIN` antiguo hizo que la UI de Preview pareciera haber retrocedido a una versión vieja.

No era pérdida de código: el Worker estaba proxyando hacia un deployment Pages obsoleto.

### Corrección

`api/wrangler.preview.toml` quedó con alias estable:

```text
https://feature-account-access-metho.intap-web2.pages.dev
```

Los runners completos de Preview pueden apuntar temporalmente al deployment Pages inmutable recién generado y luego restaurar el alias estable.

**Regla para el próximo programador:**

- No redeployar el Worker Preview por cambios de secrets si no es necesario.
- Un `wrangler secret put` puede actualizar el secret sin forzar un redeploy con origen Pages obsoleto.
- Antes de diagnosticar una “regresión de UI” en Preview, comprobar `APP_PAGES_ORIGIN`.

Producción no usa esta arquitectura de front-door para Admin App y no tiene `APP_PAGES_ORIGIN` en `api/wrangler.toml`.

---

## 12. FORENSIA REALIZADA

Se evitó seguir haciendo parches a ciegas y se creó una secuencia de diagnóstico.

Scripts creados:

- `scripts/run-preview-account-access-methods-v1-forensic-2026-09-17.sh`
- `scripts/run-preview-account-access-methods-v1-forensic-live-2026-09-17.sh`
- `scripts/run-preview-account-access-methods-v1-forensic-live-v2-2026-09-17.sh`
- `scripts/run-preview-account-access-methods-v1-forensic-extract-v3-2026-09-17.sh`

### Hallazgos de D1

Se verificó en remoto:

- esquema correcto de challenges;
- esquema correcto de verified actions;
- esquema correcto de password credentials;
- índices existentes;
- reloj de D1 correcto;
- OTP consumido correctamente;
- `attempts = 0` en OTP válido;
- verified action creada y consumida;
- contraseña no persistida cuando ocurría el error.

### Captura de Worker

El V2 capturó el evento POST real a:

```text
/api/v1/me/account/password
```

El extractor V3 recuperó el mensaje completo:

```text
NotSupportedError: Pbkdf2 failed: iteration counts above 100000 are not supported (requested 210000).
```

Esto confirmó la causa raíz y permitió corregirla sin suposiciones.

---

## 13. SCRIPTS / RUNNERS CREADOS DURANTE EL BLOQUE

Los siguientes scripts quedaron en el repositorio como historial operativo y de diagnóstico:

### Aplicadores

- `scripts/apply-account-credentials-panel-v1-2026-09-16.py`
- `scripts/apply-account-access-methods-v1-2026-09-16.py`
- `scripts/apply-account-access-methods-v1-fix-email-2026-09-16.py`
- `scripts/apply-account-password-recovery-v1-2026-09-17.py`

### Preview / despliegue

- `scripts/run-preview-account-credentials-panel-v1-2026-09-16.sh`
- `scripts/run-preview-account-access-methods-v1-2026-09-16.sh`
- `scripts/run-preview-account-access-methods-v1-fix-email-2026-09-16.sh`
- `scripts/run-preview-account-access-methods-v1-fix-resend-secret-2026-09-16.sh`
- `scripts/run-preview-account-access-methods-v1-set-resend-secret-2026-09-16.sh`
- `scripts/run-preview-account-access-methods-v1-restore-app-origin-2026-09-17.sh`
- `scripts/run-preview-account-access-methods-v1-stable-2026-09-17.sh`
- `scripts/run-preview-account-access-methods-v1-session-verification-2026-09-17.sh`
- `scripts/run-preview-account-access-methods-v1-action-cookie-2026-09-17.sh`
- `scripts/run-preview-account-access-methods-v1-kdf-root-fix-2026-09-17.sh`
- `scripts/run-preview-account-password-recovery-v1-2026-09-17.sh`

### Forense

- `scripts/run-preview-account-access-methods-v1-forensic-2026-09-17.sh`
- `scripts/run-preview-account-access-methods-v1-forensic-live-2026-09-17.sh`
- `scripts/run-preview-account-access-methods-v1-forensic-live-v2-2026-09-17.sh`
- `scripts/run-preview-account-access-methods-v1-forensic-extract-v3-2026-09-17.sh`

### Producción

- `scripts/run-production-account-access-methods-v1-2026-09-17.sh`
- `scripts/run-production-account-access-methods-v1-resume-2026-09-17.sh`

---

## 14. RELEASE A PRODUCCIÓN — INCIDENTES Y RESOLUCIÓN

### Primer bloqueo: árbol local “sucio”

El runner de producción detectó:

```text
.preview-account-password-recovery-v1/
```

Era un artefacto local generado por pruebas Preview, no código del proyecto.

El runner se corrigió para ignorar exclusivamente carpetas `.preview-*` generadas, manteniendo bloqueo para cambios tracked u otros archivos locales inesperados.

Commit relevante:

```text
4a838a3c91c6388eb302a510a7c7c7fdf4ffb26f
```

### Segundo incidente: migración extra pendiente

Al listar migraciones de producción aparecieron:

```text
0046_argenisg_r2_assets.sql
0060_account_access_methods.sql
0061_account_verified_actions_session.sql
```

Wrangler `d1 migrations apply` aplica todas las migraciones pendientes, no una selección arbitraria. Por eso también aplicó `0046_argenisg_r2_assets.sql`.

La 0046:

- crea/asegura tabla `profile_assets`;
- crea índices;
- actualiza metadata del perfil `argenisg` para assets R2;
- no sube ni modifica binarios en R2.

### Tercer incidente: error de shell en validación post-migración

Después de aplicar las migraciones, el runner falló por quoting incorrecto en un `command substitution` que ejecutaba SQL de validación.

Importante: en ese momento D1 ya había aplicado las migraciones, pero API y App aún no se habían desplegado.

Para no volver a aplicar migraciones se creó:

```text
scripts/run-production-account-access-methods-v1-resume-2026-09-17.sh
```

Ese runner:

1. verifica que 0060/0061 estén registradas en `d1_migrations`;
2. verifica las 4 tablas;
3. verifica columna `session_id`;
4. verifica `RESEND_API_KEY`;
5. compila App/API;
6. despliega API;
7. despliega Admin App;
8. ejecuta QA canónico;
9. no vuelve a ejecutar migraciones.

---

## 15. RESULTADO FINAL DE PRODUCCIÓN

Validación final D1:

```text
migrations_ok = 2
tables_ok = 4
session_col = 1
```

Worker producción:

```text
Current Version ID: 2eb3c267-0be5-4eac-bb6b-5f7764b9af43
```

Pages production deployment generado durante release:

```text
https://55220770.intap-web2.pages.dev
```

Canonicales verificados HTTP 200:

```text
https://app.intaprd.com/admin/login
https://app.intaprd.com/admin/free
https://app.intaprd.com/admin/free/account
https://app.intaprd.com/admin/free/credentials
```

También se verificó:

```text
POST /api/v1/auth/password/reset/start
```

con correo inexistente y respuesta HTTP 200 genérica para confirmar anti-enumeración.

El usuario realizó validación manual en producción y confirmó que el flujo quedó correcto.

---

## 16. VALIDACIONES FUNCIONALES REALIZADAS POR EL USUARIO

En Preview se confirmó manualmente:

- crear contraseña Kawvo;
- cambiar contraseña Kawvo;
- iniciar sesión con contraseña Kawvo;
- iniciar sesión con Google después de activar contraseña;
- ambos métodos llevan a la misma cuenta;
- cambio de correo;
- recuperación de contraseña por `Olvidé mi contraseña`;
- OTP de recuperación;
- contraseña anterior deja de funcionar;
- contraseña nueva funciona;
- Google continúa funcionando después del reset.

Después del release el usuario confirmó que producción también quedó correcta.

---

## 17. COMMITS CLAVE DEL BLOQUE

Secuencia importante, útil para rastrear decisiones:

```text
ad1a5bfa  feat: add dual account access methods patch
29a8bd32  chore: add preview runner for account access methods
b4523f76  feat: add flexible Kawvo account access methods
eb20f708  fix: harden credential verification email flow
68b05aca  fix: handle verification email failures in credentials
85faf636  chore: add exact Resend secret repair runner
e30ccde8  chore: add secure preview Resend secret setup runner
49e43e3b  fix: restore correct app preview origin after resend setup
02d372cd  fix: make preview app origin resilient to worker redeploys
c6b5eef2  fix: update preview Resend secret without redeploying stale frontdoor
63c8df53  chore: add canonical stable preview deploy for account access methods
7fb72fc6  fix: bind verified credential actions to active session
b6891aad  fix: keep credential verification server-side
261a5e33  feat: bind verified actions to auth session
be906566  feat: bind verified actions to auth session in preview
816152f4  chore: add session-bound credential verification preview runner
d4a08817  fix: bind credential verification to secure httpOnly action cookie
19dff9b0  chore: add canonical preview deploy for secure credential action cookie
b3316f79  chore: add forensic diagnostics for credentials flow
92180f14  chore: add live forensic capture for credential password failure
358e0379  chore: make credential forensic capture explicitly interactive
3b910395  chore: add forensic extractor for captured password failure
3fe40049  fix: align password KDF with Workers and consume auth after persistence
629367ff  chore: add preview runner for forensic password root fix
c3004225  feat: add password recovery flow patch
58160ea8  chore: add password recovery preview runner
6fceef2b  feat: add secure password recovery
6e30fc1a  chore: add controlled production credentials release runner
4a838a3c  fix: ignore generated preview audit artifacts in production precheck
b42da9b3  fix: add safe production credentials release resume
```

---

## 18. ARCHIVOS PRINCIPALES QUE DEBE CONOCER EL PRÓXIMO PROGRAMADOR

Para continuar cualquier trabajo de autenticación, empezar por:

```text
api/src/account-access-methods.ts
app/src/components/admin/AdminLogin.tsx
app/src/components/admin/free/FreeCredentials.tsx
app/src/components/admin/free/FreeAccount.tsx
app/src/App.tsx
api/src/preview-free-entry.ts
api/src/index.ts
api/lib o api/src/lib/cookies según import actual
api/migrations/0060_account_access_methods.sql
api/migrations/0061_account_verified_actions_session.sql
api/wrangler.toml
api/wrangler.preview.toml
```

Para Preview y release, revisar también runners de este bloque antes de escribir comandos nuevos desde cero.

---

## 19. INVARIANTES QUE NO DEBEN ROMPERSE

### Autenticación

- Google debe seguir funcionando.
- Correo seguro / magic link debe seguir funcionando.
- Contraseña Kawvo es adicional, no sustituta.
- Todos los métodos deben resolver al mismo usuario interno cuando corresponda.
- Nunca guardar contraseña, OTP o token sensible en texto plano.
- OTP y acciones sensibles deben expirar.
- Recuperación debe mantener respuesta anti-enumeración.
- Login fallido no debe revelar si el email existe.

### KDF

- No subir PBKDF2 por encima de 100000 en este runtime sin cambiar de estrategia/runtime y hacer pruebas reales.
- Si se cambia algoritmo o iteraciones, se necesita versionado/migración de hashes.

### Preview

- Revisar `APP_PAGES_ORIGIN` antes de redeployar Worker Preview.
- No confundir regresión de proxy con pérdida de código.

### Producción

- `api/wrangler.toml` no debe incorporar `APP_PAGES_ORIGIN`.
- No usar configuración Preview para producción.
- Revisar migraciones pendientes antes de `d1 migrations apply`, porque Wrangler aplicará todas las pendientes.

---

## 20. WARNINGS NO BLOQUEANTES OBSERVADOS

Durante builds/deploy se repitieron:

### macOS

```text
Unsupported macOS version 12.6.0
Cloudflare recomienda 13.5+
```

No impidió los despliegues actuales, pero conviene actualizar entorno cuando sea posible.

### Wrangler

Versión usada:

```text
3.114.17
```

Cloudflare avisó que existe Wrangler 4.x.

Recomendación: actualizar en una rama de mantenimiento separada, no dentro de un cambio funcional sensible, porque puede alterar defaults y comportamiento de deploy.

### Pages + wrangler.toml en raíz del Desktop

Wrangler detectó:

```text
/Users/juanluis/Desktop/wrangler.toml
```

sin `pages_build_output_dir`; lo ignoró correctamente. Conviene limpiar o aislar esa configuración global en el futuro para evitar ruido y posibles confusiones.

### Bundle App

Vite advirtió chunk principal >500 kB.

No es bloqueo funcional. Pendiente de optimización futura mediante code splitting/dynamic imports.

### Browserslist

`caniuse-lite` estaba desactualizado varios meses. Mantenimiento futuro, no mezclado con release de credenciales.

---

## 21. PENDIENTES TÉCNICOS RECOMENDADOS DEL MÓDULO

Credenciales V1 está cerrado funcionalmente, pero hay mejoras que pueden planificarse sin urgencia:

1. Revisar warning del navegador sobre formularios de contraseña que prefieren un campo username/email con `autocomplete="username"`; si reaparece, agregar input username correctamente asociado al form.
2. Añadir tests automáticos API para:
   - OTP válido/expirado;
   - límite de intentos;
   - login fallido y lockout;
   - reset anti-enumeración;
   - contraseña anterior inválida tras reset;
   - acción verificada one-time.
3. Añadir pruebas de integración que garanticen que Google y password convergen al mismo `user_id`.
4. Evaluar limpieza programada de challenges/actions expirados si el volumen crece.
5. Evaluar política futura de cierre de otras sesiones al cambiar contraseña desde sesión autenticada, si se desea el mismo comportamiento del reset público.
6. Actualizar Wrangler y entorno macOS en un bloque de mantenimiento separado.
7. Optimizar bundle de Admin App, sin mezclarlo con auth.

---

## 22. MAPA DE RUTA / SIGUIENTE BLOQUE DE TRABAJO

El bloque Credenciales fue priorizado y ya está cerrado. Antes de iniciarlo quedaron otros frentes discutidos que pueden retomarse como siguientes etapas, cada uno en rama separada:

### A. Perfil patrocinado

Concepto acordado previamente:

- perfil Lite/simple para profesional independiente;
- portada + avatar;
- datos de contacto esenciales;
- galería tipo slider con capacidad hasta 10 trabajos, mostrando solo varias cards a la vez;
- `Guardar mi contacto` / vCard;
- botones de contacto en 2 filas x 2 columnas cuando aplique;
- separación visual fina entre secciones;
- sección `Contáctame` / redes;
- cintillo/banner discreto `Impulsado por [empresa patrocinadora]` al final;
- no usar texto interno como “perfil promocional” en la UI pública.

Este frente debe diseñarse primero como producto y plantilla y luego definir modelo de sponsor/tenant si va a ser dinámico.

### B. Plantilla editorial para marca personal / artistas / influencers

Pendiente conceptual ya mencionado, separado de Free estándar.

### C. Plan MED

Idea pendiente:

- categoría medicina/odontología/cirugía estética;
- subplantillas prearmadas por especialidad;
- onboarding específico;
- campos clínico-profesionales mínimos;
- hasta 2 centros con horarios;
- aseguradoras;
- posible zona de patrocinio interno.

Debe tratarse como plan/producto separado y no sobrecargar Free.

### D. Onboarding / activación de productos

Pendientes ya discutidos en el proyecto y que deben respetar el método de trabajo:

- si usuario ya está logueado al confirmar producto, preguntar si es para el mismo usuario o para otro;
- nunca asumir que el producto será para la cuenta actual;
- si es otro usuario, permitir cerrar sesión y continuar;
- si es mismo usuario, avisar que se vinculará el producto al perfil actual;
- activar/desactivar producto desde Mis Productos;
- desvincular producto con reglas seguras;
- al escanear un producto ya vinculado a perfil publicado, redirigir directamente al perfil sin mostrar aviso de vinculación;
- si perfil está en borrador, conservar pantalla de “en construcción”/propietario según flujo aprobado.

Antes de ejecutar este bloque, revisar bitácoras más recientes de scan-to-claim, Team y onboarding para no reabrir problemas ya cerrados.

---

## 23. ESTADO FINAL

**Credenciales V1:** COMPLETO.  
**Preview:** VALIDADO.  
**Producción:** DESPLEGADO Y VALIDADO MANUALMENTE.  
**Google:** OK.  
**Correo seguro:** OK.  
**Contraseña Kawvo:** OK.  
**Cambio de contraseña:** OK.  
**Cambio de correo:** OK.  
**Olvidé mi contraseña + OTP:** OK.  
**Anti-enumeración:** OK.  
**D1 0060/0061:** APLICADAS Y VERIFICADAS.  
**Web público:** NO DESPLEGADO EN ESTE BLOQUE.  
**R2:** NO MODIFICADO POR CREDENCIALES.  

Para el próximo programador: no rehacer este módulo desde cero. Partir del estado actual de `main`, leer este handoff y revisar `api/src/account-access-methods.ts`, `AdminLogin.tsx`, `FreeCredentials.tsx`, migraciones 0060/0061 y los runners de Preview/Producción antes de tocar autenticación.
