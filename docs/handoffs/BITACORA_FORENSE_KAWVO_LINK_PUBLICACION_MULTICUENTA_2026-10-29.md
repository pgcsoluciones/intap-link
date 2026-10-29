# BITÁCORA MAESTRA DE CONTINUIDAD · KAWVO LINK / KAWMED / PATROCINADO / FREE
**Fecha:** 29 de octubre de 2026 · **Ámbito:** investigación de regresiones, publicación, vista previa, multicuenta y recordatorios.  
**Repositorio privado:** `pgcsoluciones/intap-link` · **rama de trabajo:** `feature/kawvo-sponsor-commercial-controls-2026-10-27` · **PR:** #126.  
**Regla:** esta bitácora **NO** certifica que las correcciones estén publicadas ni autoriza otro deploy productivo.

## 1. Contexto de Producción: lo comprobado
- El usuario ejecutó `scripts/run-production-sponsor-nfc-release-2026-10-29.sh` desde su Mac. Se generó respaldo D1 remoto **antes** de aplicar migraciones en `~/intap-release-logs/kawvo-production-20261029T050318Z/intap_db_before_release.sql`.
- Migraciones **0153** (gestión comercial de patrocinadores) y **0154** (etiquetas físicas únicas) aplicadas satisfactoriamente a D1 **intap_db** en Producción.
- API Worker `intap-api` desplegado, versión `7708f331-a575-40eb-82a7-a491a5a25e22`.
- Web pública Pages: proyecto **`intap-link`** para `https://intaprd.com`; panel Pages: **`intap-web2`** para `https://app.intaprd.com`. Despliegues inmutables vistos en logs: `a85441d9.intap-link.pages.dev` y `7c8a5eab.intap-web2.pages.dev`. Hashes de bundles servidos coincidieron con los locales.
- Script terminó con error al consultar la **raíz** `https://api.intaprd.com/` (503). Diagnóstico posterior verificó las **rutas correctas** `/api/health` en `intaprd.com`, `app.intaprd.com` y `api.intaprd.com`: HTTP 200, `status: healthy`, `environment: production`, `worker: intap-api`. El error raíz no acreditó caída de endpoints de negocio.
- Auditoría previa D1 Producción solo lectura: 440 `intap_artifacts`, 30 `sponsor_artifacts`, 8 `medical_access_codes`; **no sumar como universos disjuntos**. Estos son conteos **anteriores al release**, no validación de los registros actuales.
- El release **no fusionó** PR #126 a `main`. Se desplegó desde rama separada. Evitar un próximo release de `main` sin reconciliar.
- Ninguna comprobación de salud HTTP equivale a una prueba autenticada de editar/publicar/despublicar.

## 2. Evidencia reportada por usuario, todavía no reproducida end-to-end
1. KawMed individual no muestra recordatorio de perfil listo para publicar.
2. Vista previa KawMed no se ve en borrador; botón `Vista previa` junto a `Cambiar cuenta` aparentemente no responde en multicuenta.
3. Unificar textos **«Centros de atención»** y **«Horario de atención»** donde corresponda (sin cambiar esquema o endpoints).
4. Patrocinado ofrece «datos completos, publicar» aunque el usuario ve campos faltantes.
5. Patrocinado multicuenta no publica pese a aparentar cumplir mínimos.
6. Al despublicar patrocinado y quedar en borrador no logra publicar de nuevo.
7. Barra de navegación patrocinada ausente para sesión con correo administrador y contexto multicuenta.
8. Elemento «Notificaciones · Próximamente» visible en patrocinado.
9. Free no ofrece el mismo aviso proactivo de publicación.
10. Usuario teme regresión por diferencia entre ramas aprobadas en Preview y código productivo. Requiere **auditoría histórica de ramas/PR**, no inferencia.

## 3. Hallazgos directamente inspeccionados en código
- `app/src/components/admin/sponsored/SponsoredDashboard.tsx`: checklist visual («Nombre», «Cargo», «Usuario», «Foto», «Portada») difiere de `canPublishNow` (username, business_name, specialization, what_we_do y contacto). El aviso puede ser lógicamente verdadero según API mientras checklist visual permanece incompleto. Separar **obligatorios** y **recomendados**, no afirmar «perfil totalmente completo».
- `api/src/sponsored-profiles.ts`: `POST /api/v1/me/sponsored-profile/publish` exige username, business_name, specialization, what_we_do y teléfono o WhatsApp guardados; responde `422` con `missing` cuando faltan. `unpublish` establece `draft`. La implementación no demuestra por sí sola la causa del fallo «borrador → publicado».
- `SponsoredDashboard.tsx`: barra con «Editar perfil», «Agenda», «Notificaciones · Próximamente» y «Cambiar cuenta» condicional al contexto; la detección multicuenta puede fallar silenciosamente cuando `/me/intapcard/active-account` no resuelve el tipo de cuenta esperado. El texto «Próximamente» es marcador explícito, **no** prueba de regresión de un módulo funcional.
- `app/src/components/admin/medical/MedicalDashboard.tsx`: ya existía vista privada independiente de publicación, pero se renderizaba abajo de la página, posiblemente fuera del viewport al presionar botón. API de KawMed requiere nombre, especialidad y slug; el progreso ampliado con foto/centro/horarios es recomendado, no bloqueante.
- `app/src/components/admin/free/FreeDashboard.tsx`: valida requisitos antes de publicar, pero no tenía originalmente recordatorio automático análogo al patrocinado; Free y Team poseen requisitos distintos.
- `docs/CLOUDFLARE_PAGES_ARCHITECTURE.md`: jamás publicar `web/dist` en `intap-web2` en Producción; los proyectos correctos son `intap-link` (web) e `intap-web2` (app).

