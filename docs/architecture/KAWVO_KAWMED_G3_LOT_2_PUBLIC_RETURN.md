# KAW-G3.2 — Corrección puntual de retorno desde el perfil público

Base exacta de QA: `8ef347ce7a09d43953a725bcb2d8fec5102390d8`, PR #174. Misma rama `feat/kawmed-g3-2-contextual-navigation`; corrección para revisión, sin merge ni despliegue.

## Causa raíz y justificación del alcance Web

El primer enlace que pierde el contexto está en el menú del **propietario** del perfil público, antes de Agenda. `KawMedProfile` pasa la ruta `/admin/medical`; `AppointmentOwnerBar` obtiene `settings_url=/admin/medical` y `manage_url=/admin/medical/agenda` del public-context autorizado y construye URLs sin `kawvo_med_shell`, identidad ni pestaña. La entrada App sin opt-in conserva el fallback legacy por contrato. Por eso Perfil ya llega al panel antiguo; Agenda y su retorno solo prolongan la pérdida previa.

La reproducción monta los componentes originales de #174, incluido el perfil público y el AdminGuard real: menú → enlace exacto sin contexto → panel legacy. La prueba correctiva recorre después Perfil unificado → Agenda → módulo → Volver y solicitudes → detalle → recarga → retorno.

Se justificó **antes de editar** el ajuste Web porque es la capa que construye el primer enlace. La alternativa de activar por defecto cualquier `/admin/medical` cambiaría el opt-in médico aprobado. No se añade persistencia global, detección por referrer ni selección implícita de cuenta. El cambio solo afecta los destinos administrativos del menú ya exclusivo del propietario; el JSX público de pacientes, CSS, contenidos, formularios de solicitud, compartir, SEO y backend permanecen iguales.

## Patrón reutilizado y comportamiento

Fuentes: `free/FreeDashboard.tsx` resuelve la entrada canónica hacia el shell y mantiene fallback explícito; `free/KawvoShellReturn.ts`, `FreeAppointments.tsx` y la restauración de `KawvoFreeShellPreview.tsx` usan destinos fijos y pistas de UI ligadas a identidad, consumidas tras verificar el perfil. Free/G2 lleva Agenda a la superficie intermedia antes de abrir su configurador. Se aplica esa separación de destino, contexto y autoridad, utilizando el codec G3.2 de App ya aprobado; no se copia la activación global de Free al médico opt-in.

- Perfil del propietario → `/admin/medical?kawvo_med_shell=1&med_account=…&med_tab=profile`.
- Agenda del propietario y Gestionar agenda → mismo shell con `med_tab=agenda`; se conserva la pantalla intermedia, no un salto al configurador.
- App conserva sus módulos, filtros, enlaces directos, recargas, retorno de Agenda/solicitudes y fallback explícito existentes.
- Gates del puente: build Web Preview, host exacto `preview.intaprd.com`, destino exacto `https://app.preview.intaprd.com`, id de perfil válido y respuesta autorizada de propietario doctor con Master/invitado explícitamente falsos, sin action_scope y con rutas canónicas médicas exactas.
- El UUID es una pista de interfaz. AdminGuard y los módulos App siguen validando sesión, cuenta activa kind+id, token de pestaña, perfil y permisos. El puente no escribe tokens ni selecciona cuentas; una pestaña nueva usa la recuperación GET existente y una pestaña obsoleta se rechaza sin renovarla.
- Producción, pages.dev, Free/Team/sponsor, Master e invitados conservan los enlaces originales. Pacientes sin respuesta is_owner no reciben menú administrativo.

Los contratos #150, #151, #156/KAW-U-NAV-001 (especialmente U01/U02/U03/U07/U08/U09), #172 y las correcciones G3.1.1 permanecen aplicables. Esta corrección no cambia la aceptación OPEN de G3 ni acredita QA autenticada.

## Allowlist exacta respecto a la base

1. `web/src/components/medical-profile/KawMedProfile.tsx` — pasa el id que ya contiene la respuesta pública; única línea añadida, sin alterar la vista de pacientes.
2. `web/src/components/appointments/AppointmentOwnerBar.tsx` — calcula solo los dos destinos del propietario; JSX, carga autorizada y acciones originales idénticos.
3. `web/src/components/appointments/kawmedOwnerShellLinks.ts` — helper puro con gates y destinos fijos compatibles con el codec App existente.
4. `scripts/lib/kawmed-g3-2-browser.mjs` — agrega el recorrido público real y guardas a la suite acumulativa, conservando todos los escenarios anteriores.
5. `scripts/test-kawmed-g3-2-public-return-contract.mjs` — allowlist, compatibilidad del codec, matriz negativa, preservación de markup/operaciones y ejecución acumulativa.
6. Este documento.

