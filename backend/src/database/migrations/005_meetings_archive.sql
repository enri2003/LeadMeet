-- 005_meetings_archive.sql
-- Module 6 (Task 3.5): add 'archived' status, seed demo data, duration view

-- Extend enum with 'archived' value (PostgreSQL 12+ IF NOT EXISTS)
ALTER TYPE meeting_status ADD VALUE IF NOT EXISTS 'archived';

-- Seed: archived meetings for demo (older than 30 days)
INSERT INTO meetings (id, title, description, status, type, start_time, end_time, is_confidential, created_by) VALUES
  (uuid_generate_v4(), 'Planificación Anual 2023',   'Objetivos y OKRs del ejercicio',       'archived', 'strategy',    NOW() - INTERVAL '60 days 2 hours',   NOW() - INTERVAL '60 days 1 hour',        FALSE, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  (uuid_generate_v4(), 'Auditoría Interna Q4 2023',  'Revisión contable y compliance',       'archived', 'general',     NOW() - INTERVAL '45 days 3 hours',   NOW() - INTERVAL '45 days 1 hour 30 min', FALSE, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  (uuid_generate_v4(), 'Selección CTO Externo',      'Entrevista final candidatos externos', 'archived', 'interview',   NOW() - INTERVAL '30 days 4 hours',   NOW() - INTERVAL '30 days 3 hours',       FALSE, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  (uuid_generate_v4(), 'Junta Accionistas Q3 2023',  'Resultados trimestrales',              'archived', 'negotiation', NOW() - INTERVAL '90 days 1 hour',    NOW() - INTERVAL '90 days',               TRUE,  'a1b2c3d4-e5f6-7890-abcd-ef1234567890')
ON CONFLICT DO NOTHING;

-- View: meetings enriched with calculated duration in minutes
CREATE OR REPLACE VIEW v_meetings_with_duration AS
SELECT
  m.*,
  ROUND(EXTRACT(EPOCH FROM (m.end_time - m.start_time)) / 60) AS duration_minutes
FROM meetings m;

-- Index for filtered queries by status + time
CREATE INDEX IF NOT EXISTS idx_meetings_status_time ON meetings(status, start_time DESC);
