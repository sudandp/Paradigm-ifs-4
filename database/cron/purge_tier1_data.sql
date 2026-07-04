-- DPDP Tier 1 "Purpose Served" Purge Trigger
-- This function runs periodically (via pg_cron or Supabase triggers) to scrub PII data.
-- Under DPDP Act 2023, Tier 1 sensitive data must be purged once the employee is deboarded and the retention period (e.g., 7 years for financial data, but 30 days for temporary onboarding artifacts) is met.

CREATE OR REPLACE FUNCTION purge_dpdp_tier1_data()
RETURNS void AS $$
BEGIN
    -- 1. Purge raw identity documents (Aadhaar, PAN scans) for rejected candidates older than 30 days
    UPDATE onboarding_data
    SET 
        "idProofFront" = NULL,
        "idProofBack" = NULL,
        "panCard" = NULL,
        "photo" = NULL,
        "bankProof" = NULL
    WHERE 
        status = 'rejected' 
        AND updated_at < NOW() - INTERVAL '30 days';

    -- 2. Soft-delete or mask PII for deboarded employees past the legal retention requirement
    -- Assuming 'deboarded' status and a custom retention field logic (simplified here as 7 years)
    UPDATE onboarding_data
    SET 
        "employeeName" = 'REDACTED_' || LEFT(id::text, 8),
        "employeeMobile" = NULL,
        "emergencyContactNumber" = NULL,
        "emergencyContactName" = NULL
    WHERE 
        status = 'deboarded' 
        AND updated_at < NOW() - INTERVAL '7 years';
        
    -- Note: Legal sign-off is required to finalize exact intervals ('30 days', '7 years') based on specific facility management contracts.
    
    RAISE NOTICE 'DPDP Tier 1 Data Purge executed successfully.';
END;
$$ LANGUAGE plpgsql;

-- Example pg_cron schedule (Run daily at midnight)
-- SELECT cron.schedule('dpdp_purge_job', '0 0 * * *', 'SELECT purge_dpdp_tier1_data()');
