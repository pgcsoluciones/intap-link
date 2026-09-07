# intap-link — Guía para Claude Code

## Estructura del repositorio

```
/workspaces/intap-link/
├── app/   → Panel / aplicación autenticada (SPA React/Vite)
├── web/   → Web pública, perfiles y demos (SPA React/Vite + Pages Functions)
└── api/   → Worker de Cloudflare (backend/API)
```

## Contrato operativo obligatorio con el asistente

Cuando el asistente tenga acceso de lectura/escritura al repositorio, el método aprobado es:

- el asistente inspecciona rama, HEAD, diffs y archivos;
- el asistente realiza directamente las modificaciones de código en el repo;
- el asistente crea commits trazables y prepara los cambios;
- **no se debe pedir al usuario que edite archivos por terminal si el asistente puede hacer el cambio directamente**;
- el usuario recibe comandos solo para sincronizar su copia local, ejecutar deploy/build con sus credenciales, o realizar QA que dependa de su Mac/dispositivo;
- cuando el usuario deba ejecutar comandos, deben entregarse en un único bloque listo para copiar y pegar;
- no se deben delegar al usuario verificaciones Git rutinarias que el asistente pueda resolver con acceso al repositorio;
- Preview primero y Producción solo con autorización explícita;
- trabajar por lotes pequeños y no tocar D1, Worker, OAuth, migraciones o Producción si el lote actual no lo requiere;
- si un cambio es UI-only, el runner debe ser UI-only;
- si por una limitación real el asistente no puede escribir en el repo, debe declararlo antes de pedir una edición manual.

Regla resumida:

> **Asistente = analiza, modifica, versiona y prepara. Usuario = sincroniza local, despliega cuando sus credenciales sean necesarias y hace QA/aprobación.**

Este contrato prevalece como rutina de trabajo del proyecto y debe mantenerse en futuras sesiones.

## Fuente de verdad de despliegue

La propiedad de cada frontend se determina por los dominios activos de Cloudflare y por el contrato de Producción del repositorio.

| Carpeta | Proyecto Cloudflare Pages | Dominio producción |
|---------|---------------------------|--------------------|
| `web/`  | `intap-link`              | `intaprd.com`      |
| `app/`  | `intap-web2`              | `app.intaprd.com`  |

La API no es Pages:

| Carpeta | Worker | Dominio / rutas |
|---------|--------|------------------|
| `api/` | `intap-api` | `api.intaprd.com`, `intaprd.com/api/*`, `app.intaprd.com/api/*` |
| `api/` Preview | `intap-api-preview` | `api-preview.intaprd.com` y rutas de Preview |

**Regla obligatoria:** nunca desplegar `web/dist` en `intap-web2` ni `app/dist` en `intap-link`.

## Comandos canónicos de deploy

### Web pública (`web/`) → `intap-link`
```bash
cd /workspaces/intap-link/web
npm run build
npx wrangler pages deploy dist --project-name=intap-link --branch=main
```

### Panel / aplicación (`app/`) → `intap-web2`
```bash
cd /workspaces/intap-link/app
npm run build
npx wrangler pages deploy dist --project-name=intap-web2 --branch=main
```

### API / Worker (`api/`)
```bash
cd /workspaces/intap-link/api
npm run deploy:production
```

## Preview

`preview.intaprd.com` y `app.preview.intaprd.com` pasan por `intap-api-preview`.
El Worker Preview usa dos orígenes independientes:

- `WEB_PAGES_ORIGIN` debe apuntar a un deployment Preview de `web/dist` en el proyecto `intap-link`.
- `APP_PAGES_ORIGIN` debe apuntar a un deployment Preview de `app/dist` en el proyecto `intap-web2`.

El hecho de que el Worker pueda hacer proxy a cualquier `*.pages.dev` no cambia la propiedad canónica de cada frontend.

## Gates mínimos de Producción

Un HTTP 200 no basta para aprobar una SPA. Todo release debe comprobar:

1. build local aprobado;
2. deployment en el proyecto Pages correcto;
3. bundle/hash remoto igual al bundle local recién construido;
4. ruta funcional en el dominio custom;
5. QA E2E correspondiente.

## Notas importantes

- No mover dominios entre proyectos como mecanismo de release.
- No duplicar el mismo frontend como Producción en ambos proyectos Pages.
- No usar un Worker proxy en Producción para compensar un proyecto Pages equivocado.
- `CONTRACT_PRODUCTION_PROFILES.md` conserva autoridad sobre `intaprd.com` y los perfiles públicos.
