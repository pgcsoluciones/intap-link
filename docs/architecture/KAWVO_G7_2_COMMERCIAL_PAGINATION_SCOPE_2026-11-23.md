# G7.2 — Listados comerciales del Master patrocinador: alcance y control

Corte: 2026-11-23. Rama desde G7.1 exacto `e9b1aa11189fe43e928ba26802e2f5f34fd5baa4`. Contratos #150 (seguridad), #156 (mapa G0–G8), #153 en #152 (listas extensas), #172 (operación), bitácora G7.1. **Documento de diagnóstico: ninguna implementación ni publicación por este archivo.**

## Baseline aceptado

G7.1 QA autenticada del propietario 10/10 PASS en `https://app.preview.intaprd.com`, API activa `ebf507f7-325f-44c1-9849-2f93ae8ded0d` y App `0380a8b8.intap-web2.pages.dev`. G3–G5 aprobados, G6 pospuesto. No tocar PR #179 ni repetir sus builds, tests o deploy. Producción intacta; el PR G7.1 sigue Draft y G7 global OPEN.

## Evidencia de código, no inferencia de tráfico remoto

- `api/src/sponsor-commercial-sales.ts`: `GET /api/v1/sponsor/commercial/sellers` devuelve dos listas **sin LIMIT**: `sponsor_sales_representatives` y `sponsor_sales_assignments` por sponsor. Tiene comprobaciones de sesión, membresía owner/admin y habilitación de módulo. Es un endpoint G5 utilizado también por otros componentes.
- `app/src/components/admin/sponsored/SponsorCommercialSellers.tsx`: carga ambas listas completas, usa `artifacts` completo para filtros por lote, comercio/código/estado de asignación; `assignments.slice(0,30)` solo limita lo pintado, no los bytes descargados. Selección masiva, selección manual, revisión explícita, historial y operaciones import/PATCH/assign dependen de ese estado.
- `app/src/components/admin/sponsored/SponsorDashboard.tsx`: al abrir Gestión de patrocinio G7.1, carga bajo demanda `GET /sponsor/artifacts` completo; dejó deliberadamente fuera de G7.1 esta superficie. `refreshCommercialAssignments` y la alternativa G5 también consumen el GET no paginado.
- `api/src/sponsored-profiles.ts`: `GET /sponsor/artifacts` legacy es completo; G7.1 introdujo otro GET paginado **solo de lectura** para Dispositivos, no reemplaza el inventario utilizado para asignaciones.

El contrato de listados pide búsqueda y filtro D1 antes de transferencia, página 10–25, scope tenant/rol, orden estable, estados de error/vacío, debounce, 320–430px y evitar cargar miles. No hay prueba de que los datos reales actuales hayan alcanzado escala; el incumplimiento aquí es estructural.

## G7.2 mínimo propuesto

1. **Lectura paginada de responsables y asignaciones**, como endpoints Preview opt-in nuevos, sin alterar semántica del GET legacy ni sus consumidores. Diseñar búsquedas/filtros y summary/listado de selección acotados con recuentos y cursor determinista. Proteger sesión, sponsor activo, owner/admin, permiso comercial y token de Multicuenta antes del SELECT.
2. **Listado/picker paginado de dispositivos asignables**, consultado por código, lote, cliente, estado de asignación; nunca traer `/sponsor/artifacts` completo solo para presentar una página. Para «próximos N sin asignar», resolver selección explícita y validación en servidor según el sponsor, evitando seleccionar solo los elementos visibles o asumir que la página es el universo.
3. **Separar selección/borrador de la página visible**. Mantener hasta 250 códigos explícitos con revisión y confirmación, aviso de reasignación, historial y permiso/tenant en el endpoint POST existente. No cambiar la ruta de escritura para ganar paginación salvo modificación aislada y pruebas de contrato expresamente justificadas.
4. **Opt-in Preview independiente y fallback G5**. Ante datos incompletos/endpoint no disponible, ofrecer alternativa explícita sin romper formularios ni presentar filtro parcial como completo. Evitar descargar datos G5 durante uso G7.2.
5. **Pruebas**: 0,1,10,11,1001,10001; dos sponsors; roles no autorizados; Multicuenta kind/id/token; búsqueda Unicode y comodines; cambios concurrentes; confirmación/borradores; tamaño de respuesta acotado; cero escrituras al consultar. Móvil 320/360/390/430 y desktop; regresión comercial G5 con flag apagado.

## Restricciones y gates

Sin migraciones D1 predeterminadas, no nuevas capacidades, no cambio de grants ni edición de perfiles, no modificación de `/api/v1/sponsor/commercial/assign`, importación ni PATCH existente sin evidencia de dependencia necesaria; no reabrir Kawmed, Free, G6, G7.1 o G8. Priorizar primero lectura de responsables/asignaciones; segundo picker de dispositivos con selección masiva cuidadosamente diseñada. Cada sublote debe ser revisable y desplegable separadamente, sin publicar por crear esta rama.

**Siguiente trabajo de ingeniería:** fijar contrato JSON y pruebas de la lectura paginada sin alterar rutas existentes; luego implementar y validar en fixture SQLite, CI y Preview autorizado antes de QA real. No llamar «G7.2 PASS» hasta la prueba autenticada del propietario.
