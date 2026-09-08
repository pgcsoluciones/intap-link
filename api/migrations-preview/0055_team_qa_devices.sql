-- Preview-only QA devices for Team linkage testing.
-- These public codes are deterministic, synthetic, and must never be added to Production.

INSERT OR IGNORE INTO intap_artifacts
  (id, public_code, product_type, status, created_at, updated_at)
VALUES
  ('qa-team-artifact-01', 'QATEAM01A1', 'keychain', 'available', datetime('now'), datetime('now')),
  ('qa-team-artifact-02', 'QATEAM02B2', 'keychain', 'available', datetime('now'), datetime('now')),
  ('qa-team-artifact-03', 'QATEAM03C3', 'keychain', 'available', datetime('now'), datetime('now')),
  ('qa-team-artifact-04', 'QATEAM04D4', 'keychain', 'available', datetime('now'), datetime('now')),
  ('qa-team-artifact-05', 'QATEAM05E5', 'keychain', 'available', datetime('now'), datetime('now'));

INSERT OR IGNORE INTO artifact_activation_codes
  (id, artifact_id, activation_code_hash, status, expires_at, created_at)
VALUES
  ('qa-team-activation-01', 'qa-team-artifact-01', 'qa-team-hash-01-20260908', 'active', datetime('now','+30 days'), datetime('now')),
  ('qa-team-activation-02', 'qa-team-artifact-02', 'qa-team-hash-02-20260908', 'active', datetime('now','+30 days'), datetime('now')),
  ('qa-team-activation-03', 'qa-team-artifact-03', 'qa-team-hash-03-20260908', 'active', datetime('now','+30 days'), datetime('now')),
  ('qa-team-activation-04', 'qa-team-artifact-04', 'qa-team-hash-04-20260908', 'active', datetime('now','+30 days'), datetime('now')),
  ('qa-team-activation-05', 'qa-team-artifact-05', 'qa-team-hash-05-20260908', 'active', datetime('now','+30 days'), datetime('now'));
