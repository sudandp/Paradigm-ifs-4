-- Step 1: Find the entity that IS in the group hierarchy (the one the UI actually uses)
-- This is the one with a company_id set

SELECT e.id, e.name, e.organization_id, e.company_id, e.billing_name, e.location
FROM entities e
WHERE e.name ILIKE '%adarsh%'
ORDER BY e.company_id IS NOT NULL DESC;

-- Step 2: Update ALL Adarsha Palace entities with the dummy data
-- This will fill whichever entity the form loads

UPDATE entities
SET
  billing_name = 'ADARSH PALACE APARTMENTS OWNERS ASSOCIATION',
  location = 'Bangalore',
  registered_address = '47TH CROSS, 5TH BLOCK, JAYANAGAR BANGALORE-560041',
  gst_number = '29AAAAA1269L1ZM',
  pan_number = '29AAAAA1269L',
  email = 'apalace@paradigmfms.com',
  e_shram_number = 'NA',
  registration_type = 'Society',
  site_management = '{
    "keyAccountManager": "Mr. Nakul Alvar",
    "siteAreaSqFt": 230500,
    "projectType": "Apartment",
    "unitCount": 125
  }'::jsonb,
  agreement_details = '{
    "fromDate": "2022-06-01",
    "toDate": "2023-05-31",
    "renewalTriggerDays": 15
  }'::jsonb,
  compliance_details = '{
    "form6Applicable": false,
    "minWageRevisionApplicable": true
  }'::jsonb,
  holiday_config = '{
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
  asset_tracking = '{
    "tools": [
      {"name": "Broom Set", "brand": "Local", "size": "", "quantity": 5, "issueDate": "2026-01-15"},
      {"name": "Mop Stick", "brand": "Scotch Brite", "size": "Standard", "quantity": 10, "issueDate": "2026-01-15"},
      {"name": "Dustpan", "brand": "Local", "size": "Large", "quantity": 5, "issueDate": "2026-01-15"},
      {"name": "Garden Shears", "brand": "Falcon", "size": "8 inch", "quantity": 3, "issueDate": "2026-01-15"},
      {"name": "Plumbing Wrench Set", "brand": "Stanley", "size": "Mixed", "quantity": 1, "issueDate": "2026-01-15"}
    ],
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
  billing_controls = '{
    "billingCycleStart": "General",
    "uniformDeductions": true
  }'::jsonb
WHERE name ILIKE '%adarsh%';

-- Step 3: Verify
SELECT id, name, organization_id, company_id, billing_name, location,
  site_management->>'keyAccountManager' as kam
FROM entities WHERE name ILIKE '%adarsh%';
