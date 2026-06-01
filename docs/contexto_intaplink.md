# **1\. Estado actual del proyecto**

El proyecto **ya no está en fase conceptual**. La documentación más reciente indica que se ha trabajado sobre el sistema real en producción: Worker/API en Cloudflare, D1, R2, frontend del panel, login Google, endpoints `/me/*`, preview pública y arranque del Super Admin.

A nivel de programación, estamos en una etapa avanzada de consolidación SaaS:

Perfil público: funcional  
API pública: funcional  
Panel usuario: funcional, pero necesita simplificación UX/mobile-first  
Auth: funcional con Google/Magic Link, ya corregidos varios loops  
Entitlements: base real activa  
Super Admin: lectura y mutaciones base implementadas  
Billing: foundation \+ lectura implementada  
SEO/GEO/Open Graph: implementado para perfiles dinámicos y fallback  
Plantillas especiales: funcionan, pero varias siguen hardcodeadas/fallback  
Onboarding express: propuesto, pendiente de implementación limpia

No estamos en “solo landing” ni en “mockup”. Ya hay sistema real, pero todavía falta convertirlo en una experiencia completamente amigable para usuarios no técnicos.

---

# **2\. Arquitectura general**

## **Repositorio y estructura**

La estructura confirmada del proyecto es:

/Users/juanluis/Desktop/intap-link

api/        → Cloudflare Worker \+ Hono \+ D1 \+ R2  
web/        → Frontend público React/Vite en Cloudflare Pages  
app/        → Panel usuario / Super Admin en React/Vite  
functions/  → Pages Functions / middleware edge

En la documentación base aparecen como archivos clave: `api/wrangler.toml`, `api/src/index.ts`, `api/migrations/*`, `web/.env.production` y `web/src/components/PublicProfile.tsx`.

## **Infraestructura Cloudflare**

La estructura actual de producción documentada es:

Frontend público:  
https://intaprd.com  
https://link.intaprd.com

Frontend app/panel:  
https://app.intaprd.com

Worker/API:  
intap-api

Rutas Worker:  
intaprd.com/api/\*  
app.intaprd.com/api/\*

D1 principal:  
intap\_db

R2:  
intap-r2

También existen proyectos Pages separados: `intap-link` para `/web` y `intap-web2` para `/app`, con dominios públicos y panel separados.

---

# **3\. Concepto funcional del producto**

INTAP LINK se divide en tres grandes capas:

## **A. Perfil público**

Es lo que ve el visitante cuando entra a:

https://intaprd.com/{slug}

Ejemplos trabajados:

/jprez  
/jason  
/novi  
/rentaord  
/creditorn  
/1aeventos  
/juan  
/fanny

El perfil público puede incluir:

Hero  
Nombre / empresa  
Bio  
WhatsApp principal  
vCard  
Redes sociales  
Servicios  
Productos  
Galería  
FAQs  
Mapa / ubicación  
Formulario de lead  
Chat flotante  
Open Graph / SEO / JSON-LD

La Fase 2 ya buscaba que el perfil no fuera solo informativo, sino convertidor: producto destacado, servicios, FAQ, CTA WhatsApp, etc.

---

## **B. Panel del usuario / tenant**

Es el panel donde el dueño del perfil edita su información.

Debe administrar:

Perfil  
Contacto  
Links  
Social links  
Productos / servicios  
FAQs  
Galería  
Visual  
Bloques / orden  
Plan / funciones disponibles  
Retención / downgrade

Ya hay base real para:

blocks\_order  
accent\_color  
button\_style  
theme\_id  
template\_id  
template\_data  
featured\_product  
datos de contacto / WhatsApp  
preview del panel

La Etapa 6 confirmó que ya existe persistencia real de layout y configuración visual, incluyendo prueba exitosa de `PATCH /api/v1/me/profile/blocks-order`.

---

## **C. Super Admin**

Es el panel interno de operación SaaS para ti/equipo.

Debe controlar:

Usuarios  
Perfiles  
Planes  
Módulos  
Trials  
Overrides  
Suscriptores  
Billing  
Métricas  
Auditoría  
Activar/desactivar perfiles

Ya existe una primera pantalla visual de Super Admin en:

app.intaprd.com/superadmin

Consume métricas y suscriptores, y luego se conectaron secciones read-only de billing.

