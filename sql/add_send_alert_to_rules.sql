-- Migration: Add send_alert column to notification_rules
-- This column allows controllers to decide if a rule should trigger a high-priority alert.

ALTER TABLE notification_rules ADD COLUMN send_alert BOOLEAN DEFAULT FALSE;
