# Kawvo Link · puerta de salida a Producción · 28 octubre 2026

**Estado: NO AUTORIZADO PARA DESPLIEGUE HASTA APROBAR QA FUNCIONAL.** PR #126 permanece sin fusionar. No desplegar Production ni aplicar migraciones sin respaldo validado, aprobación y ventana de mantenimiento.

## Evidencia técnica
- Rama: `feature/kawvo-sponsor-commercial-controls-2026-10-27`.
- Preview desplegado satisfactoriamente con App/Web/Worker y D1 Preview; esto **no** acredita comportamiento real de todos los flujos.
- Pruebas automatizadas: `node scripts/test-sponsor-commercial-contract.mjs`, `node scripts/test-intapcard-active-account-contract.mjs`, `node scripts/test-intapcard-kawmed-integrated-contract.mjs`, `node scripts/test-nfc-physical-identifier-release.mjs`.
- Migraciones nuevas 0153 (comerciales) y 0154 (números físicos); son aditivas y no renumeran artículos impresos. Deben aplicarse antes de desplegar código que consulta esas tablas.

## QA funcional obligatorio en Preview (registrar fecha, comprobante, resultado y ejecutor)
- [ ] Ferretería Beato: 5 códigos por página; filtros todos/asignados/sin asignar; aparecen los 3 asignados a Víctor, sin modificaciones inesperadas.
- [ ] Por código: vinculación correcta de vendedor, lote, nombre del comercio, teléfono, correo y único enlace `Ver perfil`. URL NFC solamente en `Copiar enlace NFC`.
- [ ] Crear **lote de prueba nuevo** patrocinado; devolver `P0A1` o siguiente correlativo, sin colisiones; verificar mismo código en tabla, asignación, escaneo e impresión de muestra. No crear más de lo necesario.
- [ ] KawMed: crear lote de prueba nuevo y verificar su etiqueta `M...` y flujo de reclamación; sin alteración de estaciones antiguas.
- [ ] Link: crear artefacto nuevo y verificar etiqueta `L...` y reclamación; sin alterar enlaces existentes.
- [ ] Escaneo: sin activar muestra código NFC y etiqueta física; borrador no se publica; publicado lleva al perfil correcto.
- [ ] Perfil patrocinado mínimo completo sin publicar: aviso una vez por entrada; «Más tarde» no publica; «Publicar» funciona; desaparece aviso/animación al publicar.
- [ ] Reasignación de vendedor preserva historial y muestra advertencia previa; no mezcla patrocinadores ni cuentas multicuenta.
- [ ] Enlace directo a login, navegación SPA, autenticación y acceso móvil.
- [ ] Confirmación de las numeraciones previamente impresas: sin choque con las nuevas M/L/P.

## Plan de implementación (NO EJECUTAR AUTOMÁTICAMENTE)
1. Congelar la versión final, comprobar CI, revisión de PR y aprobación explícita tras QA.
2. Preparar ventana y un respaldo íntegro **remoto de D1 Producción**; comprobar que el archivo existe, no está vacío y es restaurable. Documentar Worker Pages y configuraciones actuales como punto de reversión; no confiar solo en el backup de Preview.
3. Aplicar únicamente 0153/0154 a D1 Producción utilizando `wrangler` con **configuración de Producción identificada y revisada**, no reutilizar `wrangler.preview.toml`.
4. Desplegar Web/App/Worker de la misma revisión aprobada, verificando rutas públicas y privadas, sin alterar dominios ni bindings por accidente.
5. Ejecutar smoke tests autenticados de lectura y uno de creación controlada aprobado para cada línea. Vigilar métricas y errores.
6. Si falla: revertir Worker y Pages a versiones previas. **No eliminar automáticamente tablas 0153/0154 ni restaurar D1 encima de escrituras de clientes**; primero comparar estado y definir recuperación segura. Una restauración completa podría borrar altas recientes.
7. Registrar commit, versiones de deployment, backup, migraciones, pruebas, aprobaciones y momento de salida.

## Riesgos abiertos
- La generación de correlativos usa `MAX(sequence_number)` seguido de inserción. Una concurrencia extrema puede producir conflicto UNIQUE; evita duplicados, pero la operación afectada podría necesitar reintento.
- Numeraciones físicas existentes impresas deben compararse antes del primer lote nuevo comercial.
- Este documento no autoriza por sí solo despliegue productivo, migración productiva ni merge del PR.
