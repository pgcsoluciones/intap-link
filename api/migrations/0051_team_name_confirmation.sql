-- Team name must be explicitly confirmed by the Master before codes can be generated.
ALTER TABLE team_workspaces ADD COLUMN name_confirmed INTEGER NOT NULL DEFAULT 0;
