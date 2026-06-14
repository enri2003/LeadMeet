-- Add actual_duration_minutes column to meetings table
-- This tracks the real duration of meetings when they complete

ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS actual_duration_minutes INTEGER DEFAULT NULL;

COMMENT ON COLUMN meetings.actual_duration_minutes IS 'Actual duration in minutes when the meeting completed. NULL if meeting is still scheduled or not yet recorded.';

-- Create index for finding meetings by duration
CREATE INDEX IF NOT EXISTS idx_meetings_actual_duration ON meetings(actual_duration_minutes);
