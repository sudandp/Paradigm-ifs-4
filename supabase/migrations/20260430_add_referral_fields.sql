-- Complete Referral Module Schema Fix
-- This migration ensures both candidate_referrals and business_referrals tables 
-- exist and have all required columns as defined in the frontend types.

-- 1. Candidate Referrals Table
CREATE TABLE IF NOT EXISTS candidate_referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_name TEXT,
    referrer_mobile TEXT,
    referrer_role TEXT,
    candidate_name TEXT,
    candidate_mobile TEXT,
    candidate_role TEXT,
    referred_person_role TEXT,
    is_paradigm_employee BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'pending',
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all columns exist (in case table was created manually with partial columns)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='candidate_referrals' AND column_name='referrer_name') THEN
        ALTER TABLE candidate_referrals ADD COLUMN referrer_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='candidate_referrals' AND column_name='referrer_mobile') THEN
        ALTER TABLE candidate_referrals ADD COLUMN referrer_mobile TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='candidate_referrals' AND column_name='referrer_role') THEN
        ALTER TABLE candidate_referrals ADD COLUMN referrer_role TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='candidate_referrals' AND column_name='candidate_name') THEN
        ALTER TABLE candidate_referrals ADD COLUMN candidate_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='candidate_referrals' AND column_name='candidate_mobile') THEN
        ALTER TABLE candidate_referrals ADD COLUMN candidate_mobile TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='candidate_referrals' AND column_name='candidate_role') THEN
        ALTER TABLE candidate_referrals ADD COLUMN candidate_role TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='candidate_referrals' AND column_name='referred_person_role') THEN
        ALTER TABLE candidate_referrals ADD COLUMN referred_person_role TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='candidate_referrals' AND column_name='is_paradigm_employee') THEN
        ALTER TABLE candidate_referrals ADD COLUMN is_paradigm_employee BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='candidate_referrals' AND column_name='status') THEN
        ALTER TABLE candidate_referrals ADD COLUMN status TEXT DEFAULT 'pending';
    END IF;
END $$;

-- 2. Business Referrals Table
CREATE TABLE IF NOT EXISTS business_referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_name TEXT,
    referrer_mobile TEXT,
    referrer_role TEXT,
    site_and_designation TEXT,
    contact_person_name TEXT,
    contact_person_designation TEXT,
    client_email TEXT,
    client_phone TEXT,
    service_interested TEXT,
    community_name TEXT,
    community_nature TEXT,
    total_units INTEGER,
    is_paradigm_employee BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'pending',
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all columns exist for business_referrals
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='business_referrals' AND column_name='referrer_name') THEN
        ALTER TABLE business_referrals ADD COLUMN referrer_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='business_referrals' AND column_name='referrer_mobile') THEN
        ALTER TABLE business_referrals ADD COLUMN referrer_mobile TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='business_referrals' AND column_name='referrer_role') THEN
        ALTER TABLE business_referrals ADD COLUMN referrer_role TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='business_referrals' AND column_name='site_and_designation') THEN
        ALTER TABLE business_referrals ADD COLUMN site_and_designation TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='business_referrals' AND column_name='contact_person_name') THEN
        ALTER TABLE business_referrals ADD COLUMN contact_person_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='business_referrals' AND column_name='contact_person_designation') THEN
        ALTER TABLE business_referrals ADD COLUMN contact_person_designation TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='business_referrals' AND column_name='client_email') THEN
        ALTER TABLE business_referrals ADD COLUMN client_email TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='business_referrals' AND column_name='client_phone') THEN
        ALTER TABLE business_referrals ADD COLUMN client_phone TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='business_referrals' AND column_name='service_interested') THEN
        ALTER TABLE business_referrals ADD COLUMN service_interested TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='business_referrals' AND column_name='community_name') THEN
        ALTER TABLE business_referrals ADD COLUMN community_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='business_referrals' AND column_name='community_nature') THEN
        ALTER TABLE business_referrals ADD COLUMN community_nature TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='business_referrals' AND column_name='total_units') THEN
        ALTER TABLE business_referrals ADD COLUMN total_units INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='business_referrals' AND column_name='is_paradigm_employee') THEN
        ALTER TABLE business_referrals ADD COLUMN is_paradigm_employee BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='business_referrals' AND column_name='status') THEN
        ALTER TABLE business_referrals ADD COLUMN status TEXT DEFAULT 'pending';
    END IF;
END $$;

-- 3. Row Level Security (RLS)
ALTER TABLE candidate_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_referrals ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (public submissions)
CREATE POLICY "Enable insert for all users" ON candidate_referrals FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all users" ON business_referrals FOR INSERT WITH CHECK (true);

-- Allow authenticated users to view
CREATE POLICY "Enable select for authenticated users" ON candidate_referrals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable select for authenticated users" ON business_referrals FOR SELECT TO authenticated USING (true);

