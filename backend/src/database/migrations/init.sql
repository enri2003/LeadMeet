-- Lead Meet - Initial Schema
-- Task 2.5: TIMESTAMPTZ for accurate countdown, status enum for meetings

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(100) NOT NULL,
  role        VARCHAR(100) NOT NULL DEFAULT 'Member',
  email       VARCHAR(150) UNIQUE NOT NULL,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Meeting status enum
DO $$ BEGIN
  CREATE TYPE meeting_status AS ENUM ('scheduled', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Meeting type enum
DO $$ BEGIN
  CREATE TYPE meeting_type AS ENUM ('strategy', 'negotiation', 'interview', 'general');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Meetings table (Task 2.5: TIMESTAMPTZ, states scheduled/completed)
CREATE TABLE IF NOT EXISTS meetings (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title         VARCHAR(200) NOT NULL,
  description   TEXT,
  status        meeting_status NOT NULL DEFAULT 'scheduled',
  type          meeting_type NOT NULL DEFAULT 'general',
  start_time    TIMESTAMPTZ NOT NULL,
  end_time      TIMESTAMPTZ NOT NULL,
  is_confidential BOOLEAN NOT NULL DEFAULT FALSE,
  meeting_code  VARCHAR(50) UNIQUE,
  actual_duration_minutes INTEGER DEFAULT NULL,
  created_by    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_end_after_start CHECK (end_time > start_time)
);

-- Meeting participants
CREATE TABLE IF NOT EXISTS meeting_participants (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id        UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  participant_role  VARCHAR(50) NOT NULL DEFAULT 'Participante',
  joined_at         TIMESTAMPTZ,
  left_at           TIMESTAMPTZ,
  UNIQUE(meeting_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_meetings_status        ON meetings(status);
CREATE INDEX IF NOT EXISTS idx_meetings_start_time    ON meetings(start_time);
CREATE INDEX IF NOT EXISTS idx_meetings_created_by    ON meetings(created_by);
CREATE INDEX IF NOT EXISTS idx_meetings_actual_duration ON meetings(actual_duration_minutes);
CREATE INDEX IF NOT EXISTS idx_participants_meeting   ON meeting_participants(meeting_id);
CREATE INDEX IF NOT EXISTS idx_participants_user      ON meeting_participants(user_id);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_meetings_updated_at ON meetings;
CREATE TRIGGER trg_meetings_updated_at
  BEFORE UPDATE ON meetings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed data: demo user (Ricardo Mendoza - CEO)
INSERT INTO users (id, name, role, email, avatar_url) VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Ricardo Mendoza', 'CEO, Lead Group', 'r.mendoza@leadgroup.com', NULL)
ON CONFLICT (email) DO NOTHING;

-- Seed meetings relative to NOW() so dashboard always shows live data
INSERT INTO meetings (id, title, description, status, type, start_time, end_time, is_confidential, meeting_code, created_by) VALUES
  -- Completed meetings (for stats)
  (uuid_generate_v4(), 'Kickoff Proyecto Alpha',    'Reunión de inicio de proyecto', 'completed', 'strategy',     NOW() - INTERVAL '10 days 2 hours', NOW() - INTERVAL '10 days 1 hour',   FALSE, NULL, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  (uuid_generate_v4(), 'Revisión Q1 Finanzas',      'Análisis trimestral',           'completed', 'strategy',     NOW() - INTERVAL '8 days 3 hours',  NOW() - INTERVAL '8 days 1 hour 30 min', FALSE, NULL, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  (uuid_generate_v4(), 'Onboarding Dev Team',        'Integración del equipo',        'completed', 'general',      NOW() - INTERVAL '7 days 1 hour',   NOW() - INTERVAL '7 days',           FALSE, NULL, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  (uuid_generate_v4(), 'Demo Producto v2',           'Presentación al cliente',       'completed', 'negotiation',  NOW() - INTERVAL '5 days 4 hours',  NOW() - INTERVAL '5 days 3 hours',   FALSE, NULL, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  (uuid_generate_v4(), 'Entrevista Backend Lead',    'Proceso de selección',          'completed', 'interview',    NOW() - INTERVAL '4 days 2 hours',  NOW() - INTERVAL '4 days 1 hour',    FALSE, NULL, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  (uuid_generate_v4(), 'Sync Infraestructura',       'Revisión de servidores',        'completed', 'general',      NOW() - INTERVAL '3 days 3 hours',  NOW() - INTERVAL '3 days 2 hours',   FALSE, NULL, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  (uuid_generate_v4(), 'Junta de Socios',            'Decisiones estratégicas Q3',    'completed', 'strategy',     NOW() - INTERVAL '2 days 1 hour',   NOW() - INTERVAL '2 days',           TRUE,  'RM-2024-001', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  (uuid_generate_v4(), 'Plan Marketing Digital',     'Estrategia redes sociales',     'completed', 'strategy',     NOW() - INTERVAL '1 day 5 hours',   NOW() - INTERVAL '1 day 4 hours',    FALSE, NULL, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  -- Yesterday completed (for % change vs yesterday)
  (uuid_generate_v4(), 'Review UX Sprint 3',         'Feedback de diseño',            'completed', 'general',      NOW() - INTERVAL '1 day 2 hours',   NOW() - INTERVAL '1 day 1 hour',     FALSE, NULL, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  -- Today completed (so today > yesterday → positive %)
  (uuid_generate_v4(), 'Stand-up Matutino',          'Daily stand-up',                'completed', 'general',      NOW() - INTERVAL '3 hours',         NOW() - INTERVAL '2 hours 30 min',   FALSE, NULL, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  -- Upcoming (scheduled)
  ('b1c2d3e4-f5a6-7890-bcde-fa1234567890', 'Revisión de Estrategia Trimestral Q3', 'Análisis y definición de KPIs para Q3', 'scheduled', 'strategy', NOW() + INTERVAL '45 minutes',      NOW() + INTERVAL '1 hour 45 minutes', FALSE, 'RM-2024-Q3', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('c2d3e4f5-a6b7-8901-cdef-ab1234567890', 'Negociación con Proveedor Cloud',       'Revisión de contrato AWS',              'scheduled', 'negotiation', NOW() + INTERVAL '1 day 9 hours 30 min', NOW() + INTERVAL '1 day 11 hours', FALSE, NULL, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('d3e4f5a6-b7c8-9012-defa-bc1234567890', 'Entrevista Final: VP de Operaciones',   'Ronda final de selección',              'scheduled', 'interview',   NOW() + INTERVAL '2 days 16 hours', NOW() + INTERVAL '2 days 17 hours', FALSE, NULL, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890')
ON CONFLICT DO NOTHING;

-- Seed participants for upcoming meetings
INSERT INTO meeting_participants (meeting_id, user_id) VALUES
  ('b1c2d3e4-f5a6-7890-bcde-fa1234567890', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('c2d3e4f5-a6b7-8901-cdef-ab1234567890', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('d3e4f5a6-b7c8-9012-defa-bc1234567890', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890')
ON CONFLICT DO NOTHING;
