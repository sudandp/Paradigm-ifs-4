const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const PREMIUM_HTML = `<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 900px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #fff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
    <div style="background-color: #005d22; padding: 24px; color: white; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <h1 style="margin: 0; font-size: 24px; font-weight: 700;">Paradigm Office Services</h1>
        <p style="margin: 4px 0 0; opacity: 0.9; font-size: 14px;">Attendance Intelligence Report • {Date}</p>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 12px; opacity: 0.8;">Report Generated</div>
        <div style="font-weight: 600;">{reportDate} at {generatedTime}</div>
      </div>
    </div>
    
    <div style="padding: 24px;">
      <!-- Stats Row -->
      <div style="display: flex; gap: 16px; margin-bottom: 24px;">
        <div style="flex: 1; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; text-align: center;">
          <div style="font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; margin-bottom: 4px;">Attendance</div>
          <div style="font-size: 24px; font-weight: 700; color: #005d22;">{attendancePercentage}%</div>
        </div>
        <div style="flex: 1; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; text-align: center;">
          <div style="font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; margin-bottom: 4px;">Present</div>
          <div style="font-size: 24px; font-weight: 700; color: #16a34a;">{totalPresent}</div>
        </div>
        <div style="flex: 1; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; text-align: center;">
          <div style="font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; margin-bottom: 4px;">Absent</div>
          <div style="font-size: 24px; font-weight: 700; color: #dc2626;">{totalAbsent}</div>
        </div>
        <div style="flex: 1; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; text-align: center;">
          <div style="font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; margin-bottom: 4px;">Late Arrivals</div>
          <div style="font-size: 24px; font-weight: 700; color: #d97706;">{lateCount}</div>
        </div>
      </div>

      <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
        <h3 style="margin: 0; color: #1e293b; font-size: 16px; font-weight: 600;">Monthly Attendance Grid</h3>
        <div style="font-size: 11px; color: #64748b;">
          Legend: <span style="color: #16a34a; font-weight: bold;">P</span> Present | <span style="color: #d97706; font-weight: bold;">1/2P</span> Half Day | <span style="color: #dc2626; font-weight: bold;">A</span> Absent | <span style="color: #6b7280; font-weight: bold;">WO</span> Weekly Off | <span style="color: #854d0e; font-weight: bold; background: #fef9c3;">H</span> Holiday
        </div>
      </div>

      <div style="overflow-x: auto;">
        {table}
      </div>

      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center;">
        This is an automated report from the Paradigm Attendance System. All times are in IST.
      </div>
    </div>
  </div>`;

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