---

# **4\. Qué se ha logrado**

## **4.1 Perfil público core**

Se logró tener perfiles públicos accesibles por slug, con API pública mínima y deploy online. Se resolvieron problemas iniciales de ramas, migraciones, build y routing. La documentación registra que el problema de `?slug=` parecía React, pero realmente era edge cache/alias; la solución correcta fue mover la redirección a `functions/_middleware.ts` en Cloudflare Pages.

## **4.2 Conversión avanzada**

Se avanzó del perfil básico a perfiles con:

producto destacado  
modal  
servicios  
FAQs  
CTA WhatsApp  
galería  
contacto

También se resolvió un problema importante: el frontend no reflejaba cambios porque había bundles viejos en Cloudflare Pages; la solución fue rebuild \+ deploy explícito.

## **4.3 Leads e interacción**

Ya se implementó captura de leads:

POST /api/v1/public/leads

Con:

name  
email  
phone  
message  
source\_url  
user\_agent  
ip\_hash  
created\_at

También se agregó antispam con honeypot, rate limit y Turnstile condicional en backend. El frontend tiene modal “Solicitar información / Contáctame”; el Turnstile condicional frontend quedó pendiente por decisión para no frenar.

## **4.4 Auth y panel protegido**

Se trabajaron Magic Link, Google OAuth, sesiones DB-backed, cookies y protección de rutas. Se resolvieron varios loops por dominios, redirect URI y rutas incorrectas. La bitácora más reciente indica que el acceso a `/admin` quedó protegido y que el login con Google finalmente quedó funcionando después de corregir state/callback.

## **4.5 Enforcement SaaS**

El backend ya no depende solo de UI para bloquear funciones. Se validó una función centralizada de límites por entidad y se aplicó `checkPlanLimit(...)` a:

links  
faqs  
products  
videos  
photos / gallery upload

También se corrigió ownership: `gallery/upload` ya no depende de un `profileId` arbitrario enviado desde frontend, sino del usuario autenticado.

Esto es clave: el sistema ya está entrando en una lógica SaaS seria.

---

# **5\. Modelo SaaS actual**

El modelo confirmado es:

Plan base  
\+ módulos activos  
\+ trials  
\+ overrides administrativos  
\+ expiraciones

Los overrides tienen prioridad final. El sistema permite flexibilidad para monetización: subir límites, desbloquear módulos, aplicar trials y personalizar condiciones por perfil.

Ejemplo conceptual:

Plan Basic:  
5 links  
3 productos

Módulo galería:  
\+10 fotos

Override admin:  
max\_products \= 20

Resultado efectivo:  
se calcula desde backend, no desde frontend.

La fuente de verdad debe mantenerse en backend y exponerse al frontend vía:

GET /api/v1/me  
GET /api/v1/entitlements  
---

# **6\. Super Admin y billing**

## **Super Admin**

Ya se implementaron endpoints read-only y mutaciones importantes. La documentación de cierre de 7.2B confirma que quedaron implementados, mergeados y probados en producción estos endpoints:

POST   /api/v1/superadmin/profiles/:id/change-plan  
POST   /api/v1/superadmin/profiles/:id/modules  
DELETE /api/v1/superadmin/profiles/:id/modules/:module\_code  
POST   /api/v1/superadmin/profiles/:id/override  
PATCH  /api/v1/superadmin/profiles/:id/status

## **Billing**

Se creó la base de billing con la migración:

api/migrations/0026\_billing\_foundation.sql

Tablas creadas:

billing\_subscriptions  
billing\_payments  
billing\_gateway\_configs

Luego se crearon endpoints read-only:

GET /api/v1/superadmin/billing/overview  
GET /api/v1/superadmin/billing/payments  
GET /api/v1/superadmin/billing/subscriptions  
GET /api/v1/superadmin/billing/gateways

Y se conectaron visualmente al Super Admin.

Esto significa que ya hay base para pagos manuales, suscripciones, pasarelas futuras y revisión administrativa.

---

# **7\. Seguridad y hardening**

Se hizo un bloque importante de endurecimiento:

Endpoints legacy bloqueados  
Galería protegida por sesión y ownership  
Stats protegidas por ownership  
public/track validando perfil activo/publicado  
vCard validando perfil, publicación y entitlement  
Agents module deshabilitado temporalmente por exposición sin auth

