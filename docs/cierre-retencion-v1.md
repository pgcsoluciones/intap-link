# Bitácora de Cierre — Retención Inteligente V1

**Fecha de cierre:** 2026-03-13
**Rama:** `claude/smart-retention-logic-Rqx8P`
**Commits:** `7dded54` → `1a7b5ee` → `a3b0a9d`
**Entorno:** Producción (Cloudflare Workers + Pages)

---

## 1. Problema original

Al hacer downgrade de plan (o al vencer un trial), los recursos que exceden los
nuevos límites quedaban visibles en el perfil público aunque el plan ya no los
autorizara. No existía:

- Lógica de "qué mostrar si el usuario tiene más ítems que el plan permite"
- Interfaz para que el usuario elija qué mantener activo
- Aviso visible en el dashboard sobre el estado de su plan

## 2. Solución backend — commit `7dded54`

### Archivos tocados
| Archivo | Tipo | Descripción |
|---|---|---|
| `api/migrations/0025_plan_events_log.sql` | **nuevo** | Tabla `profile_plan_events` para auditoría del ciclo de vida del plan |
| `api/src/engine/entitlements.ts` | **extendido** | +256 líneas sobre los 117 existentes |
| `api/src/index.ts` | **extendido** | +336 líneas: 2 endpoints nuevos, lógica en `/me` |
| `api/smoke-tests/retention-v1.sh` | **nuevo** | 250 líneas de smoke tests (12 escenarios) |

### Motor de entitlements (`engine/entitlements.ts`)

**Funciones nuevas:**

```
getRetentionStatus(c, profileId, ents) → RetentionStatus
  - Computa excedentes por recurso (links, photos, faqs, products, videos)
  - Detecta módulos con expires_at vencido
  - Calcula requires_selection, paused_features_count, recoverable_items_count
  - Tolerante a tablas opcionales (0023 overrides) con .catch()

logPlanEvent(db, { profileId, eventType, triggeredBy?, eventData? })
  - Escribe en profile_plan_events
  - Non-blocking (fire-and-forget con .catch silencioso)
  - event_types: trial_expired, module_expired, retention_selection, downgrade, item_reactivated
```

### Endpoints nuevos/extendidos

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/api/v1/entitlements` | `requireAuth` | **nuevo** — retorna límites + RetentionStatus completo |
| `POST` | `/api/v1/me/retention/selection` | `requireAuth` | **nuevo** — reordena sort_order para priorizar keep_ids |
| `GET` | `/api/v1/me` | `requireAuth` | **extendido** — agrega paused_features_count, recoverable_items_count, trial_status, trial_expires_at |

### Migración

```sql
-- 0025_plan_events_log.sql
CREATE TABLE IF NOT EXISTS profile_plan_events (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  profile_id   TEXT NOT NULL,
  event_type   TEXT NOT NULL CHECK (event_type IN (...)),
  triggered_by TEXT,
  event_data   TEXT,
  created_at   DATETIME DEFAULT (datetime('now'))
);
-- + 3 índices (profile_id, profile_id+event_type, created_at)
```

**Estado:** Migración aplicada en producción junto con deploy del worker.

### Lógica de retención (no borra datos)

`POST /me/retention/selection` solo reordena `sort_order`:
- `keep_ids[0]` → sort_order = 0
- `keep_ids[1]` → sort_order = 1
- ...
- ítems NO en keep_ids → sort_order = 9000 + posición (visibles en la tabla, no en el perfil)

Invariante: **ningún dato se borra nunca.**

---

## 3. Solución frontend — commits `1a7b5ee` + `a3b0a9d`

### Archivos tocados
| Archivo | Tipo | Descripción |
|---|---|---|
| `app/src/App.tsx` | modificado | Ruta `/admin/retention` + import AdminRetention |
| `app/src/components/admin/AdminDashboard.tsx` | modificado | Props de retención a RetentionPanel, condición mejorada |
| `app/src/components/admin/RetentionPanel.tsx` | **nuevo** | 622 líneas — bloque embebido en dashboard |
| `app/src/components/admin/AdminRetention.tsx` | **nuevo** | 690 líneas — página completa de gestión |

### Componentes UI nuevos

**`RetentionPanel`** (dashboard embebido):
- `TrialBanner` — alerta de trial vencido o a punto de vencer (≤7 días)
- `RetentionSummaryCard` — resumen de funciones pausadas + ítems recuperables
- `RetentionSelectorModal` — selector de qué mantener activo (tabs por recurso, checkboxes, límite visual)
- `StatusBadge` — chip de estado (activo / pausado / requiere elección)

**`AdminRetention`** (`/admin/retention`):
- Vista completa de estado del plan
- Desglose por recurso con IDs exactos
- Módulos pausados
- Selector inline (sin modal)
- CTA de upgrade → `https://intaprd.com`

