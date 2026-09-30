-- KAWVO LINK · Agenda reutilizable por tipo de perfil
-- Núcleo polimórfico preparado para sponsored / free / trial.

CREATE TABLE IF NOT EXISTS appointment_settings (
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0,1)),
  slot_minutes INTEGER NOT NULL DEFAULT 30 CHECK (slot_minutes IN (15,30,45,60)),
  min_notice_minutes INTEGER NOT NULL DEFAULT 120 CHECK (min_notice_minutes BETWEEN 0 AND 10080),
  horizon_days INTEGER NOT NULL DEFAULT 30 CHECK (horizon_days BETWEEN 1 AND 90),
  timezone TEXT NOT NULL DEFAULT 'America/Santo_Domingo',
  reason_mode TEXT NOT NULL DEFAULT 'default' CHECK (reason_mode IN ('default','custom')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (subject_type, subject_id)
);

CREATE TABLE IF NOT EXISTS appointment_availability (
  id TEXT PRIMARY KEY,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS appointment_reasons (
  id TEXT PRIMARY KEY,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  label TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS appointment_blocks (
  id TEXT PRIMARY KEY,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  block_date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS appointment_requests (
  id TEXT PRIMARY KEY,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  appointment_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  timezone TEXT NOT NULL,
  reason_id TEXT,
  reason_label TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','rejected','cancelled','expired')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  confirmed_at TEXT,
  rejected_at TEXT,
  cancelled_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_appointment_availability_subject
  ON appointment_availability(subject_type, subject_id, weekday, enabled, sort_order);

CREATE INDEX IF NOT EXISTS idx_appointment_reasons_subject
  ON appointment_reasons(subject_type, subject_id, enabled, sort_order);

CREATE INDEX IF NOT EXISTS idx_appointment_blocks_subject_date
  ON appointment_blocks(subject_type, subject_id, block_date);

CREATE INDEX IF NOT EXISTS idx_appointment_requests_subject_date
  ON appointment_requests(subject_type, subject_id, appointment_date, status, start_time);

CREATE INDEX IF NOT EXISTS idx_appointment_requests_owner
  ON appointment_requests(owner_user_id, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_appointment_confirmed_exact_slot
  ON appointment_requests(subject_type, subject_id, appointment_date, start_time)
  WHERE status='confirmed';
