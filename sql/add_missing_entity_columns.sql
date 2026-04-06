-- Add missing columns to entities table to support statutory documents and E-Shram
-- This script is idempotent and safe to run multiple times.

DO $$ 
BEGIN
    -- 1. Add e_shram_number if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'entities' AND column_name = 'e_shram_number') THEN
        ALTER TABLE public.entities ADD COLUMN e_shram_number text;
    END IF;

    -- 2. Ensure all other document URL columns exist (Verification)
    -- cin_number, cin_doc_url, din_number, din_doc_url, tin_number, tin_doc_url, udyog_number, udyog_doc_url, epfo_doc_url, esic_doc_url, e_shram_doc_url
    -- These were found in the earlier check, but adding IF NOT EXISTS logic for completeness.

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE tablename = 'entities' AND column_name = 'cin_number') THEN
        ALTER TABLE public.entities ADD COLUMN cin_number text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE tablename = 'entities' AND column_name = 'cin_doc_url') THEN
        ALTER TABLE public.entities ADD COLUMN cin_doc_url text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE tablename = 'entities' AND column_name = 'din_number') THEN
        ALTER TABLE public.entities ADD COLUMN din_number text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE tablename = 'entities' AND column_name = 'din_doc_url') THEN
        ALTER TABLE public.entities ADD COLUMN din_doc_url text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE tablename = 'entities' AND column_name = 'tin_number') THEN
        ALTER TABLE public.entities ADD COLUMN tin_number text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE tablename = 'entities' AND column_name = 'tin_doc_url') THEN
        ALTER TABLE public.entities ADD COLUMN tin_doc_url text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE tablename = 'entities' AND column_name = 'udyog_number') THEN
        ALTER TABLE public.entities ADD COLUMN udyog_number text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE tablename = 'entities' AND column_name = 'udyog_doc_url') THEN
        ALTER TABLE public.entities ADD COLUMN udyog_doc_url text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE tablename = 'entities' AND column_name = 'epfo_doc_url') THEN
        ALTER TABLE public.entities ADD COLUMN epfo_doc_url text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE tablename = 'entities' AND column_name = 'esic_doc_url') THEN
        ALTER TABLE public.entities ADD COLUMN esic_doc_url text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE tablename = 'entities' AND column_name = 'e_shram_doc_url') THEN
        ALTER TABLE public.entities ADD COLUMN e_shram_doc_url text;
    END IF;

END $$;
