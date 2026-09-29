-- Per-artifact sponsor strip visibility. Defaults to visible to preserve existing sponsored profiles.
ALTER TABLE sponsor_artifacts ADD COLUMN banner_enabled INTEGER NOT NULL DEFAULT 1 CHECK (banner_enabled IN (0,1));
