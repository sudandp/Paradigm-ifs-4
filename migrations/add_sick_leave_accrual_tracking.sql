-- Migration to add sick leave accrual tracking fields to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS sick_leave_opening_balance DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS sick_leave_opening_date DATE;

COMMENT ON COLUMN public.users.sick_leave_opening_balance IS 'Opening balance for sick leave accrual';
COMMENT ON COLUMN public.users.sick_leave_opening_date IS 'The date from which sick leave accrual starts for this user';
