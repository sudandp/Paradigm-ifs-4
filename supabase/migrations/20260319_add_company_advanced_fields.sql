-- Add Advanced Company Profile Fields

ALTER TABLE "public"."companies"
ADD COLUMN IF NOT EXISTS "registration_type" text,
ADD COLUMN IF NOT EXISTS "registration_number" text,
ADD COLUMN IF NOT EXISTS "gst_number" text,
ADD COLUMN IF NOT EXISTS "pan_number" text,
ADD COLUMN IF NOT EXISTS "emails" jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS "compliance_codes" jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS "compliance_documents" jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS "holidays" jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS "insurances" jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS "policies" jsonb DEFAULT '[]'::jsonb;
