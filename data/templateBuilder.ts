export interface MarketingTemplateContent {
  // Top Banner
  eyebrow: string;
  headline: string;
  subheadline: string;

  // Stats
  stat1Value: string;
  stat1Label: string;
  stat2Value: string;
  stat2Label: string;
  stat3Value: string;
  stat3Label: string;

  // Greeting & Opening
  greetingText: string;
  introPara1: string;
  introPara2: string;

  // Approach / Highlights Box
  approachBadge: string;
  approachTitle: string;
  bullet1Title: string;
  bullet1Desc: string;
  bullet2Title: string;
  bullet2Desc: string;
  bullet3Title: string;
  bullet3Desc: string;
  bullet4Title: string;
  bullet4Desc: string;

  // Call To Action Box
  ctaHeading: string;
  ctaSubtext: string;
  ctaButtonText: string;
  ctaButtonUrl: string;

  // Sender Signoff
  senderName: string;
  senderCompany: string;
  senderPhone: string;
  senderEmail: string;
  senderWebsite: string;
  whatsappNumber: string;
}

export const DEFAULT_TEMPLATE_CONTENT: MarketingTemplateContent = {
  eyebrow: 'A QUESTION FOR YOUR MANAGEMENT COMMITTEE',
  headline: 'You hired an FM agency.<br/>Why are you still <span style="color:#f2cf70">chasing daily problems?</span>',
  subheadline: 'Repeated complaints. Staff supervision. Equipment breakdowns. Vendor follow-ups. Rising maintenance costs.',
  stat1Value: '20',
  stat1Label: 'YEARS',
  stat2Value: '150+',
  stat2Label: 'COMMUNITIES',
  stat3Value: '5,000+',
  stat3Label: 'PROFESSIONALS',
  greetingText: 'Dear Management Committee Member,',
  introPara1: 'When committee members must repeatedly follow up on routine issues, the gap is often not manpower. It is <strong>supervision, accountability and timely reporting.</strong>',
  introPara2: 'At <strong>Paradigm Services</strong>, we help associations move from daily firefighting to structured, accountable facility management.',
  approachBadge: 'THE PARADIGM APPROACH',
  approachTitle: 'Less follow-up. Clearer accountability. Better-run communities.',
  bullet1Title: 'Complaints with clear ownership',
  bullet1Desc: 'Tracking, escalation and closure rather than repeated reminders.',
  bullet2Title: 'Preventive maintenance',
  bullet2Desc: 'Planned inspections to reduce avoidable breakdowns.',
  bullet3Title: 'Closer on-site supervision',
  bullet3Desc: 'Oversight of staff attendance, vendors and service standards.',
  bullet4Title: 'Better visibility of operating costs',
  bullet4Desc: 'Review of recurring expenses, AMCs and inefficiencies.',
  ctaHeading: 'Would a fresh look at your operations help?',
  ctaSubtext: 'We would be pleased to visit your community and share practical observations on its current operations. No obligation, and no need to consider an immediate change of service provider.',
  ctaButtonText: 'Request a Complimentary Site Review',
  ctaButtonUrl: 'https://app.paradigmfms.com/#/referral/business',
  senderName: 'Kavitha',
  senderCompany: 'Paradigm Integrated Facility Services Pvt. Ltd.',
  senderPhone: '+91 99006 08885',
  senderEmail: 'kavitha@paradigmfms.com',
  senderWebsite: 'www.paradigmfms.com',
  whatsappNumber: '919900608885'
};

