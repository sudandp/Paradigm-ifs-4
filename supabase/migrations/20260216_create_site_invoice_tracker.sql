-- Migration: Create Site Invoice Tracker Table
-- Description: End-to-end tracking for site attendance and invoicing status.

CREATE TABLE IF NOT EXISTS public.site_invoice_tracker (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    s_no SERIAL,
    site_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    site_name TEXT NOT NULL,
    company_name TEXT, -- e.g., 'IFS', 'IBM'
    billing_cycle TEXT,
    ops_remarks TEXT,
    hr_remarks TEXT,
    finance_remarks TEXT,
    ops_incharge TEXT,
    hr_incharge TEXT,
    invoice_incharge TEXT,
    
    -- Attendance Status of Managers
    manager_tentative_date DATE,
    manager_received_date DATE,
    
    -- Attendance Status of HR
    hr_tentative_date DATE,
    hr_received_date DATE,
    attendance_received_time TEXT,
    
    -- Invoice Status
    invoice_sharing_tentative_date DATE,
    invoice_prepared_date DATE,
    invoice_sent_date DATE,
    invoice_sent_time TEXT,
    invoice_sent_method_remarks TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.site_invoice_tracker ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated full access to site_invoice_tracker"
ON public.site_invoice_tracker
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.site_invoice_tracker;
