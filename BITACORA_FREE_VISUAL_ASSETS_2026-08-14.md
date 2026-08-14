# INTAP LINK GRATIS · BANCO VISUAL POR RUBRO

Fecha: 2026-08-14

## Objetivo

Evitar que los nuevos perfiles Free nazcan visualmente vacíos y evitar que
todos los perfiles de una misma categoría utilicen exactamente la misma
imagen de demostración.

El perfil podrá utilizar recursos visuales starter mientras el propietario
todavía no haya cargado sus imágenes reales.

Los recursos starter nunca deben presentarse ni persistirse como contenido
real del negocio.

---

## Categorías oficiales

Los bancos se crearán para las categorías actualmente disponibles en el
onboarding Free:

1. Moda y accesorios
2. Salud y bienestar
3. Belleza y estética
4. Gastronomía
5. Tecnología
6. Educación
7. Arte y diseño
8. Deportes y fitness
9. Turismo y viajes
10. Servicios profesionales
11. Construcción y hogar
12. Automotriz
13. Agropecuario
14. Retail
15. Otros

---

## Banco mínimo

Crear inicialmente entre 2 y 3 imágenes por rubro.

Objetivo inicial:

15 rubros x 3 variantes = hasta 45 assets.

No utilizar una única imagen fija por categoría.

---

## Requisitos visuales

Cada imagen debe ser:

- individual;
- fácilmente identificable por archivo;
- hiperrealista;
- fotográfica;
- comercial;
- moderna;
- creíble;
- sin texto incorporado;
- sin logos falsos;
- sin marcas de agua;
- sin marcas comerciales reconocibles;
- sin composiciones excesivamente saturadas;
- compatible con recorte responsive;
- usable como portada horizontal;
- con espacio negativo cuando sea posible;
- suficientemente diferente de las demás variantes del mismo rubro.

No generar collages.

---

## Variación dentro del mismo rubro

Las tres variantes deberían cubrir, cuando el rubro lo permita:

### Variante A
Ambiente o contexto del negocio.

### Variante B
Producto, herramienta, espacio o servicio principal.

### Variante C
Experiencia humana o interacción profesional.

La intención es mantener coherencia de rubro sin producir perfiles visualmente
idénticos.

---

## Selección estable

La variante no debe elegirse aleatoriamente en cada visita.

La selección debe ser determinista a partir de un dato estable del perfil,
por ejemplo:

- profileId;
- slug;
- hash estable equivalente.

Ejemplo conceptual:

profile A + Construcción -> construcción-02  
profile B + Construcción -> construcción-01  
profile C + Construcción -> construcción-03

El mismo perfil siempre debe recibir la misma imagen starter hasta que el
usuario la sustituya.

---

## Prioridad visual

Para la portada Impacto:

1. Hero real cargado por el propietario.
2. Asset starter correspondiente al rubro.
3. Fondo generado mediante la paleta seleccionada.

Nunca volver a usar automáticamente:

- primera foto del portafolio;
- avatar;
- fotografía aleatoria del perfil;

como hero.

---

## Sustitución

Cuando el usuario cargue un hero real:

- el starter deja de mostrarse;
- no se elimina del banco global;
- no se copia como dato propio del negocio.

El usuario podrá:

- cambiar imagen;
- mover encuadre;
- aplicar zoom;
- restablecer posición.

---

## Estructura de archivos propuesta

web/public/assets/free-starters/

moda/
  starter-moda-01.webp
  starter-moda-02.webp
  starter-moda-03.webp

salud/
belleza/
gastronomia/
tecnologia/
educacion/
arte-diseno/
deportes/
turismo/
servicios-profesionales/
construccion/
automotriz/
agropecuario/
retail/
otros/

---

## Prompt maestro de generación

Generar 3 imágenes individuales y separadas para servir como assets visuales
de un perfil empresarial digital perteneciente al rubro [RUBRO].

Cada imagen debe representar una escena diferente pero coherente con el mismo
sector.

Estilo: fotografía comercial hiperrealista, moderna, profesional, premium
pero accesible; iluminación natural o de estudio suave; composición limpia;
profundidad fotográfica realista; materiales, espacios y personas creíbles.

Requisitos:

- sin texto dentro de la imagen;
- sin logos;
- sin marcas de agua;
- sin marcas comerciales reconocibles;
- sin carteles legibles;
- sin apariencia de ilustración;
- sin apariencia de render 3D;
- evitar exceso de objetos;
- anatomía humana natural cuando aparezcan personas;
- espacio visual respirado;
- composición compatible con recorte responsive;
- sujeto principal preferiblemente desplazado para dejar espacio negativo.

Crear tres enfoques:

1. ambiente/contexto;
2. producto o servicio;
3. experiencia humana/profesional.

Formato recomendado:

- horizontal 16:9;
- alta resolución;
- archivos individuales;
- no collage.

---

## Pendiente de implementación

- Generar los assets físicos.
- Convertirlos/optimizar a WebP cuando corresponda.
- Incorporar `heroAssets[]` en cada starter pack.
- Implementar selección determinista.
- Eliminar referencias históricas:
  `/assets/free-demo/hero-impacto.svg`
  `/assets/free-demo/portrait-maria.svg`
  cuando ya no sean necesarias.
- Comprobar peso y rendimiento móvil.
- Validar los tres layouts Free con los assets.
