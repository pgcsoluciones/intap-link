# BITÁCORA TÉCNICA — INTAP LINK / 1A Eventos

## Preloader aprobado basado en NOVI producción

Fecha: 2026-05-28  
Perfil: /1aeventos  
URL canónica: https://intaprd.com/1aeventos  
Archivo principal: web/src/components/profile-templates/IntapProfile1AEventos.tsx  
Archivo CSS relacionado: web/src/components/profile-templates/IntapProfile1AEventos.css  
Estado: aprobado visualmente en local por Juan Luis.

## Problema

El preloader de 1A Eventos entró en loop de correcciones porque el logo se veía cortado, con movimiento poco fluido o pantalla blanca.

## Soluciones descartadas

No repetir para futuros perfiles:

- Preloader creado por DOM con document.createElement.
- onea-rentao-style-intro.
- onea-jprez-welcome-screen.
- logo.decode() como solución principal.
- background-image para el logo.
- fallback textual.
- múltiples preloaders activos al mismo tiempo.
- CSS externo acumulado sin limpiar.

## Solución aprobada

Se copió el patrón real de NOVI en producción.

NOVI usa:

- showNoviIntro.
- setTimeout de 3300ms.
- overlay dentro del main.
- style embebido dentro del JSX.
- noviBootOverlay4B.
- noviBootLogoWrap4B.
- noviBootLogo4B.
- noviBootZoom4B.
- noviBootFade4B.

En 1A Eventos se adaptó como:

- showOneABootIntro.
- setShowOneABootIntro.
- oneABootIntroTimer.
- oneaBootOverlay4BExact.
- oneaBootLogoWrap4BExact.
- oneaBootLogo4BExact.
- oneaBootZoom4BExact.
- oneaBootFade4BExact.

## Regla para futuros perfiles

Para futuros preloaders premium usar el patrón NOVI 4B:

1. Un solo estado React.
2. Un solo timer de 3300ms.
3. Overlay renderizado dentro del main.
4. Style embebido dentro del overlay.
5. Logo como img, no background-image.
6. No crear el preloader por DOM.
7. No mezclar varios preloaders.
8. Desactivar o eliminar preloaders anteriores antes de validar.

## Archivos modificados

- web/src/components/profile-templates/IntapProfile1AEventos.tsx
- web/src/components/profile-templates/IntapProfile1AEventos.css

## Pendiente no relacionado al preloader

Durante build todavía aparecen warnings por rutas de assets:

- /assets/landing/1aeventos/hero-1aeventos.jpg
- /assets/landing/1aeventos/map-preview.jpg

Esto no afecta el preloader aprobado, pero debe revisarse luego.
