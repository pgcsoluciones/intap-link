-- INTAP LINK Gratis · layout_id
--
-- RECONCILIACIÓN PREVIEW:
-- La columna ya existe físicamente en intap_db_preview con:
--
--   TEXT NOT NULL DEFAULT 'esencial'
--   CHECK layout_id IN ('impacto', 'personal', 'esencial')
--
-- Esta migración no modifica schema.
-- Su propósito es alinear el historial D1 con el estado real verificado
-- el 2026-08-14.

SELECT 1;
