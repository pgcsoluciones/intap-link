-- 0045_rename_adonisg_to_argenisg.sql
-- SOLO PREVIEW: corrige el slug del perfil especial de Argenis.
-- Producción no se toca.

UPDATE profiles
SET
  slug='argenisg',
  updated_at=datetime('now')
WHERE user_id='user-qa-adonisg'
  AND slug='adonisg';
