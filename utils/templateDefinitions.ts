/**
 * Template definitions for all 9 Client Management sections.
 * Each definition specifies the columns, required fields, sample data,
 * and the target Supabase table for CRUD operations.
 */

export interface TemplateColumn {
  key: string;
  header: string;
  required: boolean;
  type: 'string' | 'number' | 'date' | 'enum';
  enumValues?: string[];
  width?: number;
  description?: string;
}

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  table: string;
  matchKey: string; // Column used to match existing records for updates
  instructions?: string[];
  columns: TemplateColumn[];
  sampleData: Record<string, any>[];
}

export const TEMPLATE_DEFINITIONS: TemplateDefinition[] = [
  {
    id: 'client_structure',
    name: 'Client Structure',
    description: 'Groups, companies, and organizational hierarchy',
    icon: 'ClipboardList',
    table: 'organization_groups',
    matchKey: 'name',
    columns: [
      { key: 'group_name', header: 'Group Name', required: true, type: 'string', width: 25, description: 'Name of the organizational group (e.g., AP Group)' },
      { key: 'company_name', header: 'Company Name', required: true, type: 'string', width: 30, description: 'Registered company name' },
      { key: 'location', header: 'Location', required: true, type: 'string', width: 20, description: 'City or region (e.g., Bangalore)' },
      { key: 'address', header: 'Registered Address', required: true, type: 'string', width: 40, description: 'Full registered address' },
      { key: 'registration_type', header: 'Registration Type', required: true, type: 'enum', enumValues: ['ROC', 'ROF', 'Society', 'Trust'], width: 18, description: 'ROC / ROF / Society / Trust' },
      { key: 'registration_number', header: 'Registration Number', required: true, type: 'string', width: 22, description: 'Official registration number' },
      { key: 'gst_number', header: 'GST Number', required: true, type: 'string', width: 22, description: '15-character GST number' },
      { key: 'pan_number', header: 'PAN Number', required: true, type: 'string', width: 15, description: '10-character PAN (e.g., ABCDE1234F)' },
      { key: 'epfo_code', header: 'EPFO Code', required: false, type: 'string', width: 25, description: '22-character EPFO code' },
      { key: 'esic_code', header: 'ESIC Code', required: false, type: 'string', width: 20, description: '17-digit ESIC code' },
    ],
    sampleData: [
      { group_name: 'AP Group', company_name: 'AP Security Services Pvt Ltd', location: 'Bangalore', address: '123, MG Road, Bangalore - 560001', registration_type: 'ROC', registration_number: 'U74999KA2020PTC123456', gst_number: '29AABCU9603R1ZM', pan_number: 'AABCU9603R', epfo_code: 'KABLR0012345000', esic_code: '12345678901234567' },
    ],
  },
  {
    id: 'site_configuration',
    name: 'Site Configuration',
    description: 'Individual site/society details and configuration',
    icon: 'Settings',
    table: 'organizations',
    matchKey: 'short_name',
    columns: [
      { key: 'short_name', header: 'Site Name', required: true, type: 'string', width: 30, description: 'Short display name of the site/society' },
      { key: 'company_name', header: 'Company Name', required: true, type: 'string', width: 30, description: 'Parent company name' },
      { key: 'location', header: 'Location', required: true, type: 'string', width: 20, description: 'City or region' },
      { key: 'billing_name', header: 'Billing Name', required: false, type: 'string', width: 30, description: 'Name used for invoicing' },
      { key: 'status', header: 'Status', required: true, type: 'enum', enumValues: ['active', 'inactive', 'draft'], width: 12, description: 'active / inactive / draft' },
      { key: 'contact_person', header: 'Contact Person', required: false, type: 'string', width: 25, description: 'Primary contact at site' },
      { key: 'contact_phone', header: 'Contact Phone', required: false, type: 'string', width: 18, description: 'Phone number' },
      { key: 'address', header: 'Site Address', required: false, type: 'string', width: 40, description: 'Full site address' },
    ],
    sampleData: [
      { short_name: 'Prestige Lakeside', company_name: 'AP Security Services Pvt Ltd', location: 'Bangalore', billing_name: 'Prestige Lakeside Habitat', status: 'active', contact_person: 'Rajesh Kumar', contact_phone: '9876543210', address: '456, Whitefield, Bangalore - 560066' },
    ],
  },
  {
    id: 'costing_resource',
    name: 'Costing & Resource',
    description: 'Resource allocation, billing rates, and cost centres',
    icon: 'Calculator',
    table: 'site_costing_master',
    matchKey: 'designation',
    columns: [
      { key: 'site_name', header: 'Site Name', required: true, type: 'string', width: 28, description: 'Name of the site' },
      { key: 'department', header: 'Department', required: true, type: 'string', width: 20, description: 'e.g., Security, Housekeeping' },
      { key: 'designation', header: 'Designation', required: true, type: 'string', width: 22, description: 'e.g., Security Guard, Supervisor' },
      { key: 'cost_centre', header: 'Cost Centre', required: false, type: 'string', width: 18, description: 'Cost centre code' },
      { key: 'unit_type', header: 'Unit Type', required: true, type: 'enum', enumValues: ['Manpower', 'Duty', 'Visit', 'Days', 'Actuals', 'Lumpsum'], width: 15, description: 'Type of billing unit' },
      { key: 'quantity', header: 'Quantity', required: true, type: 'number', width: 12, description: 'Number of units' },
      { key: 'billing_rate', header: 'Billing Rate (₹)', required: true, type: 'number', width: 18, description: 'Rate per unit' },
      { key: 'billing_model', header: 'Billing Model', required: true, type: 'enum', enumValues: ['Per Month', 'Per Day', 'Per Hour', 'Lumpsum'], width: 15, description: 'Billing frequency' },
    ],
    sampleData: [
      { site_name: 'Prestige Lakeside', department: 'Security', designation: 'Security Guard', cost_centre: 'SEC-001', unit_type: 'Manpower', quantity: 10, billing_rate: 18000, billing_model: 'Per Month' },
    ],
  },
  {
    id: 'backoffice_heads',
    name: 'Back Office & ID Series',
    description: 'Department ID series and back-office configuration',
    icon: 'Users',
    table: 'back_office_id_series',
    matchKey: 'designation',
    columns: [
      { key: 'site_name', header: 'Site Name', required: true, type: 'string', width: 28, description: 'Name of the site' },
      { key: 'department', header: 'Department', required: true, type: 'string', width: 22, description: 'e.g., Security, Admin' },
      { key: 'designation', header: 'Designation', required: true, type: 'string', width: 22, description: 'Staff designation' },
      { key: 'permanent_id', header: 'Permanent ID Format', required: true, type: 'string', width: 22, description: 'e.g., AP-SEC-0001' },
      { key: 'temporary_id', header: 'Temporary ID Format', required: true, type: 'string', width: 22, description: 'e.g., AP-SEC-T0001' },
    ],
    sampleData: [
      { site_name: 'Prestige Lakeside', department: 'Security', designation: 'Security Guard', permanent_id: 'AP-SEC-0001', temporary_id: 'AP-SEC-T0001' },
    ],
  },
  {
    id: 'staff_designation',
    name: 'Staff Designation',
    description: 'Staff designations with salary configuration',
    icon: 'Badge',
    table: 'site_staff_designations',
    matchKey: 'designation',
    columns: [
      { key: 'site_name', header: 'Site Name', required: true, type: 'string', width: 28, description: 'Name of the site' },
      { key: 'department', header: 'Department', required: true, type: 'string', width: 22, description: 'Department name' },
      { key: 'designation', header: 'Designation', required: true, type: 'string', width: 22, description: 'Designation title' },
      { key: 'permanent_id', header: 'Permanent ID', required: false, type: 'string', width: 20, description: 'Permanent ID prefix' },
      { key: 'temporary_id', header: 'Temporary ID', required: false, type: 'string', width: 20, description: 'Temporary ID prefix' },
      { key: 'monthly_salary', header: 'Monthly Salary (₹)', required: false, type: 'number', width: 18, description: 'Gross monthly salary' },
    ],
    sampleData: [
      { site_name: 'Prestige Lakeside', department: 'Security', designation: 'Security Guard', permanent_id: 'SG', temporary_id: 'SGT', monthly_salary: 18000 },
    ],
  },
  {
    id: 'gmc_policy',
    name: 'GMC Policy',
    description: 'Group medical coverage policies and plans',
    icon: 'HeartPulse',
    table: 'gmc_policy_settings',
    matchKey: 'plan_name',
    columns: [
      { key: 'company_name', header: 'Company Name', required: true, type: 'string', width: 30, description: 'Company to which the policy applies' },
      { key: 'plan_name', header: 'Plan Name', required: true, type: 'string', width: 25, description: 'GMC plan name' },
      { key: 'coverage_amount', header: 'Coverage Amount (₹)', required: true, type: 'number', width: 20, description: 'Sum insured' },
      { key: 'premium_amount', header: 'Premium Amount (₹)', required: true, type: 'number', width: 20, description: 'Premium per employee' },
      { key: 'provider', header: 'Insurance Provider', required: false, type: 'string', width: 25, description: 'Insurance company name' },
      { key: 'valid_from', header: 'Valid From', required: false, type: 'date', width: 15, description: 'Policy start date (YYYY-MM-DD)' },
      { key: 'valid_till', header: 'Valid Till', required: false, type: 'date', width: 15, description: 'Policy end date (YYYY-MM-DD)' },
    ],
    sampleData: [
      { company_name: 'AP Security Services Pvt Ltd', plan_name: 'Standard Plan', coverage_amount: 200000, premium_amount: 5000, provider: 'Star Health Insurance', valid_from: '2026-01-01', valid_till: '2026-12-31' },
    ],
  },
  {
    id: 'asset',
    name: 'Asset Management',
    description: 'Site assets inventory and tracking',
    icon: 'Archive',
    table: 'site_assets',
    matchKey: 'asset_name',
    columns: [
      { key: 'site_name', header: 'Site Name', required: true, type: 'string', width: 28, description: 'Site where asset is located' },
      { key: 'asset_name', header: 'Asset Name', required: true, type: 'string', width: 25, description: 'Name of the asset' },
      { key: 'category', header: 'Category', required: true, type: 'string', width: 20, description: 'e.g., Electronics, Furniture, Vehicle' },
      { key: 'quantity', header: 'Quantity', required: true, type: 'number', width: 12, description: 'Number of units' },
      { key: 'condition', header: 'Condition', required: false, type: 'enum', enumValues: ['New', 'Good', 'Fair', 'Poor', 'Damaged'], width: 12, description: 'Current condition' },
      { key: 'purchase_date', header: 'Purchase Date', required: false, type: 'date', width: 15, description: 'Date of purchase (YYYY-MM-DD)' },
      { key: 'purchase_value', header: 'Purchase Value (₹)', required: false, type: 'number', width: 18, description: 'Original purchase value' },
      { key: 'remarks', header: 'Remarks', required: false, type: 'string', width: 30, description: 'Additional notes' },
    ],
    sampleData: [
      { site_name: 'Prestige Lakeside', asset_name: 'CCTV Camera', category: 'Electronics', quantity: 15, condition: 'Good', purchase_date: '2025-06-15', purchase_value: 45000, remarks: 'Installed at main entrance' },
    ],
  },
  {
    id: 'tools_list',
    name: 'Tools List',
    description: 'Master tools inventory across all sites',
    icon: 'Wrench',
    table: 'master_tools_list',
    matchKey: 'tool_name',
    columns: [
      { key: 'site_name', header: 'Site Name', required: true, type: 'string', width: 28, description: 'Site where tool is used' },
      { key: 'category', header: 'Category', required: true, type: 'string', width: 20, description: 'e.g., Cleaning, Maintenance, Safety' },
      { key: 'tool_name', header: 'Tool Name', required: true, type: 'string', width: 25, description: 'Name of the tool' },
      { key: 'quantity', header: 'Quantity', required: true, type: 'number', width: 12, description: 'Number of units' },
      { key: 'unit', header: 'Unit', required: false, type: 'string', width: 12, description: 'e.g., Pcs, Ltrs, Kg' },
      { key: 'brand', header: 'Brand', required: false, type: 'string', width: 18, description: 'Brand or manufacturer' },
    ],
    sampleData: [
      { site_name: 'Prestige Lakeside', category: 'Safety', tool_name: 'Fire Extinguisher', quantity: 5, unit: 'Pcs', brand: 'Cease Fire' },
    ],
  },
  {
    id: 'attendance_overview',
    name: 'Attendance Overview',
    description: 'Attendance configuration and shift patterns',
    icon: 'BarChart',
    table: 'attendance_settings_scopes',
    matchKey: 'site_name',
    columns: [
      { key: 'site_name', header: 'Site Name', required: true, type: 'string', width: 28, description: 'Name of the site' },
      { key: 'shift_name', header: 'Shift Name', required: true, type: 'string', width: 20, description: 'e.g., Day Shift, Night Shift' },
      { key: 'start_time', header: 'Start Time', required: true, type: 'string', width: 14, description: 'HH:MM format (e.g., 08:00)' },
      { key: 'end_time', header: 'End Time', required: true, type: 'string', width: 14, description: 'HH:MM format (e.g., 20:00)' },
      { key: 'grace_period_minutes', header: 'Grace Period (mins)', required: false, type: 'number', width: 20, description: 'Late arrival grace period' },
      { key: 'auto_punch_out', header: 'Auto Punch-Out', required: false, type: 'enum', enumValues: ['Yes', 'No'], width: 15, description: 'Enable auto punch-out' },
    ],
    sampleData: [
      { site_name: 'Prestige Lakeside', shift_name: 'Day Shift', start_time: '08:00', end_time: '20:00', grace_period_minutes: 15, auto_punch_out: 'Yes' },
    ],
  },
  {
    id: 'attendance_bulk',
    name: 'Bulk Attendance Feed',
    description: 'Bulk upload employee attendance events (Check-in/Check-out)',
    icon: 'BarChart',
    table: 'attendance_events',
    matchKey: 'date',
    columns: [
      { key: 'employee_id', header: 'Employee ID', required: true, type: 'string', width: 20, description: 'Unique Employee Code' },
      { key: 'employee_name', header: 'Employee Name', required: true, type: 'string', width: 25, description: 'Full name of the employee' },
      { key: 'date', header: 'Date', required: true, type: 'date', width: 15, description: 'Attendance Date (YYYY-MM-DD)' },
      { key: 'punch_in', header: 'Punch In Time', required: false, type: 'string', width: 15, description: 'HH:MM format (e.g., 09:00)' },
      { key: 'punch_out', header: 'Punch Out Time', required: false, type: 'string', width: 15, description: 'HH:MM format (e.g., 18:00)' },
      { key: 'site_name', header: 'Site Name', required: true, type: 'string', width: 25, description: 'Name of the site/society' },
      { key: 'work_type', header: 'Work Type', required: true, type: 'enum', enumValues: ['office', 'field', 'site'], width: 15, description: 'Category of work' },
    ],
    sampleData: [
      { employee_id: 'EMP001', employee_name: 'John Doe', date: '2026-05-01', punch_in: '09:00', punch_out: '18:00', site_name: 'Prestige Lakeside', work_type: 'office' },
    ],
  },
  {
    id: 'attendance_monthly_bulk',
    name: 'Monthly Attendance Status Feed',
    description: 'Bulk upload monthly attendance statuses (P, A, LOP, etc.) for all days',
    icon: 'CalendarDays',
    table: 'attendance_events',
    matchKey: 'month_year',
    instructions: [
      '1. DO NOT change the header row or column order.',
      '2. Employee ID must match the unique code in the system.',
      '3. Month & Year should be in YYYY-MM format (e.g., 2026-04).',
      '4. Allowed Notations for Days 1-31:',
      '   - P: Present (Full Day)',
      '   - 1/2P: Half Day Work (4.5 hours)',
      '   - 1/4P: Quarter Day Work (2.25 hours)',
      '   - 3/4P: Three-Quarter Day Work (6.75 hours)',
      '   - EL / SL / CL: Approved Leaves (Full Day)',
      '   - 0.5P+0.5 EL / 0.5P+0.5 SL / 0.5P+0.5 CL: Half Day Work + Half Day Leave',
      '   - LOP / A: Loss of Pay / Absent',
      '   - W/H: Work From Home',
      '   - W/O / H: Week Off / Holiday',
      '   - C/O: Comp Off (Paid Leave)',
      '   - C/D: Compensatory Day Off (Unpaid/Weekly Off)',
      '   - W/P: Work-Related Present',
      '   - H/P: Holiday-Related Present',
      '5. **CRITICAL**: Employee Name must EXACTLY match the name in our system for the given Employee ID.',
      '6. This sheet is password protected to ensure data integrity.',
    ],
    columns: [
      { key: 'employee_id', header: 'Employee ID', required: true, type: 'string', width: 20, description: 'Unique Employee Code' },
      { key: 'employee_name', header: 'Employee Name', required: true, type: 'string', width: 25, description: 'Full name of the employee' },
      { key: 'month_year', header: 'Month & Year', required: true, type: 'string', width: 15, description: 'YYYY-MM format (e.g., 2026-04)' },
      { key: 'site_name', header: 'Site Name', required: true, type: 'string', width: 25, description: 'Primary site name' },
      ...Array.from({ length: 31 }, (_, i) => ({
        key: `day_${i + 1}`,
        header: (i + 1).toString(),
        required: false,
        type: 'enum' as const,
        enumValues: ['P', 'A', '1/4P', '1/2P', '3/4P', 'EL', 'SL', 'CL', 'LOP', 'S', 'H', 'W/O', 'W/H', '0.5P+0.5 EL', '0.5P+0.5 SL', '0.5P+0.5 CL', '0.5P+0.5 LOP', '0.5P EL', '0.5P SL', '0.5P CL', '0.5P LOP', 'C/D', 'W/P', 'H/P', 'C/O'],
        width: 10,
        description: 'Select from allowed notations only'
      }))
    ],
    sampleData: [
      { employee_id: 'EMP001', employee_name: 'John Doe', month_year: '2026-04', site_name: 'Prestige Lakeside', day_1: 'P', day_2: '1/2P', day_3: 'W/O', day_4: '0.5P+0.5 EL', day_5: 'A' },
    ],
  },
];

export const getTemplateById = (id: string): TemplateDefinition | undefined => {
  return TEMPLATE_DEFINITIONS.find(t => t.id === id);
};
