# INTAP LINK B2 — Activación de producto + URL dinámica NFC/QR

## Base y límites

- Base exacta: `be6cdfd87c2b14130359a22b7ae8774034542de8`
- Rama creada: `feature/intap-link-dynamic-artifacts-v1`
- Respaldo de origen: `backup/release-be6cdfd-2026-08-11`
- PR #76: solo lectura; no se hizo merge, rebase ni modificación.
- No hubo deploy, SQL remoto, D1 Production, DNS, Cloudflare remoto ni cuentas reales.

## Auditoría inicial

La base ya tenía autenticación por sesión mediante `auth_sessions`, usuarios en `users`, un perfil por usuario mediante `profiles.user_id`, resolución pública en `/api/v1/public/profiles/:slug` y Pages Functions con middleware de metadata. No existía una entidad funcional para artefactos físicos ni códigos de activación.

El onboarding y las rutas existentes del flujo Gratis se conservaron como referencia. No se trasladaron las 41 modificaciones del PR #76. La implementación B2 reutiliza únicamente la sesión existente, `requireAuth`, el vínculo `profiles.user_id` y el patrón de rutas Hono.

## Modelo implementado

`intap_artifacts` separa el producto físico del perfil:

- `public_code` único, aleatorio y estable;
- `product_type` (`card`, `ping`, `bracelet`, `keychain`, `stand`, `qr`, `other`);
- `status` (`unassigned`, `available`, `activated`, `suspended`, `revoked`);
- `owner_user_id` y `profile_id` opcionales;
- timestamps de activación y actualización.

`artifact_activation_codes` guarda exclusivamente `activation_code_hash`, con estado, expiración y uso. El texto plano solo se devuelve una vez al operador del endpoint de provisioning administrativo.

La migración de Producción es `api/migrations/0027_intap_artifacts.sql`. Para el árbol de Preview se añadió `api/migrations-preview/0028_intap_artifacts.sql`, sin ejecutarla remotamente.

## Endpoints

- `POST /api/v1/public/artifacts/activation/inspect`
- `POST /api/v1/admin/artifacts` — provisioning protegido por `requireAdmin`.
- `POST /api/v1/me/artifacts/activate`
- `GET /api/v1/me/artifacts`
- `PATCH /api/v1/me/artifacts/:id/profile`
- `GET /api/v1/public/artifacts/:publicCode/resolve`

La resolución `/l/{public_code}` ocurre en `functions/_middleware.ts`, consulta el resolver del API correspondiente al runtime y devuelve `302` sin caché. El destino se construye desde el slug actual del perfil; si el slug cambia, el `public_code` permanece igual.

## UI mínima

- `/activate`: ingreso e inspección pública del código.
- `/admin/artifacts/activate`: activación después de autenticación.
- `/admin/artifacts`: listado, enlace al perfil y apertura del enlace público.
- `/admin/login`: entrada visible para activar un producto INTAP.

## Seguridad

- activación server-side;
- código de activación normalizado y hasheado con SHA-256;
- `public_code` aleatorio y no secuencial;
- nunca se expone el hash ni el secreto en respuestas públicas;
- ownership validado por sesión;
- perfil validado por `profiles.user_id`;
- reclamación condicionada a `owner_user_id IS NULL` y estados disponibles;
- código usado/revocado y artefacto suspendido/revocado no vuelven a resolver;
- resolver con `Cache-Control: no-store` y redirect temporal `302`.

## Validación local

Pasaron:

- `git diff --check`;
- `npx tsc --noEmit -p api/tsconfig.json`;
- `npx tsc --noEmit -p app/tsconfig.json`;
- `npx tsc --noEmit -p web/tsconfig.json`;
- `bash api/smoke-tests/artifacts-v1.sh`;
- smoke API con doble local en memoria;
- smoke edge de `/l/{public_code}`.

Comandos de smoke runtime:

```bash
./node_modules/.bin/esbuild api/src/index.ts --bundle --platform=node --format=esm --outfile=/tmp/intap-b2-index.mjs
INTAP_B2_INDEX=/tmp/intap-b2-index.mjs node api/smoke-tests/artifacts-v1.mjs

./node_modules/.bin/esbuild functions/_middleware.ts --bundle --platform=node --format=esm --outfile=/tmp/intap-b2-middleware.mjs
INTAP_B2_MIDDLEWARE=/tmp/intap-b2-middleware.mjs node api/smoke-tests/artifact-redirect-v1.mjs
```

## Pendientes fuera de este bloque

- Auditoría física de D1 Preview y despliegue Preview autorizado.
- Provisionamiento real de lotes desde el panel administrativo.
- Rate limiting distribuido específico para intentos de códigos, si se decide añadirlo con un servicio edge.
- Flujos posteriores de transferencia, reemplazo, suspensión administrativa y revocación.
- No se debe aplicar la migración a `intap_db` Production en B2.
