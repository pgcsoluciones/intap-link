# KAWVO LINK · /adonisg · BITÁCORA DE IMPLEMENTACIÓN Y HANDOFF PREVIEW

**Fecha de corte:** 2026-09-04  
**Repositorio:** `pgcsoluciones/intap-link`  
**Rama:** `feature/kawvo-profile-adonisg-v1`  
**PR:** `#99`  
**Template:** `personal_brand_adonisg_v1`  
**Slug:** `/adonisg`

## 1. Método de trabajo aplicado

Se conserva el formato operativo definido por las bitácoras maestras de Kawvo Link:

1. Investigar estado real antes de modificar.
2. Trabajar desde GitHub/repo y no trasladar al propietario tareas Git rutinarias.
3. Cambios pequeños y auditables.
4. Build antes de deploy.
5. Preview antes de Producción.
6. QA automático antes de QA humano/móvil.
7. Producción congelada hasta autorización explícita.
8. Cuando haga falta el entorno local/Cloudflare del propietario, entregar **un único bloque listo para pegar**.
9. Registrar evidencia y detener el cierre si un smoke falla.

## 2. Arquitectura

- Perfil especial dinámico por `template_id` + registry.
- No existe fallback `if slug === adonisg`.
- `template_id`: `personal_brand_adonisg_v1`.
- `template_data` controla idioma, feed Instagram, medios y colaboraciones.
- Instancia QA se crea únicamente en `intap_db_preview` mediante lote idempotente `0044_seed_adonisg_special_profile.sql`.

## 3. UX / dirección artística

Construido mobile-first con lenguaje editorial de marca personal:

- Hero inmersivo.
- Manifiesto con reveal suave.
- Portafolio curado por proyectos.
- Galerías de detalle bajo demanda.
- `Me has visto en` separado semánticamente de `He trabajado con`.
- IMAGE / BRAND / CREATIVE.
- Certificaciones IBA en modal.
- Bloque `Al Estilo de Argenis` con identidad original.
- `Argenis Now` preparado para feed dinámico de Instagram.
- `Behind the Style`.
- Statement inmersivo final.
- Formulario modal de asesoría adaptado al oficio.
- ES / EN.

## 4. Identidad y problema histórico del azul

Todo el CSS queda encapsulado en `.adonis-profile`.

Se neutralizan estados globales de enlaces/botones dentro de la plantilla y los CTA declaran sus colores de forma explícita. Esto previene la regresión histórica donde reglas globales de Kawvo/INTAP heredaban azul en `hover`, `active` o `visited`.

Los logos de `Al Estilo de Argenis` se copian desde los PNG originales recibidos. **No se redibujan, recolorean, recortan ni reinterpretan.**

## 5. Recursos

Los ZIP fuente se mantienen fuera del bundle de Git. El runner local:

- localiza los ZIP en la ruta real del backup suministrada por el propietario, además de `Downloads`, `Desktop`, `assets-source` o el root del proyecto;
- extrae temporalmente;
- elimina duplicación visual mediante curaduría predefinida;
- genera WebP de tamaño móvil/web;
- genera OG 1200×630;
- copia los logos originales sin transformación;
- detecta `videos.zip` como fuente, pero no incorpora los videos pesados al bundle inicial;
- elimina los assets temporales del worktree al terminar el deploy.

Ruta real registrada para los recursos:

`/Volumes/backup JL/11977/!Recuperados 2024/recuperados/diseños/argenis grullon`

Script: `scripts/prepare-adonisg-assets.py`.

Esto evita subir originales pesados al repositorio y mantiene el primer render liviano.

## 6. Portfolio

Colecciones definidas:

1. Beauty & Fragrance.
2. Red Statement.
3. Noir.
4. Couple Lifestyle.
5. Evening Statement.
6. Mens Brand.

Cada colección tiene portada; el preparador genera además una selección limitada de imágenes internas para evitar galería infinita o carga masiva.

## 7. Autoridad y evidencia

### Me has visto en

Incluye únicamente piezas que pueden identificarse desde los recursos recibidos, empezando por:

- DLB Noticias / DMH Magazine — `Lo Que No Te Cuentan del Éxito`.
- Gran Bazar de Emprendedores — participación sobre imagen en redes sociales.

### He trabajado con

La instancia Preview incorpora solamente colaboraciones públicas verificadas, sin convertir menciones sociales ambiguas en clientes:

- Raquel Moreta.
- Lily Payamps.
- Lilibeth Durán.
- Todo Abrigos.
- Black Photos.
- Jeisly Blossom.

