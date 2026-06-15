-- Add 'clase' value to meetings_type_enum
-- Must be run outside a transaction block in PostgreSQL

ALTER TYPE meetings_type_enum ADD VALUE IF NOT EXISTS 'clase';
