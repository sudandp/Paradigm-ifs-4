-- Add Advanced Entity (Society) Profile Fields

ALTER TABLE "public"."entities"
ADD COLUMN IF NOT EXISTS "site_takeover_date" date,
ADD COLUMN IF NOT EXISTS "billing_name" text,
ADD COLUMN IF NOT EXISTS "emails" jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS "site_management" jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS "agreement_details" jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS "compliance_details" jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS "holiday_config" jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS "financial_linkage" jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS "asset_tracking" jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS "billing_controls" jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS "verification_data" jsonb DEFAULT '{}'::jsonb;
