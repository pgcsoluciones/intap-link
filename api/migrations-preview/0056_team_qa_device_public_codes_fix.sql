-- Preview-only QA repair.
-- 0055 used 0/1 in synthetic public codes, but physical public codes deliberately
-- exclude ambiguous characters 0 and 1 ([A-Z2-9]). Keep the same QA artifact IDs
-- and activation rows; only repair their public identifiers.
-- This migration must never be mirrored to Production.

UPDATE intap_artifacts SET public_code = 'QATEAM22A2', updated_at = datetime('now') WHERE id = 'qa-team-artifact-01';
UPDATE intap_artifacts SET public_code = 'QATEAM23B3', updated_at = datetime('now') WHERE id = 'qa-team-artifact-02';
UPDATE intap_artifacts SET public_code = 'QATEAM24C4', updated_at = datetime('now') WHERE id = 'qa-team-artifact-03';
UPDATE intap_artifacts SET public_code = 'QATEAM25D5', updated_at = datetime('now') WHERE id = 'qa-team-artifact-04';
UPDATE intap_artifacts SET public_code = 'QATEAM26E6', updated_at = datetime('now') WHERE id = 'qa-team-artifact-05';
