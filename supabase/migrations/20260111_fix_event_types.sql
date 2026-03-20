-- Fix historical biometric event types from underscore to hyphen
UPDATE attendance_events 
SET type = 'check-in' 
WHERE type = 'check_in';

UPDATE attendance_events 
SET type = 'check-out' 
WHERE type = 'check_out';
