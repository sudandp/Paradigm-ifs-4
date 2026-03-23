-- Enable Supabase Realtime on the notifications table.
-- This is required for the postgres_changes subscription in notificationStore.ts
-- to receive real-time INSERT events when new notifications are created.
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
