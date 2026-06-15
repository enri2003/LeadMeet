-- ══════════════════════════════════════════════════════════════
-- PASO 1: Ejecutar esto ANTES de reiniciar el backend
-- Borra todo el esquema para que TypeORM lo recree con IDs enteros
-- ══════════════════════════════════════════════════════════════

DROP VIEW  IF EXISTS v_meetings_with_duration CASCADE;
DROP VIEW  IF EXISTS v_sharing_stats          CASCADE;
DROP TABLE IF EXISTS daily_notes              CASCADE;
DROP TABLE IF EXISTS user_settings            CASCADE;
DROP TABLE IF EXISTS meeting_participants     CASCADE;
DROP TABLE IF EXISTS meeting_logs             CASCADE;
DROP TABLE IF EXISTS meetings                 CASCADE;
DROP TABLE IF EXISTS refresh_tokens           CASCADE;
DROP TABLE IF EXISTS users                    CASCADE;
DROP TYPE  IF EXISTS meeting_status           CASCADE;
DROP TYPE  IF EXISTS meeting_type             CASCADE;
DROP TYPE  IF EXISTS meetings_status_enum     CASCADE;
DROP TYPE  IF EXISTS meetings_type_enum       CASCADE;
DROP FUNCTION IF EXISTS update_updated_at()  CASCADE;

-- ══════════════════════════════════════════════════════════════
-- PASO 2: Reiniciar el backend (TypeORM crea las tablas solas
--         con IDs 1, 2, 3... automáticamente)
-- ══════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════
-- PASO 3: Ejecutar esto DESPUÉS de que el backend reinicie OK
-- ══════════════════════════════════════════════════════════════

-- Tabla refresh_tokens (no está en TypeORM)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          BIGSERIAL   PRIMARY KEY,
  user_id     BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT        NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);

-- Restricción: hora de fin > hora de inicio
ALTER TABLE meetings
  ADD CONSTRAINT chk_end_after_start CHECK (end_time > start_time);

-- Unicidad de participante por reunión
ALTER TABLE meeting_participants
  ADD CONSTRAINT uq_participant UNIQUE (meeting_id, user_id);

-- Trigger updated_at en meetings
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_meetings_updated_at ON meetings;
CREATE TRIGGER trg_meetings_updated_at
  BEFORE UPDATE ON meetings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Vista: duración calculada por reunión
CREATE OR REPLACE VIEW v_meetings_with_duration AS
SELECT m.*,
  ROUND(EXTRACT(EPOCH FROM (m.end_time - m.start_time)) / 60) AS duration_minutes
FROM meetings m;

-- Vista: estadísticas de compartición de pantalla
CREATE OR REPLACE VIEW v_sharing_stats AS
SELECT
  u.id                           AS user_id,
  u.name                         AS user_name,
  COUNT(ml.id)                   AS total_sessions,
  ROUND(AVG(EXTRACT(EPOCH FROM (ml.stopped_at - ml.started_at)))) AS avg_duration_sec,
  SUM(EXTRACT(EPOCH FROM (ml.stopped_at - ml.started_at)))        AS total_duration_sec,
  MAX(ml.started_at)             AS last_shared_at
FROM meeting_logs ml
JOIN users u ON u.id = ml.user_id
WHERE ml.event_type = 'share_stopped'
  AND ml.stopped_at IS NOT NULL
GROUP BY u.id, u.name;