## 4. Trabajo iniciado en rama — **NO CONFUNDIR CON PRODUCCIÓN**
Cambios de componentes realizados durante esta fase, sujetos a validación y revisión:
- `SponsoredDashboard.tsx`: normalización de espacios en los campos guardados de `canPublishNow`; ajuste de navegación «Cambiar cuenta» cuando hay `profile_id` explícito; mensaje del modal aclarado sobre obligatorios frente a foto/portada. Commit conocido `edefc90d69b1db12eaa4625ea5170a4c48abbee9`.
- `MedicalDashboard.tsx`: vista previa médica elevada a overlay fijo visible sin publicar; propuesta de recordatorio «Listo para publicar / Más tarde» sin publicar automáticamente. Commit conocido `6d10e5b162941c9b59262523bc43de052308babe`.
- `FreeDashboard.tsx`: en rama se observa `readyPromptDismissed` y modal de recordatorio «Perfil Free listo para publicar». **Verificar commit, disparo, condiciones y pruebas** antes de considerarlo aprobado.
- Estas modificaciones **NO** prueban que el botón o el flujo real funcionen; son cambios candidatos de UI. También requieren confirmar compilación y QA.
- **No hay evidencia de una reparación final** del fallo backend de publicar/despublicar patrocinado con cuenta multicuenta. No declararlo resuelto.
- No se realizó otro despliegue productivo como parte de esta auditoría.

## 5. Diagnósticos que NO deben darse por resueltos
- Capturar en sesión afectada, sin exponer credenciales: respuesta HTTP y JSON de `/me/intapcard/active-account`; identificador de perfil activo; solicitudes `GET /me/sponsored-profile`, `POST /publish` y `POST /unpublish`, incluido `missing` y los códigos 401/403/404/409/422 según suceda.
- Comparar selección de perfil en `profile_id`, query `scope`, cookie/session y cabeceras `activeIntapTabHeaders()` para descartar que GET y POST actúen sobre perfiles diferentes.
- Probar ciclos completos en **Preview aislado** para Free, patrocinado, KawMed: crear/guardar → vista previa en borrador → aviso una vez → publicar → ver público → despublicar → volver a publicar; comprobar que borrador NO sea público.
- Para recordatorios: evitar modal intrusivo en cada recarga; verificar «Más tarde», persistencia por sesión/identidad y que no bloquee acciones del usuario.
- Confirmar accesibilidad móvil, apertura/cierre de vista previa y que los cambios no introduzcan conflicto de z-index con modales de publicación.
- Revisar **todas las ramas y PR anteriores aprobados en Preview** contra `main`, commit desplegado y rama actual; registrar SHA, archivos, aceptación, diferencias y razón de exclusión/inclusión. No mezclar indiscriminadamente ramas antiguas.
- Verificar consistencia de las etiquetas «Centros de atención» y «Horario de atención» en UI pública y panel, manteniendo nombres técnicos de datos.
- Decidir alcance real de «Notificaciones» patrocinadas: placeholder de octubre 27 versus requerimiento aprobado en otro release.

## 6. Próximo procedimiento seguro y entregables
1. Congelar SHA de esta rama y verificar CI + builds de `web`, `app`, `api`. Crear tests de contratos y reproducciones para publicación multicuenta y recordatorios.
2. Preparar **matriz forense** (reporte/PR origen, ruta funcional, commit aprobado, evidencia de Preview, presencia en producción, estado, acción).
3. Validar en Preview separado, **sin ejecutar el script de Producción** ni aplicar migraciones duplicadas.
4. Solo después, preparar PR de reconciliación y script productivo de mínimo alcance, con respaldo D1 nuevo y comprobación de bundles reales. No reejecutar el runner general de 29/octubre sobre Producción.
5. Registrar resultados de usuario y conservar logs con rutas, códigos de error y contexto no sensible.

## 7. Comandos y referencias de continuidad
- Repo local Mac: `~/Desktop/intap-link-universal-bilingual-audit`.
- PR: `https://github.com/pgcsoluciones/intap-link/pull/126`.
- Rama: `feature/kawvo-sponsor-commercial-controls-2026-10-27`.
- Referencia forense previa: `docs/handoffs/KAWVO_RELEASE_GATE_SPONSOR_NFC_2026-10-28.md`.
- Backup **real de Producción** 29/oct: `~/intap-release-logs/kawvo-production-20261029T050318Z/intap_db_before_release.sql`.
- Endpoint correcto de salud API: `/api/health` (NO `/api/v1/health`).
- Script productivo anterior: `scripts/run-production-sponsor-nfc-release-2026-10-29.sh` (**no repetir**).
- Principio de seguridad: **diagnosticar antes de escribir**, no renumerar NFC impresos, preservar separación Free / patrocinado / KawMed / multicuenta y no afirmar aprobaciones sin prueba real.

**ESTADO FINAL DE ESTA BITÁCORA:** forense en curso; pruebas técnicas previas de infraestructura aprobadas; incidencias funcionales en investigación; algunas correcciones UI en rama; **no publicadas en Producción**.
