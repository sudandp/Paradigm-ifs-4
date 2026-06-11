-- Migration: Add access_support_desk permission to developer role and attachment_url to support_tickets
-- Date: 2026-06-11

-- 1. Grant permission to developer role
UPDATE public.roles 
SET permissions = (
    SELECT array_agg(DISTINCT p)
    FROM unnest(
        COALESCE(permissions, ARRAY[]::text[]) || 
        ARRAY['access_support_desk']
    ) AS p
)
WHERE id = 'developer';

-- 2. Add attachment_url column to support_tickets
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS attachment_url TEXT;
