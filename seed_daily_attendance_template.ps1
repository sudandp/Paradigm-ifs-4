$url = 'https://fmyafuhxlorbafbacywa.supabase.co'
$key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M'

$body_template = @'
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Paradigm FMS Attendance Report</title>
</head>
<body style="margin: 0; padding: 20px; background-color: #ffffff; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">

  <div style="max-width: 900px; margin: auto; border: 1px solid #e5e7eb; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">

    <!-- Header Section -->
    <div style="padding: 25px 35px; background-color: #ffffff; border-bottom: 4px solid #16a34a;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="vertical-align: middle;">
            <img src="https://app.paradigmfms.com/Paradigm-Logo-3-1024x157.png" alt="Paradigm FMS" style="height: 48px; display: block; max-width: 100%;">
          </td>
          <td style="text-align: right; vertical-align: middle;">
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

    <!-- Greeting Area -->
    <div style="padding: 20px 35px; background-color: #ffffff; font-size: 14px; color: #374151; line-height: 1.6;">
      {greetingMessage}
    </div>

    <!-- KPI Section -->
    <div style="padding: 25px 35px;">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="width: 100%; table-layout: fixed; border-collapse: separate; border-spacing: 12px 0;">
        <tr>
          <td style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px 10px; text-align: center; vertical-align: middle; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <p style="margin: 0; font-size: 11px; color: #4b5563; text-transform: uppercase; font-weight: 700;">Total Staff</p>
            <p style="margin: 10px 0 0; font-size: 24px; color: #111827; font-weight: 800;">{totalEmployees}</p>
          </td>

          <td style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 20px 10px; text-align: center; vertical-align: middle; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <p style="margin: 0; font-size: 11px; color: #166534; text-transform: uppercase; font-weight: 700;">Present</p>
            <p style="margin: 10px 0 0; font-size: 24px; color: #15803d; font-weight: 800;">{totalPresent}</p>
          </td>

          <td style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 20px 10px; text-align: center; vertical-align: middle; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <p style="margin: 0; font-size: 11px; color: #991b1b; text-transform: uppercase; font-weight: 700;">Absent</p>
            <p style="margin: 10px 0 0; font-size: 24px; color: #dc2626; font-weight: 800;">{totalAbsent}</p>
          </td>

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
        {table}
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
