-- Módulo 5 — Ajustes Avanzados
-- Task 6.3: tabla user_settings vinculada al usuario

CREATE TABLE IF NOT EXISTS user_settings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

  -- Audio & Video (Task 6.2)
  mic_device_id   TEXT,
  audio_out_id    TEXT,
  noise_cancel    BOOLEAN NOT NULL DEFAULT FALSE,
  face_link       BOOLEAN NOT NULL DEFAULT FALSE,

  -- Privacy (Task 6.4)
  privacy_level   VARCHAR(50) NOT NULL DEFAULT 'organization',
  hide_presence   BOOLEAN NOT NULL DEFAULT FALSE,

  -- Interface & Accessibility (Task 6.1)
  font_size       SMALLINT NOT NULL DEFAULT 16,
  theme           VARCHAR(50) NOT NULL DEFAULT 'dark-lead',
  captions        BOOLEAN NOT NULL DEFAULT FALSE,
  caption_lang    VARCHAR(10) NOT NULL DEFAULT 'es',

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user ON user_settings(user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_settings_updated_at ON user_settings;
CREATE TRIGGER trg_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_user_settings_updated_at();

-- Task 6.5: tabla para invalidación masiva de sesiones (logout-all)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);

-- Seed: settings por defecto para el usuario demo
INSERT INTO user_settings (user_id)
VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890')
ON CONFLICT (user_id) DO NOTHING;
