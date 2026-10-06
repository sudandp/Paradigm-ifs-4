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
        <!-- Greeting Message -->
        <div style="margin-bottom: 32px; color: #374151; font-size: 15px; line-height: 1.6;">
          {greetingMessage}
        </div>
        
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
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Paradigm FMS Attendance Report</title>
  <style type="text/css">
    body, table, td, p, a, li, blockquote { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; min-width: 100% !important; background-color: #f1f5f9; }

    @media only screen and (max-width: 680px) {
      .email-outer-pad {
        padding: 6px !important;
      }
      .card-shell {
        border-radius: 8px !important;
        border: 1px solid #e2e8f0 !important;
        box-shadow: none !important;
        width: 100% !important;
        max-width: 100% !important;
      }
      .header-pad {
        padding: 16px 14px !important;
      }
      .header-stack-cell {
        display: block !important;
        width: 100% !important;
        text-align: left !important;
        box-sizing: border-box !important;
      }
      .header-date-badge {
        margin-top: 10px !important;
        display: inline-block !important;
        width: auto !important;
      }
      .content-pad {
        padding: 14px 14px !important;
      }
      .kpi-section-pad {
        padding: 10px 6px !important;
      }
      .kpi-col {
        display: inline-block !important;
        width: 47% !important;
        max-width: 48% !important;
        min-width: 0 !important;
        margin: 4px 1% !important;
        box-sizing: border-box !important;
        vertical-align: top !important;
      }
      .kpi-box {
        padding: 12px 4px !important;
      }
      .kpi-title {
        font-size: 10px !important;
        letter-spacing: 0.3px !important;
      }
      .kpi-num {
        font-size: 20px !important;
        margin-top: 4px !important;
      }
      .table-section-pad {
        padding: 10px 8px 20px 8px !important;
      }
      .mobile-scroll-tip {
        display: block !important;
      }
      .att-table th, .att-table td {
        padding: 8px 6px !important;
        font-size: 11px !important;
      }
    }

    @media only screen and (min-width: 681px) and (max-width: 900px) {
      .email-outer-pad {
        padding: 12px !important;
      }
      .header-pad {
        padding: 20px 24px !important;
      }
      .content-pad {
        padding: 16px 24px !important;
      }
      .table-section-pad {
        padding: 10px 24px 28px 24px !important;
      }
      .kpi-section-pad {
        padding: 16px 20px !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 20px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;" class="email-outer-pad">

  <!-- Main Container -->
  <div align="center" style="width: 100%; margin: 0 auto;">
    <div class="card-shell" style="max-width: 900px; width: 100%; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); text-align: left; box-sizing: border-box;">

      <!-- Header Section -->
      <div class="header-pad" style="padding: 24px 32px; background-color: #ffffff; border-bottom: 4px solid #16a34a;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td class="header-stack-cell" valign="middle" align="left" style="vertical-align: middle;">
              <img src="https://app.paradigmfms.com/Paradigm-Logo-3-1024x157.png" alt="Paradigm FMS" style="height: 42px; max-height: 48px; max-width: 220px; display: block; border: 0;" />
            </td>
            <td class="header-stack-cell" valign="middle" align="right" style="vertical-align: middle; text-align: right;">
              <div class="header-date-badge" style="display: inline-block; text-align: left; background: #f0fdf4; padding: 8px 16px; border-radius: 8px; border: 1px solid #bbf7d0;">
                <p style="margin: 0; font-size: 10px; color: #166534; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; white-space: nowrap;">Report Date</p>
                <p style="margin: 2px 0 0; font-size: 13px; color: #15803d; font-weight: 700; white-space: nowrap;">{date}</p>
                <p style="margin: 2px 0 0; font-size: 10px; color: #166534; white-space: nowrap;">Generated: {generatedTime}</p>
              </div>
            </td>
          </tr>
        </table>
      </div>

      <!-- Title Area -->
      <div class="content-pad" style="padding: 16px 32px; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
        <h3 style="margin: 0; font-size: 17px; color: #15803d; font-weight: 700; letter-spacing: -0.2px;">Daily Attendance Summary</h3>
      </div>

      <!-- Greeting Area -->
      <div class="content-pad" style="padding: 18px 32px; background-color: #ffffff; font-size: 14px; color: #334155; line-height: 1.6;">
        {greetingMessage}
      </div>

      <!-- KPI Cards (4 on Desktop, 2x2 Grid on Mobile) -->
      <div class="kpi-section-pad" style="padding: 16px 28px; background-color: #ffffff;">
        <div style="font-size: 0; text-align: center;">

          <!-- Card 1: Total Staff -->
          <div class="kpi-col" style="display: inline-block; vertical-align: top; width: 23.5%; min-width: 130px; margin: 4px 0.5%; box-sizing: border-box;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: separate; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
              <tr>
                <td class="kpi-box" style="padding: 16px 8px; text-align: center;">
                  <div class="kpi-title" style="margin: 0; font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; white-space: nowrap;">Total Staff</div>
                  <div class="kpi-num" style="margin: 8px 0 0; font-size: 24px; color: #0f172a; font-weight: 800; line-height: 1; white-space: nowrap;">{totalEmployees}</div>
                </td>
              </tr>
            </table>
          </div>

          <!-- Card 2: Present -->
          <div class="kpi-col" style="display: inline-block; vertical-align: top; width: 23.5%; min-width: 130px; margin: 4px 0.5%; box-sizing: border-box;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: separate; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
              <tr>
                <td class="kpi-box" style="padding: 16px 8px; text-align: center;">
                  <div class="kpi-title" style="margin: 0; font-size: 11px; color: #166534; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; white-space: nowrap;">Present</div>
                  <div class="kpi-num" style="margin: 8px 0 0; font-size: 24px; color: #15803d; font-weight: 800; line-height: 1; white-space: nowrap;">{totalPresent}</div>
                </td>
              </tr>
            </table>
          </div>

          <!-- Card 3: Absent -->
          <div class="kpi-col" style="display: inline-block; vertical-align: top; width: 23.5%; min-width: 130px; margin: 4px 0.5%; box-sizing: border-box;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: separate; background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
              <tr>
                <td class="kpi-box" style="padding: 16px 8px; text-align: center;">
                  <div class="kpi-title" style="margin: 0; font-size: 11px; color: #991b1b; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; white-space: nowrap;">Absent</div>
                  <div class="kpi-num" style="margin: 8px 0 0; font-size: 24px; color: #dc2626; font-weight: 800; line-height: 1; white-space: nowrap;">{totalAbsent}</div>
                </td>
              </tr>
            </table>
          </div>

          <!-- Card 4: Late -->
          <div class="kpi-col" style="display: inline-block; vertical-align: top; width: 23.5%; min-width: 130px; margin: 4px 0.5%; box-sizing: border-box;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: separate; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
              <tr>
                <td class="kpi-box" style="padding: 16px 8px; text-align: center;">
                  <div class="kpi-title" style="margin: 0; font-size: 11px; color: #92400e; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; white-space: nowrap;">Late</div>
                  <div class="kpi-num" style="margin: 8px 0 0; font-size: 24px; color: #d97706; font-weight: 800; line-height: 1; white-space: nowrap;">{lateCount}</div>
                </td>
              </tr>
            </table>
          </div>

        </div>
      </div>

      <!-- Employee Details Table Section -->
      <div class="table-section-pad" style="padding: 10px 32px 32px 32px; background-color: #ffffff; box-sizing: border-box;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 10px;">
          <tr>
            <td align="left" style="border-left: 4px solid #16a34a; padding-left: 10px;">
              <h4 style="margin: 0; font-size: 15px; color: #0f172a; font-weight: 700;">Detailed Attendance Log</h4>
            </td>
            <td align="right" class="mobile-scroll-tip" style="display: none; font-size: 11px; color: #16a34a; font-weight: 600;">
              👉 Swipe horizontally &rarr;
            </td>
          </tr>
        </table>

        <!-- Responsive Table Container -->
        <div style="width: 100%; max-width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; border: 1px solid #bbf7d0; border-radius: 8px; background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.03); box-sizing: border-box;">
          <table class="att-table" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; min-width: 620px; border-collapse: collapse; font-size: 13px; text-align: left;">
            <thead>
              <tr style="background: #f0fdf4; border-bottom: 2px solid #bbf7d0;">
                <th style="padding: 11px 10px; text-align: center; color: #166534; font-weight: 700; width: 44px; white-space: nowrap;">#</th>
                <th style="padding: 11px 12px; text-align: left; color: #166534; font-weight: 700; min-width: 150px; white-space: nowrap;">Employee Name</th>
                <th style="padding: 11px 12px; text-align: left; color: #166534; font-weight: 700; min-width: 110px; white-space: nowrap;">Department</th>
                <th style="padding: 11px 10px; text-align: center; color: #166534; font-weight: 700; width: 75px; white-space: nowrap;">In</th>
                <th style="padding: 11px 10px; text-align: center; color: #166534; font-weight: 700; width: 75px; white-space: nowrap;">Out</th>
                <th style="padding: 11px 10px; text-align: center; color: #166534; font-weight: 700; width: 75px; white-space: nowrap;">Hours</th>
                <th style="padding: 11px 12px; text-align: center; color: #166534; font-weight: 700; width: 85px; white-space: nowrap;">Status</th>
              </tr>
            </thead>
            <tbody style="color: #334155;">
              {table}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Notes Section -->
      <div class="content-pad" style="padding: 14px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0; font-size: 11px; color: #64748b; line-height: 1.5;">
          <strong>Note:</strong> Attendance ratio is calculated as ({totalPresent} / {totalEmployees}) &times; 100. Late arrivals are marked based on assigned shift definitions. This is a system-generated automated report.
        </p>
      </div>

      <!-- Footer Section -->
      <div class="content-pad" style="padding: 20px 32px; background-color: #ffffff; border-top: 1px solid #f1f5f9;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td>
              <p style="margin: 0; font-size: 12px; color: #64748b;">&copy; {year} <strong>Paradigm FMS</strong></p>
            </td>
            <td align="right" style="text-align: right;">
              <p style="margin: 0; font-size: 11px; color: #16a34a; text-transform: uppercase; font-weight: 700; letter-spacing: 0.8px; white-space: nowrap;">Confidential Internal Report</p>
            </td>
          </tr>
        </table>
      </div>

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
