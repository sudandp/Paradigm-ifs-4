-- Add link column to notifications table to fix PGRST204 error
-- The codebase uses 'link' but the table has 'link_to'
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS link TEXT;

-- Optionally, sync link with link_to if one is populated and the other isn't
-- This is just to ensure backward compatibility during transition
UPDATE public.notifications SET link = link_to WHERE link IS NULL AND link_to IS NOT NULL;
