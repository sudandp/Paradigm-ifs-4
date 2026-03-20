-- Migration to add Comp Off and Floating Leave opening balances to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS comp_off_opening_balance DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS comp_off_opening_date DATE,
ADD COLUMN IF NOT EXISTS floating_leave_opening_balance DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS floating_leave_opening_date DATE;

COMMENT ON COLUMN public.users.comp_off_opening_balance IS 'Opening balance for Compensatory Off leave';
COMMENT ON COLUMN public.users.comp_off_opening_date IS 'The date from which Comp Off accrual starts for this user';
COMMENT ON COLUMN public.users.floating_leave_opening_balance IS 'Opening balance for Floating Leave';
COMMENT ON COLUMN public.users.floating_leave_opening_date IS 'The date from which Floating Leave accrual starts for this user';
