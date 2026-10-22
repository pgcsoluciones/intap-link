-- KawMed appearance selection: isolated from medical and appointment data.
CREATE TABLE IF NOT EXISTS medical_profile_appearance (
  medical_profile_id TEXT PRIMARY KEY,
  template TEXT NOT NULL DEFAULT 'classic' CHECK (template IN ('classic','pastel')),
  palette TEXT NOT NULL DEFAULT 'aqua' CHECK (palette IN ('aqua','lavender','mint','peach','sky')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (medical_profile_id) REFERENCES medical_profiles(id) ON DELETE CASCADE
);
