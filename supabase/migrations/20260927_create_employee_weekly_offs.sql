-- 20260927_create_employee_weekly_offs.sql
-- Create table to store employee weekly off assignments with row-level security
CREATE TABLE IF NOT EXISTS public.employee_weekly_offs (
  emp_code TEXT PRIMARY KEY,
  weekly_offs JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.employee_weekly_offs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'employee_weekly_offs' AND policyname = 'Allow public read on employee_weekly_offs') THEN
    CREATE POLICY "Allow public read on employee_weekly_offs" ON public.employee_weekly_offs FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'employee_weekly_offs' AND policyname = 'Allow public insert on employee_weekly_offs') THEN
    CREATE POLICY "Allow public insert on employee_weekly_offs" ON public.employee_weekly_offs FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'employee_weekly_offs' AND policyname = 'Allow public update on employee_weekly_offs') THEN
    CREATE POLICY "Allow public update on employee_weekly_offs" ON public.employee_weekly_offs FOR UPDATE USING (true);
  END IF;
END $$;
