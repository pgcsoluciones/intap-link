# Auditoría de alcance: plataforma completa QA → Producción (22 oct 2026)

**Esta publicación NO se limita a KawMed.** Se debe promover la plataforma consolidada Web, App, API, D1, R2 y Workers de forma coordinada sin regresiones.

## Hechos comprobados en repositorio
- `main` referencia `2391896286839528557066968ca4b8abe9831fb9`.
- `release/free-demo-master-v2-production-2026-10-19` coincide con `main`; `preview/consolidated-fixes-2026-10-03` está detrás de `main`. No fusionar ramas antiguas por nombre.
- `reconcile/kawmed-medical-profile-v1-2026-10-19-v2` está >300 commits adelante de `main`, con cambios en API, App, Web, patrocinio, autenticación, agenda y 11 migraciones.
- `api/wrangler.preview.toml` publica Worker **frontdoor** (`preview-frontdoor-entry.ts`): proxy de App/Web Preview y API por `*.preview.intaprd.com`.
- `api/wrangler.toml` publica Worker **API** (`preview-free-entry.ts`) solo en `/api/*` de dominios productivos; no hay equivalencia 1:1 entre topologías. **No copiar configuración Preview a Producción**.
- Web/App usan `.env.preview` y `.env.production` con orígenes distintos: construir con `npm run build` para Producción, no `build:preview`.
- En preflight remoto se identificaron exactamente 11 migraciones KawMed pendientes para D1 `intap_db`.
- Backup remoto `intap_db_before_kawmed_20261022T061608Z.sql` exportado y restaurado localmente; integridad OK. Nunca almacenar copia de datos reales en Git.
- QA de KawMed y builds productivos anteriores aprobados; CI GitHub del último código comprobar por commit.
- Auditoría npm: 24 alertas, incluyendo `shell-quote` crítica, `xlsx` alta sin arreglo automático; `xlsx` se usa para **exportar** en SuperAdminArtifacts. Clasificar exposición de runtime vs tooling, resolver CVEs materiales sin actualización mayor indiscriminada.

## Bloqueos detectados de la estrategia anterior
1. El antiguo runner `run-production-kawmed-v1-2026-10-22.sh` fue diseñado para KawMed, **no para plataforma completa**. No ejecutarlo.
2. Contiene bloqueo deliberado antes de migraciones; no es un script autorizado para Producción.
3. Publicar Web/App a Pages antes de verificar la compatibilidad de API puede dejar un intervalo con componentes desincronizados.
4. No hay validación de rollback de Pages/Worker independiente de D1 ni smoke end-to-end autenticado.
5. Los tests de contratos aprobados no garantizan por sí solos regresiones funcionales ni seguridad total.
6. Diferencias de topología: Preview frontdoor `/\*` vs Producción API `/api/*`; inventariar rutas, Workers, cron y orígenes antes del corte.

## Plan por etapas (con puertas de salida)
**Fase A — Inventario y congelación:** determinar heads desplegados efectivamente de Web/App/Worker Preview y Producción (no inferir de SHA local), variables/secrets/bindings D1/R2, dominios, cron, módulos QA no fusionados, rutas publicas y rutas admin. Congelar HEAD candidato y revisar diffs `main...candidate`. Salida: manifiesto de release completo y rollback para cada componente.

**Fase B — Validación sin cambios remotos:** realizar `npm ci`, suites de contratos + integración en entornos equivalentes, builds `web/app/api`, auditoría de permisos/sesiones/Agenda/Trial/Sponsored/Free/Medical, revisión de cambios críticos, triage audit y prueba de restauración. Salida: evidencia reproducible y aprobación técnica registrada.

**Fase C — D1:** confirmar backup más reciente, revisar migraciones contra esquema real y ensayarlas sobre copia local de DB, comprobar FKs y esquema resultante. Aplicar solo migraciones permitidas una vez demostrada compatibilidad hacia atrás del Worker productivo. Las migraciones aplicadas a D1 no se revierten simplemente con rollback de Worker.

**Fase D — Despliegue gradual:** respaldar las versiones actuales de Pages y Worker; publicar servicios en orden demostrado compatible (API, App, Web o según compatibilidad verificada), comprobar cada fase, detener ante error. Usar solo bindings/orígenes/ramas de Producción. No mezclar URL de QA con producción. Evitar publicar D1 y frontends en el mismo paso irreversible sin checkpoints.

**Fase E — Smoke y reconciliación:** rutas públicas /, /demo, /trial y perfiles; autenticación y callback; navegación App; patrocinio, Master y multicuenta; Agenda; KawMed sin fixture Laura de Preview; privacidad, notificaciones, flujos de activación. Revisar errores Worker/logs. Solo tras confirmar estable, integrar SHA desplegado a `main`, etiquetar y registrar evidencia.

**En todos los pasos**: controles fail-closed, intervención del operador solo si la cuenta Cloudflare requiere ejecución de un comando local; no prometer publicación si la auditoría no prueba paridad.

## Estado
**No autorizada publicación automática desde este documento.** El runner KawMed parcial anterior no cubre el alcance real; el objetivo es crear un nuevo release de plataforma completa después de manifest y pruebas.
