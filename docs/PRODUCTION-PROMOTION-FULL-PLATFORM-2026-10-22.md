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

## Contraste documental: bitácoras históricas (revisión 2026-10-22)

Fuentes consultadas de archivos de proyecto (contenido histórico, no evidencia del estado vivo de Cloudflare):

- `BITACORA_MAESTRA_KAWVO_LINK_CONFIG_PORTAFOLIO_RECORRIDOS_2026-10-02.pdf`: registra despliegues productivos de ajustes de configuración/portafolio y persistencia de recorridos; reporta SHAs productivos `d390d6fb...` y `d278cc04...`, con esos frentes cerrados. **Refuta la hipótesis de que absolutamente nada fue lanzado antes a Producción.**
- `BITACORA_MAESTRA_KAWVO_LINK_TRIAL_HANDOFF_2026-09-19.pdf`: describe runner productivo completado para un frente de Trial con migraciones D1 `0071–0073` y smoke productivo. Evidencia histórica, requiere confirmación en entorno.
- `BITACORA_HANDOFF_KAWVO_LINK_POST_RELEASE_QA_2026-09-02.md`: documenta QA *posterior* a un release productivo y hotfixes pendientes. No equiparar rama Preview con Producción.
- `BITACORA_MAESTRA_HANDOFF_KAWVO_LINK_AGENDA_MEDIA_PWA_2026-09-30.pdf`: señala que Agenda/PWA no debía darse por promovida al cerrar ese documento; migraciones Preview 0080–0082 aplicadas y publicación productiva pendiente entonces. Más adelante pudieron existir despliegues: contrastar con D1 y Worker actuales.
- `BITACORA_MAESTRA_KAWVO_LINK_HANDOFF_2026-10-05.pdf`: registra un hotfix de login/sponsor de Producción como pendiente prioritario *a fecha del documento*, además de Free Demo. La rama actual `main` puede contener trabajos posteriores; no interpretar lo histórico como estado actual.
- `BITACORA_MAESTRA_KAWMED_HANDOFF_2026-10-20.pdf`: confirma KawMed en QA/Preview, migraciones productivas 0090–0099 preparadas y no aplicadas en aquel cierre, y exigencia de autorizar integración con `main`.

### Conclusiones de conciliación
1. No es correcto decir que "toda la plataforma nunca estuvo en Producción". Es más preciso: **existe una Producción con releases previos, y se pretende elevar la totalidad de avances aprobados en QA sin regresiones**.
2. El inventario debe establecer por módulo y por ambiente: release documentado, rama/SHA GitHub, migración D1 efectiva, ruta HTTP, configuración Worker y aprobación QA; cada una es evidencia distinta.
3. Mantener aislados datos de la DB `intap_db_preview`: no copiarlos a `intap_db`. Datos de clientes, credenciales y consentimiento requieren tratamiento independiente.
4. **Gate adicional:** los antecedentes indican incidencias reales posteriores a releases. No bastan tests de contrato o HTTP 200; las rutas de login, claim, sponsor, agendas, perfil público y flujos administrativos necesitan smoke funcional.
5. Este documento corrige un supuesto del análisis inicial: los despliegues históricos aparecen en bitácoras, pero la versión exacta actualmente desplegada todavía necesita verificación Cloudflare.

### Matriz inicial de módulos basada en bitácoras
| Dominio | Evidencia histórica | Acción requerida |
|---|---|---|
| Free / Perfil público | releases anteriores documentados | verificar SHA real, QR/NFC, edición y datos |
| Trial | runner productivo y migraciones 0071–0073 relatados | verificar Trial vigente, límites, reclamación/upgrade |
| Sponsored / Team | releases y hotfixes descritos | verificar login, patrocinadores, multicuenta, privacidad |
| Agenda / PWA / Media | Preview aprobada; producción pendiente en bitácora Sep 30 | verificar esquema 0080–0082 actual y ruta, smoke push |
| Configuración / Portafolio / Recorridos | bitácora Oct 2 declara Producción completada | verificar persistencia sin regresión |
| Free Demo / Master | bitácora Oct 5 registra pendientes; rama release Oct 19 igual a main | conciliar release efectivo vs código y D1 |
| KawMed | bitácora Oct 20 lo conserva en Preview | 11 migraciones pendientes, no copiar seeds demo |

