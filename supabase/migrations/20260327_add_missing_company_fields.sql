-- Add Missing Company Fields for CIN, DIN, TIN, and Udyog
ALTER TABLE "public"."companies"
ADD COLUMN IF NOT EXISTS "gst_doc_url" text,
ADD COLUMN IF NOT EXISTS "pan_doc_url" text,
ADD COLUMN IF NOT EXISTS "cin_number" text,
ADD COLUMN IF NOT EXISTS "cin_doc_url" text,
ADD COLUMN IF NOT EXISTS "din_number" text,
ADD COLUMN IF NOT EXISTS "din_doc_url" text,
ADD COLUMN IF NOT EXISTS "tin_number" text,
ADD COLUMN IF NOT EXISTS "tin_doc_url" text,
ADD COLUMN IF NOT EXISTS "udyog_number" text,
ADD COLUMN IF NOT EXISTS "udyog_doc_url" text,
ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'completed';

ALTER TABLE "public"."entities"
ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'completed',
ADD COLUMN IF NOT EXISTS "cin_number" text,
ADD COLUMN IF NOT EXISTS "cin_doc_url" text,
ADD COLUMN IF NOT EXISTS "din_number" text,
ADD COLUMN IF NOT EXISTS "din_doc_url" text,
ADD COLUMN IF NOT EXISTS "tin_number" text,
ADD COLUMN IF NOT EXISTS "tin_doc_url" text,
ADD COLUMN IF NOT EXISTS "udyog_number" text,
ADD COLUMN IF NOT EXISTS "udyog_doc_url" text,
ADD COLUMN IF NOT EXISTS "gst_doc_url" text,
ADD COLUMN IF NOT EXISTS "pan_doc_url" text,
ADD COLUMN IF NOT EXISTS "epfo_doc_url" text,
ADD COLUMN IF NOT EXISTS "esic_doc_url" text,
ADD COLUMN IF NOT EXISTS "e_shram_doc_url" text,
ADD COLUMN IF NOT EXISTS "compliance_documents" jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS "compliance_codes" jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS "insurances" jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS "policies" jsonb DEFAULT '[]'::jsonb;
