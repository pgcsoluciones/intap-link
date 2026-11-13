# Kawvo: contrato transversal de búsquedas, filtros y paginación (12 nov 2026)

Estado: norma de aceptación; NO implica que todos los módulos ya estén implementados.

## Aplicabilidad
Todos los listados de Link Free, Link pago, KawMed, beneficiario patrocinado, Master/admin patrocinador y roles permitidos; especialmente cuentas/perfiles, estaciones M/P/L y QR, beneficiarios, asignaciones por vendedor o visitador, solicitudes de Agenda, citas, centros, multimedia, notificaciones y otros listados que puedan crecer.

## Reglas de interfaz móvil
1. Búsqueda visible y semántica por términos propios de la tarea: persona/negocio, código físico y público, responsable, zona, estado y fechas según sea aplicable. No mostrar filtros inaccesibles o sin sentido para un rol.
2. Filtros por atributos reales de cada recurso; estado y responsable cuando existan. Botón de restablecer y resumen de filtros aplicados. Los filtros deben ser inclusivos del perfil/tenant permitido, nunca mecanismos para escapar de él.
3. Conteo de resultados y estado vacío claro; conservar contexto de búsqueda al entrar a un detalle y volver, sin borrar cambios de edición.
4. Paginación real con tamaño predeterminado bajo (10–25 por página según contenido), navegación anterior/siguiente, estado de carga, error y reintento. Cambiar búsqueda/filtro vuelve a la primera página. Evitar scroll horizontal, controles no tocables y «cargar toda la base».
5. Para pequeños menús de navegación ya acotados, se permite filtro/paginación local. **Para datos potencialmente extensos, búsqueda, filtrado y paginación DEBEN suceder en API/D1 antes de transferir resultados** (limit+cursor o offset razonable), con orden estable y límite máximo.
6. En dispositivos móviles, no descargar todas las citas, beneficiarios, cuentas o estaciones para después ocultar filas. No crear un cliente de 10 000 registros. Evitar petición por cada tecla: debounce, cancelación de solicitudes obsoletas y paginación incremental controlada.
7. Identificador de perfil activo, tenant/sponsor y permisos vienen del servidor. El filtro siempre opera dentro del scope autenticado; un cambio de pestaña o multicuenta invalida resultados cacheados. No filtrar datos de patrocinadores distintos en frontend.
8. Estado real de cada elemento (borrador, asignado, pendiente, activado, suspendido, publicado) debe conservar semántica actual. No deducir «activado» de existencia de código; jamás mutar datos por buscar.
9. Accesibilidad: búsqueda con label, filtros con estado seleccionado, resultados con contador aria-live adecuado, controles 44px, mensajes de sin resultados y errores, foco y teclado.

## Contratos verificables para cada implementación por módulo
- Caso sin coincidencias y limpiar búsqueda restaura resultados completos *dentro del scope*.
- 0, 1, una página exacta, una página +1, listas grandes; cambiar filtros después de navegar a la última página no deja página vacía ficticia.
- Orden determinista al paginar (por fecha + ID, código físico + ID, etc.). Si cambian datos mientras se navega, no duplicar ni perder filas por fallos del cursor.
- Búsqueda y filtros no cruzan perfiles, cuentas, tenants, médicos, patrocinadores ni roles; vendedor/visitador no ve asignaciones ajenas.
- URL/cuenta activa no selecciona silenciosamente otra identidad. API autoriza cada consulta, independientemente de controles visuales.
- Acciones de ficha (asignar, liberar, publicar, activar, cancelar) preservan confirmaciones y permisos existentes.
- La consulta de listados es de sólo lectura; no debe escribir, reclamar ni publicar.
- Pruebas en móvil 320/360/390/430, tableta y desktop, con red lenta y recursos cargados.
- No admitir lista sin límites u ordenar toda D1 en el cliente en módulos de escala.

## Alcance de la fase de integración Free
Se agregó un componente **KawvoPagedList** de búsqueda, filtros y paginación únicamente para un menú corto de módulos de configuración, con datos locales acotados. **No afirmar que este componente resuelve la paginación de datos extensos**. Los inventarios, citas y listados reales seguirán pendientes de implementación/QA específica por módulo, conservando endpoints ya aprobados y sin introducir cambios de contrato API como efecto colateral del nuevo shell.

Referencia marco de seguridad: docs/architecture/KAWVO_MOBILE_FIRST_UNIFIED_SHELL_CONTRACT_2026-11-11.md.
