-- Add earned leave opening balance and date to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS earned_leave_opening_balance NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS earned_leave_opening_date DATE DEFAULT CURRENT_DATE;

-- Comment for clarity
COMMENT ON COLUMN public.users.earned_leave_opening_balance IS 'Initial earned leave balance for the employee';
COMMENT ON COLUMN public.users.earned_leave_opening_date IS 'Date when the opening balance was recorded/valid for accrual start';
