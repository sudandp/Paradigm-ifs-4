-- Check existing locations matching the 53 societies
SELECT id, name, address, latitude, longitude, radius, kiosk_pin, created_at
FROM public.locations
WHERE name ILIKE '%Greenwood%'
   OR name ILIKE '%Sobha%'
   OR name ILIKE '%SNN%'
   OR name ILIKE '%Brigade%'
   OR name ILIKE '%Prestige%'
   OR name ILIKE '%Nikoo%'
   OR name ILIKE '%Elan%'
   OR name ILIKE '%Queens Square%'
ORDER BY created_at DESC
LIMIT 25;
