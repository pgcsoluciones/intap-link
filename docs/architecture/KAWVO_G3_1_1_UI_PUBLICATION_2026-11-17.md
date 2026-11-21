# KAW-G3.1.1 — Jerarquía y aviso de publicación

Gate: corrección App UI de Kawmed Doctor y Kawlink Free; G3 completo OPEN. Orden: [comentario 6951770348 de #170](https://github.com/pgcsoluciones/intap-link/pull/170#issuecomment-6951770348). Base sucesora exacta `34d57a4bfebc9e59b0347d0497a159ca3f46ce7e`, rama `feat/kawmed-g3-1-1-publication-hierarchy`. Main remoto observado `6e6bfbb1bd60c91a94e92d36f6cfdd9f91e3d9e2`. #170 y runner #171 permanecen intactos.

## Referencias y misión

Se consultaron arquitectura [#150](https://github.com/pgcsoluciones/intap-link/pull/150), fuente del prototipo [#151](https://github.com/pgcsoluciones/intap-link/pull/151) en `b089bcdc1c82dce9c4e87e08ddee003503e0bd0c`, maestro [#156](https://github.com/pgcsoluciones/intap-link/pull/156) y eficiencia [#172](https://github.com/pgcsoluciones/intap-link/pull/172). AGENTS.md #169 se mantiene como referencia leída sin integrar ramas históricas.

El prototipo organiza Inicio como identidad/estado, aviso contextual, accesos principales y siguiente paso; utiliza superficies blancas, tipografía compacta, cyan y navegación común. La corrección aplica esa jerarquía con datos actuales, conservando los mínimos de cada producto y sin copiar porcentajes de demostración. La captura autenticada del propietario acredita visibilidad del shell anterior; no constituye aceptación visual de esta corrección.

Allowlist de este lote (seis archivos):

```text
app/src/components/admin/medical/MedicalDashboard.tsx
app/src/components/admin/free/KawvoFreeShellPreview.tsx
app/src/components/admin/shared/KawvoProfileIdentity.tsx
app/src/components/admin/shared/KawvoReadyToPublish.tsx
scripts/test-kawvo-g3-1-1-ui-contract.mjs
docs/architecture/KAWVO_G3_1_1_UI_PUBLICATION_2026-11-17.md
```

Sin cambios API, Web, Workers, D1/R2, OAuth, rutas/guards, runners, infraestructura, dependencias ni lockfiles. Publicación, guardado y logout conservan sus operaciones originales. No se adapta invitado/Master ni se inicia G3.2/G4.

## Investigación y hallazgos

- **Free también en main:** `FreeDashboard.tsx` conserva el diálogo `readyPromptDismissed` en su variante legacy, pero la entrada canónica redirige al shell en los hosts/builds soportados. El shell de main y el de #170 son idénticos: muestran estado/CTA pero no montan el diálogo de perfil listo. El test de baseline usa fuentes reales de main para reproducir ambas variantes. La falta de modal en ese shell es comprobable; no se atribuye al backend.
- **Kawmed:** el diálogo sigue existiendo tanto en main como en #170. `readyPromptDismissed` se inicializa a false una vez y solo pasa a true en sus botones; no existe reinicio al cambiar el perfil durante la misma instancia. `publicationReadiness` exige nombre, especialidad y slug guardados y compara sus borradores. No se presupone que esta sea la única causa de la observación autenticada: las pruebas verifican montaje, edición sin guardar, error, transición guardada, nueva identidad y reanudación.
- **Mínimos frente a recomendaciones:** médico conserva tres campos obligatorios; foto/centros/horarios son recomendados. Lectura de `getFreePublicationReadiness` en `api/src/index.ts` confirma que Free exige identifier, identity, photo y hero, mientras contacto/acciones/portafolio/servicios no bloquean. El shell sigue exigiendo la respuesta real `freeReadiness.ready` y sus prerrequisitos existentes; no calcula disponibilidad por un porcentaje ni cambia esa API.

## Corrección

`KawvoProfileIdentity` compone nombre/detalle/avatar y utilidades superiores derechas adaptables, sin poseer datos ni operaciones. En médico reutiliza instalación PWA y logout protegido del padre; identidad, publicación y acciones del perfil se separan, los accesos principales pasan después del estado/requisitos, y el estado Publicado se muestra una vez en el shell. Los controles y confirmación actuales se componen una vez por variante; legacy conserva su funcionamiento.

En Free la misma cabecera compone `FreeShellSessionExit` sin modificarlo. Instalar app abre el módulo existente Mi cuenta con su contexto de retorno, donde permanece la instalación PWA original; no se introduce otro motor de instalación ni se toca FreeAccount. No se modifica FreePublicationActions ni su endpoint, pending ref, error handling o notificación posterior a publicación. La revisión del aviso lleva al control original; no ejecuta la mutación.

`KawvoReadyToPublish` es una preferencia de presentación por producto+rol+perfil autorizado. Su instancia se reinicia al cambiar esa identidad; «Más tarde», Escape o revisar se recuerdan en sessionStorage y memoria de la SPA. No guarda credenciales, no selecciona cuentas y no autoriza acciones. La preferencia no se reinicia por cada render, tab, vuelta a editor o recarga del mismo perfil. Otro perfil/rol no hereda el descarte. El banner y CTA permanecen cuando el perfil sigue listo, aunque se cierre el modal. Si faltan datos o ya está publicado, se ocultan; no se publica por mostrar/navegar/cerrar el aviso. Si el almacenamiento está restringido, la memoria conserva la preferencia mientras dure la SPA.

En médico solo aplica al shell doctor autorizado, sin delegación y en borrador. Durante operaciones o borradores pendientes no se interrumpe al usuario con el modal; los requisitos guardados siguen siendo los del padre. La variante legacy conserva su diálogo original. Free respeta los filtros existentes de Team/delegación y las respuestas de permisos/carga. El modal tiene foco inicial, Escape, recorrido de Tab entre sus acciones y controles de al menos 44 px.

## Validación y handoff

| Comprobación | Resultado |
| --- | --- |
| Contrato nuevo: seis archivos, comparación Free contra main, operaciones/efectos médicos y mutaciones/logout legacy Free conservados | PASS |
| Navegador: 21 escenarios con componentes reales, React/router y CSS compilado; seis anchos por producto (320/360/390/430/768/1280) | PASS con fixtures |
| Baseline main Free: entrada redirige a shell sin modal; legacy conserva el modal | PASS reproducido con las fuentes reales de main |
| Transiciones guardadas/sin guardar/error; mínimos sin recomendaciones; Más tarde/Escape; foco/Tab; reanudación; perfiles/rol Team; publicación explícita/error/despublicación | PASS con fixtures |
| Jerarquía, nombres largos, utilidades derechas de al menos 44 px, sin overflow, último control sobre navegación inferior y navegación sin escrituras | PASS con fixtures |
| Logout médico con confirmación/cancelación de borrador, PWA médica y ruta existente de instalación Free, fallback doctor/Master/delegado/inactivo/error | PASS con fixtures |
| 11 contratos existentes Kawmed, MED/MEDM/invitados, multicuenta/cuenta activa y regresiones Free G2/G5 | PASS, 11/11 |
| TypeScript App mediante tsc de los builds; build App Preview y build App Producción exclusivamente local | PASS |
| Diff check e inventario del lote | PASS |

Comandos: `node scripts/test-kawvo-g3-1-1-ui-contract.mjs --browser`, `npm run build:preview -w app`, `npm run build -w app` y `git diff --check`; se ejecutaron individualmente los 11 contratos de Kawmed/Free/multicuenta ya documentados en el handoff G3.1. Toolchain Node 20.20.2 y dependencias/Chromium existentes; sin instalaciones ni cambios de versión. Warnings existentes de Vite CJS, Browserslist y tamaño de chunk permanecen sin silenciar. Las respuestas de API se interceptan en memoria: no acreditan QA autenticada ni datos D1/R2/OAuth.

Capturas sintéticas locales: 12 PNG en `/workspace/work/kawvo-g3-1-1/`, un Inicio publicado por producto/ancho. Se inspeccionaron 320 y desktop para ajustar el espacio del nombre frente a utilidades; no son capturas del entorno autenticado ni una aprobación visual. El contrato de rutas médico detectó al principio una incompatibilidad de distribución JSX con su comprobación de controles Master; se mantuvo la composición compatible y se repitió PASS, sin editar ni relajar el test. Los escenarios de fallback comprueban también el diálogo legacy y que Master conserva acceso a su confirmación de publicación.

El contrato congelado G3.1 de cinco archivos sigue referido a #170. No se amplía ni se relaja para este lote sucesor coordinado: el contrato nuevo compara contra ese SHA y exige exactamente los seis archivos anteriores, preservando las operaciones y efectos existentes. Las regresiones G2/G5 y Kawmed correspondientes se ejecutan sobre la sucesora.

El PR sucesor apunta a main para usar la CI existente. Su diff acumulado incluye los cinco archivos de #170 más este delta de seis (MedicalDashboard es común): diez archivos en total, sin runners. El diff correctivo revisable se compara siempre desde `34d57a4bfebc9e59b0347d0497a159ca3f46ce7e`; #170 no se modifica. El SHA y resultado de CI del candidato sucesor se registran en su PR, sin atribuirle la CI del padre.

Pendiente Work: comparar la jerarquía con #151 usando datos largos y usuarios reales; 320/360/390/430 y desktop; incompleto→guardado/listo, cancelación/reanudación, cambio de perfil/rol, errores, publicado, logout con borradores y PWA desde Mi cuenta; no confundir horario de centro con disponibilidad Agenda. Confirmar que mostrar o revisar no publica. QA autenticada y aceptación visual permanecen OPEN.

Rollback de código: cambio inverso revisable en la sucesora; #170 exacto sigue como referencia. Fallback médico Panel anterior/sin opt-in; Free panel legacy existente. No se ejecutó merge ni despliegue ni se modificaron runners/infraestructura. Siguiente punto de control: revisión técnica del PR sucesor y QA independiente posterior a un Preview autorizado.
