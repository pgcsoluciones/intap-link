# intap-link — Guía para Claude Code

## Estructura del repositorio

```
/workspaces/intap-link/
├── app/   → Panel admin (SPA React/Vite)
├── web/   → Perfil público (SPA React/Vite)
└── api/   → Worker de Cloudflare (backend)
```

## Proyectos en Cloudflare Pages

| Carpeta | Proyecto Cloudflare | Dominio producción |
|---------|--------------------|--------------------|
| `app/`  | `intap-link`       | app.intaprd.com    |
| `web/`  | `intap-web2`       | intaprd.com        |

## Comandos de deploy

### Panel admin (`app/`)
```bash
cd /workspaces/intap-link/app
npx wrangler pages deploy dist --project-name=intap-link
```
> El build genera `dist/` automáticamente antes del deploy.

### Perfil público (`web/`)
```bash
cd /workspaces/intap-link/web
npm run build
npx wrangler pages deploy dist --project-name=intap-web2
```
> Requiere `npm run build` explícito antes del deploy.

### API / Worker (`api/`)
```bash
cd /workspaces/intap-link/api
npx wrangler deploy
```

## Notas importantes

- Wrangler está autenticado en el entorno del Codespace — no se necesita login manual.
- Agregar `--commit-dirty=true` para silenciar el warning de git si hay cambios sin commitear.
- Los deploys van directamente a producción (no hay staging separado configurado actualmente).
