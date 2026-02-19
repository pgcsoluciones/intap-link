# CONTRATO TÉCNICO v1.2 — Fase 1 MVP INTAP LINK

> **Estado:** Pendiente de aprobación formal del Director del Proyecto.
> **Versión anterior:** v1.1 (6 correcciones base integradas).
> **Cambio en v1.2:** Único ajuste — `allowedTools` reemplazado por `allowedTemplates` en entitlements (§3 y §5).

---

## Índice de correcciones incluidas

| # | Corrección | Impacto |
|---|-----------|---------|
| 1 | Confirmar routing `/{slug}` en frontend público | Confirmación + documentación permanente |
| 2 | Teléfono solo como `profile_links.type = phone` | Migración schema + regla de negocio |
| 3 | Templates por `allowedTemplates` en entitlements (**v1.2**) | Schema + lógica Entitlements Engine |
| 4 | Schema MVP sin bloqueo por tools/marketplace | Tablas mínimas + tablas preparadas |
| 5 | Contrato de response JSON exacto + 2 ejemplos (**v1.2**) | Documentación de contrato de API |
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

## 3. Templates — `allowedTemplates` en entitlements _(ajuste v1.2)_

**Regla:** `required_tool` es un detalle de implementación del **backend**. El frontend nunca lo ve ni lo evalúa. El Entitlements Engine traduce la relación módulo→templates en `allowedTemplates: string[]` (IDs de templates accesibles). El frontend solo consulta esa lista.

### Schema de tabla `templates` — sin cambios

```sql
CREATE TABLE IF NOT EXISTS templates (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  preview_url   TEXT,
  required_tool TEXT NULL  -- NULL = libre para todos | código de módulo requerido
                           -- Este campo es interno; el frontend nunca lo consume.
);
```

### Lógica del backend — resolución en `getEntitlements()`

El Entitlements Engine construye `allowedTemplates` en dos pasos:

**Paso 1:** Obtener módulos activos del perfil (ya existe en el engine).

**Paso 2:** Consultar `templates` usando esos módulos:

```sql
SELECT id FROM templates
WHERE required_tool IS NULL
   OR required_tool IN (
     SELECT module_code FROM profile_modules
     WHERE profile_id = ? AND (expires_at IS NULL OR expires_at > datetime('now'))
   )
```

El resultado es el array `allowedTemplates: string[]` — IDs de las templates que este perfil puede usar.

### Interface `Entitlements` — v1.2

```typescript
export interface Entitlements {
  maxLinks:         number
  maxPhotos:        number
  maxFaqs:          number
  canUseVCard:      boolean
  allowedTemplates: string[]   // IDs de templates accesibles. Siempre array, nunca null.
}
```

### Inicialización en `getEntitlements()`

```typescript
// Después de calcular límites base y módulos activos:
const templateRows = await db.prepare(`
  SELECT id FROM templates
  WHERE required_tool IS NULL
     OR required_tool IN (
       SELECT module_code FROM profile_modules
       WHERE profile_id = ? AND (expires_at IS NULL OR expires_at > datetime('now'))
     )
`).bind(profileId).all()

entitlements.allowedTemplates = templateRows.results.map((r: any) => r.id)
```

### Uso en el frontend — regla única

```typescript
// El frontend evalúa acceso a una template así:
const canUse = entitlements.allowedTemplates.includes(template.id)

// NUNCA así (prohibido en frontend):
// const canUse = entitlements.allowedTools?.includes(template.required_tool)
```

**Responsabilidad de capas:**

| Capa | Responsabilidad |
|------|----------------|
| Backend (`getEntitlements`) | Resuelve `required_tool` → lista de IDs → `allowedTemplates` |
| Frontend (`PublicProfile` / Dashboard) | Lee `allowedTemplates`; nunca toca `required_tool` |

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
| `templates` | No existe | Crear (resolución de acceso en backend) |

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
  required_tool TEXT NULL  -- NULL = libre | código de módulo requerido (interno, no expuesto al frontend)
);
```

---

## 5. Contrato de Response — `GET /api/v1/public/profiles/:slug` _(ajuste v1.2)_

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
      maxLinks:         number   // límite total de enlaces activos
      maxPhotos:        number   // límite de fotos en galería
      maxFaqs:          number   // límite de preguntas frecuentes
      canUseVCard:      boolean  // puede generar y compartir vCard
      allowedTemplates: string[] // IDs de templates accesibles. Siempre array, nunca null.
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
| `entitlements.allowedTemplates` | No | `[]` (array vacío, nunca null) |

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
      "allowedTemplates": []
    }
  }
}
```

> El array `allowedTemplates: []` indica que solo puede usar templates con `required_tool = NULL`.
> El frontend filtra la lista de templates disponibles usando este array.

---

### Ejemplo 2 — Perfil con enlaces, redes y módulo de templates activo

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
      "allowedTemplates": ["tpl_classic", "tpl_modern", "tpl_dark", "tpl_premium_rose"]
    }
  }
}
```

> `allowedTemplates` incluye las templates libres (`required_tool = NULL`) más las desbloqueadas
> por el módulo `templates_pro` activo. La resolución ocurrió en el backend; el frontend
> simplemente renderiza accesibles las que aparecen en este array.

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
| **API Worker** | Actualizar `GET /public/profiles/:slug` → incluir `avatar`, `type` en links, `allowedTemplates` en entitlements |
| **Entitlements Engine** | Añadir `allowedTemplates: string[]`; resolución via query a `templates` por módulos activos |
| **Frontend** | Añadir `type` en renderizado de links; botón `ShareProfile`; consumir `avatar`; templates filtradas por `allowedTemplates.includes(id)` |
| **No tocado** | `analytics`, `profile_gallery`, `profile_faqs`, auth, admin, R2 upload |

---

## Criterios de aceptación — Fase 1

- [ ] `GET /api/v1/public/profiles/:slug` retorna el shape JSON exacto definido en §5.
- [ ] `profile_links` con `type = phone` se renderizan con `href="tel:..."` en el frontend.
- [ ] `profile_links` de tipo `phone` cuentan contra `entitlements.maxLinks`.
- [ ] `entitlements.allowedTemplates` contiene IDs de templates accesibles; el frontend no evalúa `required_tool`.
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

> **Versión:** v1.2
> **Cambio vs v1.1:** `allowedTools: string[]` → `allowedTemplates: string[]` en §3 y §5. Único ajuste.
> **Autor:** Claude Code (implementador técnico)
> **Requiere aprobación de:** Director del Proyecto antes de implementación.
