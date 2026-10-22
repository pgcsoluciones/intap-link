-- KawMed V1.3 — motivos médicos sobre el núcleo compartido de Agenda.
UPDATE appointment_settings
SET reason_mode='custom',
    updated_at=datetime('now')
WHERE subject_type='medical'
  AND subject_id='kawmed_demo_laura_mendez';

DELETE FROM appointment_reasons
WHERE subject_type='medical'
  AND subject_id='kawmed_demo_laura_mendez';

INSERT INTO appointment_reasons(id,subject_type,subject_id,label,enabled,sort_order)
VALUES
('kawmed_reason_1','medical','kawmed_demo_laura_mendez','Consulta médica',1,0),
('kawmed_reason_2','medical','kawmed_demo_laura_mendez','Evaluación inicial',1,1),
('kawmed_reason_3','medical','kawmed_demo_laura_mendez','Seguimiento / control',1,2),
('kawmed_reason_4','medical','kawmed_demo_laura_mendez','Revisión de resultados',1,3),
('kawmed_reason_5','medical','kawmed_demo_laura_mendez','Procedimiento / tratamiento',1,4),
('kawmed_reason_6','medical','kawmed_demo_laura_mendez','Chequeo preventivo',1,5),
('kawmed_reason_7','medical','kawmed_demo_laura_mendez','Otro',1,6);
