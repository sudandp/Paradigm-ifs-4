/**
 * AUTOMATED EMAIL SCHEDULER (GitHub Actions Version)
 * This script runs every 10 minutes on GitHub Actions.
 * It connects directly to Supabase, generates reports, and sends emails via SMTP.
 * Bypasses all Vercel WAF (429) and Deno Port restrictions.
 */

import { createClient } from '@supabase/supabase-js';
import * as nodemailer from 'nodemailer';
import { format, startOfDay } from 'date-fns';
import * as dotenv from 'dotenv';
import { reportGenerators, evaluateConditionals, resolveRecipients } from '../utils/reportGenerators';

dotenv.config({ path: '.env.local' });

// Configuration from Environment Variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';

const IST_OFFSET = 5.5 * 60 * 60 * 1000;

async function run() {
  console.log(`[Scheduler] Starting... ${new Date().toISOString()}`);

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[Error] Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 1. Fetch Email Config
  const { data: settings } = await supabase.from('settings').select('email_config').eq('id', 'singleton').single();
  const emailConfig = settings?.email_config;

  if (!emailConfig?.enabled) {
    console.log('[Info] Email automation is disabled in settings');
    return;
  }

  // 2. Fetch Active Rules
  const { data: rules, error: rulesErr } = await supabase
    .from('email_schedule_rules')
    .select('*')
    .eq('is_active', true);

  if (rulesErr) throw rulesErr;
  if (!rules || rules.length === 0) {
    console.log('[Info] No active email schedule rules found');
    return;
  }

  console.log(`[Info] Processing ${rules.length} active rule(s)...`);

  // 3. Setup SMTP Transporter
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    tls: {
      rejectUnauthorized: false
    }
  });

  const fromName = emailConfig.from_name || 'Paradigm FMS';
  const fromEmail = emailConfig.from_email || SMTP_USER;
  const replyTo = emailConfig.reply_to || fromEmail;

  const now = new Date();
  const nowIST = new Date(now.getTime() + IST_OFFSET);
  const istDateStr = nowIST.toISOString().substring(0, 10);
  const istTimeStr = `${String(nowIST.getUTCHours()).padStart(2, '0')}:${String(nowIST.getUTCMinutes()).padStart(2, '0')}`;

  console.log(`[Time] Current IST: ${istDateStr} ${istTimeStr}`);

  // 4. Load Templates
  const { data: templates } = await supabase.from('email_templates').select('*');
  const templateMap = new Map((templates || []).map(t => [t.id, t]));

  for (const rule of rules) {
    console.log(`\n[Rule] "${rule.name}" (${rule.report_type})`);
    
    // Trigger Check
    if (rule.trigger_type === 'scheduled') {
      const config = rule.schedule_config || {};
      const targetTime = config.time || '09:00';
      
      // Time check (Total minutes for precision)
      const [tHour, tMin] = targetTime.split(':').map(Number);
      const currentTotalMin = nowIST.getUTCHours() * 60 + nowIST.getUTCMinutes();
      const targetTotalMin = tHour * 60 + tMin;

      if (currentTotalMin < targetTotalMin) {
        console.log(`  → Skipped: Target time ${targetTime} IST not reached`);
        continue;
      }

      // Frequency Check
      const freq = config.frequency || 'daily';
      if (freq === 'weekly') {
        const targetDay = config.dayOfWeek !== undefined ? config.dayOfWeek : 5;
        if (targetDay !== nowIST.getUTCDay()) {
          console.log(`  → Skipped: Wrong day of week (Target: ${targetDay})`);
          continue;
        }
      }
      if (freq === 'monthly') {
        const targetDay = config.dayOfMonth !== undefined ? config.dayOfMonth : 1;
        if (targetDay !== nowIST.getUTCDate()) {
          console.log(`  → Skipped: Wrong day of month (Target: ${targetDay})`);
          continue;
        }
      }

      // Already Sent Check
      if (rule.last_sent_at) {
        const lastSentIST = new Date(new Date(rule.last_sent_at).getTime() + IST_OFFSET);
        const lastSentDateStr = lastSentIST.toISOString().substring(0, 10);
        if (lastSentDateStr === istDateStr) {
          console.log(`  → Skipped: Already sent today (${lastSentDateStr})`);
          continue;
        }
      }
    }

    // Generate Report
    console.log(`  → Executing: Generating ${rule.report_type} report...`);
    let reportData: Record<string, string> = { date: format(nowIST, 'EEEE, MMMM do, yyyy') };
    
    try {
      const generator = reportGenerators[rule.report_type as keyof typeof reportGenerators];
      if (generator) {
        reportData = await generator(supabase, nowIST);
      } else {
        console.warn(`  [!] No generator found for report type: ${rule.report_type}`);
        // Default placeholders
        reportData = { date: istDateStr, items: '0' };
      }
    } catch (err: any) {
      console.error(`  [!] Report generation failed:`, err.message);
      continue;
    }

    // Render Template
    const template = templateMap.get(rule.template_id);
    let subject = template?.subject_template || rule.name;
    let html = template?.body_template || getDefaultTemplate();

    // Conditionals & Placeholders
    subject = evaluateConditionals(subject, reportData);
    html = evaluateConditionals(html, reportData);

    const render = (text: string) => text.replace(/\{(\w+)\}/g, (match, key) => {
      const dataKey = Object.keys(reportData).find(k => k.toLowerCase() === key.toLowerCase());
      return dataKey ? reportData[dataKey] : match;
    });

    subject = render(subject);
    html = render(html);

    // Resolve Recipients
    const emails = await resolveRecipients(supabase, rule);
    if (emails.length === 0) {
      console.log(`  → Skipped: No recipients found`);
      continue;
    }

    // Send Email
    try {
      console.log(`  → Sending email to ${emails.length} recipient(s)...`);
      const info = await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: emails.join(', '),
        replyTo,
        subject,
        html,
      });

      console.log(`  ✅ Success: ${info.messageId}`);

      // Log & Update
      await Promise.all([
        ...emails.map(email => supabase.from('email_logs').insert({ 
          rule_id: rule.id, 
          template_id: rule.template_id, 
          recipient_email: email, 
          subject, 
          status: 'sent' 
        })),
        supabase.from('email_schedule_rules').update({ last_sent_at: now.toISOString() }).eq('id', rule.id)
      ]);
    } catch (sendErr: any) {
      console.error(`  ❌ Failed to send email:`, sendErr.message);
      await Promise.all(emails.map(email => supabase.from('email_logs').insert({ 
        rule_id: rule.id, 
        template_id: rule.template_id, 
        recipient_email: email, 
        subject, 
        status: 'failed', 
        error_message: sendErr.message 
      })));
    }
  }

  console.log(`\n[Scheduler] Completed. ${new Date().toISOString()}`);
}

function getDefaultTemplate() {
  return `<div style="font-family:sans-serif;max-width:800px;margin:auto;border:1px solid #eee;padding:20px">
    <h2>Report: {date}</h2>
    <table style="width:100%;border-collapse:collapse">
      <tr style="background:#f4f4f4"><th>Metric</th><th>Value</th></tr>
      <tr><td>Attendance</td><td>{attendancePercentage}%</td></tr>
      <tr><td>Present</td><td>{totalPresent}</td></tr>
    </table>
    <div style="margin-top:20px">{table}</div>
  </div>`;
}

// Start Execution
run().catch(err => {
  console.error('[Critical Error]', err);
  process.exit(1);
});
