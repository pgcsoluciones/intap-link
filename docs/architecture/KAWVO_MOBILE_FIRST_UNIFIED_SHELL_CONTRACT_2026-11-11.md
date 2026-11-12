# Kawvo — contrato de experiencia administrativa unificada móvil
Fecha: 11 nov 2026. Estado: especificación, NO implementada ni desplegada.

## Principio irreversible
Reorganizar exclusivamente la interfaz PRIVADA de administración por composición visual. No cambiar persistencia, APIs, permisos, autenticación, cuentas activas, rutas de publicación, activación NFC/QR, contenidos, datos, ni perfiles públicos. La diferencia entre productos debe estar en permisos y capacidades preexistentes, NO en una experiencia de navegación radicalmente distinta.

## 1. Jerarquía de dispositivos
- CELULARES PRIMERO (320, 360, 390, 430 px): navegación inferior con Inicio / Perfil / Agenda / Más (ocultar destino si no aplica al rol), cabecera compacta, información de cuenta activa, CTA principal inequívoco, columnas simples, sin scroll horizontal ni solapamiento con teclado o safe-area.
- TABLETAS SEGUNDO: misma terminología, editor con 2 columnas cuando sea útil, paneles contextualizados, controles táctiles.
- ESCRITORIOS TERCERO: ampliar la misma arquitectura usando espacio horizontal, sin inventar menús ni nomenclatura divergente.
- Áreas táctiles >=44x44 px; texto normal 14–16 px; estados/foco accesibles, botones identificables, contraste y navegación por teclado. Evitar tarjetas excesivas y estilos de botones que compitan visualmente.

## 2. Shell común por rol
| Tipo | Inicio | Perfil | Agenda | Más |
| --- | --- | --- | --- | --- |
| Free | progreso, borrador/publicación, siguiente paso, vista previa | identidad, contacto, acciones rápidas, ubicación, enlaces, portafolio, diseño | solicitudes/disponibilidad cuando esté habilitada | Mi cuenta/credenciales, IA, bancos elegibles, planes y soporte |
| Kawvo Link de pago | estado, accesos y presentación | editor pagado existente, links, FAQs, productos, bloques, medios y plantillas | únicamente funciones actuales del plan | cuenta, configuración y soporte |
| KawMed profesional | citas, siguiente acción, estado de perfil | identidad profesional, especialidades, centros, horarios de centros, seguros, apariencia | agenda médica y solicitudes | notificaciones, PWA, cuenta, suspensión/eliminación protegida |
| Beneficiario patrocinado | presentación, estado, recordatorio de publicación | perfil, multimedia, enlaces, botones de cita/cotización y demás datos habilitados | por perfil seleccionado y permiso existente | patrocinio, recursos, configuración/soporte |
| Patrocinador Master/admin | actividad comercial + acceso visible y separado a Mi presentación | presentación Master propia, sin mezclar con la identidad comercial | agenda Master por scope vigente | identidad comercial, marca, inventario M/P/L, vendedores/visitadores autorizados, credenciales |
| KawMed invitado/Master | sólo capacidades delegadas | editor scoped de invitado o presentación Master | según permisos y scope | sólo herramientas autorizadas |

Los destinos son conceptuales, no crean permisos. Un rol sin Agenda no debe recibir un botón que abra una ruta prohibida. Un Master no se convierte en beneficiario, y un invitado no se convierte en dueño.

## 3. Estados de experiencia, comunes pero sin reemplazar las reglas específicas
- Primer acceso: continuar onboarding ya existente.
- Borrador incompleto: conservar datos guardados, indicar faltantes reales, siguiente paso específico, continuar configuración.
- Borrador listo para publicar: conservar exactamente el aviso, las condiciones de guardado, el CTA y la confirmación. Nunca publicar al navegar.
- Publicado: accesos a perfil público y compartir; requisitos completados pueden colapsarse, jamás desaparecer del editor.
- Inactivo/suspendido: mostrar el estado real y conservar los controles de reactivación/seguridad ya aprobados.
- Multicuenta: indicar cuenta activa, cambiarla explícitamente, verificar kind+id, no contaminar datos entre cuentas.
- Team, invitado y patrocinios: controles por permisos originales; la interfaz no sustituye las autorizaciones de API.

## 4. Contratos INTACTOS y pruebas bloqueantes
### C01 — Autenticación y multicuenta
Conservar AdminGuard, planScope, TeamPermissionGuard, activeIntapTabHeaders, sesión/cookies host-only, selección explícita del tipo e ID de cuenta y aislamiento de pestañas. Nunca volver a provocar el loop Free de vista previa a selector. Conservar la diferencia entre edición Free (/admin/free), Mi cuenta (/admin/free/account), Agenda (/admin/free/agenda) y el botón de ownerbar «Mi perfil» al panel correcto.

