# Levantamiento integral Producción vs Preview — Kawvo — 29 octubre 2026

## Regla de aceptación
Tres estados separados por módulo: (1) evidencia de aprobación y despliegue Preview con SHA, (2) fuente/servicio presente en Producción, (3) QA autenticada o pública del comportamiento real. Compilar, ver HTTP 200, o constatar una función en código NO prueba (3). No mezclar código y configuración D1. No renumerar ni migrar nuevamente 0153/0154.

## Despliegues comprobados
- API Worker productivo versión `d4292a17-ae59-4c16-b273-c8333bb24037`, tras despliegue de rama reconcile.
- App Pages productiva `https://1cd21351.intap-web2.pages.dev`, bundle `index-CotyKqz1.js`, checksum dominio verificado.
- Web Pages productiva `https://b8c55cd1.intap-link.pages.dev`, bundle `index-C68ENU8Q.js`, checksum dominio verificado.
- SHA del código de último deploy App/Web: `76de144aac03db4e05894d6866d32aa3c56c9f2e`.
- AVISO: la QA autenticada y escaneos aún no forman parte de estos resultados.

## Matriz de recuperación
| Módulo | Preview / contrato | En Prod | QA real | Acción pendiente |
|---|---|---|---|---|
| KawMed publicar/despublicar/republicar | aprobado por usuario | App y API | Usuario reportó OK | Conservar, no reescribir |
| KawMed recordatorio de publicación | aprobado | App | Usuario reportó OK | Conservar |
| Centros y horarios de atención | aprobado | App | Usuario reportó OK | Conservar |
| Free aviso al cumplir requisitos | aprobado | App | Usuario reportó OK | Conservar |
| Master patrocinado: barra de acciones de su presentación | aprobación específica aún por identificar | componente oculta barra con `isMaster` | Falta | P0 inmediato: reconciliar UX Master vs beneficiario con Preview; no confundir panel comercial |
| Beneficiario patrocinado: barra privada | contrato visible en componente `SponsoredDashboard` | App | Falta por perfil multicuenta | Probar dueño y beneficiario; revisar aislamiento |
| Publicación / despublicación / republicación patrocinada | comportamiento reportado aprobado en Preview | App y Worker | Reporte previo de borrador tras publicación | P0: E2E con lectura persistida, sin usar mensajes de UI como evidencia |
| Gestión comercial vendedores / Excel / asignaciones | funciones en Preview | App y API | Usuario mostró herramientas visibles en DAPSA al habilitar | P1: alta, Excel, selección lote, histórico, permisos, aislamiento y reversión |
| Grants de patrocinadores | Preview: f y laboratorios-doctores-mallen; Producción: DAPSA | separados por D1 | comparación read-only realizada | No copiar grants entre empresas. Verificar por ID, empresa y aprobación |
| MED identificador físico M | generación API + migración 0154 | Worker/App desplegados | No generar por prueba sin autorización | Validar emisión nueva + tabla listado + escaneo; no backfill de viejos |
| Patrocinado identificador P | API `/superadmin/sponsors/:id/generate-batch` devuelve `display_code` | Worker + App + Web nueva UI | Falta verificar escaneo reciente | P0: verificar en URL real pantalla de bienvenida con ID físico, tipo producto y código NFC |
| Link identificador L | contrato NFC físico, ruta precisa de creación pendiente de reconciliar | sin certificación | Falta | P0: identificar panel y ruta generadora; probar 1 lote controlado |
| Web pública /l/:publicCode | receptor patrocinado `SponsoredAwareArtifactResolver` | Web 76de144a | Falta QA visual | Verificar que lee `artifact.display_code` desde respuesta API para un producto nuevo |
| Escaneo de productos antiguos impresos | preservar identificadores antiguos | código / DB | Falta prueba real | Confirmar sin numeración retrospectiva y enlace persistente |
| Multicuenta | aislamiento backend / token de pestaña | código | KawMed funciona, sponsor parcial | Probar escoger perfil, refrescar, cambiar cuenta y doble pestaña |
| Master / patrocinador banners y perfil público | existen | App/Web | DAPSA perfil público visualizado | Validar banners, perfil, botón de navegación y publicación |
| PWA, Trial, Paid, Agenda, Notificaciones | histórico de QA distinto | por reconciliar | No probado en este corte | Inventario por bitácora y PRs antes de afirmar aprobado |

## Incidencia concreta encontrada y mitigada
El Web original recibía `display_code` desde `sponsored-scan.ts` pero omitía mostrarlo en la bienvenida; la App original recibía `display_code` desde generación de patrocinados pero omitía mostrarlo y copiarlo. Cambios de visualización desplegados 76de144a. No se modificaron rutas físicas ni datos existentes.

## Próxima fase sin falsos positivos
1. Inspeccionar datos read-only de artefactos **recién generados**: ID físico guardado, product_type, vinculación sponsor y URL; nunca incluir secretos ni cookies en logs.
2. Abrir enlace de artefacto de prueba y comprobar tipo/ID físico/código NFC/CTA y transición. No generar nuevos códigos innecesariamente.
3. Verificar publicación patrocinada y barra Master/beneficiario con cuentas propias.
4. Inventariar pendientes de líneas L / Trial / Paid / PWA / Agenda mediante historial aprobado y comparación de rutas; solo después planificar cambios.
5. Conservar historial SHA de cada cambio y pruebas funcionales; registrar pass/fail para cada caso.
