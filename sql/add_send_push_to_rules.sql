-- Migration: Add send_push column to notification_rules
-- This column allows administrators to explicitly trigger a push notification for a rule.

ALTER TABLE notification_rules ADD COLUMN send_push BOOLEAN DEFAULT FALSE;
