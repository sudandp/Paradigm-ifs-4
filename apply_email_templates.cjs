const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

const MONTHLY_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
</head>
<body style="background-color: #ffffff; font-family: 'Inter', -apple-system, sans-serif; margin: 0; padding: 20px; -webkit-font-smoothing: antialiased;">
  <!-- Main Container -->
  <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 1400px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
    <!-- Header Row -->
    <tr>
      <td style="padding: 32px 40px; border-bottom: 1px solid #e2e8f0;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td valign="top" width="50%">
              <img src="https://app.paradigmfms.com/paradigm-logo.png" alt="Paradigm Services" style="height: 40px; margin-bottom: 24px; display: block;">
              <div style="font-size: 13px; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">ALL EMPLOYEES</div>
            </td>
            <td valign="top" width="50%" align="right" style="text-align: right;">
              <h1 style="font-size: 26px; font-weight: 700; color: #1e293b; margin: 0 0 12px 0; letter-spacing: -0.5px; text-transform: uppercase;">Monthly Attendance Report</h1>
              <div style="font-size: 15px; color: #475569; margin-bottom: 24px; font-weight: 500;">Billing Cycle: {billingCycle}</div>
              <div style="font-size: 12px; color: #94a3b8; font-weight: 500; line-height: 1.6;">Generated: {reportDate} {generatedTime}<br>By: {generatedBy}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <!-- Content Row -->
    <tr>
      <td style="padding: 40px;">
        <!-- Stats Cards Row (Using Table for Email Compatibility) -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 32px;">
          <tr>
            <td width="32%" valign="top">
              <div style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; background: #ffffff; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                <div style="font-size: 12px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px;">Monthly Presence</div>
                <div style="font-size: 36px; font-weight: 700; letter-spacing: -1px; line-height: 1; color: #059669; word-wrap: break-word;">{attendancePercentage}%</div>
              </div>
            </td>
            <td width="2%"></td>
            <td width="32%" valign="top">
              <div style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; background: #ffffff; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                <div style="font-size: 12px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px;">Total Punches</div>
                <div style="font-size: 36px; font-weight: 700; letter-spacing: -1px; line-height: 1; color: #2563eb; word-wrap: break-word;">{totalPresent}</div>
              </div>
            </td>
            <td width="2%"></td>
            <td width="32%" valign="top">
              <div style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; background: #ffffff; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                <div style="font-size: 12px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px;">Active Staff</div>
                <div style="font-size: 36px; font-weight: 700; letter-spacing: -1px; line-height: 1; color: #1e293b; word-wrap: break-word;">{totalEmployees}</div>
              </div>
            </td>
          </tr>
        </table>
        <!-- Table Area -->
        <div style="overflow-x: auto;">
          {table}
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;

