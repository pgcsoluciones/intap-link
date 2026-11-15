# G3.1 — Integración de módulos Free en el panel unificado
Fecha: 15/11/2026. Base G2.5 aprobada por el propietario, SHA fba4e83e4a9e02c0a0b1649bc117c6a3f82eac49; App Preview publicado (log kawvo-g2-5-pages-xmA8tzBW), Web G2.4 preservado.

## Objetivo funcional
- Mostrar Servicios y Cuentas bancarias directamente en Perfil, con búsqueda y filtros ya aprobados, sin duplicar editores ni endpoints.
- Servicios reutiliza la ruta existente y sus controles. Se excluye la demo delegada, tal como en el editor actual; miembro Team requiere design y services para conservar el acceso previamente permitido por ambos editores.
- Cuentas bancarias conserva acceso de propietario/no Team member y requisito de datos esenciales del dashboard existente; el componente bancario conserva verificación real de acceso/plan. No se activa un módulo ni se presupone una suscripción.
- Identidad reproduce permiso name/role/photo para miembros; CTA de borrador no abre una sección que el menú no autoriza. Credenciales e IA excluyen demos delegadas y la IA conserva requisito de identidad del panel original.
- La navegación pasa el mismo estado de retorno de G2; ambos editores usan FreeBackButton. Cierre de sesión G2.5 intacto.
- No cambios a API/Worker/OAuth/D1/R2, Web público, guards, rutas existentes, contrato operativo ni panel legacy.

## Verificación
Un solo componente de aplicación modificado. Runner App-only reutiliza controles G2.5, log inmutable del release anterior, auditoría acumulativa y contrato de G3.1. Preflight por defecto no crea stages. Publicación separada con autorización expresa; reintentos acotados de Stage sin aceptar bundle incorrecto. Pendiente ejecución real en Mac, QA visual/funcional y revisión Team/owner/demo.

## Próximos lotes
Team y productos NFC/QR siguen accesibles por Mi cuenta y sus rutas existentes. No se duplica ese flujo ni se cambia la creación de Teams. Recursos, suscripción y ajustes anidados conservan sus mecanismos actuales. Integración de esos accesos y continuidad de retorno se aborda posteriormente por lotes, sin afectar lo aprobado. Producción no autorizada.

## Pendiente de mejora futura — funciones avanzadas y Plan Plus
Decisión del propietario (15/11/2026): posponer la integración de funciones avanzadas para no desviar la unificación del panel Free. En una fase posterior, presentar las funciones de pago pertinentes como opciones visibles, con candado y etiqueta «Plan Plus» (o el plan de pago real que corresponda), e informar cómo obtener acceso. El candado debe reflejar el acceso real de la cuenta, no ser una restricción nueva: conservar promociones, módulos habilitados y permisos efectivos, y no mostrar funciones prohibidas por el rol o contexto de demo. El catálogo exacto de funciones avanzadas, su clasificación comercial y la experiencia de mejora de plan quedan pendientes de definición/aprobación. No implementar, activar, bloquear ni cambiar precios/planes en G3.1 por esta decisión. Prioridad actual: completar unificación funcional Free, preservar accesos existentes y validar el lote vigente.
