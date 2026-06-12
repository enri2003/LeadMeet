-- Módulo 3 - Tarea 5.5: Registro de actividad de compartición de pantalla

CREATE TABLE IF NOT EXISTS meeting_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id    UUID REFERENCES meetings(id) ON DELETE SET NULL,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id       VARCHAR(100) NOT NULL,
  event_type    VARCHAR(50)  NOT NULL,   -- 'share_started' | 'share_stopped'
  started_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  stopped_at    TIMESTAMPTZ,
  duration_sec  INTEGER GENERATED ALWAYS AS (
                  CASE
                    WHEN stopped_at IS NOT NULL
                    THEN EXTRACT(EPOCH FROM (stopped_at - started_at))::INTEGER
                    ELSE NULL
                  END
                ) STORED,
  source_type   VARCHAR(20),             -- 'monitor' | 'window' | 'browser'
  with_audio    BOOLEAN NOT NULL DEFAULT FALSE,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para consultas de analítica
CREATE INDEX IF NOT EXISTS idx_meeting_logs_user_id    ON meeting_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_logs_room_id    ON meeting_logs(room_id);
CREATE INDEX IF NOT EXISTS idx_meeting_logs_event_type ON meeting_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_meeting_logs_started_at ON meeting_logs(started_at);

-- Vista útil para reportes: duración promedio por usuario
CREATE OR REPLACE VIEW v_sharing_stats AS
SELECT
  u.id                                               AS user_id,
  u.name                                             AS user_name,
  COUNT(ml.id)                                       AS total_sessions,
  ROUND(AVG(ml.duration_sec))                        AS avg_duration_sec,
  SUM(ml.duration_sec)                               AS total_duration_sec,
  MAX(ml.started_at)                                 AS last_shared_at
FROM meeting_logs ml
JOIN users u ON u.id = ml.user_id
WHERE ml.event_type = 'share_stopped'
  AND ml.duration_sec IS NOT NULL
GROUP BY u.id, u.name;
