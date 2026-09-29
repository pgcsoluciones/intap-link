-- Group ephemeral quote media uploaded in the same request.
ALTER TABLE sponsored_quote_media ADD COLUMN batch_id TEXT;

CREATE INDEX IF NOT EXISTS idx_sponsored_quote_media_batch
  ON sponsored_quote_media(batch_id, created_at);