**Secuencia recomendada:** inventario vivo Cloudflare y D1 → reconciliación contra bitácoras → pruebas end-to-end → migración compatible → publicación escalonada → verificación y actualización de main.

## Evidencia del inventario Cloudflare ejecutado por operador — 2026-10-22 07:39 RD

Fuente: salida de `scripts/inventory-production-platform-2026-10-22.sh`, suministrada por el operador desde Mac (Wrangler 3.114.17; macOS 12.6).

- Refs al momento de la ejecución: HEAD local `a0d56a6f`; `github/main` `2391896286839528557066968ca4b8abe9831fb9`; feature remota `42969b3b47b71fcce0d813273b3ff3a878330c1e`.
- Los dos proyectos Pages consultados (`intap-link` y `intap-web2`) listaron deployments **Preview** asociados a la rama feature, entre ellos `42969b3`, `dab4afd`, etc. No mostraron entradas `Production` en la salida; esto **no prueba** por sí solo que no exista otra vía de servicio mediante custom domain/Worker/proyecto distinto. Verificar configuraciones Pages, dominios y deployments por entorno.
- `intap_db` Producción: exactamente 11 migraciones pendientes: 0090–0099 y 0150 KawMed. `intap_db_preview`: "No migrations to apply".
- HTTP simple: `https://intaprd.com/` 200; `https://app.intaprd.com/` 200; `https://api.intaprd.com/` 503; `https://preview.intaprd.com/` 200; `https://app.preview.intaprd.com/` 200.
- El HTTP 503 corresponde **solo a la ruta raíz** de API; no se probó `/api/*` ni un endpoint de salud conocido. No diagnosticar caída global de la API sin esa comparación.
- Advertencias Wrangler: runtime macOS 12.6 no soportado según CLI (recomienda >=13.5), Wrangler 3.114.17 desactualizado. No forzar upgrade major sin pruebas ni descartar advertencia.

### Consecuencias para el corte
1. **No ejecutar runner KawMed**: su alcance sigue siendo parcial, no cubre promoción integral ni topología/rollback; adicionalmente conserva un bloqueo fail-closed.
2. Confirmar si `api.intaprd.com` tiene una falla real en la ruta raíz o error de Worker custom domain. Antes de aplicar 11 migraciones verificar rutas API existentes en ambos dominios y, preferiblemente, un health endpoint documentado.
3. Inventariar deployments `Production` de Pages y bindings/domains utilizando Cloudflare Dashboard o CLI con datos de entorno; las entradas Preview no sirven como evidencia de rollback productivo.
4. Preparar maniobra de rollback de Web/App/Worker **independiente de datos D1**; migraciones son forward-only salvo plan probado.
5. Ejecutar ensayo de migraciones sobre respaldo SQLite aislado y comprobar compatibilidad con API activa.
6. Evitar confundir las advertencias de versiones con errores efectivos: CI aprobada no equivale a paridad operacional real.

**Estado: inventario parcial pero útil, no autorizado para publicación.**

## API productiva: health verificado por operador (2026-10-22)

El operador ejecutó curl para `https://intaprd.com/api/health`, `https://app.intaprd.com/api/health` y `https://api.intaprd.com/api/health`. Los tres devolvieron **HTTP 200** con JSON `ok:true`, `status:healthy`, `environment:production`, `worker:intap-api`. Esto confirma salud básica del Worker y conectividad por sus tres hosts; **no certifica** todos los endpoints ni compatibilidad de nuevas migraciones. Los previos 404 en `/api/` eran comprobaciones de ruta no configurada y el 503 de `/` del dominio API no debe considerarse caída global.