La documentación indica que se bloquearon endpoints legacy, rutas públicas/mutables inseguras, estadísticas y galería por sesión/ownership, además de deshabilitar temporalmente Agents porque estaba expuesto sin autenticación.

Esto es importante para un nuevo programador: **no reactivar endpoints viejos ni confiar en IDs enviados desde frontend.**

Regla obligatoria:

session → user\_id → profile\_id propio

Nunca:

frontend manda profileId → backend confía  
---

# **8\. Perfiles y plantillas actuales**

Actualmente conviven dos mundos:

## **A. Perfiles dinámicos desde API/D1**

Estos perfiles deben ser el futuro oficial SaaS:

profiles  
profile\_links  
profile\_products  
profile\_gallery  
profile\_faqs  
profile\_contact  
profile\_social\_links  
template\_id  
template\_data

## **B. Perfiles fallback/hardcodeados**

Algunos perfiles nacieron rápido como plantillas React directas:

/novi  
/jason  
/rentaord  
/1aeventos

Funcionan visualmente, pero no todos están convertidos en plantillas editables por tenant.

La bitácora SEO/GEO explica que un perfil fallback es uno que todavía no depende completamente de D1/API ni de un tenant editable, sino que vive como plantilla React directa con datos internos. El modelo futuro deseado es que esos perfiles tengan `profiles.slug`, `template_id`, `user_id` y `template_data` en D1.

---

# **9\. SEO, GEO y Open Graph**

Ya se implementó una primera estructura de SEO/GEO/Open Graph para perfiles públicos.

Archivos creados:

web/src/lib/profileSeo.ts  
web/src/lib/profileFallbackSeo.ts

Se conectó `PublicProfile.tsx` a SEO dinámico y fallback. Se validaron:

/novi    → RealEstateAgent JSON-LD  
/jason   → AutoPartsStore JSON-LD  
/rentaord → AutoRental JSON-LD

También se agregó Open Graph server-side para `/jason`, conservando `/novi` y `/rentaord`. El bloque quedó funcionando en producción con build y deploy aprobados.

Pendientes GEO/IA sugeridos:

/{slug}/facts.json  
/{slug}/ai.md  
/sitemap.xml dinámico  
/robots.txt revisado  
/llms.txt  
---

# **10\. Retención inteligente / downgrade**

Se implementó una primera versión de retención inteligente.

La regla de producto definida fue:

No borrar data  
Conservar configuración  
Pausar excedentes  
Permitir elegir qué mantener  
Mostrar recuperación clara

La bitácora de cierre confirma que quedó resuelto el núcleo: los datos no se borran, los excedentes se detectan, el usuario puede ver qué quedó activo y qué quedó en pausa, el sistema permite elegir qué mantener, hay simulación de downgrade y una primera experiencia visual de recuperación.

Esto es importante para freemium/trials porque evita castigar al usuario cuando baja de plan.

---

# **11\. Nivel real de programación actual**

Yo lo explicaría así:

## **Nivel actual: SaaS funcional en consolidación avanzada**

No estamos en prototipo visual únicamente. Ya existe:

API real  
D1 real  
R2 conectado  
Auth real  
Sesiones  
Panel protegido  
Perfil público por slug  
Entitlements  
Módulos  
Trials  
Overrides  
Super Admin base  
Billing foundation  
Leads  
SEO/GEO  
Open Graph  
Plantillas comerciales  
Hardening de seguridad

Pero todavía no está completamente cerrado como producto self-service para usuarios no técnicos.

## **Lo que falta para decir “SaaS listo para vender masivamente”**

Onboarding express integrado  
Panel tenant más simple y móvil-first  
4 plantillas base dinámicas y realistas  
Convertir plantillas fallback en editables  
Pulir UI de Super Admin  
Billing manual/checkout más operativo  
QA E2E por flujo completo  
Documentación técnica viva  
Eliminar inconsistencias API/template  
Automatizar smoke tests  
---

# **12\. Mejoras propuestas actualmente**

## **12.1 Onboarding Express dentro del SaaS**

No debe ser una app aparte. Debe vivir dentro de `app.intaprd.com`.

Flujo:

Registro/login  
↓  
Detectar si tiene perfil  
↓  
Si no tiene perfil completo → asistente de creación rápida  
↓  
4 pasos  
↓  
Perfil público creado en D1  
↓  
Panel amigable

