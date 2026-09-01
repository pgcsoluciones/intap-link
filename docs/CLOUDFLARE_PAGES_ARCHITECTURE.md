# Kawvo Link — Arquitectura canónica Cloudflare Pages

Fecha de normalización: 2026-09-01

## Fuente de verdad

La infraestructura activa y el contrato productivo establecen esta separación:

- `web/` → Pages `intap-link` → `intaprd.com`
- `app/` → Pages `intap-web2` → `app.intaprd.com`
- `api/` → Worker `intap-api` → `api.intaprd.com` + rutas `/api/*`
- Preview API/front door → Worker `intap-api-preview`

## Producción

### Web pública

Responsabilidad: landing, perfiles públicos, `/demo`, `/demo/ia`, demos compartidas, SEO/GEO y Pages Functions.

Proyecto Pages: `intap-link`

Dominio canónico: `https://intaprd.com`

Build:

```bash
npm --prefix web run build
npx wrangler pages deploy web/dist --project-name=intap-link --branch=main
```

### App autenticada

Responsabilidad: login, panel, cuenta, onboarding, gestión de perfiles y artefactos.

Proyecto Pages: `intap-web2`

Dominio canónico: `https://app.intaprd.com`

Build:

```bash
npm --prefix app run build
npx wrangler pages deploy app/dist --project-name=intap-web2 --branch=main
```

### API

Worker: `intap-api`

Rutas productivas:

- `api.intaprd.com`
- `intaprd.com/api/*`
- `app.intaprd.com/api/*`

La API no debe utilizarse como proxy general de los frontends en Producción.

## Preview

El Worker `intap-api-preview` funciona como front door para Preview y puede hacer proxy a deployments inmutables Pages.

La correspondencia canónica se conserva también en Preview:

- `WEB_PAGES_ORIGIN` → deployment Preview de `web/dist` en `intap-link`.
- `APP_PAGES_ORIGIN` → deployment Preview de `app/dist` en `intap-web2`.

Esto permite pruebas aisladas sin mover dominios ni mezclar los dos frontends.

## Invariantes

1. `web/dist` nunca se despliega en `intap-web2`.
2. `app/dist` nunca se despliega en `intap-link`.
3. Los dominios no se mueven entre proyectos como parte de un release.
4. Un HTTP 200 de una SPA no constituye QA suficiente.
5. Producción debe validar que el bundle servido por el dominio custom coincide con el bundle recién construido.
6. Preview y Producción deben conservar proyectos separados y orígenes separados.
7. El Worker API solo intercepta rutas API en Producción.

## Causa raíz del incidente Demo IA 2026-09-01

El código de `/demo/ia` fue correcto y el Preview fue aprobado. Sin embargo, los runners de Demo IA desplegaron `web/dist` en `intap-web2`. Esos deployments eran válidos, pero `intaprd.com` pertenece al proyecto `intap-link`, por lo que el dominio continuó sirviendo un bundle anterior sin `/demo/ia`.

Preview no reveló el error porque `intap-api-preview` hacía proxy explícito a `WEB_PAGES_ORIGIN`, que apuntaba al deployment inmutable correcto aunque estuviera en el proyecto equivocado.

## Gate obligatorio de frontend

Para cada frontend:

```text
build local
→ detectar bundle principal local
→ deploy al proyecto propietario
→ verificar deployment inmutable
→ esperar dominio custom
→ comprobar bundle remoto == bundle local
→ smoke/E2E
→ cerrar release
```

Esta comprobación evita aprobar una ruta únicamente porque devuelve HTTP 200 con un `index.html` antiguo.
