# KAW-G8-P0 — Corrigir la vía de publicación (NO-GO a stage)

Corte: 23 noviembre 2026. Rama operativa separada de main. **Este documento no autoriza ni ejecuta otro upload.**

## Evidencia histórica vs G8

- Método anterior documentado en las bitácoras de septiembre/octubre: `wrangler deploy --config wrangler.preview.toml` para Worker Preview y operaciones equivalentes de Wrangler para Producción. El repositorio conserva `api/package.json` -> `deploy:production: wrangler deploy --config wrangler.toml`.
- `api/wrangler.toml` mantiene `intap-api`, entrada `src/preview-free-entry.ts`, rutas de producción, `DB`, `AGENTS_DB`, `BUCKET`, variables y crons.
- G8 cambió a un POST personalizado de JSON en `/accounts/{account_id}/workers/workers/intap-api/versions?deploy=false`, alimentado por un bundle esbuild explícito e inherit de bindings fijado a G8.6.
- Ese POST devolvió HTTP 400 / código 10021; el ejecutor descartó el mensaje legible. Última versión declarada inalterada. No se acreditó que la causa fuera la compilación, la herencia o el Worker.
- GitHub CI `45263752169`: workerd local PASS con bundle de Linux distinto al Mac. Mac reprodujo el hash del bundle de subida fallida exactamente. Esa diferencia NO prueba causa del 10021.
- En el workflow original de G8 ya se había previsto la vía **nativa** `wrangler versions upload --strict --keep-vars --config api/wrangler.toml`, pero el token de GitHub Actions devolvió GET deployments 403 antes de ejecutarla. **La vía Wrangler nativa nunca fue probada como alternativa remota en ese job.**

## Diferencias técnicas que importan

1. `wrangler deploy` crea y activa tráfico. **NO emplearlo para un stage aislado**.
2. `wrangler versions upload` crea versión sin activación; tiene compatibilidad oficial con el mecanismo de empaquetado de Wrangler.
3. La herencia de bindings del endpoint tradicional de scripts/versions se relaciona con la **versión más reciente**, no necesariamente con la versión activa G8.6. No asumir que ambas son equivalentes (G8.6 activo: `3d4973e4-e344-493a-a065-93f199b00359`; última vista tras los 400: `1972228c-4dd7-4ede-9d94-8338132b3b20`).
4. `--keep-vars` y `--strict` no sustituyen lectura y comparación de secretos, bindings D1/R2, rutas, cron y configuraciones de baseline/última. Ni igualdad de nombres/tipos acredita los valores secretos.
5. El error 10021 es validación genérica; sin mensaje legible no hay diagnóstico de causa raíz.

Fuentes oficiales: 
- https://developers.cloudflare.com/workers/versions-and-deployments/
- https://developers.cloudflare.com/workers/wrangler/commands/workers/
- https://developers.cloudflare.com/api/resources/workers/subresources/beta/subresources/workers/subresources/versions/methods/create/
- https://developers.cloudflare.com/workers/observability/errors/

## Corrección propuesta en este PR

- Crear **solo** un precheck de lectura `scripts/inspect-kawvo-g8-native-upload-readonly.mjs`: comprueba SHA local G8, lockfile, versión activa, última versión subida y comparación no secreta de nombres/tipos de bindings. Exige conservar G8.6 a 100%; una discrepancia bloquea el avance.
- La herramienta NO ejecuta un POST ni `wrangler deploy` ni `wrangler versions upload`.
- **No editar el código de G8, D1/R2, main, token o Cloudflare.**
- Dejar los dos recibos HTTP 400 preservados y prohibir repetir los runners anteriores.

## Gates restantes ANTES de preparar un nuevo stage

1. Ejecutar el precheck desde la Mac autorizada y guardar el resultado privado sin exponer valores.
2. Inspeccionar una vía nativa de `wrangler versions upload --dry-run --strict --keep-vars` en un entorno temporal y sin cambiar configuraciones, usando el módulo original exacto. Determinar cómo Wrangler resuelve los bindings y las opciones de Worker; verificar que el bundle resultante sea equivalente funcionalmente al aprobado, aunque el hash varíe por empaquetado.
3. Acreditar equivalencia efectiva de secretos/bindings del **último upload** frente a G8.6, incluyendo los parámetros no versionados. Si no se puede, **NO-GO** y diseñar retención explícita sin exponer secretos.
4. Revisar permisos mínimos de la sesión Cloudflare de la Mac para la operación necesaria; no alterar tokens o secretos por tanteo.
5. Solo luego preparar un **nuevo runner de stage nativo**, con autorización explícita por SHA, prechecks, un único upload, recibo previo, verificación de nueva versión inactiva y guardas de activación. No activar ni publicar App/Web en esta fase.

**Criterio de salida:** el procedimiento no es un cambio funcional de Kawvo: es una corrección de la herramienta operativa para pasar el contrato aprobado de Preview a Producción de forma controlada.
