-- Schema for INTAP Agents MVP
-- Tables are completely isolated from intap_db

CREATE TABLE IF NOT EXISTS agents_workspaces (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL, -- Decoupled ID from users or profiles
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agents_chat_sessions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  title TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES agents_workspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS agents_chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL, -- 'user', 'assistant', 'system'
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES agents_chat_sessions(id) ON DELETE CASCADE
);
