const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

const PREMIUM_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @media only screen and (max-width: 600px) {
      .stats-container { display: block !important; }
      .stat-card { margin-bottom: 12px !important; width: 100% !important; }
      .header-content { display: block !important; text-align: center !important; }
      .header-right { text-align: center !important; margin-top: 12px !important; }
    }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #e2e8f0; }
    .report-grid { width: 100%; border-collapse: collapse; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 8px; border: 1px solid #e2e8f0; }
    .report-grid th { border: 1px solid #e2e8f0; padding: 6px 3px; font-weight: 700; background-color: #f8fafc; color: #1e293b; }
    .report-grid td { border: 1px solid #e2e8f0; padding: 4px 2px; text-align: center; color: #334155; }
    .report-grid td.emp-name { text-align: left; font-weight: 600; min-width: 120px; padding: 6px 6px; color: #0f172a; }
    .report-grid td.p { color: #166534; font-weight: bold; background-color: #f0fdf4; }
    .report-grid td.a { color: #991b1b; background-color: #fef2f2; }
    .report-grid td.wo { color: #4b5563; background-color: #f9fafb; }
    .report-grid td.h { color: #854d0e; background-color: #fffbeb; font-weight: bold; }
    .report-grid td.hd { color: #92400e; background-color: #fffbeb; font-weight: bold; }
    .report-grid td.ot { color: #075985; background-color: #f0f9ff; font-weight: bold; }
    .report-grid td.co { color: #9d174d; background-color: #fdf2f8; font-weight: bold; }
    .report-grid td.el { color: #5b21b6; background-color: #f5f3ff; font-weight: bold; }
    .report-grid td.sl { color: #9f1239; background-color: #fff1f2; font-weight: bold; }
    .report-grid td.tot { font-weight: 800; background-color: #ecfdf5; color: #065f46; border-left: 2px solid #10b981; }
    .report-grid tr.even { background-color: #ffffff; }
    .report-grid tr.odd { background-color: #f8fafc; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc;">
  <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 1000px; margin: 20px auto; border: 1px solid #e2e8f0; border-radius: 20px; overflow: hidden; background-color: #ffffff; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);">
    <div style="padding: 40px; border-bottom: 1px solid #f1f5f9; background: #ffffff;">
      <div style="display: flex; justify-content: space-between; align-items: center;" class="header-content">
        <div>
          <img src="https://app.paradigmfms.com/paradigm-logo.png" alt="Paradigm Services" style="height: 50px; display: block; margin-bottom: 8px;">
          <div style="font-size: 14px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px;">Paradigm Services</div>
        </div>
        <div style="text-align: right;" class="header-right">
          <h1 style="margin: 0; font-size: 32px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: -0.5px;">Monthly Attendance Report</h1>
          <div style="font-size: 18px; font-weight: 600; color: #64748b; margin-top: 4px;">{date}</div>
          <div style="font-size: 12px; color: #94a3b8; margin-top: 12px; font-weight: 500;">Generated: {generatedTime} | By: {generatedBy}</div>
        </div>
      </div>
    </div>
    <div style="padding: 40px;">
      <!-- Greeting Block -->
      <div style="color: #374151; font-size: 16px; line-height: 1.6; margin-bottom: 35px; border-left: 4px solid #10b981; padding-left: 20px; background: #f0fdf4; border-radius: 8px;">
        <div style="padding: 15px 0;">{customGreeting}</div>
      </div>
      <div class="stats-container" style="display: flex; gap: 24px; margin-bottom: 40px;">
        <div class="stat-card" style="flex: 1; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 28px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); text-align: left; border-left: 5px solid #10b981;">
          <div style="font-size: 12px; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">Monthly Presence</div>
          <div style="font-size: 42px; font-weight: 900; color: #065f46;">{attendancePercentage}%</div>
        </div>
        <div class="stat-card" style="flex: 1; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 28px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); text-align: left; border-left: 5px solid #3b82f6;">
          <div style="font-size: 12px; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">Total Punches</div>
          <div style="font-size: 42px; font-weight: 900; color: #1e40af;">{totalPresent}</div>
        </div>
        <div class="stat-card" style="flex: 1; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 28px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); text-align: left; border-left: 5px solid #64748b;">
          <div style="font-size: 12px; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">Active Staff</div>
          <div style="font-size: 42px; font-weight: 900; color: #334155;">{totalEmployees}</div>
        </div>
      </div>
      <div style="margin-bottom: 40px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h3 style="margin: 0; color: #1e293b; font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Detailed Attendance Grid</h3>
          <div style="font-size: 12px; color: #94a3b8; font-weight: 600;">Scroll horizontally if viewing on mobile</div>
        </div>
        <div style="overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 12px;">{table}</div>
      </div>
      <div style="padding-top: 40px; border-top: 1px solid #f1f5f9; text-align: center;">
        <p style="margin: 0 0 12px 0; color: #94a3b8; font-size: 13px; font-weight: 500;">This is an official automated compliance report from the Paradigm Attendance Management System.</p>
        <div style="display: inline-flex; gap: 12px; justify-content: center;">
          <a href="https://app.paradigmfms.com" style="color: #059669; text-decoration: none; font-weight: 700; font-size: 13px;">Open Dashboard</a>
          <span style="color: #e2e8f0;">|</span>
          <span style="color: #64748b; font-size: 13px; font-weight: 600;">Paradigm Facility Management Services</span>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

async function applyTemplate() {
    console.log('--- Restoring Monthly Attendance Template ---');
    
    // 1. Check if template exists
    const { data: existing } = await supabase
        .from('email_templates')
        .select('*')
        .eq('name', 'Monthly Attendance Report')
        .single();
    
    let templateId;
    if (existing) {
        console.log('Found existing template. Updating...');
        const { data, error } = await supabase
            .from('email_templates')
            .update({
                subject_template: 'Monthly Attendance Report: {Date} | {AttendancePercentage}% Present',
                body_template: PREMIUM_HTML,
                updated_at: new Date().toISOString()
            })
            .eq('id', existing.id)
            .select()
            .single();
        if (error) throw error;
        templateId = data.id;
    } else {
        console.log('Creating new template...');
        const { data, error } = await supabase
            .from('email_templates')
            .insert({
                name: 'Monthly Attendance Report',
                subject_template: 'Monthly Attendance Report: {Date} | {AttendancePercentage}% Present',
                body_template: PREMIUM_HTML,
                category: 'report',
                variables: [
                    { key: 'Date', description: 'Month and Year' },
                    { key: 'AttendancePercentage', description: 'Average attendance %' },
                    { key: 'totalPresent', description: 'Count of present days' }
                ],
                is_active: true
            })
            .select()
            .single();
        if (error) throw error;
        templateId = data.id;
    }

    console.log('Template ID:', templateId);

    // 2. Link the "Monthly Report" rule to this template
    console.log('Updating "Monthly Report" schedule rule...');
    const { data: rule, error: ruleErr } = await supabase
        .from('email_schedule_rules')
        .update({
            template_id: templateId,
            report_type: 'attendance_monthly',
            report_format: 'html'
        })
        .eq('name', 'Monthly Report');
    
    if (ruleErr) console.error('Error updating rule:', ruleErr);
    else console.log('Successfully updated Monthly Report rule.');
}

applyTemplate().catch(console.error);
