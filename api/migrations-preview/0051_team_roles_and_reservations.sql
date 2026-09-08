-- Kawvo Link Team · roles administrativos y reserva de dispositivos · Preview
-- Free: un administrador master, máximo un Editor y un Subadministrador.
-- Los productos pueden reservarse a un código Team antes de su primer escaneo.

ALTER TABLE team_members ADD COLUMN admin_role TEXT NOT NULL DEFAULT 'member'
  CHECK (admin_role IN ('member','editor','subadmin'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_team_members_one_editor
  ON team_members(team_id)
  WHERE admin_role='editor';

CREATE UNIQUE INDEX IF NOT EXISTS idx_team_members_one_subadmin
  ON team_members(team_id)
  WHERE admin_role='subadmin';

CREATE UNIQUE INDEX IF NOT EXISTS idx_team_link_codes_reserved_artifact
  ON team_link_codes(artifact_id)
  WHERE artifact_id IS NOT NULL AND used_at IS NULL;

CREATE TRIGGER IF NOT EXISTS trg_team_link_code_reservation_guard
BEFORE UPDATE OF artifact_id ON team_link_codes
WHEN OLD.artifact_id IS NOT NULL
 AND NEW.artifact_id IS NOT OLD.artifact_id
BEGIN
  SELECT RAISE(ABORT, 'team_reserved_product_mismatch');
END;