export function buildMarketingHtml(content: Partial<MarketingTemplateContent>): string {
  const c: MarketingTemplateContent = {
    ...DEFAULT_TEMPLATE_CONTENT,
    ...content
  };

  const cleanWhatsapp = (c.whatsappNumber || '919900608885').replace(/\D/g, '');
  const cleanPhone = (c.senderPhone || '+91 99006 08885').trim();
  const phoneTel = cleanPhone.replace(/\s+/g, '');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta content="width=device-width,initial-scale=1" name="viewport"/>
<title>Paradigm | Better Managed Communities</title>
<style type="text/css">
  html, body { margin:0 !important; padding:0 !important; width:100% !important; }
  table { border-collapse:collapse; }
  img { max-width:100%; height:auto; }
  .email-shell { width:100% !important; max-width:650px !important; }
  .social-links { width:100% !important; max-width:500px !important; }
  .social-icon { width:52px !important; height:52px !important; }
  @media only screen and (max-width:600px) {
    .stat-number { font-size:24px !important; line-height:30px !important; }
    .stat-label { font-size:9px !important; letter-spacing:.5px !important; }
    .outer-pad { padding:8px 4px !important; }
    .email-shell { width:100% !important; max-width:100% !important; }
    .mobile-pad { padding-left:18px !important; padding-right:18px !important; }
    .mobile-heading { font-size:24px !important; line-height:1.25 !important; }
    .mobile-copy { font-size:15px !important; line-height:1.55 !important; }
    .social-links { width:100% !important; max-width:100% !important; }
    .social-links td { width:33.33%!important; padding-left:1px !important; padding-right:1px !important; }
    .social-icon { width:40px !important; height:40px !important; }
    .social-links a[aria-label="X"] { width:40px !important; }
    .social-links a[aria-label="X"] table,
    .social-links a[aria-label="X"] td { width:40px !important; height:40px !important; }
    .social-links a[aria-label="X"] td { font-size:28px !important; line-height:40px !important; }
    .social-label { font-size:10px !important; line-height:14px !important; padding-left:2px !important; padding-right:2px !important; white-space:normal !important; }
    .mobile-cta a { display:block !important; box-sizing:border-box !important; width:100% !important; max-width:320px !important; margin:0 auto !important; }
  }
  @media only screen and (max-width:380px) {
    .stat-number { font-size:20px !important; line-height:26px !important; }
    .stat-label { font-size:8px !important; letter-spacing:0 !important; }
    .social-icon { width:34px !important; height:34px !important; }
    .social-links a[aria-label="X"] { width:34px !important; }
    .social-links a[aria-label="X"] table,
    .social-links a[aria-label="X"] td { width:34px !important; height:34px !important; }
    .social-links a[aria-label="X"] td { font-size:24px !important; line-height:34px !important; }
    .social-label { font-size:9px !important; line-height:12px !important; padding-left:1px !important; padding-right:1px !important; }
    .mobile-heading { font-size:21px !important; }
  }
</style>
</head>
<body style="margin:0;background:#f0eee8;font-family:Arial,Helvetica,sans-serif;color:#26342d">
<div style="display:none;max-height:0;overflow:hidden">Less chasing. Better supervision. More time for your community.</div>
<table cellpadding="0" cellspacing="0" role="presentation" style="background:#f0eee8" width="100%">
<tr><td align="center" class="outer-pad" style="padding:20px 10px">
<table cellpadding="0" cellspacing="0" class="email-shell" role="presentation" style="width:100%;max-width:650px;background:#fff;border-collapse:collapse;border:4px solid #e3b94e;box-sizing:border-box" width="650">

<!-- Header Logo -->
<tr><td align="center" style="background:#ffffff;padding:38px 25px 32px">
  <img alt="Paradigm Services" src="https://fmyafuhxlorbafbacywa.supabase.co/storage/v1/object/public/email-assets/paradigm-services-logo.png" style="width:100%;max-width:420px;height:auto;display:block;margin:0 auto;border:0" width="420"/>
  <p style="font-size:12px;letter-spacing:3px;color:#0b5b35;margin:22px 0 0">RESIDENTIAL FACILITY MANAGEMENT</p>
</td></tr>

<!-- Hero Banner / Eyebrow / Headline / Stats -->
<tr><td align="center" style="background:#073b2b;padding:43px 36px 35px">
  <p style="font-size:12px;letter-spacing:2px;font-weight:bold;color:#f3d478;margin:0 0 18px">${c.eyebrow}</p>
  <h1 style="font-size:31px;line-height:1.25;color:#fff;margin:0 0 20px">${c.headline}</h1>
  <p style="color:#e4f2e9;font-size:17px;line-height:1.65;margin:0">${c.subheadline}</p>

  <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;margin-top:35px;table-layout:fixed;border-collapse:collapse" width="100%">
  <tr>
    <td align="center" style="padding:0 3px" valign="middle" width="31%">
      <div class="stat-number" style="font-size:30px;line-height:36px;color:#fff;font-weight:bold;white-space:nowrap">${c.stat1Value}</div>
      <div class="stat-label" style="color:#b8ddcb;font-size:11px;line-height:17px;letter-spacing:1px;white-space:nowrap">${c.stat1Label}</div>
    </td>
    <td align="center" style="padding:0" valign="middle" width="3.5%">
      <div style="width:1px;height:42px;background:#68a58a;font-size:0;line-height:0">&nbsp;</div>
    </td>
    <td align="center" style="padding:0 3px" valign="middle" width="31%">
      <div class="stat-number" style="font-size:30px;line-height:36px;color:#fff;font-weight:bold;white-space:nowrap">${c.stat2Value}</div>
      <div class="stat-label" style="color:#b8ddcb;font-size:11px;line-height:17px;letter-spacing:1px;white-space:nowrap">${c.stat2Label}</div>
    </td>
    <td align="center" style="padding:0" valign="middle" width="3.5%">
      <div style="width:1px;height:42px;background:#68a58a;font-size:0;line-height:0">&nbsp;</div>
    </td>
    <td align="center" style="padding:0 3px" valign="middle" width="31%">
      <div class="stat-number" style="font-size:30px;line-height:36px;color:#fff;font-weight:bold;white-space:nowrap">${c.stat3Value}</div>
      <div class="stat-label" style="color:#b8ddcb;font-size:11px;line-height:17px;letter-spacing:1px;white-space:nowrap">${c.stat3Label}</div>
    </td>
  </tr>
  </table>
</td></tr>

<!-- Greeting & Opening Letter -->
<tr><td style="padding:38px 42px 20px">
  <p style="font-size:17px;line-height:1.75;margin:0 0 17px">${c.greetingText}</p>
  <p style="font-size:17px;line-height:1.75;margin:0 0 17px">${c.introPara1}</p>
  <p style="font-size:17px;line-height:1.75;margin:0">${c.introPara2}</p>
</td></tr>

<!-- The Paradigm Approach Card -->
<tr><td style="padding:15px 42px 30px">
  <div style="background:#fff9e9;border:1px solid #ead7a4;padding:24px 25px">
    <p style="font-size:11px;color:#aa842d;font-weight:bold;letter-spacing:2px;margin:0 0 10px">${c.approachBadge}</p>
    <h2 style="color:#073b2b;font-size:24px;line-height:1.35;margin:0 0 20px">${c.approachTitle}</h2>
    <p style="font-size:15px;line-height:1.7;margin:0 0 12px"><strong>✓ &nbsp; ${c.bullet1Title}</strong><br/>${c.bullet1Desc}</p>
    <p style="font-size:15px;line-height:1.7;margin:0 0 12px"><strong>✓ &nbsp; ${c.bullet2Title}</strong><br/>${c.bullet2Desc}</p>
    <p style="font-size:15px;line-height:1.7;margin:0 0 12px"><strong>✓ &nbsp; ${c.bullet3Title}</strong><br/>${c.bullet3Desc}</p>
    <p style="font-size:15px;line-height:1.7;margin:0"><strong>✓ &nbsp; ${c.bullet4Title}</strong><br/>${c.bullet4Desc}</p>
  </div>
</td></tr>

<!-- Experience / Client Communities Table -->
<tr><td style="background:#ffffff;padding:29px 28px 32px">
  <p style="font-size:12px;letter-spacing:1.5px;color:#4a7b4f;font-weight:bold;margin:0">OUR EXPERIENCE</p>
  <h2 style="font-size:25px;line-height:1.2;color:#12472f;margin:9px 0">Communities that know our work</h2>
  <p style="font-size:13px;line-height:1.6;color:#53645a">A selection of residential communities from our company portfolio.</p>
  <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;max-width:100%;border-collapse:collapse;table-layout:fixed;margin:14px 0 0" width="100%">
    <tr>
      <td align="left" bgcolor="#ffffff" style="width:50%;padding:8px 10px;border-bottom:1px solid #e3ebe4;color:#234332;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;text-align:left;vertical-align:middle;box-sizing:border-box" width="50%"><span style="display:inline-block;background-color:#e3f1e8;color:#075b3b;font-weight:bold;padding:4px 8px;border-radius:3px;">NIKOO Homes</span></td>
      <td align="left" bgcolor="#ffffff" style="width:50%;padding:8px 10px;border-bottom:1px solid #e3ebe4;color:#234332;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;text-align:left;vertical-align:middle;box-sizing:border-box" width="50%"><span style="display:inline-block;background-color:#e3f1e8;color:#075b3b;font-weight:bold;padding:4px 8px;border-radius:3px;">Purva Venezia</span></td>
    </tr>
    <tr>
      <td align="left" bgcolor="#ffffff" style="width:50%;padding:8px 10px;border-bottom:1px solid #e3ebe4;color:#234332;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;text-align:left;vertical-align:middle;box-sizing:border-box" width="50%"><span style="display:inline-block;background-color:#e3f1e8;color:#075b3b;font-weight:bold;padding:4px 8px;border-radius:3px;">Mahendra Aarna</span></td>
      <td align="left" bgcolor="#ffffff" style="width:50%;padding:8px 10px;border-bottom:1px solid #e3ebe4;color:#234332;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;text-align:left;vertical-align:middle;box-sizing:border-box" width="50%"><span style="display:inline-block;background-color:#e3f1e8;color:#075b3b;font-weight:bold;padding:4px 8px;border-radius:3px;">Sobha Silicon Oasis</span></td>
    </tr>
    <tr>
      <td align="left" bgcolor="#ffffff" style="width:50%;padding:8px 10px;border-bottom:1px solid #e3ebe4;color:#234332;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;text-align:left;vertical-align:middle;box-sizing:border-box" width="50%"><span style="display:inline-block;background-color:#e3f1e8;color:#075b3b;font-weight:bold;padding:4px 8px;border-radius:3px;">Mahindra Windchimes</span></td>
      <td align="left" bgcolor="#ffffff" style="width:50%;padding:8px 10px;border-bottom:1px solid #e3ebe4;color:#234332;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;text-align:left;vertical-align:middle;box-sizing:border-box" width="50%"><span style="display:inline-block;background-color:#e3f1e8;color:#075b3b;font-weight:bold;padding:4px 8px;border-radius:3px;">Shriram Smrithi</span></td>
    </tr>
    <tr>
      <td align="left" bgcolor="#ffffff" style="width:50%;padding:8px 10px;border-bottom:1px solid #e3ebe4;color:#234332;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;text-align:left;vertical-align:middle;box-sizing:border-box" width="50%"><span style="display:inline-block;background-color:#e3f1e8;color:#075b3b;font-weight:bold;padding:4px 8px;border-radius:3px;">Prestige Oasis</span></td>
      <td align="left" bgcolor="#ffffff" style="width:50%;padding:8px 10px;border-bottom:1px solid #e3ebe4;color:#234332;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;text-align:left;vertical-align:middle;box-sizing:border-box" width="50%"><span style="display:inline-block;background-color:#e3f1e8;color:#075b3b;font-weight:bold;padding:4px 8px;border-radius:3px;">Prestige Southridge</span></td>
    </tr>
    <tr>
      <td align="left" bgcolor="#ffffff" style="width:50%;padding:8px 10px;border-bottom:1px solid #e3ebe4;color:#234332;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;text-align:left;vertical-align:middle;box-sizing:border-box" width="50%"><span style="display:inline-block;background-color:#e3f1e8;color:#075b3b;font-weight:bold;padding:4px 8px;border-radius:3px;">Salarpuria Luxuria</span></td>
      <td align="left" bgcolor="#ffffff" style="width:50%;padding:8px 10px;border-bottom:1px solid #e3ebe4;color:#234332;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;text-align:left;vertical-align:middle;box-sizing:border-box" width="50%"><span style="display:inline-block;background-color:#e3f1e8;color:#075b3b;font-weight:bold;padding:4px 8px;border-radius:3px;">Ahad Euphoria</span></td>
    </tr>
    <tr>
      <td align="left" bgcolor="#ffffff" style="width:50%;padding:8px 10px;border-bottom:1px solid #e3ebe4;color:#234332;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;text-align:left;vertical-align:middle;box-sizing:border-box" width="50%"><span style="display:inline-block;background-color:#e3f1e8;color:#075b3b;font-weight:bold;padding:4px 8px;border-radius:3px;">Uber Verdant Phase II</span></td>
      <td align="left" bgcolor="#ffffff" style="width:50%;padding:8px 10px;border-bottom:1px solid #e3ebe4;color:#234332;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;text-align:left;vertical-align:middle;box-sizing:border-box" width="50%"><span style="display:inline-block;background-color:#e3f1e8;color:#075b3b;font-weight:bold;padding:4px 8px;border-radius:3px;">Mantri Elegance</span></td>
    </tr>
    <tr>
      <td align="left" bgcolor="#ffffff" style="width:50%;padding:8px 10px;border-bottom:1px solid #e3ebe4;color:#234332;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;text-align:left;vertical-align:middle;box-sizing:border-box" width="50%"><span style="display:inline-block;background-color:#e3f1e8;color:#075b3b;font-weight:bold;padding:4px 8px;border-radius:3px;">Sobha Chrysanthemum</span></td>
      <td align="left" bgcolor="#ffffff" style="width:50%;padding:8px 10px;border-bottom:1px solid #e3ebe4;color:#234332;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;text-align:left;vertical-align:middle;box-sizing:border-box" width="50%"><span style="display:inline-block;background-color:#e3f1e8;color:#075b3b;font-weight:bold;padding:4px 8px;border-radius:3px;">Birla Alokya</span></td>
    </tr>
  </table>
  <p style="font-size:12px;color:#65746a;margin:18px 0 0">And many more communities across Bengaluru, Hyderabad and Pune.</p>
</td></tr>

<!-- Call To Action (CTA) Box -->
<tr><td align="center" bgcolor="#073b2b" style="background:#073b2b;padding:35px 38px 40px">
  <h2 style="font-size:26px;line-height:1.35;color:#fff;margin:0 0 15px">${c.ctaHeading}</h2>
  <p style="font-size:16px;line-height:1.65;color:#e1ece5;margin:0 0 25px">${c.ctaSubtext}</p>
  <a href="${c.ctaButtonUrl}" style="display:inline-block;background:#e3b94e;color:#173b2d;font-size:16px;font-weight:bold;text-decoration:none;padding:17px 25px;border-radius:7px;box-sizing:border-box">${c.ctaButtonText}</a>
</td></tr>

<!-- Signoff & Contact Footer -->
<tr><td align="center" style="padding:30px 25px 22px">
  <p style="margin:0 0 7px;font-size:15px">Warm regards, <strong>${c.senderName}</strong></p>
  <p style="margin:0 0 12px;font-size:14px">${c.senderCompany}</p>
  <p style="margin:0 0 12px;font-size:14px"><a href="tel:${phoneTel}" style="color:#076747;text-decoration:none">${cleanPhone}</a> &nbsp; | &nbsp; <a href="mailto:${c.senderEmail}" style="color:#076747;text-decoration:none">${c.senderEmail}</a></p>
  <p style="margin:0 0 22px"><a href="https://${c.senderWebsite.replace(/^https?:\/\//, '')}" rel="noopener" style="color:#076747;font-size:14px;text-decoration:none" target="_blank">${c.senderWebsite}</a></p>

  <div style="border-top:1px solid #e3e8e3;padding-top:20px">
    <p class="mobile-cta" style="margin:0 0 20px;text-align:center">
      <a href="https://wa.me/${cleanWhatsapp}?text=Hello%20Paradigm%20Services%2C%20I%20would%20like%20to%20know%20more%20about%20your%20facility%20management%20services." rel="noopener" style="display:inline-block;background:#e3b94e;color:#173b2d;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;padding:17px 25px;border-radius:5px" target="_blank">Chat with us on WhatsApp</a>
    </p>

    <p style="font-size:13px;letter-spacing:1px;color:#52675a;font-weight:bold;margin:0 0 16px">CONNECT WITH PARADIGM</p>
    <table align="center" border="0" cellpadding="0" cellspacing="0" class="social-links" role="presentation" style="border-collapse:collapse;margin:0 auto;width:100%;max-width:240px">
      <tr>
        <td align="center" style="padding:0 1px 7px;vertical-align:top" width="33.33%">
          <a aria-label="Facebook" href="https://www.facebook.com/Paradigmfms/" rel="noopener" style="display:block;text-decoration:none;border:0" target="_blank">
            <img alt="Facebook" class="social-icon" height="52" src="https://fmyafuhxlorbafbacywa.supabase.co/storage/v1/object/public/email-assets/facebook.png" style="display:block;width:52px;height:52px;margin:0 auto;border:0;outline:none" width="52"/>
          </a>
        </td>
        <td align="center" style="padding:0 1px 7px;vertical-align:top" width="33.33%">
          <a aria-label="Instagram" href="https://www.instagram.com/paradigmfms/" rel="noopener" style="display:block;text-decoration:none;border:0" target="_blank">
            <img alt="Instagram" class="social-icon" height="52" src="https://fmyafuhxlorbafbacywa.supabase.co/storage/v1/object/public/email-assets/instagram.png" style="display:block;width:52px;height:52px;margin:0 auto;border:0;outline:none" width="52"/>
          </a>
        </td>
        <td align="center" style="padding:0 1px 7px;vertical-align:top" width="33.33%">
          <a aria-label="LinkedIn" href="https://www.linkedin.com/company/paradigmfms/" rel="noopener" style="display:block;text-decoration:none;border:0" target="_blank">
            <img alt="LinkedIn" class="social-icon" height="52" src="https://fmyafuhxlorbafbacywa.supabase.co/storage/v1/object/public/email-assets/linkedin.png" style="display:block;width:52px;height:52px;margin:0 auto;border:0;outline:none" width="52"/>
          </a>
        </td>
      </tr>
      <tr>
        <td align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:17px;color:#52675a;padding:0 1px 7px" width="33.33%">Facebook</td>
        <td align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:17px;color:#52675a;padding:0 1px 7px" width="33.33%">Instagram</td>
        <td align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:17px;color:#52675a;padding:0 1px 7px" width="33.33%">LinkedIn</td>
      </tr>
    </table>
  </div>

  <p style="font-size:11px;color:#78877e;margin:18px 0 0">Bengaluru · Hyderabad · Pune</p>
  <p style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:18px;color:#78877e;margin:18px 0 0;padding-top:16px;border-top:1px solid #e3e8e3">
    You are receiving this email because of your connection with Paradigm Integrated Facility Services.<br/>
    If you no longer wish to receive marketing emails, <a href="mailto:${c.senderEmail}?subject=Unsubscribe%20from%20Paradigm%20emails" style="color:#076747;font-weight:bold;text-decoration:none">unsubscribe here</a>.
  </p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

