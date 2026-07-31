-- 0028_free_profile_limits.sql
-- Contrato definitivo para INTAP LINK Gratis:
--   máximo 3 enlaces personalizados
--   máximo 5 imágenes de portafolio
--   máximo 3 servicios
--
-- La publicación continúa exigiendo:
--   mínimo 2 acciones
--   mínimo 3 imágenes
--   mínimo 2 servicios

UPDATE plan_limits
SET
  max_links = 3,
  max_photos = 5,
  max_products = 3
WHERE plan_id = 'free';
