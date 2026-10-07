const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function preview() {
  const { data: rule } = await supabase.from('email_schedule_rules').select('*, template:email_templates(*)').eq('id', '1c3dd098-1423-4a91-a5fa-6451dff6494d').single();
  const template = rule.template;

  const mailSummary = 'Nakul R Alvar was Present today, logging 9h 38m of work (08:47 AM – 04:10 PM). He travelled 17.69 km, visited 2 site(s), followed up with 3 client(s), and added 0 new lead(s).';

  let greetingContent = `<p style="margin:0 0 10px 0;font-weight:600;color:#0f172a;font-size:14px;">Dear Management,</p><p style="margin:0 0 10px 0;color:#334155;font-size:14px;line-height:1.6;">${mailSummary}</p><p style="margin:0 0 16px 0;color:#64748b;font-size:13px;">Please find the detailed daily activity report below:</p>`;
  
  // Left-aligned greeting block
  const greetingBlock = `\n<div style="font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:760px;margin:0 0 16px 0;padding:0;color:#1e293b;text-align:left;">\n  ${greetingContent}\n</div>\n`;

  let itemHtml = template.body_template;
  if (itemHtml.toLowerCase().includes('<body')) {
    itemHtml = itemHtml.replace(/(<body[^>]*>)/i, `$1${greetingBlock}`);
  } else {
    itemHtml = greetingBlock + itemHtml;
  }

  // Also replace dummy tokens
  itemHtml = itemHtml.replace(/\{report_date\}/g, '06 Oct 2026')
                     .replace(/\{bd_name\}/g, 'Nakul R Alvar')
                     .replace(/\{attendance_status\}/g, 'Present')
                     .replace(/\{check_in_time\}/g, '08:47 AM')
                     .replace(/\{check_out_time\}/g, '04:10 PM')
                     .replace(/\{working_hours\}/g, '9h 38m')
                     .replace(/\{kms_travelled\}/g, '17.69 km')
                     .replace(/\{calls_count\}/g, '0')
                     .replace(/\{meetings_count\}/g, '3')
                     .replace(/\{leads_count\}/g, '0')
                     .replace(/\{sites_count\}/g, '2');

  fs.writeFileSync('scratch/test_preview_left.html', itemHtml, 'utf-8');
  console.log('Saved scratch/test_preview_left.html');

  // Let's also test when table has align="left"
  let itemHtmlTableLeft = itemHtml.replace('<table align="center"', '<table align="left"')
                                  .replace('margin:0 auto;', 'margin:0 0 24px 0;');
  fs.writeFileSync('scratch/test_preview_both_left.html', itemHtmlTableLeft, 'utf-8');
  console.log('Saved scratch/test_preview_both_left.html');
}

preview().catch(console.error);
