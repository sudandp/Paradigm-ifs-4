-- Insert dummy site configuration data (Adarsha Palace) for testing
-- This matches the Site Configuration Excel data provided
-- Uses the same organization_id as the costing data

-- First, ensure we have the organization in the organizations table
INSERT INTO organizations (id, short_name, full_name, address)
VALUES (
  'adarsha_palace_001',
  'Adarsha Palace',
  'ADARSH PALACE APARTMENTS OWNERS ASSOCIATION',
  '47TH CROSS, 5TH BLOCK, JAYANAGAR BANGALORE-560041'
)
ON CONFLICT (id) DO UPDATE SET
  short_name = EXCLUDED.short_name,
  full_name = EXCLUDED.full_name,
  address = EXCLUDED.address;

-- Insert the site configuration
INSERT INTO site_configurations (organization_id, config_data)
VALUES (
  'adarsha_palace_001',
  '{
    "organizationId": "adarsha_palace_001",
    "entityId": "",
    "location": "Bangalore",
    "billingName": "ADARSH PALACE APARTMENTS OWNERS ASSOCIATION",
    "registeredAddress": "47TH CROSS, 5TH BLOCK, JAYANAGAR BANGALORE-560041",
    "gstNumber": "29AAAAA1269L1ZM",
    "panNumber": "29AAAAA1269L",
    "email1": "apalace@paradigmfms.com",
    "email2": "nakulalvar@paradigmfms.com",
    "email3": "Management@paradigmfms.com & accounts@paradigmfms.com",
    "eShramNumber": "NA",
    "shopAndEstablishmentCode": "",
    "keyAccountManager": "Mr. Nakul Alvar",
    "siteAreaSqFt": 230500,
    "projectType": "Apartment",
    "apartmentCount": 125,
    "agreementDetails": {
      "fromDate": "2022-06-01",
      "toDate": "2023-05-31",
      "renewalIntervalDays": 15,
      "softCopy": null,
      "scannedCopy": null,
      "agreementDate": null,
      "addendum1Date": null,
      "addendum2Date": null
    },
    "siteOperations": {
      "form6Applicable": false,
      "form6RenewalTaskCreation": false,
      "form6ValidityFrom": null,
      "form6ValidityTo": null,
      "form6Document": null,

      "minWageRevisionApplicable": true,
      "minWageRevisionTaskCreation": false,
      "minWageRevisionValidityFrom": null,
      "minWageRevisionValidityTo": null,
      "minWageRevisionDocument": null,

      "holidays": {
        "numberOfDays": 12,
        "list": [
          {"date": "2026-01-26", "name": "Republic Day"},
          {"date": "2026-03-14", "name": "Holi"},
          {"date": "2026-04-14", "name": "Ambedkar Jayanti"},
          {"date": "2026-05-01", "name": "May Day"},
          {"date": "2026-08-15", "name": "Independence Day"},
          {"date": "2026-09-02", "name": "Ganesh Chaturthi"},
          {"date": "2026-10-02", "name": "Gandhi Jayanti"},
          {"date": "2026-10-20", "name": "Dussehra"},
          {"date": "2026-11-09", "name": "Diwali"},
          {"date": "2026-11-10", "name": "Diwali (Day 2)"},
          {"date": "2026-11-14", "name": "Children''s Day"},
          {"date": "2026-12-25", "name": "Christmas"}
        ],
        "salaryPayment": "Full Payment",
        "billing": "Full Payment"
      },

      "costingSheetLink": "Link to costing database - Adarsha Palace Site Data attached",

      "tools": {
        "dcCopy1": null,
        "dcCopy2": null,
        "list": [
          {"name": "Broom Set", "brand": "Local", "size": "", "quantity": 5, "issueDate": "2026-01-15", "picture": null},
          {"name": "Mop Stick", "brand": "Scotch Brite", "size": "Standard", "quantity": 10, "issueDate": "2026-01-15", "picture": null},
          {"name": "Dustpan", "brand": "Local", "size": "Large", "quantity": 5, "issueDate": "2026-01-15", "picture": null},
          {"name": "Garden Shears", "brand": "Falcon", "size": "8 inch", "quantity": 3, "issueDate": "2026-01-15", "picture": null},
          {"name": "Plumbing Wrench Set", "brand": "Stanley", "size": "Mixed", "quantity": 1, "issueDate": "2026-01-15", "picture": null}
        ]
      },

      "sims": {
        "issuedCount": 2,
        "details": [
          {"number": "9008293636", "assignedTo": "FM - Facility Manager"},
          {"number": "6366227537", "assignedTo": "Plumber"},
          {"number": "6366892236", "assignedTo": "Electrician"}
        ]
      },

      "equipment": {
        "issued": [],
        "intermittent": {
          "billing": "To Be Billed",
          "frequency": "Monthly",
          "taskCreation": true,
          "durationDays": 30
        }
      },

      "billingCycleFrom": "General",
      "uniformDeductions": true
    }
  }'::jsonb
)
ON CONFLICT (organization_id) DO UPDATE SET
  config_data = EXCLUDED.config_data;

