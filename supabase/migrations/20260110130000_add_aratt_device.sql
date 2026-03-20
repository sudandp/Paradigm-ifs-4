
INSERT INTO public.biometric_devices (sn, name, status, last_seen)
VALUES ('NCD8252500648', 'Aratt Aeries', 'online', now())
ON CONFLICT (sn) DO UPDATE 
SET name = 'Aratt Aeries', status = 'online', last_seen = now();