### C02 — Free
No modificar flujo ni criterios de FreeDashboard, FreeFirstRunGuide, onboarding, edición multimedia, tour, diseño, protección por Team, datos demo, IA, bancos según elegibilidad, PWA ni planes. Mantener borrador, aviso de perfil listo, requisitos pendientes, guardado, publicación/despublicación y retorno del editor.

### C03 — Link pagado
No reemplazar el editor de pago por el de Free. Mantener catálogo, enlaces, FAQs, videos, bloques, temas, plantillas y todas las rutas de edición y acciones existentes; preservar requisitos y estado de publicación.

### C04 — KawMed profesional, Master e invitado
Conservar scopes doctor/sponsor_master, delegación y autenticación; prefijo/nombre/especialidades, centros, horarios vinculados a centros, seguros y excepciones, fotos, plantillas, guardado, avisos y confirmaciones de publicación. Nunca confundir horario público del centro con disponibilidad de Agenda. Conservar demo/invitados y códigos MED/MEDM sin doble activación. Suspensión y eliminación requieren las confirmaciones actuales. No tocar el perfil público /m/ ni sus enlaces.

### C05 — Beneficiarios patrocinados y Master
Conservar modo beneficiary/master, profile_id y scope master, selector, SponsoredResumeGate y reanudación. Antes de publicar se guardan cambios; se verifica respuesta y estado persistido del MISMO perfil antes de declarar éxito. Conservar activación, consentimiento, botones Cotizar/Agendar, medios, QR, bancos, perfiles, roles, patrocinadores, inventario y aislamiento comercial. Master mantiene Mi presentación y Gestión de patrocinio claramente separados; vendedor y visitador no reciben privilegios por cambiar UI.

### C06 — Perfil público y NFC/QR
Este proyecto NO modifica código ni estilos de Web pública, API ni Worker, D1/R2, migraciones, OG, vCards ni QR; sin tocar /l/:publicCode, /m/:slug, /p/:username y perfiles Link públicos. Inspección de patrocinador es sólo lectura; CTA de activación exige autorización previa; no divulgar tokens de un solo uso. PR #149 del identificador físico previo a activación sigue siendo trabajo independiente.

### C07 — Cuenta, avisos, PWA, recuperación y media
Conservar rutas de credenciales, recuperación/reanudación de sesión, vuelta a configuración, estado de publicación, notificaciones, carga y edición de imágenes, todas las confirmaciones, enlaces, scopes y guards del servidor.

## 5. Entregas en fases, cada una con aprobación y rollback
A. Este documento: contratos, mapa de roles y navegación; SIN modificación de UI.
B. Prototipo visual aislado para celular (320–430), tableta, desktop, con datos ficticios; no sustituye rutas ni API.
C. Shell dentro de Free, Preview, manteniendo componentes existentes y feature flag de reversión; QA independiente/Team/multicuenta.
D. Shell KawMed, Preview: profesional, invitado, Master; QA de centros, horarios, seguros, agenda, borrador y publicación.
E. Shell beneficiario patrocinado + patrocinador Master/admin, Preview: perfiles específicos, inventario, selección, permisos, publicación y asignaciones.
F. Shell Link pagado, Preview: validar todas las funcionalidades históricas y no redirigir a Free.
G. Releases individuales con preflight, versiones Cloudflare fijadas, control exacto de archivos, rollback y QA móvil real; no fusionar masivamente ramas históricas con main.

Cada fase exige pruebas actuales existentes, pruebas nuevas de navegación, TypeScript/build, controles reales por usuario/rol/estado, y capturas en móvil/tableta/escritorio. Los contratos estáticos NO sustituyen una QA autenticada. El rediseño no puede disparar escrituras nuevas ni obligar a migraciones.

## 6. Criterios de rechazo
Bloquear una fase si altera rutas públicas, filtros de tenant/owner, selección multicuenta, identidades NFC, APIs, reglas de publicación, requisitos de guardado, borrador, retorno a editor, activación MED/M/P/L, PWA, permisos invitados, controles comerciales, recuperación de cuenta, estados o código fuera de la allowlist. No aceptar tests relajados sólo para pasar una compilación. No publicar Producción sin aprobación explícita.

## 7. Situación constatada al establecer el contrato
Free Multicuenta vista previa y «Mi perfil» confirmados en Producción por usuario; Worker API `3d4973e4-e344-493a-a065-93f199b00359`. PR #149 muestra nueva identificación física para patrocinados solamente en Pages QA aislada `d248cfbf.intap-link.pages.dev`, pendiente QA funcional y publicación. Issues #120, #127, #128, #129 y #148 continúan. Issue KawMed #135 cerrado porque contenido sin terminar, no bug. main diverge de la rama release y NO se debe hacer merge/deploy general sin reconciliación.

Este documento es una propuesta de contrato, no un cambio visual ejecutado.