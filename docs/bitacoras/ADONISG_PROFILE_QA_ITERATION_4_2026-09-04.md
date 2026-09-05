# /adonisg · QA visual Iteración 4 · 2026-09-04

## Motivo
La Iteración 3 quedó técnicamente correcta pero visualmente demasiado comprimida y dispersa para un perfil profesional de asesoría de imagen. El QA humano detectó: hero con letterboxing/hueco, ancho excesivamente estrecho, tipografía y texto forzados, tarjetas que asomaban dos a la vez, imágenes con marcos/espacios innecesarios y falta de una secuencia editorial clara.

## Corrección aplicada
- Ancho canónico del perfil ampliado de 480 px a 590 px en escritorio, manteniendo 100% en móvil real.
- Hero reconstruido visualmente para que cada imagen cubra completamente la pantalla sin bandas vacías; posiciones de encuadre por slide y degradado inferior para proteger la lectura sin cubrir el rostro.
- Logo superior y selector de idioma reajustados a escala móvil.
- Ritmo editorial con más aire lateral y vertical; titulares reducidos y jerarquía tipográfica más legible.
- Secuencia visual reorganizada mediante orden de secciones: presentación/propósito, quién es, trabajo seleccionado, portafolio completo, testimonios, estilo personal, prensa, colaboraciones, áreas de trabajo, formación, plataforma, videos, actualidad, FAQ y cierre.
- Se ocultan los numerales de sección de la iteración anterior para evitar contradicción con el nuevo orden narrativo.
- Portafolio destacado: una sola pieza por fila, imagen a altura natural, sin doble card ni miniaturas en la página; descripción visible limitada a dos líneas y detalle completo dentro del modal.
- Portafolio completo, prensa, áreas de trabajo, testimonios y videos: carruseles de una sola tarjeta completa por viewport; se elimina el segundo card asomado.
- Galería personal: una única portada editorial abre el modal.
- Imágenes de cards y galerías usan altura natural para evitar huecos artificiales y cortes innecesarios.
- Modal móvil rediseñado como bottom-sheet amplio, con título, descripción, imagen natural, controles laterales, contador, miniaturas y CTA.
- Videos conservan Play central y una sola reproducción simultánea.
- Cierre cowboy conserva degradado a negro y franja de marca después del contacto.
- WhatsApp de CTA permanece `18293024095`.

## Seguridad
- Rama: `feature/kawvo-profile-adonisg-v1`.
- Producción congelada.
- El próximo despliegue debe hacerse únicamente mediante `scripts/run-preview-adonisg-v1.sh` contra D1/API/Pages Preview.
