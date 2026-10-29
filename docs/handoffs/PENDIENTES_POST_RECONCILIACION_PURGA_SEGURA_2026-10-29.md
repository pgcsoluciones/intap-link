# Pendientes posteriores a recuperación de Preview — limpieza segura de pruebas en Producción

## Prioridad
No ejecutar eliminación, desasociación ni reutilización durante la reconciliación de funciones previamente aprobadas. Solicitud nueva, pendiente para fase posterior.

## Separación de líneas
- KawMed: estaciones M; modalidades **KawMed independiente** y **KawMed patrocinado**; ambos son KawMed y no el patrocinio convencional.
- Kawvo Link: productos L.
- Patrocinio convencional Kawvo Link: productos P.

## Panel de limpieza Superadmin — control por permisos
1. Inventario y vista previa de dependencias para artefactos, códigos, perfiles, patrocinadores, Masters y usuarios.
2. Elegibilidad estricta: solo registros de prueba sin activación, sin publicación, sin escaneos públicos documentados, sin pagos/órdenes ni asignaciones a clientes, sin NFC grabado/entregado, sin datos de terceros o auditoría que obligue retención.
3. Operación en dos fases: simulación/impacto (dry run) y confirmación explícita con nombre del patrocinador, ID, cantidad exacta y segundo factor o reautenticación. Transacción y registro de auditoría, backup y capacidad de recuperación.
4. Primero desactivar/revocar URLs, tokens y códigos no utilizados; eliminar registros de prueba elegibles solo cuando no existan referencias y después del período de seguridad.
5. Master y patrocinador: impedir eliminación si hay beneficiarios, lotes, perfiles, representaciones, compras, cuentas asociadas o dependencias. Permitir desasociar correos solo cuando ya no queden membresías, sesiones, credenciales o usos que requieran conservar identidad; no borrar usuarios compartidos.
6. Números físicos M/L/P, public_code y URLs NFC emitidos: **no reutilizarlos automáticamente**, ni siquiera tras borrar filas, porque pueden haber quedado grabados fuera del sistema. Exigir política de retiro irreversible y decisión explícita sobre cualquier excepción con trazabilidad. Liberar capacidad/cuota y estado de registro, no necesariamente el identificador impreso.
7. Medir historial y eventos antes de declarar algo «sin uso», con bloqueo de borrado si el estado es dudoso.
8. Separar claramente eliminar un código, un lote, el Master, el patrocinador, la cuenta del dueño y liberar correo. Acciones granulares y revocables cuando sea posible.

## Estado
Pendiente nuevo expresamente diferido por el usuario hasta finalizar equivalencia Producción–Preview. No se hicieron escrituras D1 ni API.
