import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

// Move environment variable retrieval inside functions to avoid ESM hoisting problems
const getSupabaseConfig = () => ({
  url: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
});

import { reportGenerators, evaluateConditionals, resolveRecipients } from '../utils/reportGenerators.js';

interface EmailPayload {
  to?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject?: string;
  html?: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content?: string; // base64
    path?: string;    // URL
  }>;
  // If provided, override the default SMTP config
  smtpConfig?: SmtpConfig;
  // Metadata for logging
  ruleId?: string;
  test?: boolean;
  testEmail?: string;
  templateId?: string;
  triggerType?: 'manual' | 'automatic';
}

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
}

// Get email config from Supabase settings or environment
async function getSmtpConfig(): Promise<SmtpConfig> {
  const fallback: SmtpConfig = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    fromEmail: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || '',
    fromName: process.env.SMTP_FROM_NAME || 'Paradigm FMS',
    replyTo: process.env.SMTP_REPLY_TO,
  };

  // If env vars are present, skip DB fetch (faster for local dev)
  if (fallback.user && fallback.pass) {
    console.log('[send-email] Using SMTP config from environment variables');
    return fallback;
  }

  try {
    const { url, serviceKey } = getSupabaseConfig();
    if (url && serviceKey) {
      const supabase = createClient(url, serviceKey);
      const { data, error } = await supabase
        .from('settings')
        .select('email_config')
        .eq('id', 'singleton')
        .maybeSingle();

      if (error) throw error;

      if (data?.email_config?.host) {
        console.log('[send-email] Using SMTP config from database');
        return {
          host: data.email_config.host,
          port: data.email_config.port || 587,
          secure: data.email_config.secure || false,
          user: data.email_config.user,
          pass: data.email_config.pass,
          fromEmail: data.email_config.from_email || data.email_config.user,
          fromName: data.email_config.from_name || 'Paradigm FMS',
          replyTo: data.email_config.reply_to,
        };
      }
    }
  } catch (e: any) {
    console.warn('[send-email] Failed to fetch SMTP config from DB, falling back to env vars:', e.message);
  }

  return fallback;
}

