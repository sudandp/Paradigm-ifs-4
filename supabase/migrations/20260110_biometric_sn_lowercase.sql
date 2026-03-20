-- Migration to ensure biometric serial numbers are stored in lowercase

-- 1. Update existing serial numbers to lowercase
UPDATE public.biometric_devices 
SET sn = LOWER(sn)
WHERE sn != LOWER(sn);

-- 2. Add a constraint or trigger to ensure future SNs are lowercase
-- Using a check constraint for simplicity if possible, or a trigger.
-- A trigger is better to automatically convert it.

CREATE OR REPLACE FUNCTION public.lowercase_biometric_sn() 
RETURNS TRIGGER AS $$
BEGIN
    NEW.sn = LOWER(NEW.sn);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ensure_biometric_sn_lowercase ON public.biometric_devices;
CREATE TRIGGER ensure_biometric_sn_lowercase
BEFORE INSERT OR UPDATE OF sn ON public.biometric_devices
FOR EACH ROW EXECUTE FUNCTION public.lowercase_biometric_sn();