**Próximo gate:** ensayo de migraciones sobre copia aislada de D1, verificación de compatibilidad del esquema y plano de rollback Pages/Worker. No ejecutar todavía runner anterior de KawMed.

## Ensayo D1 con datos reales anonimizados en reporte — aprobado 2026-10-22

El operador ejecutó `dry-run-kawmed-migrations-on-backup-2026-10-22.sh` sobre el SQL de respaldo local verificado por SHA256. Se aplicaron las **11 migraciones** 0090–0099 y 0150 en SQLite temporal, sin fallas SQL y con `PRAGMA integrity_check=ok`. La prueba antes/después mostró la misma violación de FK heredada: `profile_videos|1|profiles|0`. **Ninguna violación nueva fue introducida**. No borrar el registro de Producción sin identificar su origen; el operador aclara que los perfiles usados en QA eran ficticios, lo cual no demuestra el origen de este registro específico en `intap_db`.

**Gate de integridad de migraciones: PASA con incidencia heredada documentada.** Persisten gates independientes de compatibilidad funcional, seguridad y rollback de infraestructura para el lanzamiento integral. La base productiva sigue intacta.

## Despliegues productivos Pages — inventario ejecutado 2026-10-22

Operador ejecutó `verify-kawvo-production-readonly-2026-10-22.sh` sobre Cloudflare autenticado. `github/main=2391896286839528557066968ca4b8abe9831fb9`; candidato `10e2f12d71eb165e2b79461163ba485f2d3bf160` a ese momento. API health 200 en los tres dominios. `wrangler pages deployment list --environment production` identifica:

- **Web** `intap-link`: deployment de Producción para SHA `2391896` en `https://7588f64f.intap-link.pages.dev` con estado `Idle`; en lista otra ejecución del mismo SHA `https://dabc4a57.intap-link.pages.dev` marcada temporalmente `3 days ago`.
- **App** `intap-web2`: deployment de Producción SHA `2391896` en `https://66e1b98b.intap-web2.pages.dev` con estado **Failure**; otra ejecución del mismo SHA `https://22418cee.intap-web2.pages.dev` marcada `3 days ago`. Varias entradas anteriores de App `Failure`; identificar con Cloudflare qué deployment está sirviendo el dominio antes de decidir rollback.
- **D1** continúa con 11 migraciones KawMed pendientes; ninguna aplicada.

**Importante:** no interpretar la lista (orden, columna `Status` y `3 days ago`) como prueba suficiente de deployment **activo** ni considerar `Failure` recuperable. Debe consultarse detalle del deployment efectivo de `app.intaprd.com`, configuración git/build Pages y versión del Worker `intap-api` antes de corte. La comprobación de salud de API no permite inferir su SHA publicado.

## Worker productivo identificado — 2026-10-22
La salida autenticada del operador de `wrangler deployments list --name intap-api --config wrangler.toml` registra como último despliegue (2026-10-19T06:48:47.116Z) la versión `ce72ba26-95ec-4243-8e9e-fd2e3efcaf6d` al **100%**. La versión inmediatamente anterior (2026-10-19T06:48:02Z) fue `4503fb62-0608-4e32-bdac-c357fd82f41e`. La salida lista los despliegues, pero no contiene SHA de Git del Worker: **no asumir equivalencia automática con `2391896`**.

Al mismo tiempo, `intaprd.com/`, `app.intaprd.com/`, `intaprd.com/api/health` y `app.intaprd.com/api/health` retornaron 200. La consulta Pages confirma el commit productivo `2391896` en Web/App. La entrada reciente de App del mismo commit presenta `Failure`, por lo cual no sirve como rollback; confirmar deployment efectivo y preservar identificador de uno publicado con éxito mediante Dashboard antes del cambio.

**Punto de restauración Worker identificado, pero no ensayado.** Antes de modificar, documentar y validar comando y permisos necesarios para rollback de Worker; las migraciones D1 no se revierten con el rollback de código.