// Log email to database for audit trail
async function logEmail(
  recipientEmail: string,
  subject: string,
  status: 'sent' | 'failed',
  errorMessage?: string,
  ruleId?: string,
  templateId?: string,
  triggerType?: string
) {
  try {
    const { url, serviceKey } = getSupabaseConfig();
    if (!url || !serviceKey) return;
    const supabase = createClient(url, serviceKey);
    await supabase.from('email_logs').insert({
      recipient_email: recipientEmail,
      subject,
      status,
      error_message: errorMessage || null,
      rule_id: ruleId || null,
      template_id: templateId || null,
      trigger_type: triggerType || null,
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[send-email] Failed to log email:', e);
  }
}

export async function sendEmailLogic(body: EmailPayload, supabaseUrl?: string, supabaseKey?: string) {
  // Get SMTP configuration
  const config = body.smtpConfig || await getSmtpConfig();
  const { url: envUrl, serviceKey: envKey } = getSupabaseConfig();

  if (!config.user || !config.pass) {
    throw new Error('SMTP not configured. Please set up email credentials in Notification Management → Email settings.');
  }

  const SUPABASE_URL = supabaseUrl || envUrl;
  const SUPABASE_SERVICE_KEY = supabaseKey || envKey;

  let { to, subject, html, ruleId, test, testEmail, triggerType, templateId } = body;

  // --- Special Case: Rule-based report generation ---
  if (ruleId) {
    console.log(`[send-email] Automated report trigger for rule: ${ruleId}`);
    const { url, serviceKey } = getSupabaseConfig();
    const SUPABASE_URL_REPORT = supabaseUrl || url;
    const SUPABASE_SERVICE_KEY_REPORT = supabaseKey || serviceKey;

    if (!SUPABASE_URL_REPORT || !SUPABASE_SERVICE_KEY_REPORT) {
      throw new Error('Supabase credentials missing for report generation');
    }
    const supabase = createClient(SUPABASE_URL_REPORT, SUPABASE_SERVICE_KEY_REPORT);
    
    // Fetch Rule
    const { data: rule, error: ruleErr } = await supabase.from('email_schedule_rules').select('*').eq('id', ruleId).single();
    if (ruleErr || !rule) throw new Error(ruleErr?.message || 'Rule not found');

    // Fetch Template
    const tid = templateId || rule.template_id;
    const { data: template } = await supabase.from('email_templates').select('*').eq('id', tid).single();
    
    // Generate Report Data
    const now = new Date();
    const IST_OFFSET = 5.5 * 60 * 60 * 1000;
    const nowIST = new Date(now.getTime() + IST_OFFSET);
    
    const generator = reportGenerators[rule.report_type as keyof typeof reportGenerators];
    if (!generator) throw new Error(`Unsupported report type: ${rule.report_type}`);
    
    const reportData = await generator(supabase, nowIST);
    
    // Render Content
    subject = template?.subject_template || rule.name;
    html = template?.body_template || `<div style="font-family:sans-serif"><h2>Report: {date}</h2>{table}</div>`;

    subject = evaluateConditionals(subject, reportData);
    html = evaluateConditionals(html, reportData);

    const render = (text: string) => text.replace(/\{(\w+)\}/g, (match, key) => {
      const dataKey = Object.keys(reportData).find(k => k.toLowerCase() === key.toLowerCase());
      return dataKey ? reportData[dataKey] : match;
    });

    subject = render(subject);
    html = render(html);

    // Solve Recipients
    if (test && testEmail) {
      to = [testEmail];
    } else if (!to) {
      to = await resolveRecipients(supabase, rule);
    }
    
    triggerType = test ? 'manual' : (triggerType || 'manual');
    templateId = tid;
  }

  if (!to || !subject || !html) {
    throw new Error('Missing required fields: to, subject, html (or ruleId)');
  }

  // Create transporter
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
    tls: {
      rejectUnauthorized: false
    }
  });

  // Normalize recipients
  const toAddresses = Array.isArray(to) ? to : [to];
  const ccAddresses = body.cc ? (Array.isArray(body.cc) ? body.cc : [body.cc]) : undefined;
  const bccAddresses = body.bcc ? (Array.isArray(body.bcc) ? body.bcc : [body.bcc]) : undefined;

  // Build mail options
  const mailOptions: nodemailer.SendMailOptions = {
    from: `"${config.fromName}" <${config.fromEmail}>`,
    to: toAddresses.join(', '),
    cc: ccAddresses?.join(', '),
    bcc: bccAddresses?.join(', '),
    replyTo: config.replyTo || config.fromEmail,
    subject: subject,
    html: html,
    text: body.text,
    attachments: body.attachments?.map(att => ({
      filename: att.filename,
      content: att.content ? Buffer.from(att.content, 'base64') : undefined,
      path: att.path,
    })),
  };

  // Send email
  const info = await transporter.sendMail(mailOptions);
  console.log('[send-email] Email sent:', info.messageId);

  // Log successful delivery
  for (const email of toAddresses) {
    await logEmail(email, subject, 'sent', undefined, ruleId, templateId, triggerType);
  }

  return info;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Security Check: Accept either INTERNAL_API_KEY or a valid Supabase JWT
  const apiKey = req.headers['x-api-key'];
  const internalKey = process.env.INTERNAL_API_KEY;
  const authHeader = req.headers['authorization'];

  let isAuthorized = false;

  try {
    // Standardize auth header (can be string or string[])
    const authHeaderRaw = req.headers['authorization'];
    const authHeader = Array.isArray(authHeaderRaw) ? authHeaderRaw[0] : authHeaderRaw;

    // Method 1: Internal API key (for cron jobs / server-to-server)
    if (internalKey && apiKey === internalKey) {
      isAuthorized = true;
      console.log('[send-email] Authenticated via Internal API Key');
    }

    // Method 2: Valid Supabase JWT (for browser requests)
    const { url, serviceKey } = getSupabaseConfig();
    if (!isAuthorized && authHeader && url && serviceKey) {
      try {
        const token = authHeader.replace('Bearer ', '');
        if (token && token !== 'undefined' && token !== 'null') {
          const supabase = createClient(url, serviceKey);
          const { data, error } = await supabase.auth.getUser(token);
          if (data?.user && !error) {
            isAuthorized = true;
            console.log(`[send-email] Authenticated via JWT: ${data.user.email}`);
          } else if (error) {
            console.warn('[send-email] JWT User fetch error:', error.message);
          }
        }
      } catch (e: any) {
        console.warn('[send-email] JWT validation exception:', e.message);
      }
    }
  } catch (authErr: any) {
    console.error('[send-email] Critical Auth Block Error:', authErr.message);
  }

  if (!isAuthorized) {
    console.warn('[send-email] Unauthorized request: No valid API Key or JWT');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const info = await sendEmailLogic(req.body);
    return res.status(200).json({
      success: true,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
    });
  } catch (error: any) {
    console.error('[send-email] Error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to send email',
      code: error.code,
    });
  }
}