Los 4 pasos propuestos:

1\. Tipo de perfil / rubro  
2\. Identidad básica  
3\. Contacto y redes  
4\. Primera oferta \+ plantilla

## **12.2 Panel tenant mobile-first**

Debe dejar de sentirse como panel técnico/escritorio. Debe tener una pantalla tipo:

Tu perfil está publicado  
\[Ver perfil\] \[Compartir\]

Completa tu perfil  
Progreso 70%

Editar rápido:  
\- Información principal  
\- Contacto y redes  
\- Oferta principal  
\- Productos / servicios  
\- Estilo visual  
\- Mejorar mi perfil

## **12.3 Cuatro plantillas base dinámicas**

Para usuarios nuevos:

personal  
services  
store  
food

Pero no como botones tipo Linktree. Deben ser mini-landings visuales con bloques destacados:

Hero  
Oferta destacada  
Servicios/productos/platos destacados  
Galería simple  
Confianza  
CTA WhatsApp

## **12.4 Mantener plantillas hardcodeadas temporalmente**

No conviene romper `/jason`, `/novi`, `/rentaord`, `/1aeventos` ahora. Deben seguir funcionando hasta convertirlas a plantillas editables.

La estrategia correcta:

Perfiles especiales actuales → se mantienen  
Nuevos usuarios SaaS → usan plantillas dinámicas base  
Luego migrar especiales a D1/template\_data  
---

# **13\. Cómo explicarle el proyecto a un nuevo programador**

Yo se lo diría así:

Vas a entrar a un SaaS llamado INTAP LINK. Es una plataforma de perfiles públicos por slug, construida sobre Cloudflare. El frontend público vive en `web/`, el panel en `app/`, la API en `api/` y el middleware edge en `functions/`. La base de datos es D1 y los assets van en R2. El producto permite crear mini-landings móviles para empresas/personas, con contacto, WhatsApp, productos, servicios, galería, leads, SEO, Open Graph y módulos por plan.

Luego le aclararía:

Hay dos tipos de perfiles: dinámicos desde API/D1 y fallback hardcodeados en React. No debes romper los fallback actuales; el camino es convertirlos gradualmente a plantillas SaaS editables con `template_id` y `template_data`.

Después le marcaría las reglas técnicas:

1\. No confiar en profileId enviado por frontend.  
2\. Resolver ownership desde sesión.  
3\. Todo endpoint mutable /me/\* debe validar usuario y perfil.  
4\. Entitlements se calculan en backend.  
5\. No hacer hotfix manual sin migración versionada.  
6\. Antes de tocar, revisar schema real en D1.  
7\. Antes de deploy, build verde.  
8\. Trabajar por lotes pequeños.  
9\. Hacer backup antes de cambios importantes.  
10\. Validar con curl, navegador y logs.  
---

# **14\. Archivos que debe conocer primero**

## **Backend**

api/src/index.ts  
api/src/engine/entitlements.ts  
api/src/lib/profile-ownership.ts  
api/migrations/\*  
api/wrangler.toml

## **Frontend público**

web/src/components/PublicProfile.tsx  
web/src/components/profile-templates/\*  
web/src/lib/profileSeo.ts  
web/src/lib/profileFallbackSeo.ts  
web/src/components/marketing/MarketingLanding.tsx

## **Panel app**

app/src/App.tsx  
app/src/components/admin/\*  
app/src/lib/api.ts

## **Edge / middleware**

functions/\_middleware.ts  
---

# **15\. Riesgos principales que debe conocer**

## **Riesgo 1: Drift entre repo y D1 producción**

Ya pasó varias veces: migraciones que parecían aplicadas, columnas que existían en código pero no en D1, o migraciones registradas distinto al schema real.

Regla:

Antes de asumir, revisar D1 remoto con PRAGMA / sqlite\_master.

## **Riesgo 2: Deploy viejo / bundle viejo**

También pasó que el código estaba bien, pero Pages seguía sirviendo un bundle anterior.

Regla:

npm run build  
wrangler pages deploy web/dist \--project-name intap-link  
validar URL final real, no solo preview

## **Riesgo 3: Slugs públicos dentro de app**

`app.intaprd.com/{slug}` causó pantalla negra porque la app lo interpretaba como ruta interna. Ya se corrigió con redirección a dominio público.

