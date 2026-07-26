$url = 'https://fmyafuhxlorbafbacywa.supabase.co'
$key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M'

$variables = @(
    @{key='bd_name';description='Business Developer full name'},
    @{key='report_date';description='Report date DD/MM/YYYY'},
    @{key='attendance_status';description='Present or Absent'},
    @{key='check_in_time';description='Check-in time'},
    @{key='check_out_time';description='Check-out time'},
    @{key='working_hours';description='Total working hours e.g. 8h 30m'},
    @{key='kms_travelled';description='KMs travelled today'},
    @{key='prospect_calls';description='New prospect calls count'},
    @{key='followup_calls';description='Follow-up calls count'},
    @{key='new_leads_count';description='New leads added today'},
    @{key='sites_count';description='Number of sites visited'},
    @{key='sites_visited';description='HTML table of sites visited'},
    @{key='new_leads_table';description='HTML table of new leads added'},
    @{key='metrics_table';description='HTML table of target vs actual metrics'},
    @{key='pipeline_snapshot';description='HTML table of pipeline stage counts'}
)

$body_template = @'
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
</head>
<body style="background:#ffffff;font-family:'Inter',-apple-system,sans-serif;margin:0;padding:16px;">
<table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:760px;margin:0 auto;table-layout:fixed;">

  <!-- HEADER -->
  <tr><td style="background:#ffffff;border-radius:12px 12px 0 0;padding:24px 28px;border-bottom:4px solid #16a34a;">
    <table width="100%" border="0" cellpadding="0" cellspacing="0"><tr>
      <td valign="middle" width="50%">
        <img src="https://app.paradigmfms.com/Paradigm-Logo-3-1024x157.png" alt="Paradigm" style="height:36px;display:block;">
        <div style="margin-top:8px;font-size:10px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Business Development</div>
      </td>
      <td valign="top" align="right" width="50%">
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 14px;display:inline-block;text-align:left;">
          <div style="font-size:10px;color:#166534;text-transform:uppercase;font-weight:700;">Daily Activity Report</div>
          <div style="font-size:16px;color:#15803d;font-weight:800;margin-top:4px;">{report_date}</div>
          <div style="font-size:10px;color:#374151;margin-top:4px;">BD: <strong>{bd_name}</strong></div>
        </div>
      </td>
    </tr></table>
  </td></tr>

  <!-- SECTION 1: ATTENDANCE -->
  <tr><td style="background:#ffffff;padding:20px 28px;">
    <div style="font-size:11px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #f1f5f9;">1. Attendance &amp; Time</div>
    <table width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:6px 0;"><tr>
      <td style="background:#f0fdf4;border:1px solid #bbf7d030;border-radius:8px;padding:12px;text-align:center;width:20%;">
        <div style="font-size:9px;color:#6b7280;font-weight:700;text-transform:uppercase;">Status</div>
        <div style="font-size:14px;font-weight:800;color:#059669;margin-top:4px;word-break:break-word;">{attendance_status}</div>
      </td>
      <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;text-align:center;width:20%;">
        <div style="font-size:9px;color:#6b7280;font-weight:700;text-transform:uppercase;">Check In</div>
        <div style="font-size:14px;font-weight:700;color:#1e293b;margin-top:4px;word-break:break-word;">{check_in_time}</div>
      </td>
      <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;text-align:center;width:20%;">
        <div style="font-size:9px;color:#6b7280;font-weight:700;text-transform:uppercase;">Check Out</div>
        <div style="font-size:14px;font-weight:700;color:#1e293b;margin-top:4px;word-break:break-word;">{check_out_time}</div>
      </td>
      <td style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px;text-align:center;width:20%;">
        <div style="font-size:9px;color:#1d4ed8;font-weight:700;text-transform:uppercase;">Work Hours</div>
        <div style="font-size:14px;font-weight:800;color:#1d4ed8;margin-top:4px;word-break:break-word;">{working_hours}</div>
      </td>
      <td style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:12px;text-align:center;width:20%;">
        <div style="font-size:9px;color:#92400e;font-weight:700;text-transform:uppercase;">Travelled</div>
        <div style="font-size:14px;font-weight:800;color:#d97706;margin-top:4px;word-break:break-word;">{kms_travelled}</div>
      </td>
    </tr></table>
  </td></tr>

  <!-- SECTION 2: ACTIVITY SUMMARY -->
  <tr><td style="background:#ffffff;padding:0 28px 20px;">
    <div style="font-size:11px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #f1f5f9;">2. Activity Summary</div>
    <table width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:6px 0;margin-bottom:16px;"><tr>
      <td style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;text-align:center;width:25%;">
        <div style="font-size:9px;color:#166534;font-weight:700;text-transform:uppercase;">Prospect Calls</div>
        <div style="font-size:24px;font-weight:800;color:#059669;margin-top:6px;line-height:1;word-break:break-word;">{prospect_calls}</div>
      </td>
      <td style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;text-align:center;width:25%;">
        <div style="font-size:9px;color:#1d4ed8;font-weight:700;text-transform:uppercase;">Follow-ups</div>
        <div style="font-size:24px;font-weight:800;color:#2563eb;margin-top:6px;line-height:1;word-break:break-word;">{followup_calls}</div>
      </td>
      <td style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:16px;text-align:center;width:25%;">
        <div style="font-size:9px;color:#92400e;font-weight:700;text-transform:uppercase;">New Leads</div>
        <div style="font-size:24px;font-weight:800;color:#d97706;margin-top:6px;line-height:1;word-break:break-word;">{new_leads_count}</div>
      </td>
      <td style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;padding:16px;text-align:center;width:25%;">
        <div style="font-size:9px;color:#5b21b6;font-weight:700;text-transform:uppercase;">Sites Visited</div>
        <div style="font-size:24px;font-weight:800;color:#7c3aed;margin-top:6px;line-height:1;word-break:break-word;">{sites_count}</div>
      </td>
    </tr></table>
    <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;font-size:12px;">{sites_visited}</div>
  </td></tr>

  <tr><td style="background:#ffffff;padding:0 28px 20px;">
    <div style="font-size:11px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #f1f5f9;">3. New Leads Added Today</div>
    <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;font-size:12px;">{new_leads_table}</div>
  </td></tr>

  <tr><td style="background:#ffffff;padding:0 28px 20px;">
    <div style="font-size:11px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #f1f5f9;">4. Activity Metrics &mdash; Target vs Actual</div>
    <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;font-size:12px;">{metrics_table}</div>
  </td></tr>

  <tr><td style="background:#ffffff;padding:0 28px 20px;">
    <div style="font-size:11px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #f1f5f9;">5. CRM Pipeline Snapshot</div>
    <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;font-size:12px;">{pipeline_snapshot}</div>
  </td></tr>

  <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;border-radius:0 0 12px 12px;padding:16px 28px;">
    <table width="100%" border="0" cellpadding="0" cellspacing="0"><tr>
      <td><p style="margin:0;font-size:11px;color:#6b7280;">&copy; Paradigm FMS &middot; BD Daily Report</p></td>
      <td style="text-align:right;"><p style="margin:0;font-size:10px;color:#16a34a;text-transform:uppercase;font-weight:700;letter-spacing:1px;">Confidential Internal</p></td>
    </tr></table>
  </td></tr>

</table>
</body>
</html>
'@

$bodyObj = @{
    name = 'CRM BD Daily Report'
    subject_template = 'BD Daily Activity Report — {bd_name} — {report_date}'
    body_template = $body_template
    category = 'report'
    variables = $variables
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
    Write-Host 'SUCCESS: CRM BD Daily Report template seeded into email_templates.' -ForegroundColor Green
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails) {
        Write-Host $_.ErrorDetails.Message -ForegroundColor Red
    }
}
