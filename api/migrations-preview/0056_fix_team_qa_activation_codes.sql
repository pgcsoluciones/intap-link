-- Preview-only fix for Team QA activation secrets.
-- The database stores SHA-256 hashes of normalized plaintext activation codes.
-- Plaintext QA secrets are documented only for Preview testing and never added to Production.

UPDATE artifact_activation_codes
SET activation_code_hash='d9ac5ce6153f30121af8955ad794e00e82fd291bcacd6f2ec25ab8cb3f57c3c5',
    status='active', expires_at=datetime('now','+30 days'), used_at=NULL,
    failed_attempts=0, last_attempt_at=NULL
WHERE id='qa-team-activation-01' AND artifact_id='qa-team-artifact-01';

UPDATE artifact_activation_codes
SET activation_code_hash='6eec3af625c5f0ee39d1b1ff024cde117eae866235e925d026afaee2b54d7cec',
    status='active', expires_at=datetime('now','+30 days'), used_at=NULL,
    failed_attempts=0, last_attempt_at=NULL
WHERE id='qa-team-activation-02' AND artifact_id='qa-team-artifact-02';

UPDATE artifact_activation_codes
SET activation_code_hash='2d38f00038a3359decc0be18ff0e698b5fa519ac89400127ab761099a36f95bc',
    status='active', expires_at=datetime('now','+30 days'), used_at=NULL,
    failed_attempts=0, last_attempt_at=NULL
WHERE id='qa-team-activation-03' AND artifact_id='qa-team-artifact-03';

UPDATE artifact_activation_codes
SET activation_code_hash='ca657f4bb884ebee3257b33befc06341c7604d07257e87f9cf6a43ddbb6aaf76',
    status='active', expires_at=datetime('now','+30 days'), used_at=NULL,
    failed_attempts=0, last_attempt_at=NULL
WHERE id='qa-team-activation-04' AND artifact_id='qa-team-artifact-04';

UPDATE artifact_activation_codes
SET activation_code_hash='5e49b654e7f80974b707a11264ffabd4daf5cfa820f4ffc56c9f438d701fd339',
    status='active', expires_at=datetime('now','+30 days'), used_at=NULL,
    failed_attempts=0, last_attempt_at=NULL
WHERE id='qa-team-activation-05' AND artifact_id='qa-team-artifact-05';
