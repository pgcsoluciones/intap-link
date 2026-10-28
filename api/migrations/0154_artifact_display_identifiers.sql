-- Short physical identifiers for NEW NFC products only. Existing printed items remain unmapped.
-- One immutable code per artifact, globally unique across KawMed (M), Link (L), Sponsored (P).
CREATE TABLE IF NOT EXISTS artifact_display_identifiers (
 artifact_id TEXT PRIMARY KEY,
 display_code TEXT NOT NULL UNIQUE CHECK (length(display_code)=4),
 product_line TEXT NOT NULL CHECK (product_line IN ('M','L','P')),
 sequence_number INTEGER NOT NULL CHECK (sequence_number BETWEEN 1 AND 32767),
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 UNIQUE(product_line,sequence_number),
 FOREIGN KEY(artifact_id) REFERENCES intap_artifacts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_artifact_display_line ON artifact_display_identifiers(product_line,sequence_number);
