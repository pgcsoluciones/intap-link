# Pendientes inmediatos — reconciliación Producción 29/oct/2026

## P0 — Barra del perfil patrocinado Master
Confirmado en `app/src/components/admin/sponsored/SponsoredDashboard.tsx`: el menú de acciones del beneficiario se condiciona a `!isMaster`. Revisar contrato UX aprobado en Preview y distinguir la presentación Master del módulo de gestión Master. Pendiente de recuperar/validar la barra de presentación con Editar perfil, Agenda, Notificaciones y Cambiar cuenta, preservando aislamiento multicuenta. No asumir que el comportamiento actual es aprobado.

## P0 — Numeración física de nuevos productos
La serie P se asigna al generar lote desde Superadministrador > Patrocinadores (`api/src/sponsored-code-generation.ts`, `artifact_display_identifiers`); la API devuelve `display_code`, pero el listado recién generado de `SuperAdminSponsors.tsx` muestra solo el código largo y URL. La serie M se asigna en `/superadmin/kawmed/batches` (`medical_display_identifiers`); el listado de códigos existentes fue actualizado, pero el listado recién generado y el botón copiar aún usan el código largo. Verificar ruta real serie L y flujo de creación. No modificar, renumerar, backfill ni reutilizar identificadores de productos impresos.

## Reconciliación pendiente
Contrastar contra Preview aprobado y Producción con E2E de generar lote en entorno controlado, evidencia de respuesta API, tabla persistente, identificación física, URL NFC y escaneo. No confundir identificador físico de cuatro caracteres con código de activación NFC.
