# intap-link — Guía para Claude Code

## Estructura del repositorio

```
/workspaces/intap-link/
├── app/   → Panel / aplicación autenticada (SPA React/Vite)
├── web/   → Web pública, perfiles y demos (SPA React/Vite + Pages Functions)
└── api/   → Worker de Cloudflare (backend/API)
```

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
