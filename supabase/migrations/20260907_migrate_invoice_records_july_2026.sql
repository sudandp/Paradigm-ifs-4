-- ==========================================================================
-- MIGRATION DATA SQL: Invoice Monthly Update Report for July 2026
-- Source: C:\Users\sudhan\Downloads\bulk Monthly Invoice Reprt for July 2026.xlsx
-- Generated At: 2026-09-07 11:43:30
-- Attendance Tracker records: 95
-- Monthly Finance Tracker records: 95
-- ==========================================================================

BEGIN;

-- --------------------------------------------------------------------------
-- 1. Insert/Upsert into public.site_invoice_tracker (Attendance Tracker Tab)
-- --------------------------------------------------------------------------

INSERT INTO public.site_invoice_tracker (
    site_name, company_name, billing_cycle,
    ops_incharge, hr_incharge, invoice_incharge,
    manager_tentative_date, manager_received_date,
    hr_tentative_date, hr_received_date, attendance_received_time,
    invoice_sharing_tentative_date, invoice_prepared_date,
    invoice_sent_date, invoice_sent_time, invoice_sent_method_remarks,
    created_by, created_by_name, created_by_role, created_at, updated_at
)
SELECT 
    v.site_name, v.company_name, v.billing_cycle,
    v.ops_incharge, v.hr_incharge, v.invoice_incharge,
    v.manager_tentative_date, v.manager_received_date,
    v.hr_tentative_date, v.hr_received_date, v.attendance_received_time,
    v.invoice_sharing_tentative_date, v.invoice_prepared_date,
    v.invoice_sent_date, v.invoice_sent_time, v.invoice_sent_method_remarks,
    v.created_by, v.created_by_name, v.created_by_role, v.created_at, v.created_at
