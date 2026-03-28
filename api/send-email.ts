import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

interface EmailPayload {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  html: string;
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
  templateId?: string;
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
  try {
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      const { data } = await supabase
        .from('settings')
        .select('email_config')
        .eq('id', 'singleton')
        .single();

      if (data?.email_config?.host) {
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
  } catch (e) {
    console.warn('[send-email] Failed to fetch SMTP config from DB, falling back to env vars:', e);
  }

  // Fallback to environment variables
  return {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    fromEmail: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || '',
    fromName: process.env.SMTP_FROM_NAME || 'Paradigm FMS',
    replyTo: process.env.SMTP_REPLY_TO,
  };
}

// Log email to database for audit trail
async function logEmail(
  recipientEmail: string,
  subject: string,
  status: 'sent' | 'failed',
  errorMessage?: string,
  ruleId?: string,
  templateId?: string
) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    await supabase.from('email_logs').insert({
      recipient_email: recipientEmail,
      subject,
      status,
      error_message: errorMessage || null,
      rule_id: ruleId || null,
      template_id: templateId || null,
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[send-email] Failed to log email:', e);
  }
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

  try {
    const body: EmailPayload = req.body;

    if (!body.to || !body.subject || !body.html) {
      return res.status(400).json({ error: 'Missing required fields: to, subject, html' });
    }

    // Get SMTP configuration
    const config = body.smtpConfig || await getSmtpConfig();

    if (!config.user || !config.pass) {
      return res.status(500).json({ 
        error: 'SMTP not configured. Please set up email credentials in Notification Management → Email settings.' 
      });
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure, // true for 465, false for other ports
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });

    // Normalize recipients
    const toAddresses = Array.isArray(body.to) ? body.to : [body.to];
    const ccAddresses = body.cc ? (Array.isArray(body.cc) ? body.cc : [body.cc]) : undefined;
    const bccAddresses = body.bcc ? (Array.isArray(body.bcc) ? body.bcc : [body.bcc]) : undefined;

    // Build mail options
    const mailOptions: nodemailer.SendMailOptions = {
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: toAddresses.join(', '),
      cc: ccAddresses?.join(', '),
      bcc: bccAddresses?.join(', '),
      replyTo: config.replyTo || config.fromEmail,
      subject: body.subject,
      html: body.html,
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

    // Log successful delivery for each recipient
    for (const email of toAddresses) {
      await logEmail(email, body.subject, 'sent', undefined, body.ruleId, body.templateId);
    }

    return res.status(200).json({
      success: true,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
    });

  } catch (error: any) {
    console.error('[send-email] Error:', error);

    // Log failure
    const toAddresses = Array.isArray(req.body?.to) ? req.body.to : [req.body?.to].filter(Boolean);
    for (const email of toAddresses) {
      await logEmail(email, req.body?.subject || 'Unknown', 'failed', error.message, req.body?.ruleId, req.body?.templateId);
    }

    return res.status(500).json({
      error: error.message || 'Failed to send email',
      code: error.code,
    });
  }
}
