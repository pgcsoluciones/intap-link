# KAWVO LINK · /adonisg · QA ITERACIÓN 2

**Fecha:** 2026-09-04  
**Rama:** `feature/kawvo-profile-adonisg-v1`  
**PR:** #99  
**Producción:** congelada

## Objetivo

Aplicar el segundo lote visual solicitado para el perfil especial de Argenis Grullón, manteniendo arquitectura dinámica por `template_id`, aislamiento Preview y enfoque 100% móvil.

## Cambios implementados

- Revisión mobile-first con menor aire muerto, tipografía y ritmos más compactos.
- Intro inmersiva con slider automático/táctil de 4 estilos de Argenis.
- Selector de idioma con icono de globo y cambio directo Español/English.
- Copys de interfaz separados por idioma; se eliminan títulos ingleses de la versión española.
- Portafolio: cada proyecto muestra portada + 3 miniaturas relacionadas antes de abrir el detalle.
- Modal de proyecto con 4 imágenes por colección para evitar una sola foto por proyecto.
- Nueva galería editorial propia de Argenis con 6 retratos/estilos.
- `Me has visto en` ampliado con referencias verificables y materiales recibidos: DMH Magazine, Buena Noche/Cachicha, Diario Libre, La Vitrina y El Janis.
- Nueva sección de testimonio basada en la captura real de Instagram de Dr. Hugo María.
- Nueva sección de videos con 3 piezas del ZIP recibido, `preload="none"` para no cargar video en el primer render.
- Nueva sección de preguntas frecuentes ES/EN.
- Conservación exacta de logos de Al Estilo de Argenis.
- Assets adicionales preparados en carpetas `portraits`, `testimonials`, `videos` y nuevos medios.
- Runner actualizado para limpiar y validar los nuevos assets, además de los smokes existentes de SEO/GEO/LLM.

## Rendimiento

- Fotografías web: WebP optimizado.
- Videos: archivos originales bajo demanda, sin precarga en primera visita.
- Galerías y secciones inferiores: `loading="lazy"`.
- Slider utiliza imágenes optimizadas y respeta `prefers-reduced-motion`.
- Feed de Instagram continúa preparado para endpoint server-side/cache; no se expone token Meta.

## QA esperado

Ejecutar únicamente `scripts/run-preview-adonisg-v1.sh`. El runner hace build Preview, seed D1 Preview, deploy Pages, espera propagación y valida perfiles, assets, videos, testimonio y discovery.

La entrega se considera apta para QA humano cuando el runner imprime:

`✓ /adonisg · PREVIEW LISTO PARA QA VISUAL HUMANO`
