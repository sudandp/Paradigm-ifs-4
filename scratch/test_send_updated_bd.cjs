const nodemailer = require('nodemailer');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function testSend() {
  const { data: settings } = await supabase.from('settings').select('email_config').eq('id', 'singleton').single();
  const ec = settings.email_config;
  const transporter = nodemailer.createTransport({
    host: ec.host || 'smtp.gmail.com',
    port: Number(ec.port) || 465,
    secure: ec.secure !== false,
    auth: { user: ec.user, pass: ec.pass },
    tls: { rejectUnauthorized: false }
  });

  const htmlContent = fs.readFileSync('test_rendered_nakul_r_alvar_2026-10-06.html', 'utf8');
  const recipients = ['sudhan@paradigmfms.com'];
  const subject = 'BD Daily Activity Report - Nakul R Alvar - 06 Oct 2026 [All 5 Sections Verified]';

  const info = await transporter.sendMail({
    from: `"${ec.from_name || 'Paradigm Services'}" <${ec.from_email || ec.user}>`,
    to: recipients,
    subject: subject,
    html: htmlContent,
  });
  console.log('Updated 5-section BD email sent successfully! MessageId:', info.messageId);
}
testSend().catch(console.error);
