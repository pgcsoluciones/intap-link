# Kawvo Link — Asistente IA de Perfil Digital

Estado: feature aislado en `feature/kawvo-ai-profile-assistant`, pendiente de QA E2E en Preview. Producción y merge permanecen bloqueados hasta autorización expresa.

## Propósito

El Asistente IA de Kawvo es una experiencia guiada dentro del editor del Perfil Digital. No es un chatbot abierto ni un editor autónomo del diseño.

Su misión es ayudar a completar, mejorar y revisar contenido real del perfil para causar una mejor primera impresión digital: quién es la persona o negocio, qué hace, qué valor aporta y cuál es el siguiente paso.

La IA puede leer contexto, pero nunca cambia por sí sola plantilla, colores, orden de botones, orden de secciones, estructura visual, configuración, publicación ni imágenes.

## Flujo de producto

1. Kawvo autentica al usuario y resuelve su perfil por `user_id`.
2. Antes del primer uso exige aceptación versionada de condiciones específicas del Asistente IA.
3. Kawvo carga contexto no sensible: identidad, actividad, copy existente, servicios, canales configurados y límites del plan.
4. La UI realiza pocas preguntas puntuales y evita preguntar lo que Kawvo ya conoce.
5. Si existen varios canales compatibles y falta preferencia, la UI pide elegir entre los canales realmente configurados sin cambiar los Botones rápidos.
6. El Worker llama a OpenAI únicamente cuando corresponde y solo desde backend.
7. El modelo devuelve uno de dos estados: `ready` o `needs_more_info`.
8. `needs_more_info` permite como máximo 3 preguntas y como máximo el número de rondas configurado por backend.
9. `ready` devuelve una propuesta editable más sugerencias textuales de imágenes.
10. El usuario revisa y selecciona qué aplicar.
11. Solo `Aplicar a mi perfil` escribe campos seleccionados en D1.
12. Aplicar nunca publica el perfil.

## Cerebro editorial Kawvo

El prompt de sistema define al modelo como estratega de presentación, posicionamiento y copy, no como generador genérico de frases.

Principios implementados:

- primera impresión digital como misión central;
- perspectiva del visitante, no del formulario;
- hechos confirmados separados de inferencias razonables;
- prohibición explícita de inventar servicios, precios, experiencia, certificaciones, clientes, garantías, resultados o ventajas;
- copy adaptado al sector;
- español natural para República Dominicana sin jerga innecesaria;
- coherencia entre título, bio, servicios y CTA;
- preferencia por especificidad sobre frases vacías;
- prioridad móvil;
- revisión silenciosa de claridad, credibilidad, diferenciación, conversión y redundancia antes de devolver `ready`;
- preservación de buenos textos existentes cuando su esencia ya es útil.

## Contrato del modelo

El backend valida una unión discriminada estricta:

`ready`:

```json
{
  "status": "ready",
  "proposal": {
    "professional_title": "...",
    "bio": "...",
    "services_section_title": "...",
    "services_section_description": "...",
    "services": [{ "title": "...", "description": "..." }],
    "cta": { "label": "...", "goal": "quote" },
    "image_suggestions": [{ "purpose": "...", "suggestion": "..." }]
  }
}
```

`needs_more_info`:

```json
{
  "status": "needs_more_info",
  "questions": ["..."]
}
```

No se acepta `proposal` junto con `needs_more_info` ni `questions` junto con `ready`. El backend normaliza el máximo a 3 preguntas y vuelve a validar todos los campos antes de cualquier escritura.

## Campos reales reutilizados

No existe un modelo paralelo de perfil:

- título profesional: `profiles.template_data.role`;
- bio: `profiles.bio`;
- presentación de servicios: `profiles.template_data.services_section_title` y `services_section_description`;
- servicios: `profile_products.title` y `profile_products.description`;
- contexto: `profiles.category`, nombre, contenido existente y `profile_contact`;
- CTA: recomendación editorial solamente; no modifica canales ni Botones rápidos;
- imágenes: recomendaciones textuales solamente; nunca generación o modificación automática.

La actualización de servicios existentes es no destructiva: conserva ID, imagen, precio, texto WhatsApp, destacado y cualquier otro campo no editorial. El asistente nunca ejecuta `DELETE FROM profile_products`.

## Endpoints

Todos requieren sesión Kawvo válida:

- `GET /api/v1/me/ai-profile-assistant/context`
- `POST /api/v1/me/ai-profile-assistant/terms/accept`
- `POST /api/v1/me/ai-profile-assistant/generate`
- `POST /api/v1/me/ai-profile-assistant/apply`

El cliente nunca indica qué perfil editar; el backend resuelve el perfil mediante el usuario autenticado.

## Consentimiento versionado

Migración `0040_ai_assistant_terms_acceptances.sql` crea `ai_assistant_terms_acceptances` con:

- `id`
- `user_id`
- `terms_version`
- `accepted_at`
- `locale`
- `source`

La versión requerida se controla con `AI_TERMS_VERSION`. Si una versión nueva materialmente distinta se configura, los usuarios que solo aceptaron una anterior vuelven a ver el consentimiento.

