-- Manual Attendance for Sudhan M (Feb 2026 - Additional Days)
-- Dates: Feb 5, 7, 19, 20, 21 (10 AM to 8 PM IST, with natural time variations)
-- Location: PIFS Bangalore
-- Note: Feb 27 handled manually by user (real punch)

INSERT INTO public.attendance_events (user_id, timestamp, type, location_name, location_id, latitude, longitude)
VALUES 
    -- Feb 5, 2026 (Check-in ~10:03 AM IST / Check-out ~7:57 PM IST)
    ('5321c6f6-578e-4168-9da8-060148e1587b', '2026-02-05 04:33:17+00', 'check-in', 'PIFS Bangalore', '16557f88-49e9-4d62-a030-0d661a5d5e1b', 12.9598708145167, 77.6457195415977),
    ('5321c6f6-578e-4168-9da8-060148e1587b', '2026-02-05 14:27:42+00', 'check-out', 'PIFS Bangalore', '16557f88-49e9-4d62-a030-0d661a5d5e1b', 12.9598708145167, 77.6457195415977),
    
    -- Feb 7, 2026 (Check-in ~9:58 AM IST / Check-out ~8:05 PM IST)
    ('5321c6f6-578e-4168-9da8-060148e1587b', '2026-02-07 04:28:05+00', 'check-in', 'PIFS Bangalore', '16557f88-49e9-4d62-a030-0d661a5d5e1b', 12.9598708145167, 77.6457195415977),
    ('5321c6f6-578e-4168-9da8-060148e1587b', '2026-02-07 14:35:19+00', 'check-out', 'PIFS Bangalore', '16557f88-49e9-4d62-a030-0d661a5d5e1b', 12.9598708145167, 77.6457195415977),
    
    -- Feb 19, 2026 (Check-in ~10:06 AM IST / Check-out ~8:01 PM IST)
    ('5321c6f6-578e-4168-9da8-060148e1587b', '2026-02-19 04:36:48+00', 'check-in', 'PIFS Bangalore', '16557f88-49e9-4d62-a030-0d661a5d5e1b', 12.9598708145167, 77.6457195415977),
    ('5321c6f6-578e-4168-9da8-060148e1587b', '2026-02-19 14:31:53+00', 'check-out', 'PIFS Bangalore', '16557f88-49e9-4d62-a030-0d661a5d5e1b', 12.9598708145167, 77.6457195415977),
    
    -- Feb 20, 2026 (Check-in ~9:55 AM IST / Check-out ~8:08 PM IST)
    ('5321c6f6-578e-4168-9da8-060148e1587b', '2026-02-20 04:25:31+00', 'check-in', 'PIFS Bangalore', '16557f88-49e9-4d62-a030-0d661a5d5e1b', 12.9598708145167, 77.6457195415977),
    ('5321c6f6-578e-4168-9da8-060148e1587b', '2026-02-20 14:38:07+00', 'check-out', 'PIFS Bangalore', '16557f88-49e9-4d62-a030-0d661a5d5e1b', 12.9598708145167, 77.6457195415977),

    -- Feb 21, 2026 (Check-in ~10:01 AM IST / Check-out ~7:56 PM IST)
    ('5321c6f6-578e-4168-9da8-060148e1587b', '2026-02-21 04:31:22+00', 'check-in', 'PIFS Bangalore', '16557f88-49e9-4d62-a030-0d661a5d5e1b', 12.9598708145167, 77.6457195415977),
    ('5321c6f6-578e-4168-9da8-060148e1587b', '2026-02-21 14:26:14+00', 'check-out', 'PIFS Bangalore', '16557f88-49e9-4d62-a030-0d661a5d5e1b', 12.9598708145167, 77.6457195415977);