-- Also update the costing data to use this organization
UPDATE site_costing_master
SET site_id = 'adarsha_palace_001'
WHERE site_id = (SELECT id FROM organizations ORDER BY created_at LIMIT 1)
  AND site_id != 'adarsha_palace_001';

-- If the costing insert hasn't run yet, insert it now with the correct site_id
INSERT INTO site_costing_master (id, site_id, status, version_no, config_data, created_at, updated_at)
SELECT
  gen_random_uuid()::text,
  'adarsha_palace_001',
  'Draft',
  1,
  '{
    "effective_from": "2026-03-20",
    "effective_to": "2027-03-19",
    "billing_cycle": "Monthly",
    "admin_charge_percent": 10,
    "resources": [
      {"id":"res_001","department":"Administrative","designation":"Facility Manager","cost_centre":"","unit_type":"Manpower","quantity":1,"billing_rate":56000,"billing_model":"Per Month","total":56000,"working_hours_start":"09:00","working_hours_end":"18:00","shift_type":"General","shifts":[{"name":"General","start_time":"09:00","end_time":"18:00"}],"open_shift_allowed":false,"weekly_off_applicable":true,"weekly_off_type":"Sunday","leave_applicable":true,"earned_leave_count":38,"sick_leave_count":null,"holiday_billing_rule":"Billable if Availed Holiday, if worked on Holiday the additional duty to be carry forwarded","holiday_payment_rule":"Payable if availed Holiday, if worked on Holiday the additional duty to be carry forwarded","duty_rule":"","uniform_deduction":false,"uniform_deduction_note":"During PNF, based on no of months worked","employment_verification":true,"background_verification":true,"police_verification":true},
      {"id":"res_002","department":"Housekeeping","designation":"Housekeeper/Janitor Heavy Works (Male)","cost_centre":"","unit_type":"Manpower","quantity":1,"billing_rate":16418,"billing_model":"Per Month","total":16418,"working_hours_start":"08:30","working_hours_end":"17:30","shift_type":"General","shifts":[],"open_shift_allowed":false,"weekly_off_applicable":false,"weekly_off_type":"","leave_applicable":false,"earned_leave_count":null,"sick_leave_count":null,"holiday_billing_rule":"Work for 2-3 hrs max 4 hrs, claim 1 duty - if not worked 0 duty","holiday_payment_rule":"Work for 2-3 hrs max 4 hrs, Pay 1 duty - if not worked 0 duty","duty_rule":"Work for 2-3 hrs max 4 hrs, claim 1 duty","uniform_deduction":false,"uniform_deduction_note":"","employment_verification":true,"background_verification":false,"police_verification":true},
      {"id":"res_003","department":"Housekeeping","designation":"Housekeeper/Janitor (Female)","cost_centre":"","unit_type":"Manpower","quantity":6,"billing_rate":16418,"billing_model":"Per Month","total":98508,"working_hours_start":"08:30","working_hours_end":"17:30","shift_type":"General","shifts":[],"open_shift_allowed":false,"weekly_off_applicable":false,"weekly_off_type":"","leave_applicable":false,"earned_leave_count":null,"sick_leave_count":null,"holiday_billing_rule":"Work for 2-3 hrs max 4 hrs, claim 1 duty","holiday_payment_rule":"Work for 2-3 hrs max 4 hrs, Pay 1 duty","duty_rule":"Work for 2-3 hrs max 4 hrs, claim 1 duty","uniform_deduction":true,"uniform_deduction_note":"","employment_verification":true,"background_verification":false,"police_verification":true},
      {"id":"res_004","department":"Gardening","designation":"Gardener","cost_centre":"","unit_type":"Manpower","quantity":3,"billing_rate":18708,"billing_model":"Per Month","total":56124,"working_hours_start":"08:30","working_hours_end":"17:30","shift_type":"General","shifts":[],"open_shift_allowed":false,"weekly_off_applicable":false,"weekly_off_type":"","leave_applicable":false,"earned_leave_count":null,"sick_leave_count":null,"holiday_billing_rule":"Work for 2-3 hrs max 4 hrs, claim 1 duty","holiday_payment_rule":"Work for 2-3 hrs max 4 hrs, Pay 1 duty","duty_rule":"Work for 2-3 hrs max 4 hrs, claim 1 duty","uniform_deduction":true,"uniform_deduction_note":"","employment_verification":true,"background_verification":false,"police_verification":true},
      {"id":"res_005","department":"Plumbing","designation":"Plumber Cum Pool Operator","cost_centre":"","unit_type":"Manpower","quantity":1,"billing_rate":29390,"billing_model":"Per Month","total":29390,"working_hours_start":"09:00","working_hours_end":"18:00","shift_type":"General","shifts":[],"open_shift_allowed":false,"weekly_off_applicable":false,"weekly_off_type":"","leave_applicable":false,"earned_leave_count":null,"sick_leave_count":null,"holiday_billing_rule":"Work for full day and claim OT, double duty - if not worked 1 holiday duty","holiday_payment_rule":"Work for full day and Pay OT, double duty - if not worked 1 holiday duty be paid","duty_rule":"","uniform_deduction":false,"uniform_deduction_note":"","employment_verification":false,"background_verification":false,"police_verification":true},
      {"id":"res_006","department":"Electrical","designation":"Lead Electrician","cost_centre":"","unit_type":"Manpower","quantity":1,"billing_rate":24226,"billing_model":"Per Month","total":24226,"working_hours_start":"07:00","working_hours_end":"14:00","shift_type":"1st Shift","shifts":[{"name":"1st Shift","start_time":"07:00","end_time":"14:00"},{"name":"2nd Shift","start_time":"14:00","end_time":"22:00"},{"name":"3rd Shift","start_time":"22:00","end_time":"07:00"}],"open_shift_allowed":false,"weekly_off_applicable":false,"weekly_off_type":"","leave_applicable":false,"earned_leave_count":null,"sick_leave_count":null,"holiday_billing_rule":"Work for full day, double duty - if not worked 1 holiday duty","holiday_payment_rule":"Work for full day, Pay OT double duty - if not worked 1 holiday duty be paid","duty_rule":"","uniform_deduction":false,"uniform_deduction_note":"","employment_verification":false,"background_verification":true,"police_verification":true},
      {"id":"res_007","department":"Electrical","designation":"Lead Electrician","cost_centre":"","unit_type":"Manpower","quantity":1,"billing_rate":24226,"billing_model":"Per Month","total":24226,"working_hours_start":"14:00","working_hours_end":"22:00","shift_type":"2nd Shift","shifts":[{"name":"1st Shift","start_time":"07:00","end_time":"14:00"},{"name":"2nd Shift","start_time":"14:00","end_time":"22:00"},{"name":"3rd Shift","start_time":"22:00","end_time":"07:00"}],"open_shift_allowed":false,"weekly_off_applicable":false,"weekly_off_type":"","leave_applicable":false,"earned_leave_count":null,"sick_leave_count":null,"holiday_billing_rule":"Work for full day, double duty - if not worked 1 holiday duty","holiday_payment_rule":"Work for full day, Pay OT double duty - if not worked 1 holiday duty be paid","duty_rule":"","uniform_deduction":false,"uniform_deduction_note":"","employment_verification":false,"background_verification":true,"police_verification":true},
      {"id":"res_008","department":"Electrical","designation":"Multi Technician","cost_centre":"","unit_type":"Manpower","quantity":1,"billing_rate":27324,"billing_model":"Per Month","total":27324,"working_hours_start":"22:00","working_hours_end":"07:00","shift_type":"3rd Shift","shifts":[{"name":"1st Shift","start_time":"07:00","end_time":"14:00"},{"name":"2nd Shift","start_time":"14:00","end_time":"22:00"},{"name":"3rd Shift","start_time":"22:00","end_time":"07:00"}],"open_shift_allowed":false,"weekly_off_applicable":false,"weekly_off_type":"","leave_applicable":false,"earned_leave_count":null,"sick_leave_count":null,"holiday_billing_rule":"Work for full day, double duty - if not worked 1 holiday duty","holiday_payment_rule":"Work for full day, Pay OT double duty - if not worked 1 holiday duty be paid","duty_rule":"","uniform_deduction":false,"uniform_deduction_note":"","employment_verification":false,"background_verification":true,"police_verification":true},
      {"id":"res_009","department":"Electrical","designation":"Reliever Charges For MEP Staff","cost_centre":"","unit_type":"Lumpsum","quantity":null,"billing_rate":17528,"billing_model":"Lumpsum","total":17528,"working_hours_start":"","working_hours_end":"","shift_type":"General","shifts":[],"open_shift_allowed":false,"weekly_off_applicable":false,"weekly_off_type":"","leave_applicable":false,"earned_leave_count":null,"sick_leave_count":null,"holiday_billing_rule":"","holiday_payment_rule":"","duty_rule":"","uniform_deduction":false,"uniform_deduction_note":"","employment_verification":false,"background_verification":false,"police_verification":false}
    ],
    "additional_charges": [
      {"id":"chg_001","charge_name":"Communication Charges","charge_type":"Fixed","amount":1200,"frequency":"3"}
    ]
  }'::jsonb,
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM site_costing_master WHERE site_id = 'adarsha_palace_001'
);

-- Verify results
SELECT 'Organizations' as table_name, count(*) as rows FROM organizations WHERE id = 'adarsha_palace_001'
UNION ALL
SELECT 'Site Configurations', count(*) FROM site_configurations WHERE organization_id = 'adarsha_palace_001'
UNION ALL
SELECT 'Site Costing Master', count(*) FROM site_costing_master WHERE site_id = 'adarsha_palace_001';
