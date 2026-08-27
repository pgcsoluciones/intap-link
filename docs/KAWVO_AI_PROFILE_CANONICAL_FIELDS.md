# Kawvo Link — Campos canónicos y límites para el Asistente IA

Estado: contrato de producto para Preview/QA del Asistente IA.

## Estructura canónica del Perfil Digital

1. Nombre y título/puesto.
2. Sobre mí / Sobre nosotros.
3. Mis trabajos / Portafolio.
4. Mis servicios.
5. Enlaces.
6. Cuentas bancarias.

## Límites verificados contra el editor actual

### Identidad
- Nombre o marca: máximo 80 caracteres.
- Título / puesto / cargo: máximo 80 caracteres.
- Sobre mí / Sobre nosotros (bio): máximo 300 caracteres.

### Mis trabajos / Portafolio
- Máximo 5 imágenes en Plan Gratis.
- Título de cada trabajo: máximo 80 caracteres.
- Descripción de cada trabajo: máximo 90 caracteres (presentación breve, hasta 2 líneas en el editor).
- La IA nunca elimina, reemplaza ni reordena imágenes automáticamente.

### Mis servicios
- Máximo 3 servicios en Plan Gratis.
- Título de servicio: máximo 60 caracteres.
- Descripción por servicio: máximo 90 caracteres.
- Título visible de la sección: máximo 60 caracteres.
- Descripción general de la sección: máximo 240 caracteres.
- La IA nunca elimina servicios automáticamente; las actualizaciones de texto existentes requieren revisión/confirmación explícita.

### Enlaces
- El Asistente puede usar como contexto la existencia/tipo de enlaces o canales configurados.
- No inventa URLs, no cambia destinos, no elimina ni reordena enlaces.
- En Plan Gratis se mantiene el límite de producto de hasta 3 enlaces/acciones rápidas según la UI vigente.

### Cuentas bancarias
- Fuera de generación y modificación por IA.
- No se envían números de cuenta, identificación, titulares ni datos financieros al proveedor de IA.
- La IA no crea, modifica, elimina ni reordena cuentas bancarias.

## Alcance de edición

Cuando ya exista contenido en el perfil, el usuario debe elegir antes de generar:

### `missing_only` — Completar solo lo que falta (recomendado)
- Los campos ya completados se conservan.
- El contenido existente puede usarse como contexto, pero no sobrescribirse.
- El backend debe hacer cumplir esta regla; no basta con deshabilitar controles en React.

### `full_profile` — Revisar y mejorar mi contenido
- La IA puede proponer mejoras sobre los textos existentes de identidad, bio, trabajos y servicios.
- El usuario revisa y decide por bloque qué aplicar.
- No concede control sobre imágenes, diseño, plantilla, colores, orden, enlaces, canales ni datos bancarios.

## Regla de aplicación

Generar nunca modifica el perfil. Aplicar es una acción separada, explícita y selectiva. Publicar sigue siendo independiente.

## Regla de límites

Los límites deben validarse en backend y reflejarse en Structured Output, UI y prompt. El prompt no es la autoridad final; el servidor recorta/rechaza cualquier valor que exceda el contrato real del producto.