## **Riesgo 4: Plantillas hardcodeadas vs API**

Los perfiles fallback pueden no reflejar cambios de D1. No mezclar su lógica sin una estrategia de migración.

## **Riesgo 5: CSS acumulado**

Varias plantillas recibieron muchos overrides. Hay que consolidar CSS por secciones antes de escalar.

---

# **16\. Fase exacta en la que estamos**

Mi lectura actualizada es:

Fase 1: Perfil público core — cerrado  
Fase 2: Conversión avanzada — cerrado parcialmente y aplicado en perfiles  
Fase 3: Captura/leads — funcional, Turnstile frontend pendiente  
Fase 4: Plantillas verticales — en desarrollo con perfiles hardcodeados/fallback  
Fase 5: Enforcement SaaS — base cerrada  
Fase 6: Backend usuario/layout persistente — base funcional, falta UX amigable  
Fase 7: Super Admin — backend y primera UI activos, falta pulido operativo  
Billing — foundation/read-only activo, faltan mutaciones/pago final  
SEO/GEO — primera capa funcionando  
Onboarding express — pendiente prioritario

En términos humanos:

Estamos en una etapa de **producto funcional en producción**, pero todavía en transición entre “perfiles hechos a mano” y “SaaS self-service para usuarios no técnicos”.

---

# **17\. Prioridad recomendada para el próximo programador**

El próximo programador no debería empezar inventando módulos nuevos. Debe enfocarse en cerrar el flujo de usuario nuevo:

1\. Login/registro estable  
2\. Onboarding Express mobile-first  
3\. Crear perfil real en D1  
4\. Asignar plantilla base dinámica  
5\. Panel tenant simple  
6\. Publicación inmediata en intaprd.com/{slug}  
7\. Guía interna “mejora tu perfil”  
8\. Mantener perfiles hardcodeados intactos

Después:

9\. Convertir plantillas fallback a template\_data  
10\. Pulir Super Admin  
11\. Completar billing operativo  
12\. Agregar métricas y módulos premium  
13\. Reforzar SEO/GEO/IA  
---

# **18\. Conclusión ejecutiva**

INTAP LINK ya tiene una base SaaS seria:

Cloudflare stack  
Perfiles públicos  
Panel usuario  
Auth  
D1/R2  
Entitlements  
Super Admin  
Billing foundation  
Leads  
SEO/GEO  
Plantillas comerciales  
Hardening

Lo que falta no es “empezar de cero”. Lo que falta es **ordenar la experiencia de producto**, especialmente para que un usuario no técnico pueda registrarse, crear su perfil en 4 pasos, editarlo desde móvil y publicarlo sin depender de nosotros.

La frase más importante para un nuevo programador sería:

No rompas lo existente. El proyecto ya tiene mucha base real. El trabajo ahora es convertir esa base en una experiencia SaaS simple, estable, editable y mobile-first.

## **Estado local**

El proyecto local está en:

/Users/juanluis/Desktop/intap-link

Está conectado correctamente al repo remoto:

origin → https://github.com/pgcsoluciones/intap-link.git

La rama actual local es:

backup/estado-actual-intap-link

El árbol de trabajo quedó limpio:

git status \--short  
→ sin cambios pendientes

Último commit local:

ea08d67 backup: guardar estado actual antes de limpieza intap link

## **Estado en línea / GitHub**

El repo remoto existe y está accesible:

pgcsoluciones/intap-link

La rama de respaldo fue subida correctamente a GitHub:

origin/backup/estado-actual-intap-link

El commit de respaldo también está en línea:

ea08d67

Dentro de esa rama remota quedó guardado el estado completo previo a limpieza, incluyendo modificaciones y archivos nuevos relacionados con:

1A Eventos  
Rentao RD  
SEO/GEO  
migración 0027  
app/admin  
API  
middleware  
assets  
scripts  
plantillas nuevas

## **Punto importante**

`main` no fue actualizado con ese backup.  
 Los cambios quedaron protegidos en una rama separada para no contaminar producción.

## **Próximo paso recomendado**

Volver a `main`, actualizarlo y crear una rama limpia para el siguiente bloque:

git checkout main  
git pull origin main  
git checkout \-b feature/onboarding-express-mobile-v1  
