# KAW-DEV-001 — Gobernanza del desarrollo asistido por IA

Versión 1.0. Entrada obligatoria para todo agente programador de `pgcsoluciones/intap-link`.
Leer este archivo antes de investigar, proponer o modificar el repositorio; después leer los contratos aplicables al alcance.

## 1. Autoridad, responsabilidades y fuentes

| Rol | Responsabilidad |
| --- | --- |
| Director de producto / propietario | Define prioridades, alcance de producto y criterios de aceptación; acepta o rechaza el resultado y autoriza expresamente decisiones, merges y despliegues. |
| Director técnico / ChatGPT | Investiga y dirige la solución técnica, delimita lotes, identifica contratos y riesgos, define validaciones y revisa el handoff. Eleva al propietario las decisiones que requieren su autorización. |
| Programador / Codex u otro agente ejecutor | Investiga el checkout, implementa únicamente el alcance autorizado, reutiliza módulos, valida, documenta y prepara commits trazables. No redefine arquitectura ni concede permisos o aprobaciones. |
| Revisor | Contrasta diff, contratos, criterios de aceptación y evidencia; señala regresiones, bloqueos y pruebas pendientes. La revisión no concede por sí sola autorización de merge o Producción. Si solo hubo autorrevisión, declararlo. |

Este documento complementa y referencia los contratos existentes; no los sustituye ni reescribe. La instrucción expresa del propietario para la tarea determina el alcance autorizado. Una autorización para preparar código o documentación no autoriza publicar, fusionar ni migrar.

Fuentes de lectura obligatoria según el alcance:

