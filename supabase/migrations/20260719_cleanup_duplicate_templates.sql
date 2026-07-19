-- Remove duplicate email templates, keeping only the most recently inserted version (MAX id) for each template name
DELETE FROM public.email_templates
WHERE id IN (
    SELECT id
    FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY name ORDER BY created_at DESC) as rnum
        FROM public.email_templates
    ) t
    WHERE t.rnum > 1
);