FROM (
  VALUES
    ('42 Estate Queens'::text, 'PIFS'::text, '3rd Billing Cycle'::text, 'Sandeep'::text, 'Chandana'::text, 'Arpitha'::text, '2026-07-31'::date, '2026-08-05'::date, '2026-08-03'::date, '2026-08-07'::date, '10:17'::text, '2026-08-05'::date, '2026-08-08'::date, '2026-08-08'::date, '12:24'::text, 'Sent'::text, '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27'::uuid, 'Arpitha Nairy'::text, 'finance'::text, '2026-08-15 12:00:00+00'::timestamptz),
    ('42 Estate Queens(PPFMS)', 'PPFMS', '3rd Billing Cycle', 'Sandeep', 'Chandana', 'Arpitha', '2026-07-31', '2026-08-05', '2026-08-03', '2026-08-07', '10:17', '2026-08-05', '2026-08-08', '2026-08-08', '12:24', 'Sent', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Aeries', 'PIFS', '3rd Billing Cycle', 'Shilpa', 'Chandana', 'Sinchana', '2026-07-31', '2026-08-04', '2026-08-03', '2026-08-04', '17:44', '2026-08-05', '2026-08-05', '2026-08-05', '17:41', 'Sent', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Ahad', 'PIFS', '2nd Billing Cycle', 'Isaac', 'Chandana', 'Sinchana', '2026-07-25', '2026-08-05', '2026-07-31', '2026-08-08', '13:36', '2026-08-03', '2026-08-08', '2026-08-08', '18:32', 'Sent', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Alanoville', 'PIFS', '3rd Billing Cycle', 'Venkat', 'Chandana', 'Arpitha', '2026-07-31', '2026-08-07', '2026-08-03', '2026-08-08', '15:45', '2026-08-05', '2026-08-19', '2026-08-19', '11:26', 'Sent', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Artisane Forest Breeze', 'PIFS', '3rd Billing Cycle', 'Sandeep', 'Pooja', 'Arpitha', '2026-07-31', '2026-08-07', '2026-08-03', '2026-08-08', '16:49', '2026-08-05', '2026-08-10', '2026-08-10', '15:42', 'Sent', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Assetz Soul and Soil', 'PIFS', '3rd Billing Cycle', 'Venkat', 'Pooja', 'Arpitha', '2026-07-31', '2026-08-06', '2026-08-03', '2026-08-08', '16:49', '2026-08-05', '2026-08-27', '2026-08-27', '12:54', 'Sent', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Aratt Milano', 'PIFS', '3rd Billing Cycle', 'Isaac', 'Chandana', 'Arpitha', '2026-07-31', '2026-08-06', '2026-08-03', '2026-08-07', '17:06', '2026-08-05', '2026-08-08', '2026-08-08', '13:51', 'Sent', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Aratt Milano(PPFMS)', 'PPFMS', '3rd Billing Cycle', 'Isaac', 'Chandana', 'Arpitha', '2026-07-31', '2026-08-06', '2026-08-03', '2026-08-07', '17:06', '2026-08-05', '2026-08-08', '2026-08-08', '13:51', 'Sent', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Brigade Bricklane', 'PIFS', '3rd Billing Cycle', 'Venkat', 'Pooja', 'Arpitha', '2026-07-31', '2026-08-08', '2026-08-03', '2026-08-10', '13:22', '2026-08-05', '2026-08-10', '2026-08-10', '15:45', 'Sent', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Brigade Jacaranda', 'PIFS', '3rd Billing Cycle', 'Isaac', 'Pooja', 'Sinchana', '2026-07-31', '2026-08-07', '2026-08-03', '2026-08-10', '17:04', '2026-08-05', '2026-08-11', '2026-08-11', '14:15', 'Sent', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Brigade Laburnum', 'PIFS', '3rd Billing Cycle', 'Isaac', 'Pooja', 'Sinchana', '2026-07-31', '2026-08-07', '2026-08-03', '2026-08-08', '16:49', '2026-08-05', '2026-08-10', '2026-08-10', '18:24', 'Sent', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Brigade Omega', 'PIFS', '2nd Billing Cycle', 'Sandeep', 'Pooja', 'Arpitha', '2026-07-25', '2026-07-28', '2026-07-31', '2026-07-30', '18:02', '2026-08-03', '2026-07-31', '2026-07-31', '13:20', 'Sent', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Chanel India', 'PIFS', '3rd Billing Cycle', 'Venkat', 'Chandana', 'Sinchana', '2026-07-31', '2026-08-05', '2026-08-03', '2026-08-07', '10:17', '2026-08-05', '2026-08-07', '2026-08-07', '14:06', 'Sent', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('DSR Eden Greens', 'PIFS', '3rd Billing Cycle', 'Sandeep', 'Pooja', 'Sinchana', '2026-07-31', '2026-08-05', '2026-08-03', '2026-08-05', '13:41', '2026-08-05', '2026-08-05', '2026-08-05', '17:00', 'Sent', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('DSR Woodwinds', 'PIFS', '3rd Billing Cycle', 'Sandeep', 'Chandana', 'Sinchana', '2026-07-31', '2026-08-02', '2026-08-03', '2026-08-04', '17:44', '2026-08-05', '2026-08-05', '2026-08-05', '17:47', 'Sent', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Elan Homes', 'PIFS', '3rd Billing Cycle', 'Venkat', 'Chandana', 'Arpitha', '2026-07-31', '2026-08-06', '2026-08-03', '2026-08-07', '17:06', '2026-08-05', '2026-08-14', '2026-08-14', '15:54', 'Sent', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Elita', 'PIFS', '3rd Billing Cycle', 'Shilpa', 'Chandana', 'Sinchana', '2026-07-31', '2026-08-05', '2026-08-03', '2026-08-06', '12:00', '2026-08-05', '2026-08-18', '2026-08-18', '14:07', 'Sent', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('FICO', 'PIFS', '3rd Billing Cycle', 'Kannaiah', 'Chandana', 'Arpitha', '2026-07-31', '2026-08-05', '2026-08-03', '2026-08-05', '14:53', '2026-08-05', '2026-08-06', '2026-08-06', '18:22', 'Sent', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('GR Sankalpa', 'PIFS', '3rd Billing Cycle', 'Venkat', 'Chandana', 'Sinchana', '2026-07-31', '2026-08-06', '2026-08-03', '2026-08-08', '15:41', '2026-08-05', '2026-08-08', '2026-08-08', '18:37', 'Sent', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Greenwood', 'PIFS', '3rd Billing Cycle', 'Shilpa', 'Chandana', 'Sinchana', '2026-07-31', '2026-08-04', '2026-08-03', '2026-08-04', '17:44', '2026-08-05', '2026-08-05', '2026-08-05', '17:44', 'Sent', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('GRGR', 'PIFS', '3rd Billing Cycle', 'Stany', 'Chandana', 'Sinchana', '2026-07-31', '2026-08-04', '2026-08-03', '2026-08-04', '17:44', '2026-08-05', '2026-08-05', '2026-08-05', '17:36', 'Sent', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Habitat Eden Heights', 'PIFS', '3rd Billing Cycle', 'Venkat', 'Pooja', 'Sinchana', '2026-07-31', '2026-08-01', '2026-08-03', '2026-08-06', '15:38', '2026-08-05', '2026-08-06', '2026-08-06', '17:18', 'Sent', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('ICON', 'PIFS', '3rd Billing Cycle', 'Isaac', 'Pooja', 'Sinchana', '2026-07-31', '2026-08-07', '2026-08-03', '2026-08-07', '11:28', '2026-08-05', '2026-08-08', '2026-08-08', '18:35', 'Sent', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Janhavi Shelter', 'PIFS', '1st Billing Cycle', 'Sandeep', 'Chandana', 'Sinchana', '2026-07-20', '2026-07-25', '2026-07-23', '2026-07-29', '15:32', '2026-07-26', '2026-07-30', '2026-07-30', '13:51', 'Sent', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Jyothi Woods', 'PIFS', '3rd Billing Cycle', 'Isaac', 'Chandana', 'Sinchana', '2026-07-31', '2026-08-12', '2026-08-03', '2026-08-13', '15:46', '2026-08-05', '2026-08-13', '2026-08-13', '17:13', 'Sent', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Kolte Patil Mirablis', 'PIFS', '1st Billing Cycle', 'Venkat', 'Pooja', 'Arpitha', '2026-07-20', '2026-08-16', '2026-07-23', '2026-08-17', '10:36', '2026-07-26', '2026-08-17', '2026-08-17', '17:07', 'Sent', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Kolte Patil Mirablis(PPFMS)', 'PPFMS', '1st Billing Cycle', 'Venkat', 'Pooja', 'Arpitha', '2026-07-20', '2026-08-16', '2026-07-23', '2026-08-17', '10:36', '2026-07-26', '2026-08-17', '2026-08-17', '17:07', 'Sent', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Mahendra Aarana', 'PIFS', '3rd Billing Cycle', 'Sandeep', 'Chandana', 'Arpitha', '2026-07-31', '2026-08-10', '2026-08-03', '2026-08-11', '15:43', '2026-08-05', '2026-08-12', '2026-08-12', '12:40', 'Sent', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Mahendra Windchimes', 'PIFS', '3rd Billing Cycle', 'Venkat', 'Chandana', 'Arpitha', '2026-07-31', '2026-08-04', '2026-08-03', '2026-08-07', '17:06', '2026-08-05', '2026-08-27', '2026-08-27', '12:54', 'Sent', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Mantri Elegance', 'PIFS', '2nd Billing Cycle', 'Venkat', 'Chandana', 'Arpitha', '2026-07-25', '2026-07-30', '2026-07-31', '2026-08-03', '11:09', '2026-08-03', '2026-08-04', '2026-08-04', '13:47', 'Sent', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Mantri Premero', 'PIFS', '3rd Billing Cycle', 'Venkat', 'Pooja', 'Sinchana', '2026-07-31', '2026-08-06', '2026-08-03', '2026-08-10', '17:04', '2026-08-05', '2026-08-11', '2026-08-11', '14:16', 'Sent', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Maratt', 'PIFS', '3rd Billing Cycle', 'Shilpa', 'Pooja', 'Sinchana', '2026-07-31', '2026-08-04', '2026-08-03', '2026-08-07', '14:29', '2026-08-05', '2026-08-08', '2026-08-08', '18:23', 'Sent', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('MJ amadeus', 'PIFS', '2nd Billing Cycle', 'Shilpa', 'Chandana', 'Sinchana', '2026-07-25', '2026-08-02', '2026-07-31', '2026-08-04', '17:44', '2026-08-03', '2026-08-05', '2026-08-05', '17:55', 'Sent', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Nikoo Homes', 'PIFS', '2nd Billing Cycle', 'Isaac', 'Kavya', 'Arpitha', '2026-07-25', '2026-08-07', '2026-07-31', '2026-08-07', '15:10', '2026-08-03', '2026-08-10', '2026-08-10', '17:29', 'Sent', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('NPS East', 'PIFS', '3rd Billing Cycle', 'Sandeep', 'Chandana', 'Sinchana', '2026-07-31', '2026-08-05', '2026-08-03', '2026-08-06', '12:00', '2026-08-05', '2026-08-06', '2026-08-06', '1.46PM', 'Sent', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('NVT Life Square', 'PIFS', '3rd Billing Cycle', 'Isaac', 'Chandana', 'Sinchana', '2026-07-31', '2026-07-29', '2026-08-03', '2026-07-29', '15:32', '2026-08-05', '2026-07-30', '2026-07-30', '13:46', 'Sent', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('NVT Mystic Garden', 'PIFS', '3rd Billing Cycle', 'Isaac', 'Pooja', 'Sinchana', '2026-07-31', '2026-08-05', '2026-08-03', '2026-08-05', '10:04', '2026-08-05', '2026-08-05', '2026-08-05', '17:31', 'Sent', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('NVT Stopping By the Woods', 'PIFS', '3rd Billing Cycle', 'Venkat', 'Pooja', 'Sinchana', '2026-07-31', NULL, '2026-08-03', NULL, NULL, '2026-08-05', NULL, NULL, NULL, NULL, 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('NVT Under the Open Sky', 'PIFS', '3rd Billing Cycle', 'Venkat', 'Chandana', 'Sinchana', '2026-07-31', '2026-08-07', '2026-08-03', '2026-08-08', '11:21', '2026-08-05', '2026-08-08', '2026-08-08', '18:31', 'Sent', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('NVT Under the Open Sky(PPFMS)', 'PPFMS', '3rd Billing Cycle', 'Venkat', 'Chandana', 'Sinchana', '2026-07-31', '2026-08-07', '2026-08-03', '2026-08-10', '15:55', '2026-08-05', '2026-08-10', '2026-08-10', '18:27', 'Sent', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('NVT Oikos', 'PIFS', '3rd Billing Cycle', 'Venkat', 'Chandana', 'Sinchana', '2026-07-31', '2026-08-07', '2026-08-03', '2026-08-08', '11:21', '2026-08-05', '2026-08-08', '2026-08-08', '18:26', 'Sent', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Prestige Garden Bay', 'PIFS', '3rd Billing Cycle', 'Shilpa', 'Chandana', 'Arpitha', '2026-07-31', '2026-08-05', '2026-08-03', '2026-08-06', '13:11', '2026-08-05', '2026-08-07', '2026-08-07', '12:33', 'Sent', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Prestige South Ridge', 'PIFS', '1st Billing Cycle', 'Isaac', 'Pooja', 'Sinchana', '2026-07-20', '2026-07-28', '2026-07-23', '2026-07-30', '18:02', '2026-07-26', '2026-07-31', '2026-07-31', '10:50', 'Sent', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Prestige St John', 'PIFS', '2nd Billing Cycle', 'Shilpa', 'Chandana', 'Sinchana', '2026-07-25', '2026-08-03', '2026-07-31', '2026-08-04', '17:44', '2026-08-03', '2026-08-05', '2026-08-05', '17:50', 'Sent', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Pride Picassa', 'PIFS', '3rd Billing Cycle', 'Shilpa', 'Chandana', 'Sinchana', '2026-07-31', '2026-08-04', '2026-08-03', '2026-08-06', '12.00PM', '2026-08-05', '2026-08-06', '2026-08-06', '13:40', 'Sent', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Purva Sunshine', 'PIFS', '3rd Billing Cycle', 'Isaac', 'Chandana', 'Sinchana', '2026-07-31', '2026-08-02', '2026-08-03', '2026-08-04', '17:44', '2026-08-05', '2026-08-05', '2026-08-05', '18:00', 'Sent', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Raja Ritz avenue', 'PIFS', '3rd Billing Cycle', 'Venkat', 'Pooja', 'Sinchana', '2026-07-31', '2026-08-03', '2026-08-03', '2026-08-07', '11:28', '2026-08-05', '2026-08-08', '2026-08-08', '18:09', 'Sent', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Salarpuria Luxuria', 'PIFS', '3rd Billing Cycle', 'Venkat', 'Chandana', 'Arpitha', '2026-07-31', '2026-08-06', '2026-08-03', '2026-08-08', '21:18', '2026-08-05', '2026-08-11', '2026-08-11', '17:46', 'Sent', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Shriram Signia', 'PIFS', '3rd Billing Cycle', 'Sandeep', 'Chandana', 'Sinchana', '2026-07-31', '2026-08-02', '2026-08-03', '2026-08-04', '17:44', '2026-08-05', '2026-08-06', '2026-08-06', '13:38', 'Sent', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Shriram Smirithi', 'PIFS', '3rd Billing Cycle', 'Sandeep', 'Pooja', 'Arpitha', '2026-07-31', '2026-08-04', '2026-08-03', '2026-08-07', '14:29', '2026-08-05', '2026-08-18', '2026-08-18', '17:50', 'Sent', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Shriram Spruthi', 'PPFMS', '3rd Billing Cycle', 'Isaac', 'Pooja', 'Sinchana', '2026-07-31', '2026-08-05', '2026-08-03', '2026-08-07', '11:28', '2026-08-05', '2026-08-08', '2026-08-08', '18:12', 'Sent', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Shriram Spruthi(FM)', 'PIFS', '3rd Billing Cycle', 'Isaac', 'Pooja', 'Sinchana', '2026-07-31', '2026-08-05', '2026-08-03', '2026-08-07', '11:28', '2026-08-05', '2026-08-08', '2026-08-08', '18:12', 'Sent', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('SJR Spencer', 'PIFS', '3rd Billing Cycle', 'Shilpa', 'Pooja', 'Sinchana', '2026-07-31', '2026-08-08', '2026-08-03', '2026-08-08', '16:49', '2026-08-05', '2026-08-10', '2026-08-10', '18:25', 'Sent', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('SJR Verity', 'PIFS', '2nd Billing Cycle', 'Shilpa', 'Chandana', 'Arpitha', '2026-07-25', '2026-08-03', '2026-07-31', '2026-08-04', '17:44', '2026-08-03', '2026-08-04', '2026-08-04', '18:44', 'Sent', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('SNN Clermont Marketing', 'PIFS', '3rd Billing Cycle', 'Venkat', 'Chandana', 'Sinchana', '2026-07-31', NULL, '2026-08-03', NULL, NULL, '2026-08-05', NULL, NULL, NULL, NULL, 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('SNN Estate Felicity', 'PIFS', '3rd Billing Cycle', 'Venkat', 'Chandana', 'Sinchana', '2026-07-31', '2026-08-07', '2026-08-03', '2026-08-08', '15:41', '2026-08-05', '2026-08-10', '2026-08-10', '18:26', 'Sent', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('SNN Raj Lake View', 'PIFS', '3rd Billing Cycle', 'Sandeep', 'Chandana', 'Arpitha', '2026-07-31', '2026-08-02', '2026-08-03', '2026-08-04', '13:44', '2026-08-05', '2026-08-04', '2026-08-04', '16:54', 'Sent', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('SNN Spiritua Project', 'PIFS', '3rd Billing Cycle', 'Isaac', 'Pooja', 'Arpitha', '2026-07-31', '2026-08-04', '2026-08-03', '2026-08-07', '11:28', '2026-08-05', '2026-08-08', '2026-08-08', '00:27', 'Sent', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Sobha Chrysthamem', 'PIFS', '1st Billing Cycle', 'Venkat', 'Chandana', 'Arpitha', '2026-07-20', '2026-07-23', '2026-07-23', '2026-08-03', '15:49', '2026-07-26', '2026-08-03', '2026-08-03', '16:49', 'Sent', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Sobha Dew Flower', 'PIFS', '2nd Billing Cycle', 'Isaac', 'Pooja', 'Sinchana', '2026-07-25', '2026-07-30', '2026-07-31', '2026-08-10', '15:57', '2026-08-03', '2026-08-10', '2026-08-10', '18:27', 'Sent', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Sobha Morzaria', 'PIFS', '3rd Billing Cycle', 'Venkat', 'Pooja', 'Arpitha', '2026-07-31', '2026-08-04', '2026-08-03', '2026-08-07', '14:29', '2026-08-05', '2026-08-18', '2026-08-18', '17:45', 'Sent', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Sobha Silicon Oasis', 'PIFS', '3rd Billing Cycle', 'Sandeep', 'Chandana', 'Arpitha', '2026-07-31', '2026-08-08', '2026-08-03', '2026-08-10', '15:22', '2026-08-05', '2026-08-13', '2026-08-13', '17:45', 'Sent', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Sterling Terrcaes', 'PIFS', '2nd Billing Cycle', 'Shilpa', 'Pooja', 'Arpitha', '2026-07-25', '2026-08-01', '2026-07-31', '2026-08-05', '13:41', '2026-08-03', '2026-08-07', '2026-08-07', '18:28', 'Sent', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Sumadhura Silver Ripples', 'PIFS', '3rd Billing Cycle', 'Sandeep', 'Chandana', 'Arpitha', '2026-07-31', '2026-07-10', '2026-08-03', '2026-07-11', '17:11', '2026-08-05', '2026-07-16', '2026-07-16', '5.337 PM', 'Sent', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Tata Sherwood', 'PIFS', '1st Billing Cycle', 'Shilpa', 'Chandana', 'Arpitha', '2026-07-20', '2026-07-27', '2026-07-23', '2026-07-29', '15:32', '2026-07-26', '2026-08-03', '2026-08-03', '16:47', 'Sent', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('UL India', 'PIFS', '1st Billing Cycle', 'Omkar', 'Chandana', 'Sinchana', '2026-07-20', '2026-07-28', '2026-07-23', '2026-07-29', '15:32', '2026-07-26', '2026-07-30', '2026-07-30', '13:50', 'Sent', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Urban Greens', 'PIFS', '3rd Billing Cycle', 'Isaac', 'Pooja', 'Sinchana', '2026-07-31', '2026-08-04', '2026-08-03', '2026-08-05', '13:41', '2026-08-05', '2026-08-06', '2026-08-06', '13:43', 'Sent', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Vaishnavi Terrcaes', 'PIFS', '3rd Billing Cycle', 'Shilpa', 'Chandana', 'Arpitha', '2026-07-31', '2026-08-07', '2026-08-03', '2026-08-08', '16:15', '2026-08-05', '2026-08-10', '2026-08-10', '15:37', 'Sent', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('SNN Clermont Project', 'PIFS', '3rd Billing Cycle', 'Venkat', 'Chandana', 'Sinchana', '2026-07-31', '2026-08-07', '2026-08-03', '2026-08-08', '15:41', '2026-08-05', '2026-08-10', '2026-08-10', '18:22', 'Sent', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Fame India', 'PIFS', '3rd Billing Cycle', 'Isaac', 'Pooja', 'Sinchana', '2026-07-31', '2026-08-10', '2026-08-03', '2026-08-11', '16:03', '2026-08-05', '2026-08-12', '2026-08-12', '18:13', 'Sent', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Zen Indraprasta', 'PIFS', '3rd Billing Cycle', 'Murali', 'Chandana', 'Arpitha', '2026-07-31', '2026-08-05', '2026-08-03', '2026-08-06', '12:00', '2026-08-05', '2026-08-08', '2026-08-08', '12:22', 'Sent', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Urban Serenity', 'PIFS', '3rd Billing Cycle', 'Isaac', 'Chandana', 'Sinchana', '2026-07-31', '2026-08-05', '2026-08-03', '2026-08-07', '10:17', '2026-08-05', '2026-08-07', '2026-08-07', '14:08', 'Sent', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Sunny Grove', 'PPFMS', '3rd Billing Cycle', 'Harish', 'Pooja', 'Arpitha', '2026-07-31', '2026-08-07', '2026-08-03', '2026-08-10', '13:31', '2026-08-05', '2026-08-11', '2026-08-11', '12:59', 'Sent', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('TATA Promont', 'PIFS', '3rd Billing Cycle', 'Sandeep', 'Chandana', 'Arpitha', '2026-07-31', '2026-08-03', '2026-08-03', '2026-08-04', '10:21', '2026-08-05', '2026-08-04', '2026-08-04', '13:50', 'Sent', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('NVT Vaksana', 'PIFS', '3rd Billing Cycle', 'Sandeep', 'Chandana', 'Arpitha', '2026-07-31', '2026-08-05', '2026-08-03', '2026-08-07', '10:17', '2026-08-05', '2026-08-08', '2026-08-08', '00:26', 'Sent', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Uber Verdant 2', 'PIFS', '3rd Billing Cycle', 'Venkat', 'Pooja', 'Arpitha', '2026-07-31', '2026-08-08', '2026-08-03', '2026-08-11', '16:03', '2026-08-05', '2026-08-13', '2026-08-13', '17:20', 'Sent', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Blue Waters By Sjr Prime', 'PIFS', '3rd Billing Cycle', 'Sandeep', 'Chandana', 'Arpitha', '2026-07-31', '2026-08-04', '2026-08-03', '2026-08-07', '17:06', '2026-08-05', '2026-08-08', '2026-08-08', '13:49', 'Sent', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('SNN Dumont', 'PIFS', '3rd Billing Cycle', 'Harish', 'Pooja', 'Sinchana', '2026-07-31', '2026-08-07', '2026-08-03', '2026-08-08', '16:49', '2026-08-05', '2026-08-10', '2026-08-10', '18:23', 'Sent', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Birla Alokya', 'PIFS', '1st Billing Cycle', 'Shilpa', 'Pooja', 'Arpitha', '2026-07-20', '2026-08-01', '2026-07-23', '2026-08-05', '13:41', '2026-07-26', '2026-08-10', '2026-08-10', '17:31', 'Sent', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Purva Venezia', 'PIFS', '2nd Billing Cycle', 'Shilpa', 'Chandana', 'Arpitha', '2026-07-25', '2026-08-04', '2026-07-31', '2026-08-06', '12:00', '2026-08-03', '2026-08-08', '2026-08-08', '12:21', NULL, '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Kolte Patil I Towers', 'PIFS', '2nd Billing Cycle', 'Isaac', 'Pooja', 'Arpitha', '2026-07-25', '2026-07-25', '2026-07-31', '2026-07-31', '18:54', '2026-08-03', '2026-08-03', '2026-08-03', '12:32', 'Sent', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('The Imperial Address', 'PIFS', '3rd Billing Cycle', 'Shilpa', 'Pooja', 'Arpitha', '2026-07-31', '2026-08-04', '2026-08-03', '2026-08-07', '14:29', '2026-08-05', '2026-08-08', '2026-08-08', '12:29', 'Sent', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('NVT Wonderfull Word', 'PIFS', '3rd Billing Cycle', 'Venkat', 'Chandana', 'Sinchana', '2026-07-31', '2026-08-07', '2026-08-03', '2026-08-08', '11:21', '2026-08-05', '2026-08-08', '2026-08-08', '18:25', 'Sent', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('NVT Symphony of orchids', 'PIFS', '3rd Billing Cycle', 'Venkat', 'Chandana', 'Sinchana', '2026-07-31', '2026-08-08', '2026-08-03', '2026-08-08', '15:41', '2026-08-05', '2026-08-08', '2026-08-08', '18:34', 'Sent', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('August Park', 'PIFS', '1st Billing Cycle', 'Venkat', 'Pooja', 'Arpitha', '2026-07-20', '2026-07-26', '2026-07-23', '2026-07-31', '18:54', '2026-07-26', '2026-08-04', '2026-08-04', '12:44', 'Sent', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Prestige Oasis', 'PIFS', '1st Billing Cycle', 'Venkat', 'Pooja', 'Arpitha', '2026-07-20', '2026-07-27', '2026-07-23', '2026-07-31', '18:54', '2026-07-26', '2026-08-04', '2026-08-04', '12:10', 'Sent', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Pramukh MM Meridian', 'PIFS', '1st Billing Cycle', 'Venkat', 'Chandana', 'Arpitha', '2026-07-20', '2026-07-23', '2026-07-23', '2026-08-05', '15:56', '2026-07-26', '2026-08-06', '2026-08-06', '18:26', 'Sent', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Raja Prakruthi', 'PIFS', '1st Billing Cycle', 'Shilpa', 'Chandana', 'Arpitha', '2026-07-20', '2026-07-29', '2026-07-23', '2026-08-01', '22:35', '2026-07-26', '2026-08-04', '2026-08-04', '12:06', 'Sent', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('SNN Bellahalli', 'PIFS', '3rd Billing Cycle', 'Venkat', 'Pooja', 'Arpitha', '2026-07-31', '2026-08-07', '2026-08-03', '2026-08-08', '16:49', '2026-08-05', '2026-08-10', '2026-08-10', '15:40', 'Sent', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('hebbal Infraspace', 'PIFS', '3rd Billing Cycle', 'Shilpa', 'Pooja', 'Arpitha', '2026-07-31', '2026-08-03', '2026-08-03', '2026-08-07', '11:28', '2026-08-05', '2026-08-21', '2026-08-21', '17:46', NULL, '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('NVT Whispering Hues', 'PIFS', '3rd Billing Cycle', 'Venkat', 'Chandana', 'Arpitha', '2026-07-31', '2026-08-08', '2026-08-03', '2026-08-08', '11:21', '2026-08-05', '2026-08-08', '2026-08-08', '18:29', 'Sent', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Global Edifice The Clan', 'PIFS', '3rd Billing Cycle', 'Harish', 'Pooja', 'Arpitha', '2026-07-31', '2026-08-08', '2026-08-03', '2026-08-11', '16:03', '2026-08-05', '2026-08-12', '2026-08-12', '18:36', 'Sent', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Brigade Corner Stone Utopia', 'PIFS', '1st Billing Cycle', 'Sandeep', 'Pooja', 'Arpitha', '2026-07-20', '2026-08-11', '2026-07-23', '2026-08-12', '13:47', '2026-07-26', '2026-08-12', '2026-08-12', '12:31', 'Sent', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Krishvi Wisteria', 'PPFMS', '2nd Billing Cycle', 'Sandeep', 'Chandana', 'Arpitha', '2026-07-25', '2026-08-03', '2026-07-31', '2026-08-07', '10:17', '2026-08-03', '2026-08-19', '2026-08-19', '13:57', 'Sent', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00')
) AS v(
    site_name, company_name, billing_cycle,
    ops_incharge, hr_incharge, invoice_incharge,
    manager_tentative_date, manager_received_date,
    hr_tentative_date, hr_received_date, attendance_received_time,
    invoice_sharing_tentative_date, invoice_prepared_date,
    invoice_sent_date, invoice_sent_time, invoice_sent_method_remarks,
    created_by, created_by_name, created_by_role, created_at
)
WHERE NOT EXISTS (
    SELECT 1 FROM public.site_invoice_tracker sit
    WHERE sit.site_name = v.site_name
      AND sit.manager_tentative_date = v.manager_tentative_date
      AND sit.deleted_at IS NULL
);

-- --------------------------------------------------------------------------
-- 2. Insert/Upsert into public.site_finance_tracker (Monthly Invoice Tracker Tab)
-- --------------------------------------------------------------------------

INSERT INTO public.site_finance_tracker (
    site_name, company_name, billing_month,
    contract_amount, contract_management_fee,
    billed_amount, billed_management_fee,
    remarks, status,
    created_by, created_by_name, created_by_role, created_at, updated_at
)
SELECT 
    v.site_name, v.company_name, v.billing_month,
    v.contract_amount, v.contract_management_fee,
    v.billed_amount, v.billed_management_fee,
    v.remarks, 'pending',
    v.created_by, v.created_by_name, v.created_by_role, v.created_at, v.created_at
FROM (
  VALUES
    ('42 Estate Queens'::text, 'PIFS'::text, '2026-07-01'::date, 217098::numeric, 23000::numeric, 236156::numeric, 23000::numeric, 'Fixed'::text, '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27'::uuid, 'Arpitha Nairy'::text, 'finance'::text, '2026-08-15 12:00:00+00'::timestamptz),
    ('42 Estate Queens(PPFMS)', 'PPFMS', '2026-07-01', 131000, 14000, 113903, 14000, 'Fixed', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Aeries', 'PIFS', '2026-07-01', 388724, 34000, 378502, 34000, 'fixed', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Ahad', 'PIFS', '2026-07-01', 769563, 61000, 809567, 61000, 'fixed', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Alanoville', 'PIFS', '2026-07-01', 286339, 32000, 304367, 33500, 'Fixed', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Artisane Forest Breeze', 'PIFS', '2026-07-01', 628968, 52000, 584929, 52000, 'Fixed', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Assetz Soul and Soil', 'PIFS', '2026-07-01', 930987, 70000, 926493, 75000, 'Fixed', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Aratt Milano', 'PIFS', '2026-07-01', 73667, 7200, 73235, 7200, 'fixed', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Aratt Milano(PPFMS)', 'PPFMS', '2026-07-01', 75518, 7800, 88032, 7800, 'Fixed', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Brigade Bricklane', 'PIFS', '2026-07-01', 598616, 41903, 586236, 41036.52, '0.07', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Brigade Jacaranda', 'PIFS', '2026-07-01', 616365, 61637, 617675, 61768, '0.1', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Brigade Laburnum', 'PIFS', '2026-07-01', 548725, 44400, 534641, 44400, 'Fixed', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Brigade Omega', 'PIFS', '2026-07-01', 595947, 40000, 519861, 40000, 'fixed', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Chanel India', 'PIFS', '2026-07-01', 53323, 8000, 53324, 8000, 'Fixed', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('DSR Eden Greens', 'PIFS', '2026-07-01', 253358, 20000, 230785, 20000, 'Fixed', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('DSR Woodwinds', 'PIFS', '2026-07-01', 468648, 46000, 492293, 46000, 'Fixed', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Elan Homes', 'PIFS', '2026-07-01', 873606, 65000, 906455, 65000, 'fixed', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Elita', 'PIFS', '2026-07-01', 331750, 22000, 305420.98, 22000, 'Fixed', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('FICO', 'PIFS', '2026-07-01', 157760, 15777, 165000, 16500, '10% or 15000 Whichever is higher', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('GR Sankalpa', 'PIFS', '2026-07-01', 481104, 55000, 470474, 55000, 'Fixed', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Greenwood', 'PIFS', '2026-07-01', 116900, 32000, 116900, 32000, 'Fixed', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('GRGR', 'PIFS', '2026-07-01', 244551, 23500, 238670, 23500, 'Fixed', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Habitat Eden Heights', 'PIFS', '2026-07-01', 623987, 46799, 630918, 47319, '0.075', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('ICON', 'PIFS', '2026-07-01', 450500, 37500, 430712, 37500, 'Fixed', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Janhavi Shelter', 'PIFS', '2026-07-01', 215934, 31350, 181358, 31350, 'Fixed', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Jyothi Woods', 'PIFS', '2026-07-01', 174423, 25000, 129525, 25000, 'Fixed', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Kolte Patil Mirablis', 'PIFS', '2026-07-01', 634648, 53000, 531998, 53000, 'Fixed', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Kolte Patil Mirablis(PPFMS)', 'PPFMS', '2026-07-01', 71000, 0, 78067, 0, 'No admin fees', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Mahendra Aarana', 'PIFS', '2026-07-01', 882485, 74440, 886768, 74440, 'Fixed', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Mahendra Windchimes', 'PIFS', '2026-07-01', 1619716, 104000, 1619195, 104000, 'Fixed', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Mantri Elegance', 'PIFS', '2026-07-01', 898289, 75000, 843621, 75000, 'Fixed', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Mantri Premero', 'PIFS', '2026-07-01', 231782, 21428, 199548, 18205, '0.1', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Maratt', 'PIFS', '2026-07-01', 254409, 27000, 240582, 27000, 'Fixed', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('MJ amadeus', 'PIFS', '2026-07-01', 498952, 33000, 487430, 33000, 'Fixed', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Nikoo Homes', 'PIFS', '2026-07-01', 4596410, 413677, 2694728, 158969, '0.09', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('NPS East', 'PIFS', '2026-07-01', 695555, 55644, 683906, 54713, '0.08', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('NVT Life Square', 'PIFS', '2026-07-01', 276973, 48000, 274946, 48000, 'Fixed', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('NVT Mystic Garden', 'PIFS', '2026-07-01', 254547, 27500, 241137, 27500, 'Fixed', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('NVT Stopping By the Woods', 'PIFS', '2026-07-01', 0, 0, 0, 0, NULL, 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('NVT Under the Open Sky', 'PIFS', '2026-07-01', 49313, 3945, 48516.65, 3881.33, '0.08', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('NVT Under the Open Sky(PPFMS)', 'PPFMS', '2026-07-01', 21384, 1711, 18624.77, 1489.98, '0.08', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('NVT Oikos', 'PIFS', '2026-07-01', 46041, 3683, 49259, 3940.72, '0.08', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Prestige Garden Bay', 'PIFS', '2026-07-01', 550274, 39100, 490791, 39100, 'Fixed', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Prestige South Ridge', 'PIFS', '2026-07-01', 805390, 70000, 791157, 70000, 'Fixed', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Prestige St John', 'PIFS', '2026-07-01', 134881, 13488, 139454, 13945.40, '0.1', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Pride Picassa', 'PIFS', '2026-07-01', 187959, 31600, 182680, 31600, 'Fixed', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Purva Sunshine', 'PIFS', '2026-07-01', 395672, 35000, 383207, 35000, 'Fixed', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Raja Ritz avenue', 'PIFS', '2026-07-01', 968175, 72613, 1052716.32, 72466.22, '0.075', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Salarpuria Luxuria', 'PIFS', '2026-07-01', 742360, 58000, 692009, 58000, 'Fixed', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Shriram Signia', 'PIFS', '2026-07-01', 503593, 45000, 483457, 45000, 'Fixed', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Shriram Smirithi', 'PIFS', '2026-07-01', 2536136, 157000, 2633972, 35000, 'fixed(1.20 Admin fees + 35000 SLA)', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Shriram Spruthi', 'PPFMS', '2026-07-01', 457083, 40000, 470445, 40000, 'Fixed', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Shriram Spruthi(FM)', 'PIFS', '2026-07-01', 48900, 5000, 48900, 5000, 'Fixed', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('SJR Spencer', 'PIFS', '2026-07-01', 400618, 38000, 293243, 38000, 'fixed', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('SJR Verity', 'PIFS', '2026-07-01', 393261, 38500, 397903, 38500, 'Fixed', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('SNN Clermont Marketing', 'PIFS', '2026-07-01', 38478, 3271, 0, 0, '0.085', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('SNN Estate Felicity', 'PIFS', '2026-07-01', 129637, 11019, 125282, 10648.97, '0.085', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('SNN Raj Lake View', 'PIFS', '2026-07-01', 1010314, 76000, 1027884, 76000, 'fixed', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('SNN Spiritua Project', 'PIFS', '2026-07-01', 188449, 19000, 191146, 19000, 'Fixed', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Sobha Chrysthamem', 'PIFS', '2026-07-01', 767751, 55000, 806239, 55000, 'Fixed', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Sobha Dew Flower', 'PIFS', '2026-07-01', 843658, 66000, 827511, 66000, 'Fixed', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Sobha Morzaria', 'PIFS', '2026-07-01', 562363, 47000, 580197, 50000, 'Fixed', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Sobha Silicon Oasis', 'PIFS', '2026-07-01', 1402349, 105176, 1330902, 99817.65, '0.075', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Sterling Terrcaes', 'PIFS', '2026-07-01', 684722, 68472, 675361, 67536.10, '0.1', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Sumadhura Silver Ripples', 'PIFS', '2026-07-01', 728787, 73985, 17742, 1685.49, '0.095', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Tata Sherwood', 'PIFS', '2026-07-01', 783995, 77500, 674914, 77500, 'Fixed', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('UL India', 'PIFS', '2026-07-01', 229825, 0, 274845, 0, 'No admin fees', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Urban Greens', 'PIFS', '2026-07-01', 154588, 35000, 155458, 35000, 'Fixed', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Vaishnavi Terrcaes', 'PIFS', '2026-07-01', 596473, 44739, 615046, 46128, '0.075', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('SNN Clermont Project', 'PIFS', '2026-07-01', 38478, 3271, 38479, 3271, '0.085', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Fame India', 'PIFS', '2026-07-01', 623128, 52966, 615616.55, 51953.49, '0.085', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Zen Indraprasta', 'PIFS', '2026-07-01', 83806, 15000, 87218, 15000, 'Fixed', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Urban Serenity', 'PIFS', '2026-07-01', 134099, 15000, 134099, 15000, 'Fixed', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Sunny Grove', 'PPFMS', '2026-07-01', 99500, 15000, 124290, 22000, 'Fixed', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('TATA Promont', 'PIFS', '2026-07-01', 1321272, 105702, 1247092, 99767.36, '0.08', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('NVT Vaksana', 'PIFS', '2026-07-01', 297332, 25000, 281894, 25000, 'Fixed', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Uber Verdant 2', 'PIFS', '2026-07-01', 1460034, 102203, 1089716, 84000, '0.07', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Blue Waters By Sjr Prime', 'PIFS', '2026-07-01', 769407, 61552, 740456, 56878.48, '0.08', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('SNN Dumont', 'PIFS', '2026-07-01', 38478, 3271, 37238, 3166, '0.085', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('Birla Alokya', 'PIFS', '2026-07-01', 1214431, 97154, 1196877, 93594.48, '0.08', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Purva Venezia', 'PIFS', '2026-07-01', 1914202, 137372, 1881224, 137372, 'Fixed  until Next Renewal', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Kolte Patil I Towers', 'PIFS', '2026-07-01', 711149, 57247, 701117, 59072.45, '0.085', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('The Imperial Address', 'PIFS', '2026-07-01', 263851, 45500, 215114, 45500, 'Fixed', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('NVT Wonderfull Word', 'PIFS', '2026-07-01', 62441, 4995, 60427.74, 4834.22, '0.08', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('NVT Symphony of orchids', 'PIFS', '2026-07-01', 41628, 3330, 82584.58, 6606.77, '0.08', 'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', 'Sinchana KM', 'finance', '2026-08-15 12:00:00+00'),
    ('August Park', 'PIFS', '2026-07-01', 774170, 60000, 784127, 60000, 'Fixed', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Prestige Oasis', 'PIFS', '2026-07-01', 1277689, 76661, 1246055, 74763.30, '0.06', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Pramukh MM Meridian', 'PIFS', '2026-07-01', 892268, 62000, 775782, 62000, 'Fixed', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Raja Prakruthi', 'PIFS', '2026-07-01', 282311, 32000, 260356, 32000, 'Fixed', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('SNN Bellahalli', 'PIFS', '2026-07-01', 79899, 6791, 55856, 4748, '0.085', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('hebbal Infraspace', 'PIFS', '2026-07-01', 0, 0, 242173.39, 0, '0', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('NVT Whispering Hues', 'PIFS', '2026-07-01', 20814, 1665, 8057.03, 644.56, '0.08', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Global Edifice The Clan', 'PIFS', '2026-07-01', 194787, 15000, 194469, 15000, 'Fixed', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Brigade Corner Stone Utopia', 'PIFS', '2026-07-01', 2349083, 152690, 2172700, 141225.50, '0.065', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00'),
    ('Krishvi Wisteria', 'PPFMS', '2026-07-01', 114199, 20000, 116532, 20000, 'Fixed', '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', 'Arpitha Nairy', 'finance', '2026-08-15 12:00:00+00')
) AS v(
    site_name, company_name, billing_month,
    contract_amount, contract_management_fee,
    billed_amount, billed_management_fee,
    remarks, created_by, created_by_name, created_by_role, created_at
)
WHERE NOT EXISTS (
    SELECT 1 FROM public.site_finance_tracker sft
    WHERE sft.site_name = v.site_name
      AND sft.billing_month = v.billing_month
      AND sft.deleted_at IS NULL
);

COMMIT;