- [CLAUDE.md](CLAUDE.md) y [README.md](README.md): contrato operativo del asistente, lotes pequeños, Preview primero y responsabilidades del propietario.
- [Reglas del proyecto](.agent/rules/reglasclaras.md): aprobación por etapa, integridad de arquitectura, entitlements y evidencia. Sus referencias a herramientas y entornos históricos deben contrastarse con el encargo y el entorno actuales.
- [Contrato de Producción](CONTRACT_PRODUCTION_PROFILES.md), [inventario protegido](contracts/protected-profiles.production.json) y [guard de aprobación](scripts/production_approval_guard.py): protección productiva y autorización de SHA exacto. El inventario es una captura histórica, no una auditoría actual satisfactoria.
- [Arquitectura Cloudflare Pages](docs/CLOUDFLARE_PAGES_ARCHITECTURE.md): propiedad de App/Web, dominios, orígenes Preview y gates de frontend.
- Contratos de etapas [1](CONTRACT_STAGE_1.md), [2](CONTRACT_STAGE_2.md), [3](CONTRACT_STAGE_3.md), [4](CONTRACT_STAGE_4.md) y [5](CONTRACT_STAGE_5.md): invariantes originales. Sus certificaciones describen el momento de cada etapa; verificar su vigencia contra código, acuerdos posteriores y runtime.
- [Contrato de campos del Asistente IA](docs/KAWVO_AI_PROFILE_CANONICAL_FIELDS.md) y [diseño del Asistente IA](docs/KAWVO_AI_PROFILE_ASSISTANT.md): alcance editorial, privacidad y aplicación explícita. No extrapolar sus límites históricos a todos los productos.
- [Handoff multicuenta y patrocinio](docs/handoffs/BITACORA_MAESTRA_INTAP_KAWMED_MULTICUENTA_PATROCINIO_2026-10-27.md), [preparación Free](docs/architecture/KAWVO_FREE_PRODUCTION_PREPARATION_2026-11-15.md), [correcciones G2](docs/architecture/KAWVO_FREE_G2_QA_CORRECTIONS_2026-11-15.md) y [aislamiento KawMed](docs/KAWMED_ONLY_RELEASE_SCOPE_2026-10-22.md): antecedentes, alcance y restricciones de sus lotes; revalidar estados de PR, QA y despliegue.
- Para unificación administrativa: [contrato C01–C07, PR #150](https://github.com/pgcsoluciones/intap-link/pull/150) y [contrato maestro y hoja de ruta, PR #156](https://github.com/pgcsoluciones/intap-link/pull/156). Al crear esta v1 ambos PR están abiertos y sus documentos no están en `main`; consultar sus revisiones y estado reales antes de trabajar. Referencian la demostración visual y los gates; una demo no es una App autenticada ni una autorización de release.
- [CI](.github/workflows/quality.yml), los demás workflows de `.github/workflows/`, [plantilla de PR](.github/PULL_REQUEST_TEMPLATE/pull_request_template.md), [CODEOWNERS](CODEOWNERS) y contratos ejecutables de `scripts/`: comprobar qué verifican y qué efectos producen antes de ejecutarlos.

No decidir una contradicción por el nombre del archivo, su fecha o su presencia en `main`. Registrar fuentes, SHA, ámbito y evidencia; preservar restricciones de seguridad y solicitar decisión al director técnico/propietario antes de una acción dependiente de ese conflicto. No modificar contratos silenciosamente. Los handoffs y auditorías históricas aportan contexto, no autorizaciones permanentes ni prueba de estado actual.

## 2. Investigación obligatoria antes de programar

1. Identificar repositorio y remoto, rama, `HEAD`, estado de Git, cambios preparados/no preparados y archivos sin seguimiento. Localizar `AGENTS.md` en raíz y subdirectorios; leer las instrucciones del ámbito afectado. Preservar cambios ajenos.
2. Consultar el `main` remoto vigente y registrar su SHA. Trabajar en rama aislada desde la base autorizada; no modificar `main` ni arrastrar una rama acumulativa para resolver un lote pequeño. Si la base cambia, informar y revalidar el delta.
3. Leer las fuentes anteriores y la documentación del módulo. Buscar implementaciones, rutas, componentes compartidos, guards, pruebas, migraciones y runners existentes antes de crear otros.
4. Distinguir lo aprobado, lo implementado, lo fusionado, lo publicado y lo probado. Si el alcance afecta UI o un release, contrastar el comportamiento aprobado y el entorno publicado mediante comprobaciones de lectura, sin desplegar ni alterar datos para investigar.
5. Para Cloudflare, identificar proyecto Pages, dominio, deployment/origen efectivo, commit declarado, bundle/hash servido y versión activa de Worker cuando sean accesibles. Contrastar con GitHub. Los archivos Wrangler y los logs antiguos describen configuración o antecedentes; no demuestran el estado efectivo. Si no hay acceso, registrar qué no pudo verificarse.
6. Inspeccionar `package.json`, CI y el contenido completo del runner pertinente. Identificar builds, pruebas, llamadas externas, seeds, migraciones, despliegues y cambios de rama. El nombre «Preview», «QA» o «preflight» no garantiza ausencia de escrituras.
7. Presentar el contrato del lote: identificador de tarea, rama y SHA base/HEAD, problema, objetivo, archivos permitidos, capas/rutas/endpoints/tablas afectados, impacto en permisos, migraciones previstas o ninguna, exclusiones, criterios de aceptación, pruebas y recuperación cuando corresponda. Identificar el gate activo si existe.
8. Ejecutar cuando ese alcance ya esté autorizado. Si falta una decisión de producto, arquitectura, seguridad o ampliación de alcance, preparar la propuesta verificable y obtener autorización antes de implementarla. No pedir de nuevo autorizaciones ya dadas; no inferir autorización de merge, deploy o migración.

## 3. Implementación por lotes y protección del producto

- Un objetivo verificable por lote, diff mínimo y commits trazables. Corregir el lote rechazado antes de abrir otro frente. Registrar problemas laterales para tareas separadas.
- Reutilizar componentes, resolutores, clientes API, guards y reglas de negocio existentes. No crear modelos, rutas, editores o motores de permisos paralelos para lograr uniformidad visual.
- Diseñar móvil primero: 320, 360, 390 y 430 px; después tableta y escritorio. Comprobar navegación, legibilidad, foco, áreas táctiles, teclado y safe-area, sin scroll horizontal ni controles ocultos. Usar la referencia visual aprobada del lote.
- Proteger todas las funcionalidades previamente aprobadas: login, cuenta activa, Team/Multicuenta, onboarding, borradores, guardado, publicación, retorno al editor, credenciales, recuperación, PWA, notificaciones, medios, perfiles públicos y enlaces. Identificar regresiones por comportamiento y evidencia; no restaurar código obsoleto que un acuerdo posterior sustituyó.
- En unificación administrativa, componer o enlazar los módulos actuales y conservar capacidades por producto/rol. Mantener Mi presentación Master separada de Gestión de patrocinio, y respetar los gates de los contratos referenciados. No declarar completadas otras variantes de rol por haber probado Free.
- El servidor conserva autoridad sobre sesión, propiedad, tenant, cuenta activa `kind+id`, token de pestaña, scopes, roles, delegaciones y entitlements. Ocultar un botón o enviar un UUID desde el cliente no autoriza una operación. Reutilizar los resolutores existentes y rechazar discordancias de identidad sin seleccionar otra cuenta automáticamente.
- Preservar la relación plan → módulos → `profile_modules`, unicidad de slug, límites y aislamiento entre propietarios/patrocinadores. No hardcodear permisos o límites para desbloquear una pantalla. Consultar los contratos ejecutables `scripts/test-intapcard-active-account-contract.mjs`, `scripts/test-intapcard-multiaccount-contract.mjs` y las pruebas del módulo.
- No alterar silenciosamente tablas, relaciones, contratos API, autenticación ni arquitectura. Toda modificación estructural requiere alcance aprobado, documentación/versionado y plan seguro de migración.

## 4. Separación de capas y entornos

La topología y los gates detallados pertenecen a [CLAUDE.md](CLAUDE.md) y al [contrato Cloudflare](docs/CLOUDFLARE_PAGES_ARCHITECTURE.md); consultarlos sin copiar ni redefinir sus comandos de despliegue aquí.

- `app/`: aplicación privada y administración; no sustituye la Web pública.
- `web/` y las Pages Functions aplicables: landing, perfiles públicos, demos y discovery/SEO/GEO. Revisar también `functions/` cuando corresponda.
- `api/`: Worker, autorización, reglas de negocio y acceso a datos. El nombre `preview-free-entry.ts` no determina el entorno; comprobar la configuración usada.
- D1: persistencia y migraciones versionadas; separar bases y directorios Preview/Producción. No usar datos productivos como fixtures ni ejecutar seeds sobre Producción.
- R2: almacenamiento de medios; separar buckets, propiedad y permisos por entorno y cuenta. No mover ni borrar objetos para ocultar un defecto de UI.

Un lote exclusivamente de UI no debe tocar Worker, OAuth, D1, R2, migraciones ni Producción. Cada runner debe actuar únicamente sobre las capas autorizadas. No intercambiar proyectos App/Web, mover dominios ni usar proxies productivos para compensar un destino equivocado.

## 5. Autorizaciones de integración y publicación

- Preview primero para cambios funcionales o visuales, con QA pertinente antes de promover. Un cambio exclusivamente documental no exige desplegar Preview; justificar las validaciones aplicables.
- Prohibidos merges, despliegues (incluido Preview) y migraciones no autorizados. Autorizar QA o preparación no autoriza ejecutar un runner que publique o modifique datos. Revisar también auto-deploy de Pages/Workers Builds antes de cualquier push o merge autorizado.
- No push directo, force push, borrado ni otras alteraciones de `main`. Push y apertura de PR solo dentro del encargo autorizado; si la tarea pide revisión local, detenerse con el commit local.
- Producción exige autorización expresa del propietario vinculada al SHA exacto y el flujo del [contrato productivo](CONTRACT_PRODUCTION_PROFILES.md). Cambiar el SHA invalida la aprobación anterior. No desplegar una feature como Producción ni tratar una aprobación de Preview como aprobación productiva.
- No eludir `production_approval_guard.py`, relajar CI ni cambiar marcadores para simular aprobación. El guard de CI no controla por sí solo todas las vías externas de despliegue.
- Una migración necesita autorización específica de entorno y alcance. Preparar revisión de pendientes, respaldo/recuperación y ensayo en Preview; `d1 migrations apply` puede aplicar todas las pendientes. No ejecutarlo como reparación genérica.
- Un merge prueba integración en GitHub, no despliegue en Cloudflare. Registrar esos estados por separado. Un release autorizado solo se cierra con evidencia del deployment correcto, bundle servido y QA productivo correspondiente.

## 6. Validación y honestidad de la evidencia

Definir la matriz según el diff y sus dependencias compartidas. Consultar los comandos actuales de `package.json` y `.github/workflows/quality.yml`; no inventar un comando global de tests.

| Nivel | Evidencia y límites |
| --- | --- |
| Local / Codex | Contratos del módulo y regresión pertinente; TypeScript de las capas afectadas, builds App/Web Preview/Producción si aplica y pruebas funcionales disponibles. Fixtures, mocks y análisis estático solo prueban lo que ejercitan. |
| CI en GitHub | Registrar ejecución, SHA, resultado y pasos. Una CI de otra rama o SHA no valida el candidato aislado; una CI verde no equivale a QA autenticada ni despliegue. |
| QA Preview | Verificar el origen efectivo y probar rutas, acciones, roles, permisos, errores, vacíos, publicación/retornos y dispositivos aplicables con cuentas de prueba autorizadas. Capturas o HTTP 200 aislados no demuestran el flujo completo. |
| QA productivo | Solo tras release autorizado: verificar dominio, deployment/versiones, bundle/hash y regresiones acordadas, con controles sobre datos reales. Mantener evidencia y criterio de rollback; no convertir Producción en entorno de pruebas destructivas. |

Para un lote documental: comprobar enlaces/referencias, coherencia con contratos, `git diff --check` e inventario exacto de archivos; justificar builds o QA no aplicables. Para código: ejecutar contratos relevantes, TypeScript, builds y pruebas funcionales según alcance; no omitir checks afectados ni relajar pruebas para lograr verde.

En todos los casos:

- Registrar comando, SHA, entorno, resultado y evidencia de cada validación. Distinguir PASS, FAIL, BLOCKED, OPEN y no aplicable con su motivo.
- No ocultar errores, borrar evidencia, usar supresiones para encubrir fallos ni declarar éxito sin pruebas. Separar fallos preexistentes de regresiones mediante comparación con la base; no asumir que un fallo es histórico.
- No usar `git reset --hard` ni `npm audit fix --force` como soluciones rutinarias. Preservar trabajo ajeno; tratar deuda de dependencias y problemas D1 en lotes propios con aprobación y pruebas.

## 7. Restricciones del entorno Codex

- El D1 sintético/local es limitado: puede carecer de tablas, fixtures, migraciones o capacidades del entorno remoto. No prueba paridad con D1 Preview/Producción ni autoriza modificar esquema para hacer pasar una prueba.
- Las conexiones externas pueden estar restringidas por red/proxy. Distinguir bloqueo de acceso, ausencia de autenticación y error real del servicio. Un `CONNECT 403` del proxy no demuestra que el sitio esté caído.
- No asumir disponibilidad de credenciales reales de Cloudflare, OAuth, correo, IA ni usuarios de QA. Declarar su ausencia y los checks bloqueados; no inventar sesiones, extraer secretos ni exponerlos en logs, commits, documentación o frontend.
- No declarar QA real de OAuth, correo, R2, D1 remoto, IA o roles autenticados mediante mocks. No ampliar permisos ni cambiar configuración externa sin autorización. Completar las verificaciones disponibles y entregar los bloqueos concretos.

## 8. Documentación, handoff y punto de revisión

El asistente modifica el código y los documentos directamente cuando tiene acceso, prepara commits y resuelve verificaciones Git rutinarias. El propietario no debe editar archivos manualmente. Las acciones que dependan realmente de sus credenciales o dispositivo se delimitan y preparan; si necesita comandos, entregar un único bloque revisado listo para copiar, sin delegarle ediciones del repositorio.

Cada tarea debe actualizar la documentación pertinente dentro de su alcance y entregar handoff. Si el encargo prohíbe modificar documentos existentes, respetarlo y registrar el informe/handoff en la entrega, sin ampliar la allowlist. No crear otra copia de un contrato canónico para documentar una tarea.

El cierre debe incluir:

- Objetivo y criterios de aceptación; rama, SHA base y HEAD/commit final.
- Archivos y diff, fuentes consultadas y decisiones/autorizaciones aplicadas.
- Validaciones locales, CI, QA Preview y QA productivo separadas, con evidencia y pendientes.
- Cambios efectivos en GitHub y Cloudflare por separado; indicar explícitamente si no hubo push, PR, merge, migración o despliegue.
- Contradicciones, limitaciones, riesgos, rollback si aplica y única siguiente acción propuesta.

Preparado para revisión no equivale a aprobado ni publicado. Detenerse en el punto de control acordado con el director técnico y esperar las autorizaciones pendientes antes de integrar, desplegar o avanzar de etapa.
