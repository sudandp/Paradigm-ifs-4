-- Migration: Add Performance Indexes for Slow Queries
-- Date: 2026-01-08
-- Description: Adds optimized covering indexes for the slowest application queries identified in performance logs.
--              Includes a Covering Index for attendance_events to allow Index-Only Scans for geo-queries.

-- 1. ATTENDANCE_EVENTS (General Timestamp Search)
-- Optimizes range queries on timestamp
CREATE INDEX IF NOT EXISTS idx_attendance_events_timestamp ON public.attendance_events("timestamp");

-- 2. NOTIFICATIONS (General Created At Search)
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at);

-- 3. ATTENDANCE_EVENTS (Composite Covering Index)
-- Optimizes: WHERE user_id = $1 AND NOT latitude IS NULL ORDER BY timestamp DESC
-- Optimizes: WHERE user_id = $1 [AND timestamp range]
-- Replaces simple FK index on user_id as this composite index handles 'user_id' lookups too.
DROP INDEX IF EXISTS idx_attendance_events_user_id;
DROP INDEX IF EXISTS idx_attendance_events_user_timestamp;

CREATE INDEX IF NOT EXISTS idx_attendance_events_user_coverage 
ON public.attendance_events(user_id, "timestamp" DESC) 
INCLUDE (latitude, longitude);

-- 4. NOTIFICATIONS (User Feed Optimization)
-- Optimizes: WHERE user_id = $1 ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_notifications_user_created_at ON public.notifications(user_id, created_at DESC);

-- 5. REFRESH STATISTICS
-- Ensure the query planner knows about the data distribution immediately.
ANALYZE public.attendance_events;
ANALYZE public.notifications;
