-- 006_calendar_notes.sql
-- Module 7 (Task 3.5): daily_notes table — quick notes per user per date

CREATE TABLE IF NOT EXISTS daily_notes (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date       DATE        NOT NULL,
  content    TEXT        NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_notes_user_date ON daily_notes(user_id, date);

-- Reuse existing update_updated_at() trigger function
DROP TRIGGER IF EXISTS trg_daily_notes_updated_at ON daily_notes;
CREATE TRIGGER trg_daily_notes_updated_at
  BEFORE UPDATE ON daily_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed: sample notes for demo user
INSERT INTO daily_notes (user_id, date, content) VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', CURRENT_DATE,       'Revisar propuesta para reunión de estrategia Q3. Confirmar participantes del VP de Finanzas.'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', CURRENT_DATE - 1,   'Pendiente: enviar minuta de la junta de socios. Firmar contrato AWS antes del viernes.')
ON CONFLICT (user_id, date) DO NOTHING;
