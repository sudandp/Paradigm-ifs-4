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

$bodyObj = @{
    name = 'CRM BD Daily Report'
    subject_template = 'BD Daily Activity Report — {bd_name} — {report_date}'
    body_template = '<p>Paradigm BD Daily Activity Report. Open this template in the editor and click "Restore Default HTML" to load the full premium template design.</p>'
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
