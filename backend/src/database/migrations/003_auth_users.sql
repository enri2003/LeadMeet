-- Módulo 4 — Tarea 1.1: Campos de autenticación en tabla users
-- Agrega full_name, password_hash, is_verified, otp_code, otp_expires_at

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS full_name      VARCHAR(150),
  ADD COLUMN IF NOT EXISTS password_hash  TEXT,
  ADD COLUMN IF NOT EXISTS is_verified    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS otp_code       VARCHAR(6),
  ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMPTZ;

-- Migrar datos existentes: name → full_name
UPDATE users SET full_name = name WHERE full_name IS NULL;

-- Índices de rendimiento para autenticación
CREATE INDEX IF NOT EXISTS idx_users_email        ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_otp_expires  ON users(otp_expires_at) WHERE otp_expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_is_verified  ON users(is_verified);

-- Restricción: email válido
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS chk_users_email_format;
ALTER TABLE users
  ADD CONSTRAINT chk_users_email_format
  CHECK (email ~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$');
