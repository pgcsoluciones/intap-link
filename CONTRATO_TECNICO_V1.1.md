# CONTRATO TÉCNICO v1.1 — Fase 1 MVP INTAP LINK

> **Estado:** Pendiente de aprobación formal del Director del Proyecto.
> **Versión anterior:** CONTRACT_STAGE_1.md (infraestructura base aprobada).
> **Propósito:** Incorpora 6 correcciones solicitadas antes de iniciar implementación de Fase 1.

---

## Índice de correcciones incluidas

| # | Corrección | Impacto |
|---|-----------|---------|
| 1 | Confirmar routing `/{slug}` en frontend público | Confirmación + documentación permanente |
| 2 | Teléfono solo como `profile_links.type = phone` | Migración schema + regla de negocio |
| 3 | Templates por entitlements, sin `plan_required` | Schema + lógica Entitlements Engine |
| 4 | Schema MVP sin bloqueo por tools/marketplace | Tablas mínimas + tablas preparadas |
| 5 | Contrato de response JSON exacto + 2 ejemplos | Documentación de contrato de API |
| 6 | ShareProfile con `navigator.share` + fallback | Pseudocódigo + UI mínima |

---

## 1. Routing del frontend público — CONFIRMADO

**Regla inmutable:** El perfil público se renderiza en `/{slug}` en el frontend React.

| Capa | Valor |
|------|-------|
| URL producción | `link.intaprd.com/{slug}` |
| React Router | `<Route path="/:slug" element={<PublicProfile />} />` |
| API backend | `GET /api/v1/public/profiles/:slug` (no cambia) |
| Estado actual | Ya implementado correctamente en `web/src/App.tsx` |

**Regla:** el frontend nunca dicta acceso; solo consume y refleja la respuesta del Worker.
**No hay cambios de código requeridos** para este punto; se documenta como contrato permanente.

---

## 2. ContactActions — Teléfono: solo via `profile_links`

**Regla:** No existe feature de "teléfono" separada. El número telefónico es un enlace estándar con `type = phone`.

### Especificación

- Se añade columna `type TEXT NOT NULL DEFAULT 'link'` a `profile_links`.
- Valores válidos de `type`: `link` | `phone` | `email` | `whatsapp` | `social`
- Enlace telefónico → URL `tel:+XXXXXXXXXX`, `type = phone`.
- Cuenta dentro de `entitlements.maxLinks`. No tiene límite propio.
- Frontend: botón con ícono de teléfono; `href="tel:..."`.
- **Sin tabla nueva, sin endpoint nuevo, sin feature nueva.** Solo `profile_links.type`.

### Migración SQL requerida

```sql
ALTER TABLE profile_links ADD COLUMN type TEXT NOT NULL DEFAULT 'link';
```

### Validación en API al insertar enlace

```typescript
const VALID_LINK_TYPES = ['link', 'phone', 'email', 'whatsapp', 'social']
if (!VALID_LINK_TYPES.includes(type)) return c.json({ ok: false, error: 'Tipo inválido' }, 400)
```

---

## 3. Templates — Acceso por entitlements, sin `plan_required`

**Regla:** El modelo es **herramientas a la carta**. El campo `plan_required` no existe. El acceso a una template se determina comparando `template.required_tool` contra `entitlements.allowedTools`.

### Schema de tabla `templates`

```sql
CREATE TABLE IF NOT EXISTS templates (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  preview_url TEXT,
  required_tool TEXT NULL  -- NULL = libre para todos | 'templates_pro' = requiere herramienta
);
```

### Lógica de acceso a templates

1. El módulo `templates_pro` en `modules` tiene `effects_json = {"unlockTool": "templates_pro"}`.
2. `getEntitlements()` fusiona `unlockTool` en el array `allowedTools[]`.
3. Una template es accesible si:
   - `template.required_tool IS NULL`, **o**
   - `entitlements.allowedTools.includes(template.required_tool)`

### Cambio en `Entitlements` interface

```typescript
export interface Entitlements {
  maxLinks: number
  maxPhotos: number
  maxFaqs: number
  canUseVCard: boolean
  allowedTools: string[]    // ← NUEVO campo
}
```