const DAILY_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Paradigm FMS Attendance Report</title>
</head>
<body style="margin: 0; padding: 20px; background-color: #ffffff; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">

  <div style="max-width: 900px; margin: auto; border: 1px solid #e5e7eb; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">

    <!-- Header Section (White Background with Green Top Border) -->
    <div style="padding: 25px 35px; background-color: #ffffff; border-bottom: 4px solid #16a34a;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="vertical-align: middle;">
            <!-- Company Logo -->
            <img src="https://app.paradigmfms.com/Paradigm-Logo-3-1024x157.png" alt="Paradigm FMS" style="height: 48px; display: block; max-width: 100%;">
          </td>
          <td style="text-align: right; vertical-align: middle;">
            <!-- Date Box (Green Theme) -->
            <div style="display: inline-block; text-align: left; background: #f0fdf4; padding: 10px 18px; border-radius: 8px; border: 1px solid #bbf7d0;">
              <p style="margin: 0; font-size: 11px; color: #166534; text-transform: uppercase; font-weight: 700;">Report Date</p>
              <p style="margin: 2px 0 0; font-size: 14px; color: #15803d; font-weight: 700;">{date}</p>
              <p style="margin: 4px 0 0; font-size: 10px; color: #166534;">Generated: {generatedTime}</p>
            </div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Title Area -->
    <div style="padding: 20px 35px; background-color: #f8fafc; border-bottom: 1px solid #f3f4f6;">
      <h3 style="margin: 0; font-size: 18px; color: #15803d; font-weight: 700;">Daily Attendance Summary</h3>
    </div>

    <!-- KPI Section (Enhanced Cards) -->
    <div style="padding: 25px 35px;">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="width: 100%; table-layout: fixed; border-collapse: separate; border-spacing: 12px 0;">
        <tr>
          <!-- Total Employees -->
          <td style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px 10px; text-align: center; vertical-align: middle; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <p style="margin: 0; font-size: 11px; color: #4b5563; text-transform: uppercase; font-weight: 700;">Total Staff</p>
            <p style="margin: 10px 0 0; font-size: 24px; color: #111827; font-weight: 800;">{totalEmployees}</p>
          </td>

          <!-- Present -->
          <td style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 20px 10px; text-align: center; vertical-align: middle; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <p style="margin: 0; font-size: 11px; color: #166534; text-transform: uppercase; font-weight: 700;">Present</p>
            <p style="margin: 10px 0 0; font-size: 24px; color: #15803d; font-weight: 800;">{totalPresent}</p>
          </td>

          <!-- Absent -->
          <td style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 20px 10px; text-align: center; vertical-align: middle; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <p style="margin: 0; font-size: 11px; color: #991b1b; text-transform: uppercase; font-weight: 700;">Absent</p>
            <p style="margin: 10px 0 0; font-size: 24px; color: #dc2626; font-weight: 800;">{totalAbsent}</p>
          </td>

          <!-- Late -->
          <td style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 10px; padding: 20px 10px; text-align: center; vertical-align: middle; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <p style="margin: 0; font-size: 11px; color: #92400e; text-transform: uppercase; font-weight: 700;">Late</p>
            <p style="margin: 10px 0 0; font-size: 24px; color: #d97706; font-weight: 800;">{lateCount}</p>
          </td>
        </tr>
      </table>
    </div>

    <!-- Employee Details Table -->
    <div style="padding: 10px 35px 35px 35px;">
      <div style="margin-bottom: 15px; border-left: 4px solid #16a34a; padding-left: 12px;">
        <h4 style="margin: 0; font-size: 15px; color: #111827; font-weight: 600;">Detailed Attendance Log</h4>
      </div>

      <div style="border: 1px solid #bbf7d0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="background: #f0fdf4;">
              <th style="padding: 12px 15px; text-align: left; color: #166534; font-weight: 700; border-bottom: 2px solid #bbf7d0;">S.No</th>
              <th style="padding: 12px 15px; text-align: left; color: #166534; font-weight: 700; border-bottom: 2px solid #bbf7d0;">Employee Name</th>
              <th style="padding: 12px 15px; text-align: left; color: #166534; font-weight: 700; border-bottom: 2px solid #bbf7d0;">Department</th>
              <th style="padding: 12px 15px; text-align: center; color: #166534; font-weight: 700; border-bottom: 2px solid #bbf7d0;">In</th>
              <th style="padding: 12px 15px; text-align: center; color: #166534; font-weight: 700; border-bottom: 2px solid #bbf7d0;">Out</th>
              <th style="padding: 12px 15px; text-align: center; color: #166534; font-weight: 700; border-bottom: 2px solid #bbf7d0;">Hours</th>
              <th style="padding: 12px 15px; text-align: right; color: #166534; font-weight: 700; border-bottom: 2px solid #bbf7d0;">Status</th>
            </tr>
          </thead>
          <tbody style="color: #374151;">
            {table}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Notes Section -->
    <div style="padding: 15px 35px; background: #f9fafb; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0; font-size: 11px; color: #6b7280; line-height: 1.5;">
        <strong>Note:</strong> Attendance ratio is calculated as ({totalPresent} / {totalEmployees}) * 100. Late arrivals are marked based on shift definitions. This is a system-generated report.
      </p>
    </div>

    <!-- Footer -->
    <div style="padding: 25px 35px; background-color: #ffffff; border-top: 1px solid #f3f4f6;">
      <table style="width: 100%;">
        <tr>
          <td>
            <p style="margin: 0; font-size: 12px; color: #6b7280;">&copy; {year} <strong>Paradigm FMS</strong></p>
          </td>
          <td style="text-align: right;">
            <p style="margin: 0; font-size: 11px; color: #16a34a; text-transform: uppercase; font-weight: 600; letter-spacing: 1px;">Confidential Internal Report</p>
          </td>
        </tr>
      </table>
    </div>

  </div>

</body>
</html>`;

async function applyTemplates() {
    console.log('--- Updating Database Default Email Templates ---');
    
    // 1. Monthly Template
    const { data: existingMonthly } = await supabase.from('email_templates').select('*').eq('name', 'Monthly Attendance Report').single();
    if (existingMonthly) {
        console.log('Updating Monthly Attendance Report template...');
        await supabase.from('email_templates').update({ body_template: MONTHLY_HTML, updated_at: new Date().toISOString() }).eq('id', existingMonthly.id);
    }

    // 2. Daily Template
    const { data: existingDaily } = await supabase.from('email_templates').select('*').eq('name', 'Daily Attendance Report').single();
    if (existingDaily) {
        console.log('Updating Daily Attendance Report template...');
        await supabase.from('email_templates').update({ body_template: DAILY_HTML, updated_at: new Date().toISOString() }).eq('id', existingDaily.id);
    }
    
    // 3. Update the migration file for new instances
    console.log('Done! Both templates are now the default in Supabase.');
}

applyTemplates().catch(console.error);
