-- 0025_plan_events_log.sql
-- Tabla de auditoría para eventos del ciclo de vida del plan.
--
-- Separada de admin_audit_log porque estos eventos son del sistema o del propio
-- usuario (no de acciones administrativas). admin_audit_log requiere
-- admin_user_id NOT NULL, lo que la hace incompatible para eventos sistémicos.
--
-- event_type values:
--   'trial_expired'       — se detectó que el trial venció (emitido 1x / 24h)
--   'module_expired'      — módulo de pago venció (emitido 1x / módulo / 24h)
--   'override_expired'    — override de admin venció (reservado, emitido 1x / 24h)
--   'downgrade'           — cambio de plan a plan menor (reservado para V2)
--   'retention_selection' — el usuario seleccionó qué recursos mantener activos
--   'item_reactivated'    — reactivación posterior de un recurso (reservado para V2)
--
-- triggered_by: user_id si fue acción del usuario; NULL si el sistema lo detectó.
-- event_data:   JSON con contexto del evento (resource, keep_ids, module_code, etc.)

CREATE TABLE IF NOT EXISTS profile_plan_events (
  id           TEXT     NOT NULL PRIMARY KEY
                          DEFAULT (lower(hex(randomblob(8)))),
  profile_id   TEXT     NOT NULL,
  event_type   TEXT     NOT NULL
                 CHECK (event_type IN (
                   'trial_expired', 'module_expired', 'override_expired',
                   'downgrade', 'retention_selection', 'item_reactivated'
                 )),
  triggered_by TEXT,            -- user_id del usuario; NULL = evento del sistema
  event_data   TEXT,            -- JSON con detalles del evento
  created_at   DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_plan_events_profile
  ON profile_plan_events (profile_id);

CREATE INDEX IF NOT EXISTS idx_plan_events_type
  ON profile_plan_events (profile_id, event_type);

CREATE INDEX IF NOT EXISTS idx_plan_events_created
  ON profile_plan_events (created_at);