No hay cambios en `app/`, backend, API, guards, Workers, D1, R2, OAuth, dependencias, lockfiles, configuración, workflows ni runners. No se necesita migración.

## Pruebas y evidencias

Comandos del correctivo, con herramientas existentes:

```sh
npm run build:preview -w web
node scripts/test-kawmed-g3-2-public-return-contract.mjs --browser
npm run build -w web
npm run build:preview -w app
npm run build -w app
git diff --check
```

La suite requiere builds App/Web para cargar sus CSS compilados; intercambia ambos orígenes sintéticos, monta KawMedProfile/AppointmentOwnerBar/MedicalDashboard/AppointmentManager/solicitudes reales y activa AdminGuard real en los recorridos nuevos. Todas las peticiones están interceptadas; cero métodos distintos de GET al navegar. Se comprueban:

- Enlace responsable original reproducido desde el SHA base y pérdida del shell antes de abrir Agenda.
- Perfil público → menú Perfil → Perfil unificado → recarga → Agenda → módulo → Volver; móvil y escritorio.
- Solicitudes → detalle → recarga → solicitudes → Más, conservando contexto y cuenta.
- Agenda desde perfil público → superficie intermedia; enlace copiado, entrada directa y recarga.
- Recuperación GET existente de pestaña nueva; token válido conservado; token obsoleto no renovado; cuenta Free activa rechaza la entrada médica sin POST.
- Markup de pacientes idéntico entre base y candidato; ausencia de menú propietario para visitantes; URLs productivas intactas.
- Escenarios originales G3.2 completos y los 21 de G3.1.1 heredados, sin eliminar aserciones ni relajar guards históricos de allowlist.

Se repiten los once contratos pertinentes de Kawmed, invitados/MED/MEDM, multicuenta/cuenta activa, G2 y G5 indicados en el handoff G3.2. Los typechecks forman parte de los cuatro builds. Resultado local: **PASS**, 29 escenarios G3.2 (25 previos + 4 nuevos) y 21 G3.1.1 = **50 escenarios acumulativos**; **11/11 contratos existentes PASS**; cuatro builds App/Web Preview/Producción locales y TypeScript **PASS**. Allowlist de seis archivos y `git diff --check`: **PASS**. La CI del nuevo SHA se registra en el PR; no se presenta como QA autenticada.

## Evidencias de código

- `web/src/components/medical-profile/KawMedProfile.tsx:313`: id ya presente en el perfil, añadido únicamente como prop del menú propietario.
- `web/src/components/appointments/AppointmentOwnerBar.tsx:114`: punto responsable de los enlaces y aplicación exclusiva de destinos administrativos.
- `web/src/components/appointments/kawmedOwnerShellLinks.ts:9`: gates, destinos fijos y parámetros compatibles con App.
- `app/src/components/admin/medical/KawMedShellReturn.ts:17`: parser App existente, intacto; la prueba verifica interoperabilidad.
- `app/src/components/admin/AdminGuard.tsx:113`: validación existente de kind+id y token, incluida la recuperación GET de pestaña nueva; sin modificaciones.
- `scripts/lib/kawmed-g3-2-browser.mjs`: reproducción original completa y cuatro escenarios públicos nuevos, junto a todos los anteriores.

## Handoff y limitaciones

Este lote **sí necesita un nuevo artefacto Web Preview** para que cambie el primer enlace; el árbol App permanece idéntico a la base. No basta con publicar solo App Pages. La preparación, revisión y autorización de esa publicación pertenecen a un paso posterior; no se ejecuta ni se modifica ningún runner aquí. No afirmar que la QA del propietario quedó resuelta en el entorno servido antes de aplicar y validar el bundle autorizado.

QA autenticada pendiente: repetir el recorrido exacto con la cuenta del propietario, validar el hash/origen efectivo Web y App, probar móvil/escritorio/PWA y volver desde solicitudes, comprobar permisos y otras modalidades. Los fixtures no acreditan autorización D1 real ni disponibilidad de un deployment.

Rollback de código: revertir únicamente el commit de este correctivo vuelve al SHA base de #174, sin cambios de datos ni infraestructura. G3.1.1 y el candidato G3.2 previo quedan preservados. Detenerse para revisión técnica.