### Cambio en `getEntitlements()` — fusión incremental

```typescript
// Inicialización
let entitlements: Entitlements = {
  maxLinks: Number(baseLimits.max_links),
  maxPhotos: Number(baseLimits.max_photos),
  maxFaqs: Number(baseLimits.max_faqs),
  canUseVCard: Boolean(baseLimits.can_use_vcard),
  allowedTools: []    // ← inicializar vacío
}

// Dentro del forEach de módulos activos:
if (effects.unlockTool) entitlements.allowedTools.push(effects.unlockTool)
```

---

## 4. Schema MVP Fase 1 — Mínimo necesario

**Regla:** Fase 1 no se bloquea por herramientas ni marketplace. Las tablas de tools son opcionales para el cierre de esta fase.

### Tablas requeridas para cerrar Fase 1

| Tabla | Estado actual | Acción |
|-------|--------------|--------|
| `users` | Existe | Sin cambios |
| `plans` + `plan_limits` | Existe | Sin cambios |
| `modules` + `profile_modules` | Existe | Sin cambios |
| `profiles` | Existe, incompleta | Migrar: añadir `name`, `bio`, `theme_id`, `is_published` |
| `profile_links` | Existe | Migrar: añadir `type TEXT DEFAULT 'link'` |
| `profile_assets` | No existe | Crear (avatar / banner por perfil) |
| `templates` | No existe | Crear (acceso por entitlements) |

### Tablas preparadas — NO bloqueantes para Fase 1

| Tabla | Estado |
|-------|--------|
| `profile_faqs` | Puede crearse, no requerida para cierre de Fase 1 |
| `profile_gallery` | Preparada (R2), no requerida para cierre de Fase 1 |
| `analytics` | Preparada, no requerida para cierre de Fase 1 |
| `tools` / `tool_effects` / `profile_tools` | Preparadas conceptualmente. **No implementadas en Fase 1.** |

### Script de migración acumulativo — Fase 1

```sql
-- 1. Expandir tabla profiles (si las columnas no existen)
ALTER TABLE profiles ADD COLUMN name TEXT;
ALTER TABLE profiles ADD COLUMN bio TEXT;
ALTER TABLE profiles ADD COLUMN theme_id TEXT NOT NULL DEFAULT 'classic';
ALTER TABLE profiles ADD COLUMN is_published INTEGER NOT NULL DEFAULT 0;

-- 2. Expandir tabla profile_links
ALTER TABLE profile_links ADD COLUMN type TEXT NOT NULL DEFAULT 'link';

-- 3. Nueva tabla: profile_assets (avatar / banner por perfil)
CREATE TABLE IF NOT EXISTS profile_assets (
  id         TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  asset_type TEXT NOT NULL DEFAULT 'avatar',  -- 'avatar' | 'banner'
  asset_key  TEXT NOT NULL,                    -- clave en R2
  created_at DATETIME DEFAULT (datetime('now')),
  FOREIGN KEY(profile_id) REFERENCES profiles(id)
);

-- 4. Nueva tabla: templates
CREATE TABLE IF NOT EXISTS templates (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  preview_url   TEXT,
  required_tool TEXT NULL  -- NULL = libre | código de herramienta requerida
);
```

---

## 5. Contrato de Response — `GET /api/v1/public/profiles/:slug`

### Endpoint

```
GET /api/v1/public/profiles/:slug
Host: intap-api.fliaprince.workers.dev
Authorization: ninguna (público)
```

### Tabla de respuestas HTTP

| HTTP | Condición | Body |
|------|-----------|------|
| `200` | Perfil publicado y encontrado | `{ ok: true, data: {...} }` |
| `403` | Perfil existe pero `is_published = 0` | `{ ok: false, error: "Perfil privado" }` |
| `404` | Slug no existe en DB | `{ ok: false, error: "Perfil no encontrado" }` |

### Shape completo del JSON (TypeScript)

