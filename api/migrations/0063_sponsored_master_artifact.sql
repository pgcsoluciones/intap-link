ALTER TABLE sponsor_tenants ADD COLUMN master_artifact_id TEXT;
ALTER TABLE sponsor_artifacts ADD COLUMN artifact_role TEXT NOT NULL DEFAULT 'beneficiary' CHECK (artifact_role IN ('beneficiary','master'));
CREATE INDEX IF NOT EXISTS idx_sponsor_artifacts_role ON sponsor_artifacts(sponsor_id, artifact_role, status);
