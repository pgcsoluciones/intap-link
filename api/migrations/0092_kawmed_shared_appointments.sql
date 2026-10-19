-- KawMed V1.2 — integra el perfil médico con el núcleo compartido de Agenda.
-- Solo configura el demo ficticio Laura Méndez; los perfiles reales se inicializan
-- mediante appointments-core al abrir su gestión de Agenda.

UPDATE medical_profiles
SET user_id='kawmed_demo_owner',
    updated_at=datetime('now')
WHERE id='kawmed_demo_laura_mendez'
  AND (user_id IS NULL OR trim(user_id)='');

INSERT OR IGNORE INTO appointment_settings(
  subject_type,subject_id,enabled,slot_minutes,min_notice_minutes,horizon_days,timezone,reason_mode
) VALUES(
  'medical','kawmed_demo_laura_mendez',1,30,120,30,'America/Santo_Domingo','default'
);

INSERT OR IGNORE INTO appointment_availability(
  id,subject_type,subject_id,weekday,start_time,end_time,enabled,sort_order
) VALUES
('kawmed_appt_avail_1','medical','kawmed_demo_laura_mendez',1,'08:00','12:00',1,1),
('kawmed_appt_avail_2','medical','kawmed_demo_laura_mendez',2,'14:00','18:00',1,2),
('kawmed_appt_avail_3','medical','kawmed_demo_laura_mendez',3,'13:00','17:00',1,3),
('kawmed_appt_avail_4','medical','kawmed_demo_laura_mendez',4,'08:00','12:00',1,4),
('kawmed_appt_avail_5','medical','kawmed_demo_laura_mendez',5,'09:00','13:00',1,5);
