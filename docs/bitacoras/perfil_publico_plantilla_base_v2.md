# BITÁCORA — Perfil público del cliente / Plantilla Base V2

Fecha: 2026-05-04  
Repo: `/Users/juanluis/Desktop/intap-link`  
Área principal: perfil público publicado en `intaprd.com/slug`

---

## 1. Aclaración de enfoque

La landing marketing de INTAP LINK NO se elimina ni se reemplaza.

La landing marketing queda pausada momentáneamente como frente comercial/futuro.

El foco inmediato pasa al perfil público del cliente, es decir, lo que se publica en:

`intaprd.com/slug`

Actualmente ese render vive en:

`web/src/components/PublicProfile.tsx`

---

## 2. Problema actual

El perfil público actual tiene una estructura visual oscura y limitada para la nueva dirección del producto.

Además, existe una estructura previa de plantillas verticales:

- restaurante
- servicios
- eventos

Estas plantillas aparecen en:

- `web/src/components/PublicProfile.tsx`
- `app/src/components/admin/AdminTemplate.tsx`
- `api/src/index.ts`

Esa estructura no será la base principal del producto en esta etapa.

---

## 3. Nueva decisión de producto

La nueva base del perfil público será una plantilla clara, mobile-first, editable por el usuario/tenant.

Nombre técnico recomendado:

`intap_profile_v2`

Esta plantilla debe convertirse en el fundamento del perfil digital del cliente.

---

## 4. Secciones base de la nueva plantilla

La plantilla base debe incluir:

1. Header / identidad.
2. Foto de perfil o logo.
3. Nombre.
4. Cargo o título profesional.
5. Botones rápidos.
6. Contacto rápido.
7. Botón vCard.
8. Bio personal.
9. Galería / proyectos / servicios destacados.
10. Sobre la empresa.
11. Servicios con checkmarks.
12. Redes y datos de empresa.
13. Preguntas frecuentes.
14. Chatbot flotante WhatsApp.
15. Footer.

---

## 5. Datos que deben ser editables desde el panel tenant

El usuario/tenant debe poder editar:

- color principal,
- foto de perfil o logo,
- nombre,
- cargo / título,
- teléfono,
- WhatsApp,
- Instagram,
- Facebook,
- email,
- web,
- ubicación,
- botones rápidos,
- texto biográfico,
- texto sobre la empresa,
- logo de empresa,
- sello o certificación,
- galería / proyectos,
- servicios,
- preguntas frecuentes,
- textos y botones del chatbot,
- avatar del chatbot,
- enlace o archivo vCard.

---

## 6. Archivos detectados en auditoría

Render público:

- `web/src/components/PublicProfile.tsx`

Routing público:

- `web/src/App.tsx`

Panel tenant relacionado:

- `app/src/components/admin/AdminTemplate.tsx`
- `app/src/components/admin/AdminVisual.tsx`
- `app/src/components/admin/AdminDashboard.tsx`
- `app/src/components/admin/AdminFAQs.tsx`
- `app/src/components/admin/AdminProducts.tsx`
- `app/src/components/admin/AdminLinks.tsx`
- `app/src/components/admin/AdminBlocks.tsx`

Backend:

- `api/src/index.ts`

---

## 7. Cambio conceptual requerido

La pantalla actual de “Plantilla vertical” debe dejar de ser una selección de plantillas tipo restaurante/servicios/eventos.

Debe evolucionar a un panel de edición de contenido del perfil base.

Las plantillas verticales anteriores pueden quedar como legacy, ocultas o fase futura, pero no deben dirigir el trabajo actual.

---

## 8. Orden recomendado de implementación

### Lote 1
Crear componente nuevo para la plantilla pública:

- `web/src/components/profile-templates/IntapProfileV2.tsx`
- `web/src/components/profile-templates/IntapProfileV2.css`

### Lote 2
Conectar `PublicProfile.tsx` para renderizar `intap_profile_v2`.

### Lote 3
Actualizar backend para permitir `intap_profile_v2` como template_id válido.

### Lote 4
Adaptar `AdminTemplate.tsx` para editar datos reales de la plantilla base, no solo elegir vertical.

### Lote 5
Conectar colores, foto, datos, galería, servicios, FAQ y chatbot al panel tenant.

---

## 9. Regla de trabajo

No tocar la landing marketing en este bloque.

Todo cambio debe hacerse por lotes pequeños:

1. backup,
2. modificación,
3. grep,
4. build,
5. prueba visual,
6. commit.

---

## 10. Estado

Pendiente de implementación.

Próximo paso recomendado:

Crear `IntapProfileV2.tsx` y `IntapProfileV2.css` como componente base visual, usando la plantilla HTML entregada como referencia.
