# Kawvo Link — Asistente IA de Perfil Digital

Estado: feature aislado, pendiente de QA E2E en Preview antes de cualquier merge o Producción.

## Propósito

El asistente ayuda al propietario autenticado de un Perfil Digital a convertir información escrita de forma natural en una propuesta estructurada y profesional. No es un chatbot abierto y no publica ni modifica el perfil durante la generación.

Flujo:

1. Kawvo carga el contexto ya existente del perfil.
2. La UI solo pregunta por información que falta o por la intención de mejora.
3. El usuario responde de forma natural.
4. El Worker hace una única llamada a OpenAI Responses API.
5. OpenAI devuelve Structured Output validado por JSON Schema.
6. Kawvo valida nuevamente el resultado.
7. El usuario revisa y puede editar la propuesta.
8. El usuario selecciona qué bloques aplicar.
9. Solo la acción explícita `Aplicar a mi perfil` escribe en D1.

## Campos reales reutilizados

No se creó un modelo de perfil paralelo.

- Título profesional: `profiles.template_data.role`
- Descripción: `profiles.bio`
- Presentación de servicios: `profiles.template_data.services_section_title` y `services_section_description`
- Servicios: `profile_products.title` y `profile_products.description`
- Contexto: `profiles.category`, nombre, contenido existente y `profile_contact`
- CTA: solo sugerencia. No se persiste porque Kawvo determina el CTA real a partir de los canales de contacto existentes.

Los límites de texto replican los editores actuales del producto Free: título profesional 80, bio 300, título de servicio 60, descripción de servicio 90 y presentación de sección 240.

## Endpoints

Todos requieren la sesión real de Kawvo y resuelven el perfil por `user_id`.

- `GET /api/v1/me/ai-profile-assistant/context`
- `POST /api/v1/me/ai-profile-assistant/generate`
- `POST /api/v1/me/ai-profile-assistant/apply`

`generate` nunca escribe contenido de perfil. `apply` vuelve a validar el objeto completo y requiere selección explícita de bloques. Si el usuario ya tiene servicios, el reemplazo requiere confirmación explícita.

## OpenAI

Integración server-side directa desde Cloudflare Worker:

- API: Responses API (`POST /v1/responses`)
- Modelo por defecto: `gpt-5.6-luna`
- Structured Outputs: JSON Schema estricto
- `store: false`
- `reasoning.effort: none`
- `max_output_tokens: 1400`
- Timeout del Worker: 25 segundos

No se usa una API key en `app/` ni en `web/`. `OPENAI_API_KEY` debe existir únicamente como Worker secret.

## Control de costo y abuso

Valores por defecto:

- 8 generaciones por usuario en ventana de 24 horas
- cooldown de 20 segundos
- máximo 700 caracteres por respuesta
- máximo agregado de 2,800 caracteres enviados por el usuario
- máximo 1,400 output tokens
- una sola llamada de IA por generación

Variables opcionales:

- `OPENAI_MODEL`
- `AI_PROFILE_DAILY_LIMIT`
- `AI_PROFILE_COOLDOWN_SECONDS`

La tabla `ai_profile_assistant_usage` registra solamente operación, estado, modelo, tokens, costo estimado y código de error. No guarda respuestas, prompts, propuestas ni conversaciones.

Con GPT-5.6 Luna la estimación implementada usa USD 0.20 por millón de tokens de entrada y USD 1.20 por millón de tokens de salida. El valor registrado es aproximado y debe revisarse si cambia el modelo o el precio oficial.

## Manejo de errores

La UI sigue funcionando si OpenAI falla. El perfil nunca se modifica durante `generate`.

Se manejan explícitamente:

- sesión ausente o expirada;
- secreto no configurado;
- JSON de request inválido;
- entradas demasiado cortas o largas;
- cooldown y límite diario;
- timeout;
- error de red;
- HTTP 429 de OpenAI;
- otros 4xx/5xx upstream;
- Structured Output inválido o incompleto;
- propuesta manipulada antes de `apply`;
- fallo de escritura D1;
- intento de reemplazar servicios sin confirmación.

## Migraciones

Producción:

`api/migrations/0039_ai_profile_assistant_usage.sql`

Preview:

`api/migrations-preview/0039_ai_profile_assistant_usage.sql`

Ambas crean el mismo esquema y dos índices de consulta. No modifican tablas de perfiles existentes.

## QA automatizado

`node scripts/test-ai-profile-assistant-contract.mjs` verifica como guard de regresión:

- Responses API solo en backend;
- ausencia de key o llamada OpenAI en `app/` y `web/`;
- `store: false`;
- JSON Schema estricto;
- autenticación, límites y confirmación de reemplazo;
- validación server-side antes de aplicar;
- escritura agrupada en D1;
- migraciones Preview/Producción equivalentes;
- ruta protegida y acción explícita de aplicación.

El workflow `INTAP LINK quality` ejecuta además builds Web/App para Producción y Preview y TypeScript del Worker/Functions.

## QA E2E obligatorio antes de merge

Usar solamente Preview y una cuenta de prueba. Cubrir:

- perfil nuevo o incompleto;
- perfil existente con identidad/servicios ya guardados;
- español informal, faltas ortográficas y emojis;
- respuestas cortas, extensas, parciales y vacías;
- revisión y edición de propuesta;
- aplicación parcial;
- confirmación de reemplazo de servicios;
- persistencia y render del perfil público Preview;
- timeout/error upstream/429 mediante key inválida o mock controlado si se dispone;
- request sin sesión;
- payload manipulado;
- límites/cooldown;
- móvil, tablet y escritorio;
- regresión de login, onboarding, edición manual, portfolio, servicios, enlaces, QR/NFC y perfiles públicos.

## Configuración Preview

Desde `api/`:

```bash
npx wrangler d1 migrations apply intap_db_preview --remote --config wrangler.preview.toml
npx wrangler secret put OPENAI_API_KEY --config wrangler.preview.toml
npm run deploy:preview
```

La clave no debe escribirse en archivos ni commits. Wrangler la solicita por entrada segura.

## Preparación de Producción

Solo después de QA Preview aprobado y merge autorizado:

```bash
npx wrangler d1 migrations apply intap_db --remote --config wrangler.toml
npx wrangler secret put OPENAI_API_KEY --config wrangler.toml
npm run deploy:production
```

El script de deploy productivo ya exige `INTAP_PRODUCTION_APPROVAL=YES`.

## Rollback

Rollback de aplicación: volver al commit productivo anterior y redeployar el Worker/App desde ese commit. La tabla de métricas puede quedarse sin efecto porque las rutas antiguas no la usan.

Si además se decide revertir el esquema antes de tener datos que deban conservarse:

```sql
DROP INDEX IF EXISTS idx_ai_profile_usage_profile_created;
DROP INDEX IF EXISTS idx_ai_profile_usage_user_created;
DROP TABLE IF EXISTS ai_profile_assistant_usage;
```

No ejecutar ese SQL en Producción si se quiere conservar historial de uso/auditoría.
