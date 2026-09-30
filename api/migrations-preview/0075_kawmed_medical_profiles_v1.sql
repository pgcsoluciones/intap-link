-- KawMed V1 — perfiles médicos públicos
CREATE TABLE IF NOT EXISTS medical_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  professional_prefix TEXT,
  specialty TEXT NOT NULL,
  subspecialty TEXT,
  bio TEXT,
  avatar_url TEXT,
  cover_url TEXT,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  city TEXT,
  province TEXT,
  country TEXT DEFAULT 'República Dominicana',
  organization TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','inactive')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS medical_profile_centers (
  id TEXT PRIMARY KEY,
  medical_profile_id TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  province TEXT,
  country TEXT DEFAULT 'República Dominicana',
  phone TEXT,
  map_url TEXT,
  latitude REAL,
  longitude REAL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (medical_profile_id) REFERENCES medical_profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS medical_profile_schedules (
  id TEXT PRIMARY KEY,
  medical_profile_id TEXT NOT NULL,
  center_id TEXT NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  shift TEXT,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (medical_profile_id) REFERENCES medical_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (center_id) REFERENCES medical_profile_centers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS medical_profile_services (
  id TEXT PRIMARY KEY,
  medical_profile_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (medical_profile_id) REFERENCES medical_profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_medical_profiles_slug_status ON medical_profiles(slug, status);
CREATE INDEX IF NOT EXISTS idx_medical_centers_profile ON medical_profile_centers(medical_profile_id, active, sort_order);
CREATE INDEX IF NOT EXISTS idx_medical_schedules_profile_center ON medical_profile_schedules(medical_profile_id, center_id, active, day_of_week, sort_order);
CREATE INDEX IF NOT EXISTS idx_medical_services_profile ON medical_profile_services(medical_profile_id, active, sort_order);

-- Demo ficticio. Los teléfonos 809-000-0000 se reservan aquí solo para QA visual.
INSERT OR IGNORE INTO medical_profiles (
  id, slug, name, professional_prefix, specialty, subspecialty, bio,
  phone, whatsapp, email, city, province, country, organization, status
) VALUES (
  'kawmed_demo_laura_mendez', 'lauramendez', 'Laura Méndez', 'Dra.', 'Cardióloga',
  'Cardiología clínica · Prevención cardiovascular',
  'Especialista en salud cardiovascular enfocada en prevención, evaluación y seguimiento.',
  '+1 809 000 0000', '18090000000', 'demo.kawmed@example.invalid',
  'Santo Domingo', 'Distrito Nacional', 'República Dominicana', 'KawMed Demo', 'active'
);

INSERT OR IGNORE INTO medical_profile_centers
(id, medical_profile_id, name, address, city, province, country, phone, map_url, sort_order, active)
VALUES
('kawmed_center_uce','kawmed_demo_laura_mendez','Centro Médico UCE','Santo Domingo','Santo Domingo','Distrito Nacional','República Dominicana','+1 809 000 0000','https://www.google.com/maps/search/?api=1&query=Centro+Medico+UCE+Santo+Domingo',1,1),
('kawmed_center_independencia','kawmed_demo_laura_mendez','Clínica Independencia','Santo Domingo','Santo Domingo','Distrito Nacional','República Dominicana','+1 809 000 0000','https://www.google.com/maps/search/?api=1&query=Clinica+Independencia+Santo+Domingo',2,1),
('kawmed_center_vida','kawmed_demo_laura_mendez','Centro Médico Vida','Santo Domingo','Santo Domingo','Distrito Nacional','República Dominicana','+1 809 000 0000','https://www.google.com/maps/search/?api=1&query=Centro+Medico+Vida+Santo+Domingo',3,1);

INSERT OR IGNORE INTO medical_profile_schedules
(id, medical_profile_id, center_id, day_of_week, shift, start_time, end_time, sort_order, active)
VALUES
('kawmed_sched_1','kawmed_demo_laura_mendez','kawmed_center_uce',1,'Mañana','08:00','12:00',1,1),
('kawmed_sched_2','kawmed_demo_laura_mendez','kawmed_center_independencia',2,'Tarde','14:00','18:00',2,1),
('kawmed_sched_3','kawmed_demo_laura_mendez','kawmed_center_independencia',3,'Tarde','13:00','17:00',3,1),
('kawmed_sched_4','kawmed_demo_laura_mendez','kawmed_center_vida',4,'Mañana','08:00','12:00',4,1),
('kawmed_sched_5','kawmed_demo_laura_mendez','kawmed_center_vida',5,'Jornada corta','09:00','13:00',5,1);

INSERT OR IGNORE INTO medical_profile_services
(id, medical_profile_id, title, description, category, sort_order, active)
VALUES
('kawmed_service_1','kawmed_demo_laura_mendez','Cardiología clínica','Atención y seguimiento cardiovascular.','Cardiología',1,1),
('kawmed_service_2','kawmed_demo_laura_mendez','Prevención cardiovascular','Evaluación y control de factores de riesgo.','Prevención',2,1),
('kawmed_service_3','kawmed_demo_laura_mendez','Electrocardiograma','Estudios cardíacos y evaluación inicial.','Diagnóstico',3,1),
('kawmed_service_4','kawmed_demo_laura_mendez','Consulta cardiológica','Evaluación médica especializada.','Consulta',4,1);
