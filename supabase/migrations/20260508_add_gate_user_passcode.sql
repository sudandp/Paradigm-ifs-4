-- Add passcode column to gate_users table
ALTER TABLE public.gate_users ADD COLUMN IF NOT EXISTS passcode VARCHAR(4);

-- Populate existing users with random 4-digit passcodes (e.g., 1000 to 9999)
UPDATE public.gate_users 
SET passcode = floor(random() * 9000 + 1000)::text 
WHERE passcode IS NULL;

-- Add a comment to the column
COMMENT ON COLUMN public.gate_users.passcode IS '4-digit static passcode for kiosk authentication';