La misma migración prepara `ai_assistant_access_controls`, separado de las cuotas normales, para suspensiones de seguridad/abuso sin confundir a quien simplemente agotó su uso legítimo.

La redacción contractual se encuentra en `docs/KAWVO_AI_ASSISTANT_TERMS_V1_DRAFT.md` y debe recibir revisión jurídica antes de Producción.

## Planes y límites

Los límites no dependen del prompt. El backend los calcula y los envía como contexto estructurado.

Variables actuales configurables:

- `AI_PROFILE_DAILY_LIMIT`
- `AI_PROFILE_MONTHLY_LIMIT`
- `AI_PROFILE_MAX_ROUNDS`
- `AI_PROFILE_COOLDOWN_SECONDS`
- `FREE_MAX_SERVICES`
- `AI_TERMS_VERSION`
- `OPENAI_MODEL`

Para Free, `FREE_MAX_SERVICES` refleja el límite real actual de 3 servicios y la UI reutiliza `basicPlanWhatsAppUrl()` existente para `Solicitar Plan Plus` cuando corresponde. La recomendación es informativa, no agresiva.

Cuota agotada y abuso son estados distintos. Una cuota agotada devuelve HTTP 429 con un código de límite; no etiqueta al usuario como infractor.

## OpenAI

Integración server-side desde Cloudflare Worker:

- Responses API (`POST /v1/responses`)
- modelo por defecto: `gpt-5.6-luna`
- Structured Outputs con JSON Schema estricto
- `store: false`
- `safety_identifier` hash estable por usuario
- `reasoning.effort: none`
- `text.verbosity: medium`
- `max_output_tokens: 1800`
- timeout: 25 segundos

`OPENAI_API_KEY` existe únicamente como Worker secret. `app/` y `web/` contienen guards automáticos para impedir fuga de key o endpoint de OpenAI.

## Privacidad

El input al modelo excluye contraseñas, cookies, tokens, IDs internos innecesarios y otros secretos. Se envían solo datos editoriales necesarios: nombre/marca, categoría, título, bio, servicios existentes, canales configurados, plan/límites y respuestas del usuario.

`ai_profile_assistant_usage` registra únicamente estado, operación, modelo, tokens, costo estimado, códigos de error y tiempo; no guarda prompts, respuestas, propuestas ni conversación.

## Seguridad de aplicación

- sesión real obligatoria;
- propietario resuelto por `user_id`;
- consentimiento obligatorio antes de llamar al modelo;
- validación de tamaño de input;
- cuota diaria y mensual;
- cooldown;
- máximo de rondas;
- Structured Output validado server-side;
- propuesta validada nuevamente al aplicar;
- confirmación explícita antes de actualizar texto de servicios existentes;
- escritura agrupada con `DB.batch`;
- generación nunca escribe perfil;
- aplicación nunca publica;
- IA no modifica configuración visual ni canales.

## Migraciones

Uso/métricas:

- `api/migrations/0039_ai_profile_assistant_usage.sql`
- `api/migrations-preview/0039_ai_profile_assistant_usage.sql`

Consentimiento y control de acceso:

- `api/migrations/0040_ai_assistant_terms_acceptances.sql`
- `api/migrations-preview/0040_ai_assistant_terms_acceptances.sql`

Preview y Producción mantienen esquemas equivalentes. No se modifican tablas existentes del perfil.

## QA obligatorio

La matriz automatizada cubre:

- A: información suficiente → `ready`;
- B: información insuficiente → `needs_more_info`;
- C: múltiples canales → selección requerida cuando falta preferencia;
- D: un solo canal → no pregunta innecesaria;
- E: más de 3 preguntas → normalización server-side;
- F: salvaguardas anti-invención + límite server-side de servicios;
- G: términos no aceptados → no hay llamada al modelo;
- H: versión antigua de términos → nueva aceptación requerida;
- I: cuota agotada → HTTP 429;
- K: generar no muta perfil;
- L: aplicar escribe solo después de acción explícita;
- M: aplicar no publica;
- N: sugerencias de imágenes son solo texto;
- O: Free respeta `max_services` backend;
- P: acceso queda ligado al usuario autenticado y no a un profile ID suministrado por cliente;
- timeout y salida manipulada;
- conservación no destructiva de servicios.

Además, CI compila Web/App Production y Preview, API TypeScript y ejecuta guards de seguridad. Los errores preexistentes de `functions/profile-discovery.ts` se mantienen documentados y no se ocultan.

## Preview y Producción

Preview debe validar migraciones `0039` + `0040`, secreto OpenAI, Worker, Pages App y QA E2E real antes de cualquier promoción.

No se debe ejecutar ningún comando productivo ni fusionar el PR sin autorización expresa después de completar las pruebas.

## Rollback

El rollback principal es de aplicación: volver al commit productivo anterior y redeployar esa versión. Las tablas aditivas pueden permanecer sin uso para conservar auditoría y consentimientos.

No borrar datos de consentimiento o uso en Producción sin decisión explícita de producto/legal.
