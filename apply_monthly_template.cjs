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
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    @media only screen and (max-width: 600px) {
      .stats-container { display: block !important; }
      .stat-card { margin-bottom: 16px !important; width: 100% !important; }
      .header-content { display: block !important; text-align: center !important; }
      .header-right { text-align: center !important; margin-top: 20px !important; }
      .logo-container { justify-content: center !important; margin-bottom: 12px !important; }
    }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
    table { width: 100%; border-collapse: collapse; }
    .report-grid { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 11px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
    .report-grid th { padding: 12px 6px; font-weight: 600; background-color: #f8fafc; color: #475569; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; }
    .report-grid td { padding: 10px 4px; text-align: center; color: #334155; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; font-weight: 500; }
    .report-grid td:last-child, .report-grid th:last-child { border-right: none; }
    .report-grid tr:last-child td { border-bottom: none; }
    .report-grid td.emp-name { text-align: left; font-weight: 600; min-width: 150px; padding: 10px 14px; color: #0f172a; }
    
    /* Softened Status Colors */
    .report-grid td.p { color: #059669; font-weight: 700; background-color: rgba(16, 185, 129, 0.08); }
    .report-grid td.a { color: #dc2626; background-color: rgba(239, 68, 68, 0.08); }
    .report-grid td.wo { color: #64748b; background-color: #f1f5f9; }
    .report-grid td.h { color: #d97706; background-color: rgba(245, 158, 11, 0.08); font-weight: 700; }
    .report-grid td.hd { color: #ea580c; background-color: rgba(249, 115, 22, 0.08); font-weight: 700; }
    .report-grid td.ot { color: #0284c7; background-color: rgba(14, 165, 233, 0.08); font-weight: 700; }
    .report-grid td.co { color: #db2777; background-color: rgba(236, 72, 153, 0.08); font-weight: 700; }
    .report-grid td.el { color: #7c3aed; background-color: rgba(139, 92, 246, 0.08); font-weight: 700; }
    .report-grid td.sl { color: #e11d48; background-color: rgba(225, 29, 72, 0.08); font-weight: 700; }
    .report-grid td.tot { font-weight: 800; background-color: #f0fdf4; color: #047857; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4fbf7; -webkit-font-smoothing: antialiased;">
  <div style="max-width: 1000px; margin: 40px auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(4, 120, 87, 0.08), 0 0 0 1px rgba(4,120,87,0.02);">
    
    <!-- Premium Green Header -->
    <div style="background: linear-gradient(135deg, #065f46 0%, #10b981 100%); padding: 48px 40px; color: white;">
      <div style="display: flex; justify-content: space-between; align-items: center;" class="header-content">
        <div>
          <div class="logo-container" style="display: flex; align-items: center; margin-bottom: 12px;">
            <div style="background: white; padding: 10px 14px; border-radius: 12px; display: inline-flex; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <img src="https://app.paradigmfms.com/paradigm-logo.png" alt="Paradigm Services" style="height: 36px; display: block;">
            </div>
          </div>
          <div style="font-size: 13px; font-weight: 600; color: #a7f3d0; text-transform: uppercase; letter-spacing: 2px;">Paradigm Services</div>
        </div>
        <div style="text-align: right;" class="header-right">
          <h1 style="margin: 0 0 12px 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; color: white;">Monthly Attendance</h1>
          <div style="display: inline-block; background: rgba(255, 255, 255, 0.15); padding: 8px 16px; border-radius: 20px; font-size: 15px; font-weight: 600; color: #ffffff; backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.2);">
            {date}
          </div>
        </div>
      </div>
    </div>

    <div style="padding: 40px;">
      <!-- Greeting Block -->
      <div style="margin-bottom: 40px; padding: 24px; background: #f0fdf4; border-radius: 16px; border-left: 4px solid #10b981;">
        <p style="margin: 0; color: #064e3b; font-size: 16px; line-height: 1.7; font-weight: 400;">
          {customGreeting}
        </p>
      </div>

      <!-- Stats Container -->
      <div class="stats-container" style="display: flex; gap: 24px; margin-bottom: 48px;">
        <!-- Stat 1 -->
        <div class="stat-card" style="flex: 1; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 28px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); position: relative; overflow: hidden;">
          <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background-color: #059669;"></div>
          <div style="font-size: 13px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">Monthly Presence</div>
          <div style="font-size: 40px; font-weight: 800; color: #064e3b; letter-spacing: -1px; line-height: 1;">{attendancePercentage}<span style="font-size: 24px; color: #059669; font-weight: 700; margin-left: 2px;">%</span></div>
        </div>
        <!-- Stat 2 -->
        <div class="stat-card" style="flex: 1; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 28px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); position: relative; overflow: hidden;">
          <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background-color: #34d399;"></div>
          <div style="font-size: 13px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">Total Punches</div>
          <div style="font-size: 40px; font-weight: 800; color: #064e3b; letter-spacing: -1px; line-height: 1;">{totalPresent}</div>
        </div>
        <!-- Stat 3 -->
        <div class="stat-card" style="flex: 1; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 28px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); position: relative; overflow: hidden;">
          <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background-color: #6ee7b7;"></div>
          <div style="font-size: 13px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">Active Staff</div>
          <div style="font-size: 40px; font-weight: 800; color: #064e3b; letter-spacing: -1px; line-height: 1;">{totalEmployees}</div>
        </div>
      </div>

      <!-- Table Section -->
      <div style="margin-bottom: 48px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px;">
          <div>
            <h3 style="margin: 0 0 6px 0; color: #064e3b; font-size: 18px; font-weight: 700; letter-spacing: -0.3px;">Detailed Attendance Grid</h3>
            <div style="font-size: 13px; color: #64748b; font-weight: 400;">Comprehensive overview of daily attendance records</div>
          </div>
          <div style="font-size: 12px; color: #047857; font-weight: 600; background: #ecfdf5; padding: 8px 14px; border-radius: 8px; border: 1px solid #a7f3d0; display: inline-flex; align-items: center; gap: 6px;">
            <span style="font-size: 14px;">↔</span> Scroll on mobile
          </div>
        </div>
        <div style="overflow-x: auto; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
          {table}
        </div>
      </div>

      <!-- Footer -->
      <div style="padding-top: 40px; border-top: 1px solid #e2e8f0; display: flex; flex-direction: column; align-items: center; text-align: center;">
        <div style="margin-bottom: 20px;">
          <img src="https://app.paradigmfms.com/paradigm-logo.png" alt="Paradigm" style="height: 28px; opacity: 0.6;">
        </div>
        <p style="margin: 0 0 24px 0; color: #64748b; font-size: 13px; font-weight: 400; max-width: 500px; line-height: 1.6;">
          This is an official automated compliance report generated by the Paradigm Attendance Management System.
        </p>
        <div style="display: inline-flex; align-items: center; gap: 16px; background: #f0fdf4; padding: 12px 24px; border-radius: 100px; border: 1px solid #bbf7d0;">
          <a href="https://app.paradigmfms.com" style="color: #047857; text-decoration: none; font-weight: 700; font-size: 13px;">
            Open Dashboard &rarr;
          </a>
          <span style="color: #6ee7b7;">|</span>
          <span style="color: #064e3b; font-size: 13px; font-weight: 500;">
            &copy; {year} Paradigm Facility Management Services
          </span>
        </div>
        <div style="margin-top: 24px; font-size: 11px; color: #94a3b8; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">
          Generated: {generatedTime} &bull; Request By: {generatedBy}
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
