-- Insert/Update entity record for Adarsha Palace so Site Configuration shows "Complete"
-- The Site Config page checks: entity.billingName OR entity.siteManagement.keyAccountManager

-- First, check if an entity already exists for this org
-- If so, update it. If not, insert a new one.

INSERT INTO entities (
  id,
  name,
  organization_id,
  location,
  registered_address,
  registration_type,
  gst_number,
  pan_number,
  email,
  e_shram_number,
  shop_and_establishment_code,
  billing_name,
  site_management,
  agreement_details,
  compliance_details,
  holiday_config,
  financial_linkage,
  asset_tracking,
  billing_controls
)
VALUES (
  gen_random_uuid()::text,
  'Adarsha Palace',
  'adarsha_palace_001',
  'Bangalore',
  '47TH CROSS, 5TH BLOCK, JAYANAGAR BANGALORE-560041',
  'Society',
  '29AAAAA1269L1ZM',
  '29AAAAA1269L',
  'apalace@paradigmfms.com',
  'NA',
  '',

  -- billingName (this is what makes it show "Complete")
  'ADARSH PALACE APARTMENTS OWNERS ASSOCIATION',

  -- siteManagement (keyAccountManager also triggers "Complete")
  '{
    "keyAccountManager": "Mr. Nakul Alvar",
    "kamEffectiveDate": null,
    "siteAreaSqFt": 230500,
    "projectType": "Apartment",
    "unitCount": 125
  }'::jsonb,

  -- agreementDetails
  '{
    "fromDate": "2022-06-01",
    "toDate": "2023-05-31",
    "renewalTriggerDays": 15,
    "minWageTriggerDays": null,
    "wordCopyUrl": null,
    "signedCopyUrl": null,
    "agreementDate": null,
    "addendum1Date": null,
    "addendum2Date": null,
    "versionTracking": []
  }'::jsonb,

  -- complianceDetails
  '{
    "form6Applicable": false,
    "form6ValidityFrom": null,
    "form6ValidityTo": null,
    "form6RenewalInterval": null,
    "form6DocumentUrl": null,
    "minWageRevisionApplicable": true,
    "minWageRevisionDocumentUrl": null,
    "minWageRevisionValidityFrom": null,
    "minWageRevisionValidityTo": null
  }'::jsonb,

  -- holidayConfig
  '{
    "numberOfDays": 12,
    "holidays": [
      {"date": "2026-01-26", "description": "Republic Day"},
      {"date": "2026-03-14", "description": "Holi"},
      {"date": "2026-04-14", "description": "Ambedkar Jayanti"},
      {"date": "2026-05-01", "description": "May Day"},
      {"date": "2026-08-15", "description": "Independence Day"},
      {"date": "2026-09-02", "description": "Ganesh Chaturthi"},
      {"date": "2026-10-02", "description": "Gandhi Jayanti"},
      {"date": "2026-10-20", "description": "Dussehra"},
      {"date": "2026-11-09", "description": "Diwali"},
      {"date": "2026-11-10", "description": "Diwali (Day 2)"},
      {"date": "2026-11-14", "description": "Childrens Day"},
      {"date": "2026-12-25", "description": "Christmas"}
    ],
    "salaryRule": "Full",
    "billingRule": "Full"
  }'::jsonb,

  -- financialLinkage
  '{
    "costingSheetUrl": "Link to costing database - Adarsha Palace Site Data",
    "effectiveDate": null,
    "version": null
  }'::jsonb,

  -- assetTracking (Tools, SIMs)
  '{
    "tools": [
      {"name": "Broom Set", "brand": "Local", "size": "", "quantity": 5, "issueDate": "2026-01-15"},
      {"name": "Mop Stick", "brand": "Scotch Brite", "size": "Standard", "quantity": 10, "issueDate": "2026-01-15"},
      {"name": "Dustpan", "brand": "Local", "size": "Large", "quantity": 5, "issueDate": "2026-01-15"},
      {"name": "Garden Shears", "brand": "Falcon", "size": "8 inch", "quantity": 3, "issueDate": "2026-01-15"},
      {"name": "Plumbing Wrench Set", "brand": "Stanley", "size": "Mixed", "quantity": 1, "issueDate": "2026-01-15"}
    ],
    "dcCopy1Url": null,
    "dcCopy2Url": null,
    "sims": {
      "count": 3,
      "details": [
        {"number": "1", "phone": "9008293636"},
        {"number": "2", "phone": "6366227537"},
        {"number": "3", "phone": "6366892236"}
      ]
    },
    "equipment": []
  }'::jsonb,

  -- billingControls
  '{
    "billingCycleStart": "General",
    "salaryDate": null,
    "uniformDeductions": true,
    "deductionCategory": null
  }'::jsonb
)
ON CONFLICT (organization_id) DO UPDATE SET
  billing_name = EXCLUDED.billing_name,
  site_management = EXCLUDED.site_management,
  agreement_details = EXCLUDED.agreement_details,
  compliance_details = EXCLUDED.compliance_details,
  holiday_config = EXCLUDED.holiday_config,
  financial_linkage = EXCLUDED.financial_linkage,
  asset_tracking = EXCLUDED.asset_tracking,
  billing_controls = EXCLUDED.billing_controls,
  location = EXCLUDED.location,
  registered_address = EXCLUDED.registered_address,
  gst_number = EXCLUDED.gst_number,
  pan_number = EXCLUDED.pan_number,
  email = EXCLUDED.email;

-- Verify
SELECT id, name, organization_id, billing_name, 
  site_management->>'keyAccountManager' as kam
FROM entities 
WHERE organization_id = 'adarsha_palace_001';