## 8. SEO / GEO / LLM

El template tiene metadata cliente ES/EN y el deploy debe incluir **Pages Functions desde la raíz del repo** para conservar el discovery server-side.

El runner exige HTTP 200 y presencia válida de:

- `/adonisg`.
- `/adonisg?lang=en`.
- `/adonisg/ai.md`.
- `/adonisg/facts.json`.
- `/robots.txt`.
- `/sitemap.xml`.
- `/llms.txt`.
- canonical.
- Open Graph.
- Twitter Card.
- JSON-LD.

La semántica dinámica identifica a Argenis como `Person` porque `template_data.role` queda definido en D1 Preview.

## 9. Instagram

La UI está preparada para consumir `template_data.instagram_feed_endpoint`.

Contrato esperado:

```json
{
  "items": [
    {
      "id": "...",
      "media_url": "...",
      "thumbnail_url": "...",
      "permalink": "...",
      "caption": "...",
      "media_type": "IMAGE|VIDEO|CAROUSEL_ALBUM"
    }
  ]
}
```

La conexión real con Meta requiere credenciales/permisos de la cuenta y no se inventa ni se expone un token en frontend. Mientras no exista endpoint, la sección presenta estado de conexión pendiente y enlace al Instagram real.

## 10. Formulario

Modal mobile-first con:

- nombre;
- WhatsApp;
- email;
- servicio;
- objetivo;
- fecha/plazo opcional.

El envío está diseñado para utilizar los canales reales configurados en el perfil; no se hardcodean datos de contacto que no hayan sido suministrados.

## 11. Seguridad Preview

El runner `scripts/run-preview-adonisg-v1.sh`:

- comprueba rama y `git diff --check`;
- bloquea `main`;
- inspecciona `wrangler.preview.toml` buscando bindings productivos;
- crea un entorno Python virtual aislado `.venv-adonisg-assets`;
- instala Pillow únicamente dentro de ese venv, evitando modificar Homebrew/Python global;
- prepara assets;
- ejecuta build;
- aplica **solo** el seed idempotente de `/adonisg` a `intap_db_preview`;
- consulta D1 Preview para verificar `template_id`;
- verifica API Preview;
- despliega `web/dist` desde la raíz para incluir `functions/`;
- ejecuta smoke HTTP de perfil, imágenes y discovery;
- valida metadata crawler y recursos IA;
- no ejecuta deploy de Worker productivo ni D1/R2 de Producción.

## 12. Incidente de Preview local y corrección

Primer intento local bloqueado antes de cualquier operación remota por Python Homebrew 3.14 / PEP 668:

- `ModuleNotFoundError: No module named 'PIL'`.
- `pip install --user Pillow` rechazado por `externally-managed-environment`.
- Producción no fue tocada.
- D1 Preview tampoco llegó a modificarse porque el fallo ocurrió en preparación de assets.

Corrección aplicada en repo:

1. Se eliminó la instalación `pip --user` desde el preparador.
2. El runner crea/reutiliza `.venv-adonisg-assets` con `python3 -m venv`.
3. Pillow se instala solo dentro de ese venv.
4. El preparador se ejecuta con el Python del venv.
5. Se añadió como primera ruta de búsqueda la ubicación exacta de los ZIP en el volumen externo.
6. `videos.zip` se localiza y audita como fuente, pero permanece fuera del bundle inicial por rendimiento.

## 13. Estado de cierre de implementación

### Completado en repo

- Template y registry.
- CSS editorial + protección contra azul heredado.
- ES/EN.
- Portfolio y modales.
- Autoridad / medios / colaboraciones.
- Servicios.
- Certificaciones.
- Al Estilo de Argenis.
- Instagram feed contract.
- About / statement / CTA.
- Formulario modal.
- Seed D1 Preview.
- Preparador/optimizador de assets.
- Runner de Preview + smoke + SEO/GEO/LLM.
- Corrección PEP 668 mediante venv aislado.
- Ruta real de ZIPs registrada.
- PR en Draft y Producción intacta.

### Requiere entorno local/Cloudflare del propietario

Una sola ejecución del runner. No corresponde pedir comandos Git, SQL, build y deploy por separado.

### Después del runner

El resultado esperado es una URL inmutable `https://<hash>.intap-link.pages.dev/adonisg` lista para QA humano 390–430 px. Cualquier defecto visual se corrige dentro del mismo PR antes de autorizar Producción.
