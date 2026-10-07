const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function sendTest() {
  console.log('Fetching SMTP credentials from Supabase settings...');
  const { data: settings, error: settingsErr } = await supabase
    .from('settings')
    .select('email_config')
    .eq('id', 'singleton')
    .single();

  if (settingsErr || !settings?.email_config) {
    console.error('Failed to get email_config:', settingsErr);
    return;
  }

  const ec = settings.email_config;
  console.log(`Configured SMTP: host=${ec.host}, port=${ec.port}, user=${ec.user}`);

  const transporter = nodemailer.createTransport({
    host: ec.host || 'smtp.gmail.com',
    port: Number(ec.port) || 465,
    secure: ec.secure !== false,
    auth: {
      user: ec.user,
      pass: ec.pass,
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  // Verify connection first
  try {
    await transporter.verify();
    console.log('SMTP connection verified successfully!');
  } catch (verifyErr) {
    console.error('SMTP verification failed:', verifyErr);
    return;
  }

  // Load rendered HTML from scripts/test_rendered_email.html
  const htmlPath = path.join(__dirname, 'test_rendered_email.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  const recipients = ['sudhan@paradigmfms.com', 'sudandpineee@gmail.com'];
  const subject = `Sunday, October 4th, 2026 Attendance: 2% | 2 Present | 62 Absent | 0 Late [Full Width Mobile Fit]`;

  console.log(`Sending email to: ${recipients.join(', ')}...`);

  const mailOptions = {
    from: `"${ec.from_name || 'Paradigm Services'}" <${ec.from_email || ec.user}>`,
    to: recipients,
    subject: subject,
    html: htmlContent,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully!');
    console.log('Message ID:', info.messageId);
    console.log('Response:', info.response);

    // Log to email_logs in Supabase
    for (const r of recipients) {
      await supabase.from('email_logs').insert({
        recipient_email: r,
        subject: subject,
        status: 'sent',
        trigger_type: 'manual',
        metadata: {
          test: true,
          messageId: info.messageId,
          layout: 'responsive_mobile_tab_laptop'
        }
      });
    }
    console.log('Logged to email_logs in Supabase.');
  } catch (sendErr) {
    console.error('Failed to send mail:', sendErr);
  }
}

sendTest();