```typescript
{
  ok: true,
  data: {
    // --- Identidad ---
    profileId: string            // UUID del perfil (requerido)
    slug:      string            // slug único (requerido)
    themeId:   string            // 'classic' | 'dark' | 'modern' (requerido)

    // --- Contenido (opcionales) ---
    name:   string | null        // nombre público    → null si no configurado
    bio:    string | null        // descripción       → null si no configurada
    avatar: string | null        // R2 key del avatar → null si no hay foto

    // --- Links (siempre array, puede ser vacío) ---
    links: Array<{
      id:    string              // UUID del enlace
      label: string             // texto del botón
      url:   string             // URL completa (incluye tel:, mailto:, https:)
      type:  string             // 'link' | 'phone' | 'email' | 'whatsapp' | 'social'
    }>

    // --- Secciones opcionales (arrays vacíos si no aplican) ---
    gallery: Array<{
      image_key: string         // clave R2 (no URL directa)
    }>

    faqs: Array<{
      question: string
      answer:   string
    }>

    // --- Entitlements (siempre presente) ---
    entitlements: {
      maxLinks:     number       // límite total de enlaces activos
      maxPhotos:    number       // límite de fotos en galería
      maxFaqs:      number       // límite de preguntas frecuentes
      canUseVCard:  boolean      // puede generar y compartir vCard
      allowedTools: string[]     // herramientas activas ['templates_pro', ...]
    }
  }
}
```

### Campos opcionales

| Campo | Opcional | Valor cuando ausente |
|-------|----------|---------------------|
| `name` | Sí | `null` |
| `bio` | Sí | `null` |
| `avatar` | Sí | `null` |
| `gallery` | Sí | `[]` |
| `faqs` | Sí | `[]` |
| `entitlements.allowedTools` | No | `[]` (array vacío, nunca null) |

---

### Ejemplo 1 — Perfil free (mínimo viable)

```json
{
  "ok": true,
  "data": {
    "profileId": "a1b2c3d4-0001-0000-0000-000000000001",
    "slug": "juanluis",
    "themeId": "classic",
    "name": null,
    "bio": null,
    "avatar": null,
    "links": [
      {
        "id": "l1000001-0000-0000-0000-000000000001",
        "label": "WhatsApp",
        "url": "https://wa.me/5491112345678",
        "type": "whatsapp"
      }
    ],
    "gallery": [],
    "faqs": [],
    "entitlements": {
      "maxLinks": 5,
      "maxPhotos": 0,
      "maxFaqs": 0,
      "canUseVCard": false,
      "allowedTools": []
    }
  }
}
```

### Ejemplo 2 — Perfil con enlaces y redes sociales

```json
{
  "ok": true,
  "data": {
    "profileId": "a1b2c3d4-0002-0000-0000-000000000002",
    "slug": "mariapro",
    "themeId": "modern",
    "name": "María García",
    "bio": "Emprendedora digital | Consultora de marketing",
    "avatar": "profiles/mariapro/assets/avatar.jpg",
    "links": [
      {
        "id": "l2000001",
        "label": "WhatsApp",
        "url": "https://wa.me/5491187654321",
        "type": "whatsapp"
      },
      {
        "id": "l2000002",
        "label": "Llamar",
        "url": "tel:+5491187654321",
        "type": "phone"
      },
      {
        "id": "l2000003",
        "label": "Instagram",
        "url": "https://instagram.com/mariapro",
        "type": "social"
      },
      {
        "id": "l2000004",
        "label": "LinkedIn",
        "url": "https://linkedin.com/in/mariapro",
        "type": "social"
      },
      {
        "id": "l2000005",
        "label": "Mi Sitio Web",
        "url": "https://mariapro.com",
        "type": "link"
      }
    ],
    "gallery": [
      { "image_key": "profiles/mariapro/gallery/foto1.jpg" }
    ],
    "faqs": [
      {
        "question": "¿Cómo puedo contactarte?",
        "answer": "Por WhatsApp al instante o agendando una llamada desde este perfil."
      }
    ],
    "entitlements": {
      "maxLinks": 15,
      "maxPhotos": 5,
      "maxFaqs": 5,
      "canUseVCard": true,
      "allowedTools": ["templates_pro"]
    }
  }
}
```

