# Kawvo Link · /adonisg · Build log

Rama: `feature/kawvo-profile-adonisg-v1`
Template: `personal_brand_adonisg_v1`
Slug: `/adonisg`

## Estado
- Template especial registrado en registry dinámico.
- ES/EN habilitado por `template_data.languages`.
- CSS encapsulado bajo `.adonis-profile` para evitar herencia azul global.
- Hero, manifiesto, portafolio por proyectos, medios, colaboraciones, servicios, certificaciones, Al Estilo de Argenis, Instagram feed, about, statement y modal de contacto construidos.
- Seed exclusivo Preview agregado como `api/migrations-preview/0044_seed_adonisg_special_profile.sql`.
- Assets recibidos y curados: hero/retratos, 6 portadas de portfolio, 2 piezas de medios, identidad gráfica, 5 certificaciones y recursos de video.
- Duplicados detectados en series de portfolio; no se incorporarán al bundle público.

## Reglas
- Producción no se toca durante QA.
- Logos originales de Al Estilo de Argenis no se redibujan ni se alteran.
- El perfil es mobile-first; desktop es adaptación.
- Imágenes de detalle cargan bajo demanda.
- Feed Instagram se consume desde endpoint server-side/cache, sin exponer token al navegador.
- SEO/GEO/LLM debe quedar alineado al sistema dinámico de perfiles especiales antes de promoción.

## QA pendiente
- Aplicar seed 0044 en D1 Preview mediante infraestructura autorizada.
- Publicar assets optimizados en el bundle de la rama.
- QA visual 390–430 px y ES/EN.
- Confirmar medios y clientes/colaboraciones con evidencia antes de mostrar nombres.
