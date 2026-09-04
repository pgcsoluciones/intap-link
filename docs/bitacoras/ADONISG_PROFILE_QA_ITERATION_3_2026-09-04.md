# KAWVO LINK · /adonisg · QA ITERACIÓN 3 · 2026-09-04

## Objetivo
Reorientar el perfil Plus especial de Argenis Grullón para que el protagonista sea su trabajo, no una sucesión de fotografías personales. Mantener una experiencia 100% mobile-first, editorial, bilingüe y optimizada para Preview.

## Cambios de esta iteración
- Franja móvil canónica limitada a 480 px incluso en escritorio, replicando el patrón visual de perfiles Plus especiales.
- Hero convertido en slider automático de 5 imágenes seleccionadas por el usuario, sin slider secundario debajo.
- Las imágenes del hero se preservan completas mediante `object-fit: contain` y degradado de lectura, evitando cortes agresivos.
- Logo superior izquierdo sustituido por la pieza negra de `Al Estilo de Argenis`, con presencia discreta.
- Selector de idioma con globo + English/Español; interfaz separada completamente por idioma.
- Sección principal renombrada a `Portafolio` / `Portfolio` y convertida a una sola card por fila, sin dobles columnas ni tiras estáticas de miniaturas.
- Cada proyecto destacado incorpora portada, categoría, título, descripción/contexto y CTA `Ver proyecto`.
- Modal de proyecto con imagen principal, controles anterior/siguiente, miniaturas deslizables, contador y CTA `Trabaja conmigo`.
- CTA contextual de cada proyecto abre WhatsApp con referencia al título del trabajo visualizado.
- Nuevo `Portafolio completo` en carrusel horizontal móvil, clasificado por proyecto.
- Galería personal de Argenis reducida a un solo destacado que abre modal deslizante con 6 imágenes y CTA.
- `Me has visto en` conserva al visitante dentro del perfil: las apariciones abren un modal interno y no navegan a sitios externos.
- `Áreas de trabajo` rediseñada como tarjetas horizontales modernas, una por viewport móvil.
- Testimonios rediseñados como carrusel tipográfico móvil. Dos testimonios son explícitamente de muestra/temporales para definir el lenguaje visual y serán sustituidos por testimonios reales.
- Videos presentados en carrusel horizontal con botón Play centrado y destacado; al reproducir un video se pausa cualquier otro activo.
- Videos e imágenes usan `object-fit: contain` donde el corte pudiera afectar al sujeto.
- FAQ consolidado a 6 preguntas prioritarias: concepto de asesoría, contenido del servicio, personal shopping, duración, hombres/mujeres y modalidad presencial/virtual.
- Frase final usa la imagen cowboy close-up seleccionada por el usuario, fundida sobre negro mediante degradados semitransparentes.
- Después de Contacto se incorpora el banner horizontal original `Linkedin Banner.jpg` de la identidad gráfica.
- WhatsApp oficial para todos los CTAs de contacto y proyecto: `18293024095`.
- CSS histórico de Adonis queda delegado al stylesheet mobile canónico para evitar conflictos de breakpoints desktop y la regresión del azul heredado.

## Assets generados desde los ZIP locales
El preparador `scripts/prepare-adonisg-assets.py` genera en cada Preview:
- `hero/slide-01.webp` a `hero/slide-05.webp`
- `hero/quote-bg.webp`
- `portraits/argenis-01.webp` a `argenis-06.webp`
- portafolio clasificado por proyecto
- medios
- certificaciones
- videos
- `brand/linkedin-banner.jpg`
- `brand/top-logo.jpg` original + variante web optimizada

Los ZIP fuente no se versionan.

## Aislamiento
- Rama: `feature/kawvo-profile-adonisg-v1`
- PR: #99 Draft
- D1 permitido: `intap_db_preview`
- API permitida: `intap-api-preview`
- Pages: proyecto público `intap-link`, deployment Preview por rama
- Producción permanece congelada.

## Siguiente validación
Ejecutar únicamente `scripts/run-preview-adonisg-v1.sh` desde el entorno local autorizado. El runner prepara assets, ejecuta build Preview, aplica el seed idempotente a D1 Preview, despliega Pages y valida perfil/assets/discovery antes del QA humano móvil.