---

## 6. ShareProfile — Compatibilidad Web Share API

**Regla:** Usar `navigator.share()` si está disponible; fallback a copiar enlace al portapapeles + botón WhatsApp.

### Pseudocódigo (TypeScript/React)

```typescript
const shareProfile = async (slug: string, name: string | null) => {
  const profileUrl = `https://link.intaprd.com/${slug}`
  const displayName = name || slug
  const shareText = `Mirá el perfil de ${displayName} en INTAP LINK`

  if (typeof navigator.share === 'function') {
    // Rama 1: Web Share API nativa (iOS Safari, Android Chrome, etc.)
    try {
      await navigator.share({
        title: displayName,
        text: shareText,
        url: profileUrl
      })
    } catch (err) {
      // Usuario canceló el share → no error visible
    }
  } else {
    // Rama 2a: Copiar enlace al portapapeles
    await navigator.clipboard.writeText(profileUrl)
    // Mostrar toast de confirmación mínimo 1500ms: "Enlace copiado ✓"

    // Rama 2b: Abrir WhatsApp compartir (segundo CTA)
    const waShareUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${profileUrl}`)}`
    window.open(waShareUrl, '_blank', 'noopener')
  }
}
```

### UI mínima requerida en `PublicProfile`

| Elemento | Detalle |
|---------|---------|
| Botón "Compartir" | Visible en la vista pública, fuera del área de links |
| Ícono | Share icon estándar (cuadrado con flecha) |
| Toast feedback | "Enlace copiado" con auto-dismiss en 2000ms |
| Botón WhatsApp fallback | Solo aparece si `navigator.share` NO está disponible |

---

## Resumen de impacto técnico por capa

| Capa | Cambios Fase 1 |
|------|---------------|
| **D1 Schema** | Migración: `profiles` (+4 cols), `profile_links` (+1 col), CREATE `profile_assets`, CREATE `templates` |
| **API Worker** | Actualizar `GET /public/profiles/:slug` → incluir `avatar`, `type` en links, `allowedTools` en entitlements |
| **Entitlements Engine** | Añadir `allowedTools: string[]`; fusionar `effects.unlockTool` |
| **Frontend** | Añadir `type` en renderizado de links (phone → `tel:`, whatsapp → estilo verde); añadir botón `ShareProfile`; consumir `avatar` de `profile_assets` |
| **No tocado** | `analytics`, `profile_gallery`, `profile_faqs`, auth, admin, R2 upload |

---

## Criterios de aceptación — Fase 1

- [ ] `GET /api/v1/public/profiles/:slug` retorna el shape JSON exacto definido en §5.
- [ ] `profile_links` con `type = phone` se renderizan con `href="tel:..."` en el frontend.
- [ ] `profile_links` de tipo `phone` cuentan contra `entitlements.maxLinks`.
- [ ] Templates con `required_tool != null` no son accesibles si el perfil no tiene esa herramienta en `allowedTools`.
- [ ] El botón "Compartir" usa `navigator.share` si disponible; fallback a clipboard + WhatsApp.
- [ ] `profile_assets` almacena el avatar del perfil (separado de galería Pro).
- [ ] Migraciones SQL son idempotentes (`IF NOT EXISTS`, columnas con `DEFAULT`).
- [ ] El frontend renderiza perfiles públicos en `/:slug` (confirmado).
- [ ] Ningún límite está hardcodeado: todo viene de `entitlements`.
- [ ] No se modificaron tablas fuera del alcance declarado.

---

## Confirmación de no ruptura estructural

- Plan → módulos → `profile_modules`: intacto.
- Slug uniqueness: intacto.
- `entitlements` sigue siendo fuente de verdad.
- Compatible con Cloudflare Workers + D1 + R2.
- Sin cambios en autenticación ni admin.
- Sin fusión con etapas posteriores.

---

> **Versión:** v1.1
> **Autor:** Claude Code (implementador técnico)
> **Requiere aprobación de:** Director del Proyecto antes de implementación.