### Ruta nueva

```
/admin/retention   →  AdminRetention   (protegida por AdminGuard)
```

---

## 4. Bugs encontrados en UI y correcciones aplicadas

### Bug #1 — crítico (commit `a3b0a9d`)

**Síntoma:** RetentionPanel no aparecía en el dashboard desplegado aunque el backend reportaba `paused_features_count = 1`.

**Causa raíz:** `RetentionPanel` tenía `if (!ent) return null`. Si el fetch a `/api/v1/entitlements` fallaba por cualquier motivo (error de red, respuesta inesperada, 404), `ent` quedaba `null` y el componente renderizaba nada silenciosamente. El dashboard ya tenía los datos correctos en `me.paused_features_count` pero no los pasaba al componente.

**Corrección:**
```tsx
// ANTES — renderizado bloqueado por fetch
if (!ent) return null

// DESPUÉS — datos iniciales de /me garantizan el render
const pausedFeaturesCount = ent?.paused_features_count ?? initialPausedFeaturesCount
// ent es background-only; initialProps de /me son el source primario
```

AdminDashboard ahora pasa los campos de retención como props:
```tsx
<RetentionPanel
  profileId={me.profile_id}
  initialPausedFeaturesCount={me.paused_features_count ?? 0}
  initialRecoverableItemsCount={me.recoverable_items_count ?? 0}
  initialTrialStatus={me.trial_status ?? 'none'}
  initialTrialExpiresAt={me.trial_expires_at ?? null}
/>
```

### Bug #2 — CTA stub (commit `a3b0a9d`)

**Síntoma:** Botón "Actualizar plan" en AdminRetention ejecutaba `alert('Próximamente...')`.

**Corrección:** Reemplazado por `<a href="https://intaprd.com" target="_blank">Ver planes disponibles →</a>`.

---

## 5. Validaciones en producción

| Validación | Método | Resultado |
|---|---|---|
| `/api/v1/entitlements` retorna datos correctos | curl manual + reporte del usuario | ✅ ok, `paused_features_count=1`, `recoverable_items_count=3`, `requires_selection=true` |
| `products` exceeded: used=6, allowed=3, exceeded=3 | reportado por usuario en `/me` | ✅ |
| Build frontend sin errores | `tsc && vite build` | ✅ `339 kB JS / 40 kB CSS` |
| Panel visible en dashboard | validación visual post-corrección | pendiente deploy con token |

---

## 6. URLs de deploy

| Sistema | URL | Proyecto Cloudflare |
|---|---|---|
| API Worker | `api.intaprd.com` (o equivalente configurado en wrangler.toml) | worker `intap-link-api` |
| App admin | `app.intaprd.com` | pages `intap-link` |
| Perfil público | `intaprd.com` | pages `intap-web2` |

---

## 7. Pendientes V1.1 (no bloqueantes)

| ID | Descripción | Prioridad |
|---|---|---|
| V1.1-1 | Página de planes en intaprd.com (actualmente el CTA manda al home) | Alta |
| V1.1-2 | Notificación por email/push cuando trial vence o recurso queda pausado | Media |
| V1.1-3 | `GET /api/v1/entitlements` debería estar accesible también en `/admin/retention` sin recargar /me | Baja |
| V1.1-4 | Smoke tests automatizados en CI (actualmente el script existe pero no corre en pipeline) | Media |
| V1.1-5 | Reactivación individual de ítems pausados (`item_reactivated` ya está en el schema de eventos) | Media |
| V1.1-6 | Manejo de `downgrade_effective_at` — aviso anticipado antes de que venza el período de gracia | Alta |
| V1.1-7 | Panel de módulos pausados en `/admin/retention` muestra metadata pero no permite reactivar desde UI | Baja |
| V1.1-8 | Videos excluidos del selector modal (solo links/photos/faqs/products implementados como tabs) | Baja |
