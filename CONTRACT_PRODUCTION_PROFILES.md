# CONTRATO DE PRODUCCIÓN — INTAP LINK

Estado: **OBLIGATORIO**

Dominio canónico:

`https://intaprd.com/{slug}`

Proyecto Cloudflare Pages:

`intap-link`

Base D1 productiva:

`intap_db`

Rama productiva:

`main`

## Perfiles protegidos

Todos los perfiles activos y publicados de INTAP LINK quedan protegidos por este contrato.

La protección comprende:

- slug y URL canónica;
- contenido e identidad;
- datos de contacto;
- imágenes y recursos;
- plantillas;
- Graph Card;
- Open Graph;
- Twitter Card;
- SEO técnico;
- GEO;
- JSON-LD;
- API pública;
- robots.txt;
- sitemap.xml;
- llms.txt;
- ai.md;
- facts.json;
- redirecciones históricas.

## Aprobación explícita

No se permite modificar un perfil productivo, su estructura, datos, SEO, GEO, Graph Card, alias o publicación sin autorización explícita.

La autorización debe identificar el commit exacto:

APROBACIÓN EXPLÍCITA DE PRODUCCIÓN: SÍ

COMMIT APROBADO: <SHA EXACTO>

Una autorización anterior queda invalidada cuando cambia el SHA.

## Alias histórico

`https://link.avanxy.com/*`

es un alias histórico protegido.

Debe responder mediante:

`301 Permanent Redirect`

hacia:

`https://intaprd.com/*`

conservando:

- slug;
- ruta;
- query string.

No se permite invertir nuevamente esta redirección.

## Flujo obligatorio

Cambio
→ rama
→ Preview
→ QA
→ GEO/SEO
→ Pull Request
→ aprobación SHA exacto
→ merge a main
→ deploy de main
→ QA productivo.

## Producción

Queda prohibido:

- force push a main;
- borrar main;
- push directo a main;
- desplegar una feature como Producción;
- cambiar D1 Producción sin respaldo;
- eliminar aliases históricos;
- retirar perfiles del sitemap;
- retirar perfiles de llms.txt;
- romper ai.md o facts.json;
- cambiar Graph Cards sin aprobación.

PR #76 permanece fuera de este contrato y de este cierre.
