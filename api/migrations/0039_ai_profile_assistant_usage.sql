-- 0039_ai_profile_assistant_usage.sql
-- Métricas mínimas para controlar uso, costo, errores y rate limits del asistente IA.
-- No guarda respuestas del usuario ni propuestas generadas.

CREATE TABLE IF NOT EXISTS ai_profile_assistant_usage (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('generate', 'apply')),
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'blocked')),
  model TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd REAL NOT NULL DEFAULT 0,
  error_code TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ai_profile_usage_user_created
  ON ai_profile_assistant_usage(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_profile_usage_profile_created
  ON ai_profile_assistant_usage(profile_id, created_at DESC);
