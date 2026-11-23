# KAWVO — G8 Contrato maestro de unificación para lanzamiento

**Fecha:** 2026-11-23  
**Estado:** preparación y auditoría; NO autorizado para merge a `main` ni despliegue a Producción.  
**Contrato normativo:** PR #150, #151, #156, #169, #172 y documentación de fases en `docs/architecture/`.  
**Repositorio:** `pgcsoluciones/intap-link`.  
**Base de código aprobada en Preview:** `cf663d99323affb3b6b7a32374924b808289bb05` (PR #181), descendiente acumulativa de PR #179, #178, #177, #176 y #175.

## Objetivo
Preparar **un único candidato integral y auditable** para Producción que contenga todas las fases aprobadas, sin repetir fusiones de PR acumulativos, sin introducir funciones aplazadas y sin alterar producción antes de aceptación expresa del propietario.

## Inventario obligatorio de fases y decisión

| Fase | Alcance que debe preservarse | Fuente / estado | Acción G8 |
| --- | --- | --- | --- |
| G0 | Contratos UX y shell mobile-first por roles, guards, identidad `kind+id`, navegación Inicio/Perfil/Agenda/Más según permisos | #150, #151, #156 | Preservar contrato; el prototipo aislado NO es producto |
| G1 | Free, shell, cuenta y publicación del perfil; identidad y retorno | Handoffs de fases G1/G2 | Incluir, auditar regresiones |
| G2 | Free unificado, ajustes QA, flujo cuenta y PWA | `docs/architecture/KAWVO_FREE_G2_QA_CORRECTIONS_2026-11-15.md` | Incluir, auditar regresiones |
| G3.1, G3.1.1 | Kawmed profesional / médico: presentación, editor, centros, horarios, seguros, agenda y publicación | `KAWVO_KAWMED_G3_LOT_1.md`, `KAWVO_G3_1_1_UI_PUBLICATION_2026-11-17.md` | Incluir, comprobar rol y perfil |
| G3.2 | Kawmed agenda, retorno público, navegación móvil | `KAWVO_KAWMED_G3_LOT_2.md`, `KAWVO_KAWMED_G3_LOT_2_PUBLIC_RETURN.md` | Incluir y validar citas |
| G3.3 | Kawmed invitado/delegado LIVE: operar únicamente médico autorizado, mismo ID, sin ampliación de permisos | PR #175 `2e5bfcc5d732d5d3bba3b970ce165a3ea5f7e5a8`, `KAWVO_KAWMED_G3_LOT_3.md` | Incluir; **issue #134: primera aceptación pending API no certificada** |
| G3.4 | Kawmed Master: identidad patrocinio, borradores, visitadores, estaciones, códigos, navegación y disposición móvil | PR #176 `594113eeff8d6bd9cd39e572e953f7af7d2fba95`, `KAWVO_KAWMED_G3_LOT_4.md` | Incluir; inspección por cuenta Master |
| G3.5 | Credenciales, alcance delegado y continuidad Team | Contratos/handoffs G3 | Preservar comportamiento; comprobar alcance exacto en pruebas |
| G4 | Beneficiario patrocinado: shell, contexto de patrocinio, MultiCuenta, acceso médico | PR #177 `46cc46d17b6bd17af735a627a12357e1938eeb44`, `KAWVO_G4_BENEFICIARY_START.md` | Incluir; pruebas multi-tenant/rol |
| G5 | Master patrocinador Kawlink: navegación, perfil, programas, asignaciones, CTA Publicar explícito | PR #178 `b97a2f01672eaa14df04f74aa6ad882f9b4cd256`, `KAWVO_G5_MASTER_UNIFIED.md` | Incluir; conservar guardados/publicación |
| G6 | Extensión nueva del shell Kawlink pago | **Postergado por el propietario** | EXCLUIR nuevo alcance, preservar legado |
| G7.1-A | Inventario Master, paginación y filtros read-only opt-in, aislamiento tenant | PR #179 `e9b1aa11189fe43e928ba26802e2f5f34fd5baa4`, `KAWVO_G7_1_SPONSOR_INVENTORY.md` | Incluir; verificar backend y criterios de activación reales antes de Producción |
| G7.1-B | Búsqueda Kawmed Master sin acentos, varios términos, filtros, contador y limpiar filtros | PR #181, fuente UI `f42bccf2b8248b61603090a97ab56c9258400b58`; **aprobación funcional propietario 2026-11-23**; Preview Worker `9c63a559-49be-4617-bf69-2acd6d035589` | Incluir íntegra |
| G7.2 | Paginación comercial genérica | **Postergada** PR #180 y Stage revertido | EXCLUIR implementación y cualquier ruta Stage |
| G8 | Reconciliación de releases, QA integral por rol, rollback y paquete listo para revisión | Ahora | Ejecutar sin desplegar |

**Importante:** No marcar ninguna fase como nueva aprobación del propietario por el solo hecho de estar en la rama. Distinguir aceptaciones históricas, pruebas sintéticas, QA autenticada y los pendientes explícitos de los PR.

## Árbol de dependencias y regla de consolidación

La cadena de commits es lineal y acumulativa, comprobable con `git merge-base --is-ancestor`:

- #175 G3.3 `2e5bfcc5...`
- #176 G3.4 `594113ee...`
- #177 G4 `46cc46d...`
- #178 G5 `b97a2f0...`
- #179 G7.1 `e9b1aa1...`
- #181 búsqueda G7.1 `cf663d99...`

**No fusionar cada PR individualmente.** Crear rama candidata G8 desde el SHA completo que contiene todas las aprobaciones y comparar su árbol con `main`. Documentar exactamente modificaciones API, App, Web, Functions, dependencias y migraciones. Revisar si el código de automatización Cloudflare de #181 es apropiado para release; nunca ejecutar scripts de promoción Preview en producción.

## Matriz de pruebas de no regresión

1. **Seguridad/identidad:** login, cookies, MultiCuenta, perfiles `kind+id`, tenant, owner/admin/delegado, cambios de cuenta sin datos cruzados.
2. **Free:** alta, edición, borrador, listo para publicar, publicación/despublicación, misma identidad, perfil público y PWA.
3. **Kawlink pago/Team:** conservar rutas y funcionalidades anteriores aunque G6 siga postergado.
4. **Kawmed médico:** foto/servicios, centros, ubicaciones, seguros, horarios por centro, solicitudes y confirmación de citas; delegados y retorno.
5. **Kawmed Master patrocinador:** estaciones, códigos, lote, asignación/reasignación, visitadores, identidad, borradores; búsqueda G7.1 por acentos, multitémino, médico, especialidad, estación y filtros.
6. **Beneficiario:** contexto patrocinio, acceso al propio perfil, credenciales y navegación.
7. **Plataforma:** vista móvil 320/360/390/430, tableta y escritorio; sin scroll horizontal, indicadores y acciones legibles.
8. **API y Datos:** preservación de fuentes/handlers existentes, contratos read-only, D1/R2/Workers, 35 bindings cuando apliquen; sin cambios de esquema no autorizados.
9. **Rutas y host:** login autenticado en `app.preview.intaprd.com`, Pages Functions, accesibilidad de assets y comparación del bundle publicado.
10. **Rollback:** SHA y versiones anteriores identificadas, pasos de restauración verificados en lectura; no realizar rollback activo sin incidente/autorización.

## Entregables que Codex debe preparar

- Matriz completa fase → requisito → código/commit → prueba → resultado → pendiente; sin omitir G0–G8.
- Reconciliación `main` vs candidato, lista de archivos agrupada API/App/Web/Functions/migraciones/dependencias, manifest SHA/commit y lista explícita de exclusiones.
- Rama y PR G8 **Draft** de preparación, sin merge y sin despliegues, con cambios mínimos necesarios y documentación.
- Evidencia de tests reales (comandos, PASS/BLOCKED, logs), listado de bloqueantes con prioridad.
- Runbook candidato de despliegue y rollback **no ejecutado**.
- Una recomendación de decisión final: **GO / NO-GO**, con riesgos y aprobaciones aún requeridas.

## Prohibiciones

No usar PR #180/G7.2 ni implementar G6. No tocar `main`, producción, Workers productivos, D1 remoto, dominios o secretos. No normalizar históricamente la rama con `reset --hard` ni sobrescribir cambios ajenos. No inferir aprobación de pruebas fallidas. No permitir que una falla de pruebas se silencie. Detenerse ante divergencia de SHA, modificaciones inesperadas o evidencia insuficiente.

**Puerta final:** el propietario debe aprobar explícitamente el SHA exacto del candidato y el plan de release antes de merge/publicación productiva.
