$url = 'https://fmyafuhxlorbafbacywa.supabase.co'
$key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M'

$body_template = @'
<!DOCTYPE html>
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
        padding: 12px 10px !important;
      }
      .kpi-col {
        display: inline-block !important;
        width: 48% !important;
        max-width: 48% !important;
        min-width: 0 !important;
        margin: 4px 1% !important;
        box-sizing: border-box !important;
        vertical-align: top !important;
      }
      .kpi-box {
        padding: 12px 6px !important;
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
        padding: 10px 10px 24px 10px !important;
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
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" align="center">
    <tr>
      <td align="center" style="padding: 0;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="card-shell" style="max-width: 900px; width: 100%; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">

          <!-- Header Section -->
          <tr>
            <td class="header-pad" style="padding: 24px 32px; background-color: #ffffff; border-bottom: 4px solid #16a34a;">
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
            </td>
          </tr>

          <!-- Title Area -->
          <tr>
            <td class="content-pad" style="padding: 16px 32px; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
              <h3 style="margin: 0; font-size: 17px; color: #15803d; font-weight: 700; letter-spacing: -0.2px;">Daily Attendance Summary</h3>
            </td>
          </tr>

          <!-- Greeting Area -->
          <tr>
            <td class="content-pad" style="padding: 18px 32px; background-color: #ffffff; font-size: 14px; color: #334155; line-height: 1.6;">
              {greetingMessage}
            </td>
          </tr>

          <!-- KPI Cards (4 on Desktop, 2x2 Grid on Mobile) -->
          <tr>
            <td class="kpi-section-pad" style="padding: 16px 28px; background-color: #ffffff;">
              <div style="font-size: 0; text-align: center;">

                <!--[if (gte mso 9)|(IE)]>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td width="25%" valign="top">
                <![endif]-->

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

                <!--[if (gte mso 9)|(IE)]>
                </td><td width="25%" valign="top">
                <![endif]-->

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

                <!--[if (gte mso 9)|(IE)]>
                </td><td width="25%" valign="top">
                <![endif]-->

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

                <!--[if (gte mso 9)|(IE)]>
                </td><td width="25%" valign="top">
                <![endif]-->

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

                <!--[if (gte mso 9)|(IE)]>
                </td></tr></table>
                <![endif]-->

              </div>
            </td>
          </tr>

          <!-- Employee Details Table Section -->
          <tr>
            <td class="table-section-pad" style="padding: 10px 32px 32px 32px; background-color: #ffffff;">
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
              <div style="width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; border: 1px solid #bbf7d0; border-radius: 8px; background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
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
            </td>
          </tr>

          <!-- Notes Section -->
          <tr>
            <td class="content-pad" style="padding: 14px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; font-size: 11px; color: #64748b; line-height: 1.5;">
                <strong>Note:</strong> Attendance ratio is calculated as ({totalPresent} / {totalEmployees}) &times; 100. Late arrivals are marked based on assigned shift definitions. This is a system-generated automated report.
              </p>
            </td>
          </tr>

          <!-- Footer Section -->
          <tr>
            <td class="content-pad" style="padding: 20px 32px; background-color: #ffffff; border-top: 1px solid #f1f5f9;">
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
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
'@

$bodyObj = @{
    id = 'fab74733-97e8-42bf-81f6-14bddf2b84d8'
    name = 'Daily Attendance Report'
    subject_template = '{date} Attendance: {attendancePercentage}% | {totalPresent} Present | {totalAbsent} Absent | {lateCount} Late'
    body_template = $body_template
    category = 'report'
    is_active = $true
}

$body = $bodyObj | ConvertTo-Json -Depth 10 -Compress
$bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($body)
$authHeader = "Bearer $key"

$headers = @{
    'apikey' = $key
    'Authorization' = $authHeader
    'Content-Type' = 'application/json; charset=utf-8'
    'Prefer' = 'resolution=merge-duplicates'
}

try {
    $null = Invoke-RestMethod -Uri "$url/rest/v1/email_templates" -Method POST -Headers $headers -Body $bodyBytes
    Write-Host 'SUCCESS: Daily Attendance Report template updated in email_templates.' -ForegroundColor Green
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
}
