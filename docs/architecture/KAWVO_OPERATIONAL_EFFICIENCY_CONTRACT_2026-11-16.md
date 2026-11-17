# KAWVO — Adenda contractual de eficiencia operativa y continuidad
Versión 1.0 · 2026-11-16 · Regla operativa solicitada por el propietario. No constituye autorización de despliegue ni merge.

## 1. Precedencia y misión
Lectura obligatoria junto a #150, #151, #156 y las reglas de #169. Complementa la sección 5 del contrato maestro #156, sin sustituir su diseño, orden G0–G8, seguridad, QA autenticada, rollback ni autorizaciones. La prioridad es entregar funcionalidades del gate activo, no perfeccionar herramientas ni procesos. El propietario ha ordenado recuperar el método directo anterior, complementado por Codex y Work solamente cuando aporten eficiencia.

## 2. Responsabilidades obligatorias
- ChatGPT: director técnico y ejecutor directo de ajustes acotados, revisión GitHub, diagnóstico, runners y comandos. Si dispone de acceso y puede resolver una tarea autorizada directamente, no la delegará al propietario ni a Codex por rutina.
- Codex: implementación compleja, refactorizaciones y pruebas extensas cuando reduzca trabajo total. Publica cambios en la rama/PR del lote autorizado; no exige copiar código ni exportar archivos entre chats.
- Work: QA visual/funcional independiente sobre un candidato realmente accesible. No repetir auditorías estáticas ya realizadas ni declarar fixtures como QA autenticada.
- Propietario: producto, decisiones, aceptación y autorizaciones de acciones sensibles; ejecución local únicamente cuando sean necesarias sus credenciales o dispositivo. No edita código ni transporta archivos o informes extensos.
- GitHub: fuente de verdad compartida. Usar PR, SHA, comentarios y evidencias; leer directamente antes de pedir información ya disponible.

## 3. Regla de mínima fricción
1. Antes de cada acción, identificar gate, resultado pendiente y camino más corto compatible con los contratos. Preferir reutilizar herramientas, runners, comandos y módulos demostrados.
2. No imponer el uso de todos los agentes en cada lote. No crear un PR independiente por cada ajuste menor: continuar en el PR autorizado cuando sea compatible con la inmutabilidad del candidato; si no, justificar la separación.
3. No repetir auditorías, pruebas o verificaciones ya acreditadas para el mismo SHA/entorno, salvo evidencia de cambio o requisito de seguridad pertinente. Revalidar únicamente lo afectado.
4. Ante un bloqueo, diagnosticar la causa concreta y resolver directamente si es posible. Si el método agrega intermediación, transferencias fallidas o trámites innecesarios, regresar al procedimiento probado. Tras un bloqueo recurrente, revisar el método antes de reiterarlo. No rebajar gates de seguridad para ganar velocidad.
5. No instalar, actualizar ni cambiar herramientas, versiones o permisos sin necesidad demostrada y alcance autorizado. Diferenciar ambiente de CI del ambiente local; reutilizar versiones compatibles ya disponibles o justificar exigencia exacta.
6. Comandos de terminal: indicar inequívocamente TERMINAL o CODEX, copiar y ejecutar solo bloques correspondientes; preferir un bloque autocontenido que falle de forma segura o la regla habitual 4+1 cuando convenga. Validar sintaxis y supuestos antes de entregar. No pedir al usuario editar scripts, pegar código fuente o repetir comandos exitosos.
7. Informes cortos: resultado, evidencia/PR/SHA, bloqueo concreto y única siguiente acción. No convertir cada interacción en un informe de gobernanza.

## 4. Autorizaciones y seguridad
La autorización de un lote cubre las operaciones de desarrollo y publicación de rama/PR expresamente incluidas; no pedirla repetidamente para la misma acción y alcance. Stage, promoción Preview, merge y Producción conservan las autorizaciones específicas y gates aplicables. No inferir permiso de despliegue de una aprobación técnica. No modificar Worker, Web, D1/R2, OAuth, infraestructura, permisos ni dependencias fuera del alcance. Verificar origen efectivo, artefacto, rollback y superficies protegidas. No confundir CI o fixtures con QA real. Si no es posible verificar un requisito crítico, BLOCKED con causa y alternativa acotada.

## 5. Control anti-desviación
Al inicio de cada tarea: consultar contrato maestro #156 y esta adenda; identificar misión/gate y única acción útil. Aplicar las reglas de forma interna y comunicar únicamente lo relevante. Si una acción no aproxima el gate, aparcarla. No convertir la propia adenda en otro proyecto administrativo. Registrar desviaciones relevantes y corrección, no duplicar bitácoras. Cambios de metodología requieren decisión registrada del propietario.

## 6. Continuidad inmediata
G3.1 Kawmed Doctor: PR #170 candidato 34d57a4bfebc9e59b0347d0497a159ca3f46ce7e, revisión técnica y CI PASS; PR #171 runner dd5bd7d2a73a0d524b867571d10c8caab23e1345, CI PASS, preflight real pendiente tras corregir paginación. Siguiente acción: ejecutar preflight de lectura desde la Mac con runner corregido; resolver rollback y gates Stage/Preview existentes; Work después de Preview efectivo. Ningún merge ni despliegue productivo autorizado por esta adenda. G3 completo OPEN.

## 7. Referencias
[Maestro #156](https://github.com/pgcsoluciones/intap-link/pull/156) · [Arquitectura #150](https://github.com/pgcsoluciones/intap-link/pull/150) · [Prototipo #151](https://github.com/pgcsoluciones/intap-link/pull/151) · [Gobernanza #169](https://github.com/pgcsoluciones/intap-link/pull/169).
